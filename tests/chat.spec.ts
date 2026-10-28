import { expect, test } from "@playwright/test";
import { loginAs, uniqueLabel } from "./support/helpers";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

test.describe("Chat between customer and workshop", () => {
  test("a message travels both ways with read receipts", async ({ page, browser }) => {
    test.slow();

    await loginAs(page, "customer");
    await page.goto("/en/workshops/kawah-motor-works");
    await page.getByRole("button", { name: "Chat with workshop" }).click();
    await page.waitForURL(/\/en\/chat\/conv-1$/);

    const message = uniqueLabel("Halo, bisa servis besok pagi?");
    const composer = page.getByPlaceholder("Write a message…");
    await composer.fill(message);
    await composer.press("Enter");
    await expect(page.getByText(message).first()).toBeVisible();

    const ownerContext = await browser.newContext({ baseURL: BASE_URL });
    const ownerPage = await ownerContext.newPage();
    await loginAs(ownerPage, "workshop");
    await ownerPage.goto("/en/workshop/chat?thread=conv-1");

    await expect(ownerPage.getByText(message).first()).toBeVisible({ timeout: 20_000 });

    const reply = uniqueLabel("Bisa, slot jam 09:00 masih kosong.");
    const ownerComposer = ownerPage.getByPlaceholder("Write a message…");
    await ownerComposer.fill(reply);
    await ownerComposer.press("Enter");
    await expect(ownerPage.getByText(reply).first()).toBeVisible();

    await page.reload();
    await expect(page.getByText(reply).first()).toBeVisible({ timeout: 20_000 });

    await ownerContext.close();
  });
});
