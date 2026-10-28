import { expect, type Page } from "@playwright/test";

export const CUSTOMER_EMAIL = "rina@indobengkel.test";
export const WORKSHOP_EMAIL = "andi@kawahmotor.test";
export const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "password123";

/** Sign in with a seeded local account through the real login form. */
export async function loginAs(page: Page, role: "customer" | "workshop") {
  await page.goto("/en/auth/login");
  await page.locator('input[type="email"]').fill(role === "customer" ? CUSTOMER_EMAIL : WORKSHOP_EMAIL);
  await page.locator('input[type="password"]').fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/auth/login"), { timeout: 30_000 });
  await expect(page.getByRole("link", { name: /Sign in/i })).toHaveCount(0);
}

export function uniqueLabel(prefix: string) {
  return `${prefix} ${Date.now().toString(36)}`;
}

/** ISO date (YYYY-MM-DD) in Asia/Jakarta, `offsetDays` from now. */
export function jakartaDate(offsetDays: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + offsetDays * 86_400_000));
}

/** Next open weekday (Kawah is closed on Sundays) at least `offsetDays` ahead. */
export function nextOpenDate(offsetDays = 2) {
  for (let offset = offsetDays; offset < offsetDays + 8; offset += 1) {
    const key = jakartaDate(offset);
    const weekday = new Date(`${key}T12:00:00+07:00`).getUTCDay();
    if (weekday !== 0) return key;
  }
  throw new Error("Could not find an open day within a week");
}

export function pathId(url: string) {
  const id = url.split("?")[0].split("/").filter(Boolean).pop();
  if (!id) throw new Error(`No id in URL ${url}`);
  return id;
}
