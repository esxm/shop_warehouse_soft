import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppShell } from "@/components/app-shell";

describe("AppShell", () => {
  it("renders responsive navigation and page content", () => {
    render(
      <AppShell>
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
    expect(
      screen.getByRole("heading", { name: "Test content" }),
    ).toBeInTheDocument();
  });
});
