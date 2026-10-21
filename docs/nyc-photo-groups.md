# NYC photo groups

One NYC vault, two group views. Filter links: `/nyc-vault/?group=A` and `/nyc-vault/?group=AA`. The same filter works on `/nyc-sendoff/`.

Uploaders choose Group A, Group AA or Both groups above the photo fields. A group is required for new uploads, applies to the entire batch, and is remembered on that device under `nyc-upload-group`. Gallery filters do not silently change the upload destination. Both-group and older unassigned photos appear in either group view. Only the uploader can correct an existing photo in its viewer using Photo group and Save group.

The additive migration preserves the previous upload RPC for already-open tabs. New clients use `trip_add_grouped_photo`, which wraps the existing validated upload transaction and writes the group atomically. `trip_set_photo_group` enforces ownership, vault, visibility and valid group values. No raw table grants were added. The gallery RPC includes the group. Storage paths and exact-photo share cards are unchanged. Dropbox video collection remains separate and has no automatic group assignment.

Validation: 872 tests passed. Live transactional database checks verified grouped insertion, A to AA to both corrections, rejected invalid labels and unauthorized IDs, denied anonymous writes and raw table updates. All test row changes were rolled back; the existing photo labels were left unchanged. Security advisor results for the trip tables are the existing informational RLS-without-policies notices: tables have no direct grants and are accessed through scoped functions.
