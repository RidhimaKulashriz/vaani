import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("home, demo, and logged-out private app have no critical or serious axe accessibility violations", async ({ page }) => {
  await page.route("**/api/auth/me", (request) => request.fulfill({ json: { authenticated: false, user: null } }));
  for (const route of ["/", "/demo", "/app"]) {
    await page.goto(route);
    const result = await new AxeBuilder({ page }).analyze();
    const serious = result.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious");
    expect(serious, `${route} axe violations: ${serious.map((violation) => violation.id).join(", ")}`).toEqual([]);
  }
});
