import { describe, expect, it } from "vitest";

import {
  employeeInviteSchema,
  loginSchema,
  passwordUpdateSchema,
} from "@/lib/validation/auth";

describe("authentication input validation", () => {
  it("normalizes valid login emails and rejects missing passwords", () => {
    expect(
      loginSchema.parse({
        email: " ADMIN@EXAMPLE.COM ",
        password: "secret",
      }).email,
    ).toBe("admin@example.com");

    expect(
      loginSchema.safeParse({
        email: "admin@example.com",
        password: "",
      }).success,
    ).toBe(false);
  });

  it("requires matching, non-trivial replacement passwords", () => {
    expect(
      passwordUpdateSchema.safeParse({
        password: "short",
        confirmPassword: "short",
      }).success,
    ).toBe(false);
    expect(
      passwordUpdateSchema.safeParse({
        password: "long-password",
        confirmPassword: "different-password",
      }).success,
    ).toBe(false);
  });

  it("validates employee invitation fields", () => {
    expect(
      employeeInviteSchema.safeParse({
        email: "employee@example.com",
        fullName: "Example Employee",
      }).success,
    ).toBe(true);
    expect(
      employeeInviteSchema.safeParse({
        email: "invalid",
        fullName: "E",
      }).success,
    ).toBe(false);
  });
});
