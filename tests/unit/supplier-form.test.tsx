import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SupplierDeactivationForm } from "@/components/supplier-deactivation-form";
import { SupplierForm } from "@/components/supplier-form";
import type { Supplier } from "@/services/suppliers";

vi.mock("@/app/(protected)/suppliers/actions", () => ({
  createSupplierAction: vi.fn(),
  updateSupplierAction: vi.fn(),
  deactivateSupplierAction: vi.fn(),
}));

afterEach(cleanup);

const supplier: Supplier = {
  id: "30000000-0000-4000-8000-000000000001",
  businessId: "20000000-0000-4000-8000-000000000001",
  name: "Supply Company",
  phone: "+40 712 345 678",
  notes: "Main contact.",
  defaultCurrency: "USD",
  isActive: true,
  createdAt: "2026-07-01T06:00:00Z",
  createdBy: "10000000-0000-4000-8000-000000000001",
  updatedAt: "2026-07-01T06:00:00Z",
};

describe("supplier forms", () => {
  it("renders the member create form", () => {
    render(<SupplierForm />);

    expect(screen.getByRole("textbox", { name: "Name" })).toBeRequired();
    expect(
      screen.getByRole("combobox", { name: "Default currency" }),
    ).toHaveValue("");
    expect(screen.getByRole("button", { name: "Add supplier" })).toBeVisible();
  });

  it("renders existing contact values for editing", () => {
    render(<SupplierForm supplier={supplier} />);

    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue(
      "Supply Company",
    );
    expect(
      screen.getByRole("combobox", { name: "Default currency" }),
    ).toHaveValue("USD");
    expect(screen.getByRole("button", { name: "Save supplier" })).toBeVisible();
  });

  it("requires explicit administrator deactivation confirmation", () => {
    render(<SupplierDeactivationForm supplierId={supplier.id} />);

    expect(
      screen.getByRole("checkbox", {
        name: /deactivates the supplier without deleting history/i,
      }),
    ).toBeRequired();
    expect(
      screen.getByRole("button", { name: "Deactivate supplier" }),
    ).toBeVisible();
  });
});
