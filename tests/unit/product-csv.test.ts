import { describe, expect, it } from "vitest";

import {
  buildProductCsvPreview,
  createProductCsvTemplate,
} from "@/lib/products/csv";

const categories = [
  {
    id: "31000000-0000-4000-8000-000000000011",
    name: "Bathroom sets",
  },
  {
    id: "31000000-0000-4000-8000-000000000012",
    name: "Mats",
  },
];

describe("product CSV import preview", () => {
  it("provides the required import headers", () => {
    expect(createProductCsvTemplate().split("\r\n")[0]).toBe(
      "internal_code,name,category,default_purchase_cost_ron,default_selling_price_ron",
    );
  });

  it("parses quoted fields, normalizes values, and resolves categories", () => {
    const preview = buildProductCsvPreview(
      [
        "internal_code,name,category,default_purchase_cost_ron,default_selling_price_ron",
        '"bath-001","Bathroom set, blue",Bathroom sets,"100,50",140',
        ",Bath mat,Mats,,25.00",
      ].join("\r\n"),
      categories,
    );

    expect(preview.errors).toEqual([]);
    expect(preview.rows).toHaveLength(2);
    expect(preview.rows[0]).toMatchObject({
      rowNumber: 2,
      internalCode: "BATH-001",
      name: "Bathroom set, blue",
      errors: [],
      resolved: {
        internal_code: "BATH-001",
        category_id: categories[0].id,
        default_purchase_cost_ron: "100.50",
      },
    });
    expect(preview.rows[1].resolved?.internal_code).toBe("");
  });

  it("reports missing categories and duplicate codes before submission", () => {
    const preview = buildProductCsvPreview(
      [
        "internal_code,name,category,default_purchase_cost_ron,default_selling_price_ron",
        "SAME,First,Mats,,",
        "same,Second,Mats,,",
        "OTHER,Third,Unknown,,",
      ].join("\n"),
      categories,
    );

    expect(preview.rows[0].errors[0]).toContain("duplicated");
    expect(preview.rows[1].errors[0]).toContain("duplicated");
    expect(preview.rows[2].errors[0]).toContain("does not exist");
    expect(preview.rows.every((row) => row.resolved === null)).toBe(true);
  });

  it("rejects malformed or unexpected CSV headers", () => {
    expect(
      buildProductCsvPreview("name,category\nBath mat,Mats", categories)
        .errors[0],
    ).toContain("Use exactly these headers");
    expect(
      buildProductCsvPreview(
        'internal_code,name,category,default_purchase_cost_ron,default_selling_price_ron\n,"unterminated',
        categories,
      ).errors[0],
    ).toContain("unterminated");
  });
});
