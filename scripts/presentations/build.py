#!/usr/bin/env python3
"""Build an RCAP presentation for wearercap.org/presentations/.

Source folder (presentations-src/<slug>/) holds what the Claude Slides artifact
keeps: deck.json (slide order) and slides/<id>.html (one <section> each, notes
in a trailing <aside>), plus presentation.json (title, date, pdf name, asset
map, notes fixes).

    python3 scripts/presentations/build.py presentations-src/<slug>          # web page
    python3 scripts/presentations/build.py presentations-src/<slug> --pdf    # + PDF with notes + share image

Writes public/presentations/<slug>/index.html (and the PDF and share.jpg), then
updates public/presentations/presentations.json. The PDF step needs Python
Playwright with Chromium.
"""
import html, json, re, sys, os, base64, threading, functools, http.server
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "public"


def load(src):
    meta = json.loads((src / "presentation.json").read_text())
    deck = json.loads((src / "deck.json").read_text())
    slides = []
    for sid in deck["order"]:
        s = (src / "slides" / f"{sid}.html").read_text().strip()
        for old, new in meta.get("assets", {}).items():
            s = s.replace(old, new)
        for old, new in meta.get("notesReplace", []):
            s = s.replace(old, new)
        s = re.sub(r"<x-embed style=\"([^\"]*)\">(.*?)</x-embed>",
                   lambda m: f'<iframe class="deck-embed" style="{m.group(1)}" sandbox="allow-scripts" aria-hidden="true" tabindex="-1" srcdoc="{html.escape(m.group(2), quote=True)}"></iframe>',
                   s, flags=re.S)
        slides.append(s)
    return meta, deck, slides


def page(meta, slides):
    slug, title = meta["slug"], meta["title"]
    url = f"https://wearercap.org/presentations/{slug}/"
    desc = html.escape(meta["description"])
    t = html.escape(title)
    pdf = meta.get("pdf")
    pdf_link = f'<a href="/presentations/{slug}/{pdf}" download class="deck-hide-sm">Download PDF</a>' if pdf else ""
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#0f1a3a" />
  <title>{t} | RCAP Presentations</title>
  <meta name="description" content="{desc}" />
  <link rel="canonical" href="{url}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="{html.escape(meta.get('headline', title))} {t}" />
  <meta property="og:description" content="{desc}" />
  <meta property="og:url" content="{url}" />
  <meta property="og:image" content="{url}share.jpg" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="stylesheet" href="/presentations/_player/player.css" />
</head>
<body>
  <main class="deck-stage" aria-label="{t} slides">
    <div class="deck-canvas">
{chr(10).join(slides)}
    </div>
  </main>
  <div class="deck-progress" aria-hidden="true"></div>
  <section class="deck-notes" aria-live="polite"><h2>Speaker notes</h2><p></p></section>
  <div class="deck-help" role="note"><b>Next</b> Right arrow, Space, click<br><b>Back</b> Left arrow<br><b>Notes</b> N &nbsp; <b>Full screen</b> F<br><b>Hide this bar</b> P &nbsp; <b>Slide 1 to 9</b> number keys</div>
  <nav class="deck-bar">
    <a href="/presentations/">All presentations</a>
    <span class="deck-title">{t}</span>
    <span class="deck-spacer"></span>
    <button type="button" data-deck="prev" aria-label="Previous">Back</button>
    <span class="deck-count">1 / {len(slides)}</span>
    <button type="button" data-deck="next" aria-label="Next">Next</button>
    <button type="button" data-deck="notes" aria-pressed="false">Notes</button>
    <button type="button" data-deck="full" class="deck-hide-sm">Full screen</button>
    {pdf_link}
    <button type="button" data-deck="help" class="deck-hide-sm" aria-label="Keyboard shortcuts">?</button>
  </nav>
  <script src="/presentations/_player/player.js"></script>
</body>
</html>
"""


def update_manifest(meta, count):
    path = PUBLIC / "presentations" / "presentations.json"
    data = json.loads(path.read_text()) if path.exists() else {"presentations": []}
    entry = {k: meta[k] for k in ("slug", "title", "headline", "description", "date", "audience", "presenter") if k in meta}
    entry["slides"] = count
    entry["url"] = f"/presentations/{meta['slug']}/"
    if meta.get("pdf"):
        entry["pdf"] = f"/presentations/{meta['slug']}/{meta['pdf']}"
    entry["image"] = f"/presentations/{meta['slug']}/share.jpg"
    rest = [p for p in data["presentations"] if p["slug"] != meta["slug"]]
    data["presentations"] = sorted(rest + [entry], key=lambda p: p.get("date", ""), reverse=True)
    path.write_text(json.dumps(data, indent=2) + "\n")


def render_pdf(meta, slides_html, out):
    from playwright.sync_api import sync_playwright
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    handler = functools.partial(Quiet, directory=str(PUBLIC))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_address[1]}/presentations/{meta['slug']}/"
    shots, notes = [], []
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=os.environ.get("CHROMIUM", "/opt/pw-browsers/chromium") if os.path.exists("/opt/pw-browsers/chromium") else None)
        pg = b.new_page(viewport={"width": 1920, "height": 1080})
        pg.goto(base + "index.html")
        pg.evaluate("document.body.classList.add('is-presenting')")
        pg.evaluate("document.fonts.ready")
        pg.wait_for_timeout(600)
        n = pg.evaluate("document.querySelectorAll('.deck-canvas > section').length")
        for i in range(n):
            pg.evaluate("""i => { const s=[...document.querySelectorAll('.deck-canvas > section')];
                s.forEach((x,k)=>{x.style.transition='none';x.classList.toggle('is-active',k===i)});
                s[i].querySelectorAll('[data-build-in]').forEach(e=>{e.style.transition='none';e.classList.remove('is-pending')}); }""", i)
            pg.wait_for_timeout(250 if i else 400)
            shots.append(pg.locator(".deck-canvas").screenshot(type="jpeg", quality=88))
            notes.append(pg.evaluate("i => { const a=document.querySelectorAll('.deck-canvas > section')[i].querySelector(':scope > aside'); return a ? a.textContent.trim() : '' }", i))
        (out / "share.jpg").write_bytes(shots[0])
        font = (PUBLIC / "presentations/_player/fonts/archivo-latin-400-normal.woff2").read_bytes()
        font9 = (PUBLIC / "presentations/_player/fonts/archivo-latin-900-normal.woff2").read_bytes()
        pages = []
        for i, (img, note) in enumerate(zip(shots, notes)):
            pages.append(f"""<div class="pg"><div class="hd"><span>RCAP · {html.escape(meta['title'])}</span><span>Slide {i+1} of {n}</span></div>
<img src="data:image/jpeg;base64,{base64.b64encode(img).decode()}">
<div class="lbl">Speaker notes</div><p>{html.escape(note) or '<i>No notes for this slide.</i>'}</p></div>""")
        doc = f"""<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{{font-family:A;font-weight:400;src:url(data:font/woff2;base64,{base64.b64encode(font).decode()})}}
@font-face{{font-family:A;font-weight:900;src:url(data:font/woff2;base64,{base64.b64encode(font9).decode()})}}
@page{{size:Letter;margin:0.55in 0.6in}} body{{margin:0;font-family:A,Arial,sans-serif;color:#1a2a56}}
.pg{{page-break-after:always}} .pg:last-child{{page-break-after:auto}}
.hd{{display:flex;justify-content:space-between;font-size:9pt;letter-spacing:.08em;text-transform:uppercase;color:#4a5578;border-bottom:2px solid #f0b323;padding-bottom:6pt;margin-bottom:12pt}}
img{{width:100%;display:block;border:1px solid #dcdfe8}}
.lbl{{margin:18pt 0 6pt;font-weight:900;font-size:10pt;letter-spacing:.12em;text-transform:uppercase;color:#f26a1b}}
p{{margin:0;font-size:12.5pt;line-height:1.55}}
</style></head><body>{''.join(pages)}</body></html>"""
        pg2 = b.new_page()
        pg2.set_content(doc, wait_until="load")
        pg2.evaluate("document.fonts.ready")
        pg2.pdf(path=str(out / meta["pdf"]), format="Letter", print_background=True,
                margin={"top": "0.55in", "bottom": "0.55in", "left": "0.6in", "right": "0.6in"})
        b.close()
    srv.shutdown()


def main():
    src = Path(sys.argv[1]).resolve()
    meta, deck, slides = load(src)
    out = PUBLIC / "presentations" / meta["slug"]
    out.mkdir(parents=True, exist_ok=True)
    (out / "index.html").write_text(page(meta, slides))
    update_manifest(meta, len(slides))
    if "--pdf" in sys.argv:
        render_pdf(meta, slides, out)
    print(f"built {out.relative_to(ROOT)} ({len(slides)} slides)")


if __name__ == "__main__":
    main()
