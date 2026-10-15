/**
 * The page change that brought the reader here, while it's still animating: the boot script keeps
 * it as the page is revealed (src/site/settings.ts). The animation holds on to the elements of the
 * page's static shell, so a page that replaces its shell waits for it; replacing them sooner would
 * cut the animation short.
 */
export function arrived(): Promise<void> {
  const change = (window as Window & { __arrival?: { finished: Promise<unknown> } }).__arrival;
  return change
    ? change.finished.then(
        () => undefined,
        () => undefined,
      )
    : Promise.resolve();
}
