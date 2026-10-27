import { expect, test } from "@playwright/test";
import { loginAsDemo } from "./support/helpers";

test.describe("Workshop layout overlays", () => {
  test("the user menu stays above the Leaflet map", async ({ page }) => {
    await loginAsDemo(page, "workshop");
    await page.goto("/en/workshop/profile");

    await expect(page.locator(".leaflet-container")).toBeVisible();

    await page.locator("header button:has(svg.lucide-chevron-down)").click();
    const signOut = page.getByRole("menuitem", { name: "Sign out" });
    await expect(signOut).toBeVisible();

    const box = await signOut.boundingBox();
    expect(box).not.toBeNull();

    // Playwright's visibility check does not detect occlusion. Ask the browser
    // which element is actually on top at the menu item's centre.
    const topmost = await page.evaluate(
      ({ x, y }) => {
        const element = document.elementFromPoint(x, y);
        return element?.closest('[role="menuitem"]')?.textContent ?? null;
      },
      { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 },
    );
    expect(topmost).toContain("Sign out");

    await signOut.click();
    await expect(page).toHaveURL(/\/en\/auth\/login/);
  });
});
