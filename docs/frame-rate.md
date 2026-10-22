# Frame rate on the TV

Measured on 2026-10-22 on the LG 43UT91006LA (webOS 25), Live blur on, a still Immich wallpaper. The scripts are in `tools/tv/perf/`. They need the DevTools tunnel (`.claude/skills/tv/SKILL.md`).

## The scripts

- `walk.mjs <out.json> [dock,rows,cc,guide,settings]` walks the app with remote keys and records a trace. It relaunches Lumen before each part. It checks focus before each OK, so it does not open an app by mistake. `LIVECSS='…'` or `LIVEJS='…'` applies a change before each part, for A/B tests. `NORAF=1` turns off the in-page frame counter.
- `walk-report.mjs a.json [b.json]` prints a table for each part, with b beside a.
- `swaps-per-key.mjs <file> <part>` counts the frames that reach the screen in the 320 ms after each key. A 60 fps move gives about 19.
- `updown.mjs <out.json> [pairs]` presses Down and Up between the dock and the grid, many times after one relaunch, and records a trace. `updown-report.mjs a.json [b.json …]` prints medians per key: the first Down, later Downs, and Ups. `LIVECSS` and `LIVEJS` work as for `walk.mjs`. A relaunch does not reload Lumen when it is already running, so a `LIVEJS` change stays until `location.reload()`.
- `raster-tiles.mjs` counts the raster tiles per layer per key, from an `updown.mjs` capture made with `LMAP=1 CATS=cc,disabled-by-default-cc.debug`. `layer-paints.mjs` lists the layers that repaint. `key-timeline.mjs` prints one key's frames and long tasks.
- `probe.mjs ['<css>']` moves a small square for 2 s and prints the frame gap and the GPU draw time. It is the quickest check of what the page costs per frame.

The in-page frame counter forces a main-thread frame on each vsync. The swap counts without it were the same, so it does not change the result.

## What we found

Every focus move, on the glass bar or in the lower rows, shows about 7 frames in 320 ms. That is one frame every 40-47 ms, about 22-25 fps. The panel is 60 Hz and Chromium ticks at 60 Hz.

The cause is the GPU draw, not the app's script or layout. Each frame the GPU thread draws the whole screen (about 11 ms on the home screen), then the buffer swap blocks until the next vsync. If the draw does not fit before the vsync, the frame takes two or three vsyncs.

`probe.mjs` (a 40px square moving by transform):

| Page under the square | Frame gap | GPU draw |
|---|---|---|
| Home screen as it is | 39 ms | 11.2 ms |
| No live blur anywhere | 20 ms | 3.2 ms |
| Lower rows hidden (the glass bar's blur gone) | 21 ms | 8.9 ms |
| Top buttons' blur off, glass bar's on | 34 ms | 6.4 ms |
| Page empty | 20 ms | 2.0 ms |

Each `backdrop-filter` costs about 2 ms of draw on every frame in which anything on screen changes, whatever its size. Chromium does not keep a blur result from one frame to the next. The home screen has four (the glass bar and three top buttons), so a small focus move pays for all four. Removing only some of them does not help much, because the draw must get under about 5 ms before the frame fits in one vsync.

Control Center is worse: 21 live blurs (10 grid controls, 7 list choices, the pill, 3 top buttons), 31 ms draw per frame, about 16 fps on the list open. Without blur, the draw is 5 ms.

Smaller things, measured but not the main cause:

- Each hidden open-app dot (`.tile__dot::before`) runs a `transform` transition on every focus move. Chromium does not put an animation with no visible change on the compositor, so it runs on the main thread.
- The focused tile gets `will-change: transform` only while it is focused, so each move removes one layer and makes another. A permanent layer on every row tile cut raster in the lower rows by about 40% and the key-to-screen time from about 120 ms to 65 ms, but not the frame rate.
- The focused tile's larger shadow and its shine (`::after`) cost some raster (800 ms to 590 ms over the rows walk), not frame rate.
- Live blur off (the pre-blurred copy with `background-attachment: fixed`) draws in 3.4 ms, but the glass repaints when the rows move: raster went from 1.2 s to 4 s over the rows walk.

## Down and Up, 2026-10-23

The full-screen blurred backdrop (`.lowerveil`) was rastered again 2 to 3 times on every Down and Up, because the TV's memory pressure makes Chromium drop its tiles. It is now a canvas, which has no tiles, and the bar and first grid row tiles keep a layer each. Down and Up went from about 10 fps to about 40 fps. The full table is in `docs/down-up-lag-review.md`. Note: `walk.mjs vert` starts with focus on the top buttons, so its Down and Up move between the top buttons and the dock, not into the grid.

## The overall fix

The glass should be a static texture: the pre-blurred wallpaper copy, laid out with `background-attachment: scroll` and an offset from the element's place on screen (as `.panel` already does), so it is rastered once and only moves by transform. Over a still wallpaper it looks the same as the live blur, because the live blur only blurs the wallpaper. This is the rule in `CLAUDE.md` and `RESEARCH.md` section 4, which Live blur broke.
