/**
 * Claims: every factual sentence in the content carries a stable ID, so locators can sign it
 * off and edits put it back in review (see scripts/content-review.ts).
 */
import type { SourceId } from '../../content/sources.ts';

export interface Claim {
  readonly kind: 'claim';
  /** Stable ID, e.g. `fl.steel.fade`. Never reuse an ID for a different statement. */
  readonly id: string;
  /** The sentence as shown, possibly with [[term]] markup. */
  readonly text: string;
  /** True when the claim depends on a state's rules. */
  readonly stateSpecific: boolean;
  /** Context for the reviewer, e.g. "teaching calibration". */
  readonly note?: string;
  /** Where it comes from (content/sources.ts), or that it describes a lesson's scene or game. */
  readonly source?: readonly SourceId[];
}

export function claim(
  id: string,
  text: string,
  options: { stateSpecific?: boolean; note?: string; source?: readonly SourceId[] } = {},
): Claim {
  return {
    kind: 'claim',
    id,
    text,
    stateSpecific: options.stateSpecific ?? false,
    ...(options.note === undefined ? {} : { note: options.note }),
    ...(options.source === undefined ? {} : { source: options.source }),
  };
}

function isClaim(value: unknown): value is Claim {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { kind?: unknown }).kind === 'claim' &&
    typeof (value as { id?: unknown }).id === 'string'
  );
}

/** Every claim inside a content object, in document order. */
export function collectClaims(value: unknown, into: Claim[] = []): Claim[] {
  if (isClaim(value)) {
    into.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) collectClaims(v, into);
  } else if (typeof value === 'object' && value !== null) {
    for (const v of Object.values(value)) collectClaims(v, into);
  }
  return into;
}
