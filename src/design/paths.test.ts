/**
 * The diorama's paths: both fuels in APWA yellow, told apart by pattern, shape and icon, never by
 * color.
 */
import { describe, expect, it } from 'vitest';
import { APWA } from './apwa.ts';
import { hexToOklch } from './color.ts';
import { PATH_STYLE } from './paths.ts';

describe('path styles', () => {
  it('draws both fuel paths in APWA yellow, the code natural gas and petroleum share', () => {
    expect(PATH_STYLE.gas.color).toBe(APWA.yellow.fill);
    expect(PATH_STYLE.gasoline.color).toBe(APWA.yellow.fill);
  });

  it("tells every path apart by its pattern, its markers' shape and its icon", () => {
    const styles = Object.values(PATH_STYLE);
    expect(new Set(styles.map((s) => s.pattern)).size).toBe(styles.length);
    expect(new Set(styles.map((s) => s.shape)).size).toBe(styles.length);
    expect(new Set(styles.map((s) => s.icon)).size).toBe(styles.length);
    // The drop stands for water.
    for (const s of styles) expect(s.icon).not.toBe('water');
  });

  it('draws the shared start in a quiet neutral, not an APWA color', () => {
    expect(hexToOklch(PATH_STYLE.shared.color).c).toBeLessThan(0.04);
    for (const code of Object.values(APWA)) expect(PATH_STYLE.shared.color).not.toBe(code.fill);
  });
});
