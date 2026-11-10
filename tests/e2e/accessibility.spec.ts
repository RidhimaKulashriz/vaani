import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("home and demo pages have no critical or serious axe accessibility violations", async ({ page }) => {
  for (const route of ["/", "/demo"]) {
    await page.goto(route);
    const result = await new AxeBuilder({ page }).analyze();
    const serious = result.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious");
    expect(serious, `${route} axe violations: ${serious.map((violation) => violation.id).join(", ")}`).toEqual([]);
  }
});
