import { describe, expect, it } from 'vitest';
import { linearRegression, weightedRegression } from '../services/forecast.js';

describe('linearRegression', () => {
  it('recovers a perfect linear relationship', () => {
    const xs = [0, 1, 2, 3, 4];
    const ys = [1, 3, 5, 7, 9]; // y = 1 + 2x
    const { slope, intercept } = linearRegression(xs, ys);
    expect(slope).toBeCloseTo(2, 10);
    expect(intercept).toBeCloseTo(1, 10);
  });

  it('handles a single sample', () => {
    expect(linearRegression([5], [42])).toEqual({ slope: 0, intercept: 42 });
  });

  it('handles empty input', () => {
    expect(linearRegression([], [])).toEqual({ slope: 0, intercept: 0 });
  });
});

describe('weightedRegression', () => {
  it('weights newer samples more heavily', () => {
    // Two regimes: early flat, late rising. Higher recency weight should
    // produce a steeper slope than an unweighted fit.
    const xs = [0, 1, 2, 3, 4, 5, 6, 7];
    const ys = [10, 10, 10, 10, 20, 30, 40, 50];
    const low = weightedRegression(xs, ys, 0);
    const high = weightedRegression(xs, ys, 1);
    expect(high.slope).toBeGreaterThan(low.slope);
  });

  it('is deterministic for identical input', () => {
    const xs = [0, 1, 2, 3];
    const ys = [1, 2, 4, 8];
    expect(weightedRegression(xs, ys, 0.5)).toEqual(weightedRegression(xs, ys, 0.5));
  });
});
