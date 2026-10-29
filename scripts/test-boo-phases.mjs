import { chromium } from "playwright";
import assert from "node:assert/strict";
import sharp from "sharp";
import fs from "node:fs/promises";
import { phaseFixture } from "./boo-browser-fixtures.mjs";
const base = process.env.BOO_TEST_BASE || "http://127.0.0.1:5181",
  output = "/tmp/boo-phase-review";
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const uid = "a0000000-0000-4000-8000-000000000002",
  own = "b0000000-0000-4000-8000-000000000001",
  other = "b0000000-0000-4000-8000-000000000002";
const image = await sharp({
  create: { width: 500, height: 300, channels: 3, background: "#304f70" },
})
  .jpeg()
  .toBuffer();
async function fixture(phase, width = 390, signedIn = false, admin = false) {
  const page = await browser.newPage({
      viewport: { width, height: 844 },
      reducedMotion: "reduce",
    }),
    state = {
      phase,
      published: false,
      optedIn: false,
      posts: [],
      guessPoints: 0,
      uploadPoints: signedIn ? 3 : 0,
      uploads: signedIn ? 1 : 0,
      authRequests: 0,
      draws: 0,
    };
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  if (signedIn)
    await page.addInitScript(
      ({ uid }) =>
        localStorage.setItem(
          "ami-vault-auth",
          JSON.stringify({
            access_token: "fictional-phase-browser-session-only",
            refresh_token: "fictional-refresh",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            expires_in: 3600,
            token_type: "bearer",
            user: {
              id: uid,
              aud: "authenticated",
              role: "authenticated",
              phone: "15550001234",
            },
          }),
        ),
      { uid },
    );
  await page.route("**/auth/v1/**", (r) => {
    state.authRequests++;
    return r.fulfill({
      status: 400,
      json: { msg: "No real authentication in fixture." },
    });
  });
  await page.route("**/api/little-boo**", async (r) => {
    if (r.request().method() === "GET")
      return r.fulfill({
        status: 200,
        json: phaseFixture(state.phase, state.published),
      });
    const b = r.request().postDataJSON();
    state.posts.push(b);
    if (b.action === "media")
      return r.fulfill({ status: 200, contentType: "image/jpeg", body: image });
    let result = { ok: true };
    if (b.action === "get")
      result = {
        userId: uid,
        me: {
          display: "Fictional Phase Player",
          house: "Amistad",
          grade: "5th",
        },
        isAdmin: admin,
        phase: phaseFixture(state.phase, state.published),
        settings: {
          closesAt: phaseFixture(state.phase).guessesCloseAt,
          tieRule: "drawing",
        },
        openingNotice: {
          optedIn: state.optedIn,
          deliveryState: "not_scheduled",
        },
        distinctChildren: 10,
        photos: [
          ...(state.uploads
            ? [
                {
                  id: own,
                  own: true,
                  canRemove: true,
                  points: 0,
                  submitted: false,
                },
              ]
            : []),
          ...(["guessing", "closed", "results"].includes(state.phase)
            ? [
                {
                  id: other,
                  own: false,
                  canRemove: false,
                  points: state.guessPoints,
                  correct: state.guessPoints > 0,
                  submitted: state.guessPoints > 0,
                  hinted: false,
                },
              ]
            : []),
        ],
        board: {
          individual:
            state.uploadPoints + state.guessPoints
              ? [
                  {
                    id: uid,
                    display: "Fictional Phase Player",
                    house: "Amistad",
                    grade: "5th",
                    points: state.uploadPoints + state.guessPoints,
                    uploadPoints: state.uploadPoints,
                    guessPoints: state.guessPoints,
                    identified: state.guessPoints ? 1 : 0,
                    contributions: state.uploads,
                  },
                ]
              : [],
          house: [],
          grade: [],
        },
        notifications: [],
        awards: state.published
          ? [
              {
                playerId: uid,
                display: "Fictional Phase Player",
                rank: 1,
                tickets: 25,
              },
            ]
          : null,
      };
    if (b.action === "opening-notice") {
      state.optedIn = b.optedIn;
      result = { optedIn: state.optedIn, deliveryState: "not_scheduled" };
    }
    if (b.action === "upload") {
      assert.equal(state.phase, "submissions");
      assert.equal(b.consent, true);
      state.uploads++;
      state.uploadPoints += 3;
      result = { ok: true, uploadBonus: 3 };
    }
    if (b.action === "guess") {
      assert.equal(state.phase, "guessing");
      state.guessPoints = 5;
      result = { correct: true, points: 5 };
    }
    if (b.action === "remove") {
      state.uploads = 0;
      state.uploadPoints = 0;
    }
    if (b.action === "admin")
      result = {
        reports: [],
        openingNoticeRequests: state.optedIn ? 1 : 0,
        settings: {
          closes_at: phaseFixture(state.phase).guessesCloseAt,
          timezone: "America/New_York",
          tie_rule: "drawing",
          finalized_at: "2026-11-01T06:00:00Z",
        },
        awards: [
          {
            playerId: uid,
            display: "Fictional Phase Player",
            points: 8,
            rank: 1,
            drawingRequired: state.draws === 0,
            tickets: state.draws ? 25 : null,
            eligiblePlacements: state.draws
              ? []
              : [
                  { place: 1, tickets: 25 },
                  { place: 2, tickets: 15 },
                ],
          },
          {
            playerId: "a0000000-0000-4000-8000-000000000003",
            display: "Fictional Tied Player",
            points: 8,
            rank: 1,
            drawingRequired: state.draws === 0,
            tickets: state.draws ? 15 : null,
            eligiblePlacements: state.draws
              ? []
              : [
                  { place: 1, tickets: 25 },
                  { place: 2, tickets: 15 },
                ],
          },
        ],
      };
    if (b.action === "drawing-results") {
      assert.equal(b.confirmed, true);
      assert.equal(b.placements.length, 2);
      state.draws++;
    }
    return r.fulfill({ status: 200, json: result });
  });
  await page.goto(base + "/little-boo/");
  await page.locator(".phase-pill").waitFor();
  return { page, state, errors };
}
for (const width of [390, 1280]) {
  const { page, state, errors } = await fixture("submissions", width);
  assert.equal(
    await page
      .getByRole("button", { name: "Add your kid", exact: true })
      .count(),
    1,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Guess a kid", exact: true })
      .count(),
    0,
  );
  await page
    .getByText("One photo per student. Siblings welcome.", { exact: true })
    .waitFor();
  await page
    .getByText("Earn 3 contribution points.", { exact: true })
    .waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({
    path: output + `/submission-${width}.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "How points and prizes work" })
    .click();
  await page.getByRole("dialog").waitFor();
  await page.getByText(/Each player scores once per photo/).waitFor();
  await page.getByRole("button", { name: "Close dialog" }).click();
  assert.equal(state.posts.length, 0);
  assert.equal(state.authRequests, 0);
  assert.deepEqual(errors, []);
  await page.close();
}
for (const phase of ["waiting", "guessing", "closed", "results"]) {
  const { page, state, errors } = await fixture(phase);
  assert.equal(
    await page
      .getByRole("button", { name: "Add your kid", exact: true })
      .count(),
    0,
  );
  if (phase === "waiting") {
    await page.getByLabel("Time until guessing opens").waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Guess a kid", exact: true })
        .count(),
      0,
    );
  } else if (phase === "guessing") {
    assert.equal(
      await page
        .getByRole("button", { name: "Guess a kid", exact: true })
        .count(),
      1,
    );
    await page
      .getByRole("button", { name: "Guess a kid", exact: true })
      .click();
    await page.getByLabel("Mobile phone").waitFor();
  } else
    await page
      .getByRole("button", { name: "See provisional standings" })
      .waitFor();
  await page.screenshot({
    path: output + `/${phase}-mobile.png`,
    fullPage: true,
  });
  assert.equal(state.authRequests, 0);
  assert.deepEqual(errors, []);
  await page.close();
}
// Signed-in receipt transparency, bounded consent, no auto-SMS, and boundary recovery.
{
  const { page, state, errors } = await fixture("submissions", 390, true);
  await page
    .getByText("0 guess points · 3 contribution points", { exact: true })
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: /Who could it be/ }).count(),
    0,
  );
  await page.getByText("Want one opening text?", { exact: true }).click();
  const checkbox = page.getByRole("checkbox", { name: /I’d like one text/ });
  assert.equal(await checkbox.isChecked(), false);
  await checkbox.check();
  await page
    .getByRole("button", { name: "Save my request", exact: true })
    .click();
  await page.getByText("Opening-text request saved", { exact: true }).waitFor();
  assert.equal(state.optedIn, true);
  assert.equal(state.authRequests, 0);
  assert.equal(
    await page
      .getByRole("button", { name: "Save my request", exact: true })
      .isDisabled(),
    true,
  );
  await checkbox.uncheck();
  await page
    .getByRole("button", { name: "Withdraw my request", exact: true })
    .click();
  await page.getByText("Want one opening text?", { exact: true }).waitFor();
  assert.equal(state.optedIn, false);
  assert.deepEqual(
    state.posts
      .filter((x) => x.action === "opening-notice")
      .map((x) => x.optedIn),
    [true, false],
  );
  await page.getByRole("button", { name: "Add your kid", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "fictional-sibling.jpg",
    mimeType: "image/jpeg",
    buffer: image,
  });
  await page.getByLabel("Your child’s full name").fill("Fictional Sibling");
  await page.locator("input[name=consent]").check();
  assert.equal(state.uploadPoints, 3);
  await page
    .getByRole("button", { name: "Add to the board", exact: true })
    .click();
  await page
    .getByText("0 guess points · 6 contribution points", { exact: true })
    .waitFor();
  assert.equal(state.uploadPoints, 6);
  await page.getByText(/Your student is in! \+3 contribution points/).waitFor();
  await page.getByRole("button", { name: "Add your kid", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "fictional-cutoff.jpg",
    mimeType: "image/jpeg",
    buffer: image,
  });
  await page.getByAltText("Your selected Halloween photo").waitFor();
  state.phase = "waiting";
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page
    .getByText("Photo submissions have closed.", { exact: true })
    .waitFor();
  assert.equal(
    await page.getByAltText("Your selected Halloween photo").count(),
    1,
  );
  assert.equal(state.uploadPoints, 6);
  await page.getByRole("button", { name: "See opening time" }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "Add your kid", exact: true })
      .count(),
    0,
  );
  state.phase = "guessing";
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page
    .getByRole("button", { name: "Guess a kid", exact: true })
    .waitFor();
  await page.getByRole("button", { name: /Who could it be/ }).waitFor();
  await page.getByRole("button", { name: /Who could it be/ }).click();
  await page.getByLabel("Your one guess").fill("Fictional Other Student");
  await page.getByRole("button", { name: "Review my guess" }).click();
  await page.getByRole("button", { name: "Yes, lock it in" }).click();
  await page.getByText("Identified! You earned 5 points.").waitFor();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByText("5 guess points · 6 contribution points", { exact: true })
    .waitFor();
  assert.equal(state.authRequests, 0);
  assert.deepEqual(errors, []);
  await page.close();
}
// Organizer records actual tie outcomes; neither drawing nor tickets happen automatically.
{
  const { page, state, errors } = await fixture("results", 390, true, true);
  await page.getByRole("button", { name: "Organizer desk" }).click();
  await page
    .getByText("Record the organizer’s drawing", { exact: true })
    .waitFor();
  assert.equal(state.draws, 0);
  await page.locator("select[name=place-1]").selectOption(uid);
  await page
    .locator("select[name=place-2]")
    .selectOption("a0000000-0000-4000-8000-000000000003");
  await page
    .getByRole("checkbox", { name: /I conducted the organizer drawing/ })
    .check();
  await page
    .getByRole("button", { name: "Record drawing results for review" })
    .click();
  await page
    .getByText("Record the organizer’s drawing", { exact: true })
    .waitFor({ state: "hidden" });
  assert.equal(state.draws, 1);
  assert.equal(state.authRequests, 0);
  assert.deepEqual(errors, []);
  await page.close();
}
await browser.close();
console.log(
  "PASS: submission-only landing and sibling +3, waiting/guessing/closed/Sunday screens, single phase actions, protected pre-open board, separate score sources, optional consent/withdrawal without SMS, client boundary changes retaining draft, automatic board refresh at opening and manual organizer drawing UI at mobile/desktop widths. Fictional fixtures only.",
);
