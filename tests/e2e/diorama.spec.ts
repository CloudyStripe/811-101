/**
 * The Gas & Petroleum diorama, kept to the core journey: both guided tours run from the seafloor
 * to their quiz, every stop says what it needs in a few plain sentences, no text carries figures,
 * and the side trips (molecules, the fuel comparison, the engine) stay gone.
 */
import { DIORAMA_HOSTS, type DioramaWindow, expect, openDiorama, test } from './fixtures.ts';

test.use({ allowHosts: DIORAMA_HOSTS });

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

test('the text stays short and plain, and the side trips stay gone', async ({ page }) => {
  await openDiorama(page, '#debug');
  await expect(page.getByRole('button', { name: 'Molecules' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Compare fuels' })).toHaveCount(0);
  // Only the text: the hook's camera isn't something a test can copy out of the page.
  const { STAGES, OVERVIEW, GLOSSARY, QUIZZES, TIMELAPSE } = await page.evaluate(() => {
    const app = (window as DioramaWindow).__app;
    if (!app) throw new Error('No #debug hook');
    const { STAGES, OVERVIEW, GLOSSARY, QUIZZES, TIMELAPSE } = app;
    return { STAGES, OVERVIEW, GLOSSARY, QUIZZES, TIMELAPSE };
  });
  expect(STAGES.map((s) => s.id)).toEqual([
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
  for (const stop of STAGES) {
    const sentences = stop.text.split(/[.!?](?:\s|$)/).filter((s) => s.trim() !== '');
    expect(sentences.length, `${stop.id}: sentences`).toBeLessThanOrEqual(3);
  }
  // Every string a learner reads, except the time-lapse's clock of millions of years.
  const texts: [where: string, text: string][] = [
    ['overview', `${OVERVIEW.title} ${OVERVIEW.text}`],
    ...Object.entries(GLOSSARY),
    ...TIMELAPSE.map(([, caption]): [string, string] => ['time-lapse caption', caption]),
  ];
  for (const s of STAGES) {
    texts.push([`${s.id} label`, s.label], [`${s.id} title`, s.title], [`${s.id} text`, s.text]);
    if (s.note) texts.push([`${s.id} note`, s.note]);
    if (s.safety) texts.push([`${s.id} safety tip`, s.safety]);
    texts.push(...Object.entries(s.terms ?? {}));
  }
  for (const [question, options, , why] of Object.values(QUIZZES).flat()) {
    texts.push([`quiz: ${question}`, [question, ...options, why].join(' ')]);
  }
  for (const [where, text] of texts) expect(text, `${where}: no figures`).not.toMatch(/\d/);
});
