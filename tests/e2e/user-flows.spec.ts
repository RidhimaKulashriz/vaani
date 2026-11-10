import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("home language toggle, call scrubber, and consented waitlist submit work", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Your voice/i })).toBeVisible();
  await page.getByRole("button", { name: "Switch language" }).click();
  await expect(page.getByRole("heading", { name: /आपकी बात/i })).toBeVisible();
  await page.getByRole("button", { name: "Switch language" }).click();
  await expect(page.getByLabel("Scrub call journey")).toBeVisible();
  await page.getByRole("button", { name: /04\s*Human/ }).click();
  await expect(page.locator(".live-panel .state-pill")).toHaveText("HUMAN");

  const email = `e2e-${randomUUID()}@example.test`;
  await page.locator("#email").fill(email);
  await page.getByRole("button", { name: "Join waitlist" }).click();
  await expect(page.getByText(/agree to the privacy notice/i)).toBeVisible();
  await page.getByLabel(/I agree to the privacy notice/i).check();
  await page.getByRole("button", { name: "Join waitlist" }).click();
  await expect(page.getByText(/You’re on the list|You're on the list/i)).toBeVisible();
});

test("scripted WebSocket demo connects and Whisper, patch-in, and end visibly work", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.getByRole("status")).toHaveText("INITIATED");
  await expect(page.getByRole("button", { name: /Start simulation/ })).toBeEnabled();
  const panel = page.locator(".console");
  await expect(panel).toHaveCSS("padding", "24px");

  await page.getByRole("button", { name: /Start simulation/ }).click();
  await expect(panel).toContainText("For appointments, press 1.");
  await page.getByLabel(/PRIVATE WHISPER/).fill("Saturday evening after 5 pm, please");
  await page.getByRole("button", { name: /Send whisper/ }).click();
  await expect(panel).toContainText("Your direction was received privately in this simulation.");
  await expect(panel).toContainText("I heard your direction and will adjust the next step.");
  await expect(page.getByRole("status")).toHaveText("USER WHISPERING");

  await page.getByRole("button", { name: /Patch in/ }).click();
  await expect(panel).toContainText("Mock patch-in bridge is ready");
  await expect(page.getByRole("status")).toHaveText("PATCHED IN");
  await page.getByRole("button", { name: /End call/ }).click();
  await expect(page.getByRole("status")).toHaveText("ENDED");
  await expect(panel).toContainText("No real telephone call occurred");
});

test("sensitive OTP scenario stops for the human rather than repeating secret information", async ({ page }) => {
  await page.goto("/demo");
  await page.getByLabel("SCENARIO").selectOption("otp_request");
  await expect(page.getByRole("status")).toHaveText("INITIATED");
  await page.getByRole("button", { name: /Start simulation/ }).click();
  await expect(page.locator(".console")).toContainText("The simulation is handing control to you.");
  await expect(page.locator(".console")).toContainText("No code was requested or stored.");
  await expect(page.locator(".console")).not.toContainText(/\b\d{4,8}\b/);
});

test("home and demo remain usable without horizontal scrolling at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["/", "/demo"]) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    const widths = await page.evaluate(() => ({ viewport: window.innerWidth, content: document.documentElement.scrollWidth }));
    expect(widths.content, `${route} overflows ${widths.viewport}px viewport`).toBeLessThanOrEqual(widths.viewport);
  }
  await expect(page.getByRole("status")).toHaveText("INITIATED");
  await expect(page.getByRole("button", { name: /Start simulation/ })).toBeEnabled();
});
