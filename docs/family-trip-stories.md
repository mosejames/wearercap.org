# Family trip stories

URL: https://wearercap.org/family-trip-stories/

A short parent-perspective form for London, New York and Savannah. The newsletter invites two or three sentences and an optional photo by Tuesday afternoon, October 27, 2026. This is an editorial deadline, not an automatic form closure. No claim is made about who funded school travel.

Submissions use the existing public newsletter intake actions on `/api/campaign-activity`. Words and contact information are encrypted in the shared R2 intake store. The optional photo is resized on the phone to a web JPEG, then uploaded through the existing signed, limited attachment session and included in the final submission. The page waits for a confirmed save before showing success and preserves entered words after a failed request. No new database schema, storage bucket, authentication or serverless function is introduced.

Editors review contributions in Newsletter Workspace → Submissions. The title identifies the selected trip, category is Photos or recap, and the parent name/contact are retained. The permission text is recorded in the submission details. Nothing from this form is automatically posted publicly.

Mose requested one prechecked permission box stating that RCAP may use the parent's name, comments and photo. It must remain checked to submit. The earlier optional anonymity/name-choice menu was removed at his explicit direction. Email remains private. Parent status is self-declared through this parent-facing form, not independently verified.

Accepted photos: JPEG, PNG, WebP, HEIC/HEIF up to 30 MB before browser preparation. Prepared attachment must fit the existing 3 MB limit. The source photo is not committed or included in the site build.

`node scripts/create-family-trip-stories-og.mjs` builds the branded 1200 by 630 OG/Twitter image. `node scripts/create-trip-story-invite.mjs` builds the graphical upload invitation used in the newsletter. Both use RCAP colors and no student photos. Native select behavior is preserved with a large inset circular chevron.
