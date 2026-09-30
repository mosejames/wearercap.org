import { describe, expect, it } from 'vitest';
import {
  DEFAULT_UPLOAD_PROMPTS, galleryShareMessage, promosWithVoice, uploadPromptsFor, uploadPromptSlots,
} from './galleryVoice.js';

describe('Capsule gallery voice', () => {
  it('presses harder when only one or two families have shared', () => {
    expect(uploadPromptSlots(70, 1)).toEqual([6, 14, 22, 30, 38, 46, 54, 62, 70]);
    expect(uploadPromptSlots(70, 4)).toEqual([8, 20, 32, 44, 56, 68]);
    expect(uploadPromptSlots(70, 8)).toEqual([12, 32, 52]);
    expect(uploadPromptSlots(70, 10)).toEqual([16, 56]);
  });

  it('still asks once in a short populated gallery', () => {
    expect(uploadPromptSlots(3, 1)).toEqual([3]);
    expect(uploadPromptSlots(0, 1)).toEqual([]);
  });

  it('uses generated upload, promotion, and sharing copy when available', () => {
    const customPrompts = DEFAULT_UPLOAD_PROMPTS.map((prompt, i) => ({ ...prompt, title: `Custom ${i}` }));
    const voice = {
      uploadPrompts: customPrompts,
      shareIntro: 'B-4 you forget, Bingo Night has receipts.',
      promoCopy: [{ id: 'membership', variants: [{ title: 'Back the next winning night.' }] }],
    };
    expect(uploadPromptsFor(voice)[0].title).toBe('Custom 0');
    expect(promosWithVoice([{ id: 'membership', variants: [{ title: 'Generic' }] }], voice)[0].variants[0].title)
      .toBe('Back the next winning night.');
    expect(galleryShareMessage({ title: 'Bingo Night' }, 'https://example.com/bingo', 'every RCA family', voice))
      .toContain('B-4 you forget');
  });

  it('keeps polished fallbacks when a voice is missing or incomplete', () => {
    expect(uploadPromptsFor(null)).toBe(DEFAULT_UPLOAD_PROMPTS);
    expect(uploadPromptsFor({ uploadPrompts: [DEFAULT_UPLOAD_PROMPTS[0]] })).toBe(DEFAULT_UPLOAD_PROMPTS);
    expect(galleryShareMessage({ title: 'Field Day' }, '/field-day', 'every RCA family', null))
      .toContain("Field Day: let's relive the fun!");
  });
});
