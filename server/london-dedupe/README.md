# London duplicate gate

The London signer checks uploads before returning any R2 upload permission.
Normal clients must send a SHA256 of the prepared original plus the JPEG
thumbnail for photos. Older pages receive a refresh message. Authorized admin
maintenance can still sign without the check, which permits intentional photo
replacements. The manual Instagram import script also sends these checks.

The encrypted R2 index is seeded from the audited gallery, including hidden
copies. Removed duplicate IDs point to their retained copies. Exact source
hashes from the Instagram ledger cover historical photos and videos. A signed
request refreshes missing photo fingerprints from the current gallery, so old
tabs or other approved routes are included too. No schema change is needed.

Photo comparison uses a 32px whole-image RGB fingerprint, aspect ratio, and
strict difference bounds. This is not facial recognition. Near-identical
bursts, crops, edits, and changed overlays remain separate. Only exact video
hashes are compared, never video posters. A changed encoding may not match.

Conditional R2 writes serialize reservations across sign requests. Pending
uploads expire after 20 minutes. The next check confirms reservations against
actual published rows. Failed or interrupted uploads can be retried after the
reservation expires. Native uploads also derive the photo UUID from the hash,
so a concurrent delivery cannot create two rows with the same file. Same-batch
files are skipped locally. Skips do not upload renditions or insert rows.

The existing LONDON_IMPORT_STATE_KEY protects the index and encrypted seed.
Nothing is automatically deleted, hidden, replaced, or upgraded. Existing
quality, credits, comments, and reactions are retained. Intentional maintenance
remains separate. Comparison is conservative and cannot catch every edited copy.
