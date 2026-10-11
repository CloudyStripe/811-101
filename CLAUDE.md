# 811-101

An interactive learning site about buried utilities and line locating.

| Page                                                    | Path                                | Source                                                 |
| ------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------ |
| Portal (home)                                           | `/811-101/`                         | `index.html`, `src/pages/portal/`, `content/portal.ts` |
| Frequency Lab (Locator Training)                        | `/811-101/training/frequency-lab/`  | `training/frequency-lab/`, `src/pages/frequency-lab/`  |
| Gas & Petroleum: From Rock to Flame (Utility Education) | `/811-101/utilities/gas-petroleum/` | `utilities/gas-petroleum/index.html`                   |

811 Basics shows on the portal as coming soon. The site's name and tagline live in
`config/brand.ts`.

## Status and scope

- Done: Phase 0 (the Frequency Lab) and the portal home. The rest of the brief's phases are on
  hold: don't plan or build them unless the owner asks.
- Read `docs/BRIEF.md` and `docs/PLAN.md` before starting work. Both are **local-only**
  (gitignored) and so is `docs/private/`.
- Never commit them, and never quote them in public text: commit messages, PR descriptions,
  code comments and content sign-offs stay free of business, product or customer details.
- Push nothing until the owner has tried the build and said OK.

## Commands

| Command              | What it does                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| `npm run dev`        | Dev server: http://localhost:5173/811-101/ (the portal)                                         |
| `npm run check`      | Typecheck, lint, format check, unit tests, generated-docs freshness, build, budgets. Must pass. |
| `npm run e2e`        | Build, then Playwright: console/cross-origin/axe gates and the happy path                       |
| `npm run docs`       | Regenerate `docs/SIGNAL_MODEL.md` and `docs/CONTENT_REVIEW.md`                                  |
| `npm run budgets`    | Load budgets for each page, against the last build                                              |
| `npm run thumbnails` | Re-capture the portal's lesson images; run it when a lesson's look changes                      |

Useful URL parameters on the lab page:

- `?setup=steel|plastic` and `&f=512|8000|33000|83000` set the starting state.
- `?tier=low|medium|high` forces a quality tier.
- `?perf` shows the performance HUD.
- `?capture` gives deterministic frames for screenshots.

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
- **Tints are a teaching aid:** buried lines get a muted tint of their APWA color, with an icon and label. Real pipe and cable color underground is unreliable, so say so where it matters.
- **The signal's color:** the locate signal uses `SIGNAL_COLOR` (`src/design/tokens.ts`), which tests keep away from every APWA hue. Strength is brightness, not color.

## Tokens and design

- **One source:** `src/design/tokens.ts` holds the chrome, scene palette, signal color and type stacks. The `virtual:tokens.css` module exposes them to CSS, and the 3D scene reads the same values.
- **Themes:** light and dark follow `prefers-color-scheme`, overridable with `data-theme`. Reduced motion follows the OS and `data-motion="reduce"`.
- **Fonts:** Archivo (display), Atkinson Hyperlegible (body) and IBM Plex Mono (readouts), all self-hosted. No CDNs at runtime.

## Content rules

- **No invented facts:** never invent facts, rules or procedures. If unsure, ask the owner or flag it for review.
- **Claims and review:** every factual sentence in `content/` has a claim ID. After editing content, run `npm run docs`; `docs/CONTENT_REVIEW.md` lists every claim and its sign-off status. The portal's section and lesson descriptions (`content/portal.ts`) describe the lessons, not the world, so they don't need claim IDs.
- **Units:** US customary first, metric in parentheses.
- **Voice:** plain words, no background assumed, never talking down.
- **Depth:** keep it conceptual. One idea per sentence, qualitative words over numbers, and no data tables or readouts; leave out detail the lesson doesn't need.
- **Terms:** mark them with `[[term]]` or `[[shown words|term key]]`. Every marked term needs a definition, and a test enforces it.

## Signal model

- **One place for values:** `src/signal/constants.ts` holds every rate, share and resistance, each with its units and the reason for its value.
- **Generated docs:** `docs/SIGNAL_MODEL.md` is generated from it.
- **Teaching calibrations:** the values are teaching calibrations, pending locator review.

## three.js rules

- **Banned APIs:** never use `PCFSoftShadowMap`, `Clock` or `ColorManagement.from/toWorkingColorSpace`. They log warnings in r186, and ESLint bans them. Use `PCFShadowMap` with `shadow.radius`, and `Timer`.
- **N8AO:** use only `FogExp2`, since N8AO errors on custom fog, and keep its debug mode and neural denoise off.
- **Version pin:** keep three on 0.186.x, because `postprocessing` 6.39 supports three below 0.187.

## Performance and accessibility

- **Budgets** live in `scripts/budgets.ts` and run in `npm run check`.
- **GPU resources:** disposed on exit. Quality tiers have a manual override.
- **WCAG 2.2 AA:**
  - every control works by keyboard;
  - nothing needs dragging (the 3D view is fixed, framed to fit);
  - focus is never hidden under the panel or sheet, and both can be closed;
  - popovers can be hovered;
  - nothing pulses faster than 3 Hz;
  - the 3D view has a live text summary of what it shows.

## Git

- **Work:** one branch per phase and small commits. Commit messages end with the `Co-Authored-By` line.
- **The diorama** (`utilities/gas-petroleum/index.html`) is published byte-for-byte, and the deploy checks it. Leave it as it is, apart from its link back to the portal, until it's rebuilt to the lab's standard.
