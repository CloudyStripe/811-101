# 811-101

An interactive learning site about buried utilities and line locating.

| Page                                                    | Path                                | Source                                                                      |
| ------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------- |
| Portal (home)                                           | `/811-101/`                         | `index.html`, `src/site/shell.ts`, `src/pages/portal/`, `content/portal.ts` |
| Frequency Lab (Locator Training)                        | `/811-101/training/frequency-lab/`  | `training/frequency-lab/`, `src/pages/frequency-lab/`                       |
| Gas & Petroleum: From Rock to Flame (Utility Education) | `/811-101/utilities/gas-petroleum/` | `utilities/gas-petroleum/`, `src/pages/gas-petroleum/`                      |
| Page not found                                          | any missing address                 | `404.html`, `src/pages/not-found/`                                          |

811 Basics shows on the portal as coming soon. The site's name, tagline and address live in
`config/brand.ts`.

## Site shell

- **One registry:** `src/site/pages.ts` lists every page: its title, description, share image,
  whether it has a 3D view, and its load budgets. The head tags, header, budgets and tests read it.
  Add a page there first.
- **Static shell:** `src/site/shell.ts` writes each built page's head (title, description, share
  preview, favicons, theme color, the settings script), the header, the footer, the 3D loader, and
  the portal's hero and sections (icons included) into its HTML at build time. The portal is all
  static: its script only names a lesson's preview for the page change as the lesson opens. Pages'
  own HTML keeps only what's theirs; links in it use `%BASE%`.
- **Stills:** the portal's hero and lesson previews are WebPs in `public/stills/`, one per theme
  (and for the hero, per screen shape), named in `src/site/stills.ts`; only the reader's loads.
- **Page changes:** cross-document view transitions (`base.css`), instant with reduced motion. A
  lesson's preview carries on into its loader; a lesson page waits for the change to finish before
  replacing its static shell (`src/site/arrival.ts`), or the animation is cut short.
- **Every page starts with** `src/site/boot.ts`: tokens, fonts, `base.css`, `components.css`,
  `site.css`, and the header's settings menu. Settings live in one store (`src/site/settings.ts`,
  `useSettings`), shared by the menu and the page.
- **Shared styles:** `src/design/components.css` holds buttons, the segmented control, chips,
  terms, dialogs and 3D labels. Hover styles go inside `@media (hover: hover)`.
- **Shared controls:** `Segmented` is a radio group built on `useRadioGroup` (one tab stop,
  arrows, Home and End): the lab's setup and its four frequency buttons, and the diorama's path
  switch.
- **The lab's layout:** the view, then a drawer (the guide or the key, one at a time, opened from
  the console and closed by its button or Escape), then the console (the summary of what the view
  shows, setup, frequency, pause, Guide and Key). The view is framed above whichever is open, so neither covers
  the lines; on short screens the drawer and console are a column beside the view.
- **The lab's two views** (`layout.ts`): from in front on wide screens, the ground drawn 3× deep;
  at three-quarters on tall ones, 7× deep so the lines are drawn thick, with the layers under the
  gas main's trench flattened to 2× (`VIEW_UNDER`) so the lines lead the cut face.
- **3D labels** (`src/kit3d/labels.ts`; where they go is decided in `placement.ts`, a pure,
  tested function): the highest-priority labels show, up to a cap. They keep off the buried lines
  (`setKeepClear`) and each other's leaders, hanging further off a line, or further along it, on a
  longer leader. In a short view (`LABEL_LIMITS.iconsBelow`) they show as icons, and an icon shows
  its name, over the others, while focused or its definition is pinned open by a tap.
- **Settings menu:** on a short screen held sideways, each setting's name sits beside its choices
  in a wider menu, so the whole menu fits under its button.
- **The wordmark** is the site's name set in Archivo, heavy and wide: in the header and footer,
  and as the two-line "811 / 101" tile of the favicons and share previews (`scripts/wordmark.ts`).
  Never 811 or Common Ground Alliance artwork.
- **Icons:** Phosphor, bold weight, generated into `src/design/icon-data.ts` from the
  `@phosphor-icons/core` package (`scripts/icon-data.ts`, `npm run icons`); `Icon` draws them in
  Preact, `iconSvg` in static HTML. No icon fonts, nothing fetched.
- **Credits:** `public/credits.txt` lists every package the site ships, with its license, and the
  footer links to it. `npm run credits` rewrites it; a test checks it's current.
- **404:** the dev and preview servers answer missing addresses with `404.html` and a 404 status,
  as GitHub Pages does. E2E tests that open one set `expectNotFound`.

## Status and scope

- Done: Phase 0 (the Frequency Lab) and the portal home. The rest of the brief's phases are on
  hold: don't plan or build them unless the owner asks.
- Read `docs/private/redo-brief.md` before starting work: it's the current brief for the site's
  look and UX, and it wins wherever it conflicts with `docs/BRIEF.md` or this file. Then read
  `docs/BRIEF.md`. Ignore `docs/PLAN.md`, an earlier plan. All of `docs/private/`, `docs/BRIEF.md`
  and `docs/PLAN.md` are **local-only** (gitignored).
- Never commit them, and never quote them in public text: commit messages, PR descriptions,
  code comments and content sign-offs stay free of business, product or customer details.
- Push nothing until the owner has tried the build and said OK.

## Commands

| Command              | What it does                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| `npm run dev`        | Dev server: http://localhost:5173/811-101/ (the portal)                                                |
| `npm run check`      | Typecheck, lint, format check, unit tests, generated-docs freshness, build, budgets. Must pass.        |
| `npm run e2e`        | Build, then Playwright: console/cross-origin/axe gates and the happy path                              |
| `npm run docs`       | Regenerate `docs/SIGNAL_MODEL.md` and `docs/CONTENT_REVIEW.md`                                         |
| `npm run budgets`    | Load budgets for each page, against the last build                                                     |
| `npm run thumbnails` | Re-capture the portal's stills, loader posters and share previews; run it when a lesson's look changes |
| `npm run icons`      | Regenerate the icon data from Phosphor and re-render the favicons from the wordmark                    |
| `npm run credits`    | Rewrite `public/credits.txt` from the installed packages                                               |

Useful URL parameters on the 3D pages:

- Lab: `?setup=steel|plastic` and `&f=512|8000|33000|83000` set the starting state.
- Diorama: `?stop=<id>` opens a stop (ids in `content/utilities/gas-petroleum.ts`).
- Both: `?tier=low|medium|high` forces a quality tier, `?perf` shows the performance HUD, and
  `?capture` gives deterministic frames for screenshots.

## Quality gates (every change)

- **`npm run check` passes.**
- **`npm run e2e` passes:** zero console errors or warnings, no failed or cross-origin requests, and axe (WCAG 2.2 AA) is clean.
- **Screenshots:** captured at 1440×900 and 390×844, in light and dark. Look at them yourself and fix anything that looks off.
- **Fresh reviewer:** a subagent that hasn't seen the work reviews it before a PR.

## Color rules (APWA uniform color code)

In the field, the color is the code.

- **Reserved for meaning:** APWA colors (`src/design/apwa.ts`) are never decoration or UI accent.
- **Neutral chrome:** the default accent is ink.

| Color  | Meaning                                                                 |
| ------ | ----------------------------------------------------------------------- |
| Red    | Electric power lines, cables, conduit, lighting cables                  |
| Orange | Telecommunications, alarm or signal lines, cables, conduit              |
| Yellow | Natural gas, oil, steam, petroleum, other gaseous or flammable material |
| Green  | Sewer and drain lines                                                   |
| Blue   | Potable water                                                           |
| Purple | Reclaimed water, irrigation, slurry lines                               |
| Pink   | Temporary survey markings, unknown or unidentified facilities           |
| White  | Proposed excavation limits or route                                     |

- **Never color alone:** color is never the only cue. Pair it with an icon, label, pattern or arrow.
- **Lines wear their code:** buried lines are drawn close to their full APWA color (`FACILITY_TINT_STRENGTH`), with an icon and label. It's a teaching aid: real pipe and cable color underground is unreliable, so say so where it matters.
- **The ground stays ground:** soils, rock and fill never read as a code color the lesson uses (tested lit and tone mapped). The lab's trench fill is a gray sand, so the gas main stands out by value too.
- **The signal's color:** the locate signal uses `SIGNAL_COLOR` (`src/design/tokens.ts`), which tests keep away from every APWA hue. Strength is brightness, not color.
- **Two yellow paths:** natural gas and petroleum share APWA yellow, so the diorama tells its fuel paths apart by pattern and icon (`src/design/paths.ts`): natural gas dashed with a flame, gasoline banded with a gas pump. The shared start is a neutral stone.
- **Water underground isn't blue:** in the diorama, groundwater and salty produced water are sands and browns, never APWA blue (drinking water); produced water is a murky brown-gray, never green (sewer). The open sea is a natural blue, lighter and greener than APWA blue (tested). Machines are white and gray, and quiz answers are marked in ink, icons and words, not green and red.

## Tokens and design

- **One source:** `src/design/tokens.ts` holds the chrome, scene palette, signal color, type stacks, and the type, spacing, motion, layer and elevation scales. The `virtual:tokens.css` module exposes them to CSS (`--text-*`, `--space-*`, `--dur*`, `--layer-*`, `--shadow-*`), and the 3D scene reads the same values.
- **Themes:** light and dark follow `prefers-color-scheme`, overridable with `data-theme`. Reduced motion follows the OS and `data-motion="reduce"`.
- **The look:** a sunlit toy model. By day a blue sky and a low, warm sun with long shadows; by night a deep blue sky, moonlight, lit windows and street lamps. Up close in the diorama at night, the ground's cover (lawns, plants, paths, roads and pads, not built things or the cut face) is drawn dimmer, grayer and cooler, so the view reads as night and the lamps' pools show warm; the overview and the lab, where the model floats in the night sky, keep it as it is (`ground` in the scene tokens, `gradeAsGround` in `src/kit3d/materials.ts`, `nightGradeAt` in the diorama's `shots.ts`). The UI is white and cool near-black, with pill buttons and heavy type. Tests hold the sky blue, the grass green, the UI cool, and sunlight at least 2.5 times the shade; an e2e squint test checks the model stands clear of the sky in real frames.
- **Finishes:** `FINISH` in `tokens.ts`: glossy paint with a clear coat on built things, matte on soil, grass, foliage, roofs and roads, and metal on steel.
- **Fonts:** Archivo (display), Atkinson Hyperlegible (body) and IBM Plex Mono (readouts), all self-hosted. No CDNs at runtime.

## Content rules

- **No invented facts:** never invent facts, rules or procedures. If unsure, ask the owner or flag it for review.
- **Claims and review:** every factual sentence in `content/` has a claim ID. After editing content, run `npm run docs`; `docs/CONTENT_REVIEW.md` lists every claim and its sign-off status. The portal's section and lesson descriptions (`content/portal.ts`) describe the lessons, not the world, so they don't need claim IDs.
- **Units:** US customary first, metric in parentheses.
- **Voice:** plain words, no background assumed, never talking down.
- **Depth:** keep it conceptual. One idea per sentence, qualitative words over numbers, and no data tables or readouts; leave out detail the lesson doesn't need.
- **Terms:** mark them with `[[term]]` or `[[shown words|term key]]`. Every marked term needs a definition, and a test enforces it.
- **The diorama's text** (`content/utilities/gas-petroleum.ts`): a few plain sentences per stop, no figures (the time-lapse's clock aside) and no side trips. A test holds it to the original word for word (`gas-petroleum.legacy.json`), but for the fork note and the "Using natural gas" label.

## Signal model

- **One place for values:** `src/signal/constants.ts` holds every rate, share and resistance, each with its units and the reason for its value.
- **Generated docs:** `docs/SIGNAL_MODEL.md` is generated from it.
- **Teaching calibrations:** the values are teaching calibrations, pending locator review.

## three.js rules

- **Banned APIs:** never use `PCFSoftShadowMap`, `Clock` or `ColorManagement.from/toWorkingColorSpace`. They log warnings in r186, and ESLint bans them. Use `PCFShadowMap` with `shadow.radius`, and `Timer`.
- **No fog:** the model floats in a screen-space gradient sky (`src/kit3d/backdrop.ts`), drawn through the inverse of the tone mapping so it shows as authored. If fog ever returns, N8AO needs `FogExp2`.
- **N8AO:** keep its debug mode and neural denoise off.
- **Version pin:** keep three on 0.186.x, because `postprocessing` 6.39 supports three below 0.187.
- **Shared runtime:** both 3D pages run on `src/kit3d/runtime.ts` (loop, tiers, post chain, capture, ready signal); a page brings its scene and what moves in it.
- **Bloom only for emitters,** and no NaN: every lit surface's glints are capped under bloom's threshold (`GLINT_CAP`, a shared shader chunk), so only fire and the signal bloom; lamps and lit windows glow under it. A shape that tapers to a point leaves zero normals, which shaders turn into NaN and bloom spreads over the whole frame; the diorama's builders run `fixNormals`.
- **Shadows hold still:** the shadow map renders once, and again only when the theme, tier or the lab's setup changes, the lab's block is built for another view, or a lost graphics context comes back, so moving parts don't cast into it; a unit test runs every diorama stop's machines and checks no shadow caster moved.

## The diorama's story

- **The journey** (`src/pages/gas-petroleum/journey.ts`) is a pure state machine with its own tests: Start walks the shared stops to the fork, where the reader chooses a path; that path's stops follow, then its quiz; the end offers the other path from the fork.
- **Labels the story names:** the open stop and where it goes next, or in the overview its landmarks; the others are quiet (`quiet` in `src/kit3d/labels.ts`), shown only while focused.
- **Motion in tests:** e2e tests count frames (`countFrames`, `isMoving` in `tests/e2e/fixtures.ts`), never screenshots of a moving canvas; one late frame after a pause isn't motion.

## Performance and accessibility

- **Budgets** are set per page in `src/site/pages.ts`; `scripts/budgets.ts` checks the build against them in `npm run check`.
- **GPU resources:** disposed on exit. Quality tiers have a manual override.
- **WCAG 2.2 AA:**
  - every control works by keyboard;
  - nothing needs dragging: the lab's view is fixed, and the diorama's overview, which turns by dragging, also turns by buttons and keys;
  - focus is never hidden under the panel or sheet, and both can be closed;
  - popovers can be hovered;
  - nothing pulses faster than 3 Hz, and the signal's motion has a pause button, whatever the
    motion setting;
  - the 3D view has a live text summary of what it shows.

## Git

- **Work:** one branch per phase and small commits. Commit messages end with the `Co-Authored-By` line.
