# Newsletter submissions and attachments

Public form: `/newsletter/submit/`. Private inbox: Newsletter Builder, Submissions.

The existing campaign-activity dispatcher accepts intake actions. `submit` and
`uploadSession` use the intake burst limit. A one-hour HMAC capability permits
six numbered attachment writes for a single random submission ID. Each slot is
write-once. Finalized submissions cannot accept new public attachment writes.

Attachments allow JPEG, PNG, WebP and PDF content, checked by signature and size.
HEIC and larger photos are converted in the browser with the shared image
preparation helper. Each transmitted file must be at most 3 MiB, keeping base64
requests and responses under the hosting function payload limit. PDF flyers
are downloaded, not embedded in the editor.

Files use the shared R2 configuration, with no Supabase Storage fallback:
`_newsletter/intake-files/{submissionId}/{index}`. Bytes and metadata are wrapped
in the existing authenticated encryption helper using LONDON_IMPORT_STATE_KEY.
The bucket never receives a readable public rendition for these submissions.
Submission records under `_newsletter/intake/` include attachment metadata only.

`attachment`, `inbox` and `review` require the existing invited-editor RPC gate.
Attachment reads also require membership in the requested submission's file list.
Public upload tokens do not grant read access. JSON responses are no-store.
Editors can preview photos and download original accepted files. Attachments are
not automatically copied into public newsletter media or published.

Upload expiration closes the write capability; it does not delete stored files.
Archiving hides an editorial item and retains its files. There is currently no
automatic retention purge, malware scan, or direct video/Office-document upload.
