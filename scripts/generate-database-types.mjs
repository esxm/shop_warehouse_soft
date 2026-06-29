import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { format } from "prettier";

const execFileAsync = promisify(execFile);
const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const supabaseCli = fileURLToPath(
  new URL("../node_modules/supabase/dist/supabase.js", import.meta.url),
);
const outputPath = fileURLToPath(
  new URL("../lib/db/database.types.ts", import.meta.url),
);

const { stdout, stderr } = await execFileAsync(
  process.execPath,
  [supabaseCli, "gen", "types", "typescript", "--local", "--schema", "public"],
  {
    cwd: projectRoot,
    maxBuffer: 10 * 1024 * 1024,
  },
);

if (!stdout.includes("export type Database")) {
  throw new Error(
    `Supabase did not return TypeScript database types.${stderr ? `\n${stderr}` : ""}`,
  );
}

const formattedTypes = await format(stdout, { filepath: outputPath });

await writeFile(outputPath, formattedTypes, "utf8");
console.log("Generated lib/db/database.types.ts from the local database.");
