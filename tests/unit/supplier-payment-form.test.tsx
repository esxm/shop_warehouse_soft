import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SupplierPaymentForm,
  type OutstandingSupplierPurchaseOption,
} from "@/components/supplier-payment-form";
import { SupplierPaymentReversalForm } from "@/components/supplier-payment-reversal-form";
import type { BusinessDay } from "@/services/business-days";
import type { SupplierFinancialAccountOption } from "@/services/supplier-payments";

vi.mock("@/app/(protected)/suppliers/actions", () => ({
  createSupplierPaymentAction: vi.fn(),
  reverseSupplierPaymentAction: vi.fn(),
}));

afterEach(cleanup);

const supplierId = "30000000-0000-4000-8000-000000000001";
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
const accounts: readonly SupplierFinancialAccountOption[] = [
  {
    id: "50000000-0000-4000-8000-000000000001",
    name: "Cash",
    type: "cash",
  },
];
const purchases: readonly OutstandingSupplierPurchaseOption[] = [
  {
    id: "60000000-0000-4000-8000-000000000001",
    purchaseDate: "2026-06-20",
    currency: "USD",
    remainingOriginalAmount: "100.00",
    purchaseExchangeRate: "4.60",
    description: "USD stock",
  },
  {
    id: "60000000-0000-4000-8000-000000000002",
    purchaseDate: "2026-06-21",
    currency: "RON",
    remainingOriginalAmount: "200.00",
    purchaseExchangeRate: null,
    description: "RON stock",
  },
];

const commonProps = {
  supplierId,
  defaultCurrency: "USD" as const,
  requestId: "70000000-0000-4000-8000-000000000001",
  openDay,
  businessDays: [openDay, closedDay],
  accounts,
  outstandingPurchases: purchases,
};

describe("supplier payment forms", () => {
  it("locks employee entry to the open day and requests the USD payment rate", () => {
    render(<SupplierPaymentForm {...commonProps} role="employee" />);

    expect(screen.getByText("2026-07-01")).toBeVisible();
    expect(
      screen.queryByRole("combobox", { name: "Business day" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("textbox", {
        name: "Payment-day USD/RON exchange rate",
      }),
    ).toBeRequired();
    expect(
      screen.getByRole("radio", { name: "Allocate payment manually" }),
    ).toBeVisible();
  });

  it("switches to RON without showing an exchange rate", async () => {
    const user = userEvent.setup();
    render(<SupplierPaymentForm {...commonProps} role="employee" />);

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Payment currency" }),
      "RON",
    );

    expect(
      screen.queryByRole("textbox", {
        name: "Payment-day USD/RON exchange rate",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Amount paid (RON)" }),
    ).toBeRequired();
  });

  it("allows employees to manually allocate matching-currency purchases", async () => {
    const user = userEvent.setup();
    render(<SupplierPaymentForm {...commonProps} role="employee" />);

    await user.click(
      screen.getByRole("radio", { name: "Allocate payment manually" }),
    );

    expect(
      screen.getByRole("textbox", {
        name: "Allocate to supplier purchase from 2026-06-20",
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("textbox", {
        name: "Allocate to supplier purchase from 2026-06-21",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Historical audit reason" }),
    ).not.toBeInTheDocument();
  });

  it("shows an empty state when there are no outstanding purchases", () => {
    render(
      <SupplierPaymentForm
        {...commonProps}
        outstandingPurchases={[]}
        role="employee"
      />,
    );

    expect(screen.getByText(/no outstanding purchases to pay/i)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Record supplier payment" }),
    ).not.toBeInTheDocument();
  });

  it("requires explicit confirmation for payment reversal", () => {
    render(
      <SupplierPaymentReversalForm
        paymentId="80000000-0000-4000-8000-000000000001"
        supplierId={supplierId}
      />,
    );

    expect(
      screen.getByRole("checkbox", {
        name: /restore the payable and account balance/i,
      }),
    ).toBeRequired();
    expect(
      screen.getByRole("button", { name: "Reverse supplier payment" }),
    ).toBeVisible();
  });
});
