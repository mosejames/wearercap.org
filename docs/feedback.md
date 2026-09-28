# RCAP Feedback Studio

Public karaoke survey: `/feedback/rb-karaoke`.
Organizer dashboard: `/feedback/admin`, also linked from the RCAP Capsule back office.

Leadership enters the existing RCAP Capsule passcode. Leadership can issue labeled,
90-day organizer invitations and revoke them. Invitations are bearer links; share
privately with one organizer. Their secret is removed from the URL after opening,
kept only in memory, and hashed in the database. Reloading requires reopening the
invitation. No respondent needs an account. The survey's Supabase client does not
reuse Capsule authentication, persist sessions, or collect visitor identity.

## Authoring

Create or duplicate a survey, edit 1–12 questions, choose whether to offer Voices
of RCAP, and preview before publishing. The five answer styles are rating,
compact ratings, choose one, choose a few, and written response. Multi-choice
`other` requests a short explanation. Published definitions are frozen; duplicate
to revise them without changing the meaning of existing answers. Surveys can be
closed and reopened. Organizers manage only their own surveys; leadership sees all.

The AI question partner sends only the organizer's event brief and current draft
to OpenAI's Responses API with `store:false`. It does not send parent answers or
recordings. It generates editable drafts, never publishes. Set server-only
`OPENAI_API_KEY` in Vercel Production before deploying. Optional
`FEEDBACK_OPENAI_MODEL` overrides the documented default model `gpt-6-astra`.
The database caps drafting requests at 20 per organizer per hour. The manual
editor and ChatGPT copy/import workflow work without an API key.

## Data and permissions

`feedback_private.surveys`, `responses`, `insights`, `organizers`, and `voices`
are not exposed through the Data API. They have RLS enabled and no direct client
table grants. Their no-policy advisor notices are intentional deny-all defense
in depth; access goes through the bounded `public.rcap_feedback` invoker wrapper
and private validated dispatcher. No new advisor warnings/errors are expected.
See [Supabase's no-policy explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

Responses contain only random ID, survey ID, timestamp and answers. The only
respondent local-storage entry is `rcap-feedback:<survey id> = submitted`, a soft
shared-device duplicate guard. No visit/abandonment records are collected, so
completion rate is explicitly unavailable. Random response IDs make retries
idempotent. Unknown answer keys and invalid choices are rejected by the database.

Audio has a separate random ID and no link to written responses. Each voice
requires an explicit `private` or `community` permission. No default is selected.
The private `rcap-feedback-voices` bucket permits only capability-authorized new
uploads, supported audio MIME types, and at most 2 MiB. The recorder stops at 30
seconds; metadata duration must be 0–30 seconds. Uploads cannot overwrite files.
Incomplete upload reservations do not appear in results. Failed upload retries
retain the recording; changing its permission after reservation requires redoing
it. Leadership can hear all notes; organizers can hear only community-permitted
notes for their own events, through five-minute signed playback URLs. Sharing
permission does not automatically publish audio anywhere.

Results display per-question distributions and averages, excluding N/A from
rating denominators while reporting its count. They include text responses,
voice permissions, organizer-written insights, and CSV export with formula
neutralization. No combined event score exists. Fundraising is separate.

## Verification

- `npm run build` and `npm test`.
- `supabase/tests/feedback.sql` uses a rollback-only transaction to test anonymous
  writes, required questions, unexpected identity keys, scoped organizer access,
  revocation, published-definition freezing, and audio permissions.
- `scripts/feedback-browser.mjs` exercises a temporary event on mobile using
  Chrome's fake microphone, including real Supabase submission/upload/playback.
  Set `FEEDBACK_FIXTURE` to a local JSON fixture and `FEEDBACK_BASE` to the server.
  Fixtures are created and removed separately; never run writes against real
  parent responses. Screenshots and fixture secrets are not committed.

Main code: `src/feedback/`, `api/feedback-draft.js`, `feedback/index.html`.
Routing/build entries: `vercel.json`, `vite.config.js`.
