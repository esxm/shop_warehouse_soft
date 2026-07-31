import { z } from "zod";

import { parseBusinessDate, type BusinessDate } from "@/lib/date/business-date";
import type { Json } from "@/lib/db/database.types";

export type AuditLogFilter = Readonly<{
  userId: string | null;
  action: string | null;
  entityType: string | null;
  fromDate: BusinessDate | null;
  toDate: BusinessDate | null;
}>;

const optionalTextFilter = z
  .string()
  .trim()
  .max(100, "Filter value must not exceed 100 characters.")
  .default("")
  .transform((value) => value || null);

const optionalDateFilter = z
  .string()
  .trim()
  .default("")
  .transform((value, context) => {
    if (!value) {
      return null;
    }

    try {
      return parseBusinessDate(value);
    } catch (error) {
      context.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "Enter a valid date.",
      });
      return z.NEVER;
    }
  });

export const auditLogFilterSchema = z
  .object({
    userId: z
      .union([z.literal(""), z.uuid("User is invalid.")])
      .default("")
      .transform((value) => value || null),
    action: optionalTextFilter,
    entityType: optionalTextFilter,
    fromDate: optionalDateFilter,
    toDate: optionalDateFilter,
  })
  .superRefine((filter, context) => {
    if (
      filter.fromDate !== null &&
      filter.toDate !== null &&
      filter.fromDate > filter.toDate
    ) {
      context.addIssue({
        code: "custom",
        message: "From date must be on or before to date.",
        path: ["toDate"],
      });
    }
  });

const sensitiveKeyPattern =
  /password|secret|token|authorization|cookie|encrypted/i;
const maximumDepth = 8;
const maximumArrayItems = 100;
const maximumStringLength = 1000;

function sanitizeAuditValue(value: Json, depth: number): Json {
  if (depth >= maximumDepth && typeof value === "object" && value !== null) {
    return "[Nested data omitted]";
  }

  if (typeof value === "string") {
    return value.length > maximumStringLength
      ? `${value.slice(0, maximumStringLength)}…`
      : value;
  }

  if (Array.isArray(value)) {
    const items = value
      .slice(0, maximumArrayItems)
      .map((item) => sanitizeAuditValue(item, depth + 1));

    if (value.length > maximumArrayItems) {
      items.push(`[${value.length - maximumArrayItems} items omitted]`);
    }

    return items;
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [
          key,
          sensitiveKeyPattern.test(key)
            ? "[REDACTED]"
            : sanitizeAuditValue(nestedValue ?? null, depth + 1),
        ]),
    );
  }

  return value;
}

export function formatAuditData(value: Json | null): string {
  if (value === null) {
    return "No data recorded.";
  }

  return JSON.stringify(sanitizeAuditValue(value, 0), null, 2);
}
