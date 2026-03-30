import { test, expect } from "@playwright/test";

test.describe("WTF LivePulse E2E", () => {
  test("dashboard loads and lists 10 gyms", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("gym-select")).toBeVisible({
      timeout: 120000,
    });
    const options = page.locator('[data-testid="gym-select"] option');
    await expect(options).toHaveCount(10);
  });

  test("switching gym updates occupancy display", async ({ page }) => {
    await page.goto("/");
    const sel = page.getByTestId("gym-select");
    await sel.waitFor({ state: "visible", timeout: 120000 });
    const first = await sel.inputValue();
    const opts = await sel.locator("option").all();
    const secondVal = await opts[1]?.getAttribute("value");
    if (!secondVal || secondVal === first) test.skip();
    await sel.selectOption(secondVal);
    await page.waitForTimeout(300);
    await expect(page.getByText(/Occupancy/i)).toBeVisible();
  });

  test("simulator adds activity within 2 seconds", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("gym-select").waitFor({ state: "visible", timeout: 120000 });
    await page.getByTestId("sim-start").click();
    const feed = page.getByTestId("activity-feed");
    await expect(feed).toBeVisible();
    await expect(
      feed.getByText(/CHECKIN|CHECKOUT|PAYMENT/).first()
    ).toBeVisible({ timeout: 2000 });
  });
});
