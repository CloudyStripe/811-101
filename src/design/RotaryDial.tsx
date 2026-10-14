/**
 * A rotary selector with detents, like a transmitter's frequency knob. Underneath it's a radio
 * group (one tab stop, arrow keys, Home and End), each detent a labeled radio set on an arc above
 * the knob. The knob turns to the chosen detent (at once when motion is reduced, since its
 * transition uses the motion tokens), and a click on it steps to the next. Nothing needs dragging.
 */
import { useRadioGroup } from './useRadioGroup.ts';

export interface DialOption<T extends string | number> {
  value: T;
  label: string;
  /** Accessible name when the visible label isn't enough, e.g. spelling out units. */
  ariaLabel?: string;
}

/** The detents sit on an arc this many degrees either side of straight up. */
const SPREAD = 70;

export function RotaryDial<T extends string | number>(props: {
  label: string;
  value: T;
  options: readonly DialOption<T>[];
  onChange: (value: T) => void;
  class?: string;
}) {
  const { options } = props;
  const group = useRadioGroup(
    options.map((o) => o.value),
    props.value,
    props.onChange,
  );
  const angle = (i: number) =>
    options.length < 2 ? 0 : -SPREAD + (2 * SPREAD * i) / (options.length - 1);
  /**
   * Where a detent's label sits: out from the knob along its angle, at a radius the CSS sets. The
   * two nearest the top grow outward from the middle, so however wide their text gets (larger
   * text spacing, say) they never meet; the rest grow away from the knob.
   */
  const place = (i: number) => {
    const a = (angle(i) * Math.PI) / 180;
    const sin = Math.sin(a);
    const cos = Math.cos(a);
    const side = Math.abs(sin) < 0.01 ? 0 : Math.sign(sin);
    const nearTop = side !== 0 && Math.abs(angle(i)) < 45;
    const shiftX = nearTop ? (side < 0 ? -100 : 0) : -50 + sin * 50;
    return {
      left: nearTop
        ? `calc(50% + ${String(side)} * var(--dial-gap))`
        : `calc(50% + ${sin.toFixed(4)} * var(--dial-r))`,
      bottom: `calc(2px + var(--knob) / 2 + ${cos.toFixed(4)} * var(--dial-r))`,
      transform: `translate(${shiftX.toFixed(2)}%, ${(50 - cos * 50).toFixed(2)}%)`,
    };
  };

  return (
    <div class={`dial ${props.class ?? ''}`}>
      {options.map((option, i) => (
        <span
          key={`tick-${String(option.value)}`}
          class="dial-tick"
          style={{ '--a': `${String(angle(i))}deg` }}
          aria-hidden="true"
        />
      ))}
      <div
        class="dial-detents"
        role="radiogroup"
        aria-label={props.label}
        onKeyDown={group.onKeyDown}
      >
        {options.map((option, i) => (
          <button
            key={String(option.value)}
            {...group.option(i)}
            type="button"
            class="dial-detent"
            style={place(i)}
            aria-label={option.ariaLabel}
            onClick={() => {
              props.onChange(option.value);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
      {/* The knob itself: a picture of the choice, and a quick way to step on. */}
      <div
        class="dial-knob"
        style={{ '--turn': `${String(angle(group.index))}deg` }}
        aria-hidden="true"
        onClick={() => {
          group.move(group.index + 1);
        }}
      />
    </div>
  );
}
