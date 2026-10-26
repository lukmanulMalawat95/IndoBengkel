import { expect, test } from "@playwright/test";
import { jakartaDate, loginAsDemo, pathId } from "./support/helpers";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

test.describe("Service booking, end to end", () => {
  test("customer books, owner completes and records cash, customer reviews", async ({ page, browser }) => {
    test.slow();

    await loginAsDemo(page, "customer");

    // --- customer: booking wizard -------------------------------------------------
    await page.goto("/en/workshops/kawah-motor-works/book");
    await expect(page.getByText("Step 1 of 5")).toBeVisible();

    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByText("Step 2 of 5")).toBeVisible();

    await page.getByRole("button", { name: /Oil & filter change \(labor\)/ }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByText("Step 3 of 5")).toBeVisible();

    const dateInput = page.locator('input[type="date"]');
    const enabledSlots = page.locator("button:enabled").filter({ hasText: /^\d{2}:00/ });
    let picked = false;
    for (let offset = 2; offset < 15 && !picked; offset += 1) {
      const key = jakartaDate(offset);
      const weekday = new Date(`${key}T12:00:00+07:00`).getUTCDay();
      if (weekday === 0) continue; // Kawah is closed on Sundays
      await dateInput.fill(key);
      try {
        await expect
          .poll(async () => enabledSlots.count(), { timeout: 5_000 })
          .toBeGreaterThan(0);
      } catch {
        // Closed date (e.g. a workshop closure); try the next one.
      }
      if ((await enabledSlots.count()) > 0) {
        await enabledSlots.first().click();
        picked = true;
      }
    }
    expect(picked, "expected at least one open slot within two weeks").toBe(true);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByText("Step 4 of 5")).toBeVisible();

    await page
      .getByPlaceholder(/Describe the symptom/)
      .fill("Mesin berbunyi kasar saat digas pelan dan getaran terasa di setang.");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByText("Step 5 of 5")).toBeVisible();

    await page.getByRole("button", { name: "Request booking" }).click();
    await expect(page.getByRole("heading", { name: "Booking requested" })).toBeVisible();
    await page.getByRole("link", { name: "View booking" }).click();
    await page.waitForURL(/\/bookings\/[^/]+$/);
    await expect(page.getByRole("heading", { name: /Booking · Kawah Motor Works/ })).toBeVisible();

    const bookingId = pathId(page.url());
    expect(bookingId).toBeTruthy();

    // --- owner: confirm -> start -> finish -> cash --------------------------------
    const ownerContext = await browser.newContext({ baseURL: BASE_URL });
    const ownerPage = await ownerContext.newPage();
    await loginAsDemo(ownerPage, "workshop");

    await ownerPage.goto(`/en/workshop/bookings/${bookingId}`);
    await expect(ownerPage.getByRole("button", { name: "Confirm", exact: true })).toBeVisible();
    await ownerPage.getByRole("button", { name: "Confirm", exact: true }).click();

    const confirmDialog = ownerPage.getByRole("dialog");
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.locator('input[type="number"]').first().fill("45000");
    await confirmDialog.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(confirmDialog).toBeHidden();

    await ownerPage.getByRole("button", { name: "Start service", exact: true }).click();
    const startDialog = ownerPage.getByRole("dialog");
    await expect(startDialog).toBeVisible();
    await startDialog.getByRole("button", { name: /Rudi Santoso/ }).click();
    await startDialog.getByRole("button", { name: "Start service", exact: true }).click();
    await expect(startDialog).toBeHidden();

    await ownerPage.getByRole("button", { name: "Finish service", exact: true }).click();
    const finishDialog = ownerPage.getByRole("dialog");
    await expect(finishDialog).toBeVisible();
    // The invoice starts from the requested services, so the total is already > 0.
    await finishDialog.getByRole("button", { name: "Finish service", exact: true }).click();
    await expect(finishDialog).toBeHidden();

    await expect(ownerPage.getByRole("button", { name: "Record cash paid" })).toBeVisible();
    await ownerPage.getByRole("button", { name: "Record cash paid" }).click();
    const cashDialog = ownerPage.getByRole("dialog");
    await expect(cashDialog).toBeVisible();
    await cashDialog.getByRole("button", { name: "Record cash paid" }).click();
    await expect(cashDialog).toBeHidden();

    // --- customer: paid + review ---------------------------------------------------
    await page.reload();
    await expect(page.getByRole("button", { name: "Review service" })).toBeVisible();
    await page.getByRole("button", { name: "Review service" }).click();

    const reviewDialog = page.getByRole("dialog");
    await expect(reviewDialog.getByRole("heading", { name: "How was the service?" })).toBeVisible();
    await reviewDialog.getByPlaceholder("What stood out?").fill("Pengerjaan cepat dan invoice sesuai estimasi.");
    await reviewDialog.getByRole("button", { name: "Submit review" }).click();
    await expect(reviewDialog).toBeHidden();
    await expect(page.getByText("Reviewed").first()).toBeVisible();

    await ownerContext.close();
  });
});
