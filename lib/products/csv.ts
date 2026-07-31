import {
  productCsvRowSchema,
  type ResolvedProductImportRow,
} from "@/lib/validation/products";

export type ProductImportCategory = Readonly<{
  id: string;
  name: string;
}>;

export type ProductCsvPreviewRow = Readonly<{
  rowNumber: number;
  internalCode: string | null;
  name: string;
  category: string;
  defaultPurchaseCostRon: string | null;
  defaultSellingPriceRon: string | null;
  resolved: ResolvedProductImportRow | null;
  errors: readonly string[];
}>;

export type ProductCsvPreview = Readonly<{
  rows: readonly ProductCsvPreviewRow[];
  errors: readonly string[];
}>;

const expectedHeaders = [
  "internal_code",
  "name",
  "category",
  "default_purchase_cost_ron",
  "default_selling_price_ron",
] as const;

function parseCsvRecords(input: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field === "") {
      quoted = true;
    } else if (character === ",") {
      record.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && input[index + 1] === "\n") {
        index += 1;
      }
      record.push(field);
      field = "";

      if (record.some((value) => value.trim() !== "")) {
        records.push(record);
      }
      record = [];
    } else {
      field += character;
    }
  }

  if (quoted) {
    throw new Error("CSV contains an unterminated quoted field.");
  }

  record.push(field);
  if (record.some((value) => value.trim() !== "")) {
    records.push(record);
  }

  return records;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replaceAll(" ", "_");
}

export function createProductCsvTemplate(): string {
  return [
    expectedHeaders.join(","),
    ",Bathroom set,Bathroom sets,100.00,140.00",
  ].join("\r\n");
}

export function buildProductCsvPreview(
  csv: string,
  categories: readonly ProductImportCategory[],
): ProductCsvPreview {
  if (csv.length > 1_000_000) {
    return { rows: [], errors: ["CSV file must not exceed 1 MB."] };
  }

  let records: string[][];

  try {
    records = parseCsvRecords(csv.replace(/^\uFEFF/, ""));
  } catch (error) {
    return {
      rows: [],
      errors: [
        error instanceof Error ? error.message : "CSV could not be parsed.",
      ],
    };
  }

  if (records.length === 0) {
    return { rows: [], errors: ["CSV file is empty."] };
  }

  const headers = records[0].map(normalizeHeader);
  const headerErrors = [
    ...expectedHeaders.filter((header) => !headers.includes(header)),
    ...headers.filter(
      (header, index) =>
        !expectedHeaders.includes(header as (typeof expectedHeaders)[number]) ||
        headers.indexOf(header) !== index,
    ),
  ];

  if (headerErrors.length > 0 || headers.length !== expectedHeaders.length) {
    return {
      rows: [],
      errors: [`Use exactly these headers: ${expectedHeaders.join(", ")}.`],
    };
  }

  if (records.length - 1 > 500) {
    return {
      rows: [],
      errors: ["CSV import supports at most 500 product rows."],
    };
  }

  const categoryByName = new Map(
    categories.map((category) => [
      category.name.trim().toLocaleLowerCase(),
      category,
    ]),
  );
  const headerIndex = new Map(headers.map((header, index) => [header, index]));
  const rows = records.slice(1).map((record, rowIndex) => {
    const value = (header: (typeof expectedHeaders)[number]) =>
      record[headerIndex.get(header) ?? -1] ?? "";
    const parsed = productCsvRowSchema.safeParse({
      internalCode: value("internal_code"),
      name: value("name"),
      category: value("category"),
      defaultPurchaseCostRon: value("default_purchase_cost_ron"),
      defaultSellingPriceRon: value("default_selling_price_ron"),
    });

    if (!parsed.success) {
      return {
        rowNumber: rowIndex + 2,
        internalCode: value("internal_code") || null,
        name: value("name"),
        category: value("category"),
        defaultPurchaseCostRon: value("default_purchase_cost_ron") || null,
        defaultSellingPriceRon: value("default_selling_price_ron") || null,
        resolved: null,
        errors: parsed.error.issues.map((issue) => issue.message),
      };
    }

    const category = categoryByName.get(
      parsed.data.category.toLocaleLowerCase(),
    );

    if (!category) {
      return {
        rowNumber: rowIndex + 2,
        ...parsed.data,
        resolved: null,
        errors: [`Category "${parsed.data.category}" does not exist.`],
      };
    }

    return {
      rowNumber: rowIndex + 2,
      ...parsed.data,
      resolved: {
        internal_code: parsed.data.internalCode ?? "",
        name: parsed.data.name,
        category_id: category.id,
        default_purchase_cost_ron: parsed.data.defaultPurchaseCostRon ?? "",
        default_selling_price_ron: parsed.data.defaultSellingPriceRon ?? "",
      },
      errors: [],
    };
  });

  if (rows.length === 0) {
    return { rows: [], errors: ["CSV contains no product rows."] };
  }

  const seenCodes = new Set<string>();
  const duplicateCodes = new Set<string>();

  for (const row of rows) {
    if (!row.internalCode) {
      continue;
    }

    if (seenCodes.has(row.internalCode)) {
      duplicateCodes.add(row.internalCode);
    }
    seenCodes.add(row.internalCode);
  }

  return {
    rows: rows.map((row) =>
      row.internalCode && duplicateCodes.has(row.internalCode)
        ? {
            ...row,
            resolved: null,
            errors: [
              ...row.errors,
              `Internal code "${row.internalCode}" is duplicated in the CSV.`,
            ],
          }
        : row,
    ),
    errors: [],
  };
}
