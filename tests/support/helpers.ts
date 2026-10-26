import { expect, type Page } from "@playwright/test";

export const CUSTOMER_DEMO = "Customer · Rina";
export const WORKSHOP_DEMO = "Workshop · Kawah Motor Works";

/** Sign in with one of the seeded demo accounts from /en/auth/login. */
export async function loginAsDemo(page: Page, role: "customer" | "workshop") {
  await page.goto("/en/auth/login");
  const card = role === "customer" ? CUSTOMER_DEMO : WORKSHOP_DEMO;

  await page.getByRole("button", { name: new RegExp(card.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).click();
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
