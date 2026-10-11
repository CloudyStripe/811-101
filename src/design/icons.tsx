/** Small custom icons (16×16, stroke = currentColor). No trademarks, no manufacturer shapes. */
import type { JSX } from 'preact';

export type IconName =
  | 'gas'
  | 'telecom'
  | 'water'
  | 'transmitter'
  | 'stake'
  | 'access'
  | 'wire'
  | 'rotate-left'
  | 'rotate-right'
  | 'tilt-up'
  | 'tilt-down'
  | 'zoom-in'
  | 'zoom-out'
  | 'reset'
  | 'settings'
  | 'close'
  | 'chevron-up'
  | 'chevron-down'
  | 'direction';

const PATHS: Record<IconName, JSX.Element> = {
  settings: (
    <>
      <path d="M2.4 4.6h6.4M12.6 4.6h1M2.4 11.4h1M7.2 11.4h6.4" />
      <circle cx="10.7" cy="4.6" r="1.8" />
      <circle cx="5.3" cy="11.4" r="1.8" />
    </>
  ),
  close: <path d="M4.2 4.2l7.6 7.6M11.8 4.2l-7.6 7.6" />,
  'chevron-up': <path d="M3.4 10.2L8 5.6l4.6 4.6" />,
  'chevron-down': <path d="M3.4 5.8L8 10.4l4.6-4.6" />,
  // The same flat V the 3D view draws along each line.
  direction: <path d="M5.4 3.6L10 8l-4.6 4.4" />,
  gas: (
    <path d="M8 1.8c.4 2.2 3.6 3.9 3.6 7.2A3.6 3.6 0 0 1 8 12.7 3.6 3.6 0 0 1 4.4 9c0-1.6.8-2.6 1.6-3.3.1 1.3.7 2.1 1.4 2.4C7 6.4 7.2 4 8 1.8z" />
  ),
  telecom: (
    <>
      <path d="M3.6 6.2a6 6 0 0 1 8.8 0M5.4 8.1a3.4 3.4 0 0 1 5.2 0" />
      <circle cx="8" cy="10.6" r="1.1" />
    </>
  ),
  water: <path d="M8 2.2S4.2 6.6 4.2 9.3a3.8 3.8 0 0 0 7.6 0C11.8 6.6 8 2.2 8 2.2z" />,
  transmitter: (
    <>
      <rect x="2.6" y="6.4" width="10.8" height="6.6" rx="1.6" />
      <path d="M5.4 6.4V5a2.6 2.6 0 0 1 5.2 0v1.4M5.6 9.6h4.8" />
    </>
  ),
  stake: <path d="M4.6 3.2h6.8M8 3.2V13M8 13l-1-1.6M8 13l1-1.6" />,
  access: (
    <>
      <path d="M8 13.4V5.4" />
      <path d="M5.6 5.4a2.4 2.4 0 0 1 4.8 0z" />
      <path d="M5.4 13.4h5.2" />
    </>
  ),
  wire: <path d="M1.6 9.6c2.1-3.6 4.3-3.6 6.4 0s4.3 3.6 6.4 0" />,
  'rotate-left': <path d="M5.2 4.4H2.6V1.8M2.9 4.3a5.8 5.8 0 1 1-.6 4.6" />,
  'rotate-right': <path d="M10.8 4.4h2.6V1.8M13.1 4.3a5.8 5.8 0 1 0 .6 4.6" />,
  // An eye-level line with an arc over or under it: look from higher or lower.
  'tilt-up': <path d="M2.4 12.6h11.2M4 9.6a4.4 4.4 0 0 1 8 0M10.6 6.4l1.4 3.2-3.4.2" />,
  'tilt-down': <path d="M2.4 3.4h11.2M4 6.4a4.4 4.4 0 0 0 8 0M10.6 9.6l1.4-3.2-3.4-.2" />,
  'zoom-in': (
    <>
      <circle cx="7" cy="7" r="4.4" />
      <path d="M10.2 10.2l3.4 3.4M7 5v4M5 7h4" />
    </>
  ),
  'zoom-out': (
    <>
      <circle cx="7" cy="7" r="4.4" />
      <path d="M10.2 10.2l3.4 3.4M5 7h4" />
    </>
  ),
  // A house: back to the home view. Distinct from the turn arrows.
  reset: <path d="M2.6 7.6L8 3l5.4 4.6M4.2 6.3v6.5h7.6V6.3M6.8 12.8V9.8h2.4v3" />,
};

export function Icon({ name, class: className }: { name: IconName; class?: string }) {
  return (
    <svg
      class={className ?? 'icon'}
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
