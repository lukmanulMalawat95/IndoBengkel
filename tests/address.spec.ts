import { expect, test } from "@playwright/test";
import { loginAs } from "./support/helpers";

test.describe("Address autocomplete", () => {
  test("workshop profile narrows city and postal options from the province", async ({ page }) => {
    await loginAs(page, "workshop");
    await page.goto("/en/workshop/profile");
    await expect(
      page.getByRole("heading", { name: "Workshop profile", level: 1 }),
    ).toBeVisible();

    const province = page.getByRole("combobox", { name: "Province" });
    await province.click();
    await province.fill("Jawa Barat");
    await page.getByRole("option", { name: "Jawa Barat", exact: true }).click();

    const city = page.getByRole("combobox", { name: "City / regency" });
    await expect(city).toBeEnabled();
    await city.click();
    await city.fill("Garut");
    await expect(page.getByRole("option", { name: "Kabupaten Garut", exact: true })).toBeVisible();
    await page.getByRole("option", { name: "Kabupaten Garut", exact: true }).click();

    const postal = page.getByRole("combobox", { name: "Postal code" });
    await expect(postal).toBeEnabled();
    await postal.click();
    await postal.fill("44111");
    await expect(page.getByRole("option", { name: "44111", exact: true })).toBeVisible();
  });
});
