/** Small custom icons (16×16, stroke = currentColor). No trademarks, no manufacturer shapes. */
import type { JSX } from 'preact';

export type IconName =
  | 'gas'
  | 'telecom'
  | 'water'
  | 'transmitter'
  | 'stake'
  | 'access'
  | 'break'
  | 'rotate-left'
  | 'rotate-right'
  | 'tilt-up'
  | 'tilt-down'
  | 'zoom-in'
  | 'zoom-out'
  | 'reset';

const PATHS: Record<IconName, JSX.Element> = {
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
  break: <path d="M1.8 8h4l1.2-2 2 4 1.2-2h4" />,
  'rotate-left': <path d="M5.2 4.4H2.6V1.8M2.9 4.3a5.8 5.8 0 1 1-.6 4.6" />,
  'rotate-right': <path d="M10.8 4.4h2.6V1.8M13.1 4.3a5.8 5.8 0 1 0 .6 4.6" />,
  'tilt-up': <path d="M3.4 10.2L8 5.6l4.6 4.6" />,
  'tilt-down': <path d="M3.4 5.8L8 10.4l4.6-4.6" />,
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
  reset: <path d="M2.6 8a5.4 5.4 0 1 0 1.6-3.8M2.6 2.6v3h3" />,
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
