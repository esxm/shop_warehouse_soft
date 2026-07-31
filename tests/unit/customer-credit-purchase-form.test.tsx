import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CustomerCreditPurchaseForm } from "@/components/customer-credit-purchase-form";
import { CustomerCreditPurchaseReversalForm } from "@/components/customer-credit-purchase-reversal-form";
import type { BusinessDay } from "@/services/business-days";
import type { ProductSaleOption } from "@/services/product-sales";

vi.mock("@/app/(protected)/customers/actions", () => ({
  createCustomerCreditPurchaseAction: vi.fn(),
  reverseCustomerCreditPurchaseAction: vi.fn(),
}));

afterEach(cleanup);

const customerId = "30000000-0000-4000-8000-000000000001";
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
  closedAt: "2026-06-30T18:00:00Z",
  closedBy: "10000000-0000-4000-8000-000000000001",
};
const products: readonly ProductSaleOption[] = [
  {
    id: "51000000-0000-4000-8000-000000000001",
    internalCode: "SKU-1",
    name: "Test product",
    shopLocationId: "52000000-0000-4000-8000-000000000001",
    shopLocationName: "Shop",
    shopQuantity: "10",
    averageUnitCostRon: "5.00",
  },
];

describe("customer credit-purchase forms", () => {
  it("locks employee entry to the current open day", () => {
    render(
      <CustomerCreditPurchaseForm
        businessDays={[openDay, closedDay]}
        customerId={customerId}
        openDay={openDay}
        products={products}
        requestId={requestId}
        role="employee"
      />,
    );

    expect(screen.getByText("2026-07-01")).toBeVisible();
    expect(
      screen.queryByRole("combobox", { name: "Business day" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("spinbutton", { name: "Price (RON)" }),
    ).toBeRequired();
  });

  it("shows no write form when an employee has no open day", () => {
    render(
      <CustomerCreditPurchaseForm
        businessDays={[closedDay]}
        customerId={customerId}
        openDay={null}
        products={products}
        requestId={requestId}
        role="employee"
      />,
    );

    expect(
      screen.getByText(/automatic current business day is unavailable/i),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Record product credit purchase" }),
    ).not.toBeInTheDocument();
  });

  it("lets an administrator select a business day", () => {
    render(
      <CustomerCreditPurchaseForm
        businessDays={[openDay, closedDay]}
        customerId={customerId}
        openDay={openDay}
        products={products}
        requestId={requestId}
        role="admin"
      />,
    );

    expect(screen.getByRole("combobox", { name: "Business day" })).toHaveValue(
      openDay.id,
    );
    expect(
      screen.getByRole("combobox", { name: "Selling currency" }),
    ).toBeVisible();
  });

  it("requires explicit confirmation to reverse a purchase", () => {
    render(
      <CustomerCreditPurchaseReversalForm
        customerId={customerId}
        purchaseId="50000000-0000-4000-8000-000000000001"
      />,
    );

    expect(
      screen.getByRole("checkbox", {
        name: /original purchase remains visible as reversed/i,
      }),
    ).toBeRequired();
    expect(
      screen.getByRole("button", { name: "Reverse purchase" }),
    ).toBeVisible();
  });
});
