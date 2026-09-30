export const DEFAULT_UPLOAD_PROMPTS = [
  {
    eyebrow: 'Your turn, families',
    title: 'One parent cannot be the whole photo department.',
    body: 'If you took even one good picture, rescue it from your camera roll and add it here.',
    cta: 'Help fill the album',
  },
  {
    eyebrow: 'Camera roll check',
    title: 'We know somebody got the good angle.',
    body: 'Share the one where everyone is looking at the same camera. That alone is historic.',
    cta: 'Share that photo',
  },
  {
    eyebrow: 'A tiny bit of peer pressure',
    title: 'Please do not make one family carry this whole album.',
    body: 'A few photos from each family will tell a much better story than one heroic camera roll.',
    cta: 'Do your part',
  },
  {
    eyebrow: 'Plot twist',
    title: 'You also have an upload button.',
    body: 'Your camera roll has been rehearsing for this moment. Let a few pictures shine.',
    cta: 'Add a few photos',
  },
  {
    eyebrow: 'Be part of the evidence',
    title: 'Yes, your photos count.',
    body: 'Blurry joy, snack-table candids, and the moment before everyone posed are all welcome.',
    cta: 'Add your evidence',
  },
  {
    eyebrow: 'The gallery is asking nicely',
    title: 'Please add the photos you almost forgot about.',
    body: 'Future us will be glad you did. Present us will stop asking quite so often.',
    cta: 'Make future us happy',
  },
  {
    eyebrow: 'Friendly reminder',
    title: 'The group chat saw those pictures. We should too.',
    body: 'Pick a few favorites and give the whole school a fuller view of the night.',
    cta: 'Bring them over',
  },
  {
    eyebrow: 'One more nudge',
    title: 'Your photos, or another reminder card. Choose wisely.',
    body: 'Share a few and help this album look like all of us were actually there.',
    cta: 'End the reminders',
  },
  {
    eyebrow: 'Still scrolling?',
    title: 'Excellent. You have time to upload, then.',
    body: 'It only takes a minute, and this gallery gets much better when more families join in.',
    cta: 'Add photos now',
  },
];

// Keep the reminders intentionally frequent while one or two families are
// carrying an album. As more families join, widen the gaps automatically.
export function uploadPromptSlots(photoCount, contributorCount) {
  const photos = Math.max(0, Number(photoCount) || 0);
  const contributors = Math.max(0, Number(contributorCount) || 0);
  if (!photos) return [];

  let first = 16;
  let every = 40;
  if (contributors <= 2) {
    first = 6;
    every = 8;
  } else if (contributors <= 5) {
    first = 8;
    every = 12;
  } else if (contributors <= 9) {
    first = 12;
    every = 20;
  }

  const slots = [];
  for (let at = Math.min(first, photos); at <= photos; at += every) {
    slots.push(at);
    if (at === photos) break;
  }
  return slots;
}

export function uploadPromptsFor(voice) {
  return voice?.uploadPrompts?.length === 9 ? voice.uploadPrompts : DEFAULT_UPLOAD_PROMPTS;
}

export function promosWithVoice(promos, voice) {
  const custom = new Map((voice?.promoCopy || []).map((item) => [item.id, item.variants]));
  return promos.map((promo) => custom.has(promo.id) ? { ...promo, variants: custom.get(promo.id) } : promo);
}

export function galleryShareMessage(event, url, audience, voice) {
  const fallback = `${event.title}: let's relive the fun! Take a peek at the gallery, then check your camera roll for the smiles, laughs, and unforgettable moments.`;
  return `${voice?.shareIntro || fallback} Add yours and help ${audience} keep the memories together: ${url}`;
}
