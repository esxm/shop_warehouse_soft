import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { OpeningBalanceWizard } from "@/components/opening-balance-wizard";

vi.mock("@/app/(protected)/(admin)/opening-balances/actions", () => ({
  submitOpeningBalances: vi.fn(),
}));

describe("OpeningBalanceWizard", () => {
  it("walks through optional customer and USD supplier setup", async () => {
    const user = userEvent.setup();
    render(<OpeningBalanceWizard defaultOpeningDate="2026-06-30" />);

    expect(
      screen.getByRole("group", {
        name: "Opening date and core values",
      }),
    ).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "Continue to customers" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Add customer receivable" }),
    );
    await user.type(
      screen.getByRole("textbox", { name: "Customer 1 name" }),
      "Customer One",
    );
    await user.type(
      screen.getByRole("textbox", { name: "Amount (RON)" }),
      "500",
    );

    await user.click(
      screen.getByRole("button", { name: "Continue to suppliers" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Add supplier payable" }),
    );
    await user.type(
      screen.getByRole("textbox", { name: "Supplier 1 name" }),
      "Supplier One",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Currency" }),
      "USD",
    );
    await user.type(
      screen.getByRole("textbox", { name: "Original amount (USD)" }),
      "1000",
    );
    await user.type(
      screen.getByRole("textbox", {
        name: "Historical USD/RON rate",
      }),
      "4.6",
    );

    await user.click(screen.getByRole("button", { name: "Review setup" }));

    expect(
      screen.getByRole("button", { name: "Create opening balances" }),
    ).toBeVisible();
    expect(screen.getAllByText("1")).toHaveLength(2);
  });
});
