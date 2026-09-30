import { describe, expect, it } from 'vitest';
import { UPLOAD_PROMPTS, uploadPromptSlots } from './uploadPrompts.js';

describe('Capsule upload prompts', () => {
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

  it('has enough messages to avoid repeating in the most urgent gallery', () => {
    expect(UPLOAD_PROMPTS).toHaveLength(9);
  });
});
