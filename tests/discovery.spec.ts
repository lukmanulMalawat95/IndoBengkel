import { expect, test } from "@playwright/test";

test.describe("Discovery", () => {
  test("finds a workshop by name and opens its profile", async ({ page }) => {
    await page.goto("/en/workshops");
    await expect(page.getByRole("heading", { name: "Discover workshops" })).toBeVisible();

    await page.getByPlaceholder("Search workshop, area or city").fill("Kawah");
    const card = page.locator("article").filter({ hasText: "Kawah Motor Works" }).first();
    await expect(card).toBeVisible();
    await card.getByRole("link", { name: /View details/ }).click();

    await expect(page).toHaveURL(/\/en\/workshops\/kawah-motor-works$/);
    await expect(
      page.getByRole("heading", { name: "Kawah Motor Works" }).first(),
    ).toBeVisible();

    for (const tab of ["Services", "Shop", "Reviews", "Mechanics", "About"]) {
      await expect(page.getByRole("tab", { name: tab })).toBeVisible();
    }

    await page.getByRole("tab", { name: "Mechanics" }).click();
    await expect(page.getByText("Rudi Santoso").first()).toBeVisible();
  });

  test("filters the catalogue by vehicle type", async ({ page }) => {
    await page.goto("/en/workshops");
    await expect(page.getByRole("heading", { name: "Discover workshops" })).toBeVisible();
    await expect(page.getByText("Northline Auto Service").first()).toBeVisible();

    await page.getByRole("button", { name: "Motorcycle", exact: true }).click();
    await expect(page.locator("article").filter({ hasText: "Northline Auto Service" })).toHaveCount(0);
    await expect(page.locator("article").filter({ hasText: "Kawah Motor Works" }).first()).toBeVisible();
  });

  test("guards the customer area for anonymous visitors", async ({ page }) => {
    await page.goto("/en/bookings");
    await expect(page.getByText("Sign in required").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();
  });
});
