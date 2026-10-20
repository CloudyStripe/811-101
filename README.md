# 811-101

Short, visual lessons on buried utilities and how they're found.

**Live site:** <https://cloudystripe.github.io/811-101/>

- **811 Basics:** [Read the Marks](https://cloudystripe.github.io/811-101/basics/read-the-marks/), a game in a 3D yard: say what each color of paint and flag means, and see what's buried under the marks.
- **Locator Training:** the [Frequency Lab](https://cloudystripe.github.io/811-101/training/frequency-lab/), a 3D lab on why locators use the lowest frequency that works.
- **Utility Education:** [Gas & Petroleum: From Rock to Flame](https://cloudystripe.github.io/811-101/utilities/gas-petroleum/), a 3D diorama of how natural gas and gasoline are made, moved and used.

## How it's built

A static site: Vite, TypeScript and Preact, with three.js for the 3D lessons. Each page's head and
header, its footer or 3D loader where it has one, and the home page's content are written into its
HTML at build time, so it paints before the page's code loads. Lesson text lives in `content/`,
where every factual sentence has a claim ID for review. The images the site shows of its own
lessons are captured from them with `npm run thumbnails`.

## Working on it

`npm install`, then `npm run dev` and open <http://localhost:5173/811-101/>. `npm run check` and `npm run e2e` must pass before a change goes in. See `CLAUDE.md` for the project's conventions.
