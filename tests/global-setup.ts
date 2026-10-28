/**
 * Playwright global setup: reseed the Docker stack so every run starts from the
 * same known dataset. The API does not seed on startup in production mode.
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const API_URL = process.env.E2E_API_URL ?? "http://localhost:4000";

async function waitForApi(url: string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The stack may still be starting.
    }
    await new Promise((done) => setTimeout(done, 1000));
  }
  throw new Error(`API did not become healthy at ${url}.`);
}

export default async function globalSetup() {
  const root = resolve(__dirname, "..");
  const healthUrl = `${API_URL.replace(/\/$/, "")}/api/v1/health`;

  await waitForApi(healthUrl);

  try {
    const seedPassword = process.env.SEED_PASSWORD ?? "password123";
    execFileSync(
      "docker",
      [
        "compose",
        "exec",
        "-T",
        "-e",
        `SEED_PASSWORD=${seedPassword}`,
        "backend",
        "node",
        "dist/src/seed/run.js",
      ],
      { cwd: root, stdio: "inherit" },
    );
  } catch (error) {
    throw new Error(
      `Could not seed the Docker stack. Start it with \`npm run stack:up\` first.\n${String(error)}`,
    );
  }
}
