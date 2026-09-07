# The RCAP Directory

Public business listings at `/directory/`, with Google or email magic-link sign-in for owners. Uses the existing Supabase project and browser client. Homepage entry is in the Resources section and footer.

## Owner experience

An account can manage multiple parent or student ventures. Each listing has a name, one category, a 600-character bio, service area, business email, phone, website, and booking/shop/social link. Five photos maximum; the first is the cover and can be changed. Photos accept JPEG, PNG, or WebP up to 5 MB each. Student ventures are parent managed.

Save as draft also takes a published listing offline. Preview does not save changes. Removed photos are deleted only after the updated listing saves. Cancel removes newly uploaded photos but keeps the previously saved listing intact. Interrupted uploads or closing the browser can leave unreferenced private images; these need eventual storage cleanup.

## Access and deployment

Migration: `20260907172254_community_directory.sql`. Applied to the RCAP project and recorded in migration history on September 7, 2026.

RLS allows public reads of published listings and owner-only writes and draft reads. Family affiliation is self-attested at publication, not verified through the carpool approval system. Owners cannot reassign listings. The database caps photo references at five and restricts them to the owner's listing folder. There is no administrator moderation screen in this release; listing concerns route to the existing RCAP contact email.

The private `directory-photos` bucket allows owners to upload and read their own images. Visitors can obtain signed image URLs only for photos attached to a published listing. Already issued links expire after an hour, so taking a listing offline does not revoke an existing image link instantly. Google and email providers are enabled on the existing project.

The following exact auth return addresses were added, preserving all existing carpool addresses:

- `https://wearercap.org/directory/?view=manage`
- `http://127.0.0.1:5173/directory/?view=manage`
- `http://localhost:5173/directory/?view=manage`

The shared authentication email sender is currently branded RCAP Carpool. Changing that shared sender affects the other apps and is separate from the directory's implementation.

## Verification

`npm run build` and `npm test`. Local tests require the existing Supabase URL and publishable key in `.env` as described by the root AGENTS.md.

`supabase/tests/directory-access.sql` checks draft privacy, public published reads, owner updates, owner reassignment protection, foreign-photo rejection, and cross-account edit/delete denial inside a rolled-back transaction. It uses two existing user IDs but never changes their accounts or retains test listings.

The editor tests cover unpublishing, save failures, publication consent, and removing images only after saving. Browser checks cover desktop/mobile rendering, directory loading, and reaching the Google account chooser. Completing an actual Google or email sign-in and submitting a real listing remains the final user acceptance check.

The Supabase security advisor reports three pre-existing security-definer views in other apps (`ue_inventory`, `ue_commitments`, `vault_people`). No directory security advisor errors were reported.
