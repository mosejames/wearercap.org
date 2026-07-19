# RCAP Newsletter Design System

Extracted verbatim from `/Users/mosejames/Desktop/Claude/rcap-exp-newsletter/index.html`
(the "What to EXPECT at EXP" page, live at `wearercap.org/what-to-expect/`).

**Purpose:** reference for restyling the carpool React app (`wearercap.org/carpool`) so it
reads as the same product. Every value below is the real value from source. Where the source
is inconsistent or one-off, it is flagged with **⚠ FLAG** and a recommendation.

**Important context flag:** this page uses a warm-paper / cream editorial palette. In Mose's
global design system that aesthetic is normally fenced to civic-journalism work. This page is
the deliberate exception and it is the thing the carpool app must match — so follow *this*
document, not the general house rule, for anything under `wearercap.org`.

---

## 1. CSS Custom Properties

All declared on `:root`. Usage counts are actual `var()` references in the file.

| Token | Value | Refs | What it actually does |
|---|---|---|---|
| `--ink` | `#1a1613` | 16 | Primary text color. Also the fill for every dark section (masthead, EXPECT stack, pull quotes, feature CTA, footer), the numbered kicker badge, `.btn-dark` background, `.btn-ghost` border. The workhorse token. |
| `--ink-soft` | `#5a4f47` | 5 | Secondary/muted text on light surfaces: `.muted`, `.caption`, `.cta .ct-k`, `.closing .sig-role`, the "With gratitude," line. |
| `--paper` | `#faf4ea` | 14 | Primary light surface (`.wrap` background, `.letter`, `.cta-wrap`, `.closing`) AND the light text color used on top of `--ink` sections. Dual-purpose by design. |
| `--paper-2` | `#f1e6d4` | 5 | Secondary/recessed light surface: `.students` section, the hallway section, `.verbs` pills, `.note` box, `.photo` placeholder background. One step darker than `--paper`. |
| `--line` | `#e4d6c0` | 4 | The only border token on light surfaces: `.verbs span`, `.cta`, `.note`, `.rule` divider. |
| `--orange` | `#f26a1b` | 7 | The single accent color. Kicker labels, subhead labels, `.note .nk`, the hero kicker dot, the 16px rule before captions, the 18px rule before subheads, the bold word inside `.verbs` pills. Never a background. |
| `--magenta` | `#e0218a` | **0** | ⚠ FLAG — declared, never referenced. It exists only as a hardcoded literal inside `--grad`. |
| `--gold` | `#e8a516` | **0** | ⚠ FLAG — declared, never referenced. |
| `--blue` | `#1f55c0` | **0** | ⚠ FLAG — declared, never referenced. |
| `--red` | `#d8202d` | **0** | ⚠ FLAG — declared, never referenced. |
| `--green` | `#1f9d57` | **0** | ⚠ FLAG — declared, never referenced. |
| `--grad` | `linear-gradient(100deg,#f7a81c 0%,#f26a1b 42%,#e0218a 100%)` | 9 | The signature. Gold → orange → magenta at 100deg. See §3 and §6. |
| `--radius` | `16px` | 4 | The only radius token. Photos, CTA cards, `.note`. Pills use literal `999px`; lightbox image uses a one-off `10px`. |
| `--font-display` | `'Archivo',system-ui,sans-serif` | 12 | |
| `--font-body` | `'Archivo',system-ui,sans-serif` | 2 | Identical to `--font-display`. |
| `--font-quote` | `'Newsreader',Georgia,serif` | 5 | |

**⚠ FLAG — unused color tokens.** The five named hues (magenta/gold/blue/red/green) are dead
in this file. Two readings: they were a fuller palette that got cut, or they are reserved for
future use. For the carpool app: **do not invent uses for them.** If you need semantic status
colors (success/error/warning on forms), `--green #1f9d57` and `--red #d8202d` are the correct
values to activate, since they're already in the system's vocabulary. `--blue #1f55c0` is a
reasonable link/info color. Do not use `--gold` or `--magenta` standalone — they only read
correctly inside the gradient.

**⚠ FLAG — display and body fonts are the same token twice.** Keep both names (the semantic
split is useful) but know they resolve to Archivo either way. The display/body distinction is
carried entirely by **weight and letter-spacing**, not by family.

**Missing tokens you will need to add.** The source hardcodes a lot. There is no token for:
spacing, the dark-section muted grays, the page-gutter background `#cdbfa9`, the box-shadow,
or transition timing. Recommended additions for the React app in §9.

---

## 2. Typography

### Font loading — exact tag

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&family=Newsreader:ital,opsz,wght@1,18,400;1,18,500&display=swap" rel="stylesheet" />
```

Note the Newsreader axis spec: `ital,opsz,wght@1,18,400;1,18,500` — **italic only, optical
size 18, weights 400 and 500.** Roman Newsreader is not loaded. Newsreader is *only ever used
in italic* in this design. If you set it upright, you get a synthesized/fallback face. Treat
"Newsreader = italic" as a rule, not a coincidence.

### How Archivo's six weights are actually deployed

| Weight | Used for |
|---|---|
| **400** | Loaded but never explicitly set — it is the inherited default for body `<p>`, captions, `.cta p`, `.note p`. |
| **500** | Used exactly once: `.date-chips span.full i` (the "— Full" suffix on a sold-out date chip). Essentially a one-off. |
| **600** | Small caps-tracked metadata: `.brand-sub`, `.masthead .issue`, `.verbs span`, `.date-chips span`, `.closing .sig-role`, `.lb-hint`, `.view-online`. **This is the "metadata" weight.** |
| **700** | Two jobs: (a) `<strong>`, and (b) all caps-tracked *labels* — `.kicker`, `.hero .top-kicker`, `.expect .lead`, `.band .cap`, `.subhead .sh-k`, `.cta .ct-k`, `.note .nk`, `.pull .by`, `.dates b`, `footer` weight inherit. **This is the "label" weight.** |
| **800** | Mid-display: `h2`, `.cta h3`, `.btn` (all variants), `.closing .sig-name`, and `.verbs span b`. |
| **900** | Hero display only: `.brand-mark`, `.hero h1`, `.e-line`, `.kicker .num`, `.band .big`, `.pull .mark`, `.four span`, `footer .fmark`. **This is the "hero" weight.** |

The rule of thumb: **600 = metadata, 700 = label, 800 = heading/button, 900 = display.**

### Complete type scale

Every distinct combination in the file. `ls` = letter-spacing, `lh` = line-height.

#### Display / hero tier (Archivo 900, negative tracking, tight leading)

| Element | Size | Weight | ls | lh | Notes |
|---|---|---|---|---|---|
| `.hero .headline h1` | `clamp(34px,8.5vw,58px)` | 900 | `-.02em` | `.92` | UPPERCASE, `text-wrap:balance` |
| `.four span` | `clamp(32px,9vw,56px)` | 900 | `-.02em` | `.98` | UPPERCASE |
| `.e-line` (EXPECT stack) | `clamp(28px,7.4vw,46px)` | 900 | `-.02em` | `1.0` | UPPERCASE |
| `.band .big` | `clamp(44px,13vw,72px)` | 900 | `-.03em` | `.9` | The "1,000+" stat |
| `.band .big` (thank-you variant) | `clamp(30px,8vw,46px)` | 900 | `-.03em` | `.9` | ⚠ inline override |
| `.pull .mark` (the `"`) | `54px` | 900 | — | `.6` | Gradient-clipped quote mark |
| `.brand-mark` | `22px` | 900 | `.06em` | `1` | *Positive* tracking — the only 900 that tracks out |
| `footer .fmark` | `20px` | 900 | `.05em` | — | Same treatment as brand-mark |
| `.kicker .num` | `12px` | 900 | `0` | — | Explicitly resets ls to 0 inside a tracked parent |

#### Heading tier (Archivo 800)

| Element | Size | Weight | ls | lh |
|---|---|---|---|---|
| `h2` | `clamp(26px,6vw,38px)` | 800 | `-.02em` | `1.02` |
| `.closing .sig-name` | `22px` | 800 | — | — |
| `.cta h3` | `21px` | 800 | `-.01em` | `1.05` — UPPERCASE |
| `.btn` | `14px` | 800 | `+.04em` | — UPPERCASE |

Note `h2` and `.cta h3` are **not** uppercase and uppercase respectively — `h2` is sentence
case, `.cta h3` is `text-transform:uppercase`.

#### Body tier (Archivo 400)

| Element | Size | lh | Color |
|---|---|---|---|
| `body` base | — | `1.55` | `--ink` |
| `p` | `16.5px` | inherit 1.55 | `#2c2520` |
| `.lede` | `18.5px` | `1.5` | `--ink` |
| `.subhead p` | `15px` | inherit | `#3a322b` |
| `.note p` | `15px` | `1.55` | `#3a322b` |
| `.cta p` | `14.5px` | inherit | inherit `#2c2520` |
| `.caption` | `12.5px` | `1.45` | `--ink-soft` |

⚠ **FLAG — half-pixel sizes.** `16.5 / 18.5 / 14.5 / 12.5 / 10.5 / 9.5` all appear. These are
hand-tuned, not a ratio scale. For React, either keep them exactly (safest for visual match)
or round to a documented scale. Recommendation: **keep 16.5px body** — it's distinctive and
the whole page is balanced around it. Round the rest as noted in §9.

#### Label / metadata tier (uppercase + wide tracking — see §6)

| Element | Size | Weight | ls | Color |
|---|---|---|---|---|
| `.brand-sub` | `9.5px` | 600 | `.34em` | `#b8a89a` |
| `.view-online` | `10px` | 600 | `.18em` | `#cdbfa9` |
| `.masthead .issue` | `10px` | 600 | `.22em` | `#b8a89a`, lh `1.5` |
| `.cta .ct-k` | `10.5px` | 700 | `.24em` | `--ink-soft` |
| `.note .nk` | `10.5px` | 700 | `.24em` | `--orange` |
| `.kicker` | `11px` | 700 | `.26em` | `--orange` |
| `.subhead .sh-k` | `11px` | 700 | `.2em` | `--orange` |
| `.hero .top-kicker` | `11px` | 700 | `.28em` | `#fff` |
| `.expect .lead` | `11px` | 700 | `.28em` | `#9c8e7f` |
| `.lb-hint` | `11px` | 600 | `.18em` | `#cdbfa9` |
| `footer .tags` | `11px` | inherit | `.2em` | `#8a7c6e` |
| `footer .small` | `11px` | inherit | — | `#6f6357`, lh `1.6` |
| `.pull .by` | `12px` | 700 | `.22em` | `#9c8e7f` |
| `.band .cap` | `13px` | 700 | `.16em` | `#fff` at `opacity:.95` |
| `.closing .sig-role` | `12.5px` | 600 | `.16em` | `--ink-soft` |
| `.verbs span` | `13px` | 600 | `.01em` | `#3a322b` — *not* uppercase |
| `.date-chips span` | `12.5px` | 600 | `.01em` | `--paper` — *not* uppercase |

⚠ **FLAG — tracking values are ad hoc.** `.16 / .18 / .2 / .22 / .24 / .26 / .28 / .34em` all
appear with no system. Recommendation for React: collapse to **three** tokens —
`--track-label: .24em` (small caps labels), `--track-kicker: .26em` (kickers/eyebrows),
`--track-wide: .34em` (brand sub only). Visual difference between .22 and .24 is negligible.

#### Serif tier (Newsreader, italic only)

| Element | Size | Weight | Style |
|---|---|---|---|
| `.hero .headline .eyebrow` | `19px` | 400 | italic, `#ffd9b8` |
| `.greet` | `21px` | 400 | italic, `--ink` |
| `.pull blockquote` | `clamp(22px,5.2vw,30px)` | 400 | italic, lh `1.32`, `#f6ecdd`, `text-wrap:balance` |
| `.note p em` | inherit `15px` | 400 | italic, `--ink` |
| "With gratitude," (inline) | inherit `16.5px` | 400 | italic, `--ink-soft` |

Newsreader is the **warmth valve**: it appears at exactly five moments, always italic, always
where the page speaks personally (greeting, eyebrow, quotes, the closing aside). Everything
else is Archivo. In the carpool app, use it for empty states, confirmations, and
human-voice microcopy — never for UI chrome, labels, or data.

---

## 3. Color usage rules

### Surfaces

| Surface | Value | Where |
|---|---|---|
| Page gutter (outside container) | `#cdbfa9` on `body` | The container floats on this. ⚠ hardcoded, no token. |
| Primary light surface | `--paper #faf4ea` | `.wrap`, `.letter`, `.cta-wrap`, `.closing` |
| Recessed light surface | `--paper-2 #f1e6d4` | `.students`, the hallway section (inline), `.verbs` pills, `.note`, `.photo` placeholder |
| Pure white | `#fff` | **Only** `.cta` cards (non-feature). White is a *card* signal, not a page signal. |
| Dark surface | `--ink #1a1613` | `.masthead`, `.hero .frame` (behind image), `.expect`, `.pull`, `.cta.feature`, `footer` |
| Gradient surface | `--grad` | `.band` only (see below) |
| Lightbox scrim | `rgba(16,12,9,.93)` + `blur(4px)` | |

**Surface rhythm:** the page alternates paper → dark → paper → gradient → paper → dark. Dark
sections are used for *statements* (the EXPECT stack, pull quotes) and *chrome* (masthead,
footer). Light sections are used for *content*. The carpool app should follow this: forms and
data on paper, headers/footers and one hero statement on ink.

### Text on light surfaces

| Role | Value |
|---|---|
| Body copy | `#2c2520` — ⚠ **not** `--ink` |
| Lede / emphatic | `--ink #1a1613` |
| Secondary body (`.subhead p`, `.note p`, `.verbs`) | `#3a322b` |
| Muted / captions / roles | `--ink-soft #5a4f47` |
| Accent labels | `--orange #f26a1b` |

⚠ **FLAG — four near-identical dark browns.** `#1a1613`, `#2c2520`, `#3a322b`, `#5a4f47` are
in play, and the first three are visually almost indistinguishable at body size. **Recommend
standardizing on two:** `--ink #1a1613` for primary text and `--ink-soft #5a4f47` for
secondary. Drop `#2c2520` and `#3a322b` entirely. This is a lossless simplification.

### Text on dark surfaces

| Role | Value | Where |
|---|---|---|
| Primary on dark | `--paper #faf4ea` | masthead brand, `.expect`, `.pull`, `.btn-dark` label, `.date-chips` text, `.dates b` |
| Quote text on dark | `#f6ecdd` | `.pull blockquote` — a hair warmer than paper |
| Body on dark | `#d9cdbd` | `.cta.feature p` |
| Muted on dark (light) | `#cdbfa9` | `.dates`, `.lb-hint`, `.view-online` |
| Muted on dark (mid) | `#b8a89a` | `.brand-sub`, `.masthead .issue`, `footer` base |
| Muted on dark (label) | `#9c8e7f` | `.expect .lead`, `.pull .by`, `.cta.feature .ct-k` |
| Muted on dark (dim) | `#8a7c6e` | `footer .tags` |
| Muted on dark (dimmest) | `#6f6357` | `.e-line .pre` (the word "Expect"), `footer .small` |
| Divider on dark | `#3a322b` | `.dates` `border-top` |
| Text on gradient | `#fff` | `.band` — pure white, not paper |

⚠ **FLAG — six muted grays on dark.** `#d9cdbd / #cdbfa9 / #b8a89a / #9c8e7f / #8a7c6e /
#6f6357`. That's a hand-mixed ramp with no system. **Recommend collapsing to three:**
`--on-dark: #faf4ea` (primary), `--on-dark-muted: #b8a89a` (metadata/labels), `--on-dark-dim:
#6f6357` (de-emphasized, e.g. the "Expect" prefix and fine print). The `#9c8e7f` and `#8a7c6e`
steps buy nothing.

Note the deliberate exception worth keeping: **`.e-line .pre` at `#6f6357` against
gradient-filled `.key`** is the whole point of the EXPECT stack — the prefix recedes so the
payload word pops. Keep that contrast even if you collapse the ramp.

### The gradient — where it goes and where it does not

`--grad: linear-gradient(100deg,#f7a81c 0%,#f26a1b 42%,#e0218a 100%)`

**Used as background-clipped text (7 of 9 uses):**
```css
background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent;
```
- `.brand-mark .p` — the "P" in RCAP
- `footer .fmark .p` — same, in footer
- `.hero .headline h1 em` — the emphasized phrase in the headline (with `font-style:normal` to
  kill the `<em>` italic)
- `.e-line .key` — the payload word of each EXPECT line
- `h2 .hl` — the emphasized final word of every section heading
- `.four span:nth-child(2)` — exactly one word ("Khakis.") in the four-word stack
- `.pull .mark` — the opening quote mark

**Used as an actual background (2 of 9):**
- `.band` — the full-bleed stat band
- `.btn-primary` — the single primary button

**Where the gradient is deliberately NOT used:** borders, dividers, underlines, rules,
section backgrounds other than `.band`, card fills, icons, hover states. There is no gradient
border and no gradient underline anywhere. Do not add one.

**The discipline that makes it work:** the gradient marks *exactly one word* per unit of text.
One word in the headline, one word per EXPECT line, one word per `h2`, one letter in the
wordmark, one word in the four-stack. Never a whole heading, never a whole sentence. If the
carpool app gets gradient text, it gets it one word at a time.

---

## 4. Spacing, rhythm, layout

| Property | Value |
|---|---|
| Container | `.wrap { max-width:680px; margin:0 auto; }` |
| Container shadow | `box-shadow:0 30px 80px rgba(0,0,0,.28)` |
| Standard section padding | `section { padding:40px 26px; }` |
| Masthead padding | `16px 26px` |
| `.expect` padding | `34px 26px 38px` (asymmetric — more bottom) |
| `.band` padding | `30px 26px` |
| `.pull` padding | `44px 30px` (⚠ the only 30px horizontal — one-off) |
| `footer` padding | `32px 26px 40px` |
| `.cta` card padding | `24px 22px`, `margin-bottom:14px` |
| `.note` padding | `22px 24px`, `margin:0 auto 26px` |
| `.rule` | `height:1px; background:var(--line); margin:0 26px;` (inset to match section padding) |
| Photo grid gap | `.grid { gap:10px; }` |
| Grid variants | `.g-2 { 1fr 1fr }`, `.g-3 { repeat(3,1fr) }` |
| Standard "next block" spacer | `.mt { margin-top:18px; }` |
| Caption offset | `margin-top:9px` |
| Paragraph rhythm | `p { margin:0 0 16px }`, `p:last-child { margin-bottom:0 }` |
| Heading bottom margin | `h2 { margin:0 0 16px }` |
| Kicker bottom margin | `.kicker { margin:0 0 14px }` |
| `.subhead` block | `margin:30px 0 14px` |
| `.verbs` block | `margin:22px 0 4px`, `gap:8px` |
| `.date-chips` | `gap:7px`, `margin-top:13px` |
| Measure constraints | `46ch` (`.note`, students paragraph), `42ch` (thank-you paragraph), `40ch` (closing lede) |

**The 26px horizontal gutter is the page's spine.** Masthead, hero overlays, every section,
the band, the footer, and the `.rule` all align to 26px from the container edge. This is what
makes the page feel typeset rather than assembled. Preserve it.

### Breakpoints

There is exactly **one** media query:

```css
@media (max-width:480px){
  section{padding:34px 20px;}
  .masthead{padding:14px 20px;}
  .hero .headline,.hero .top-kicker{left:20px;right:20px;}
  .expect,.pull{padding-left:20px;padding-right:20px;}
}
```

That's it. Below 480px the gutter goes **26px → 20px** and section vertical padding goes
**40px → 34px**. Nothing else changes — no grid collapse, no type override, no stack change.

**Why so little is needed:** all display type is `clamp()`-based with `vw` middles, so it
scales fluidly with no breakpoint. The 3-up photo grid stays 3-up on phones (it's square
thumbnails, so it survives). The container is 680px, which is already near-phone-width.

⚠ **FLAG — `.band` and `footer` do not get the 20px gutter at mobile.** They stay at 26px.
Almost certainly an oversight. Recommend adding them to the mobile rule.

---

## 5. Components

### Buttons — three variants, one shape

Base (all variants):
```css
.btn{
  display:inline-flex;align-items:center;gap:10px;
  font-family:var(--font-display);font-weight:800;text-transform:uppercase;letter-spacing:.04em;
  font-size:14px;text-decoration:none;cursor:pointer;
  padding:14px 22px;border-radius:999px;border:0;
}
```

| Variant | Fill | Text | Extra |
|---|---|---|---|
| `.btn-primary` | `var(--grad)` | `#fff` | `box-shadow:0 8px 22px rgba(242,106,27,.32)` — an orange-tinted glow, the only colored shadow in the system |
| `.btn-dark` | `var(--ink)` | `var(--paper)` | none |
| `.btn-ghost` | `transparent` | `var(--ink)` | `border:1.5px solid var(--ink)` — note **1.5px**, not 1 or 2 |

**Hierarchy in practice:** exactly one `.btn-primary` on the page (the feature CTA). `.btn-dark`
for the secondary action, `.btn-ghost` for the tertiary. Keep this — one gradient button per
screen.

**The arrow.** Every button ends with `<span class="arr">→</span>` — a literal arrow character
in a span, separated by the flex `gap:10px`. It is the only animated element on the page:
```css
.btn .arr{transition:transform .2s ease;}
.btn:hover .arr{transform:translateX(4px);}
```
No background change, no lift, no color change on hover. **Only the arrow moves.** This is a
signature; carry it into the React app.

⚠ **FLAG — no `:focus-visible` style anywhere on the page, and no touch/active state.** For
React, add both: a `:focus-visible { outline:2px solid var(--orange); outline-offset:3px }`
and an `:active { transform:scale(.98) }` or equivalent, since the arrow-only hover gives
phone users no feedback at all.

### Cards (`.cta`)

```css
.cta{
  border:1px solid var(--line);border-radius:var(--radius);
  padding:24px 22px;margin-bottom:14px;background:#fff;
}
.cta .ct-k{font-size:10.5px;letter-spacing:.24em;text-transform:uppercase;font-weight:700;color:var(--ink-soft);margin:0 0 8px;}
.cta h3{font-family:var(--font-display);font-weight:800;font-size:21px;letter-spacing:-.01em;margin:0 0 8px;line-height:1.05;text-transform:uppercase;}
.cta p{font-size:14.5px;margin:0 0 16px;}
```

Anatomy, top to bottom: **tiny tracked caps label → uppercase 800 heading → body → button.**
Four elements, always in that order.

Dark ("feature") variant — inverts the card, keeps the structure:
```css
.cta.feature{background:var(--ink);border-color:var(--ink);color:var(--paper);}
.cta.feature .ct-k{color:#9c8e7f;}
.cta.feature p{color:#d9cdbd;}
```

Note the feature card **carries the primary button**, so gradient-on-ink is the maximum-emphasis
combination in the system.

### Pills / badges — two kinds

**Light pill** (`.verbs span` — the "greeting guests" chips):
```css
.verbs span{
  font-size:13px;font-weight:600;letter-spacing:.01em;
  background:var(--paper-2);color:#3a322b;
  padding:7px 13px;border-radius:999px;border:1px solid var(--line);
}
.verbs span b{color:var(--orange);font-weight:800;}
```
The bold-orange-word-inside-a-pill is a nice motif: the pill is quiet, one word inside it is
loud. Container is `display:flex;flex-wrap:wrap;gap:8px`.

**Dark pill** (`.date-chips span` — the date chips on the feature card):
```css
.date-chips span{
  font-size:12.5px;font-weight:600;color:var(--paper);letter-spacing:.01em;
  background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);
  padding:6px 12px;border-radius:999px;white-space:nowrap;
}
.date-chips span.full{opacity:.45;}
.date-chips span.full i{font-style:normal;font-weight:500;}
```
Note the **disabled/unavailable pattern**: `opacity:.45` plus an inline `<i>— Full</i>` at
weight 500 with italic stripped. That is directly reusable for a full/unavailable carpool slot.
⚠ At `opacity:.45` on `rgba(255,255,255,.1)` the contrast is well below WCAG AA — fine for a
newsletter, **not** fine for an interactive app. Recommend `opacity:.6` minimum plus a
non-color cue.

Neither pill has a hover state. Both use `border-radius:999px`, not `--radius`.

### The numbered kicker badge

```css
.kicker{
  display:flex;align-items:center;gap:10px;
  font-size:11px;letter-spacing:.26em;text-transform:uppercase;font-weight:700;
  color:var(--orange);margin:0 0 14px;
}
.kicker .num{
  font-family:var(--font-display);font-weight:900;font-size:12px;
  background:var(--ink);color:var(--paper);
  width:26px;height:26px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;letter-spacing:0;
}
```
A 26px ink circle with a 900-weight numeral, followed by orange tracked caps. Sections are
numbered `01`–`06`; the CTA section uses `→` in the same circle instead of a number — a nice
reuse worth copying (an icon in the numeral slot).

### Dividers

Only one real divider: `.rule { height:1px; background:var(--line); margin:0 26px; }`.
On dark, `.dates` uses `border-top:1px solid #3a322b`. There is no dashed, dotted, or
gradient rule anywhere.

### Images / figures

```css
img{display:block;width:100%;height:100%;object-fit:cover;}
figure{margin:0;}
.photo{overflow:hidden;border-radius:var(--radius);background:var(--paper-2);}
.ratio-wide{aspect-ratio:3/2;}
.ratio-tall{aspect-ratio:3/4;}
.ratio-sq{aspect-ratio:1/1;}
```
Aspect ratio is owned by the `.photo` wrapper; the `img` always fills it with `object-fit:cover`.
Fine positioning is done with inline `object-position` where a crop needed help. `.photo` gets
`--paper-2` as a placeholder color so a slow image doesn't flash white.

**Captions** — this is a signature, see §6:
```css
.caption{
  font-size:12.5px;color:var(--ink-soft);margin-top:9px;line-height:1.45;
  display:flex;gap:8px;
}
.caption::before{content:"";flex:0 0 auto;width:16px;height:2px;background:var(--orange);margin-top:8px;border-radius:2px;}
```

### Subheads (in-section)

```css
.subhead{margin:30px 0 14px;}
.subhead .sh-k{
  font-size:11px;letter-spacing:.2em;text-transform:uppercase;font-weight:700;
  color:var(--orange);margin:0 0 5px;display:flex;align-items:center;gap:9px;
}
.subhead .sh-k::before{content:"";width:18px;height:2px;background:var(--orange);border-radius:2px;}
.subhead p{font-size:15px;color:#3a322b;margin:0;}
```

### Pull quote block

```css
.pull{background:var(--ink);color:var(--paper);padding:44px 30px;}
.pull .mark{font-family:var(--font-display);font-weight:900;font-size:54px;line-height:.6;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent;}
.pull blockquote{
  margin:6px 0 0;font-family:var(--font-quote);font-style:italic;
  font-size:clamp(22px,5.2vw,30px);line-height:1.32;color:#f6ecdd;text-wrap:balance;
}
.pull .by{font-family:var(--font-body);font-style:normal;font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#9c8e7f;font-weight:700;margin-top:18px;}
```
Note `line-height:.6` on the quote mark — that's what tucks the `"` tight above the quote.
Attribution is optional (quote 1 has none).

### Stat band

```css
.band{background:var(--grad);color:#fff;text-align:center;padding:30px 26px;}
.band .big{font-family:var(--font-display);font-weight:900;font-size:clamp(44px,13vw,72px);line-height:.9;letter-spacing:-.03em;}
.band .cap{font-size:13px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;margin-top:8px;opacity:.95;}
```
The only gradient-background section. Number on top, tracked caps below. The second band
inverts the order (caps label, then "Thank you.") via inline overrides.

### Note box

```css
.note{
  background:var(--paper-2);border:1px solid var(--line);border-radius:var(--radius);
  padding:22px 24px;margin:0 auto 26px;max-width:46ch;text-align:center;
}
.note .nk{font-size:10.5px;letter-spacing:.24em;text-transform:uppercase;font-weight:700;color:var(--orange);margin:0 0 10px;}
.note p{font-size:15px;margin:0;color:#3a322b;line-height:1.55;}
.note p em{font-family:var(--font-quote);font-style:italic;color:var(--ink);}
```
Directly reusable as a carpool "info / heads up" callout.

### Lightbox (the only interactive JS component)

```css
#lightbox{
  position:fixed;inset:0;z-index:9999;display:none;
  align-items:center;justify-content:center;padding:24px;
  background:rgba(16,12,9,.93);cursor:zoom-out;
  -webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);
}
#lightbox.open{display:flex;}
#lightbox img{width:auto;height:auto;max-width:100%;max-height:100%;object-fit:contain;border-radius:10px;box-shadow:0 24px 70px rgba(0,0,0,.6);}
#lightbox .lb-close{
  position:absolute;top:18px;right:20px;width:42px;height:42px;border-radius:50%;
  background:rgba(255,255,255,.12);color:#fff;border:0;cursor:pointer;
  font-size:22px;line-height:1;display:flex;align-items:center;justify-content:center;
}
#lightbox .lb-close:hover{background:rgba(255,255,255,.22);}
#lightbox .lb-hint{position:absolute;bottom:20px;left:0;right:0;text-align:center;color:#cdbfa9;font-size:11px;letter-spacing:.18em;text-transform:uppercase;font-weight:600;}
```
This is the closest thing to a **modal spec** in the system — use it as the basis for any
carpool dialog: near-opaque ink scrim at `.93` with a 4px blur, 42px circular close button at
`rgba(255,255,255,.12)`, and a tracked-caps hint line at the bottom. `.photo img{cursor:zoom-in}`
signals clickability. Escape closes; clicking the scrim closes.

⚠ It has `role="dialog" aria-modal="true"` but **no focus trap and no focus restore**, and
`display:none` toggling means no transition. Fix both in React.

---

## 6. Signature moves

These three are what make the page recognizable. If the carpool app has these, it matches;
if it doesn't, no amount of correct color will save it.

### 1. The gradient-clipped payload word

Exactly one word per heading gets the gradient. The mechanism, verbatim:
```css
background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent;
```
Applied via `<span class="hl">` inside `h2`, `<em>` inside `h1`, `<span class="key">` in the
EXPECT stack. Discipline is the point: **one word, never a phrase, never a whole line.**

Markup pattern: `<h2>It looks effortless. It's <span class="hl">teamwork.</span></h2>`

React note: `background-clip:text` on a gradient needs the element to be inline-level with
actual text; it will silently render transparent (invisible) if the background fails to paint.
Always ship a fallback: `@supports not (background-clip:text){ .hl{ color:var(--orange); } }`.

### 2. The short orange rule as a label prefix

A 2px-tall, rounded, orange bar sitting to the left of a small piece of text. It appears in two
sizes and is the page's most-repeated ornament.

Before captions (16px, offset down to align with the first text line):
```css
.caption{display:flex;gap:8px;}
.caption::before{content:"";flex:0 0 auto;width:16px;height:2px;background:var(--orange);margin-top:8px;border-radius:2px;}
```

Before subhead labels (18px, vertically centered):
```css
.subhead .sh-k{display:flex;align-items:center;gap:9px;}
.subhead .sh-k::before{content:"";width:18px;height:2px;background:var(--orange);border-radius:2px;}
```

Related family member — the hero kicker uses a **dot** instead of a bar, same idea:
```css
.hero .top-kicker .dot{width:7px;height:7px;border-radius:50%;background:var(--orange);}
```

Use this on carpool section labels, helper text under fields, and list-item metadata.

### 3. The tracked micro-caps label

Every content block is introduced by a tiny, uppercase, heavily letter-spaced, weight-700
label — usually orange on light, usually a warm gray on dark. It is the page's connective
tissue. The canonical instance:
```css
.kicker{
  display:flex;align-items:center;gap:10px;
  font-size:11px;letter-spacing:.26em;text-transform:uppercase;font-weight:700;
  color:var(--orange);margin:0 0 14px;
}
```
Nine variants of this exist (see §2 label tier). In React, build **one** `<Label>` component
with a `tone` prop (`accent` / `muted` / `on-dark`) rather than nine classes.

### Honorable mention — the "Expect X." stack

Repeating a dimmed prefix with a gradient payload, stacked at `gap:2px` with `line-height:1.0`.
It's a display device rather than a component, but it's the most memorable block on the page
and it would translate well to a carpool empty state or onboarding screen.

---

## 7. Motion

The entire motion budget of this page, complete:

```css
.btn .arr{transition:transform .2s ease;}
.btn:hover .arr{transform:translateX(4px);}
```

Plus one untransitioned hover:
```css
#lightbox .lb-close:hover{background:rgba(255,255,255,.22);}
.view-online:hover{color:var(--paper);}
```

That is **all of it.** No `@keyframes`, no scroll-triggered animation, no fade-in, no card
lift, no page transitions. Duration `.2s`, easing `ease`, and only ever `transform`.

**Guidance for the React app:** stay near this. Establish `--dur:.2s` and `--ease:ease` as
tokens and use them for everything. You will need a few states the newsletter doesn't have
(focus rings, loading spinners, modal enter/exit, form validation). Keep them at 200ms,
prefer `transform`/`opacity`, and wrap anything decorative in
`@media (prefers-reduced-motion:reduce)`. Do not introduce a second, longer duration — the
restraint is part of the look.

---

## 8. Mobile

The audience is overwhelmingly on phones. What the source does right, and what you must add.

**Already mobile-correct:**
- Every display size is `clamp(min, vw, max)` with a `vw` middle term, so headlines scale
  continuously with no breakpoint. Copy this approach rather than adding breakpoints.
- Container is 680px — effectively "phone width plus a little," so the phone view *is* the
  design, not a degraded version of it.
- `line-height:1.55` body with `16.5px` text is comfortable at arm's length.
- `text-wrap:balance` on `h1`, `h2`, and `blockquote` prevents ugly one-word last lines on
  narrow screens.
- Pills wrap (`flex-wrap:wrap`) and date chips use `white-space:nowrap` so a date never breaks
  mid-token.
- Photo aspect ratios are owned by wrappers, so no layout shift on load.
- The `.g-3` grid stays 3-up on phones. Verified acceptable because those are square thumbs.
  ⚠ Do **not** reuse `.g-3` for anything with text in it at phone width.

**The one breakpoint** (repeated from §4): `@media (max-width:480px)` → gutter 26px→20px,
section padding 40px→34px. Nothing else.

**What must be added for an interactive app:**
- **Tap targets.** `.btn` at `padding:14px 22px` / 14px text lands around 46px tall — fine.
  But `.date-chips span` at `padding:6px 12px` / 12.5px is roughly **28px tall**, well under
  the 44px minimum. If date chips become selectable in carpool, they need `padding:12px 16px`.
- **Hover is the only interactive feedback in the whole system**, and phones have no hover.
  Every interactive element needs an `:active` state.
- **No focus styles exist.** Add `:focus-visible` globally.
- **Fixed-position elements** (the lightbox) need `padding-bottom` accounting for iOS home
  indicator: use `env(safe-area-inset-bottom)`.
- **Form inputs don't exist in the source at all.** You are inventing them. Derive from the
  card + pill vocabulary: `background:#fff`, `border:1px solid var(--line)`,
  `border-radius:var(--radius)` (or `999px` for single-line inputs to match the pill/button
  language), `font-size:16px` **minimum** (below 16px iOS Safari zooms on focus — this rules
  out reusing 14.5px for inputs), label as a tracked micro-caps in `--ink-soft`, focus ring in
  `--orange`.

---

## 9. Email-specific hackery — what NOT to carry over

**Good news: `index.html` is the clean web version, not the email version.** The sibling file
`email.html` in the same repo is the table-based one. `index.html` contains:

- **No `<table>` layout.** Modern flexbox and CSS grid throughout.
- **No `!important`.** Zero occurrences.
- **No inline styles on structural elements.** All inline styles are content-level one-offs.

So there is very little to strip. What is present:

| Found in source | Why it's there | Modern React equivalent |
|---|---|---|
| **15 inline `style=` attributes** — e.g. `style="margin-top:14px;"`, `style="object-position:center top;"`, `style="background:var(--paper-2);"`, `style="max-width:46ch;margin:0 auto 22px;"`, `style="font-size:clamp(30px,8vw,46px);"` | One-off overrides in a hand-authored single file | Component props / variants. `background:var(--paper-2)` on a section → a `<Section tone="recessed">` prop. `max-width:46ch` → a `<Prose measure="narrow">` variant. `object-position` → a prop on the image component. |
| **`.view-online` class** (`font-size:10px;letter-spacing:.18em;...;border-bottom:1px solid #4a423b`) | Dead code — this is the email's "View this in your browser" link, left behind in the web build | Delete. Do not port. |
| **The whole `.masthead` + `footer` "issue / tags / you're receiving this because" chrome** | Newsletter framing | Not applicable to an app. Port the *visual treatment* (ink bar, gradient letter in wordmark, tracked caps metadata on the right) as the app header; drop the subscription language. |
| **Vendor-prefixed `-webkit-background-clip` and `-webkit-backdrop-filter`** | Email/Safari safety | Keep both — still required for Safari. This is not email hackery. |
| **Repeated literal hex values instead of tokens** (`#3a322b`, `#9c8e7f`, `#2c2520`, `#cdbfa9` …) | Hand-authored expedience | Tokenize. See §3 flags. |
| **Vanilla IIFE lightbox script with `querySelectorAll` + `classList`** | No build step in the newsletter | Rewrite as a React component with proper state, focus trap, focus restore, and `useEffect` keydown cleanup. |
| **`<b>` and `<i>` tags used for styling** (`.verbs span b`, `.date-chips span.full i`) | Terseness | Use `<strong>`/`<span>` with classes. The `i` in `.full i` is purely stylistic (it even resets `font-style:normal`) — that should be a `<span>`. |

### Recommended token set for the React app

Consolidating everything above, with the flagged simplifications applied:

```css
:root{
  /* surfaces */
  --paper:#faf4ea;
  --paper-2:#f1e6d4;
  --card:#ffffff;
  --ink:#1a1613;
  --page-bg:#cdbfa9;          /* was hardcoded on body */

  /* text */
  --ink-soft:#5a4f47;          /* replaces #2c2520 and #3a322b */
  --on-dark:#faf4ea;
  --on-dark-muted:#b8a89a;     /* replaces #9c8e7f and #8a7c6e */
  --on-dark-dim:#6f6357;

  /* lines + accent */
  --line:#e4d6c0;
  --line-dark:#3a322b;
  --orange:#f26a1b;
  --grad:linear-gradient(100deg,#f7a81c 0%,#f26a1b 42%,#e0218a 100%);

  /* semantic (activating previously-dead tokens) */
  --green:#1f9d57;
  --red:#d8202d;
  --blue:#1f55c0;

  /* shape */
  --radius:16px;
  --radius-pill:999px;
  --shadow-page:0 30px 80px rgba(0,0,0,.28);
  --shadow-primary:0 8px 22px rgba(242,106,27,.32);

  /* type */
  --font-display:'Archivo',system-ui,sans-serif;
  --font-body:'Archivo',system-ui,sans-serif;
  --font-quote:'Newsreader',Georgia,serif;   /* italic only */
  --track-label:.24em;
  --track-kicker:.26em;
  --track-wide:.34em;

  /* space */
  --gutter:26px;
  --gutter-mobile:20px;
  --section-y:40px;
  --section-y-mobile:34px;
  --gap-grid:10px;
  --gap-block:18px;

  /* motion */
  --dur:.2s;
  --ease:ease;
}
```

---

## 10. Quick checklist for the carpool restyle

- [ ] Load the exact Google Fonts tag from §2. Newsreader italic-only.
- [ ] 680px max-width container on `#cdbfa9`, with `--shadow-page`.
- [ ] 26px gutter everywhere / 20px under 480px. Align dividers to it.
- [ ] Body copy 16.5px, `line-height:1.55`. Inputs at 16px minimum.
- [ ] Every section opens with a tracked micro-caps label, orange, weight 700, `.26em`.
- [ ] Exactly one gradient word per heading. Never a phrase.
- [ ] Exactly one `.btn-primary` per screen. Pill radius, 800 uppercase, arrow that slides 4px.
- [ ] Short orange 2px rule before captions and helper text.
- [ ] One ink-dark section per screen, for a statement — not for everything.
- [ ] Motion: 200ms `ease`, transform only. Nothing else.
- [ ] Add what the newsletter lacks: focus-visible, active states, 44px tap targets, form
      styling derived from the card/pill vocabulary, reduced-motion guard.
