import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const base = process.env.BOO_TEST_BASE || "http://127.0.0.1:5181";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const out = "/tmp/boo-rehearsal-review";
await fs.mkdir(out, { recursive: true });
async function open({ owner = true, signedIn = true, width = 390 } = {}) {
  const page = await browser.newPage({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    }),
    calls = [],
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (signedIn)
    await page.addInitScript(() => {
      localStorage.setItem(
        "ami-vault-auth",
        JSON.stringify({
          access_token: "fictional-organizer-preview-session-only",
          refresh_token: "fictional-refresh",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          expires_in: 3600,
          token_type: "bearer",
          user: {
            id: "a0000000-0000-4000-8000-000000000002",
            aud: "authenticated",
            role: "authenticated",
          },
        }),
      );
      sessionStorage.setItem("rcap-boo-journey-v1", "real-navigation-marker");
    });
  await page.route("**/api/little-boo**", (route) => {
    const b = route.request().postDataJSON();
    calls.push(b?.action || "GET");
    assert.equal(
      b?.action,
      "preview-access",
      "Rehearsal must never call a real game operation",
    );
    return route.fulfill({
      status: owner ? 200 : 403,
      json: owner ? { allowed: true } : { error: "Owner access required." },
    });
  });
  await page.goto(base + "/little-boo/?preview=guessing");
  return { page, calls, errors };
}
for (const width of [390, 1280]) {
  const { page, calls, errors } = await open({ width });
  await page
    .getByRole("button", { name: "Open practice board", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: /Who could it be/ })
    .first()
    .waitFor();
  await page
    .getByRole("button", { name: "Open practice board", exact: true })
    .click();
  assert.equal(await page.locator(".cards .card").count(), 12);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({ path: out + `/board-${width}.png`, fullPage: true });
  await page.locator(".cards .card").nth(0).click();
  await page.getByLabel("Your one guess").fill("Fable Finch");
  await page.getByRole("button", { name: "Review my guess" }).click();
  await page.getByRole("button", { name: "Yes, lock it in" }).click();
  await page.getByText("Identified! You earned 5 points.").waitFor();
  await page.screenshot({ path: out + `/correct-${width}.png` });
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.reload();
  await page
    .getByText("5 guess points · 3 contribution points", { exact: true })
    .waitFor();
  await page.locator(".cards .card").nth(1).click();
  await page.getByLabel("Your one guess").fill("Milo Moon");
  await page.getByRole("button", { name: "Review my guess" }).click();
  await page.getByRole("button", { name: "Yes, lock it in" }).click();
  await page.getByText("Identified! You earned 3 points.").waitFor();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.locator(".cards .card").nth(2).click();
  await page.getByRole("button", { name: /A little help/ }).click();
  await page
    .getByRole("button", { name: "Piper Pumpkin", exact: true })
    .click();
  await page.getByRole("button", { name: "Review my guess" }).click();
  await page.getByRole("button", { name: "Yes, lock it in" }).click();
  await page.getByText("Identified! You earned 1 points.").waitFor();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.locator(".cards .card").nth(3).click();
  await page.getByLabel("Your one guess").fill("Wrong Example");
  await page.getByRole("button", { name: "Review my guess" }).click();
  await page.getByRole("button", { name: "Yes, lock it in" }).click();
  await page
    .getByText(
      "One guess was your shot. The answer stays a mystery for everyone else.",
    )
    .waitFor();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.locator(".cards .card").nth(11).click();
  await page.getByText(/Your own mystery. No guessing points/).waitFor();
  assert.equal(await page.getByLabel("Your one guess").count(), 0);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "My grade", exact: true }).click();
  assert.equal(await page.locator(".cards .card").count(), 3);
  await page
    .getByRole("button", { name: "All little boos", exact: true })
    .click();
  assert.equal(await page.locator(".cards .card").count(), 12);
  await page
    .getByRole("button", { name: "Reset practice", exact: true })
    .click();
  await page
    .getByText("0 guess points · 3 contribution points", { exact: true })
    .waitFor();
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem("rcap-boo-journey-v1")),
    "real-navigation-marker",
  );
  assert.ok(calls.length > 0);
  assert.ok(calls.every((a) => a === "preview-access"));
  assert.deepEqual(errors, []);
  await page.close();
}
{
  const { page, calls, errors } = await open({ owner: false });
  await page.getByText("Owner access required.", { exact: true }).waitFor();
  assert.equal(await page.locator(".cards").count(), 0);
  assert.equal(await page.getByLabel("Organizer rehearsal").count(), 0);
  assert.ok(calls.every((a) => a === "preview-access"));
  assert.deepEqual(errors, []);
  await page.close();
}
{
  const { page, calls, errors } = await open({ signedIn: false });
  await page
    .getByRole("heading", { name: "Sign in as the organizer." })
    .waitFor();
  assert.equal(calls.length, 0);
  assert.equal(await page.locator(".cards").count(), 0);
  assert.deepEqual(errors, []);
  await page.close();
}
await browser.close();
console.log(
  "PASS: owner-only rehearsal, signed-out/member denial, shared UI, 5/3/1, one wrong guess, own-child exclusion, filters, session persistence/reset, preserved real journey, mobile/desktop, and zero real game API operations. Fictional fixtures only.",
);
