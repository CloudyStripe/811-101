import { describe, expect, it } from 'vitest';
import { collectClaims } from '../../src/content-kit/claims.ts';
import { termKey, termKeysIn } from '../../src/content-kit/terms.ts';
import { LABEL_SPECS } from '../../src/pages/frequency-lab/scene/labels.ts';
import { FREQUENCIES } from '../../config/equipment.ts';
import { SETUPS, labState } from '../../src/signal/model.ts';
import {
  FREQUENCY_LAB,
  FREQUENCY_NOTES,
  TAGLINE,
  TERMS,
  labelDefinition,
} from './frequency-lab.ts';

/** Every string in the content, claims and instructions alike. */
function stringsIn(value: unknown, into: string[] = []): string[] {
  if (typeof value === 'string') into.push(value);
  else if (Array.isArray(value)) for (const v of value) stringsIn(v, into);
  else if (typeof value === 'object' && value !== null) {
    for (const v of Object.values(value)) stringsIn(v, into);
  }
  return into;
}

const claims = collectClaims(FREQUENCY_LAB);

describe('Frequency Lab content', () => {
  it('gives every claim a unique ID in the lab namespace', () => {
    const ids = claims.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^fl\.[a-z0-9.-]+$/);
  });

  it('never leaves text empty', () => {
    for (const s of stringsIn(FREQUENCY_LAB)) expect(s.trim().length).toBeGreaterThan(0);
  });

  it('defines every marked term', () => {
    const missing = stringsIn(FREQUENCY_LAB)
      .flatMap(termKeysIn)
      .filter((key) => !(key in TERMS));
    expect(missing).toEqual([]);
  });

  it('keys definitions the way the markup is read, and keeps them free of markup', () => {
    for (const [key, definition] of Object.entries(TERMS)) {
      expect(termKey(key)).toBe(key);
      expect(termKeysIn(definition.text)).toEqual([]);
    }
  });

  it('defines every 3D label wherever it shows', () => {
    for (const spec of LABEL_SPECS) {
      for (const setup of SETUPS) {
        if (spec.text[setup] === null) continue;
        expect(
          labelDefinition(spec.id, setup).text.length,
          `${spec.id} (${setup})`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('flags no claim as state-specific, since the lab teaches no state rules', () => {
    expect(claims.filter((c) => c.stateSpecific)).toEqual([]);
  });
});

describe('the frequency notes', () => {
  it.each(SETUPS)('%s: say the signal falls short exactly when the model says it does', (setup) => {
    for (const f of FREQUENCIES) {
      const fallsShort = FREQUENCY_NOTES[f].text.includes('fades out before the end of the block');
      expect(fallsShort, `${String(f)} Hz`).toBe(!labState(setup, f).works);
    }
  });
});

describe('the static page shell', () => {
  it('shows the same tagline the app does', async () => {
    const { readFile } = await import('node:fs/promises');
    const html = await readFile('training/frequency-lab/index.html', 'utf8');
    expect(html.replaceAll(/\s+/g, ' ')).toContain(TAGLINE.text);
  });
});
