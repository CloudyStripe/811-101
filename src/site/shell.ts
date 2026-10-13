/**
 * The site shell, as HTML: each page's head (title, description, share preview, favicons, the
 * settings script), the header, the footer and the 3D loader. Static, so it's there at first
 * paint and with no JavaScript, and the header never re-renders, so it holds still between pages.
 * Pure string functions: the build runs them (src/site/vite.ts), and unit tests read them.
 */
import { BASE_PATH, BRAND, SITE_URL, escapeHtml, fillBrand } from '../../config/brand.ts';
import { SECTIONS } from '../../content/portal.ts';
import { markInline } from '../design/mark.ts';
import { THEMES } from '../design/tokens.ts';
import { PAGES, posterPath, sectionOf, type PageInfo } from './pages.ts';
import { bootScript } from './settings.ts';

/**
 * The settings script every page runs first. Pages outside the shell (the original diorama) don't
 * take part in page transitions, so leaving for one skips the fade.
 */
export const BOOT = bootScript(PAGES.filter((p) => !p.built).map((p) => `${BASE_PATH}${p.path}`));

/** Share images are 1200 × 630, the size every preview uses. */
export const SHARE_SIZE = { width: 1200, height: 630 } as const;

/** Where the loader goes in a 3D page's static shell. */
export const LOADER_SLOT = '<!-- scene-loader -->';

const attr = escapeHtml;

/** The head's tags, after the page's own. */
export function headTags(page: PageInfo): string {
  const url = `${SITE_URL}${page.path}`;
  const image = `${SITE_URL}share/${page.share.image}`;
  const meta = (key: 'name' | 'property', name: string, content: string | number) =>
    `<meta ${key}="${name}" content="${attr(String(content))}" />`;
  return [
    `<title>${escapeHtml(page.title)}</title>`,
    meta('name', 'description', page.description),
    page.noindex ? meta('name', 'robots', 'noindex') : `<link rel="canonical" href="${url}" />`,
    meta('property', 'og:type', 'website'),
    meta('property', 'og:site_name', BRAND.name),
    meta('property', 'og:title', page.title),
    meta('property', 'og:description', page.description),
    ...(page.noindex ? [] : [meta('property', 'og:url', url)]),
    meta('property', 'og:image', image),
    meta('property', 'og:image:width', SHARE_SIZE.width),
    meta('property', 'og:image:height', SHARE_SIZE.height),
    meta('property', 'og:image:alt', page.share.alt),
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:title', page.title),
    meta('name', 'twitter:description', page.description),
    meta('name', 'twitter:image', image),
    meta('name', 'twitter:image:alt', page.share.alt),
    // Root-relative, from public/: the build puts the site's base path in front.
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml" />',
    '<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png" />',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
    `<meta name="theme-color" content="${THEMES.light.chrome.bg}" media="(prefers-color-scheme: light)" />`,
    `<meta name="theme-color" content="${THEMES.dark.chrome.bg}" media="(prefers-color-scheme: dark)" />`,
    // With no script, a 3D view never loads, so its loader shouldn't promise one.
    ...(page.scene ? ['<noscript><style>.scene-loader { display: none; }</style></noscript>'] : []),
  ].join('\n    ');
}

/**
 * The header: the mark and the site's name (home), and on a lesson, its section and title. The
 * settings button mounts into its slot once the page's code runs.
 */
export function headerHtml(page: PageInfo): string {
  const home = page.id === 'portal' ? ' aria-current="page"' : '';
  const section = sectionOf(page.path);
  const title = page.heading
    ? [
        '<div class="site-page">',
        section
          ? `<a class="site-crumb" href="${BASE_PATH}#${section.id}">${escapeHtml(section.title)}</a><span class="site-crumb-sep" aria-hidden="true">/</span>`
          : '',
        `<h1 class="site-title">${escapeHtml(page.heading)}</h1>`,
        '</div>',
      ].join('')
    : '';
  return [
    '<header class="site-header" data-chrome>',
    `<a class="site-home" href="${BASE_PATH}"${home}>${markInline('site-mark')}<span class="site-name">${escapeHtml(BRAND.name)}</span></a>`,
    title,
    '<div class="site-tools"><div class="site-settings" id="site-settings"></div></div>',
    '</header>',
  ].join('');
}

/** The footer: the brand, every lesson, and what the site keeps (only settings). */
export function footerHtml(): string {
  const lessons = SECTIONS.flatMap((section) =>
    section.lessons.map(
      (lesson) =>
        `<li><a href="${BASE_PATH}${lesson.href}">${escapeHtml(lesson.title)}</a><span>${escapeHtml(section.title)}</span></li>`,
    ),
  );
  return [
    '<footer class="site-footer">',
    '<div class="site-footer-inner">',
    `<div class="site-footer-brand">${markInline('site-mark')}<div><p class="site-footer-name">${escapeHtml(BRAND.name)}</p><p class="site-footer-tagline">${escapeHtml(BRAND.tagline)}</p></div></div>`,
    `<nav class="site-footer-nav" aria-label="Lessons"><ul>${lessons.join('')}</ul></nav>`,
    '<p class="site-footer-note">No tracking and no accounts: the only thing kept is your display settings, in this browser.</p>',
    '</div>',
    '</footer>',
  ].join('');
}

/**
 * While a 3D view loads: its poster, blurred, in the reader's theme, and a hairline that steps on
 * as the view's code arrives, builds and compiles. It fades once the view draws.
 */
export function loaderHtml(page: PageInfo): string {
  // Root-relative, from public/: the build puts the site's base path in front.
  const url = (theme: 'light' | 'dark') => `url('/${posterPath(page, theme)}')`;
  return [
    `<div class="scene-loader" aria-hidden="true" style="--poster-light: ${url('light')}; --poster-dark: ${url('dark')}">`,
    '<div class="scene-loader-poster"></div>',
    '<div class="scene-loader-status"><span class="scene-loader-bar"><span></span></span>',
    '<span class="scene-loader-text">Loading the 3D view</span></div>',
    '</div>',
  ].join('');
}

/** A page's HTML with the shell put in: head tags, the settings script, header, footer, loader. */
export function renderPage(html: string, page: PageInfo): string {
  // Replacers are functions, so nothing in the inserted text is read as a $ pattern. Links in a
  // page's own HTML use %BASE%, since a 404 page is served at any address and needs whole paths.
  let out = fillBrand(html).replaceAll('%BASE%', () => BASE_PATH);
  // The settings script runs before any style, so a saved theme never flashes; it follows the
  // charset, which must come within the page's first 1024 bytes.
  out = /<meta charset=[^>]*>/i.test(out)
    ? out.replace(/<meta charset=[^>]*>/i, (meta) => `${meta}\n    <script>${BOOT}</script>`)
    : out.replace(/<head>/, (head) => `${head}\n    <script>${BOOT}</script>`);
  out = out.replace(/\s*<\/head>/, () => `\n    ${headTags(page)}\n  </head>`);
  out = out.replace(/<body([^>]*)>/, (body) => `${body}\n    ${headerHtml(page)}`);
  if (page.footer) out = out.replace(/\s*<\/body>/, () => `\n    ${footerHtml()}\n  </body>`);
  if (page.scene) out = out.replace(LOADER_SLOT, () => loaderHtml(page));
  return out;
}
