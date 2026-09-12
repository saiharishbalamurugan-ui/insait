// Matches roster sheet headers to the fields Audix needs by meaning, not exact text —
// real-world exports name the same column a dozen different ways ("Employee First Name",
// "Consultant Name", "Staff Name", …). Each field has token rules tried in priority order;
// the first header that satisfies a rule (and hits none of its excludes) wins that tier.
// Multiple headers can qualify for one field (e.g. several "hours" columns) — all are kept,
// ranked, so the per-row reader can skip blank cells and fall through to the next candidate,
// exactly like picking "Approved Hours" over an empty "Invoiced Hours" column.

export type RosterField =
  | "name"
  | "hours"
  | "rate"
  | "billRate"
  | "weekStart"
  | "weekEnd"
  | "country"
  | "project"
  | "manager"
  | "vendor"
  | "client";

export const REQUIRED_FIELDS: RosterField[] = ["name", "hours", "rate"];

export const ALL_FIELDS: RosterField[] = [
  "name",
  "hours",
  "rate",
  "billRate",
  "vendor",
  "client",
  "weekStart",
  "weekEnd",
  "country",
  "project",
  "manager",
];

export const FIELD_LABELS: Record<RosterField, string> = {
  name: "Consultant Name",
  hours: "Approved Hours",
  rate: "Pay Rate",
  billRate: "Bill Rate",
  vendor: "Vendor",
  client: "Client",
  weekStart: "Week Start",
  weekEnd: "Week End",
  country: "Country",
  project: "Project",
  manager: "Manager",
};

interface FieldRule {
  include: string[][]; // ordered priority tiers — each inner array is a token set that must ALL be present
  exclude?: string[]; // any of these tokens present disqualifies the header for this field
}

const RULES: Record<RosterField, FieldRule> = {
  name: {
    include: [
      ["employee", "name"],
      ["employee", "first"],
      ["employee", "full"],
      ["consultant", "name"],
      ["staff", "name"],
      ["worker", "name"],
      ["resource", "name"],
      ["full", "name"],
      ["name"],
      ["employee"],
      ["consultant"],
    ],
    exclude: ["manager", "vendor", "client", "business", "project", "company", "supervisor"],
  },
  hours: {
    include: [["approved", "hour"], ["hour"], ["hrs"]],
    exclude: ["submitted", "billable", "invoiced", "difference", "overtime"],
  },
  rate: {
    include: [["pay", "rate"], ["approved", "rate"], ["hourly", "rate"], ["rate"]],
    exclude: ["bill"],
  },
  billRate: {
    include: [["bill", "rate"], ["billing", "rate"], ["billed", "rate"], ["client", "rate"]],
  },
  vendor: {
    include: [["vendor", "name"], ["vendor"], ["agency"]],
  },
  client: {
    include: [["client", "business", "name"], ["client", "name"], ["end", "client"], ["client"]],
  },
  weekStart: {
    include: [["week", "start"], ["week", "beginning"], ["weekstart"], ["week", "begin"]],
  },
  weekEnd: {
    include: [["week", "end"], ["week", "ending"], ["weekend"]],
  },
  country: {
    include: [["country"], ["work", "country"], ["location"]],
  },
  project: {
    include: [["project"], ["engagement"]],
  },
  manager: {
    include: [["manager", "name"], ["manager"], ["supervisor"]],
  },
};

function tokenize(header: string): string[] {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export interface FieldMatch {
  header: string | null;
  candidates: string[]; // ranked, most-preferred first
}

export type ColumnMapping = Record<RosterField, FieldMatch>;

// Rule tokens are the singular/base form ("hour", "rate") — a header token counts as a hit
// if it starts with the rule token, so plurals and simple suffixes ("hours", "rates",
// "billing") match without needing every variant spelled out.
function tokenHits(headerToken: string, ruleToken: string): boolean {
  return headerToken === ruleToken || headerToken.startsWith(ruleToken);
}

export function matchColumns(headers: string[]): ColumnMapping {
  const tokensByHeader = new Map(headers.map((h) => [h, tokenize(h)]));
  const result = {} as ColumnMapping;

  for (const field of ALL_FIELDS) {
    const rule = RULES[field];
    const ranked: string[] = [];
    for (const tokenSet of rule.include) {
      for (const header of headers) {
        if (ranked.includes(header)) continue;
        const tokens = tokensByHeader.get(header)!;
        const includesAll = tokenSet.every((t) => tokens.some((tok) => tokenHits(tok, t)));
        const hasExcluded = rule.exclude?.some((t) => tokens.some((tok) => tokenHits(tok, t))) ?? false;
        if (includesAll && !hasExcluded) ranked.push(header);
      }
    }
    result[field] = { header: ranked[0] ?? null, candidates: ranked };
  }

  return result;
}

/** User-provided header picks (from the manual-mapping UI) take absolute priority over auto-detection. */
export function applyMappingOverride(mapping: ColumnMapping, overrides: Partial<Record<RosterField, string>>): ColumnMapping {
  const next = { ...mapping };
  for (const [field, header] of Object.entries(overrides) as [RosterField, string | undefined][]) {
    if (header) next[field] = { header, candidates: [header] };
  }
  return next;
}

function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  const s = String(value).trim();
  return s === "" || s === "-";
}

export function readField(row: Record<string, unknown>, match: FieldMatch): unknown {
  for (const header of match.candidates) {
    const v = row[header];
    if (!isBlank(v)) return v;
  }
  return undefined;
}
