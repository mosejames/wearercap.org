import { describe, expect, it } from 'vitest';
import { creativeDirectionFor, validGalleryVoice } from './vaultVoice.js';

const card = (n = 1) => ({
  eyebrow: `Prompt ${n}`,
  title: `A custom title ${n}`,
  body: `A useful and gallery-specific body for card ${n}.`,
  cta: `Add photos ${n}`,
});

const voice = (promoIds = []) => ({
  uploadPrompts: Array.from({ length: 9 }, (_, i) => card(i + 1)),
  shareIntro: 'This gallery has a custom invitation with enough useful detail for families.',
  promoCopy: promoIds.map((id) => ({ id, variants: [card(1), card(2), card(3)] })),
});

describe('gallery voice validation', () => {
  it('accepts one complete, event-specific voice kit', () => {
    expect(validGalleryVoice(voice(['collective', 'suggestion-box']), ['collective', 'suggestion-box'])).toBe(true);
  });

  it('accepts custom copy for every available promotional card', () => {
    const promoIds = ['karaoke-feedback', 'karaoke-sept-27', 'membership-2026', 'karaoke-booth-gallery', 'karaoke-event-gallery', 'collective', 'suggestion-box'];
    expect(validGalleryVoice(voice(promoIds), promoIds)).toBe(true);
  });

  it('requires nine upload prompts and every requested promotion', () => {
    const missingPrompt = voice();
    missingPrompt.uploadPrompts.pop();
    expect(validGalleryVoice(missingPrompt)).toBe(false);
    expect(validGalleryVoice(voice(['collective']), ['collective', 'suggestion-box'])).toBe(false);
  });

  it('rejects user-facing em dashes', () => {
    const invalid = voice();
    invalid.shareIntro = 'A gallery invitation that uses an em dash — and therefore cannot ship.';
    expect(validGalleryVoice(invalid)).toBe(false);
  });

  it('gives restaurant and event galleries distinct creative direction', () => {
    expect(creativeDirectionFor({ title: 'Chipotle Spirit Night' })).toContain('burrito');
    expect(creativeDirectionFor({ title: 'Chick-fil-A Spirit Night' })).toContain('waffle-fry');
    expect(creativeDirectionFor({ title: 'Bingo Night' })).toContain('dabber');
    expect(creativeDirectionFor({ title: 'R&B Karaoke Night' })).toContain('encore');
  });
});
