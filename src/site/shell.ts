/**
 * The site shell, as HTML: each page's head (title, description, share preview, favicons, the
 * settings script), the header, the footer, the 3D loader, and the portal's hero and cards.
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
import { PREVIEW_SIZE, THEME_NAMES, heroPath, previewPath } from './stills.ts';

/** The settings script every page runs first. */
export const BOOT = BOOT_SCRIPT;

/** Share images are 1200 × 630, the size every preview uses. */
export const SHARE_SIZE = { width: 1200, height: 630 } as const;

/** Where the loader goes in a 3D page's static shell. */
export const LOADER_SLOT = '<!-- scene-loader -->';

/** Where the hero goes in the portal's static shell. */
export const HERO_SLOT = '<!-- portal-hero -->';

/** Where the cards go in the portal's static shell. */
export const CARDS_SLOT = '<!-- portal-cards -->';

/** What the cards' list is named for readers: the lessons, then what's to come. */
export const CARDS_NAME = 'Lessons, and what’s coming';

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
 * The portal's hero: the site's name, set as its wordmark, with its tagline in a line under it,
 * and the whole diorama in its sky beside them. The still comes in the reader's theme (see
 * portal.css): only that one loads, and none where the hero stacks.
 */
export function heroHtml(): string {
  // Root-relative, from public/: the build puts the site's base path in front.
  const stills = THEME_NAMES.map((theme) => `--hero-${theme}: url('/${heroPath(theme)}')`).join(
    '; ',
  );
  return [
    '<section class="hero" aria-labelledby="hero-title">',
    '<div class="hero-text">',
    `<h1 id="hero-title" class="hero-title">${escapeHtml(BRAND.name)}</h1>`,
    `<p class="hero-line">${escapeHtml(BRAND.tagline)}</p>`,
    '</div>',
    `<div class="hero-image" aria-hidden="true" style="${stills}"></div>`,
    '</section>',
  ].join('');
}

/** An icon, drawn into the page with the rest of the shell. It's decoration, hidden from readers. */
const iconSlot = (name: IconName, className: string) =>
  `<span class="${className}" aria-hidden="true">${iconSvg(name)}</span>`;

/**
 * The portal's cards, static like its hero: a large one for each lesson, then one for each section
 * still being built, which says it's coming. A lesson's card holds its preview in each theme, lazy,
 * and the page's CSS shows the reader's, so only that one loads; under it, the lesson's name and
 * what it covers, then its section's. A section's first card carries its id, so a lesson's
 * breadcrumb leads to it.
 */
export function cardsHtml(): string {
  const lessonCard = (section: Section, lesson: Lesson, first: boolean) => {
    // Root-relative, from public/: the build puts the site's base path in front.
    const previews = THEME_NAMES.map(
      (theme) =>
        `<img class="card-image" data-theme-image="${theme}" src="/${previewPath(lesson.image, theme)}" alt="" width="${String(PREVIEW_SIZE.width)}" height="${String(PREVIEW_SIZE.height)}" loading="lazy" decoding="async" />`,
    ).join('');
    return [
      `<li${first ? ` id="${section.id}"` : ''} class="card" data-transition="${lessonTransition(lessonPage(lesson).id)}">${previews}`,
      '<div class="card-text">',
      // The link covers the whole card, so anywhere on it opens the lesson.
      `<h2 class="card-title"><a class="card-link" href="${BASE_PATH}${lesson.href}">${escapeHtml(lesson.title)}</a>${iconSlot('forward', 'card-arrow')}</h2>`,
      `<p class="card-summary">${escapeHtml(lesson.summary)}</p>`,
      // A stop between the section's name and its line, heard but not seen.
      `<p class="card-section">${iconSlot(section.icon, 'card-icon')}<span><strong>${escapeHtml(section.title)}</strong><span class="sr-only">:</span> ${escapeHtml(section.summary)}</span></p>`,
      '</div></li>',
    ].join('');
  };
  const soonCard = (section: Section) =>
    [
      `<li id="${section.id}" class="card card-soon">`,
      iconSlot(section.icon, 'card-art'),
      '<div class="card-text">',
      `<h2 class="card-title">${escapeHtml(section.title)}</h2>`,
      `<p class="card-summary">${escapeHtml(section.summary)}</p>`,
      '<p class="soon-label">Coming soon</p>',
      '</div></li>',
    ].join('');
  const cards = [
    ...SECTIONS.flatMap((section) =>
      section.lessons.map((lesson, i) => lessonCard(section, lesson, i === 0)),
    ),
    ...SECTIONS.filter((section) => section.lessons.length === 0).map(soonCard),
  ];
  return `<ul class="cards" aria-label="${attr(CARDS_NAME)}">${cards.join('')}</ul>`;
}

/**
 * A page's HTML with the shell put in: head tags, the settings script, header, footer, loader, and
 * on the portal, its hero and cards.
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
  out = out.replace(CARDS_SLOT, () => cardsHtml());
  return out;
}
