import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SupplierPurchaseForm } from "@/components/supplier-purchase-form";
import { SupplierPurchaseReversalForm } from "@/components/supplier-purchase-reversal-form";
import type { BusinessDay } from "@/services/business-days";
import type { Product } from "@/services/products";
import type { InventoryLocationOption } from "@/services/supplier-purchases";

vi.mock("@/app/(protected)/suppliers/actions", () => ({
  createSupplierPurchaseAction: vi.fn(),
  reverseSupplierPurchaseAction: vi.fn(),
}));

afterEach(cleanup);

const supplierId = "30000000-0000-4000-8000-000000000001";
const requestId = "70000000-0000-4000-8000-000000000001";
const openDay: BusinessDay = {
  id: "40000000-0000-4000-8000-000000000001",
  businessId: "20000000-0000-4000-8000-000000000001",
  businessDate: "2026-07-01",
  status: "open",
  openedAt: "2026-07-01T06:00:00Z",
  openedBy: "10000000-0000-4000-8000-000000000001",
  closedAt: null,
  closedBy: null,
  reopenReason: null,
};
const closedDay: BusinessDay = {
  ...openDay,
  id: "40000000-0000-4000-8000-000000000002",
  businessDate: "2026-06-30",
  status: "closed",
};
const locations: readonly InventoryLocationOption[] = [
  {
    id: "50000000-0000-4000-8000-000000000001",
    name: "Warehouse",
    type: "warehouse",
  },
  {
    id: "50000000-0000-4000-8000-000000000002",
    name: "Shop",
    type: "shop",
  },
];
const products: readonly Product[] = [
  {
    id: "51000000-0000-4000-8000-000000000001",
    businessId: openDay.businessId,
    internalCode: "P000001",
    name: "Test product",
    categoryId: "52000000-0000-4000-8000-000000000001",
    categoryName: "General",
    unit: "piece",
    defaultPurchaseCostRon: null,
    defaultPurchaseCostOriginal: null,
    defaultPurchaseCurrency: "RON",
    defaultPurchaseExchangeRate: null,
    defaultSellingPriceRon: null,
    isActive: true,
    createdAt: "2026-07-01T06:00:00Z",
    createdBy: openDay.openedBy,
    updatedAt: "2026-07-01T06:00:00Z",
  },
];

describe("supplier purchase forms", () => {
  it("locks employee entry to the open day and offers both destinations", () => {
    render(
      <SupplierPurchaseForm
        businessDays={[openDay, closedDay]}
        defaultCurrency="RON"
        locations={locations}
        openDay={openDay}
        products={products}
        requestId={requestId}
        role="employee"
        supplierId={supplierId}
      />,
    );

    expect(screen.getByText("2026-07-01")).toBeVisible();
    expect(
      screen.queryByRole("combobox", { name: "Business day" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Inventory destination" }),
    ).toHaveTextContent("Warehouse");
    expect(
      screen.getByRole("combobox", { name: "Inventory destination" }),
    ).toHaveTextContent("Shop");
  });

  it("shows the manual exchange rate for USD", async () => {
    const user = userEvent.setup();
    render(
      <SupplierPurchaseForm
        businessDays={[openDay]}
        defaultCurrency="RON"
        locations={locations}
        openDay={openDay}
        products={products}
        requestId={requestId}
        role="employee"
        supplierId={supplierId}
      />,
    );

    expect(
      screen.queryByRole("textbox", {
        name: "Historical USD/RON exchange rate",
      }),
    ).not.toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Currency" }),
      "USD",
    );
    expect(
      screen.getByRole("textbox", {
        name: "Historical USD/RON exchange rate",
      }),
    ).toBeRequired();
  });

  it("adds another received-product line", async () => {
    const user = userEvent.setup();
    render(
      <SupplierPurchaseForm
        businessDays={[openDay]}
        defaultCurrency="RON"
        locations={locations}
        openDay={openDay}
        products={products}
        requestId={requestId}
        role="employee"
        supplierId={supplierId}
      />,
    );

    expect(screen.getByLabelText("Product 1")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Add product line" }));
    expect(screen.getByLabelText("Product 2")).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: "Receive products and create payable",
      }),
    ).toBeVisible();
  });

  it("lets an administrator select a closed day with an audit reason", () => {
    render(
      <SupplierPurchaseForm
        businessDays={[openDay, closedDay]}
        defaultCurrency="USD"
        locations={locations}
        openDay={openDay}
        products={products}
        requestId={requestId}
        role="admin"
        supplierId={supplierId}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Business day" })).toHaveValue(
      openDay.id,
    );
    expect(
      screen.getByRole("textbox", { name: "Historical audit reason" }),
    ).toBeVisible();
  });

  it("requires explicit confirmation for reversal", () => {
    render(
      <SupplierPurchaseReversalForm
        purchaseId="60000000-0000-4000-8000-000000000001"
        supplierId={supplierId}
      />,
    );

    expect(
      screen.getByRole("checkbox", {
        name: /payable, inventory value, and every product receipt/i,
      }),
    ).toBeRequired();
    expect(
      screen.getByRole("button", { name: "Reverse supplier purchase" }),
    ).toBeVisible();
    expect(
      screen.getByRole("checkbox", {
        name: /allow negative product stock/i,
      }),
    ).toBeVisible();
  });
});
