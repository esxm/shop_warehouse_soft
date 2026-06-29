import "@testing-library/jest-dom/vitest";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "unit-test-public-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "unit-test-service-role-key";
