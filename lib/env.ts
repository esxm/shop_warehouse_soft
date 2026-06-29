import { z } from "zod";

const appEnvironmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  NEXT_PUBLIC_APP_NAME: z.string().trim().min(1).default("Shop & Warehouse"),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
});

const publicEnvironmentSchema = appEnvironmentSchema.extend({
  NEXT_PUBLIC_SUPABASE_URL: z
    .url()
    .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
      error: "Must use the http or https protocol",
    }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().trim().min(1),
});

const serverEnvironmentSchema = publicEnvironmentSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(1),
});

export type AppEnvironment = z.infer<typeof appEnvironmentSchema>;
export type PublicEnvironment = z.infer<typeof publicEnvironmentSchema>;
export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

function parseSchema<TSchema extends z.ZodType>(
  schema: TSchema,
  source: Record<string, string | undefined>,
): z.output<TSchema> {
  const result = schema.safeParse(source);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return result.data;
}

export function parseEnvironment(
  source: Record<string, string | undefined>,
): AppEnvironment {
  return parseSchema(appEnvironmentSchema, source);
}

export function parsePublicEnvironment(
  source: Record<string, string | undefined>,
): PublicEnvironment {
  return parseSchema(publicEnvironmentSchema, source);
}

export function parseServerEnvironment(
  source: Record<string, string | undefined>,
): ServerEnvironment {
  return parseSchema(serverEnvironmentSchema, source);
}
