import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/app-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("@/app/(protected)/actions", () => ({
  logout: vi.fn(),
}));

afterEach(() => cleanup());

const adminContext = {
  user: {
    id: "00000000-0000-0000-0000-000000000001",
    email: "admin@example.com",
    displayName: "Store Admin",
  },
  profile: { fullName: "Store Admin" },
  business: {
    id: "00000000-0000-0000-0000-000000000002",
    name: "Example Shop",
    timezone: "Europe/Bucharest",
  },
  role: "admin" as const,
};

describe("AppShell", () => {
  it("renders the signed-in user, role-aware navigation, and page content", () => {
    render(
      <AppShell context={adminContext}>
        <h1>Test content</h1>
      </AppShell>,
    );

    expect(
      screen.getByRole("navigation", { name: "Primary navigation" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByText("Store Admin")).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Users" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign out" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Test content" }),
    ).toBeInTheDocument();
  });

  it("closes grouped header menus after a navigation link is clicked", async () => {
    const user = userEvent.setup();

    render(
      <AppShell context={adminContext}>
        <h1>Test content</h1>
      </AppShell>,
    );

    const inventoryMenu = screen.getByRole("button", { name: /inventory/i });
    await user.click(inventoryMenu);

    expect(inventoryMenu).toHaveAttribute("aria-expanded", "true");

    const productsLink = screen.getByRole("link", {
      name: "Products & Stock",
    });
    productsLink.addEventListener("click", (event) => event.preventDefault());

    await user.click(productsLink);

    expect(inventoryMenu).toHaveAttribute("aria-expanded", "false");
  });

  it("opens and closes the mobile primary menu", async () => {
    const user = userEvent.setup();

    render(
      <AppShell context={adminContext}>
        <h1>Test content</h1>
      </AppShell>,
    );

    const menuButton = screen.getByRole("button", { name: "Menu" });
    expect(menuButton).toHaveAttribute("aria-expanded", "false");

    await user.click(menuButton);

    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    expect(
      document.querySelector("#mobile-primary-navigation"),
    ).toBeInTheDocument();

    await user.click(screen.getAllByRole("link", { name: "Dashboard" })[0]);

    expect(menuButton).toHaveAttribute("aria-expanded", "false");
  });
});
