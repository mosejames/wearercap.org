# Activation completed

The user approved NYC database activation and publication on October 20, 2026. The send-off page is live at https://wearercap.org/nyc-sendoff/ and the shared album at https://wearercap.org/nyc-vault/. The approved schema was applied to kcsrtwwpnekqdrfgcfys and recorded as migration 20261021021846_nyc_shared_gallery.sql.

Verification passed: full build and 869 tests; rollback-only SQL checks under anonymous and authenticated roles; actual signed R2 uploads of original/web/thumb; browser upload CORS; the same synthetic image visible in both galleries; same-byte duplicate skipping; exact-photo link opening the actual image in the browser; social crawler image retrieval; fresh hidden-photo fallback with no-store; branded page share cards. Test photo was hidden afterward and the synthetic account disabled, with its sessions revoked. No real texts or emails were sent, so actual SMS delivery was not tested in this session. London remained at 907 photos before and after activation; its page still loads.

Database advisors reported only INFO notices for the two intentionally private RLS tables with no direct grants or policies. Narrow private definer functions and public invoker wrappers are the only access paths. Other project notices predate this work and were not modified.

Videos remain in the approved NYC Dropbox collection until separately prepared for the gallery. No automatic video ingestion or Instagram collection is enabled.

---

# NYC send-off activation review

Prepared October 20 for the confirmed Class of 2029 trip, October 21–23.

## Ready for review

Local preview: http://127.0.0.1:5186/nyc-sendoff/ . Proposed public address: https://wearercap.org/nyc-sendoff/ .

Parent page includes packing, leaving home, airport hugs and smiles. No response starters, quote cards, captions or comment fields. Parent and scholar names identify the contribution. A separate video option points to the approved NYC Dropbox request, https://www.dropbox.com/request/tyv8e6kq7zeoaj18ywsk . Videos require preparation before entering the album; no automatic importer is configured or promised.

Send-off photos use the `send-off` album. Chaperones use `the-whole-adventure`. The main NYC gallery reads both; the send-off page reads only send-off photos. Parent-only describes the contribution experience, matching London's parentOnly UI. It is not a verified family-role access restriction. SMS sign-in establishes upload ownership, not the contributor's relationship to the school.

## Approval needed before activation

The original handoff requires approval before database schema changes. No production schema changes have been made, and these edits have not been published.

Review `nyc-shared-gallery.sql` beside this file. This additive proposal creates private NYC photo metadata and request-rate records, plus narrowly scoped gallery/upload/removal functions. Existing London/M3 tables, functions, records, identities and media are untouched. It avoids reusing London's hardcoded account and permission functions. Photo bytes use the existing shared R2 bucket under `nyc-2026/`, with original, web and thumbnail renditions.

Gallery reads expose visible NYC records only, without account IDs, email addresses or phone numbers. Uploads require a verified account, NYC album allow-list, bounded photo inputs, rate checks and scoped object paths. Only the account that uploaded a photo can hide it through the app. Admin moderation can be performed by the database owner; no new public admin passphrase or bulk action is introduced.

Duplicate source bytes are skipped within the batch, checked before signing, and rejected atomically at metadata insertion. Simultaneous duplicate transfers may leave unreferenced R2 objects; they cannot create duplicate gallery records. Similar-looking but non-identical photos are retained. Hidden originals are retained in storage and never re-exposed by fresh share-card requests.

Signed upload URLs use the existing API dispatcher to stay within function limits. Exact-photo cards use the existing photo's web rendition and check visible NYC album membership on each request. Invalid/hidden/missing photos fall back to NYC's branded card. Send-off landing metadata has its own 1200×630 branded image and Twitter large-image tags.

## Verification and activation sequence

Build and automated tests run against the draft. React tests verify the parent funnel has no text-response fields, video contributions use NYC's approved link, send-off photos appear in both galleries, trip-only photos stay out of the parent gallery and uploads fail closed before activation. Signing tests cover authentication, invalid vault/album paths, duplicate skipping and missing database functions. Existing card tests cover exact-photo selection and hidden/wrong-vault fallbacks. The draft SQL has NOT been applied or database-tested yet.

After approval: generate a migration through the Supabase CLI if available, apply the reviewed SQL to the confirmed wearercap project `kcsrtwwpnekqdrfgcfys`, run rollback-only permission/ownership/isolation checks, inspect database advisors, then deploy and verify a synthetic upload from send-off through the main gallery and exact-photo share card. Hide the test record afterward. Only then provide the family-facing public link. Do not send anyone an invitation automatically.

Rollback: restore the previous frontend deployment if activation fails. Revoke new RPC execution to stop participation. Preserve all uploaded photos and metadata; do not drop populated tables or delete stored objects as an automatic rollback.
