# Presentations (wearercap.org/presentations/)

Meeting decks live at `/presentations/`. Each deck is a static page in
`public/presentations/<slug>/` with a PDF (slides plus speaker notes) beside it.
The list page reads `public/presentations/presentations.json`, so a new deck shows
up there as soon as its entry is added.

## What is where

| Path | What it is |
|---|---|
| `public/presentations/index.html` | The list page. Renders cards from `presentations.json`, newest first. |
| `public/presentations/presentations.json` | One entry per deck: slug, title, date, presenter, audience, slide count, page, PDF, share image. |
| `public/presentations/_player/` | Shared player: `player.css`, `player.js`, self-hosted Archivo and Newsreader fonts. Every deck uses it. |
| `public/presentations/<slug>/index.html` | The deck. Generated; do not hand-edit. |
| `public/presentations/<slug>/<name>.pdf` | Slides with speaker notes, one slide per page. Generated. |
| `public/presentations/<slug>/share.jpg` | Cover slide, used for link previews and the list card. Generated. |
| `presentations-src/<slug>/` | Source: `deck.json` (slide order), `slides/<id>.html`, `presentation.json` (title, date, PDF name, asset map, notes fixes). |
| `scripts/presentations/build.py` | Turns a source folder into the page, PDF, share image and manifest entry. |

## Adding a deck

1. Build the deck in a Claude Slides artifact. Keep the house look: navy `#0f1a3a`/`#1a2a56`,
   gold `#f0b323`, orange `#f26a1b`, cream `#faf4ea`, Archivo 900 caps, Newsreader italic.
2. Copy its `project/deck.json` and `project/slides/*.html` into `presentations-src/<slug>/`.
3. Add `presentations-src/<slug>/presentation.json` (copy the Advisory Board one). Map every
   `/_blob/<id>` image to a file under `public/` in `assets`. Use `notesReplace` to strip
   anything from speaker notes that should not go public.
4. Build: `python3 scripts/presentations/build.py presentations-src/<slug> --pdf`
   (needs Python Playwright with Chromium; drop `--pdf` to rebuild only the page).
5. Commit the source folder, `public/presentations/<slug>/` and `presentations.json`. Push.

## Player controls

Next: Right arrow, Space, Page Down, click, swipe left. Back: Left arrow, Page Up.
Number keys jump to slides 1 to 9. N shows speaker notes, F is full screen, P hides the
control bar, ? lists the keys. `#5` in the address opens slide 5; `?notes` opens with notes showing.
Items marked `data-build-in` reveal one per click. Live `x-embed` animations become
sandboxed iframes.

## Notes

- Speaker notes are public on the page (N key) and in the PDF. Write them that way.
- Slide HTML uses the Slides artifact's inline-style subset; the player supplies the
  matching defaults (heading sizes, no margins, divs as flex columns).
