import { expect, test } from "@playwright/test";
import { loginAs, pathId } from "./support/helpers";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

test.describe("BengkelShop pickup order", () => {
  test("customer pays and the workshop verifies the pickup code", async ({ page, browser }) => {
    test.slow();

    await loginAs(page, "customer");

    // --- add a Kawah product to the cart -----------------------------------------
    await page.goto("/en/shop");
    await expect(page.getByRole("heading", { name: "BengkelShop" })).toBeVisible();
    await page.getByPlaceholder(/Search parts, brands, workshops/).fill("Kawah");

    const productCard = page
      .locator("article")
      .filter({ hasText: "Nmax 1L 10W-40" })
      .first();
    await expect(productCard).toBeVisible();
    await productCard.getByRole("button", { name: "Add to cart" }).click();

    // --- cart -> checkout -> place order ------------------------------------------
    await page.goto("/en/cart");
    await expect(page.getByRole("heading", { name: "Your cart" })).toBeVisible();
    await expect(page.getByText("Nmax 1L 10W-40").first()).toBeVisible();
    await expect(page.getByText("Kawah Motor Works").first()).toBeVisible();

    await page.getByRole("link", { name: /Checkout/ }).click();
    await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();

    await page.getByPlaceholder("+62 812 3456 7890").fill("+62 812 3456 7890");
    // Pickup is the default fulfillment option.
    await expect(page.getByRole("button", { name: /Pickup/ }).first()).toBeVisible();
    await page.getByRole("button", { name: /Place order/ }).click();

    await page.waitForURL(/\/en\/orders\/[^/]+$/);
    await expect(page.getByText("Pending payment").first()).toBeVisible();
    const orderId = pathId(page.url());

    await page.getByRole("button", { name: "Simulate payment" }).click();
    await expect(page.getByText("Pickup code").first()).toBeVisible();
    const pickupCode = (
      await page.locator("p.font-mono").filter({ hasText: /^[A-Z0-9]{6}$/ }).first().innerText()
    ).trim();
    expect(pickupCode).toMatch(/^[A-Z0-9]{6}$/);

    // --- owner: preparing -> ready -> verify pickup --------------------------------
    const ownerContext = await browser.newContext({ baseURL: BASE_URL });
    const ownerPage = await ownerContext.newPage();
    await loginAs(ownerPage, "workshop");

    await ownerPage.goto(`/en/workshop/orders/${orderId}`);
    await expect(ownerPage.getByRole("button", { name: "Start preparing" })).toBeVisible();
    await ownerPage.getByRole("button", { name: "Start preparing" }).click();

    await expect(ownerPage.getByRole("button", { name: "Mark ready" })).toBeVisible();
    await ownerPage.getByRole("button", { name: "Mark ready" }).click();

    await expect(ownerPage.getByRole("button", { name: "Verify pickup" })).toBeVisible();
    await ownerPage.getByRole("button", { name: "Verify pickup" }).click();
    const verifyDialog = ownerPage.getByRole("dialog");
    await expect(verifyDialog).toBeVisible();
    await verifyDialog.getByPlaceholder("••••••").fill(pickupCode);
    await verifyDialog.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(verifyDialog).toBeHidden();
    await expect(ownerPage.getByRole("button", { name: "Verify pickup" })).toHaveCount(0);

    // --- customer: pickup complete + product review --------------------------------
    await page.reload();
    await expect(page.getByText("Pickup complete").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Review product" })).toBeVisible();
    await page.getByRole("button", { name: "Review product" }).click();

    const reviewDialog = page.getByRole("dialog");
    await expect(reviewDialog.getByRole("heading", { name: "Review this product" })).toBeVisible();
    await reviewDialog.getByPlaceholder("What stood out?").fill("Oli asli, dikemas rapi, pickup cepat.");
    await reviewDialog.getByRole("button", { name: "Submit review" }).click();
    await expect(reviewDialog).toBeHidden();
    await expect(page.getByText("Reviewed").first()).toBeVisible();

    await ownerContext.close();
  });

  test("customer pages through the shop 20 products at a time", async ({ page }) => {
    await loginAs(page, "customer");
    await page.goto("/en/shop");
    await expect(page.getByRole("heading", { name: "BengkelShop" })).toBeVisible();
    await expect(page.getByText(/Showing 1–20 of \d+ products/)).toBeVisible();

    const pageInput = page.getByRole("textbox", { name: "Page" });
    await pageInput.fill("2");
    await pageInput.press("Enter");
    await expect(page.getByText(/Showing 21–40 of \d+ products/)).toBeVisible();
    await expect(pageInput).toHaveValue("2");

    await page.getByRole("button", { name: "Next page" }).click();
    await expect(page.getByText(/Showing 41–60 of \d+ products/)).toBeVisible();
    await expect(pageInput).toHaveValue("3");
  });

  test("customer checkout cascades province, city, and postal code", async ({ page }) => {
    test.slow();

    await loginAs(page, "customer");
    await page.goto("/en/shop");
    await page.getByPlaceholder(/Search parts, brands, workshops/).fill("Kawah");

    const productCard = page
      .locator("article")
      .filter({ hasText: "Nmax 1L 10W-40" })
      .first();
    await expect(productCard).toBeVisible();
    await productCard.getByRole("button", { name: "Add to cart" }).click();

    await page.goto("/en/cart");
    await page.getByRole("link", { name: /Checkout/ }).click();
    await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();

    await page.getByRole("button", { name: /Delivery/ }).first().click();
    await expect(page.getByRole("heading", { name: "Delivery address" })).toBeVisible();

    await page.getByRole("textbox", { name: "Recipient name" }).fill("Rina Prameswari");
    await page.getByRole("textbox", { name: "Full address" }).fill("Jl. Braga No. 10");

    const province = page.getByRole("combobox", { name: "Province" });
    await province.click();
    await province.fill("Jawa Barat");
    await page.getByRole("option", { name: "Jawa Barat", exact: true }).click();

    const city = page.getByRole("combobox", { name: "City / regency" });
    await expect(city).toBeEnabled();
    await city.click();
    await city.fill("Bandung");
    await expect(page.getByRole("option", { name: "Kota Bandung", exact: true })).toBeVisible();
    await page.getByRole("option", { name: "Kota Bandung", exact: true }).click();

    const postal = page.getByRole("combobox", { name: "Postal code" });
    await expect(postal).toBeEnabled();
    await postal.click();
    await postal.fill("40115");
    await expect(page.getByRole("option", { name: "40115", exact: true })).toBeVisible();
    await page.getByRole("option", { name: "40115", exact: true }).click();

    await page.getByRole("button", { name: "Place order" }).click();
    await page.waitForURL(/\/en\/orders\/[^/]+$/);
    await expect(page.getByText(/Kota Bandung, Jawa Barat 40115/).first()).toBeVisible();
  });
});
