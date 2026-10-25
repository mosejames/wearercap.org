# Calendar-aware editorial helper

The existing production OPENAI_API_KEY is read server-side only. No key is
created, rotated, copied into client bundles, or printed. NEWSLETTER_AI_MODEL
may override the default gpt-4.1 model. Requests use Responses API web search,
structured output, store:false, at most three tool calls and bounded output.

Inputs are the public RCA school calendar PDF, today's Eastern date, and the
editor's explicit planning prompt plus a short conversation history. Private
submissions, contact fields, uploaded photos, editor emails, and newsletter
drafts are not passed to OpenAI. The UI discloses the OpenAI connection and asks
editors to keep prompts general. No automatic publication or sending occurs.

General suggestions are cached in encrypted shared R2 storage for 24 hours.
Opening Home or Ideas refreshes stale suggestions on demand. This is not a
scheduled background job. A conditional R2 lease prevents concurrent refreshes.
On refresh failure, previously sourced suggestions remain visible with a stale
notice. Without cached suggestions, a clear error is shown. Warm-instance
per-editor limits cap AI calls at eight per hour; account/project limits also
apply. The hosting function has a 180-second bound; upstream calls time out
at 90 seconds.

Search is restricted to selected government, school and international-agency
sources. Model-provided citations must match actual search sources or the exact
public school calendar. Tracking parameters are normalized before matching. Additional cited pages may
be checked directly over HTTPS on the same restricted official domains; redirects
are revalidated and unavailable pages are excluded. General refreshes must
include a grounded external-calendar idea before being cached.
Invalid or out-of-window dates and ungrounded external suggestions are dropped.
Calendar ideas are editorial proposals, not independently guaranteed facts:
editors still confirm details before publication. Civic suggestions must be
factual and nonpartisan. Public holidays never imply school closures.

The Ideas page offers a conversational prompt and compact sourced suggestions.
Saving an idea requires one action. Assignments, status, issue selection, and
confirmation controls remain available inside optional Planning details.
