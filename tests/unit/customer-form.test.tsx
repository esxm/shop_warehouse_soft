import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CustomerDeactivationForm } from "@/components/customer-deactivation-form";
import { CustomerForm } from "@/components/customer-form";
import type { Customer } from "@/services/customers";

vi.mock("@/app/(protected)/customers/actions", () => ({
  createCustomerAction: vi.fn(),
  updateCustomerAction: vi.fn(),
  deactivateCustomerAction: vi.fn(),
}));

afterEach(cleanup);

const customer: Customer = {
  id: "30000000-0000-4000-8000-000000000001",
  businessId: "20000000-0000-4000-8000-000000000001",
  name: "Ahmed Popescu",
  phone: "+40 712 345 678",
  notes: "Calls in the afternoon.",
  isActive: true,
  createdAt: "2026-07-01T06:00:00Z",
  createdBy: "10000000-0000-4000-8000-000000000001",
  updatedAt: "2026-07-01T06:00:00Z",
};

describe("customer forms", () => {
  it("renders the member create form", () => {
    render(<CustomerForm />);

    expect(screen.getByRole("textbox", { name: "Name" })).toBeRequired();
    expect(screen.getByRole("textbox", { name: "Phone" })).toHaveAttribute(
      "type",
      "tel",
    );
    expect(screen.getByRole("button", { name: "Add customer" })).toBeVisible();
  });

  it("renders existing values for metadata editing", () => {
    render(<CustomerForm customer={customer} />);

    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue(
      "Ahmed Popescu",
    );
    expect(screen.getByRole("textbox", { name: "Phone" })).toHaveValue(
      "+40 712 345 678",
    );
    expect(screen.getByRole("button", { name: "Save customer" })).toBeVisible();
  });

  it("requires explicit administrator deactivation confirmation", () => {
    render(<CustomerDeactivationForm customerId={customer.id} />);

    expect(
      screen.getByRole("checkbox", {
        name: /I understand this deactivates the customer/i,
      }),
    ).toBeRequired();
    expect(
      screen.getByRole("button", { name: "Deactivate customer" }),
    ).toBeVisible();
  });
});
