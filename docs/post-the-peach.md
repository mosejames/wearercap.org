# Post the Peach on wearercap.org

Public entry: `/post-the-peach/`. Private collection: `/post-the-peach/review/#<existing-private-token>`.

The page retains the standalone design and offers two native phone inputs: Take a photo (`capture=user`) and Upload a photo. The exact PNG is uploaded directly through the private collection's Photo frame control. It is normalized to 1080x1920 on the device, preserving the artwork, and saved to the existing private backend's separate `config/overlay.png` object. No photo records or existing submissions are migrated, deleted, or made public. No new secret or user account is introduced.

Vercel's external API rewrites forward binary uploads and protected collection requests to the existing Post the Peach backend. Public access to the frame returns only the fixed artwork object. Photo list, downloads, removals and frame changes require the existing private capability. The backend allows the two wearercap.org origins for upload requests, preserves consent/rate/idempotency checks, and rejects obsolete clients without the frame-version header. The original public Sites URL redirects to the wearercap.org page after the coordinated backend release.

For a transparent frame, the photo is drawn underneath and the full original frame is drawn on top. For an opaque navy frame, the original artwork forms the background and the entire photo fits into the upper area, preserving the RCA Votes footer and avoiding face cropping. The framed JPEG is previewed before the permission checkbox and submit action. Output is 1080x1920; only the composed, metadata-stripped JPEG is retained.

The user's attached tall overlay is visible in chat but has not appeared as a materializable Library file in this executor. No substitute artwork is committed. The direct private-page frame upload is the supported workaround; the owner selects the actual PNG once in their browser. The public picker remains disabled until an actual frame is present. Real-artwork verification must follow that upload. Local tests use explicitly labeled synthetic frames only.

Validation: production build; existing 176 Vitest files / 1226 tests; backend tests; mobile 390px and desktop 1280px camera/gallery, direct frame setup, story dimensions, metadata removal, consent gating and submission. Real camera hardware, actual supplied art, and live external proxy calls require live verification. This executor cannot reach the public site hosts through its network proxy.
