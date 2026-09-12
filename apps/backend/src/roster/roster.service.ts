import { BadRequestException, Injectable } from "@nestjs/common";
import * as XLSX from "xlsx";
import { createHash } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { MonthsService } from "../months/months.service";
import {
  ALL_FIELDS,
  REQUIRED_FIELDS,
  RosterField,
  applyMappingOverride,
  matchColumns,
  readField,
} from "./column-matcher";

const DEMO_ORG_ID = "seed-org-1";

function looksLikeHeaderRow(cells: unknown[]): boolean {
  const headers = cells.map((c) => String(c ?? "").trim()).filter(Boolean);
  if (headers.length === 0) return false;
  const matches = matchColumns(headers);
  return matches.name.candidates.length > 0 && matches.hours.candidates.length > 0;
}

// Real-world exports (e.g. VMS/timesheet-reconciliation reports) often have title/metadata
// rows before the actual column header — scan for the row that looks like a header instead
// of assuming row 1 is it.
function extractRows(sheet: XLSX.WorkSheet): { headers: string[]; rows: Record<string, unknown>[] } {
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  const headerIdx = raw.findIndex((r) => looksLikeHeaderRow(r));
  const startIdx = headerIdx === -1 ? 0 : headerIdx;
  const headerCells = (raw[startIdx] ?? []).map((c) => String(c ?? "").trim());
  const headers = headerCells.filter(Boolean);

  const rows = raw
    .slice(startIdx + 1)
    .filter((r) => r.some((c) => String(c ?? "").trim() !== ""))
    .map((r) => {
      const obj: Record<string, unknown> = {};
      headerCells.forEach((h, i) => {
        if (h) obj[h] = r[i] ?? "";
      });
      return obj;
    });

  return { headers, rows };
}

// A workbook's first tab is often a dashboard/summary sheet, with the actual per-employee
// rows on a later tab — always reading SheetNames[0] silently misreads those files. Try
// every sheet and use the first one that actually looks like a roster (a real header row
// with both a name and an hours column); fall back to the first sheet's own best-effort
// extraction only if nothing in the workbook looks like a roster at all.
function selectBestSheet(workbook: XLSX.WorkBook): { headers: string[]; rows: Record<string, unknown>[] } {
  let fallback: { headers: string[]; rows: Record<string, unknown>[] } | null = null;
  for (const name of workbook.SheetNames) {
    const extracted = extractRows(workbook.Sheets[name]);
    if (!fallback) fallback = extracted;
    if (extracted.headers.length === 0 || extracted.rows.length === 0) continue;
    const mapping = matchColumns(extracted.headers);
    if (mapping.name.candidates.length > 0 && mapping.hours.candidates.length > 0) {
      return extracted;
    }
  }
  return fallback ?? { headers: [], rows: [] };
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

function toNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

// Timesheet exports commonly report hours as "HH:MM" duration strings (e.g. "144:00" for
// 144 hours) rather than plain decimals — a bare Number() on that produces NaN, silently
// failing every row. "-" is how these sheets mark a genuinely empty cell.
function parseHours(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return Number.isNaN(value) ? null : value;
  const str = String(value).trim();
  if (str === "" || str === "-") return null;
  const hhmm = str.match(/^(\d+):(\d{2})$/);
  if (hhmm) return Number(hhmm[1]) + Number(hhmm[2]) / 60;
  const n = Number(str);
  return Number.isNaN(n) ? null : n;
}

export interface RosterRowResult {
  employeeName: string;
  ok: boolean;
  error?: string;
}

export interface RosterUploadNeedsMapping {
  needsMapping: true;
  headers: string[];
  detectedMapping: Partial<Record<RosterField, string>>;
  missingFields: RosterField[];
  sampleRows: Record<string, unknown>[];
}

export interface RosterUploadCompleted {
  needsMapping: false;
  totalRows: number;
  created: number;
  updated: number;
  failed: number;
  results: RosterRowResult[];
}

@Injectable()
export class RosterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly monthsService: MonthsService,
  ) {}

  async uploadSheet(
    file: Express.Multer.File,
    mappingOverrides?: Partial<Record<RosterField, string>>,
  ): Promise<RosterUploadNeedsMapping | RosterUploadCompleted> {
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(file.buffer, { type: "buffer", cellDates: false });
    } catch {
      throw new BadRequestException("Couldn't read that file — upload a CSV or Excel (.xlsx) file.");
    }

    const { headers, rows } = selectBestSheet(workbook);
    if (rows.length === 0) {
      throw new BadRequestException("That sheet has no rows.");
    }

    let mapping = matchColumns(headers);
    if (mappingOverrides) mapping = applyMappingOverride(mapping, mappingOverrides);

    const missingFields = REQUIRED_FIELDS.filter((f) => mapping[f].candidates.length === 0);
    if (missingFields.length > 0) {
      return {
        needsMapping: true,
        headers,
        detectedMapping: Object.fromEntries(ALL_FIELDS.map((f) => [f, mapping[f].header])) as Partial<
          Record<RosterField, string>
        >,
        missingFields,
        sampleRows: rows.slice(0, 3),
      };
    }

    const month = await this.monthsService.currentLabel();

    const results: RosterRowResult[] = [];
    let created = 0;
    let updated = 0;

    for (const row of rows) {
      const name = readField(row, mapping.name);
      const hours = parseHours(readField(row, mapping.hours));
      const rate = readField(row, mapping.rate);

      if (!name || hours === null || rate === undefined) {
        results.push({ employeeName: String(name ?? "unknown row"), ok: false, error: "Missing name, hours, or rate" });
        continue;
      }

      const employeeName = String(name).trim();
      const weekStart = parseDate(readField(row, mapping.weekStart));
      const weekEnd = parseDate(readField(row, mapping.weekEnd));
      const country = (readField(row, mapping.country) as string | undefined)?.toString().trim() || "US";
      const vendor = (readField(row, mapping.vendor) as string | undefined)?.toString().trim();
      const client = (readField(row, mapping.client) as string | undefined)?.toString().trim();
      const project = (readField(row, mapping.project) as string | undefined)?.toString().trim() || vendor || client || null;
      const manager = (readField(row, mapping.manager) as string | undefined)?.toString().trim() || null;
      const billRate = toNumber(readField(row, mapping.billRate));

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
            hours,
            hourlyRate: Number(rate),
            billRate,
            vendor: vendor || null,
            project,
            managerName: manager,
            month,
          },
          update: {
            hours,
            hourlyRate: Number(rate),
            billRate,
            vendor: vendor || null,
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

    return {
      needsMapping: false,
      totalRows: rows.length,
      created,
      updated,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
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
      billRate: r.billRate !== null ? Number(r.billRate) : null,
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
