# Shared newsletter workspace

The builder homepage now uses full-page workspace views, saved in `?view=`.
Home, Newsletters, Calendar, Ideas, Submissions, and Performance are available to
invited editors. Team and owner activity settings remain owner-only in the UI;
existing database permissions still enforce invite/remove operations.

Calendar slots highlight every Wednesday without creating issues. The calendar
uses Eastern dates for planned and actual sends. A solid dot means a recorded
email send; an outlined dot means a plan. Website publication is never treated
as proof of an email send. Starter templates create a real draft, set its issue
date, and add a noon Eastern plan, which the editor can change or clear.
No automatic sending is implemented.

Issue lead, editorial stage, and discussion live with the existing encrypted
R2 plan object. The authenticated editor is the source of comment authorship.
Stage values cannot manufacture a Sent state; only a recorded actual send does.
Plan writes use conditional R2 updates. Workspace reads expose shared lead,
stage, and discussion to invited editors but exclude owner-only change history.

The ideas board lives at `_newsletter/editorial-board` in the shared R2 bucket,
using the existing encryption helper. Reads of a missing board return curated
travel and basketball suggestions without writing. Suggestions need confirmed
details, and do not automatically gain access to conversation memory or email.
The first edit persists the board. Every edit checks both a client revision and
an object ETag, preventing silent overwrites between editors.

Adding an idea to a newsletter creates an empty story section with its title.
The pitch remains private planning context. A deterministic block ID avoids
adding the same idea twice if linking must be retried. Submission copy can also
be added to an existing issue, with the same retry protection. Private attached
files are not automatically published or copied into public media storage.

All actions pass the existing invited-editor RPC gate. Assigned editors must
be in the editor list, and linked issues must exist. Comments are bounded and
rendered as React text. Team members refresh the workspace to see others' latest
changes; live presence and simultaneous rich-text editing are not included.

Starter version 2 includes editable sample copy, branded raster placeholders,
example action destinations, and a sample event countdown one week after the
issue date. These are examples, not confirmed event facts or real past photos.
Style checks flag remaining sample markers, template images, example links,
and the sample countdown label. The starter picker also offers read-only
previews via `?preview=weekly`, `?preview=event`, and `?preview=recap`.

When opening an old starter, the editor upgrades it only if its subject,
headline, opening, preview text, primary action, and section content are still
untouched. Section structure and defaults must match exactly. The upgrade keeps
existing signature, greeting, dateline, recipients, and other metadata, and uses
the issue revision to prevent overwriting a concurrent edit. Customized drafts
are left alone. New starters are already versioned and never rehydrated.

## Per-newsletter analytics

The editor Analytics dialog requests an authenticated report for its issue ID.
The server verifies editor access, loads the saved issue, and matches both its
ID and current slug before summarizing newsletter events. Client-supplied slugs
are ignored. Other newsletters, unattributed `current` events, and raffle-card
activity are excluded. Workspace Performance remains the cross-issue view.

The dialog shows web visits, tracked link clicks, daily trends, and ranked link
categories for 7, 30, or 90 days. Daily buckets use UTC. Generic signed-link
clicks historically lacked destination labels and remain grouped as Other
newsletter links; no historical detail is invented. Email opens, unique readers,
purchases, and completed sign-ups are not measured. The existing 5,000-event
scan limit remains visible when reached. No newsletter content is changed.
