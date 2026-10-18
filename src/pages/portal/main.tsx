/**
 * The portal's script. The page itself is static (src/site/shell.ts writes its hero, its cards and
 * their icons), so this only lets a lesson's preview carry on into its loader as it opens.
 */
import '../../site/boot.ts';
import './portal.css';

/** The parts of a page-swap event read here (the event is newer than some type libraries). */
interface PageSwap extends Event {
  viewTransition: unknown;
  activation: { entry: { url: string } | null } | null;
}

// Only the card being opened takes part, through its preview in the reader's theme; the others
// fade with the page.
addEventListener('pageswap', (event) => {
  const { viewTransition, activation } = event as PageSwap;
  const to = activation?.entry?.url;
  for (const card of document.querySelectorAll<HTMLElement>('.card[data-transition]')) {
    const link = card.querySelector<HTMLAnchorElement>('.card-link');
    const opening =
      viewTransition !== null && to !== undefined && link !== null && sameAddress(link.href, to);
    for (const image of card.querySelectorAll<HTMLElement>('.card-image')) {
      const shown = image.offsetParent !== null;
      image.style.viewTransitionName = opening && shown ? (card.dataset.transition ?? '') : '';
    }
  }
});

/** Whether two addresses are the same page, whatever comes after its path. */
function sameAddress(a: string, b: string): boolean {
  return new URL(a).pathname === new URL(b).pathname;
}
