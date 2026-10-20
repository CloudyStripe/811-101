# 811-101

An interactive learning site about buried utilities and line locating.

| Page                                                    | Path                                | Source                                                                      |
| ------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------- |
| Portal (home)                                           | `/811-101/`                         | `index.html`, `src/site/shell.ts`, `src/pages/portal/`, `content/portal.ts` |
| Read the Marks (811 Basics)                             | `/811-101/basics/read-the-marks/`   | `basics/read-the-marks/`, `src/pages/read-the-marks/`                       |
| Frequency Lab (Locator Training)                        | `/811-101/training/frequency-lab/`  | `training/frequency-lab/`, `src/pages/frequency-lab/`                       |
| Gas & Petroleum: From Rock to Flame (Utility Education) | `/811-101/utilities/gas-petroleum/` | `utilities/gas-petroleum/`, `src/pages/gas-petroleum/`                      |
| Page not found                                          | any missing address                 | `404.html`, `src/pages/not-found/`                                          |

The site's name, tagline and address live in `config/brand.ts`.

## Site shell

- **One registry:** `src/site/pages.ts` lists every page: its title, description, share image,
  whether it has a 3D view, and its load budgets. The head tags, header, budgets and tests read it.
  Add a page there first.
- **Static shell:** `src/site/shell.ts` writes each built page's head (title, description, share
  preview, favicons, theme color, the settings script), the header, the footer, the 3D loader, and
  the portal's hero and cards (icons included) into its HTML at build time. The portal is all
  static: its script only names a lesson's preview for the page change as the lesson opens. Pages'
  own HTML keeps only what's theirs; links in it use `%BASE%`.
- **The portal:** about one screen on a desktop (tested at 1440 × 900): the whole diorama floating
  in its sky, with the site's name (the h1, set as its wordmark) and its tagline in the sky beside
  it; then a large card for each lesson, and one for any section still to come, over the sky's
  foot (two to a row on narrower screens, an odd one out the row's width). The page paints the diorama's own sky (`--sky-*`, from the scene tokens)
  across the screen, and the model's still stands at the hero's full height, so the two skies
  meet with no edge. The model shows only where it fits beside the name: wherever the hero would
  stack (phones, upright tablets, short screens), the name and its line sit on the sky, then the
  cards, and with no picture set there, the still is never fetched (tested on a phone). A
  lesson's card keeps its section's name and line, and a section's first card carries its id,
  where a lesson's breadcrumb leads.
- **Stills:** the portal's hero and lesson previews are WebPs in `public/stills/`, one per theme,
  named in `src/site/stills.ts`; only the reader's loads. `npm run thumbnails` makes them from the
  real 3D views: the hero is the diorama's overview two steps farther out, cut to the model and
  the sky's whole height; the Gas & Petroleum card is the refinery up close, and Read the Marks'
  is the yard with its gas line open. It makes each 3D
  page's loader posters too, one per theme and shape (`posterPath`): the view itself as it first
  draws (the diorama's where its arrival starts, `?arrival`), cut to its own box, at 1440 × 900
  (wide) and 390 × 844 (tall, for upright screens), shown under only a light blur so they look like
  the view about to start: at those sizes the view takes over from them with no jump, and on other
  screens they're cut to the stage, so it's close.
- **Nothing blank, nothing late:** each of the first screen's pictures stands over a tiny copy of
  itself, inline (`src/site/placeholders.ts`, made by `scripts/placeholders.ts`, which notes the
  version of each picture it was made from, so a test fails when one is stale), from the first paint
  until it lands; under a lesson's poster, the loader shows the copy too (a lesson's own loader
  keeps its shell's, so its code doesn't carry them). Coming from another page of the site
  (`FROM_THE_SITE`, by the referrer: a guess at what's cached, so a reader back from a bookmark gets
  a first visit's order), a page asks first thing in its head, after its viewport tag, for its first
  screen's pictures, in the reader's theme and a poster in the screen's shape (`picturesScript`),
  then for the fonts the first screen uses (`FIRST_SCREEN_FONTS`, the same on every page), so
  they're in from the cache before it shows. On a first visit it asks for neither up front, so it
  paints as soon as its styles and script are in: its pictures come once its styles find them, over
  their tiny copies, and the fonts once its text is laid out, so the display face can land just
  after the first paint. Once the portal is in, it prefetches its 3D lessons' posters, on a first
  visit too, so a lesson opened from it has its poster at its first paint (on the review server,
  which has every file asked for again, sometimes just after). And each page's own script holds its
  first paint until it runs (`blocking="render"`, `firstPaint` in `src/site/vite.ts`, which stops
  the build if a page misses it or a font), so a lesson shows its console or dock, and the header
  its settings button, in its first paint; its 3D code loads after, at low priority, and it builds
  its view only once it's been revealed and any page change into it has finished (`revealed` in
  `src/site/arrival.ts`). A test loads each page throttled like a phone (CPU 4×, 1.6 Mbps, 150 ms),
  its pictures held back until it has painted, and fails if its stage or a first-screen picture is
  blank (`tests/e2e/first-paint.spec.ts`).
- **Page changes:** cross-document view transitions (`base.css`), instant with reduced motion.
  Chromium skips one into a page revealed while its script is still loading, which is why each
  page's script holds its first paint. A lesson's preview carries on into its loader's poster once
  the poster is in (`data-poster`, set as it lands), and not into a tiny copy of it. The carried
  poster is drawn over the page, so while the view loads, what stands over the stage (the lab's
  console and drawer, the diorama's guide, dock and camera buttons, the loader's tag) takes part in
  the change on its own, drawn over it. A lesson page waits for a change under way to finish
  before replacing its static shell (`arrived`), or the animation is cut short (in a browser that
  paints before the script runs).
- **Every page starts with** `src/site/boot.ts`: tokens, fonts, `base.css`, `components.css`,
  `site.css`, and the header's settings menu. Settings live in one store (`src/site/settings.ts`,
  `useSettings`), shared by the menu and the page: theme, motion and quality in the menu, and
  whether the 3D views show their labels (`labels`), toggled on each lesson beside its view.
- **Shared styles:** `src/design/components.css` holds buttons, the segmented control, chips,
  terms, dialogs and 3D labels. Hover styles go inside `@media (hover: hover)`.
- **Shared controls:** `Segmented` is a radio group built on `useRadioGroup` (one tab stop,
  arrows, Home and End): the lab's setup and its four frequency buttons, and the diorama's path
  switch. `ScrollMore` is a scrolling body that shows when there's more of it below than shows:
  its foot fades, and a More button scrolls on, handing focus to the body at the end: the lab's
  drawer and the diorama's guide.
- **The lab's layout:** the view, then a drawer (the guide or the key, one at a time, opened from
  the console and closed by its button or Escape; while there's more of it below than shows, its
  foot fades and a More button scrolls on, handing focus to its body at the end), then the
  console (the summary of what the view shows, setup, frequency, pause, Guide, Key, and Labels,
  which shows or hides every label on the tools and lines). The view is framed above whichever is
  open, so neither covers the lines; on short screens the drawer and console are a column beside
  the view. Nothing else sits over the view: the lesson's one line is in the guide, and the Key
  says the view isn't to scale.
- **The lab's two views** (`layout.ts`): from in front on wide screens, and from the hookup end and
  above on tall ones. The ground the lines lie in is drawn as deep as it takes for the block to
  fill the height between the header and the console (`depthFor` in `fill.ts`, within each view's
  bounds in `VIEW_GROUND`), so no band of sky lies under it (tested at every design size, and on
  the real page): about 13× at 1440×900, deeper on squarer screens and phones, and shallow above an
  open drawer, where the block fills the strip's width instead. The layers under the gas main's
  trench, where nothing lies, are flattened to 1.5×; the lines keep one thickness (6×, 9× in the
  tall view). A new view or depth builds the block again (a resized window, once it holds still).
- **3D labels** (`src/kit3d/labels.ts`; where they go is decided in `placement.ts`, a pure,
  tested function): the highest-priority labels show, up to a cap. They keep a gutter (16 px) from
  the view's edges, room around the controls and the header, and off the buried lines
  (`setKeepClear`) and each other's points and leaders, hanging further off a line, or further
  along it, on a longer leader, and with no room on their own side of their point, on the other.
  In a short view (`LABEL_LIMITS.iconsBelow`) they show as icons, and an icon shows its name, over
  the others, while focused or its definition is pinned open by a tap. Placed as markers
  (`placeMarkers`), as the diorama's stops are, none gives way: every one in view shows, as its
  numbered badge, and names follow beside them in priority order wherever they fit; a focused or
  hovered one keeps its badge and its name's side where they were.
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

- Done: Phase 0 (the Frequency Lab), the portal home, and Read the Marks (811 Basics' first
  lesson, which the owner asked for). The rest of the brief's phases are on hold: don't plan or
  build them unless the owner asks.
- Read `docs/private/redo-brief.md` before starting work: it's the current brief for the site's
  look and UX, and it wins wherever it conflicts with `docs/BRIEF.md` or this file. Then read
  `docs/BRIEF.md`. Ignore `docs/PLAN.md`, an earlier plan. All of `docs/private/`, `docs/BRIEF.md`
  and `docs/PLAN.md` are **local-only** (gitignored).
- Never commit them, and never quote them in public text: commit messages, PR descriptions,
  code comments and content sign-offs stay free of business, product or customer details.
- Push nothing until the owner has tried the build and said OK. The owner tries it on the
  production build, `npm run review` (http://localhost:5173/811-101/), never the dev server.

## Commands

| Command              | What it does                                                                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`        | Dev server, for working on the code; the owner reviews the production build (`npm run review`)                                                  |
| `npm run review`     | Build into `dist-review/` and serve it at http://localhost:5173/811-101/: the copy the owner reviews                                            |
| `npm run check`      | Typecheck, lint, format check, unit tests, generated-docs freshness, build, budgets. Must pass.                                                 |
| `npm run e2e`        | Build, then Playwright: console/cross-origin/axe gates and the happy path                                                                       |
| `npm run docs`       | Regenerate `docs/SIGNAL_MODEL.md` and `docs/CONTENT_REVIEW.md`                                                                                  |
| `npm run budgets`    | Load budgets for each page, against the last build                                                                                              |
| `npm run thumbnails` | Re-capture the stills, loader posters, share previews and placeholders (`-- --only=<page id>`: one page's); run it when a lesson's look changes |
| `npm run icons`      | Regenerate the icon data from Phosphor and re-render the favicons from the wordmark                                                             |
| `npm run credits`    | Rewrite `public/credits.txt` from the installed packages                                                                                        |

Useful URL parameters on the 3D pages:

- Lab: `?setup=steel|plastic` and `&f=512|8000|33000|83000` set the starting state.
- Diorama: `?stop=<id>` opens a stop (ids in `content/utilities/gas-petroleum.ts`), and with
  `?capture`, `&arrival` holds the view where its arrival starts (as its loader's posters show it).
- Read the Marks: `?seed=<n>` fixes a round's order, and `?show=<mark>` opens a round at that
  mark, answered right (ids in `src/pages/read-the-marks/game.ts`), as its preview shows it.
- All three: `?tier=low|medium|high` forces a quality tier, `?perf` shows the performance HUD, and
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

Word for word from the APWA Uniform Color Code card (Rev. 4/99), which CGA Best Practices 22.0,
Appendix B, adopts (`content/sources.ts`):

| Color  | Meaning                                                   |
| ------ | --------------------------------------------------------- |
| Red    | Electric power lines, cables, conduit and lighting cables |
| Orange | Communication, alarm or signal lines, cables or conduit   |
| Yellow | Gas, oil, steam, petroleum or gaseous materials           |
| Green  | Sewers and drain lines                                    |
| Blue   | Potable water                                             |
| Purple | Reclaimed water, irrigation and slurry lines              |
| Pink   | Temporary survey markings                                 |
| White  | Proposed excavation                                       |

- **Marks wear their code:** in Read the Marks, the paint and flags above ground are their full APWA color, and nothing else in the yard reads as any of the eight colors, white included (`scene/palette.test.ts`, lit and tone mapped), but the grass and leaves, which are green as grass is: the green flags wear a light hem that stands clear of them. Its walls, fixtures, paving and boxes are warm grays and browns, and the reclaimed water box isn't purple. The Key and the end say the lines are drawn in their marks' colors, which real pipes and cables aren't always, and larger than life. The mark asked about is lit by a soft glow on the ground under it, the others dimmed a little, and a tag over it names its color; its own color never changes.
- **Never color alone:** color is never the only cue. Pair it with an icon, label, pattern or arrow.
- **Lines wear their code:** buried lines are drawn close to their full APWA color (`FACILITY_TINT_STRENGTH`), with an icon and label. It's a teaching aid: real pipe and cable color underground is unreliable, so say so where it matters.
- **The ground stays ground:** soils, rock and fill never read as a code color the lesson uses (tested lit and tone mapped). The lab's trench fill is a gray sand, so the gas main stands out by value too.
- **The signal's color:** the locate signal uses `SIGNAL_COLOR` (`src/design/tokens.ts`), which tests keep away from every APWA hue. Strength is brightness, not color; on the telecom cable, where the bleed-over has to read as the same signal over the cable's orange, its bands keep the signal's cyan, narrower and dimmer as it weakens, and none show for a mere trace.
- **Two yellow paths:** natural gas and petroleum share APWA yellow, so the diorama tells its fuel paths apart by pattern, shape and icon (`src/design/paths.ts`): natural gas dashed, a diamond with a flame; gasoline banded, a hexagon with a gas pump. The shared start is a neutral stone, a circle with a stack of layers. Their stops' markers, the map, the step bar's strip and the fork's choice all wear the same mark (`ui/PathShape.tsx`).
- **Water underground isn't blue:** in the diorama, groundwater and salty produced water are sands and browns, never APWA blue (drinking water); produced water is a murky brown-gray, never green (sewer). The open sea is a natural blue, lighter and greener than APWA blue (tested). Machines are white and gray, and quiz answers are marked in ink, icons and words, not green and red.

## Tokens and design

- **One source:** `src/design/tokens.ts` holds the chrome, scene palette, signal color, type stacks, and the type, spacing, motion, layer and elevation scales. The `virtual:tokens.css` module exposes them to CSS (`--text-*`, `--space-*`, `--dur*`, `--layer-*`, `--shadow-*`, and the diorama's sky, `--sky-*`), and the 3D scene reads the same values.
- **Themes:** light and dark follow `prefers-color-scheme`, overridable with `data-theme`. Reduced motion follows the OS and `data-motion="reduce"`.
- **The look:** a sunlit toy model. By day a blue sky and a low, warm sun with long shadows; by night a deep blue sky, moonlight, lit windows and street lamps. Up close in the diorama at night, the ground's cover (lawns, plants, paths, roads and pads, not built things or the cut face) is drawn dimmer, grayer and cooler, so the view reads as night and the lamps' pools show warm; the overview and the lab, where the model floats in the night sky, keep it as it is (`ground` in the scene tokens, `gradeAsGround` in `src/kit3d/materials.ts`, `nightGradeAt` in the diorama's `shots.ts`). The UI is white and cool near-black, with pill buttons and heavy type. Tests hold the sky blue, the grass green, the UI cool, and sunlight at least 2.5 times the shade; an e2e squint test checks the model stands clear of the sky in real frames.
- **Finishes:** `FINISH` in `tokens.ts`: glossy paint with a clear coat on built things, matte on soil, grass, foliage, roofs and roads, and metal on steel.
- **Fonts:** Archivo (display), Atkinson Hyperlegible (body) and IBM Plex Mono (readouts), all self-hosted. No CDNs at runtime.

## Content rules

- **No invented facts:** never invent facts, rules or procedures. If unsure, ask the owner or flag it for review.
- **Claims and review:** every factual sentence in `content/` has a claim ID, and can name its sources (`content/sources.ts`; every one of Read the Marks' does). After editing content, run `npm run docs`; `docs/CONTENT_REVIEW.md` lists every claim and its sign-off status. The portal's section and lesson descriptions (`content/portal.ts`) describe the lessons, not the world, so they don't need claim IDs.
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
- **Shared runtime:** every 3D page runs on `src/kit3d/runtime.ts` (loop, tiers, post chain, capture, ready signal); a page brings its scene and what moves in it.
- **Bloom only for emitters,** and no NaN: every lit surface's glints are capped under bloom's threshold (`GLINT_CAP`, a shared shader chunk), so only fire and the signal bloom; lamps and lit windows glow under it. A shape that tapers to a point leaves zero normals, which shaders turn into NaN and bloom spreads over the whole frame; the diorama's builders run `fixNormals`.
- **Shadows hold still:** the shadow map renders once, and again only when the theme, tier or the lab's setup changes, the lab's block is built for another view or depth, the yard's ground is cut along other lines, or a lost graphics context comes back, so moving parts don't cast into it; a unit test runs every diorama stop's machines and checks no shadow caster moved, and another opens and closes every line in the yard (its lids, flags and paint cast nothing).

## The diorama's story

- **The journey** (`src/pages/gas-petroleum/journey.ts`) is a pure state machine with its own tests: Start walks the shared stops to the fork, where the reader chooses a path; that path's stops follow, then its quiz; the end offers the other path from the fork. A stop opened on its own, from its marker or the map, starts a journey there along its path (`journeyAt`; a shared stop, along the path the view shows, or with the choice still to come), unless it's on the way of the one under way.
- **The step bar** (`ui/StepBar.tsx`) is the one set of step controls: Start at the beginning in the overview; at a stop, the overview and back (round buttons), "Step 6 of 9" over a strip of its stops, and Next, naming the stop it goes to ("Next: Using natural gas"; "Next" alone where the bar is too narrow for the name, which screen readers still hear), or Quiz at a path's end, or at the fork with no path chosen, Choose a path; in a quiz, back and Finish. It sits at the foot of the guide beside the view (under its title while it's closed) and under the sheet's bar on phones; where the guide is too narrow for all of it in a row, its way on takes a row of its own. ← and → step as it does (in a quiz, ← only).
- **The camera** (`src/kit3d/orbit.ts`, wrapping camera-controls): a drag turns the model all the way round, a right-drag or two fingers pan, the wheel or a pinch zooms toward the pointer, and a double-click or double-tap centers the view on that spot. It tilts between 3° and 78° from overhead, pans within the model (and just in front of its cut face), comes no nearer than what it looks at allows (nearer the higher that is, so tilted flat it still clears the grass: `nearestAt`, held by the rig every frame), and zooms out to a little past where the whole model shows from any side (`ORBIT` in `shots.ts`). On the focused model the arrows turn and tilt, + and − zoom, Shift and the arrows pan, and Home sets it back; elsewhere on the page ← and → step back and on. The cluster in the view's lower right corner (`ui/ViewControls.tsx`) does the same by buttons, which say when they're at a limit and, held, go on moving (they're there from the first paint, each disabled until the view is built); beside the view (761 px and wider) they sit in the dock's row (beside the open guide, from 1,024 px; narrower, above the dock), and on phones and short screens they're smaller, in one row where the view is wide enough. The view is framed above them, as beside the guide, so nothing it frames sits under them (where controls still sit over a corner, the overview slides the picture clear: `slide` on a view, in `src/kit3d/fit.ts`); under the open sheet the buttons are hidden and inert, as the view is, and on a phone held sideways the open sheet takes the view's column while the view, and its buttons, move to the column it leaves. The view draws only while something moves; the arrival settles in, and any input lands it. The canvas carries where the camera stands (`data-heading`, `data-tilt`, `data-zoom`, `data-at`) for tests.
- **Stop shots** (`stopShot` in `shots.ts`): each stop's subject (its parts, their details and its label) sits at the middle of the view at about a third of it (`STOP_SHOT.margin`), seen from at least 15° above level, with the marker of the stop it leads to on screen (`stopsInSight` in `journey.ts`: the next stop, both at the fork, the one before at a path's end). The camera stands back along its line as far as that takes, the subject still centered; a tall subject takes more than a third rather than send the camera past `STOP_SHOT.reach` of the overview's distance. The city gate is framed alone (`alone` on its view): it looks past its station east to the town, whose marker, high over the power plant, can't show behind the station with it at a third, so the station has the view (the step bar's Next goes on to it). Tall screens see the overview from the east.
- **Markers:** all thirteen stops show on the model as numbered markers in their path's mark (`ui/StopMarker.tsx`), each a button that opens its stop, with its path's icon on a tab. Each is named beside its badge where there's room, in the story's order, the path the view shows first after the fork, and by number alone where there isn't, or in a view too short for names (`LABEL_LIMITS.iconsBelow`, as under a phone's open sheet). While the view arrives they show by number alone, as names would come and go as it closes in; once it has all but landed (`ARRIVED_WITHIN`), the names fade in, as any name does where it comes to fit. The guide's map (`ui/RouteMap.tsx`) names every stop. The open stop's is named and filled in ink, its name placed with its badge, before the others, which keep clear of both; a focused or hovered one shows its name, and stays where it was, in the free part of the view; one on a path the view fades back shows by number, its ring and tab faded; one whose point is out of view, or under a control, steps out of sight. Badges keep off each other's points, and names off every point, so every leader shows. Their points show from every side (none hangs on a face), and the shared start's four sit at least 36 px apart in a tall phone's overview (tested). The small labels on an open stop's parts (`scene/details.ts`) hang beside the points they name, on leaders, so the parts show; the dock's labels toggle (the same `labels` setting as the lab's) hides every name in the view: these, and the stops' names, which then show only on a marker that's hovered or focused. The numbered markers stay, since they're how to get around; the step bar, the guide and its map are controls and keep their names (tested in each lesson, `tests/e2e/labels.spec.ts`).
- **Motion in tests:** e2e tests count frames (`countFrames`, `isMoving`, `waitStill` in `tests/e2e/fixtures.ts`), never screenshots of a moving canvas; one late frame after a pause isn't motion, and stillness waits out the longest of the last few gaps between frames, as one slow software frame isn't stillness.

## Read the Marks

- **The game** (`src/pages/read-the-marks/game.ts`) is a pure state machine with its own tests: a
  round asks about each of the yard's eight marks once, white first (where you'll dig), then the
  other seven in a new order each round. Each has four answers, each a color's meaning in short:
  the right one, one easily confused with it (`CONFUSED_WITH`), and two at random. An answer
  marks the right one beside the reader's, says in one line what the color means ("Not quite.
  Yellow means gas, oil, steam, petroleum or gaseous materials."), then what's under the marks.
  The end shows the score, a safety line and the whole code, each color answered wrong tagged
  "Missed" beside its meaning (in ink, an icon and the word), and Play again. No timer, levels or
  saves.
- **The mark asked about** glows on the ground under it, its flags stand a little taller, the
  others dim, and a tag hangs over it (its middle flag; white's, the bed): its color's chip with a
  flag on it and the color's name, nothing that tells what it means. The tag points out the
  question, so it shows with the labels off too (`data-pointer`, which tests' `shownNames` skips),
  and goes with the glow once the mark's answered.
- **The yard** (`scene/layout.ts`, in feet, tested): a house and garage, a lawn, a sidewalk and a
  street, seen from a fixed angle (the tall view where the room is tall). Every mark is in the
  yard, from the curb in; nothing's in the street. Lines run straight or with one turn, so each
  cut along one is a box. Flags stand on grass; paint shows where a line crosses the sidewalk or
  the driveway. Green and purple are public lines: the sewer out to its cleanout, and reclaimed
  water from the curb to its own box in the grass strip. The view can't turn, so what's in a cut
  must show from it: the two water lines, whose cuts are short, lie shallow, their boxes just in
  front of the sidewalk.
- **The ground opens:** answered, the ground is built again, cut along the mark's line (`carve`
  in `scene/ground.ts`), and each run's lid (its cover: at a turn, the run whose slide carries
  the corner clear of the other's trench has it) drops and slides aside, away from the camera, or
  the other way where that would cross another line's cut (`coverOf`, `asideOf` in
  `scene/layout.ts`, tested). The paint on a cover rides with it, whichever mark it is (the white
  outline's dashes over the gas line, cut at the cover's edge: `piecesOf`), and the flags on it
  step off onto the grass, until the line shows, named; with reduced motion it's open at once.
  Next mark closes it again, and at the end every line is open at once. A line's name points at
  the stretch of it the view sees into, with others along it to fall back on, keeping off the open
  lines (the sewer's, at its riser, as it lies too deep to see). With every line open at the end,
  room is short, so the names go in an order: the line through where you'll dig first, then the
  farther ones (the far side is smaller in the view); the lines seen only in the grass strip hang
  theirs below, over the street. So every name shows at the end, phones included (tested); in the
  smallest views, as in the other lessons, they show as icons.
- **The panel:** beside the yard on wide and short screens (a phone held sideways), and under it
  in a sheet on phones held upright, one height through a round (`--rm-sheet`), so the yard keeps
  its size; there the answers sit at the sheet's foot, and once answered the result takes their
  place (and the first mark's intro's), right over Next, so the thumb stays put. On the shortest screens the color's chip and the progress dots give way, so a
  mark's answers all show. While focus is in the question, 1 to 4 answer (only
  there, as single keys acting anywhere would fail WCAG 2.1.4); focus moves on to Next, whose
  description is the answer, then to the next mark. The Key shows the whole code at any time. The
  status line (`#rm-status`, set once focus has moved, so it isn't cut short) says what's lit,
  then what's under it once answered, then the score.

## Performance and accessibility

- **Budgets** are set per page in `src/site/pages.ts`; `scripts/budgets.ts` checks the build against them in `npm run check`.
- **GPU resources:** disposed on exit. Quality tiers have a manual override.
- **WCAG 2.2 AA:**
  - every control works by keyboard;
  - nothing needs dragging: the lab's and the yard's views are fixed, and the diorama's view, which turns, tilts and zooms by dragging, the wheel or a pinch, does the same by its buttons and keys, and a double-click or double-tap centers it on a spot;
  - focus is never hidden under the panel or sheet, and both can be closed;
  - popovers can be hovered;
  - nothing pulses faster than 3 Hz, and the signal's motion has a pause button, whatever the
    motion setting;
  - the 3D view has a live text summary of what it shows.

## Git

- **Work:** one branch per phase and small commits. Commit messages end with the `Co-Authored-By` line.
