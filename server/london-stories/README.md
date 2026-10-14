# London Instagram importer

Source collection and upload remain on the existing VM. Do not alter them.

Current collector accounts: @wynningeducation, @kimbearden, @ronclarkacademy,
@collinsclan6, @the.cam_, @tnwoo10, and @ronclark__.
The importer discovers account folders automatically, including new accounts.

Dropbox webhook: https://wearercap.org/api/london-stories-webhook
Only Originals/<account>/{jpg,jpeg,mp4} files are imported. JSON sidecars
provide the source account, media_pk, and taken_at. Sidecars are never gallery
items. A missing sidecar is retried by the durable Vercel queue.

The webhook echoes the verification challenge as plain text. POST requests
must have a valid X-Dropbox-Signature and the configured account ID. The
webhook acknowledges only after a durable queue send succeeds. The worker
lists changes with the stored Dropbox cursor and queues media before advancing
that cursor. Cursor resets cause a full deduplicated scan.

Destination: m3_photos, vault london-2028, album the-whole-adventure,
c84ac94b-6211-43d1-9a67-a7fe380263ee. The existing credit label provides the
From Their Stories filter. Photos keep their source timestamps. Captions and
scholar names stay empty. Original filenames are not carried into R2.

Identity: the existing SUPABASE_BOOTH_PHONE / SUPABASE_BOOTH_PASSWORD account.
Password grants match the current booth implementation. london_claim_account
and london_verified_owner supply the London owner. Uploads use london-sign.
No service role key or database schema changes are required.

Idempotency: UUID v5 of case-normalized source path plus Dropbox content hash.
An encrypted ledger also deduplicates media_pk, SHA256, and conservative
whole-image fingerprints. The initial seed includes hidden media. An R2
conditional lease serializes imports. Conditional cursor writes and durable
queue redelivery make interrupted scans safe to replay. Originals are checked
against Dropbox block hashes, and every R2 rendition is checked byte-for-byte.

Photos: original, 1800px JPEG, 560px JPEG. Videos: unchanged original stored as
orig.m4v (same MP4 bytes), JPEG poster renditions, and H264/AAC playback.mp4.
The viewing helper recognizes this archive convention without a database
column or a deployment for every new video.

Production-only environment settings:
DROPBOX_LONDON_APP_KEY, DROPBOX_LONDON_APP_SECRET,
DROPBOX_LONDON_REFRESH_TOKEN, DROPBOX_LONDON_ACCOUNT_ID,
LONDON_IMPORT_STATE_KEY (32 random bytes as hex).
Existing R2 and booth/Supabase settings are reused. Never put these in VITE vars.

Trigger: Dropbox webhook only. Vercel Queues is the durable processor, not a
second polling trigger. Topic london-instagram-import, region iad1. Retries
back off to 15 minutes with seven-day message retention. Check queue errors
in Vercel. A protected GET of the webhook with Bearer LONDON_IMPORT_STATE_KEY
returns cursor readiness and the latest worker result, without secret values.

The webhook goes quiet after 2026-10-18 23:59:59 America/New_York. Already
queued work may finish. Files captured after the cutoff are skipped. Nothing
is automatically deleted or moved. Test cleanup is performed explicitly.
