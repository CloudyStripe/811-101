/**
 * A marked term: a button whose definition shows on hover, focus or tap (see useTip), kept inside
 * the panel or dialog it sits in. Screen readers hear the definition as the button's description.
 */
import { useId, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { parseTerms } from '../content-kit/terms.ts';
import { useTip } from './useTip.ts';

const GAP = 6;
const EDGE = 8;

/** The box a tip must stay inside: the nearest scrolling ancestor, or the window. */
function boundsOf(el: Element): { left: number; right: number; top: number; bottom: number } {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p);
    if (overflowY === 'auto' || overflowY === 'scroll') return p.getBoundingClientRect();
  }
  return { left: 0, right: innerWidth, top: 0, bottom: innerHeight };
}

export function Term({ text, definition }: { text: string; definition: string }) {
  const tip = useTip<HTMLSpanElement>();
  const id = useId();
  const bubble = useRef<HTMLSpanElement>(null);
  const [place, setPlace] = useState({ shift: 0, above: false });

  useLayoutEffect(() => {
    const wrap = tip.ref.current;
    const b = bubble.current;
    if (!tip.open || !wrap || !b) return;
    const t = wrap.getBoundingClientRect();
    const box = boundsOf(wrap);
    const width = b.offsetWidth;
    const height = b.offsetHeight;
    let left = t.left;
    left = Math.min(left, box.right - EDGE - width);
    left = Math.max(left, box.left + EDGE);
    const fitsBelow = t.bottom + GAP + height <= box.bottom - EDGE;
    const fitsAbove = t.top - GAP - height >= box.top + EDGE;
    setPlace({ shift: Math.round(left - t.left), above: !fitsBelow && fitsAbove });
  }, [tip.open, tip.ref]);

  return (
    <span class="term-wrap" ref={tip.ref} {...tip.handlers}>
      <button type="button" class="term" aria-describedby={id} onClick={tip.toggle}>
        {text}
      </button>
      <span
        id={id}
        ref={bubble}
        role="tooltip"
        class={`term-tip${place.above ? ' above' : ''}`}
        style={{ left: `${String(place.shift)}px` }}
        hidden={!tip.open}
      >
        {definition}
      </span>
    </span>
  );
}

/** Text with [[term]] markup, each term showing its definition. */
export function Rich({
  text,
  define,
}: {
  text: string;
  define: (key: string) => string | undefined;
}) {
  return (
    <>
      {parseTerms(text).map((s, i) => {
        if (s.kind === 'text') return s.text;
        const definition = define(s.key);
        return definition ? <Term key={i} text={s.text} definition={definition} /> : s.text;
      })}
    </>
  );
}
