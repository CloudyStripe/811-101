/**
 * The site's icons: drawn on a 20 px grid with a 1.5 px stroke in currentColor, round caps and
 * joins. Original shapes only: no trademarks, no manufacturer designs.
 */
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
  | 'back'
  | 'forward'
  | 'ticket'
  | 'layers'
  | 'locate';

const PATHS: Record<IconName, JSX.Element> = {
  settings: (
    <>
      <path d="M3 5.75h8M15.75 5.75h1.25M3 14.25h1.25M9 14.25h8" />
      <circle cx="13.38" cy="5.75" r="2.25" />
      <circle cx="6.63" cy="14.25" r="2.25" />
    </>
  ),
  close: <path d="M5.25 5.25l9.5 9.5M14.75 5.25l-9.5 9.5" />,
  'chevron-up': <path d="M4.25 12.75L10 7l5.75 5.75" />,
  'chevron-down': <path d="M4.25 7.25L10 13l5.75-5.75" />,
  back: <path d="M16.25 10H4.38M9.38 5L4.38 10l5 5" />,
  forward: <path d="M3.75 10h11.88M10.63 5l5 5-5 5" />,
  // A ticket, notched at the sides, with a perforated stub.
  ticket: (
    <>
      <path d="M3.13 5h13.75v3a2 2 0 0 0 0 4V15h-13.75V12a2 2 0 0 0 0-4z" />
      <path d="M12.5 6.5v1.25M12.5 9.38v1.25M12.5 12.25v1.25" />
    </>
  ),
  // A target: finding something's exact place.
  locate: (
    <>
      <circle cx="10" cy="10" r="5.5" />
      <path d="M10 2v3.75M10 14.25v3.75M2 10h3.75M14.25 10h3.75" />
    </>
  ),
  // Stacked layers, like soil and what runs through it.
  layers: (
    <path d="M10 3.25l7 3.75L10 10.75l-7-3.75zM3 10.25L10 14l7-3.75M3 13.5L10 17.25l7-3.75" />
  ),
  gas: (
    <path d="M10 2.25c0.5 2.75 4.5 4.88 4.5 9A4.5 4.5 0 0 1 10 15.88 4.5 4.5 0 0 1 5.5 11.25c0-2 1-3.25 2-4.12 0.13 1.63 0.88 2.63 1.75 3C8.75 8 9 5 10 2.25z" />
  ),
  telecom: (
    <>
      <path d="M4.5 7.75a7.5 7.5 0 0 1 11 0M6.75 10.13a4.25 4.25 0 0 1 6.5 0" />
      <circle cx="10" cy="13.25" r="1.38" />
    </>
  ),
  water: (
    <path d="M10 2.75S5.25 8.25 5.25 11.63a4.75 4.75 0 0 0 9.5 0C14.75 8.25 10 2.75 10 2.75z" />
  ),
  transmitter: (
    <>
      <rect x="3.25" y="8" width="13.5" height="8.25" rx="2" />
      <path d="M6.75 8V6.25a3.25 3.25 0 0 1 6.5 0v1.75M7 12h6" />
    </>
  ),
  stake: <path d="M5.75 4h8.5M10 4V16.25M10 16.25l-1.25-2M10 16.25l1.25-2" />,
  access: (
    <>
      <path d="M10 16.75V6.75" />
      <path d="M7 6.75a3 3 0 0 1 6 0z" />
      <path d="M6.75 16.75h6.5" />
    </>
  ),
  wire: <path d="M2 12c2.63-4.5 5.38-4.5 8 0s5.38 4.5 8 0" />,
};

export function Icon({ name, class: className }: { name: IconName; class?: string }) {
  return (
    <svg
      class={className ?? 'icon'}
      viewBox="0 0 20 20"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
