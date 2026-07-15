/**
 * Starter holiday calendars for Rule 3 (Holiday Hours Overbilling).
 *
 * Covers fixed-date national holidays only. Lunar/festival-based holidays
 * (Diwali, Holi, Eid, etc. for India; similar variable-date holidays
 * elsewhere) are NOT included here because their exact dates aren't
 * something to guess at — add them explicitly once confirmed rather than
 * risk a wrong date silently under- or over-flagging invoices.
 */
export const HOLIDAY_CALENDAR: Record<string, string[]> = {
  US: [
    "2026-01-01", // New Year's Day
    "2026-01-19", // Martin Luther King Jr. Day
    "2026-02-16", // Washington's Birthday
    "2026-05-25", // Memorial Day
    "2026-06-19", // Juneteenth
    "2026-07-03", // Independence Day (observed, July 4 falls on Saturday)
    "2026-09-07", // Labor Day
    "2026-10-12", // Columbus Day
    "2026-11-11", // Veterans Day
    "2026-11-26", // Thanksgiving Day
    "2026-12-25", // Christmas Day
  ],
  IN: [
    "2026-01-26", // Republic Day
    "2026-08-15", // Independence Day
    "2026-10-02", // Gandhi Jayanti
  ],
};

export function holidaysInRange(country: string, start: Date, end: Date): string[] {
  const dates = HOLIDAY_CALENDAR[country.toUpperCase()] ?? [];
  return dates.filter((d) => {
    const day = new Date(d + "T00:00:00Z");
    return day >= start && day <= end;
  });
}
