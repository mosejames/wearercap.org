import { chromium } from "playwright";
import assert from "node:assert/strict";
import sharp from "sharp";
const browser = await chromium.launch({
  headless: true,
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const base = process.env.BOO_TEST_BASE || "http://127.0.0.1:5181";
const output = "/tmp/boo-review";
await import("node:fs/promises").then((fs) =>
  fs.mkdir(output, { recursive: true }),
);
const sample = await sharp({
  create: { width: 400, height: 600, channels: 3, background: "#334f76" },
})
  .composite([
    {
      input: Buffer.from(
        '<svg width="400" height="600"><text x="200" y="270" text-anchor="middle" font-size="40" fill="#ffdf83">FICTIONAL</text><text x="200" y="330" text-anchor="middle" font-size="30" fill="#ffffff">PHOTO</text></svg>',
      ),
    },
  ])
  .jpeg()
  .toBuffer();
for (const width of [390, 1280]) {
  const page = await browser.newPage({
    viewport: { width, height: 900 },
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/little-boo/");
  await page.getByRole("button", { name: "Take your place" }).waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({
    path: output + `/welcome-${width}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Take your place" }).click();
  await page.getByLabel("Mobile phone").fill("5550001234");
  await page.screenshot({ path: output + `/signin-${width}.png` });
  await page.getByRole("button", { name: "Close dialog" }).click();
  assert.deepEqual(errors, []);
  await page.close();
}
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce",
});
const userId = "a0000000-0000-4000-8000-000000000002";
let points = 0,
  submitted = false,
  hinted = false,
  uploads = 0,
  reported = false;
const photoId = "b0000000-0000-4000-8000-000000000001";
await page.addInitScript(
  ({ userId }) => {
    localStorage.setItem(
      "ami-vault-auth",
      JSON.stringify({
        access_token: "fictional-browser-session-for-testing-only",
        refresh_token: "fictional-refresh",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        token_type: "bearer",
        user: {
          id: userId,
          aud: "authenticated",
          role: "authenticated",
          phone: "15550001234",
        },
      }),
    );
  },
  { userId },
);
const me = { display: "Fictional Contestant", house: "Amistad", grade: "5th" };
await page.route("**/api/little-boo", async (route) => {
  const b = route.request().postDataJSON();
  if (b.action === "media")
    return route.fulfill({
      status: 200,
      contentType: "image/jpeg",
      body: sample,
    });
  let result = { ok: true };
  if (b.action === "get")
    result = {
      userId,
      me,
      isAdmin: true,
      settings: { closesAt: null, tieRule: "unsettled" },
      distinctChildren: 10,
      photos: [
        {
          id: photoId,
          own: false,
          correct: points > 0,
          points,
          hinted,
          submitted,
          choices: hinted
            ? [
                "Fictional Fable",
                "Invented Ivy",
                "Makebelieve Max",
                "Imaginary Iris",
              ]
            : null,
        },
      ],
      board: {
        individual: points
          ? [{ id: userId, ...me, points, identified: 1 }]
          : [],
        house: points ? [{ label: "Amistad", points }] : [],
        grade: points ? [{ label: "5th", points }] : [],
      },
      notifications: [],
    };
  if (b.action === "hint") {
    hinted = true;
    result = {
      choices: [
        "Fictional Fable",
        "Invented Ivy",
        "Makebelieve Max",
        "Imaginary Iris",
      ],
    };
  }
  if (b.action === "guess") {
    assert.equal(submitted, false);
    submitted = true;
    points = hinted ? 1 : 5;
    result = { correct: true, points };
  }
  if (b.action === "upload") {
    assert.equal(b.consent, true);
    assert.ok(b.image.length > 100);
    assert.equal(b.name, "Fictional New Boo");
    uploads++;
  }
  if (b.action === "report") {
    reported = true;
    assert.equal(b.reason, "Fictional test concern");
  }
  if (b.action === "admin")
    result = {
      reports: [],
      settings: { timezone: "America/New_York", tie_rule: "unsettled" },
      awards: null,
    };
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(result),
  });
});
await page.goto(base + "/little-boo/");
await page.getByRole("button", { name: /Who could it be/ }).click();
await page.getByRole("button", { name: /A little help/ }).click();
await page
  .getByRole("button", { name: "Fictional Fable", exact: true })
  .click();
await page.getByRole("button", { name: "Review my guess" }).click();
await page.getByRole("button", { name: "Yes, lock it in" }).click();
await page.getByText("Identified! You earned 1 points.").waitFor();
await page.screenshot({ path: output + "/correct-mobile.png", fullPage: true });
await page.getByRole("button", { name: "Close dialog" }).click();
await page.reload();
await page.getByRole("button", { name: /1 points/ }).waitFor();
assert.equal(submitted, true);
await page.getByRole("button", { name: /1 points/ }).click();
await page.getByRole("button", { name: "Report photo" }).click();
await page
  .getByLabel("What should the organizer know?")
  .fill("Fictional test concern");
await page.getByRole("button", { name: "Send report" }).click();
assert.equal(reported, true);
await page.getByRole("button", { name: "Add my child’s photo" }).click();
await page
  .locator("input[type=file]")
  .setInputFiles({
    name: "fictional-photo.jpg",
    mimeType: "image/jpeg",
    buffer: sample,
  });
await page.getByLabel("Full name, kept private").fill("Fictional New Boo");
await page.getByLabel("Accepted nicknames").fill("Boo");
await page.locator("input[name=consent]").check();
await page.screenshot({ path: output + "/upload-mobile.png", fullPage: true });
await page.getByRole("button", { name: "Put my mystery on the board" }).click();
await page.getByText("Your mystery is on the board.").waitFor();
assert.equal(uploads, 1);
await page.getByRole("button", { name: "Leaderboards", exact: true }).click();
await page.getByText("Fictional Contestant", { exact: true }).waitFor();
await page.screenshot({
  path: output + "/leaderboard-mobile.png",
  fullPage: true,
});
assert.equal(
  await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  false,
);
await page.getByRole("button", { name: "Organizer desk" }).click();
await page.getByText("Keep the show kind.").waitFor();
await page.screenshot({ path: output + "/admin-mobile.png", fullPage: true });
await browser.close();
console.log(
  "PASS: 390px and 1280px layouts, sign-in form, hint before commit, 1-point result, refresh persistence, reporting, branded upload, leaderboard and admin. Browser backend uses fictional fixtures.",
);
