import { describe, expect, it } from 'vitest';
import {
  clampRange,
  computePannedRange,
  computeZoomedRange,
  getFullRange,
} from '../chartZoom';

describe('chartZoom', () => {
  it('returns full range for valid and empty datasets', () => {
    expect(getFullRange(0)).toEqual({ start: 0, end: 0 });
    expect(getFullRange(10)).toEqual({ start: 0, end: 9 });
  });

  it('zooms in and out around the center without exceeding bounds', () => {
    const full = getFullRange(20);
    const zoomed1 = computeZoomedRange(full, 20, 'in');
    expect(zoomed1.end - zoomed1.start + 1).toBeLessThan(20);
    expect(zoomed1.start).toBeGreaterThanOrEqual(0);
    expect(zoomed1.end).toBeLessThan(20);

    const zoomed2 = computeZoomedRange(zoomed1, 20, 'in');
    expect(zoomed2.end - zoomed2.start + 1).toBeLessThan(zoomed1.end - zoomed1.start + 1);

    // Zooming all the way out returns to full range
    let out = zoomed2;
    for (let i = 0; i < 6; i++) {
      out = computeZoomedRange(out, 20, 'out');
    }
    expect(out).toEqual(full);
  });

  it('respects minimum visible window of 3 items', () => {
    let range = getFullRange(10);
    for (let i = 0; i < 10; i++) {
      range = computeZoomedRange(range, 10, 'in');
    }
    expect(range.end - range.start + 1).toBe(3);
  });

  it('pans left and right while preserving window size and clamping to bounds', () => {
    const zoomed = { start: 4, end: 9 }; // window size 6 of 15
    expect(computePannedRange(zoomed, 15, 2)).toEqual({ start: 6, end: 11 });
    expect(computePannedRange(zoomed, 15, 100)).toEqual({ start: 9, end: 14 });
    expect(computePannedRange(zoomed, 15, -100)).toEqual({ start: 0, end: 5 });
  });

  it('clamps out-of-bounds ranges safely', () => {
    expect(clampRange({ start: -5, end: 50 }, 12)).toEqual({ start: 0, end: 11 });
    expect(clampRange({ start: 20, end: 25 }, 12)).toEqual({ start: 11, end: 11 });
  });
});
