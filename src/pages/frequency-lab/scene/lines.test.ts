import { describe, expect, it } from 'vitest';
import { screenCellOffset } from './lines.ts';

describe('screenCellOffset', () => {
  it('shows each reading from its own cell, filling the canvas from the top left', () => {
    // Eight readings: two columns, four rows. The canvas's top row is at v = 1.
    expect(screenCellOffset(0, 4)).toEqual([0, 0.75]);
    expect(screenCellOffset(1, 4)).toEqual([0.5, 0.75]);
    expect(screenCellOffset(2, 4)).toEqual([0, 0.5]);
    expect(screenCellOffset(7, 4)).toEqual([0.5, 0]);
  });
});
