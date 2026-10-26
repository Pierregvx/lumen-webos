# Design audit

Written 2026-10-26. Report only: no code was changed. It looks at the visual design language (colour, type, space, shape, glass, focus, motion) and at how the code holds it.

## Summary

The look on the TV is close to a consistent tvOS style. The code that makes it is not. Each change was added as a new block at the end of `app/src/theme/global.css`, which overrides earlier blocks. Nothing old was removed. The result is a stylesheet where most values are typed by hand, the same selector is set up to 8 times, and the final look of an element depends on which rule comes last.

The tokens in `app/src/theme/tokens.ts` were meant to be the single source of truth. Today they are a starting point that later rules override. Most colours, sizes and timings never touch them.

If we built it again today, we would define a small set of named parts first (3 glass materials, 2 focus styles, one type scale, one motion set, one colour set per theme), and build every screen from them. The look would stay the same. The work is to name what is already there and delete what is overridden.

## The numbers

Counts from `app/src/theme/global.css` (1,586 lines).

| What | Count | A designed system would have about |
|---|---|---|
| Distinct font sizes | 30 | 7 |
| Font weights in use | 8 (200, 300, 400, 450, 500, 600, 650, 700) | 4 |
| Distinct border radii | 33 | 4 rules |
| `rgba()` colour values | 390 uses | 10 to 15 named colours per theme |
| Hand-typed hex colours | 14 distinct | 0 outside the token file |
| Transition durations | 20 distinct | 3 or 4 |
| Easing curves | 8 | 2 |
| Focus scale values | 11 (1.02 to 1.24) | 2 or 3 |
| `!important` | 42 | 0 to 2 |
| `html.light` rules | 70 | 0 (the theme swaps tokens) |
| Selector set up most often | `.screen > .pill.status` and `.rows`, 8 times each | 1 |
| Copies of the glass recipe | 4 identical copies of the same gradient, size, position and rim | 1 |

The section headings in the stylesheet read like a change log, not a structure: "taller wallpaper window", "date and time on one row", "glass bar: 40px of glass round the tiles (it was 24)", "time top left", "big clock". Each one changes something an earlier section set.

## Findings

### 1. Tokens exist but do not lead

- `tokens.ts` defines 13 font sizes. Three are never used (`settingsTab`, `optionLabel`, `optionDescription`). Most others are used once and then overridden. For example, `clockTime` is 44px in the token, then set to 30px, 52px, 30px, 120px and finally 80px by later rules.
- `MOTION.focusScale` is 1.16. The home rows override it four times (1.1, 1.14, 1.12, 1.06) and the focus-strength setting overrides it three more times. The token value is never what the TV shows.
- `MOTION.unfocusedRowOpacity` is 0.6. A later rule forces every row to opacity 1 (`global.css:1081`).
- `LAYOUT.edgePadding` is 140px, but the home screen, the guide and the panels use `rowsEdge` (125px). Settings uses its own numbers (110px, 810px, 90px). There are three screen margins.
- Two token comments are swapped: `tileSize` says "5:3 landscape" and `tileHeight` says "square" (`tokens.ts:52`).
- Colour tokens cover the old flat look (`#EEEEEE`, `#AAAAAA`, switch colours). The glass look that replaced it has no tokens. It uses plain `rgba()` values everywhere, and `#fff` (46 uses) in place of `textPrimary`.

### 2. Glass: one material, built many ways

The glass is the core of the look, but there is no single definition of it. There are at least five recipes:

1. The pre-blurred wallpaper copy with a 135° sheen and inset rims (`.pill`, `.panel`, `.topcap`, `.cc__mod`, the glass bar). The recipe is copied in full four times (`global.css:441`, `:516`, `:629`, `:1173`).
2. The live-blur version of the same shapes (`html.liveblur ...`, 25 rules), with its own weaker sheen and rims.
3. "Faint glass" rows: `rgba(255,255,255,0.09)` with a 1.5px top-left rim (guide rows, full-guide cells, the guide switcher, the Settings top-right button).
4. Settings rows: a 145° gradient from 0.16 to 0.06, no rim (`.slist__row`).
5. A flat fill with no rim (`.slist__icon`, 0.22) and other one-off fills (`.wp__chip` 0.08, `.qc__bar` 0.28).

Live blur is now always on (`app.tsx:273`: "the glass is always live blur now"). So the first recipe is mostly dead. Live blur empties `--wp-blur` on every element (`global.css:966`), and the night-dimming rules for the glass all say `:not(.liveblur)` (`global.css:680` to `:690`), so they never apply. `RESEARCH.md` section 4 still says "No live blur anywhere". The decision changed, but the old code and the old doc stayed.

### 3. Focus: four styles where two would do

A remote-driven UI lives on its focus state, so this is the most visible place for inconsistency.

| Style | Where |
|---|---|
| Lift: grow, shadow, sheen, no colour change | Home tiles, glass-bar tiles, Settings grid tiles |
| Brighter glass: grow, stronger sheen | Top buttons, the time pill, Control Center controls |
| Invert: white fill, dark text | Menu rows, Settings rows, guide rows, full-guide cells, wallpaper chips, the Settings button, the guide switcher, the icon inside the time pill |
| Ring: a 4px white outline | Wallpaper thumbnails, tiles in the Inputs and folder panels |

The invert style also grows by a different amount on each surface: 1.02 (guide rows), 1.03 (Settings rows), 1.05 (Control Center options), 1.06 (chips, time pill), 1.08 (guide switcher, Settings button), 1.1 (Control Center controls).

tvOS itself uses two rules: content (pictures, app icons) lifts, and controls (text rows, buttons) invert. Lumen already does this in most places. The ring is the odd one out, and the scale values are noise.

### 4. Type

- 30 font sizes with no scale behind them. Many are 1 or 2px apart (18, 19, 20, 21, 22 and 24, 26, 28, 30, 32, 34, 36). On a TV at 3 metres, a 1px step is not visible. It only makes the set harder to keep.
- Weights 450 and 650 come from the variable font. They are used in a few places each, beside 500, 600 and 700 that do the same job.
- Secondary text is made in at least four ways: the `textSecondary` token, `opacity` from 0.55 to 0.92 (about ten values), `rgba(255,255,255,x)` from 0.55 to 0.94, and `color: #fff` with a text shadow. The same role looks a little different on each screen.
- Letter spacing has about 12 values from -0.02em to 0.18em.
- The project rule says no tabular digits except the clock (`CLAUDE.md`). Nine rules still set `font-variant-numeric: tabular-nums`: `.chan__times`, `.guide__cols`, `.guide__num`, `.guide__meta`, `.guide__typed`, `.fg__meta`, `.fg__times`, `.fg__num`, `.fg__ptime`.

### 5. Shape

33 distinct radii. Most of them follow two good rules that are not written down:

- A capsule: the radius is half the height (29px on a 58px pill, 35px on a 70px row, 36px on a 72px option, 38px on a 76px menu row).
- Concentric corners: an outer shape's radius is the inner radius plus the gap (the glass bar, `calc(var(--layout-tile-radius) + 40px)`).

The rest are one-offs (10, 12, 14, 16, 18, 20, 21, 22, 30, 42, 44, 110px). If the two rules were the system, most of these would go.

### 6. Colour and theme

- Light mode is 70 override rules, many with `!important`. Each component has a dark version in its own rule and a light version in a separate `html.light` rule, often far apart in the file. Add a component and you must remember to add its light twin.
- Dark ink is `#111` in some focus states and `#14151b` in others.
- Accent colours have no tokens: the "on" blue is `rgb(64,196,255)` in dark and `rgb(0,122,255)` in light; the weather blue is `#a8d8ff`, `#7cc4ff` and `rgba(124,196,255,x)`; the warning red is `rgb(255,92,82)` while the token `danger` is `#e0564f`; the favourite star is `#ffd60a`.
- The channel tile gradient is typed in four places: three in CSS and one in `app.tsx:398`.

### 7. Motion

- 20 durations and 8 curves. The focus token (160ms) and scroll token (260ms) are used in about 20 places; everything else is typed by hand (200, 220, 240, 253, 276, 312, 320, 340, 400, 420, 500, 600ms).
- The main curve is `cubic-bezier(0.2, 0.7, 0.2, 1)` in CSS, but the JS animations use `cubic-bezier(0.2, 0.8, 0.2, 1)` (`Home.tsx:92`, `ControlCenter.tsx:101`) and `cubic-bezier(0.4, 0, 0.2, 1)` (`Ambient.tsx:56`). They are near copies that drifted.
- Some values are tuned by feel and recorded in comments (Up 340ms, Down 276ms, "Sam felt it too fast"). Those are real decisions and should become named tokens, not be lost in a cleanup.

### 8. Names that no longer mean what they say

- "The dock" in the docs and comments is the glass bar (the first home row). In the CSS the glass bar is `.row:not(.row--dock)`, because `.row--dock` is an older small dock. That small dock is never used: no code passes `compact` to `Row`. Its 34 rules are dead, and they make every glass-bar selector a negative one.
- The clock, date and weather block is `.screen > .pill.status`. It is no longer a pill. Later rules remove the pill's glass, shadow and padding (`global.css:701`, `:838`). The same is true of `.clock`, which was a glass pill and is now plain text.
- `components/Header.tsx` (the greeting) is not imported anywhere. Its styles and the `greeting` token remain.
- Selectors fight for priority: `html:root body .panel.panel--cc` exists only to beat `html.liveblur.light .panel` (`global.css:1153`).

### 9. Numbers shared between TS and CSS by hand

Several layout values exist twice, once in a `.tsx` file and once in CSS, and must be kept equal by hand:

- Guide row step 132px (`Guide.tsx:29`) and `.guide__row` height 120px plus 12px margin.
- Full guide row step 80px (`FullGuide.tsx:32`) and 70px plus 10px.
- Control Center option 72px and gap 12px (`ControlCenter.tsx:82`) and `.cc__opt`.
- Wallpaper row step `203 + 70` (`WallpaperPicker.tsx:33`) and `.wp__thumb`.
- Long press 600ms in `TIMING.longPressMs`, but typed again as 600 in `Home.tsx:342` and `WallpaperPicker.tsx:67`.
- Hard-coded content widths: 1640px, and fallbacks of 1556px and 1670px for `--row-w`.

### 10. Screens each build their own list

Five components scroll a focused list or grid and draw only the rows near the focus: `Grid`, `SettingsList`, `WallpaperPicker`, `Guide` and `FullGuide`. Each has its own `ROW_STEP`, its own `SPARE` count, its own track transform and its own focus logic. Each screen (`Home`, `Settings`, `ControlCenter`, `Guide`) also has its own "zone" state machine for which part of the screen has focus. They behave alike because they were copied, not because they share code. A change to how scrolling feels must be made five times.

`app.tsx` is 964 lines. It holds the app state, all 40 Settings options (lines 445 to 720), the row building, and the theme classes on `<html>`. Settings content and Settings layout live in different files, which is fine, but the option list would be easier to find in its own file.

## From first principles

If we started today, with the same look as the TV shows now, the design system would be these parts. Each one is already in the code in some form; the work is to name it once.

### Tokens, in CSS, by role

Put the visual tokens in a CSS file on `:root`, by role, not by component. Keep `tokens.ts` only for the numbers the layout code needs (tile sizes, row steps), and have the CSS read those same values.

- Ink: `--ink-1` (primary), `--ink-2` (secondary), `--ink-3` (tertiary). Three levels, no opacity tricks.
- Accent: `--accent-on` (a control that is on), `--accent-rain`, `--danger`, `--star`.
- Focus: `--focus-fill`, `--focus-ink`.
- Scrims: `--scrim-text` (the shadow behind text on a photo), `--scrim-veil` (the backdrop behind lower rows, Settings and the guide).

A theme is then only a new set of values for these names. Light mode becomes one block of about 15 lines, not 70 rules spread through the file.

### Three glass materials

- `glass-bar`: the large shape (the glass bar, panels).
- `glass-control`: small shapes you focus (top buttons, the time pill, Control Center controls).
- `glass-row`: faint glass for list rows on the veil (guide, full guide, Settings rows, the switcher).

Each is one class or one set of custom properties: tint, sheen, rim, shadow, blur. Every component that is glass uses one of the three. The live-blur choice becomes a property of the material, not 25 extra rules.

### Two focus styles

- `focus-lift` for content: grow by `--lift` (one value per focus-strength setting), shadow, sheen.
- `focus-invert` for controls: `--focus-fill` and `--focus-ink`, grow by `--press` (about 1.04, one value).

The ring goes. The 11 scale values become 2 per focus-strength setting.

### One type scale

About seven steps, each with a set size, weight, line height and letter spacing. A starting point, close to what the TV shows today:

| Step | Size | Weight | Used for |
|---|---|---|---|
| clock-xl | 120 | 650 → 600 | Screensaver time |
| clock | 80 | 600 | Home time |
| title | 56 | 700 | Guide and programme titles |
| headline | 32 | 600 | Settings rows, programme names |
| body | 26 | 500 | Date, descriptions, menu rows |
| caption | 22 | 500 | Times, meta lines, tile names |
| small | 18 | 500 | Hour labels, flags |

Weights become 400, 500, 600, 700.

### Shape rules

- Capsule: `border-radius: 999px` for anything with a set height.
- Tile: `--radius-tile` (34px), `--radius-tile-sm` (24px).
- Card: `--radius-card` (30px) for rows and cards.
- Concentric: the outer radius is the inner radius plus the gap, always as a `calc()`.

### Motion

- `--dur-focus` 160ms, `--dur-move` 260ms, `--dur-fade` 500ms, plus the two tuned values for Up and Down as named tokens.
- `--ease-out` (the existing `0.2, 0.7, 0.2, 1`) for almost everything, `--ease-in-out` for crossfades.
- JS animations read the same values from the shared module, so they cannot drift.

### File layout

The build target is Chrome 79, so CSS nesting and `@layer` are not available. Split the stylesheet by part instead, each imported in a set order:

1. `tokens.css` and `themes.css`: the values above.
2. `materials.css`: the three glass materials and two focus styles.
3. One file per component (`tile.css`, `glass-bar.css`, `status.css`, `control-center.css`, `guide.css`, `settings.css`, `forecast.css`, `ambient.css`).

In a component file, each selector is set up once. A change edits that rule; it does not add a new one below.

### Shared code for lists and focus

One windowed list helper (row step, spare rows, track offset) for the five lists, and one small focus-zone helper for the screens. The five components keep their own markup and use the helpers for the scroll and focus logic.

## How to get there

Ordered so that each step can be checked on the TV on its own, and the early steps change nothing you can see. The project rule still applies: try each visible change live over DevTools first, then build.

1. Delete dead code. The small dock (`.row--dock`, `compact`), `Header.tsx` and the greeting, the night rules that say `:not(.liveblur)`, the pre-blurred glass recipe where live blur replaces it, and each overridden copy of a selector (keep the last one, which is what the TV shows). No visible change. A TV screenshot before and after each screen should match.
2. Collapse each repeated selector into one rule, in place. No visible change.
3. Rename to match what things are: the glass bar, the status block, the time. No visible change.
4. Add colour, type, radius and motion tokens with today's values, and point the rules at them. No visible change.
5. Move the light theme from override rules to token values. Check light mode on the TV.
6. Merge the glass recipes into three materials. Small visible change; check each surface.
7. Bring focus to two styles and the scale values to two per setting. Visible change; try it live first.
8. Snap font sizes and weights to the scale. Visible change; try it live first.
9. Share the list and focus-zone helpers. No visible change if done right; check scroll feel on each list.
10. Fix the doc drift: `RESEARCH.md` section 4 (live blur), `docs/settings-redesign.md` (it names `OptionList.tsx` and `ChoicePicker.tsx`, which are gone).

Steps 1 to 4 are mechanical and low risk. Steps 6 to 8 are design decisions and need you to look at the TV.

## Progress (branch `design/system-cleanup`, 2026-10-26)

Steps 1 to 5 and 10 are done. Nothing is meant to look different.

- `global.css` is gone. The stylesheet is now 11 files in `app/src/theme/`, imported in order in `main.tsx`: `tokens.css`, `base.css`, `tiles.css`, `home.css`, `panels.css`, `settings.css`, `guide.css`, `live-tv.css`, `forecast.css`, `ambient.css` and `themes.css`. It is about 1,100 lines, down from 1,562.
- Each selector is set up once. `!important` is left only where something inline or everywhere must lose: the wallpaper's `--wp-bg` over the video (`lib/wallpaper.ts` sets it inline), the two canvas backdrops, and Reduce motion.
- The colours, glass, shapes and timings are tokens in `tokens.css`. `tokens.ts` now holds only the layout numbers that the code also reads.
- The light look and the focus strength are new token values in `themes.css`. A few component rules stay there, where the light look changes the style and not only a value: the status text, the Re-order button and the wallpaper chips.
- Dead code is gone: the small dock (`.row--dock`, `compact`), `Header.tsx`, the time pill and its menu (no top button had its key), the `liveblur` class (it was always on), the pre-blurred glass, and the Quick Controls, switch and old status styles.
- Renamed: the status block is `.status` (it was `.pill.status`).
- Step 9, the lists part, is done. `lib/windowedList.ts` holds the scroll maths. `rowWindow` serves `SettingsList`, `Guide` and `FullGuide`, which scroll by whole rows. `gridWindow` serves `Grid` and `WallpaperPicker`, which centre the focused row by pixels. Each list keeps its own numbers and markup. Some parts stay inline because only one list has them: the grid measures its row height, Settings shows the bottom fade, and the grid draws empty tiles for far rows. A script compared the old and new maths for lists of 0 to 250 rows and each focus, and found no difference. The focus-zone part of step 9 is not done.
- Step 10 needed no change: `RESEARCH.md` section 4 already said "a light live blur only on the focused control", and `docs/settings-redesign.md` names the old components only in its history.

How it was checked: `tools/style-snapshot.mjs` records the computed style and box of every element on 122 screens, in dark and light (home, the glass bar, the grid, the top buttons, Control Center and its lists, a folder, Settings pages, the wallpaper picker, the Guide, the Full guide, the screensaver with each weather widget, and each focus strength). `tools/style-diff.mjs` compares the old build with the new one. Run on the same build twice, it finds no differences. Between the old and new builds, the only differences are values nothing draws: a corner radius on the status block (it has no background), a fully transparent tile outline, where a background image would sit on boxes that have none, `align-self` on the absolutely placed Re-order button, and `flex-wrap` on the wallpaper picker's track, which is not a flex box. No box moved by a pixel.

Not covered by the check: the video wallpaper, the Inputs panel with real inputs, the toast, and the Re-order mode's lifted tiles. These need the TV.

A bug was found and kept at first, so that the cleanup changed nothing: in the light look, the screensaver's weather widget drew its icons dark grey on the photo. Its rule is now deleted (2026-10-26), so the icons are white.

## Answers (Sam, 2026-10-26, from TV screenshots)

- The ring goes. Wallpaper thumbnails and folder tiles lift: they grow and take the home tiles' shadow (`--lift-shadow`). The thumbnail grows by 1.1, the value Sam saw. The picker's window has 28px of room at each side for it.
- Settings uses home's screen margin, `--layout-rows-edge` (125px), on its list pages and its grid pages. `LAYOUT.edgePadding` (140px) still sets the screen's padding and the video caption on home.
- Live blur only. The pre-blurred glass stays removed.
- The guides and the Live TV row use normal digits. The clock time is the one place with tabular digits.

## Step 6 (Sam, 2026-10-26, live on the TV)

- Settings rows and the wallpaper chips are glass-row, as in the Guide. Each Settings row has its own layer, which fixed a slow Up and Down (`docs/frame-rate.md`).
- The folder panel stays glass-control. The glass bar's blue and pink rim fringe is for the dock only: it is subtle there and echoes the pink icons at the dock's ends. On a bigger shape the pink shows too much. So the materials are glass-bar (the dock alone), glass-control (controls and the folder panel) and glass-row.

## Steps 7 and 8 (Sam, 2026-10-26, live on the TV)

- Focus-invert grows by two tokens: `--lift-press` (1.03) for wide rows (Settings rows, Guide rows, Control Center choices) and `--lift-pill` (1.08) for small pills (the Guide switcher, the Re-order button). Focus highlight changes both. The Full guide cells do not grow: a long cell at 1.03 would push into its neighbours.
- Settings' grid and folder tiles lift like home tiles: `--lift`, 7.5px up, `--lift-shadow`. `--lift-tile` is gone.
- The wallpaper chips are one bar with a pill that slides to the picked category (`WallpaperPicker.tsx`). Each category takes its text width plus an even share of the spare room. The grid swaps 250 ms after the last Left or Right (`TIMING.wallpaperGridMs`), so the slide does not stall.
- Settings' tile and wallpaper pages have a left-aligned title and hint, like the Guide. On a tile page they step in to the grid's first column, and the Re-order button to its last; the grid stays centred so the tile shadows are not clipped.
- Type scale: 18, 22, 26, 32, 56, 80, 120. Weights 400, 500, 600, 700. Full guide titles are 26 (Sam preferred 24 but kept the scale). The rain chance under the weather bars is 18 at 400, like the hours, in the rain colour.
- The one exception: the picture caption's credit is 15, so it never competes with its 18 title. Both caption lines are at 70%.
- Left off the scale: the app monograms (64, 92: graphics), the Full guide's no-logo channel name (13, in a tiny cell), and the video caption's place name (36, not yet seen with a video wallpaper).
- Not done: Sam does not use the light look, so it was not reviewed.

## Step 9, focus zones: not done (Sam, 2026-10-26)

The screens do not share focus logic. Home is a five-zone state machine (rows, top buttons, panels, menus, folders), Settings has three zones, and the Guide has one switch. Each screen's moves are its own, so a shared helper would wrap one variable and remove almost nothing. The list half of step 9 (`lib/windowedList.ts`) held the real copying and is done. The audit is complete.
