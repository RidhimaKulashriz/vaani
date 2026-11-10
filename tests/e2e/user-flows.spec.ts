import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

async function confirmMockTask(page: Page) {
  await page.getByRole("button", { name: /Review task/ }).click();
  await page.getByRole("button", { name: "Confirm task and start simulation" }).click();
}

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
  await expect(page.getByRole("button", { name: /Review task/ })).toBeEnabled();
  const panel = page.locator(".console");
  await expect(panel).toHaveCSS("padding", "24px");

  const objective = "Book a dermatologist appointment at Apollo Clinic, Saturday morning";
  await page.getByLabel("YOUR ROUTINE TASK").fill(objective);
  await page.getByRole("button", { name: /Review task/ }).click();
  const review = page.getByRole("group", { name: "Review and confirm mock task" });
  await expect(review).toContainText(objective);
  await expect(review).toContainText("No business will be called");
  await page.getByRole("button", { name: "Confirm task and start simulation" }).click();
  await expect(page.getByText(/Task confirmed\. The scripted mock call is running/)).toBeVisible();
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
  await confirmMockTask(page);
  await expect(page.locator(".console")).toContainText("The simulation is handing control to you.");
  await expect(page.locator(".console")).toContainText("No code was requested or stored.");
  await expect(page.locator(".console")).not.toContainText(/\b\d{4,8}\b/);
});

test("home and demo remain usable without horizontal scrolling at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["/", "/demo", "/app"]) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    const widths = await page.evaluate(() => ({ viewport: window.innerWidth, content: document.documentElement.scrollWidth }));
    expect(widths.content, `${route} overflows ${widths.viewport}px viewport`).toBeLessThanOrEqual(widths.viewport);
  }
  await page.goto("/demo");
  await expect(page.getByRole("status")).toHaveText("INITIATED");
  await expect(page.getByRole("button", { name: /Review task/ })).toBeEnabled();
});


test("task entry blocks verification secrets before confirmation", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.getByRole("status")).toHaveText("INITIATED");
  await page.getByLabel("YOUR ROUTINE TASK").fill("Tell the receptionist my OTP code is 123456");
  await page.getByRole("button", { name: /Review task/ }).click();
  await expect(page.locator(".task-error")).toContainText(/verification.*details are not accepted/i);
  await expect(page.getByRole("button", { name: "Confirm task and start simulation" })).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveText("INITIATED");
});

test("server rejects a tampered sensitive objective sent directly over the demo socket", async ({ page }) => {
  await page.goto("/demo");
  const rejection = await page.evaluate(() => new Promise<{ type: string; code?: string }>((resolve, reject) => {
    const scheme = location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(`${scheme}://${location.host}/api/demo-call`);
    const timeout = window.setTimeout(() => reject(new Error("Sensitive-objective rejection timed out")), 5_000);
    socket.addEventListener("message", (message) => {
      const event = JSON.parse(String(message.data)) as { type?: string; code?: string };
      if (event.type === "session.ready") {
        socket.send(JSON.stringify({ type: "demo.start", scenario: "clinic_appointment", objective: "Use my OTP code 123456" }));
      } else if (event.type === "error" && event.code === "sensitive_detail_not_allowed") {
        window.clearTimeout(timeout);
        socket.close();
        resolve({ type: event.type, code: event.code });
      }
    });
    socket.addEventListener("error", () => {
      window.clearTimeout(timeout);
      reject(new Error("Could not open the same-origin mock demo socket"));
    });
  }));
  expect(rejection).toEqual({ type: "error", code: "sensitive_detail_not_allowed" });
});


test("mock microphone sends only voice-gated PCM16 frames and clearly reports no transcription", async ({ page }) => {
  await page.context().grantPermissions(["microphone"]);
  await page.goto("/demo");
  await expect(page.getByRole("status")).toHaveText("INITIATED");
  await confirmMockTask(page);
  await page.getByRole("button", { name: "Start microphone frame test" }).click();
  const micStatus = page.locator(".mic-status");
  await expect(micStatus).toContainText("Microphone active");
  await expect(micStatus).toContainText("Audio reached the mock client path", { timeout: 8_000 });
  await expect(micStatus).toContainText("not transcribed");
  await page.getByRole("button", { name: "Stop microphone" }).click();
  await expect(micStatus).toContainText("Microphone stopped. Audio frames were not recorded.");
});


test("private app requires configured OAuth and does not offer a synthetic account", async ({ page }) => {
  await page.route("**/api/auth/me", (route) => route.fulfill({ json: { authenticated: false, user: null } }));
  await page.route("**/api/auth/start", (route) => route.fulfill({ status: 503, json: { error: "oauth_unavailable", message: "Account sign-in is not configured in this environment." } }));
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: /Your calls, your control/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Sign in with account/ })).toBeEnabled();
  await page.getByRole("button", { name: /Sign in with account/ }).click();
  await expect(page.locator(".app-error")).toContainText("Account sign-in is not configured");
  await expect(page.getByRole("link", { name: /Open public mock demo/ })).toBeVisible();
});
