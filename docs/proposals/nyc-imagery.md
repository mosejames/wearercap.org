# NYC destination imagery

The user requested NYC imagery as a subtle backdrop, dark blue and yellow, with a gradient fading into the page and minimal additional scrolling.

Implementation: one destination skyline behind the existing introduction on the main vault and send-off page. The tall luggage illustration was removed. Text stays over a navy overlay; yellow accents and upload buttons match the existing RCA palette. The bottom fades into the cream page. Recent contributed photos still come before the introduction once available. No itinerary or live-location claim is attached to the image. This is a single atmospheric background, not a scheduled slideshow.

Generated with the built-in image-generation tool. The image is an AI-created destination illustration in a photographic style, not a photo of the school trip.

Saved project assets:
- public/nyc/manhattan-backdrop.webp: 1600 pixels wide, approximately 127 KB.
- public/nyc/manhattan-backdrop-mobile.webp: 800 pixels wide, approximately 38 KB.
- public/nyc/nyc-vault-2029-navy-og.jpg: rebuilt branded 1200×630 share card.
- public/nyc/nyc-sendoff-2029-navy-og.jpg: rebuilt branded 1200×630 send-off card.

Final prompt:

Use case: photorealistic-natural. Asset type: compact background photograph for Ron Clark Academy Class of 2029 New York trip website. Create a wide cinematic but natural editorial photograph of the Manhattan skyline seen from across the East River, Empire State Building recognizable among the skyline, warm golden-hour windows and very subtle autumn light against deep navy blue atmosphere. Calm, welcoming, elegant, realistic architecture and water, no people. Compose skyline primarily in the upper-right and middle-right, with softly detailed dark blue sky and water on the left providing negative space for white headline text. Wide landscape composition approximately 16:9. Color palette: deep navy #1a2a56, muted blue, restrained warm yellow light #f0b323. It is a destination backdrop, not a depiction of the students or a specific itinerary. No text, no logos, no captions, no borders, no watermark, no collage, no dramatic fantasy buildings. Keep details atmospheric enough for a subtle low-weight background behind website text; do not add any UI or gradient text overlay.

Verification: main preview at 390px has no horizontal overflow and loads the mobile WebP. Desktop visually inspected for text contrast and bottom fade. The hero is shorter than the earlier send-off design with its separate luggage illustration. Build and full tests run after the visual changes. Shared database activation and publishing the send-off experience still await the original requested approval; no database changes have been applied.
