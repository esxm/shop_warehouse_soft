const BUSINESS_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const EXPLICIT_OFFSET_PATTERN = /(Z|[+-]\d{2}:\d{2})$/i;

declare const businessDateBrand: unique symbol;

export type BusinessDate = string & {
  readonly [businessDateBrand]: "BusinessDate";
};

export class BusinessDateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessDateError";
  }
}

export function requireValidTimeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return timeZone;
  } catch {
    throw new BusinessDateError("Unknown business timezone.");
  }
}

function parseInstant(input: Date | string): Date {
  if (typeof input === "string" && !EXPLICIT_OFFSET_PATTERN.test(input)) {
    throw new BusinessDateError(
      "Timestamp strings must include UTC or an explicit offset.",
    );
  }

  const instant =
    input instanceof Date ? new Date(input.getTime()) : new Date(input);

  if (Number.isNaN(instant.getTime())) {
    throw new BusinessDateError("Invalid timestamp.");
  }

  return instant;
}

export function parseBusinessDate(input: unknown): BusinessDate {
  if (typeof input !== "string") {
    throw new BusinessDateError("Business date must be entered as text.");
  }

  const match = BUSINESS_DATE_PATTERN.exec(input);

  if (!match) {
    throw new BusinessDateError("Business date must use YYYY-MM-DD.");
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const check = new Date(Date.UTC(year, month - 1, day));

  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new BusinessDateError("Business date is not a real calendar date.");
  }

  return input as BusinessDate;
}

export function getBusinessDate(
  input: Date | string,
  timeZone: string,
): BusinessDate {
  const instant = parseInstant(input);
  requireValidTimeZone(timeZone);

  const parts = new Intl.DateTimeFormat("en-US-u-ca-iso8601-nu-latn", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return parseBusinessDate(`${values.year}-${values.month}-${values.day}`);
}

export function getTodayInBusinessTimeZone(
  timeZone: string,
  clock: () => Date = () => new Date(),
): BusinessDate {
  return getBusinessDate(clock(), timeZone);
}

export function formatInstantInBusinessTimeZone(
  input: Date | string,
  timeZone: string,
  locale = "en-GB",
): string {
  const instant = parseInstant(input);
  requireValidTimeZone(timeZone);

  return new Intl.DateTimeFormat(locale, {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(instant);
}

export function compareBusinessDates(
  left: BusinessDate,
  right: BusinessDate,
): -1 | 0 | 1 {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
}

export function isSameBusinessDate(
  left: Date | string,
  right: Date | string,
  timeZone: string,
): boolean {
  return getBusinessDate(left, timeZone) === getBusinessDate(right, timeZone);
}
