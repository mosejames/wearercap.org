# London activity

Anonymous tracking runs on the London gallery and airport page. It does not
record names, phone numbers, comment text, IP addresses, or photo identifiers.
A random browser ID is hashed with the server key before storage. Each page
load counts as a visit. Unique visitors are approximate unique browsers.
Visible, recently used time is sampled every five seconds. Heartbeats run
every 30 seconds. After 60 seconds without interaction, time stops counting.
Closing or hiding the page sends a final update. Live visitors expire after
90 seconds. Browser blocking and interrupted requests can undercount activity.

Records are encrypted in R2 under _analytics/london/. The existing
LONDON_IMPORT_STATE_KEY encrypts them. No database schema change is needed.
Public R2 URLs reveal only ciphertext. Reports require the existing London
admin passphrase, verified with m3_pass_ok. No new credentials are required.
The /api/london-activity rewrite shares the m3-sign function to stay within
the project's function limit. Existing signing routes retain their behavior.

Open Admin in the gallery footer, then Activity. Reports refresh every minute.
The panel shows 1, 7, or 14 UTC calendar days, capped at 5,000 sessions. It
tracks photo opens, native video play events, successful shares or copies,
saved reactions, posted comments, and completed upload batches. Share events
measure initiating a share or copying a link, not whether the recipient reads
it. A repeated play can count again. Reactions count successful actions,
including toggles. A completed batch counts as one upload action.

Tracking begins at deployment. It does not reconstruct previous visits.
