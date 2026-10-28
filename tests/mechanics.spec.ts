import { expect, test } from "@playwright/test";
import { loginAs, uniqueLabel } from "./support/helpers";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("Workshop mechanics", () => {
  test("owner adds a mechanic with a photo and it survives a reload", async ({ page }) => {
    await loginAs(page, "workshop");
    await page.goto("/en/workshop/mechanics");
    await expect(page.getByRole("heading", { name: "Mechanics" })).toBeVisible();

    await page.getByRole("button", { name: "Add mechanic" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Add mechanic" })).toBeVisible();

    const name = uniqueLabel("Joko Prasetyo");
    const textInputs = dialog.locator('input:not([type="file"])');
    await textInputs.nth(0).fill(name);
    await textInputs.nth(1).fill("+6281234567890");
    await textInputs.nth(3).fill("engine, cvt, brakes");

    const upload = page.waitForResponse(
      (response) => response.url().includes("/api/uploads") && response.ok(),
      { timeout: 30_000 },
    );
    await dialog.locator('input[type="file"]').setInputFiles({
      name: "avatar.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await upload;

    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(name).first()).toBeVisible();

    await page.reload();
    await expect(page.getByText(name).first()).toBeVisible();
    await expect(page.getByText("engine").first()).toBeVisible();
  });
});
