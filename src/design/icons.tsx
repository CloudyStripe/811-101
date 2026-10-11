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
  | 'settings'
  | 'close'
  | 'chevron-up'
  | 'chevron-down'
  | 'back';

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
  back: <path d="M13 8H3.5M7.5 4L3.5 8l4 4" />,
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
