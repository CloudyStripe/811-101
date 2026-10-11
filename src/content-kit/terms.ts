/**
 * Term markup in content: `[[term]]` marks a term, and `[[shown words|term key]]` shows other
 * words for it. Every marked term needs a definition, which the content tests enforce.
 */

export type Segment =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'term'; readonly text: string; readonly key: string };

const TERM = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/** Term keys ignore case and extra spaces. */
export function termKey(key: string): string {
  return key.trim().toLowerCase().replaceAll(/\s+/g, ' ');
}

export function parseTerms(text: string): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  for (const match of text.matchAll(TERM)) {
    const [whole, shown = '', key] = match;
    if (match.index > last) segments.push({ kind: 'text', text: text.slice(last, match.index) });
    segments.push({ kind: 'term', text: shown.trim(), key: termKey(key ?? shown) });
    last = match.index + whole.length;
  }
  if (last < text.length) segments.push({ kind: 'text', text: text.slice(last) });
  return segments;
}

/** The text as read, with the markup removed. */
export function plainText(text: string): string {
  return parseTerms(text)
    .map((s) => s.text)
    .join('');
}

/** Keys of every term marked in the text. */
export function termKeysIn(text: string): string[] {
  return parseTerms(text).flatMap((s) => (s.kind === 'term' ? [s.key] : []));
}
