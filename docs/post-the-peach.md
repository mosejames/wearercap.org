# Post the Peach on wearercap.org

Public entry: `/post-the-peach/`. Private collection: `/post-the-peach/review/#<existing-private-token>`.

## Photo and sticker editor

Take a photo uses the phone camera; Upload a photo uses the photo library. Vertical 9:16 photos are recommended. The canvas is a full-bleed 1080x1920 photo, with drag, pinch, touch zoom and reset controls. There is no frame or fixed footer.

The visual sticker chooser offers RCA Votes, Ami, Bindi, Rêveur and Rizmo. Each choice places the supplied original PNG over the photo. Tapping a design adds another independent sticker. Tap any placed sticker to select it; only that sticker moves, resizes or rotates. Drag to move, pinch to resize, and twist two fingers to rotate. The round corner handle also resizes and rotates with one finger. Tapping the photo selects photo movement and pinch zoom. Remove selected sticker removes only the selected item. Sliders have been removed. Keyboard arrows move, plus/minus resize, and bracket keys rotate. The original PNG bytes and transparency are preserved. Touch the sticker to select and drag it; pinch and twist to resize and rotate it. Touch outside the sticker to move the photo. Explicit Move photo and Move sticker controls, keyboard arrows and plus/minus also support positioning. Remove sticker returns to the plain photo. The sticker stays within the image bounds.

Submitting freezes both layers and exports the visible composition to a separate canvas, without selection guides, as a metadata-stripped JPEG. Consent remains required. The existing completed-image wire marker `X-Photo-Frame: rca-votes-v1` is retained for compatibility with the existing backend; the saved pixels already contain the final composition, and no frame is added afterward. `X-Photo-Layout: story-v1`, rate limits, idempotency and the existing private R2 collection remain in place. New submissions never request `/api/post-the-peach/overlay`.

## Existing submissions and privacy

Existing completed photos are not modified or reframed. The private review page retains legacy pending-photo finalization for older open clients, using the already installed frame, but no longer offers frame installation as part of the current workflow. Photo list, downloads and removals still require the existing private capability. No credentials, storage or access rules change. There is no public gallery or automatic Instagram posting.

Vercel external API rewrites forward binary uploads and protected collection requests to the existing Post the Peach backend. The branded 1200x630 share card and Twitter large-image metadata remain on the public page.
