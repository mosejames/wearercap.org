// Read the live definition, but intercept submissions: this test never stores answers or audio.
import { chromium } from "playwright";
import assert from "node:assert/strict";
const base = process.env.FEEDBACK_BASE || "http://127.0.0.1:5180";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
  ],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  permissions: ["microphone"],
});
const page = await context.newPage();
page.setDefaultTimeout(12000);
const cdp = await context.newCDPSession(page);
let saved;
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("**/rest/v1/rpc/rcap_feedback", async (route) => {
  const data = route.request().postDataJSON();
  if (data.p_action === "submit") {
    saved = data.p_payload;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: '{"saved":true}',
    });
    return;
  }
  if (data.p_action.startsWith("voice"))
    throw new Error("This test must not upload audio");
  await route.continue();
});
async function drag(slider, n) {
  await slider.scrollIntoViewIfNeeded();
  const b = await slider.boundingBox();
  const start = b.x + 24 + (b.width - 48) * 0.75;
  const end = b.x + 24 + ((b.width - 48) * (n - 1)) / 4;
  const y = b.y + b.height / 2;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: start, y }],
  });
  for (let i = 1; i <= 8; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: start + ((end - start) * i) / 8, y }],
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  assert.equal(await slider.inputValue(), String(n));
}
try {
  await page.goto(`${base}/feedback/rb-karaoke`);
  await page.getByRole("button", { name: "Let’s talk about it" }).waitFor();
  await page.screenshot({
    path: "../feedback-revised-intro.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Let’s talk about it" }).click();
  const overall = page.getByRole("slider", {
    name: "How was your night?",
    exact: true,
  });
  assert.equal(await overall.inputValue(), "4");
  await page.getByRole("button", { name: "Next →", exact: true }).click();
  await page.getByRole("alert").waitFor();
  await drag(overall, 1);
  await drag(overall, 5);
  await drag(overall, 4);
  await page.screenshot({
    path: "../feedback-revised-slider.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Next →", exact: true }).click();
  assert.equal(await page.getByRole("slider").count(), 5);
  assert.equal(await page.getByText("Photo booth", { exact: true }).count(), 0);
  await page.getByRole("button", { name: "Next →", exact: true }).click();
  await page.getByRole("alert").waitFor();
  for (const label of [
    "Food",
    "DJ / hosting",
    "Karaoke",
    "Dancing / party portion",
  ])
    await drag(page.getByRole("slider", { name: label, exact: true }), 4);
  await page
    .locator("fieldset")
    .filter({
      has: page.locator("legend", {
        hasText: "The atmosphere & community feel",
      }),
    })
    .getByRole("button", { name: "Didn’t try / Not applicable" })
    .click();
  await page.getByRole("button", { name: "Next →", exact: true }).click();
  await page.getByRole("button", { name: "Next →", exact: true }).click();
  await page.getByRole("alert").waitFor();
  await page
    .getByRole("button", { name: "Somewhat easy. I connected a little." })
    .click();
  await page.getByRole("button", { name: "Next →", exact: true }).click();
  await page
    .getByRole("button", { name: "More places to sit or gather" })
    .click();
  await page.getByRole("button", { name: "Next →", exact: true }).click();
  await page.getByRole("button", { name: "Game or trivia night" }).click();
  await page.getByRole("button", { name: "A relaxed meal together" }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "Other", exact: false })
      .isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "Next →", exact: true }).click();
  await page.getByRole("button", {name:"Just right", exact:true}).click();
  await page.getByRole("button", {name:"Next →", exact:true}).click();
  await page.getByRole("button", {name:"GroupMe", exact:true}).click();
  await page.getByRole("button", {name:"Email", exact:true}).click();
  await page.getByRole("button", {name:"Next →", exact:true}).click();
  await page
    .getByRole("button", { name: "Send feedback", exact: true })
    .click();
  await page.getByRole("heading", { name: "Better, together." }).waitFor();
  assert.equal(saved.answers.enjoyment, 4);
  assert.equal(saved.answers.experiences.food, 4);
  assert.equal(saved.answers.experiences.atmosphere, "na");
  assert.equal(saved.answers.connection_help, "gathering");
  await page.getByRole("button", { name: "Leave a voice note" }).click();
  await page
    .getByText("When you tap Record, your phone or browser may ask", {
      exact: false,
    })
    .waitFor();
  await page.screenshot({
    path: "../feedback-revised-voice.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Record a voice note" }).click();
  await page.getByRole("button", { name: "Stop recording" }).waitFor();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Stop recording" }).click();
  await page.locator("audio").waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Send voice note", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.goto(`${base}/feedback/rb-karaoke`);
  await page
    .getByRole("heading", { name: "Thanks for weighing in." })
    .waitFor();
  const desktop = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  await desktop.goto(`${base}/feedback/rb-karaoke`);
  await desktop.getByRole("button", { name: "Let’s talk about it" }).click();
  const ds = desktop.getByRole("slider", {
    name: "How was your night?",
    exact: true,
  });
  await ds.press("Home");
  assert.equal(await ds.inputValue(), "1");
  await ds.press("End");
  assert.equal(await ds.inputValue(), "5");
  await desktop.getByRole("button", { name: "Next →", exact: true }).click();
  await desktop.getByRole("heading", { name: "What did you enjoy?" }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: native finger dragging 1–5, untouched defaults blocked, tap confirmation, keyboard access, eight revised questions, microphone guidance, recording/playback and consent. No data stored.",
  );
} finally {
  await browser.close();
}
