import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CustomerPaymentForm } from "@/components/customer-payment-form";
import { CustomerPaymentReversalForm } from "@/components/customer-payment-reversal-form";
import type { BusinessDay } from "@/services/business-days";
import type { FinancialAccountOption } from "@/services/customer-payments";

vi.mock("@/app/(protected)/customers/actions", () => ({
  createCustomerPaymentAction: vi.fn(),
  reverseCustomerPaymentAction: vi.fn(),
}));

afterEach(cleanup);

const customerId = "30000000-0000-4000-8000-000000000001";
const requestId = "80000000-0000-4000-8000-000000000001";
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
const accounts: readonly FinancialAccountOption[] = [
  {
    id: "50000000-0000-4000-8000-000000000001",
    name: "Cash register",
    type: "cash",
  },
  {
    id: "50000000-0000-4000-8000-000000000002",
    name: "Bank account",
    type: "bank",
  },
];
const purchases = [
  {
    id: "60000000-0000-4000-8000-000000000001",
    purchaseDate: "2026-06-01",
    remainingRon: "500.00",
    description: "First purchase",
  },
  {
    id: "60000000-0000-4000-8000-000000000002",
    purchaseDate: "2026-06-02",
    remainingRon: "300.00",
    description: null,
  },
];

describe("customer payment forms", () => {
  it("lets an employee choose manual allocation on the current day", () => {
    const { container } = render(
      <CustomerPaymentForm
        accounts={accounts}
        businessDays={[openDay]}
        customerId={customerId}
        openDay={openDay}
        outstandingPurchases={purchases}
        requestId={requestId}
        role="employee"
      />,
    );

    expect(screen.getByText("2026-07-01")).toBeVisible();
    expect(
      screen.getByRole("group", { name: "Allocation method" }),
    ).toBeVisible();
    expect(
      screen.getByRole("radio", { name: "Allocate payment manually" }),
    ).toBeVisible();
    expect(
      screen.getByRole("combobox", { name: "Destination account" }),
    ).toHaveValue(accounts[0]?.id);
    expect(
      container.querySelector(`input[value="${requestId}"]`),
    ).toBeInTheDocument();
  });

  it("lets an administrator enter manual purchase allocations", async () => {
    const user = userEvent.setup();
    render(
      <CustomerPaymentForm
        accounts={accounts}
        businessDays={[openDay]}
        customerId={customerId}
        openDay={openDay}
        outstandingPurchases={purchases}
        requestId={requestId}
        role="admin"
      />,
    );

    await user.click(
      screen.getByRole("radio", {
        name: "Allocate payment manually",
      }),
    );

    expect(
      screen.getByRole("textbox", {
        name: "Allocate to purchase from 2026-06-01",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("textbox", {
        name: "Historical audit reason",
      }),
    ).toBeVisible();
  });

  it("shows an empty state when no receivable remains", () => {
    render(
      <CustomerPaymentForm
        accounts={accounts}
        businessDays={[openDay]}
        customerId={customerId}
        openDay={openDay}
        outstandingPurchases={[]}
        requestId={requestId}
        role="employee"
      />,
    );

    expect(screen.getByText(/no outstanding purchases/i)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Record customer payment" }),
    ).not.toBeInTheDocument();
  });

  it("requires explicit payment reversal confirmation", () => {
    render(
      <CustomerPaymentReversalForm
        customerId={customerId}
        paymentId="70000000-0000-4000-8000-000000000001"
      />,
    );

    expect(
      screen.getByRole("checkbox", {
        name: /Reverse the allocations and account inflow/i,
      }),
    ).toBeRequired();
    expect(
      screen.getByRole("button", { name: "Reverse payment" }),
    ).toBeVisible();
  });
});
