import { phaseFixture } from "./boo-browser-fixtures.mjs";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import sharp from "sharp";
import fs from "node:fs/promises";
const base = process.env.BOO_TEST_BASE || "http://127.0.0.1:5181";
const output = "/tmp/boo-onboarding-review";
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const portrait = await sharp({
  create: { width: 450, height: 300, channels: 3, background: "#235378" },
})
  .jpeg()
  .withMetadata({ orientation: 6 })
  .toBuffer();
const landscape = await sharp({
  create: { width: 600, height: 300, channels: 3, background: "#5a4c32" },
})
  .jpeg()
  .toBuffer();
const photoId = "b0000000-0000-4000-8000-000000000001",
  uid = "a0000000-0000-4000-8000-000000000002";
const user = {
  id: uid,
  aud: "authenticated",
  role: "authenticated",
  phone: "15550001234",
  phone_confirmed_at: "2026-01-01T00:00:00Z",
  app_metadata: { provider: "phone", providers: ["phone"] },
  user_metadata: {},
};
const jwt = () =>
  [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({
        sub: uid,
        aud: "authenticated",
        role: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url"),
    "fictional-signature",
  ].join(".");
async function fixture(width = 390, currentPhase = "submissions") {
  const page = await browser.newPage({
    viewport: { width, height: 844 },
    reducedMotion: "reduce",
  });
  const state = {
    phase: currentPhase,
    optedIn: false,
    otp: 0,
    verify: 0,
    profiles: [],
    uploadCalls: 0,
    uploaded: 0,
    actions: [],
    me: null,
    wrongCode: false,
    getFail: false,
    upload401: false,
    points: 0,
    submitted: false,
  };
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (dialog) => dialog.accept());
  await page.route("**/auth/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/otp")) {
      state.otp++;
      return route.fulfill({ status: 200, json: {} });
    }
    if (url.pathname.endsWith("/verify")) {
      state.verify++;
      if (state.wrongCode) {
        state.wrongCode = false;
        return route.fulfill({
          status: 400,
          json: { code: "otp_expired", msg: "Wrong code. Try again." },
        });
      }
      return route.fulfill({
        status: 200,
        json: {
          access_token: jwt(),
          refresh_token: "fictional-refresh-token",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          token_type: "bearer",
          user,
        },
      });
    }
    if (url.pathname.endsWith("/user"))
      return route.fulfill({ status: 200, json: user });
    return route.fulfill({ status: 200, json: {} });
  });
  await page.route("**/api/little-boo**", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ status: 200, json: phaseFixture(state.phase) });
    const b = route.request().postDataJSON();
    state.actions.push(b.action);
    if (b.action === "media")
      return route.fulfill({
        status: 200,
        contentType: "image/jpeg",
        body: landscape,
      });
    let result = { ok: true };
    if (b.action === "get" && state.getFail) {
      state.getFail = false;
      return route.fulfill({
        status: 503,
        json: { error: "Temporary fictional account loading failure." },
      });
    }
    if (b.action === "get")
      result = {
        userId: uid,
        me: state.me,
        isAdmin: false,
        settings: {
          closesAt: phaseFixture(state.phase).guessesCloseAt,
          tieRule: "drawing",
        },
        phase: phaseFixture(state.phase),
        openingNotice: {
          optedIn: state.optedIn,
          deliveryState: "not_scheduled",
        },
        distinctChildren: 10,
        photos: [
          ...(state.phase === "guessing"
            ? [
                {
                  id: photoId,
                  own: false,
                  points: state.points,
                  correct: state.points > 0,
                  submitted: state.submitted,
                  hinted: false,
                },
              ]
            : []),
          ...(state.uploaded
            ? [
                {
                  id: "b0000000-0000-4000-8000-000000000003",
                  own: true,
                  canRemove: true,
                  points: 0,
                  correct: false,
                  submitted: false,
                  hinted: false,
                },
              ]
            : []),
        ],
        board: {
          individual: state.uploaded
            ? [
                {
                  id: uid,
                  display: state.me?.display || "Boo Player 000002",
                  house: state.me?.house || "Amistad",
                  grade: state.me?.grade || "5th",
                  points: state.uploaded * 3 + state.points,
                  guessPoints: state.points,
                  uploadPoints: state.uploaded * 3,
                  identified: state.points ? 1 : 0,
                  contributions: state.uploaded,
                },
              ]
            : [],
          house: [],
          grade: [],
        },
        notifications: [],
      };
    if (b.action === "profile") {
      state.profiles.push(b);
      state.me = { display: b.display, house: b.house, grade: b.grade };
      await new Promise((r) => setTimeout(r, 100));
    }
    if (b.action === "upload") {
      state.uploadCalls++;
      if (state.upload401) {
        state.upload401 = false;
        return route.fulfill({
          status: 401,
          json: { error: "Please sign in with your phone." },
        });
      }
      assert.equal(b.consent, true);
      assert.equal(state.me?.display, "Boo Player 000002");
      assert.ok(b.image);
      state.uploaded++;
      result = { ok: true, uploadBonus: 3 };
    }
    if (b.action === "opening-notice") {
      state.optedIn = b.optedIn;
      result = { optedIn: b.optedIn, deliveryState: "not_scheduled" };
    }
    if (b.action === "guess") {
      assert.equal(state.submitted, false);
      state.submitted = true;
      state.points = 5;
      result = { correct: true, points: 5 };
    }
    return route.fulfill({ status: 200, json: result });
  });
  await page.goto(base + "/little-boo/");
  await page
    .getByRole("button", {
      name: currentPhase === "submissions" ? "Add your kid" : "Guess a kid",
      exact: true,
    })
    .first()
    .waitFor();
  return { page, state, errors };
}
async function pick(page, buffer = portrait, name = "fictional-old-photo.jpg") {
  await page
    .locator("input[type=file]")
    .setInputFiles({ name, mimeType: "image/jpeg", buffer });
  await page.getByAltText("Your selected Halloween photo").waitFor();
}
async function otp(page) {
  await page.getByLabel("Mobile phone").fill("5550001234");
  await page
    .getByRole("button", { name: "Text me a sign-in code", exact: true })
    .click();
  await page.getByLabel("Six-digit code").fill("123456");
  await page.getByRole("button", { name: "Verify & continue" }).click();
}
// Photo-first, interrupted OTP, local privacy, repeated taps, re-auth and cleanup.
{
  const { page, state, errors } = await fixture();
  await page.clock.install();
  assert.equal(
    await page.locator(".boo-brand img").getAttribute("src"),
    "/brand/we-are-rcap-reversed.svg",
  );
  await page
    .getByRole("button", { name: "Add your kid", exact: true })
    .first()
    .click();
  assert.equal(
    await page.locator("input[type=file]").getAttribute("accept"),
    "image/*",
  );
  assert.equal(
    await page.locator("input[type=file]").getAttribute("capture"),
    null,
  );
  await pick(page);
  const dims = await page
    .getByAltText("Your selected Halloween photo")
    .evaluate((i) => [i.naturalWidth, i.naturalHeight]);
  assert.deepEqual(dims, [300, 450]);
  assert.deepEqual(state.actions, []);
  assert.equal(await page.getByLabel("Your child’s full name").count(), 0);
  // A canceled replacement picker must not erase the current selection.
  await page.locator("input[type=file]").evaluate((el) => {
    el.value = "";
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  assert.equal(
    await page.getByAltText("Your selected Halloween photo").count(),
    1,
  );
  await page.getByRole("button", { name: "Keep this photo & sign in" }).click();
  await page.getByAltText("Your selected Halloween photo").waitFor();
  await page.getByLabel("Mobile phone").fill("5550001234");
  await page
    .getByRole("button", { name: "Text me a sign-in code", exact: true })
    .evaluate((b) => {
      b.click();
      b.click();
    });
  await page.getByLabel("Six-digit code").waitFor();
  assert.equal(state.otp, 1);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("button", { name: "Continue adding", exact: true })
    .click();
  await page.getByRole("button", { name: "Keep this photo & sign in" }).click();
  assert.equal(
    await page.getByLabel("Mobile phone").inputValue(),
    "5550001234",
  );
  await page.getByLabel("Six-digit code").waitFor();
  await page
    .getByRole("button", { name: "Change phone or request another code" })
    .click();
  assert.equal(
    await page
      .getByRole("button", { name: /Request another code in/ })
      .isDisabled(),
    true,
  );
  await page.clock.fastForward(61000);
  await page
    .getByRole("button", { name: "Text me a sign-in code", exact: true })
    .click();
  assert.equal(state.otp, 2);
  state.wrongCode = true;
  await page.getByLabel("Six-digit code").fill("000000");
  await page.getByRole("button", { name: "Verify & continue" }).click();
  await page.getByText("Wrong code. Try again.").first().waitFor();
  assert.equal(
    await page.getByAltText("Your selected Halloween photo").count(),
    1,
  );
  assert.equal(state.uploaded, 0);
  const another = await browser.newPage();
  await another.goto("about:blank");
  await page.bringToFront();
  await another.close();
  state.getFail = true;
  await page.getByLabel("Six-digit code").fill("123456");
  await page.getByRole("button", { name: "Verify & continue" }).click();
  await page
    .getByRole("button", { name: "Retry loading your account" })
    .waitFor();
  await page
    .getByRole("button", { name: "Retry loading your account" })
    .click();
  await page.getByLabel("Your child’s full name").waitFor();
  assert.equal(state.profiles.length, 0);
  assert.equal(state.uploaded, 0);
  assert.equal(
    await page.getByAltText("Your selected Halloween photo").count(),
    1,
  );
  await page.getByLabel("Your child’s full name").fill("Fictional New Boo");
  await page.locator("select[name=house]").selectOption("Amistad");
  await page.locator("select[name=grade]").selectOption("5th");
  await page.getByRole("button", { name: /Add a nickname/ }).click();
  await page
    .getByLabel("Nicknames or familiar first-name forms")
    .fill("Fictional Boo");
  await page.locator("input[name=consent]").check();
  const stored = await page.evaluate(() =>
    JSON.stringify(Object.fromEntries(Object.entries(sessionStorage))),
  );
  assert.doesNotMatch(stored, /Fictional|555000|base64|image\/jpeg/);
  await page.screenshot({
    path: output + "/photo-first-details-mobile.png",
    fullPage: true,
  });
  // Expired session cannot post and must retain both photo and identity fields.
  state.upload401 = true;
  await page
    .getByRole("button", { name: "Add to the board", exact: true })
    .click();
  await page.getByLabel("Six-digit code").waitFor();
  assert.equal(state.uploaded, 0);
  await page.getByRole("button", { name: "Verify & continue" }).click();
  await page.getByLabel("Your child’s full name").waitFor();
  assert.equal(
    await page.getByLabel("Your child’s full name").inputValue(),
    "Fictional New Boo",
  );
  assert.equal(await page.locator("input[name=consent]").isChecked(), true);
  await page
    .getByRole("button", { name: "Add to the board", exact: true })
    .evaluate((b) => {
      b.click();
      b.click();
    });
  await page.getByText(/Your student is in!/).waitFor();
  assert.equal(state.uploaded, 1);
  assert.equal(state.profiles.length, 1);
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem("rcap-boo-journey-v1")),
    null,
  );
  assert.equal(
    await page.getByAltText("Your selected Halloween photo").count(),
    0,
  );
  assert.deepEqual(errors, []);
  await page.screenshot({
    path: output + "/after-upload-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Add your kid", exact: true })
    .first()
    .click();
  await pick(page, landscape);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page
    .getByRole("button", { name: "Add your kid", exact: true })
    .waitFor();
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem("rcap-boo-journey-v1")),
    null,
  );
  assert.equal(
    await page.getByText("Your photo is still here.", { exact: true }).count(),
    0,
  );
  assert.equal(state.uploaded, 1);
  await page.close();
}
// Landscape, loading/error recovery, tab restart and no persistent child data.
{
  const { page, state, errors } = await fixture();
  await page
    .getByRole("button", { name: "Add your kid", exact: true })
    .first()
    .click();
  await pick(page, landscape);
  assert.deepEqual(
    await page
      .getByAltText("Your selected Halloween photo")
      .evaluate((i) => [i.naturalWidth, i.naturalHeight]),
    [600, 300],
  );
  await page.getByRole("button", { name: "Keep this photo & sign in" }).click();
  await page.getByRole("button", { name: "Back to your photo" }).click();
  await page.getByAltText("Your selected Halloween photo").waitFor();
  await page.reload();
  await page
    .getByText("Your tab restarted. For privacy, the photo wasn’t saved.")
    .waitFor();
  assert.equal(
    await page.getByAltText("Your selected Halloween photo").count(),
    0,
  );
  assert.equal(state.uploaded, 0);
  await pick(page, landscape);
  await page.getByRole("button", { name: "Remove selected photo" }).click();
  assert.equal(
    await page.getByAltText("Your selected Halloween photo").count(),
    0,
  );
  await page.locator("input[type=file]").setInputFiles({
    name: "invalid.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg></svg>"),
  });
  await page.getByText("Choose a JPEG, PNG, WebP or HEIC photo.").waitFor();
  await pick(page, portrait);
  assert.equal(
    await page.getByText("Choose a JPEG, PNG, WebP or HEIC photo.").count(),
    0,
  );
  assert.deepEqual(errors, []);
  await page.close();
}
// Guess-first intent survives OTP and profile capture happens at the selected kid.
for (const width of [390, 1280]) {
  const { page, state, errors } = await fixture(width, "guessing");
  await page.screenshot({
    path: output + `/welcome-${width}.png`,
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.getByRole("button", { name: "Guess a kid", exact: true }).click();
  await otp(page);
  await page.getByRole("button", { name: /Who could it be/ }).waitFor();
  assert.equal(state.profiles.length, 0);
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.getByRole("button", { name: /Who could it be/ }).click();
  await page.getByText("Where should your points go?").waitFor();
  await page.locator("select[name=house]").selectOption("Reveur");
  await page.locator("select[name=grade]").selectOption("6th");
  await page
    .getByLabel("Your children’s full names, if any")
    .fill("Fictional Own Child");
  await page.getByRole("button", { name: "Continue to this guess" }).click();
  await page.getByLabel("Your one guess").waitFor();
  assert.equal(state.profiles[0].display, "Boo Player 000002");
  assert.deepEqual(state.profiles[0].ownNames, ["Fictional Own Child"]);
  await page.getByLabel("Your one guess").fill("Fictional Other Child");
  await page.getByRole("button", { name: "Review my guess" }).click();
  await page.getByRole("button", { name: "Yes, lock it in" }).click();
  await page.getByText("Identified! You earned 5 points.").waitFor();
  assert.deepEqual(errors, []);
  assert.equal(state.points, 5);
  await page.close();
}
await browser.close();
console.log(
  "PASS: photo-first local-only selection, portrait orientation, landscape, canceled picker, OTP cancel/back/error/retry/resend cooldown, background recovery, repeated taps, expired-session recovery, refresh/reselect disclosure, draft cleanup, real brand asset, and guess-first progressive setup at 390px/1280px. All identities and auth responses are fictional fixtures.",
);
