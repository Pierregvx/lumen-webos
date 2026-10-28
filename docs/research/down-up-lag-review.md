# Down and Up between the dock and the lower rows: what is left to try

Written 2026-10-22 as a review. The results of testing it on the TV are in the next section; the items after it are the review as written. It reads every perf doc, the session notes of 17 to 22 October, and the code behind the slide (`Home.tsx`, `global.css`), and adds an outside review from GPT-6.1 Sol. The items are ordered by how likely they are to pay off. Each one says what the mechanism is, why the numbers point at it, how to test it live over DevTools, and what the fix would be.

## Results, tested on the TV 2026-10-23

Tested overnight over DevTools, with no build. Each row is the median of 8 to 16 key presses, Down from the dock to the first grid row and Up back. "Frames" is the frames that reach the screen in the 320 ms after the first one (60 fps would be about 19). "Gap" is the mean time between those frames. "Raster" is the GPU raster time per key. Scripts: `tools/tv/perf/updown.mjs` and `updown-report.mjs`.

| Change (each row adds to the one above from "source baseline") | Down frames | Down gap ms | Down raster ms | Up frames | Up gap ms | Up raster ms | Up style ms |
|---|---|---|---|---|---|---|---|
| The build on the TV (older than source) | 3 | 143 | 248 | 4 | 106 | 277 | 89 |
| Source baseline (the uncommitted CSS put in live) | 5 | 80 | 247 | 4 | 96 | 301 | 91 |
| Item 1: rest at opacity 0.01 | 4 | 106 | 278 | 3 | 123 | 292 | 84 |
| Item 1: `will-change: opacity` on the veil | 5 | 78 | 190 | 4 | 87 | 257 | 85 |
| The veil's picture in a canvas | 6 | 49 | 132 | 5 | 53 | 163 | 92 |
| Canvas and `will-change` on the veil | 6 | 51 | 130 | 5 | 54 | 148 | 87 |
| Item 4 only: a layer on each bar and first grid row tile | 9 | 39 | 147 | 6 | 62 | 200 | 98 |
| Canvas, veil layer and tile layers | 15 | 23 | 37 | 12 | 29 | 62 | 98 |
| Same, Up 340 ms, grid focus 1.14 | 14 | 24 | 36 | 12 | 29 | 56 | 101 |
| Same, without the old plain-tint class | 14 | 24 | 39 | 13 | 27 | 54 | 79 |

The last row is the result: from about 7 to 10 fps during the move to about 37 to 42 fps. All of it is in source, not built.

What caused it:

1. The veil's picture was rastered in full 2 times on every Down and 3 times on every Up: about 80 and 120 tiles of 256 px. This happened even with the veil left at opacity 1 and never changing, so it is not the opacity 0 effect of item 1. During the moves the TV sends Chromium memory-pressure signals (`V8.MemoryPressureNotification`, level 1). WebAppMgr runs Chromium with `--force-low-end-device-mode`, `--enable-aggressive-release-policy` and `--tile-manager-low-mem-policy-bytes-limit-reduction-factor=2`, so the compositor drops tiles and rasters them again. A veil with a flat colour and no picture rastered almost nothing. The fix draws the 480 x 270 blurred copy into a canvas once, and the GPU scales it up. A canvas is a texture, not tiles. It looks the same in screenshots (`components/LowerVeil.tsx`).
2. The bar's track and the grid rows were rastered again on each move, because the focused tile changes in them. A permanent layer on each tile in the bar and the first grid row stops that. The first test (`docs/research/frame-rate.md`) found no frame gain, because the veil hid it. The focused tile is as sharp as before in screenshots.
3. `will-change: opacity` on the veil keeps it on its own layer. Without it, at the end of each fade the veil joins the vignette layer, and that full-screen layer rasters again.
4. Under Live blur, the old plain-tint class (`screen--plainglass`, now removed) changed nothing visible but cost a full restyle. Skipping it cut Up's style work from about 100 ms to about 80 ms. Down does not change.

What did not help: opacity 0.01 (item 1), no transitions on labels and dots (item 3), layers on the row viewports, a flat 2D focus transform (item 9), and no background colour on the canvas veil. Item 7 needs nothing: the CPUs already run the `performance` governor at a fixed 1 GHz, and the GPU has no clock controls in sysfs. Item 6 (720p) needs a build, so it was not tried.

What is left: the first frame still comes about 85 to 100 ms after the key. Down's key handler takes about 30 ms, of which about 23 ms is a style recalc forced by the `offsetTop` reads in `Home.tsx`'s layout effect. The worst gap in a move is still 50 to 60 ms, at the start, while the first commit rasters. Item 2 (memoised rows, the shift as a transform, no layout read on a plain move) is the next step if that matters.

Visual changes Sam chose live: Up slides in 340 ms (Down stays 276 ms), and the grid's focused tile grows 1.14x, not 1.175x, so the open-app dot keeps its gap.

## What the numbers say

Three measurements from 2026-10-22 frame the problem (`docs/research/startup-perf.md`, `docs/research/frame-rate.md`, docs/plans/PLAN.md):

1. The screen does not change for about 330 ms after the key. The slide itself is 276 ms. So most of the lag is the wait before anything moves, not the frame rate during the move.
2. During the move the GPU thread spends 100 to 170 ms rastering. On this TV raster runs on the same GPU thread that draws the frames (`RasterDecoderImpl::DoEndRasterCHROMIUM` on `Chrome_InProcGpuThread`), so every millisecond of raster during the slide is a frame not drawn. This is why the move runs at about 10 fps even though every moving element is on its own layer.
3. Things that do not move repaint on each move: the top bar, the status pill and the caption. The blurred backdrop is "redrawn on each move". Permanent layers (`will-change`) on the rows, veil and dock did not help.

Together these say: the slide is compositor-only as designed, but something forces raster at the start of every move, and the first frame waits for it. The items below are the candidates for that raster, in order.

## 1. Layers that rest at opacity 0 hold no raster tiles (most likely)

Mechanism. Chromium's compositor does not raster, and does not keep, the tiles of a layer that is not drawn. A layer at `opacity: 0` (or `visibility: hidden`) is not drawn. `will-change` gives it a layer, but not tiles. When its opacity leaves 0, the layer must be rastered before the first frame that shows it, and Chromium holds the first frame of a commit until the tiles it needs are ready. With GPU raster, a tile is about a screen wide and 256 px tall, so even a small element costs a wide strip.

What rests at 0 and flips on every move:

- `.lowerveil`: `opacity: 0` at rest (`global.css` ~line 914). On Down it fades to 1, so the whole 1920 x 1080 blurred picture is rastered at the moment of the key. On Up it returns to 0 and the tiles are dropped. This is the "blurred backdrop redrawn on each move" and why the plain tint (a flat colour rasters in no time) measured better.
- `.status`, `.topbar`: `opacity: 0` while lower (`~line 1069`). Dropped on Down, rastered again before Up's first frame. This is the "top bar and status repaint without moving".
- `.videocap--pic`: the same (`~line 880`).

Why `will-change` did not help: it was the wrong lever. The tiles are the problem, not the layer.

Test, live, one line at a time, then `walk.mjs vert` and `walk-report.mjs` (compare `raster ms` and `key→screen`):

```css
.lowerveil { opacity: 0.01; }
.screen--lower .status, .screen--lower .topbar, .screen--lower .videocap--pic { opacity: 0.01; }
```

Use 0.01, not 0.001: Blink skips painting anything under about 1/255 opacity as invisible. A trace with the `cc` category (`disabled-by-default-cc.debug` if the build has it) shows the raster tasks after the key directly; the DevTools Layers panel shows which layers have tiles at rest.

Fix if it holds: rest at 0.01 instead of 0 for anything that fades back in during a move. Cost: the veil becomes a full-screen quad drawn every frame at rest. The probe says a full-screen layer costs about 1 ms on this GPU, which is cheap. If it is not, an alternative is to keep the veil at opacity 1 and slide it in by transform from off screen (tiles off screen within about 3000 px are kept), but that changes the look.

## 2. The 330 ms before the first frame: main-thread work on Down

Mechanism. The key handler calls `render()`, which re-renders the whole `Home` tree: every `Row`, every `Tile`, every `ChannelTile`, because nothing is memoised and each row gets new callback closures each render. Then the class change on `.screen` (`screen--lower`) invalidates style for the whole subtree, because selectors such as `.screen--lower .rows > .row` hang off it. Then `--lower-shift` is written on `.rows`; a custom property is inherited, so every descendant is recalculated again. Then the `useLayoutEffect` reads `offsetTop` on every render, which forces a synchronous layout. Then paint, commit, and the raster from item 1. The 16:21 trace measured "about 190 ms of style, layout, paint and commit before the first frame" but did not split script from style.

Two parts of this were pure waste under Live blur: the plain-tint class on `.screen`, and a CSS variable for the glass's old wallpaper copy. Both are now removed from the code, with the copy itself.

Test: trace Down with `devtools.timeline` and `disabled-by-default-devtools.timeline` and read `FunctionCall` (the handler and Preact), `UpdateLayoutTree` (element count) and `Layout` for the key. `walk-report.mjs` already prints `key script ms` and `style+layout ms` per segment, so one `vert` walk gives the split.

Fix: memoise `Row` and `Tile` so only the two rows whose focus changed re-render; move the lower-state hooks for `.status`, `.topbar` and the rows onto those elements (or `.rows`) so the state class does not sit on `.screen`; write the shift as a transform on `.rows` rather than an inherited custom property; cache the row geometry so the layout effect reads nothing on a plain focus move.

## 3. Transitions on elements with no permanent layer, and main-thread transitions

Mechanism. A transition on an element without a layer makes Chromium create a layer when the transition starts (raster into it) and destroy it when it ends (raster back into the parent). A transition on a property the compositor cannot animate repaints the element on the main thread every frame, and that invalidates a wide tile strip of whatever layer contains it.

What fires on Down and Up:

- `.row__label` colour: `.rows .row--titled.row--focused .row__label { color }` with `transition: color` (`~line 98`). Colour is main-thread. The label sits inside a row layer, so a 1920 x 256 strip of that row re-rasters on every frame of the 200 ms transition.
- `.tile__label` opacity on the newly focused and unfocused tiles: layer churn per label.
- `.status`, `.topbar`, `.videocap` opacity: layer churn on top of item 1.
- `.tile__dot::before` transform: known (`docs/research/frame-rate.md`), main thread.

Test: inject `transition: none !important` on these selectors only, keep everything else, and compare `raster ms` per move. One at a time if the first run shows a drop.

Fix: drop the colour transition on row labels (two stacked spans crossfaded by opacity if the fade matters); permanent `will-change: opacity` on `.status`, `.topbar` and `.videocap` (three small layers); animate only `.tile__dot--on::before`.

## 4. Adopt the per-tile permanent layer for the rows that take part in the slide

Already measured, not adopted: a permanent `will-change: transform` on every row tile cut raster in the rows walk by about 40% and key-to-screen from about 120 ms to 65 ms, and was set aside because it did not raise the frame rate (`docs/research/frame-rate.md`). Given item 1 and the raster-on-the-GPU-thread finding, latency and raster are the lag. Adopt it, but only for the bar and the first grid row (the tiles whose focus changes on Down and Up), to keep GPU memory down.

## 5. Off-screen row tiles may be evicted, so the slide rasters them again

Mechanism. The rows below the screen are at opacity 1, just off screen. Chromium rasters tiles up to about 3000 px outside the viewport when idle and keeps them if the tile memory budget allows. Lumen holds about 33 MB of GPU memory and the TV is tight, so the budget may be small enough that those tiles are dropped, and the slide rasters them while it moves. The rows walk showed raster in the lower rows that a pre-rastered page would not need.

Test: a `cc` trace of an idle period followed by Down; raster tasks for the row layers right after the key mean the tiles were not resident. `TileManager::AssignGpuMemoryToTiles` carries the memory state. Compare the first Down after launch, the fifth after waiting at each end, and the first after a return from an app.

Fix: fewer and smaller row layers. Each row layer is about 2060 px wide and 400 px tall because of the viewport's negative margins; trim them to what the focus lift needs. Or one layer for all lower rows (one shared fade) instead of four. Or stagger the slide so rows 3 and down fade in after the dock has arrived, which gives their raster the length of the slide to finish.

## 6. Render the app at 1280 x 720

Mechanism. webOS `appinfo.json` has a `resolution` key (`"1920x1080"` or `"1280x720"`, check LG's appinfo reference for webOS 25). At 720 the TV scales the app's surface to the panel. Every fill, blend and raster then touches 0.92 M pixels instead of 2.07 M. The layout stays in CSS pixels at 1920 (the viewport meta), so nothing moves; everything rasters at 0.667 scale and the TV upscales.

Why it may matter: the probe shows draw time scales with full-screen layers, and raster time scales with tile area. Both halve.

Cost: softer icons and text. Sam judges. One line, one build (not live), then `probe.mjs` and `walk.mjs` as before.

## 7. CPU and GPU clocks

Mechanism. An idle home screen lets the SoC clock down. A key press starts work at a low clock and the governor takes tens to hundreds of milliseconds to ramp, which fits both the 330 ms first-frame wait and slow early frames. Nothing in the notes has looked at this.

Test, read only as root: `/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor` and `scaling_cur_freq`, and the Mali node (`/sys/class/misc/mali0/device/` or under `/sys/devices/platform/`: `dvfs`, `clock`, `utilization`). Sample the clocks every 10 ms over SSH while a Down is sent over DevTools. Then, for one walk only, set the CPU governor to `performance` and lock the GPU clock, and compare `key→screen` and frames. Revert after.

Fix if real: a watcher that raises the governor while Lumen is in front, reverting otherwise. Side effects are heat and power; LG's own apps do not do this, so keep it as a measured trade.

## 8. Overdraw at 1080p

Mechanism. Each frame draws the wallpaper, the `.screen` vignette gradients (a full-screen blended layer, `~line 395`), the veil while lower, up to two screens of rows, the `.wpfade` crossfade child over its parent if it stays after the fade, and the night dim. The probe says fill at rest is cheap (3.2 ms with no blur), so this is second order: it matters only if item 1 does not explain the 15 to 27 ms draw per frame seen while the veil fades.

Test: `probe.mjs` with `.lowerveil { opacity: 1 }` forced, then with the `.screen` background removed, then with `.wpfade` removed.

Fix: bake the vignette into the wallpaper or the veil; make the veil opaque and hide `#wpimage` while lower; remove the `.wpfade` child after its fade.

## 9. Smaller checks

- The focused tile uses `perspective(900px) rotateX() rotateY()` even on the remote (`~line 1076`). A 3D transform is composited either way, but 2D `scale() translateY()` is cheaper to raster and avoids a 3D rendering context. Keep the tilt for the pointer only.
- The WAM command line (`ps -ef | grep -i webappmgr`, read only) shows LG's raster and GPU flags (`--enable-gpu-rasterization`, `--num-raster-threads`, `--enable-zero-copy`, `--force-gpu-mem-available-mb`, `--enable-low-res-tiling`). Reading it is free and tells us the tile budget and raster mode. Changing it affects every app on the TV, so it is a last resort, not a plan.
- Measure first and warm moves apart, and cold starts apart. `walk.mjs` relaunches before each part, so every measured Down so far was the first after a launch.
- Report key-to-first-change, frame intervals during the 276 ms of movement, time to the final state (including the 300 ms after Up), raster, and draw, per move. Frames per 450 ms mixes these and hides which one moved.

## Already covered (do not redo)

Sliding with transform instead of top. A permanent veil that fades instead of a pseudo-element made on the spot. No live blur on the bar, with the bar on its own layer. Live blur only on the focused control. Permanent layers on the rows, veil and dock (no gain, see item 1 for why). The veil as a plain tint (better frames, lost the look). The rows hidden (better frames). Slower, eased timing (Sam: smoother). The dot transition and the focused tile's layer churn (named in `docs/research/frame-rate.md`). Blur radius 2 against 3 px. `settled` on against off. Launch time with blur on against off.

## The external review

GPT-6.1 Sol reviewed the same measurements, notes and code (the prompt and its full answer are in this session's scratchpad). Its ranked list overlaps with items 2, 3, 5, 8 and 9 above, and it makes the same point that "everything composited" does not mean "no raster". Two of its leads do not survive a check against the code:

- Live blur on the lower rows' glass: the lower rows have no glass pseudo-element at all (`global.css` line 496 sets `display: none` on it), so there is nothing to blur.
- A hidden `top` jump between `.rows { top: 846px }` and `.rows--lower { top: var(--layout-rows-top) }`: the token is 846 px, so both endpoints are the same.

Its additions worth keeping: test the veil permanently visible against fading, to separate "the blurred picture rasters" from "a full-screen crossfade is expensive" (item 1 against item 8); fade the sharp wallpaper out over an opaque blurred base rather than fading blur over sharp, so the covered picture is not drawn at the end; and do not take the swap time as proof the panel is the limit until a trace with `cc,viz,gpu,latencyInfo` shows where each frame waits.

## What is probably not avoidable

The TV's input path (remote to the page, about 50 to 100 ms), and some fill cost for three or four full-screen layers at 1080p. The target is no raster during the move and one or two frames of wait before it, not 60 fps at any price.
