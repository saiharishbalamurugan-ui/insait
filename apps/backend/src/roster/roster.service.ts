import { BadRequestException, Injectable } from "@nestjs/common";
import * as XLSX from "xlsx";
import { createHash } from "crypto";
import { PrismaService } from "../prisma/prisma.service";

const DEMO_ORG_ID = "seed-org-1";

const COLUMN_ALIASES: Record<string, string[]> = {
  name: ["name", "consultant", "consultant name", "employee", "employee name"],
  hours: ["approved hours", "hours", "weekly hours", "invoiced hours"],
  rate: ["approved rate", "approved hourly rate", "rate", "hourly rate"],
  weekStart: ["week start", "week beginning", "weekstart", "week begin"],
  weekEnd: ["week end", "week ending", "weekend"],
  country: ["country", "work country"],
  project: ["project"],
  manager: ["manager", "manager name"],
};

function findValue(row: Record<string, unknown>, field: keyof typeof COLUMN_ALIASES): unknown {
  const keys = Object.keys(row);
  for (const alias of COLUMN_ALIASES[field]) {
    const match = keys.find((k) => k.trim().toLowerCase() === alias);
    if (match && row[match] !== undefined && row[match] !== "") return row[match];
  }
  return undefined;
}

function parseDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") {
    // Excel serial date
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export interface RosterRowResult {
  employeeName: string;
  ok: boolean;
  error?: string;
}

@Injectable()
export class RosterService {
  constructor(private readonly prisma: PrismaService) {}

  async uploadSheet(file: Express.Multer.File) {
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(file.buffer, { type: "buffer", cellDates: false });
    } catch {
      throw new BadRequestException("Couldn't read that file — upload a CSV or Excel (.xlsx) file.");
    }

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    if (rows.length === 0) {
      throw new BadRequestException("That sheet has no rows.");
    }

    const results: RosterRowResult[] = [];
    let created = 0;
    let updated = 0;

    for (const row of rows) {
      const name = findValue(row, "name");
      const hours = findValue(row, "hours");
      const rate = findValue(row, "rate");

      if (!name || hours === undefined || rate === undefined) {
        results.push({ employeeName: String(name ?? "unknown row"), ok: false, error: "Missing name, hours, or rate" });
        continue;
      }

      const employeeName = String(name).trim();
      const weekStart = parseDate(findValue(row, "weekStart"));
      const weekEnd = parseDate(findValue(row, "weekEnd"));
      const country = (findValue(row, "country") as string | undefined)?.trim() || "US";
      const project = (findValue(row, "project") as string | undefined)?.trim() || null;
      const manager = (findValue(row, "manager") as string | undefined)?.trim() || null;

      const sourceKey = `roster-${employeeName.toLowerCase()}-${weekStart ? weekStart.toISOString().slice(0, 10) : "no-week"}`;
      const sourceId = createHash("sha1").update(sourceKey).digest("hex").slice(0, 24);

      try {
        const existing = await this.prisma.timesheet.findUnique({ where: { sourceId } });
        await this.prisma.timesheet.upsert({
          where: { sourceId },
          create: {
            organizationId: DEMO_ORG_ID,
            sourceId,
            employeeName,
            workDate: weekStart ?? new Date(),
            weekStart,
            weekEnd,
            country,
            hours: Number(hours),
            hourlyRate: Number(rate),
            project,
            managerName: manager,
          },
          update: {
            hours: Number(hours),
            hourlyRate: Number(rate),
            country,
            project,
            managerName: manager,
            weekStart,
            weekEnd,
          },
        });
        existing ? updated++ : created++;
        results.push({ employeeName, ok: true });
      } catch (err) {
        results.push({ employeeName, ok: false, error: (err as Error).message });
      }
    }

    return { totalRows: rows.length, created, updated, failed: results.filter((r) => !r.ok).length, results };
  }

  async findAll() {
    const roster = await this.prisma.timesheet.findMany({
      where: { organizationId: DEMO_ORG_ID },
      orderBy: [{ employeeName: "asc" }, { weekStart: "desc" }],
    });

    return roster.map((r) => ({
      id: r.id,
      employeeName: r.employeeName,
      hours: Number(r.hours),
      hourlyRate: Number(r.hourlyRate),
      country: r.country,
      weekStart: r.weekStart,
      weekEnd: r.weekEnd,
      project: r.project,
      managerName: r.managerName,
      updatedAt: r.updatedAt,
    }));
  }
}
