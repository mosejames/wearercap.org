import { describe, it, expect } from 'vitest';
import { followSheetViewport } from './sheetViewport.js';

describe('sheet visible area', () => {
  it('follows keyboard opening, Safari panning, and keyboard closing, then cleans up', () => {
    const browser = Object.assign(new EventTarget(), { innerHeight: 844 });
    const viewport = Object.assign(new EventTarget(), { height: 844, offsetTop: 0 });
    browser.visualViewport = viewport;
    const element = { style: {} };
    const stop = followSheetViewport(element, browser);
    expect(element.style).toEqual({ top: '0px', height: '844px' });
    viewport.height = 360;
    viewport.dispatchEvent(new Event('resize'));
    expect(element.style.height).toBe('360px');
    viewport.offsetTop = 72;
    viewport.dispatchEvent(new Event('scroll'));
    expect(element.style.top).toBe('72px');
    viewport.height = 844;
    viewport.offsetTop = 0;
    viewport.dispatchEvent(new Event('resize'));
    expect(element.style).toEqual({ top: '0px', height: '844px' });
    stop();
    viewport.height = 200;
    viewport.dispatchEvent(new Event('resize'));
    expect(element.style.height).toBe('844px');
  });
  it('uses window height when the visual viewport API is unavailable', () => {
    const browser = Object.assign(new EventTarget(), { innerHeight: 700 });
    const element = { style: {} };
    const stop = followSheetViewport(element, browser);
    browser.innerHeight = 340;
    browser.dispatchEvent(new Event('resize'));
    expect(element.style).toEqual({ top: '0px', height: '340px' });
    stop();
  });
});
