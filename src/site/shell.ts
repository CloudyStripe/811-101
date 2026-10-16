/**
 * The site shell, as HTML: each page's head (title, description, share preview, favicons, the
 * settings script), the header, the footer, the 3D loader, and the portal's hero and sections.
 * Static, so it's there at first paint and with no JavaScript, and the header never re-renders, so
 * it holds still between pages.
 * Pure string functions: the build runs them (src/site/vite.ts), and unit tests read them.
 */
import { BASE_PATH, BRAND, SITE_URL, escapeHtml } from '../../config/brand.ts';
import { SECTIONS, type Lesson, type Section } from '../../content/portal.ts';
import { iconSvg, type IconName } from '../design/icon-svg.ts';
import { THEMES } from '../design/tokens.ts';
import { lessonPage, lessonTransition, posterPath, sectionOf, type PageInfo } from './pages.ts';
import { BOOT_SCRIPT } from './settings.ts';
import { HERO_SHAPES, PREVIEW_SIZE, THEME_NAMES, heroPath, previewPath } from './stills.ts';

/** The settings script every page runs first. */
export const BOOT = BOOT_SCRIPT;

/** Share images are 1200 × 630, the size every preview uses. */
export const SHARE_SIZE = { width: 1200, height: 630 } as const;

/** Where the loader goes in a 3D page's static shell. */
export const LOADER_SLOT = '<!-- scene-loader -->';

/** Where the hero goes in the portal's static shell. */
export const HERO_SLOT = '<!-- portal-hero -->';

/** Where the sections go in the portal's static shell. */
export const BANDS_SLOT = '<!-- portal-bands -->';

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
 * The header: the site's name as its wordmark (home), and on a lesson, its section and title. The
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
    `<a class="site-home" href="${BASE_PATH}"${home}><span class="site-name">${escapeHtml(BRAND.name)}</span></a>`,
    title,
    '<div class="site-tools"><div class="site-settings" id="site-settings"></div></div>',
    '</header>',
  ].join('');
}

/**
 * The footer: the brand, every lesson, what the site keeps (only settings), and the credits for
 * the open-source software and typefaces it's built with.
 */
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
    `<div class="site-footer-brand"><p class="site-footer-name">${escapeHtml(BRAND.name)}</p><p class="site-footer-tagline">${escapeHtml(BRAND.tagline)}</p></div>`,
    `<nav class="site-footer-nav" aria-label="Lessons"><ul>${lessons.join('')}</ul></nav>`,
    '<div class="site-footer-meta">',
    '<p class="site-footer-note">No tracking and no accounts: the only thing kept is your display settings, in this browser.</p>',
    `<a class="site-footer-credits" href="${BASE_PATH}credits.txt">Open-source credits</a>`,
    '</div>',
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
    // Named so the lesson's preview on the portal carries on into it (see site.css).
    `<div class="scene-loader-poster" style="--lesson-transition: ${lessonTransition(page.id)}"></div>`,
    '<div class="scene-loader-status"><span class="scene-loader-bar"><span></span></span>',
    '<span class="scene-loader-text">Loading the 3D view</span></div>',
    '</div>',
  ].join('');
}

/**
 * The portal's hero: the site's name with its tagline as the statement, a link to each section
 * (those with lessons first, then what's coming), and a still of a lesson beside them. The still
 * comes in the reader's theme and the screen's shape (see portal.css): only one of them loads.
 */
export function heroHtml(): string {
  const link = (section: Section) => {
    const soon = section.lessons.length === 0;
    const note = soon ? ' <span class="hero-path-note">Coming soon</span>' : '';
    return `<li><a class="hero-path${soon ? ' hero-path-soon' : ''}" href="#${section.id}">${escapeHtml(section.title)}${note}</a></li>`;
  };
  const sections = [
    ...SECTIONS.filter((s) => s.lessons.length > 0),
    ...SECTIONS.filter((s) => s.lessons.length === 0),
  ];
  // Root-relative, from public/: the build puts the site's base path in front.
  const stills = THEME_NAMES.flatMap((theme) =>
    HERO_SHAPES.map((shape) => `--hero-${theme}-${shape}: url('/${heroPath(theme, shape)}')`),
  ).join('; ');
  return [
    '<section class="hero" aria-labelledby="hero-title">',
    '<div class="hero-text">',
    `<h1 id="hero-title" class="hero-title"><span class="hero-name">${escapeHtml(BRAND.name)}</span> <span class="hero-line">${escapeHtml(BRAND.tagline)}</span></h1>`,
    `<nav class="hero-paths" aria-label="Sections"><ul>${sections.map(link).join('')}</ul></nav>`,
    '</div>',
    `<div class="hero-image" aria-hidden="true" style="${stills}"></div>`,
    '</section>',
  ].join('');
}

/** An icon, drawn into the page with the rest of the shell. It's decoration, hidden from readers. */
const iconSlot = (name: IconName, className: string) =>
  `<span class="${className}" aria-hidden="true">${iconSvg(name)}</span>`;

/**
 * The portal's sections, static like its hero: a band each, with its lessons as large tiles. A
 * tile holds its preview in each theme, lazy, and the page's CSS shows the reader's, so only that
 * one loads. A section still being built is a short teaser.
 */
export function bandsHtml(): string {
  const tile = (lesson: Lesson) => {
    // Root-relative, from public/: the build puts the site's base path in front.
    const previews = THEME_NAMES.map(
      (theme) =>
        `<img class="tile-image" data-theme-image="${theme}" src="/${previewPath(lesson.image, theme)}" alt="" width="${String(PREVIEW_SIZE.width)}" height="${String(PREVIEW_SIZE.height)}" loading="lazy" decoding="async" />`,
    ).join('');
    return [
      `<li class="tile" data-transition="${lessonTransition(lessonPage(lesson).id)}">${previews}`,
      '<div class="tile-text">',
      // The link covers the whole tile, so anywhere on it opens the lesson.
      `<h3><a class="tile-link" href="${BASE_PATH}${lesson.href}">${escapeHtml(lesson.title)}</a></h3>`,
      `<p>${escapeHtml(lesson.summary)}</p>`,
      `<span class="tile-go" aria-hidden="true">Open${iconSlot('forward', 'tile-arrow')}</span>`,
      '</div></li>',
    ].join('');
  };
  const band = (section: Section) => {
    const soon = section.lessons.length === 0;
    return [
      `<section id="${section.id}" class="band${soon ? ' band-soon' : ''}" aria-labelledby="${section.id}-title">`,
      '<div class="band-text">',
      `<h2 id="${section.id}-title" class="band-title">${iconSlot(section.icon, 'band-icon')}${escapeHtml(section.title)}</h2>`,
      `<p class="band-summary">${escapeHtml(section.summary)}</p>`,
      soon ? '<p class="soon-label">Coming soon</p>' : '',
      '</div>',
      soon
        ? ''
        : `<ul class="tiles" aria-label="${attr(section.title)} lessons">${section.lessons.map(tile).join('')}</ul>`,
      '</section>',
    ].join('');
  };
  return `<div class="bands">${SECTIONS.map(band).join('')}</div>`;
}

/**
 * A page's HTML with the shell put in: head tags, the settings script, header, footer, loader, and
 * on the portal, its hero and sections.
 */
export function renderPage(html: string, page: PageInfo): string {
  // Replacers are functions, so nothing in the inserted text is read as a $ pattern. Links in a
  // page's own HTML use %BASE%, since a 404 page is served at any address and needs whole paths.
  let out = html.replaceAll('%BASE%', () => BASE_PATH);
  // The settings script runs before any style, so a saved theme never flashes; it follows the
  // charset, which must come within the page's first 1024 bytes.
  out = /<meta charset=[^>]*>/i.test(out)
    ? out.replace(/<meta charset=[^>]*>/i, (meta) => `${meta}\n    <script>${BOOT}</script>`)
    : out.replace(/<head>/, (head) => `${head}\n    <script>${BOOT}</script>`);
  out = out.replace(/\s*<\/head>/, () => `\n    ${headTags(page)}\n  </head>`);
  out = out.replace(/<body([^>]*)>/, (body) => `${body}\n    ${headerHtml(page)}`);
  if (page.footer) out = out.replace(/\s*<\/body>/, () => `\n    ${footerHtml()}\n  </body>`);
  if (page.scene) out = out.replace(LOADER_SLOT, () => loaderHtml(page));
  out = out.replace(HERO_SLOT, () => heroHtml());
  out = out.replace(BANDS_SLOT, () => bandsHtml());
  return out;
}
