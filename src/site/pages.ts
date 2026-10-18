/**
 * Every page on the site, in one place. The site shell builds each page's head (title,
 * description, share preview, favicons), header and loader from this; the budgets, captures and
 * end-to-end tests loop over it too. Plain data, safe to import from the build config.
 */
import { BRAND } from '../../config/brand.ts';
import { SECTIONS, type Lesson } from '../../content/portal.ts';

export type PageId = 'portal' | 'frequency-lab' | 'gas-petroleum' | 'not-found';

/** Load budgets for a page, gzip KB (see scripts/budgets.ts). */
export interface PageBudgets {
  js: number;
  css: number;
  fonts: number;
  images?: number;
  /** Pages with a 3D scene: the lazy chunks. */
  vendor3d?: number;
  ao?: number;
  scene?: number;
  /** The loader's poster, while the view loads. */
  poster?: number;
  firstVisit: number;
}

export interface PageInfo {
  id: PageId;
  /** The page's HTML file, from the repo root. */
  html: string;
  /** Its address under the site's base path: '' for the home page. */
  path: string;
  /** The title in the browser tab and in share previews. */
  title: string;
  /** The page's name in the header, as its h1. Null where the page has its own h1. */
  heading: string | null;
  description: string;
  /** The share preview's image, in public/share/, and what it shows. */
  share: { image: string; alt: string };
  /** Pages with a 3D view get a loader in their shell, and their scene code preloaded. */
  scene: boolean;
  /** The site footer, for pages that scroll. */
  footer: boolean;
  /** Kept out of search results. */
  noindex?: boolean;
  budgets?: PageBudgets;
}

/** Each 3D page's poster, in public/, shown blurred while its view loads; one per theme. */
export const posterPath = (page: PageInfo, theme: 'light' | 'dark'): string =>
  `posters/${page.id}-${theme}.webp`;

/**
 * The name a lesson's preview on the portal and its loader's poster share, so one carries on into
 * the other as the page changes.
 */
export const lessonTransition = (id: PageId): string => `lesson-${id}`;

/** The portal section a lesson sits in, for the header's breadcrumb. */
export function sectionOf(path: string): { id: string; title: string } | null {
  const section = SECTIONS.find((s) => s.lessons.some((l) => l.href === path));
  return section ? { id: section.id, title: section.title } : null;
}

const lessonTitle = (name: string) => `${name} · ${BRAND.name}`;

export const PAGES: readonly PageInfo[] = [
  {
    id: 'portal',
    html: 'index.html',
    path: '',
    title: BRAND.name,
    heading: null,
    description: BRAND.tagline,
    share: {
      image: 'portal.jpg',
      alt: 'A street block cut away to show the gas main and telecom cable under it.',
    },
    scene: false,
    footer: true,
    budgets: { js: 30, css: 15, fonts: 150, images: 150, firstVisit: 350 },
  },
  {
    id: 'frequency-lab',
    html: 'training/frequency-lab/index.html',
    path: 'training/frequency-lab/',
    title: lessonTitle('Frequency Lab'),
    heading: 'Frequency Lab',
    description:
      "An interactive 3D lab about a locator's transmitter frequency: how far the signal travels along a steel gas main or a tracer wire, and how much bleeds onto nearby lines.",
    share: {
      image: 'frequency-lab.jpg',
      alt: 'The Frequency Lab: a locate signal glowing along a gas main in a street cut away to show what is buried.',
    },
    scene: true,
    footer: false,
    budgets: {
      js: 50,
      css: 30,
      fonts: 200,
      vendor3d: 240,
      ao: 85,
      scene: 70,
      poster: 20,
      firstVisit: 750,
    },
  },
  {
    id: 'gas-petroleum',
    html: 'utilities/gas-petroleum/index.html',
    path: 'utilities/gas-petroleum/',
    title: lessonTitle('Gas & Petroleum'),
    heading: 'Gas & Petroleum',
    description:
      'From Rock to Flame: how natural gas and gasoline are made, moved and used, in an interactive 3D model.',
    share: {
      image: 'gas-petroleum.jpg',
      alt: 'A cutaway model of the path from a gas well and an oil well to a city.',
    },
    scene: true,
    footer: false,
    budgets: {
      js: 50,
      css: 30,
      fonts: 200,
      vendor3d: 240,
      ao: 85,
      scene: 70,
      poster: 20,
      firstVisit: 750,
    },
  },
  {
    id: 'not-found',
    html: '404.html',
    path: '404.html',
    title: lessonTitle('Page not found'),
    heading: null,
    description: 'This page isn’t here. The lessons are listed on the home page.',
    share: {
      image: 'portal.jpg',
      alt: 'A street block cut away to show the gas main and telecom cable under it.',
    },
    scene: false,
    footer: true,
    noindex: true,
    budgets: { js: 30, css: 15, fonts: 150, firstVisit: 250 },
  },
];

export function pageById(id: PageId): PageInfo {
  const page = PAGES.find((p) => p.id === id);
  if (!page) throw new Error(`No page ${id}`);
  return page;
}

/**
 * The page whose HTML file this is, by its path from the project root (either slash). Exact, so a
 * page not in the registry gets nothing, not another page's head.
 */
export function pageForHtml(file: string): PageInfo | undefined {
  const normalized = file.replaceAll('\\', '/').replace(/^\.?\/+/, '');
  return PAGES.find((p) => p.html === normalized);
}

/** The page a lesson on the portal leads to. */
export function lessonPage(lesson: Lesson): PageInfo {
  const page = PAGES.find((p) => p.path === lesson.href);
  if (!page) throw new Error(`No page at ${lesson.href}`);
  return page;
}
