/**
 * The Gas & Petroleum diorama, kept to the core journey: both guided tours run from the seafloor
 * to their quiz, every stop says what it needs in a few plain sentences, no text carries figures,
 * and the side trips (molecules, the fuel comparison, the engine) stay gone.
 */
import type { Page } from '@playwright/test';
import { DIORAMA_HOSTS, expect, test } from './fixtures.ts';

test.use({ allowHosts: DIORAMA_HOSTS });

/** Opens the diorama and waits for its scripts and fonts, so leaving never cuts them short. */
async function openDiorama(page: Page, hash = '') {
  await page.goto(`utilities/gas-petroleum/${hash}`);
  await expect(page.getByRole('heading', { name: 'Two fuels, one beginning' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

const TOURS = [
  {
    key: 'gas',
    button: 'Natural gas tour',
    steps: 9,
    last: 'Electricity, heat and things we make',
    other: 'Take the gasoline tour',
  },
  {
    key: 'gasoline',
    button: 'Gasoline tour',
    steps: 8,
    last: 'At the pump, then on the road',
    other: 'Take the natural gas tour',
  },
];

for (const tour of TOURS) {
  test(`the ${tour.button.toLowerCase()} runs from the seafloor to its quiz`, async ({ page }) => {
    await openDiorama(page);
    // The toolbar's menu and the overview both give the tour's length.
    const length = `${String(tour.steps)} steps`;
    await expect(page.locator(`#tour-menu [data-tour="${tour.key}"]`)).toContainText(length);
    const start = page.getByRole('button', { name: tour.button });
    await expect(start).toContainText(length);
    await start.click();
    const panelTitle = page.locator('#p-title');
    for (let step = 1; step <= tour.steps; step++) {
      await expect(page.locator('#t-count')).toHaveText(
        `Step ${String(step)} of ${String(tour.steps)}`,
      );
      if (step === tour.steps) await expect(panelTitle).toHaveText(tour.last);
      const next = step === tour.steps ? 'Take the quiz' : 'Next step';
      await page.getByRole('button', { name: next, exact: true }).click();
    }
    await expect(panelTitle).toHaveText('Quick check: 3 questions');
    for (const question of await page.locator('#p-body .q[data-q]').all()) {
      await question.getByRole('button').first().click();
    }
    await expect(page.getByText(/^You got \d of 3\.$/)).toBeVisible();
    await expect(page.getByRole('button', { name: tour.other })).toBeVisible();
    await expect(page.getByRole('button', { name: /compare/i })).toHaveCount(0);
  });
}

interface Stop {
  id: string;
  label: string;
  title: string;
  text: string;
  note?: string;
  safety?: string;
  terms?: Record<string, string>;
}
type Quiz = [string, string[], number, string];
type DebuggableDiorama = Window & {
  __app?: {
    STAGES: Stop[];
    OVERVIEW: { title: string; text: string };
    GLOSSARY: Record<string, string>;
    QUIZZES: Record<string, Quiz[]>;
    TIMELAPSE: [number, string][];
  };
};

test('every stop is a few plain sentences, no text has figures, and the side trips are gone', async ({
  page,
}) => {
  await openDiorama(page, '#debug');
  await expect(page.getByRole('button', { name: 'Molecules' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Compare fuels' })).toHaveCount(0);
  const content = await page.evaluate(() => {
    const app = (window as DebuggableDiorama).__app;
    if (!app) throw new Error('No #debug hook');
    return {
      stops: app.STAGES,
      overview: app.OVERVIEW,
      glossary: app.GLOSSARY,
      quizzes: app.QUIZZES,
      timelapse: app.TIMELAPSE,
    };
  });
  expect(content.stops.map((s) => s.id)).toEqual([
    'formation',
    'reservoir',
    'drilling',
    'lifting',
    'gas-plant',
    'pipeline',
    'storage-lng',
    'city-gate',
    'gas-uses',
    'crude-transport',
    'distillation',
    'delivery',
    'pump',
  ]);
  for (const stop of content.stops) {
    const sentences = stop.text.split(/[.!?](?:\s|$)/).filter((s) => s.trim() !== '');
    expect(sentences.length, `${stop.id}: sentences`).toBeLessThanOrEqual(3);
  }
  // Every string a learner reads, except the time-lapse's clock of millions of years.
  const texts: [string, string][] = [];
  for (const s of content.stops) {
    texts.push([`${s.id} label`, s.label], [`${s.id} title`, s.title], [`${s.id} text`, s.text]);
    if (s.note) texts.push([`${s.id} note`, s.note]);
    if (s.safety) texts.push([`${s.id} safety tip`, s.safety]);
    for (const [term, def] of Object.entries(s.terms ?? {})) texts.push([`${s.id}: ${term}`, def]);
  }
  texts.push(['overview', `${content.overview.title} ${content.overview.text}`]);
  for (const [term, def] of Object.entries(content.glossary))
    texts.push([`glossary: ${term}`, def]);
  for (const [question, options, , why] of Object.values(content.quizzes).flat()) {
    texts.push([`quiz: ${question}`, [question, ...options, why].join(' ')]);
  }
  for (const [, caption] of content.timelapse) texts.push(['time-lapse caption', caption]);
  for (const [where, text] of texts) expect(text, `${where}: no figures`).not.toMatch(/\d/);
});
