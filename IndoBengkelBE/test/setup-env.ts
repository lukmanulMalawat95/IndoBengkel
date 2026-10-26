/**
 * Load the backend .env (the Prisma CLI reads it, the Nest runtime does not)
 * and redirect every test run to an isolated PostgreSQL schema.
 *
 * Override with TEST_DATABASE_URL when CI provides its own database.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const TEST_SCHEMA = "indobengkel_test";

function loadEnvFile() {
  const envPath = resolve(ROOT, ".env");
  if (!existsSync(envPath)) return;
  for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

function withTestSchema(url: string) {
  if (!url) return url;
  const parsed = new URL(url);
  parsed.searchParams.set("schema", TEST_SCHEMA);
  return parsed.toString();
}

loadEnvFile();

if (!process.env.TEST_DATABASE_URL && process.env.DATABASE_URL) {
  process.env.DATABASE_URL = withTestSchema(process.env.DATABASE_URL);
}
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret";
process.env.PAYMENT_PROVIDER = process.env.PAYMENT_PROVIDER ?? "fake";
// The expiry job has its own deterministic test; do not let a background tick
// race fixtures that deliberately set short payment windows.
process.env.PAYMENT_EXPIRY_ENABLED = "false";

// The API suites make hundreds of requests from one IP in a few seconds and
// reuse fixtures across suites. Turn the production controls off by default;
// `security.e2e-spec.ts` flips them back on per test to exercise the guards.
process.env.CSRF_ENABLED = process.env.CSRF_ENABLED ?? "false";
process.env.RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED ?? "false";

export const TEST_DB_SCHEMA = TEST_SCHEMA;
