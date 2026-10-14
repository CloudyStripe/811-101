/**
 * The portal's script. The page itself is static (src/site/shell.ts writes its hero and sections),
 * so this only draws its icons, which are decoration, and, as a lesson opens, lets that lesson's
 * preview carry on into the lesson's loader.
 */
import '../../site/boot.ts';
import './portal.css';
import { render } from 'preact';
import { Icon, type IconName } from '../../design/icons.tsx';

for (const slot of document.querySelectorAll<HTMLElement>('[data-icon]')) {
  render(<Icon name={slot.dataset.icon as IconName} />, slot);
}

/** The parts of a page-swap event read here (the event is newer than some type libraries). */
interface PageSwap extends Event {
  viewTransition: unknown;
  activation: { entry: { url: string } | null } | null;
}

// Only the tile being opened takes part, through its preview in the reader's theme; the others
// fade with the page.
addEventListener('pageswap', (event) => {
  const { viewTransition, activation } = event as PageSwap;
  const to = activation?.entry?.url;
  for (const tile of document.querySelectorAll<HTMLElement>('.tile')) {
    const link = tile.querySelector<HTMLAnchorElement>('.tile-link');
    const opening =
      viewTransition !== null && to !== undefined && link !== null && sameAddress(link.href, to);
    for (const image of tile.querySelectorAll<HTMLElement>('.tile-image')) {
      const shown = image.offsetParent !== null;
      image.style.viewTransitionName = opening && shown ? (tile.dataset.transition ?? '') : '';
    }
  }
});

/** Whether two addresses are the same page, whatever comes after its path. */
function sameAddress(a: string, b: string): boolean {
  return new URL(a).pathname === new URL(b).pathname;
}
