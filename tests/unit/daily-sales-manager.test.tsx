import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DailySalesManager } from "@/components/daily-sales-manager";
import type { BusinessDay } from "@/services/business-days";
import type { DailySales } from "@/services/daily-sales";

vi.mock("@/app/(protected)/daily-sales/actions", () => ({
  saveDailySalesDraftAction: vi.fn(),
}));

afterEach(cleanup);

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
const draft: DailySales = {
  id: "50000000-0000-4000-8000-000000000001",
  businessDayId: openDay.id,
  businessDate: openDay.businessDate,
  cashSalesRon: "100.00",
  bankSalesRon: "50.00",
  creditSalesRon: "25.00",
  totalSalesRon: "175.00",
  status: "draft",
  notes: null,
  createdAt: "2026-07-01T18:00:00Z",
  updatedAt: "2026-07-01T18:00:00Z",
  lastDraftBy: "10000000-0000-4000-8000-000000000001",
  lastDraftByName: "Employee One",
  lastDraftAt: "2026-07-01T18:00:00Z",
  closedAt: null,
  activeClosureId: null,
  closeSequence: 0,
};

describe("daily sales manager", () => {
  it("shows derived credit and calculated total", () => {
    render(
      <DailySalesManager
        derivedCreditSalesRon="25.00"
        draft={draft}
        openDay={openDay}
      />,
    );

    expect(screen.getByText("25,00 RON")).toBeVisible();
    expect(screen.getByText("175,00 RON")).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: "Cash sales (RON)" }),
    ).toHaveValue("100.00");
    expect(screen.getByText(/last draft saved by employee one/i)).toBeVisible();
  });

  it("warns that unsaved amounts are not used at midnight", async () => {
    const user = userEvent.setup();
    render(
      <DailySalesManager
        derivedCreditSalesRon="25.00"
        draft={draft}
        openDay={openDay}
      />,
    );

    await user.clear(screen.getByRole("textbox", { name: "Cash sales (RON)" }));
    await user.type(
      screen.getByRole("textbox", { name: "Cash sales (RON)" }),
      "120",
    );

    expect(screen.getByText("195,00 RON")).toBeVisible();
    expect(
      screen.getByText(/not part of the midnight close until you save/i),
    ).toBeVisible();
  });

  it("removes manual close controls and explains automatic rollover", () => {
    render(
      <DailySalesManager
        derivedCreditSalesRon="25.00"
        draft={draft}
        openDay={openDay}
      />,
    );

    expect(screen.getByText("Automatic midnight close")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Close day" }),
    ).not.toBeInTheDocument();
  });

  it("identifies an untouched automatic draft", () => {
    render(
      <DailySalesManager
        derivedCreditSalesRon="0.00"
        draft={null}
        openDay={openDay}
      />,
    );

    expect(screen.getByText(/no employee has edited/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Save draft" })).toBeVisible();
  });
});
