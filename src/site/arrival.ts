/**
 * The page change that brought the reader here, while it's still animating: the boot script keeps
 * it as the page is revealed, and notes that it has been (src/site/settings.ts). The animation holds
 * on to the elements of the page's static shell, so a page that replaces its shell once the change
 * has begun waits for it (`arrived`); replacing them then would cut the animation short.
 */
type Arriving = Window & { __arrival?: { finished: Promise<unknown> }; __revealed?: boolean };

/** Once any page change already revealing the page has finished; at once if there's none. */
export function arrived(): Promise<void> {
  const change = (window as Arriving).__arrival;
  return change
    ? change.finished.then(
        () => undefined,
        () => undefined,
      )
    : Promise.resolve();
}

/**
 * Once the page has been revealed, and any page change revealing it has finished: what a lesson
 * waits for before building its 3D view, which holds the page up while it builds, and the change
 * with it. A page whose script holds its first paint runs before it's revealed, so this waits for
 * the reveal too, where the browser tells of it.
 */
export function revealed(): Promise<void> {
  if ((window as Arriving).__revealed === true || !('onpagereveal' in window)) return arrived();
  return new Promise((resolve) => {
    // After the boot script's own listener, which keeps the change.
    addEventListener(
      'pagereveal',
      () => {
        void arrived().then(resolve);
      },
      { once: true },
    );
  });
}
