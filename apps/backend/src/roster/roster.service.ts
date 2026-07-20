import { BadRequestException, Injectable } from "@nestjs/common";
import * as XLSX from "xlsx";
import { createHash } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { MonthsService } from "../months/months.service";

const DEMO_ORG_ID = "seed-org-1";

const COLUMN_ALIASES: Record<string, string[]> = {
  name: ["name", "consultant", "consultant name", "employee", "employee name", "employee full name"],
  hours: ["approved hours", "hours", "weekly hours", "invoiced hours"],
  rate: ["approved rate", "approved hourly rate", "rate", "hourly rate", "pay rate"],
  weekStart: ["week start", "week beginning", "weekstart", "week begin"],
  weekEnd: ["week end", "week ending", "weekend"],
  country: ["country", "work country"],
  project: ["project"],
  manager: ["manager", "manager name"],
  vendor: ["vendor name", "vendor"],
  client: ["client business name", "client name", "client"],
};

function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  const s = String(value).trim();
  return s === "" || s === "-";
}

function findValue(row: Record<string, unknown>, field: keyof typeof COLUMN_ALIASES): unknown {
  const keys = Object.keys(row);
  for (const alias of COLUMN_ALIASES[field]) {
    const match = keys.find((k) => k.trim().toLowerCase() === alias);
    if (match && !isBlank(row[match])) return row[match];
  }
  return undefined;
}

function looksLikeHeaderRow(cells: unknown[]): boolean {
  const normalized = cells.map((c) => String(c ?? "").trim().toLowerCase());
  const hasName = normalized.some((c) => COLUMN_ALIASES.name.includes(c));
  const hasHours = normalized.some((c) => COLUMN_ALIASES.hours.includes(c));
  return hasName && hasHours;
}

// Real-world exports (e.g. VMS/timesheet-reconciliation reports) often have title/metadata
// rows before the actual column header — scan for the row that looks like a header instead
// of assuming row 1 is it.
function extractRows(sheet: XLSX.WorkSheet): Record<string, unknown>[] {
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  const headerIdx = raw.findIndex((r) => looksLikeHeaderRow(r));
  const startIdx = headerIdx === -1 ? 0 : headerIdx;
  const headerCells = (raw[startIdx] ?? []).map((c) => String(c ?? "").trim());

  return raw
    .slice(startIdx + 1)
    .filter((r) => r.some((c) => String(c ?? "").trim() !== ""))
    .map((r) => {
      const obj: Record<string, unknown> = {};
      headerCells.forEach((h, i) => {
        if (h) obj[h] = r[i] ?? "";
      });
      return obj;
    });
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly monthsService: MonthsService,
  ) {}

  async uploadSheet(file: Express.Multer.File) {
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(file.buffer, { type: "buffer", cellDates: false });
    } catch {
      throw new BadRequestException("Couldn't read that file — upload a CSV or Excel (.xlsx) file.");
    }

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = extractRows(sheet);
    if (rows.length === 0) {
      throw new BadRequestException("That sheet has no rows.");
    }

    const month = await this.monthsService.currentLabel();

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
      const vendor = (findValue(row, "vendor") as string | undefined)?.trim();
      const client = (findValue(row, "client") as string | undefined)?.trim();
      const project = (findValue(row, "project") as string | undefined)?.trim() || vendor || client || null;
      const manager = (findValue(row, "manager") as string | undefined)?.trim() || null;

      // Same person can show up more than once in one sheet under different vendors/engagements
      // (no per-row week column to disambiguate) — fold vendor/client and the upload month into the
      // dedup key so those don't silently clobber each other, and re-uploading next month creates
      // fresh rows instead of overwriting this month's roster.
      const engagementKey = (vendor || client || "").toLowerCase();
      const sourceKey = `roster-${employeeName.toLowerCase()}-${engagementKey}-${month}-${weekStart ? weekStart.toISOString().slice(0, 10) : "no-week"}`;
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
            month,
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

  async findAll(month?: string) {
    const roster = await this.prisma.timesheet.findMany({
      where: { organizationId: DEMO_ORG_ID, ...(month ? { month } : {}) },
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
      month: r.month,
    }));
  }
}
