const SAFE_NEGATIVE_NUMBER = /^-\d+(?:\.\d+)?$/;
const SPREADSHEET_FORMULA_PREFIX = /^[=+@\t\r\n]/;

export function protectSpreadsheetCell(value: string): string {
  if (
    SPREADSHEET_FORMULA_PREFIX.test(value) ||
    (value.startsWith("-") && !SAFE_NEGATIVE_NUMBER.test(value))
  ) {
    return `'${value}`;
  }

  return value;
}

export function csvRow(values: readonly string[]): string {
  return values
    .map((value) => {
      const protectedValue = protectSpreadsheetCell(value);
      return `"${protectedValue.replaceAll('"', '""')}"`;
    })
    .join(",");
}
