import {
  getTodayInBusinessTimeZone,
  parseBusinessDate,
  type BusinessDate,
} from "@/lib/date/business-date";

export type HistoryDateSelection = Readonly<{
  date: BusinessDate;
  error: string | null;
}>;

export type HistoryPeriodSelection = Readonly<{
  fromDate: BusinessDate;
  toDate: BusinessDate;
  error: string | null;
}>;

export type OptionalHistoryPeriodSelection = Readonly<{
  fromDate: BusinessDate | null;
  toDate: BusinessDate | null;
  error: string | null;
}>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function resolveHistoryDate(
  query: Readonly<Record<string, string | string[] | undefined>>,
  timeZone: string,
): HistoryDateSelection {
  const today = getTodayInBusinessTimeZone(timeZone);
  const requested = firstValue(query.history_date);

  if (!requested) {
    return { date: today, error: null };
  }

  try {
    return { date: parseBusinessDate(requested), error: null };
  } catch (error) {
    return {
      date: today,
      error:
        error instanceof Error ? error.message : "Select a valid history date.",
    };
  }
}

export function resolveHistoryPeriod(
  query: Readonly<Record<string, string | string[] | undefined>>,
  timeZone: string,
): HistoryPeriodSelection {
  const today = getTodayInBusinessTimeZone(timeZone);
  const requestedFrom = firstValue(query.history_from);
  const requestedTo = firstValue(query.history_to);

  try {
    const fromDate = requestedFrom ? parseBusinessDate(requestedFrom) : today;
    const toDate = requestedTo ? parseBusinessDate(requestedTo) : today;

    if (fromDate > toDate) {
      throw new Error("History start date must be on or before the end date.");
    }

    return { fromDate, toDate, error: null };
  } catch (error) {
    return {
      fromDate: today,
      toDate: today,
      error:
        error instanceof Error
          ? error.message
          : "Select a valid history period.",
    };
  }
}

export function resolveOptionalHistoryPeriod(
  query: Readonly<Record<string, string | string[] | undefined>>,
): OptionalHistoryPeriodSelection {
  const requestedFrom = firstValue(query.history_from);
  const requestedTo = firstValue(query.history_to);

  try {
    const fromDate = requestedFrom ? parseBusinessDate(requestedFrom) : null;
    const toDate = requestedTo ? parseBusinessDate(requestedTo) : null;

    if (fromDate && toDate && fromDate > toDate) {
      throw new Error("History start date must be on or before the end date.");
    }

    return { fromDate, toDate, error: null };
  } catch (error) {
    return {
      fromDate: null,
      toDate: null,
      error:
        error instanceof Error
          ? error.message
          : "Select a valid history period.",
    };
  }
}
