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
import {
  POSTER_SHAPES,
  POSTER_TALL,
  lessonPage,
  lessonTransition,
  posterPath,
  sectionOf,
  type PageInfo,
} from './pages.ts';
import { posterStyle } from './loader.ts';
import { POSTER_PLACEHOLDERS, STILL_PLACEHOLDERS } from './placeholders.ts';
import { BOOT_SCRIPT } from './settings.ts';
import { HERO_STACKS, PREVIEW_SIZE, THEME_NAMES, heroPath, previewPath } from './stills.ts';

/** The settings script every page runs first. */
export const BOOT = BOOT_SCRIPT;

/** Share images are 1200 × 630, the size every preview uses. */
export const SHARE_SIZE = { width: 1200, height: 630 } as const;

/** Marks the pictures script in a page's head, so the build can put the fonts after it. */
export const PICTURES_ATTR = 'data-first-pictures';
/** A page's viewport tag: what measures the screen in its head goes after it. */
export const VIEWPORT = /<meta name="viewport"[^>]*>/i;

/** Where the loader goes in a 3D page's static shell. */
export const LOADER_SLOT = '<!-- scene-loader -->';

/** Where the hero goes in the portal's static shell. */
export const HERO_SLOT = '<!-- portal-hero -->';

/** Where the cards go in the portal's static shell. */
export const CARDS_SLOT = '<!-- portal-cards -->';

/** What the cards' list is named for readers: the lessons, then what's to come. */
export const CARDS_NAME = 'Lessons';

const attr = escapeHtml;

/**
 * A picture's tiny copy, inline, as a CSS image, from the given set of them; none while it has
 * none (as while `npm run thumbnails` makes the pictures it's made from). The shell's tests hold
 * every picture to having one.
 */
export function placeholderUrl(set: Readonly<Record<string, string>>, path: string): string {
  const uri = set[path];
  return uri ? `url('${uri}')` : 'none';
}

/** The loader's posters in each theme and shape, and a tiny copy of each, as its style. */
export function loaderStyle(page: PageInfo): string {
  const tiny = THEME_NAMES.flatMap((theme) =>
    POSTER_SHAPES.map((shape) => {
      const copy = placeholderUrl(POSTER_PLACEHOLDERS, posterPath(page, theme, shape));
      return `--poster-${theme}-${shape}-tiny: ${copy}`;
    }),
  );
  return [posterStyle(page, '/'), ...tiny].join('; ');
}

/**
 * Whether the reader came from another page of the site, as a script's expression: then the page's
 * pictures and fonts are most likely in the browser's cache, so asking for them up front costs
 * little and has them in for the first paint. From anywhere else it's taken as a first visit, whose
 * first paint asking for them up front would hold up: the page asks only for what it needs to
 * paint, and they come right after it, as its styles find them, the pictures over their tiny
 * copies. It's a guess, as the site keeps nothing but display settings: a reader back from a
 * bookmark has them cached but gets the first visit's order, and one who opened a lesson first has
 * the portal's pictures asked for up front, though they've yet to be fetched.
 */
export const FROM_THE_SITE = `document.referrer.indexOf(location.origin + ${JSON.stringify(BASE_PATH)}) === 0`;

/**
 * A script for a page's head that, when the reader comes from another page of the site, starts
 * fetching the pictures its first screen shows, in the reader's theme (the one the settings script
 * has just put on <html>, or the device's), with the page itself rather than once its styles are
 * read: a 3D page's loader poster, in the screen's shape, which marks the page (`data-poster`) once
 * it's in, so a lesson's preview carries on into it only then; the portal's hero, where it stands
 * beside the name, and its lessons' previews. On a first visit they come once the page's styles
 * find them (FROM_THE_SITE). And once the portal is in, it fetches its lessons' posters, for later,
 * so a lesson opened from it has its poster at its first paint. None for any other page.
 */
export function picturesScript(page: PageInfo): string | null {
  const both = (path: (theme: 'light' | 'dark') => string) =>
    JSON.stringify(Object.fromEntries(THEME_NAMES.map((t) => [t, `${BASE_PATH}${path(t)}`])));
  /** A 3D page's posters, in the screen's shape. */
  const posters = (p: PageInfo) => {
    const byShape = POSTER_SHAPES.map(
      (shape) => `${shape}: ${both((t) => posterPath(p, t, shape))}`,
    );
    return `{ ${byShape.join(', ')} }[shape]`;
  };
  const fetches: string[] = [];
  if (page.scene) {
    fetches.push(
      `if (within) get(${posters(page)}, function () { root.dataset.poster = 'ready'; });`,
    );
  } else if (page.id === 'portal') {
    const lessons = SECTIONS.flatMap((section) => section.lessons);
    fetches.push(
      `if (within && !matchMedia(${JSON.stringify(HERO_STACKS)}).matches) get(${both(heroPath)});`,
      ...lessons.map((lesson) => `if (within) get(${both((t) => previewPath(lesson.image, t))});`),
      // Only a lesson with a 3D view has a poster.
      `addEventListener('load', function () { [${lessons
        .map(lessonPage)
        .filter((p) => p.scene)
        .map(posters)
        .join(', ')}].forEach(later); });`,
    );
  } else {
    return null;
  }
  return [
    '(function () {',
    '  var root = document.documentElement;',
    "  var theme = root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');",
    `  var shape = matchMedia(${JSON.stringify(POSTER_TALL)}).matches ? 'tall' : 'wide';`,
    `  var within = ${FROM_THE_SITE};`,
    '  // For this page: now, first.',
    '  function get(urls, done) {',
    "    var el = document.createElement('link');",
    "    el.rel = 'preload';",
    "    el.as = 'image';",
    "    el.setAttribute('fetchpriority', 'high');",
    '    if (done) el.onload = done;',
    '    el.href = urls[theme];',
    '    document.head.appendChild(el);',
    '  }',
    '  // For a page this one leads to: when nothing else is loading.',
    '  function later(urls) {',
    "    var el = document.createElement('link');",
    "    el.rel = 'prefetch';",
    '    el.href = urls[theme];',
    '    document.head.appendChild(el);',
    '  }',
    ...fetches.map((f) => `  ${f}`),
    '})();',
  ].join('\n');
}

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
 * While a 3D view loads: its poster, lightly blurred, in the reader's theme, over a tiny copy of it
 * that's there from the first paint, and a hairline that steps on as the view's code arrives,
 * builds and compiles. It fades once the view draws.
 */
export function loaderHtml(page: PageInfo): string {
  return [
    `<div class="scene-loader" aria-hidden="true" style="${loaderStyle(page)}">`,
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
 * portal.css), over a tiny copy of it until it lands: only that one loads, and none where the hero
 * stacks.
 */
export function heroHtml(): string {
  // Root-relative, from public/: the build puts the site's base path in front.
  const stills = THEME_NAMES.flatMap((theme) => [
    `--hero-${theme}: url('/${heroPath(theme)}')`,
    `--hero-${theme}-tiny: ${placeholderUrl(STILL_PLACEHOLDERS, heroPath(theme))}`,
  ]).join('; ');
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
 * and the page's CSS shows the reader's, so only that one loads (its head starts fetching it with
 * the page), over a tiny copy of it until it lands; under it, the lesson's name and
 * what it covers, then its section's. A section's first card carries its id, so a lesson's
 * breadcrumb leads to it.
 */
export function cardsHtml(): string {
  const lessonCard = (section: Section, lesson: Lesson, first: boolean) => {
    // Root-relative, from public/: the build puts the site's base path in front.
    const previews = THEME_NAMES.map(
      (theme) =>
        `<img class="card-image" data-theme-image="${theme}" src="/${previewPath(lesson.image, theme)}" alt="" width="${String(PREVIEW_SIZE.width)}" height="${String(PREVIEW_SIZE.height)}" loading="lazy" decoding="async" style="--tiny: ${placeholderUrl(STILL_PLACEHOLDERS, previewPath(lesson.image, theme))}" />`,
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
  const boot = `<script>${BOOT}</script>`;
  out = /<meta charset=[^>]*>/i.test(out)
    ? out.replace(/<meta charset=[^>]*>/i, (meta) => `${meta}\n    ${boot}`)
    : out.replace(/<head>/, (head) => `${head}\n    ${boot}`);
  // Then, coming from the site, the first screen's pictures are the first thing asked for (the
  // build puts the fonts after them), so a lesson's poster is in, from the cache, by the time the
  // page change reveals the page. After the viewport tag, as the script measures the screen: until
  // a phone reads that tag, it lays the page out 980 px wide.
  const pictures = picturesScript(page);
  if (pictures) {
    const script = `<script ${PICTURES_ATTR}>${pictures}</script>`;
    out = VIEWPORT.test(out)
      ? out.replace(VIEWPORT, (meta) => `${meta}\n    ${script}`)
      : out.replace(boot, () => `${boot}\n    ${script}`);
  }
  out = out.replace(/\s*<\/head>/, () => `\n    ${headTags(page)}\n  </head>`);
  out = out.replace(/<body([^>]*)>/, (body) => `${body}\n    ${headerHtml(page)}`);
  if (page.footer) out = out.replace(/\s*<\/body>/, () => `\n    ${footerHtml()}\n  </body>`);
  if (page.scene) out = out.replace(LOADER_SLOT, () => loaderHtml(page));
  out = out.replace(HERO_SLOT, () => heroHtml());
  out = out.replace(CARDS_SLOT, () => cardsHtml());
  return out;
}
