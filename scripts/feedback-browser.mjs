// Real database submission against an isolated fixture. Recording uses Chromium's fake microphone.
// Run with FEEDBACK_FIXTURE pointing to a temporary {survey,slug,token} JSON file.
import { chromium } from "playwright";
import fs from "node:fs";
import assert from "node:assert/strict";
const fixturePath = process.env.FEEDBACK_FIXTURE;
if (!fixturePath) throw new Error("FEEDBACK_FIXTURE is required");
const fixture = JSON.parse(fs.readFileSync(fixturePath));
const base = process.env.FEEDBACK_BASE || "http://127.0.0.1:5178";
const browser = await chromium.launch({
  headless: true,
  channel: "chrome",
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
  ],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  permissions: ["microphone"],
});
const page = await context.newPage();
page.setDefaultTimeout(12000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let failSubmission = true;
const submissions = [];
await page.route("**/rest/v1/rpc/rcap_feedback", async (route) => {
  const body = route.request().postDataJSON();
  if (body.p_action === "submit") {
    submissions.push(body.p_payload);
    fixture.response = body.p_payload.id;
    fs.writeFileSync(fixturePath, JSON.stringify(fixture));
    if (failSubmission) {
      failSubmission = false;
      await route.fulfill({
        status: 503,
        body: JSON.stringify({ message: "Temporary test outage" }),
      });
      return;
    }
  }
  if (body.p_action === "voice") {
    fixture.voice = body.p_payload.id;
    fs.writeFileSync(fixturePath, JSON.stringify(fixture));
  }
  await route.continue();
});
try {
  if (!process.env.FEEDBACK_ADMIN_ONLY) {
    await page.goto(`${base}/feedback/${fixture.slug}`);
    await page
      .getByRole("heading", { name: "Your night. Your honest take." })
      .waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.getByRole("button", { name: "Let’s talk about it" }).click();
    await page.getByRole("button", { name: "Next →", exact: true }).click();
    await page.getByRole("alert").waitFor();
    await page
      .getByRole("button", { name: "5: Loved it", exact: true })
      .click();
    await page.getByRole("button", { name: "Next →", exact: true }).click();
    await page.getByRole("button", { name: "Next →", exact: true }).click();
    await page.getByRole("alert").waitFor();
    for (const label of [
      "Food",
      "DJ / hosting",
      "Karaoke",
      "Dancing / party portion",
    ])
      await page
        .getByRole("group", { name: label, exact: true })
        .getByRole("button", { name: "4: Really enjoyed it", exact: true })
        .click();
    await page
      .locator("fieldset")
      .filter({ has: page.locator("legend", { hasText: "Photo booth" }) })
      .getByRole("button", { name: "Didn’t try / Not applicable" })
      .click();
    await page.screenshot({
      path: "../feedback-mobile-ratings.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Next →", exact: true }).click();
    await page.getByRole("button", { name: "Next →", exact: true }).click();
    await page.getByRole("alert").waitFor();
    await page
      .getByRole("button", {
        name: "Mostly comfortable, but some seating would help",
      })
      .click();
    await page.getByRole("button", { name: "Next →", exact: true }).click();
    await page.getByRole("button", { name: "Next →", exact: true }).click();
    await page.getByRole("alert").waitFor();
    await page.getByRole("button", { name: "About right" }).click();
    await page.getByRole("button", { name: "Next →", exact: true }).click();
    await page.getByRole("button", { name: "Next →", exact: true }).click();
    await page.getByRole("alert").waitFor();
    await page.getByRole("button", { name: "Game or trivia night" }).click();
    await page.getByRole("button", { name: "Other", exact: false }).click();
    assert.equal(
      await page
        .getByRole("button", { name: "A relaxed meal together" })
        .isDisabled(),
      true,
    );
    await page.getByRole("button", { name: "Next →", exact: true }).click();
    await page.getByRole("alert").waitFor();
    await page.getByLabel("What would you enjoy?").fill("Museum visit");
    await page.getByRole("button", { name: "Next →", exact: true }).click();
    await page
      .getByRole("button", { name: "Send feedback", exact: true })
      .click();
    await page.getByRole("alert").waitFor();
    await page
      .getByRole("button", { name: "Send feedback", exact: true })
      .click();
    await page.getByRole("heading", { name: "Better, together." }).waitFor();
    assert.equal(submissions[0].id, submissions[1].id);
    assert.equal(Object.keys(submissions[1].answers).length, 5);
    await page.getByRole("button", { name: "Leave a voice note" }).click();
    await page.getByRole("button", { name: "Record a voice note" }).click();
    await page.getByRole("button", { name: "Stop recording" }).waitFor();
    await page.waitForTimeout(1100);
    await page.getByRole("button", { name: "Stop recording" }).click();
    await page.locator("audio").waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Send voice note", exact: true })
        .isDisabled(),
      true,
    );
    await page.getByRole("button", { name: "Record again" }).click();
    await page.getByRole("button", { name: "Record a voice note" }).click();
    await page.locator("audio").waitFor({ timeout: 35000 });
    assert.equal(
      await page.getByRole("button", { name: "Stop recording" }).count(),
      0,
    );
    await page
      .getByLabel("You may share this with the RCA school community")
      .check();
    await page
      .getByRole("button", { name: "Send voice note", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Your voice matters." })
      .waitFor({ timeout: 20000 });
    await page.goto(`${base}/feedback/${fixture.slug}`);
    await page
      .getByRole("heading", { name: "Thanks for weighing in." })
      .waitFor();
    await page.getByRole("button", { name: "I’m another parent" }).click();
    await page.getByRole("button", { name: "Let’s talk about it" }).waitFor();
  }
  await page.goto(`${base}/feedback/admin#invite=${fixture.token}`);
  await page
    .getByRole("heading", { name: "Make room for every voice." })
    .waitFor();
  assert.equal(new URL(page.url()).hash, "");
  const eventCard = page
    .locator("article")
    .filter({ has: page.locator(`a[href="/feedback/${fixture.slug}"]`) });
  await eventCard.getByRole("button", { name: "View results" }).click();
  await page.getByRole("heading", { name: "Listen. Learn. Build." }).waitFor();
  await page
    .getByRole("button", { name: "Listen", exact: true })
    .first()
    .click();
  await page.locator("audio").waitFor();
  await page.locator("audio").evaluate((el) => el.play());
  await page.waitForTimeout(500);
  assert.equal(
    await page
      .locator("audio")
      .evaluate((el) => el.error === null && !el.paused),
    true,
  );
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export responses as CSV" }).click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /feedback\.csv$/);
  await page.getByRole("button", { name: "All surveys" }).click();
  await eventCard
    .getByRole("button", { name: "Duplicate", exact: true })
    .click();
  await page
    .getByLabel("Survey link")
    .fill("draft-" + Date.now() + "-" + fixture.slug);
  await page
    .getByLabel("Offer optional Voices of RCAP after submission")
    .uncheck();
  assert.equal(
    await page
      .getByRole("button", { name: "Publish survey", exact: true })
      .isDisabled(),
    true,
  );
  await page
    .getByRole("button", { name: "Preview survey", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Publish survey", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Make room for every voice." })
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: mobile six-question flow, validation, retry ID, 30-second recording, redo, consent, real audio upload/playback, duplicate guard, organizer results, CSV, preview and publish.",
  );
} catch (e) {
  await page.screenshot({
    path: "../feedback-browser-failure.png",
    fullPage: true,
  });
  console.log(await page.locator("body").innerText());
  throw e;
} finally {
  await browser.close();
}
