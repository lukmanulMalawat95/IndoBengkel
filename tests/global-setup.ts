/**
 * Playwright global setup: reset the demo dataset so every run starts from the
 * curated snapshot (deterministic stock, bookings, orders and conversations).
 */
const API_URL = process.env.E2E_API_URL ?? "http://localhost:4000";

export default async function globalSetup() {
  const url = `${API_URL.replace(/\/$/, "")}/api/v1/demo/reset`;

  let response: Response;
  try {
    response = await fetch(url, { method: "POST" });
  } catch (error) {
    throw new Error(
      `Could not reach the API at ${url}. Start the stack with \`npm run stack:up\` first.\n${String(error)}`,
    );
  }

  if (!response.ok) {
    throw new Error(`Demo reset failed (${response.status}): ${await response.text()}`);
  }
}
