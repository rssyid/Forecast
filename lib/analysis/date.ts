const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

// Portal strings without an explicit offset represent Asia/Jakarta (UTC+7) wall-clock time.
export function parsePortalDateWib(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    const ms = Math.abs(value) < 1e11 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  const aspNetMatch = trimmed.match(/\/Date\((-?\d+)(?:[+-]\d{4})?\)\//i);
  if (aspNetMatch) {
    const d = new Date(Number(aspNetMatch[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (/^-?\d{10,13}$/.test(trimmed)) {
    const num = Number(trimmed);
    const ms = trimmed.replace('-', '').length <= 10 ? num * 1000 : num;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (/([zZ]|[+-]\d{2}:?\d{2})$/.test(trimmed)) {
    const normalized = trimmed.includes(' ') && !trimmed.includes('T')
      ? trimmed.replace(' ', 'T')
      : trimmed;
    const d = new Date(normalized);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const dtSecMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2}(?:\.\d+)?)$/);
  if (dtSecMatch) {
    const d = new Date(`${dtSecMatch[1]}T${dtSecMatch[2]}+07:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const dtMinMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})$/);
  if (dtMinMatch) {
    const d = new Date(`${dtMinMatch[1]}T${dtMinMatch[2]}:00+07:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const dateOnlyMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (dateOnlyMatch) {
    const d = new Date(`${dateOnlyMatch[1]}T00:00:00+07:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const fallback = new Date(trimmed);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function toWibClockParts(input: Date | string | null | undefined) {
  if (!input) return null;
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  const shifted = new Date(date.getTime() + WIB_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: pad2(shifted.getUTCMonth() + 1),
    day: pad2(shifted.getUTCDate()),
    hour: pad2(shifted.getUTCHours()),
    minute: pad2(shifted.getUTCMinutes()),
  };
}

export function formatWibDate(input: Date | string | null | undefined): string {
  const parts = toWibClockParts(input);
  if (!parts) return '-';
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function formatWibDateTime(input: Date | string | null | undefined): string {
  const parts = toWibClockParts(input);
  if (!parts) return '-';
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

export function formatWibDateTimeId(input: Date | string | null | undefined): string {
  const parts = toWibClockParts(input);
  if (!parts) return '-';
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}

export function getWibDateRange(
  daysBack = 30,
  now: Date = new Date()
): { dateFrom: string; dateTo: string } {
  const endMs = now.getTime();
  const startMs = endMs - daysBack * 24 * 60 * 60 * 1000;
  return {
    dateFrom: formatWibDate(new Date(startMs)),
    dateTo: formatWibDate(new Date(endMs)),
  };
}
