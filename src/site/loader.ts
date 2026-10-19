/**
 * The 3D loader's pictures: its poster in each theme and shape. The static shell
 * (src/site/shell.ts) gives the loader a tiny copy of each too, inline, there from the first paint
 * until the poster lands; the page's own loader (SceneLoader.tsx) keeps the shell's, so the page's
 * code needn't carry the copies.
 */
import { POSTER_SHAPES, posterPath, type PageInfo } from './pages.ts';
import { THEME_NAMES } from './stills.ts';

/**
 * The loader's poster in each theme and shape, as CSS properties. `root` is what goes before a
 * picture's address: in a page's static HTML, `/`, which the build puts the base path in front of;
 * in the page's own code, the base path itself.
 */
export function posterStyle(page: PageInfo, root: string): string {
  return THEME_NAMES.flatMap((theme) =>
    POSTER_SHAPES.map(
      (shape) => `--poster-${theme}-${shape}: url('${root}${posterPath(page, theme, shape)}')`,
    ),
  ).join('; ');
}

let fromShell: string | null = null;

/** Keeps the style of the static shell's loader, under `root`, before the page's code replaces it. */
export function keepShellLoader(root: ParentNode): void {
  fromShell = root.querySelector('.scene-loader')?.getAttribute('style') ?? null;
}

/** The static shell's loader style, kept, if the page had one. */
export function shellLoaderStyle(): string | null {
  return fromShell;
}
