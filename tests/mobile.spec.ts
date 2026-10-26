import { expect, test } from "@playwright/test";

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe("Mobile layout", () => {
  test("home, discovery and workshop detail fit the viewport", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("header")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/en/workshops");
    await expect(page.getByRole("heading", { name: "Discover workshops" })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/en/workshops/kawah-motor-works");
    await expect(
      page.getByRole("heading", { name: "Kawah Motor Works" }).first(),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Book a service" }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
