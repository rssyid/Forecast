import type pg from 'pg';
import { formatWibDate } from './date';

export interface CalendarWeekInfo {
  week_name: string;
  week_label: string;
  week_start: string;
  week_end: string;
}

const MONTH_ABBR = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function parseIsoDateUtc(isoDate: string): Date {
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    throw new Error(`Format tanggal ISO tidak valid: "${isoDate}"`);
  }
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  return new Date(Date.UTC(year, month, day));
}

function formatUtcIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDaysUtc(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

/**
 * Deterministic Monday-Sunday week fallback matching public.calendar_weeks
 * formatting when a target date is outside seeded rows (e.g. 2027+).
 */
export function buildFallbackWeekForDate(isoDate: string): CalendarWeekInfo {
  const target = parseIsoDateUtc(isoDate);
  const dow = target.getUTCDay();
  const offsetToMonday = (dow + 6) % 7;
  const monday = addDaysUtc(target, -offsetToMonday);
  const sunday = addDaysUtc(monday, 6);
  const thursday = addDaysUtc(monday, 3);

  const month = thursday.getUTCMonth() + 1;
  const year = thursday.getUTCFullYear();

  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const firstDow = firstOfMonth.getUTCDay();
  const firstMondayOffset = (firstDow + 6) % 7;
  let firstMonday = addDaysUtc(firstOfMonth, -firstMondayOffset);
  if (addDaysUtc(firstMonday, 3).getUTCMonth() + 1 !== month) {
    firstMonday = addDaysUtc(firstMonday, 7);
  }

  const weekIndex =
    Math.floor((monday.getTime() - firstMonday.getTime()) / (7 * 86400000)) + 1;
  const safeWeek = Math.max(1, weekIndex);

  return {
    week_name: `W${safeWeek}${month}${year}`,
    week_label: `${MONTH_ABBR[month - 1]} ${year}, W${safeWeek}`,
    week_start: formatUtcIsoDate(monday),
    week_end: formatUtcIsoDate(sunday),
  };
}

function mapWeekRow(row: Record<string, unknown>): CalendarWeekInfo {
  return {
    week_name: String(row.week_name),
    week_label: String(row.formatted_name),
    week_start: String(row.start_date),
    week_end: String(row.end_date),
  };
}

export async function resolveWeekByDate(
  pool: pg.Pool,
  isoDateWib: string
): Promise<CalendarWeekInfo> {
  const res = await pool.query(
    `
    SELECT week_name, formatted_name, start_date::text AS start_date, end_date::text AS end_date
    FROM calendar_weeks
    WHERE start_date <= $1::date AND end_date >= $1::date
    ORDER BY start_date DESC
    LIMIT 1
    `,
    [isoDateWib]
  );

  if (res.rows.length > 0) {
    return mapWeekRow(res.rows[0]);
  }
  return buildFallbackWeekForDate(isoDateWib);
}

export async function resolveWeekByLabel(
  pool: pg.Pool,
  labelOrName: string
): Promise<CalendarWeekInfo | null> {
  const clean = labelOrName.trim();
  if (!clean) return null;

  const res = await pool.query(
    `
    SELECT week_name, formatted_name, start_date::text AS start_date, end_date::text AS end_date
    FROM calendar_weeks
    WHERE formatted_name = $1 OR week_name = $1
    ORDER BY start_date DESC
    LIMIT 1
    `,
    [clean]
  );

  if (res.rows.length === 0) return null;
  return mapWeekRow(res.rows[0]);
}

export function computePeriodForWeek(
  week: Pick<CalendarWeekInfo, 'week_end'>,
  todayWib: string,
  daysBack = 30
): { dateFrom: string; dateTo: string } {
  const dateTo = week.week_end < todayWib ? week.week_end : todayWib;
  const endDate = parseIsoDateUtc(dateTo);
  const startDate = addDaysUtc(endDate, -daysBack);
  return {
    dateFrom: formatUtcIsoDate(startDate),
    dateTo,
  };
}

export function isDateWithinWeek(
  isoTimestamp: string | null | undefined,
  weekStart: string | null | undefined,
  weekEnd: string | null | undefined
): boolean {
  if (!isoTimestamp || !weekStart || !weekEnd) return false;
  const wibDate = formatWibDate(isoTimestamp);
  if (wibDate === '-') return false;
  return wibDate >= weekStart && wibDate <= weekEnd;
}

export async function getSelectableCalendarWeeks(
  pool: pg.Pool,
  todayWib: string,
  limit = 24
): Promise<CalendarWeekInfo[]> {
  const res = await pool.query(
    `
    SELECT week_name, formatted_name, start_date::text AS start_date, end_date::text AS end_date
    FROM calendar_weeks
    WHERE start_date <= $1::date
    ORDER BY start_date DESC
    LIMIT $2
    `,
    [todayWib, limit]
  );

  return res.rows.map(mapWeekRow);
}
