/**
 * The site's icons: Phosphor's bold weight (MIT), filled with the current color. Their shapes are
 * generated into icon-data.ts by scripts/icon-data.ts, which also says what each one stands for.
 */
import { ICON_PATHS } from './icon-data.ts';
import { ICON_VIEWBOX, type IconName } from './icon-svg.ts';

export type { IconName };

export function Icon({ name, class: className }: { name: IconName; class?: string }) {
  return (
    <svg
      class={className ?? 'icon'}
      viewBox={ICON_VIEWBOX}
      width="20"
      height="20"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}
