"""Builds the static how-to pages in public/how-to/ from one template.
Run: python3 scripts/build-how-to.py. Edit the copy here, not in the HTML."""
import html, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent / "public" / "how-to"
# Screenshots per guide, made from the real apps with fake test data.
SHOTS = json.loads((pathlib.Path(__file__).resolve().parent / "how-to-shots.json").read_text())

HEAD = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{title} | RCAP</title>
<meta name="description" content="{desc}" />
<meta property="og:type" content="article" />
<meta property="og:title" content="{title} | RCAP" />
<meta property="og:description" content="{desc}" />
{og_image}<meta name="twitter:card" content="summary_large_image" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/how-to/how-to.css" />
</head>
<body>
<header class="topbar"><div class="wrap">
  <a href="/" aria-label="RCAP home"><img src="/brand/rcap-reversed.svg" alt="RCAP" /></a>
  <nav><a href="/how-to/">All guides</a><a href="/#tools">Tools</a></nav>
</div></header>
"""

FOOT = """<footer class="foot"><div class="wrap">
  <span>Ron Clark Academy Parents · <a href="/how-to/">How-to guides</a></span>
  <span>Questions? <a href="mailto:{contact}">{contact}</a></span>
</div></footer>
</body>
</html>
"""


def hero(eyebrow, title, lede, tool_href, tool_label, meta, printable=True):
    print_btn = ('  <a class="btn ghost no-print" href="javascript:window.print()">Print this guide</a>\n'
                 if printable else "")
    return f"""<section class="hero"><div class="wrap">
  <p class="eyebrow">{eyebrow}</p>
  <h1>{title}</h1>
  <p class="lede">{lede}</p>
  <a class="btn" href="{tool_href}">{tool_label} &rarr;</a>
{print_btn}  <p class="meta">{meta}</p>
</div></section>
"""


def figures(slug, shots):
    if not shots:
        return ""
    figs = "".join(
        f'<figure><a href="/how-to/img/{slug}/{s["file"]}"><img src="/how-to/img/{slug}/{s["file"]}" '
        f'width="{s["w"]}" height="{s["h"]}" loading="lazy" alt="{html.escape(s["caption"])}" /></a>'
        f'<figcaption>{html.escape(s["caption"])}</figcaption></figure>'
        for s in shots)
    return f'<div class="shots">{figs}</div>'


def steps(items, slug="", offset=0):
    out = ['<ol class="steps" start="%d" style="counter-reset: step %d">' % (offset + 1, offset)]
    for n, (heading, bullets) in enumerate(items, start=offset + 1):
        lis = "".join(f"<li>{b}</li>" for b in bullets)
        shots = [s for s in SHOTS.get(slug, []) if s["step"] == n]
        out.append(f'<li class="step"><div><h2>{heading}</h2><ul>{lis}</ul>{figures(slug, shots)}</div></li>')
    out.append("</ol>")
    return "\n".join(out)


def notes(items):
    cards = "".join(f'<div class="note"><h3>{h}</h3><p>{p}</p></div>' for h, p in items)
    return f'<div class="notes">{cards}</div>'


def page(slug, *, title, desc, og, eyebrow, lede, tool_href, tool_label, meta,
         callout, step_items, extra_label=None, extra_steps=None, note_items, contact):
    body = [HEAD.format(title=html.escape(title), desc=html.escape(desc),
                        og_image=f'<meta property="og:image" content="https://wearercap.org{og}" />\n' if og else "")]
    body.append(hero(eyebrow, title, lede, tool_href, tool_label, meta))
    body.append('<main><div class="wrap">')
    if callout:
        body.append(f'<div class="callout">{callout}</div>')
    body.append('<p class="label">Step by step</p>')
    body.append(steps(step_items, slug))
    if extra_steps:
        body.append(f'<p class="label">{extra_label}</p>')
        body.append(steps(extra_steps, slug, offset=len(step_items)))
    body.append('<p class="label">Good to know</p>')
    body.append(notes(note_items))
    body.append("</div></main>")
    body.append(FOOT.format(contact=contact))
    d = ROOT / slug
    d.mkdir(parents=True, exist_ok=True)
    (d / "index.html").write_text("\n".join(body))


GUIDES = []


def guide(slug, name, blurb, **kw):
    GUIDES.append((slug, name, blurb))
    page(slug, **kw)


# ------------------------------------------------------------ Check requests
guide(
    "check-requests", "Check requests",
    "Get paid back for an RCAP purchase, or have RCAP pay a vendor.",
    title="How to get reimbursed",
    desc="Submit an RCAP reimbursement or vendor payment and follow it to payment.",
    og="/check-requests-og.png",
    eyebrow="How-to · Check requests",
    lede="Spent money on an RCAP committee or event? Send your receipts here and follow the request until you are paid.",
    tool_href="/check-requests/", tool_label="Open check requests",
    meta="wearercap.org/check-requests · About five minutes",
    callout="<strong>Reimbursements, not advances.</strong> Buy within your committee's approved budget, keep the paid receipt, then submit. An order confirmation alone is not proof of payment.",
    step_items=[
        ("Fill in the details", [
            "Go to wearercap.org/check-requests. You start on <b>New request</b>.",
            "Enter your name and phone, then pick <b>Reimbursement</b> or <b>Direct payment to vendor</b>.",
            "Choose your <b>Committee</b> and say what the expenses were for.",
            "Payment is by Zelle. Enter the email or cellphone number your Zelle account uses.",
        ]),
        ("Add each expense and its receipt", [
            "For each purchase, enter the date, the <b>Amount requested</b>, and the receipt total.",
            "Tap <b>Attach paid receipts</b>. PDF, JPG, or PNG, up to 5 files per expense, 10 MB each.",
            "Choose all the receipts for one expense at once. Choosing again replaces them.",
            "If only part of a receipt is RCAP, list the covered items and amounts.",
        ]),
        ("Sign in and submit", [
            "Enter your cellphone number and tap <b>Text me a code</b>, then type the code.",
            "Check the two boxes confirming the expense is in budget and the receipts show payment.",
            "Tap <b>Submit request</b>. You will get a request number and a text.",
        ]),
        ("Follow it to payment", [
            "Open <b>Past requests</b> anytime to see where it stands.",
            "<b>Awaiting approval</b>, then <b>Approved</b>, then <b>Paid</b>. You get a text at each step.",
            "If it says <b>Changes requested</b>, read the note, tap <b>Update &amp; resubmit</b>, fix it, and send it back. It keeps its number.",
        ]),
    ],
    note_items=[
        ("Stick with one sign-in", "Sign in by text every time. Signing in with an email or Google creates a separate account, and your requests will not show there."),
        ("Want email instead of texts?", "Add an email under <b>Account &amp; backup sign-in</b>, then choose Email under <b>Request notifications</b>."),
        ("A PDF for your records", "Check <b>Email me a PDF copy</b> when you submit, or tap <b>Download PDF</b> on any request."),
        ("Paying a vendor", "Choose <b>Direct payment to vendor</b> and attach the unpaid invoice. Do not enter card numbers anywhere."),
    ],
    contact="rcaparents@ronclarkacademy.com",
)

# ------------------------------------------------------------ RCAP Capsule
guide(
    "rcap-capsule", "RCAP Capsule",
    "Add your photos from school events and find the ones of your kids.",
    title="How to use the RCAP Capsule",
    desc="Add your event photos to the school-wide Capsule, find your kids, and share the album.",
    og=None,
    eyebrow="How-to · RCAP Capsule",
    lede="One shared photo album for every all-school event. Add what you took, find what others caught of your kids, and say thank you.",
    tool_href="/rcap-capsule/", tool_label="Open the Capsule",
    meta="wearercap.org/rcap-capsule · Two minutes to join",
    callout="<strong>Everyone in the school can see, like, comment on, and download what you add.</strong> Share the moments you would want shared.",
    step_items=[
        ("Sign in with your phone", [
            "Tap <b>Sign in</b>, enter your mobile number, and tap <b>Text me a code</b>.",
            "Type the 6-digit code and tap <b>Verify and continue</b>.",
            "Add your name and pick <b>Your house</b>. Your photos count toward your house on the leaderboard.",
            "Tap <b>Into the Capsule</b>.",
        ]),
        ("Find an event", [
            "The Capsule home leads with the latest event. Tap <b>View album</b> to see everyone's photos.",
            "For an older event, scroll to <b>Every album</b> and tap it. <b>Capsule home</b> brings you back.",
            "Tap any photo to see it full size. Swipe to move through, swipe down to close.",
            "Tap the download icon, then <b>Save to Photos</b>.",
        ]),
        ("Add your photos and videos", [
            "Tap <b>Add photos</b> on the home page or in any album, then <b>Choose photos or videos</b>.",
            "Up to 60 at a time, 50 MB each. Photos and MP4 or MOV videos work.",
            "Copies you already added are skipped automatically.",
            "Tap <b>Add 5 files to the Capsule</b> (it counts your files). Keep the screen open until it finishes.",
        ]),
        ("Share and say thanks", [
            "Tap <b>Invite</b> to send the album link to your group chat so others add theirs.",
            "Spot your kid in someone's photo? Tap <b>Thank you, that's my kid!</b> Only you and the photographer see it.",
            "Your thank-yous and stats live in <b>My Capsule</b>. Tap your picture at the top.",
        ]),
    ],
    note_items=[
        ("Albums open on the day", "Each event takes uploads from 12:01 a.m. on event day and stays open. Before that the button says when it opens."),
        ("Remove your own photo", "Open it, tap <b>Delete</b>, then <b>Confirm deletion</b>."),
        ("A photo of your child you want down", "Open it, tap <b>Report</b>, and choose <b>Please remove a photo of me or my child</b>. RCAP reviews it."),
        ("House leaderboard", "Tap <b>Leaderboard</b> in any album to see which house has shared the most."),
    ],
    contact="rcaparents@ronclarkacademy.com",
)

# ------------------------------------------------------------ Carpool
guide(
    "carpool", "Carpool",
    "Find RCA families near you and set up a shared ride.",
    title="How to find a carpool",
    desc="Add your family, find RCA families near you, and set up a shared ride. Your address stays private.",
    og="/carpool-og.png",
    eyebrow="How-to · Carpool",
    lede="Only if it helps. Find RCA families who live near you and drive the same days, then plan the ride together.",
    tool_href="/carpool/", tool_label="Open carpool",
    meta="wearercap.org/carpool · Completely optional",
    callout="<strong>Your address is never shared.</strong> Other families see only your area, your names, and your schedule. Phone and email appear only inside a group you join.",
    step_items=[
        ("Add your family", [
            "Tap <b>Continue with Google</b> first, the quickest way in. Or skip it and use your email.",
            "Enter your name, your children's names, and <b>A spot near you</b>. Pick it from the list that appears.",
            "Choose morning, afternoon, or both, and the days you need.",
            "If you used email, type the 6-digit code we send and tap <b>Verify my code</b>.",
        ]),
        ("Wait for approval", [
            "RCAP approves each family before it can see others. Until then you see how many families are nearby.",
        ]),
        ("Find families near you", [
            "Open <b>Explore nearby families</b> to see who lives close and which days you share.",
            "To look farther out, open <b>Your account</b> and move <b>Show families within</b>.",
        ]),
        ("Join a group and plan", [
            "Under <b>Groups near you</b>, check the box to share your contact info, then tap <b>Request to join</b>.",
            "Once the organizer accepts, you see everyone's phone and email.",
            "Tap <b>Start our group text</b> to get everyone in one thread and plan who drives when.",
        ]),
    ],
    note_items=[
        ("Meet before the first ride", "Get together first and ask the questions you would ask any parent you are trusting with your kid."),
        ("Use a public meeting point", "A church, school, or store works well. Never put a home address as a meeting point."),
        ("Change your details", "Go to <b>Your account</b>, then <b>Edit my family</b>. Tap <b>Leave group</b> to stop sharing with a group."),
        ("Want to start a group?", "Email carpool@wearercap.org to be set up as an organizer."),
    ],
    contact="carpool@wearercap.org",
)

# ------------------------------------------------------------ Uniform Exchange
guide(
    "uniform-exchange", "Uniform Exchange",
    "Ask for gently loved uniform pieces, or pass yours along.",
    title="How to use the Uniform Exchange",
    desc="Ask for gently loved RCA uniform pieces or donate yours. No account needed.",
    og="/uniform-exchange-og.png",
    eyebrow="How-to · Uniform Exchange",
    lede="Uniforms that keep moving. Ask for a piece your student needs, or pass along what they have outgrown. No account needed.",
    tool_href="/uniform-exchange/", tool_label="Open the exchange",
    meta="wearercap.org/uniform-exchange · Free for every RCA family",
    callout="<strong>Save 404-566-7741 in your contacts.</strong> Every update comes by text from that number, and iPhones can hide texts from unknown senders.",
    step_items=[
        ("Ask for an item", [
            "Tap <b>I'm looking for an item</b>.",
            "Tap <b>For a Girl</b> or <b>For a Boy</b>, then pick your house, the item, and the size.",
            "Tap <b>Add</b> to add it to your request. Up to 2 items per request.",
            "Enter your name, your student and grade, and your cell number. Tap <b>Send my request</b>.",
        ]),
        ("Choose how it gets to you", [
            "Most pieces go <b>Student to student</b>: the bin holder's student brings it to yours at school.",
            "Tap <b>Send it with their student</b>, or <b>Decide later</b>.",
            "If nothing matches yet, you go on the waitlist and get a text when it comes in.",
        ]),
        ("Close it out", [
            "Once it is in your hands, open your text link and tap <b>Got it</b>.",
            "Lost the link? Tap <b>My requests</b>, enter your number, and tap <b>Text me my link</b>.",
        ]),
    ],
    extra_label="Donating",
    extra_steps=[
        ("Offer what you have", [
            "Tap <b>I have clothes to donate</b>.",
            "Enter your name, house, cell number, and what you have. Tap <b>Offer it up</b>.",
            "Your house's bin holder texts you to arrange pickup.",
            "Gently loved, freshly washed, stain-free, and still true in color.",
        ]),
    ],
    note_items=[
        ("Who holds the bins", "RCAP parent volunteers in each house. Your own house's bin is checked first."),
        ("Not sure of the size?", "Ask anyway and say so in the notes."),
        ("Private by design", "Your name and request are seen only by you, your bin holder, and RCAP."),
        ("Your link is a key", "The link in your texts opens your requests. It does not expire, so keep it to yourself."),
    ],
    contact="hello@wearercap.org",
)

# ------------------------------------------------------------ Index
index = [HEAD.format(title="How-to guides", desc="Plain, step-by-step guides for the tools RCAP built for RCA families.",
                     og_image="")]
index.append(hero("How-to guides", "How to use the RCAP tools",
                  "Short, step-by-step guides for the tools we built for RCA families. Open one on your phone, or print it for the fridge.",
                  "/#tools", "See all the tools", "wearercap.org/how-to", printable=False))
index.append('<main><div class="wrap"><div class="cards">')
for slug, name, blurb in GUIDES:
    index.append(f'<a class="card" href="/how-to/{slug}/"><div><h2>{name}</h2><p>{blurb}</p></div><span class="go">Read the guide &rarr;</span></a>')
index.append("</div></div></main>")
index.append(FOOT.format(contact="rcaparents@ronclarkacademy.com"))
(ROOT / "index.html").write_text("\n".join(index))
print("built", len(GUIDES), "guides")
