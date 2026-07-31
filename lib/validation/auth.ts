import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.")),
  password: z.string().min(1, "Enter your password."),
});

export const passwordResetRequestSchema = loginSchema.pick({ email: true });

export const passwordUpdateSchema = z
  .object({
    password: z
      .string()
      .min(10, "Use at least 10 characters.")
      .max(72, "Use no more than 72 characters."),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const employeeInviteSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.")),
  fullName: z
    .string()
    .trim()
    .min(2, "Enter the employee's full name.")
    .max(120),
});

export const employeeAccessSchema = z
  .object({
    userId: z.uuid("Employee is invalid."),
    active: z.enum(["true", "false"]).transform((value) => value === "true"),
    confirmation: z.string().optional(),
  })
  .superRefine((input, context) => {
    if (!input.active && input.confirmation !== "confirm") {
      context.addIssue({
        code: "custom",
        message: "Confirm employee deactivation.",
        path: ["confirmation"],
      });
    }
  });
