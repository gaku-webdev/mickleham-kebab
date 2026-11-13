const MELBOURNE_TIME_ZONE = "Australia/Melbourne";
const AUSTRALIAN_LOCALE = "en-AU";

type MelbourneDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function getNumericParts(
  date: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions
): Record<string, number> {
  return Object.fromEntries(
    new Intl.DateTimeFormat(AUSTRALIAN_LOCALE, {
      ...options,
      timeZone,
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );
}

export function getMelbourneDateParts(date = new Date()): MelbourneDateParts {
  const parts = getNumericParts(date, MELBOURNE_TIME_ZONE, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
  };
}

export function toDateInputValue({
  year,
  month,
  day,
}: Pick<MelbourneDateParts, "year" | "month" | "day">): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatDateOnly(
  value: string,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  }
): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(AUSTRALIAN_LOCALE, {
    ...options,
    timeZone: "UTC",
  }).format(date);
}

export function formatMelbourneDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat(AUSTRALIAN_LOCALE, {
    timeZone: MELBOURNE_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatMelbourneDateTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat(AUSTRALIAN_LOCALE, {
    timeZone: MELBOURNE_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(date);
}

export function formatClockTime(value: string): string {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return value;

  const [, hour, minute, second = "0"] = match;
  const date = new Date(
    Date.UTC(2020, 0, 1, Number(hour), Number(minute), Number(second))
  );
  if (
    Number(hour) > 23 ||
    Number(minute) > 59 ||
    Number(second) > 59
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(AUSTRALIAN_LOCALE, {
    timeZone: "UTC",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function toMelbourneDateTimeInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = getNumericParts(date, MELBOURNE_TIME_ZONE, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  return `${toDateInputValue({
    year: parts.year,
    month: parts.month,
    day: parts.day,
  })}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

export function melbourneDateTimeInputToISOString(value: string): string | null {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const [, year, month, day, hour, minute] = match.map(Number);
  const targetWallTime = Date.UTC(year, month - 1, day, hour, minute);
  const checkDate = new Date(targetWallTime);
  if (
    checkDate.getUTCFullYear() !== year ||
    checkDate.getUTCMonth() !== month - 1 ||
    checkDate.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59
  ) {
    return null;
  }

  let timestamp = targetWallTime;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = getNumericParts(new Date(timestamp), MELBOURNE_TIME_ZONE, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const representedWallTime = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute
    );
    const difference = targetWallTime - representedWallTime;
    if (difference === 0) return new Date(timestamp).toISOString();
    timestamp += difference;
  }

  return null;
}
