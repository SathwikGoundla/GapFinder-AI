import { test, expect } from "@playwright/test";

// Public checks: run anywhere the app is running.
test("landing page explains the product", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Know your gaps");
});

test("protected pages redirect to sign-in", async ({ page }) => {
  await page.goto("/report");
  await expect(page).toHaveURL(/\/login\?next=%2Freport/);
});

test("API rejects unauthenticated requests", async ({ request }) => {
  const res = await request.post("/api/quiz", { data: {} });
  expect(res.status()).toBe(401);
});

// Full student workflow: needs a real Supabase project + AI key, and a test account.
const email = process.env.E2E_EMAIL, password = process.env.E2E_PASSWORD;
test.describe("full workflow", () => {
  test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD (a dedicated test account) to run.");
  test.setTimeout(300_000);
  test("sample materials → topics → quiz → report → plan", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL("**/dashboard");
    await page.request.delete("/api/account/data");
    await page.reload();
    await page.getByRole("button", { name: "Load the sample PLC course" }).click();
    await page.getByRole("button", { name: "Build topic map" }).click({ timeout: 120_000 });
    await page.getByRole("link", { name: "Take a diagnostic quiz" }).click({ timeout: 120_000 });
    await page.getByRole("button", { name: /Start quiz/ }).click();
    await page.waitForURL(/\/quiz\/[0-9a-f-]{36}$/, { timeout: 120_000 });
    // Answer only the first question, then submit with blanks to exercise "unanswered".
    page.on("dialog", (d) => d.accept());
    const radio = page.getByRole("radio").first();
    if (await radio.isVisible()) await radio.check(); else await page.getByLabel("Your answer").fill("Inputs are read once per scan.");
    while (await page.getByRole("button", { name: "Next question" }).isVisible()) await page.getByRole("button", { name: "Next question" }).click();
    await page.getByRole("button", { name: "Submit quiz" }).click();
    await expect(page.getByRole("heading", { name: "Quiz results" })).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText(/Source:/).first()).toBeVisible();
    await page.goto("/report");
    await expect(page.getByRole("heading", { name: "Gap report" })).toBeVisible();
    await page.goto("/plan");
    await page.getByRole("button", { name: "Create plan" }).click();
    await expect(page.getByText(/sessions done/)).toBeVisible({ timeout: 120_000 });
  });
});
