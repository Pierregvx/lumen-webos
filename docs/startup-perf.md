# Cold start: findings and plan

Status 2026-10-17: the cold start freeze and the pause coming back from Settings are fixed (see Result below).

Written 2026-10-17, handing over from a cloud session to a local one. Sam reported that the first load got slower after the Live TV
work. This file is what we know so far, what is in the build to find out more, and what to do next.

## How to read a launch

Dev builds (the branch builds on the Homebrew Channel's dev feed, version 1.0.9xxx) write one "boot" line to the TV's log 20 s after
each launch (`lib/log.ts`, `bootMark` and `setRootTimer`). Over SSH:

```
grep ' boot ' /var/lib/homehook/lumen.log | tail -3
```

Every number is ms since the page started.
- **Stages:** `script`, `wp-start`, `frame`, `wallpaper`, `wp-bg-set` (the backdrop's blurred copy applied), `apps-parsed <n>`,
  `apps-colours`, `apps`, `grid-start` / `grid` (the app grid drawn, 3.5 s after launch), `live-cache <channels> <logos> <ms>`,
  `live-drawn`, `live-read`.
- **Details:** `iconcache <KB> <ms>` (the saved app icons parsed), `sample <app id>` (an icon colour worked out again), `sampled` and
  `wp-loaded` / `wp-decoded` (see below).
- **Root calls:** `<method> start-end`, for example `listLaunchPoints 1459-1658` or `getChannelList 7441-7911`. `base64` is the
  logos or the icons, `curl` is Immich.
- **Frozen stretches:** `long start+duration`, every main-thread task over 50 ms. Timers and the screen wait behind these.

The first launch after an update is slow for reasons of its own (nothing cached: `script` was 1786 against 254 the next time), so open
Lumen once after updating before timing anything.

## What the logs showed so far

**Run on 1.0.9084, Immich wallpaper, first launch after the update** (not comparable, see above):
`script 1786, frame 2040, listLaunchPoints 2675-3061, wallpaper 6417, live-drawn 7261, apps 7420, getChannelList 9263-9701,
find 9716-9853, live-read 9926, curl 14423-14692`

**Run on 1.0.9085, bundled wallpaper, warm:**
`script 254, iconcache 270 153KB 2ms, long 189+201, long 393+64, wp-start 490, frame 1049, long 1042+255, listLaunchPoints 1459-1658,
iconcache 1666 153KB 2ms, wallpaper 1880, long 1849+85, long 1934+1678, long 3617+80, long 3697+65, long 3763+139, long 3906+99,
long 4005+211, long 4217+76, long 4339+680, live-drawn 5437, long 5124+679, long 5805+393, long 6205+227, long 6432+130, grid 6573,
apps 6641, getChannelList 7441-7911, find 7933-8111, live-read 8199, curl 9894-10181, long 10220+1106`

What that says:
1. **The page is frozen most of the time from 1.9 s to 6.6 s.** The worst stretch is 1.7 s, starting the moment the wallpaper is shown.
   Everything else waits behind it: the app list came back from the TV at 1.7 s but was only handled at 6.6 s, the app grid (due at
   3.5 s) was drawn at 6.6 s, Live TV's 600 ms timer after the wallpaper ran at 5.4 s instead of 2.5 s.
2. **Live TV's TV calls are not the cause.** They all come after the freeze (7.4 to 8.2 s), and each is quick: channel list about
   0.3-0.5 s, now/next 0.2 s, logos 0.3 s. Drawing the row from the cache falls inside a 0.7 s stretch at 5.1 s, but that stretch can't
   be split from other work yet.
3. **The saved app icons are small** (153 KB, parsed in 2 ms), so they are not it.
4. Not measured yet with marks: the Immich wallpaper on a warm start.

## Suspects (guesses until the next logs)

- **Live blur (backdrop-filter).** The 1.7 s stretch starts as the wallpaper is set and the blurred copies are applied as CSS variables
  on `<html>`, which restyles the whole page and repaints everything behind the live-blurred glass.
- **Icon colours re-sampled every launch.** `withIconColor` in `lib/apps.ts` reads a pixel off a canvas for each "plain" icon. A colour
  is only cached when sampling works; an icon that is a file the app ships (not a data: URI) may taint the canvas, so it is never cached
  and is sampled again on every launch. The browser profile did show `drawImage` and `getImageData` on a warm start. `sample <id>` marks
  will show it.
- **The app grid drawn all at once** at 3.5 s, decoding every icon.
- **Live TV's cache read** (`cachedLogos` parses about 700 KB of logos as one JSON value). `live-cache` will show its time.

## Runs on 1.0.9086 (commit bbf1335)

Live TV and live blur are both cleared. The big freeze stays when either is off:
- Immich, Live TV on, live blur on (20:19): `listLaunchPoints 3072-3508`, six `sample` marks 3516-3562, **long 3643+3871**, `wallpaper 8140`,
  `grid-start 8527`, `live-cache 164ch 152logos 85ms`.
- Bundled, Live TV off, live blur on (20:21): six `sample` marks 2233-2243, **long 2269+2079**, `wallpaper 4960`, `grid 5263`.
- Bundled, live blur off (20:22, Live TV row still off): six `sample` marks 2693-2709, **long 2816+2921**, `wallpaper 6246`, `grid 6440`.

What that says:
1. In every run the freeze starts 30-110 ms after the app list comes back and icon sampling starts. It ends before the wallpaper is shown,
   before any blurred copy is applied, and before the grid is drawn. So the blurred copies, the grid and the logo cache are not it.
2. The same six icons are sampled on every launch (`com.limelight.webos` and five `com.webos.app.*`): they never give a colour, so are never
   cached.
3. Left: the icon sampling, or the wallpaper decoded on the main thread (`img.decode()` may not run off-thread on the TV's Chromium).

## Result: the icon colours were the freeze (fixed, 1.0.9088)

The first launch on 1.0.9088 sampled the six icons one last time: `sampled com.limelight.webos clear 130px 1029ms` lined up exactly with
`long 1679+1034`; the other five took 14-162 ms. All six came back `clear` (transparent corners, so no background colour), which is why
they were never cached. They are now stored as `none`. The wallpaper decoded from 536 to 1496 ms without freezing the page.

Runs on 1.0.9090, bundled wallpaper, Live TV and live blur on, no frozen stretch over 0.43 s:
- Warm (`script 202`): `apps 1276`, `wallpaper 1581`, `live-cache 45ms`, `live-drawn 2280`, `grid 3950`. On 1.0.9085 `apps` was 6641.
- `script 2187`: the same, about 2 s later throughout. The gap is the TV loading the page before any Lumen code runs (202 to 2515 ms
  across runs), not Lumen's work.

## Settings back to Home (fixed, 1.0.9095)

Dev builds write one line per screen change: `grep ' nav ' /var/lib/homehook/lumen.log | tail -8` (`lib/log.ts`, `navMark`). Each part is
ms from the switch: `key` (the last key press), `frame` (the first frame), `gap start+length` (no frame for over 50 ms), `long` (a frozen
stretch).

Home was hidden under Settings and the Guide (`visibility: hidden`), so going back redrew the whole home screen: `gap 125+350`,
`gap 97+417`, `gap 100+367`, with no frozen stretch, so the graphics chip, not the code. Home now stays drawn under their opaque backdrop
(only the video wallpaper's see-through backdrop still hides it). Two of three returns then had no gap; the one after a minute in Settings
still had `gap 110+400`, probably because the TV frees the drawn copy after a while. Sam found Settings no slower.

Opening Settings shows the key press about 200-290 ms before the switch, probably the OK press waiting for release (long press). Not
looked at.

## Live blur and launch time (2026-10-22)

Six warm relaunches on the dev build, Live blur off and on in turn, bundled still wallpaper. Live blur is now always on.

| Live blur | script | wallpaper | grid | wallpaper - script | grid - script |
|---|---|---|---|---|---|
| off | 1870, 1753, 1418 | 4277, 4473, 3887 | 6112, 5842, 5630 | 2407, 2720, 2469 | 4242, 4089, 4212 |
| on | 704, 1334, 801 | 2790, 3517, 3286 | 4849, 5362, 5257 | 2086, 2183, 2485 | 4145, 4028, 4456 |

- Counted from `script`, the two are the same: the grid comes about 4.2 s after the script starts either way. The live blur does not slow the launch.
- `script` itself moved from 0.7 s to 1.9 s between runs. That is before any Lumen code runs, and it is the biggest variable in these runs.
- So removing the blur to speed up the launch, and fading it in after, buys nothing. Not built.

## Down on the home screen (2026-10-22)

Sam: Down to the lower rows is laggy now, not a smooth slide. Measured over DevTools, three Down presses per case, frames drawn by the page in
the 1.2 s after the key (about 72 is smooth; standing still it holds about 60).

| Case | Frames |
|---|---|
| As built (veil and rows 3+ hidden until Down) | 41-47 |
| Veil and rows always drawn (before the hidden-layers change) | 46-49 |
| Veil off | 48-50 |

- A trace of one press: about 190 ms of style, layout, paint and commit before the first frame, then frames reach the screen 60-170 ms
  apart. Each frame costs the GPU 15-27 ms to draw and 20-40 ms to swap. Four frames show during the 240 ms slide.
- So the hidden-layers change costs a little (about 4 frames), but most of the lag is the GPU drawing full-screen layers (wallpaper, the
  veil fading in, the blurred glass) on each frame. Switching the live blur off or on at Down makes it worse: the change itself is redrawn.
- Older builds, each installed and tested the same way (5 presses, after a fresh install): 15879b9 (today) 32-42; fd37fbc (yesterday)
  46-50; 80416ce (before the glass rim, 2026-10-19) 41-49; c51b706 (2026-10-18) 29-39, but with an Art wallpaper, so not comparable.
  So the hidden veil and rows (844616e) slowed Down; nothing earlier did. About 48 frames is as smooth as Down has been on this TV.
- Fix (verify): the veil and rows are hidden only for 4 s after Lumen comes back (`html.settled`, app.tsx), then drawn ready for Down.
  Measured: Down 39-47 frames. A return from iPlayer caught up in about 1.8-2.4 s, with an Art wallpaper; the earlier 1.3-2.1 s
  was with a different one, so the two are not directly comparable. Down in the first 4 s after a return still draws the rows from scratch.

## Back from an app opened in row 2 (2026-10-26)

Sam: after an app opened from the lower rows, Home brings Lumen back at once, but parts of the screen go and come back. Measured with
`tools/tv/perf/return.mjs`, Moonlight 8 s away, three returns per case. Times are ms from the page's `visibilitychange`.

| Case | Frames shown | GPU busy | Raster tiles |
|---|---|---|---|
| From rest (dock), as built | 3-5, the last at about 4.2 s | 1.4-2.2 s | 259-367 |
| From row 2, as built | 5-6, the last at about 4.2 s | 1.7-2.0 s | 287-378 |
| From row 2, home reset while hidden | 3, as from rest | 1.4-1.8 s | 259 |
| From rest, `settled` never removed | 3-4, all by 1.5 s (one at 3.6 s) | 1.2-1.3 s | 238-245 |
| From row 2, reset while hidden and `settled` never removed | 2, both by 1.2 s | 1.1-1.3 s | 244 |

- The cause of what Sam sees: Lumen goes hidden still on the rows (`screen--lower`) and `html.settled` is removed. On return, Home's
  `visibilitychange` handler moves back to the glass bar, so the first frames are the rows view with the veil and rows 3+ already hidden,
  then the slide back down plays at 2-5 frames a second while the GPU redraws. Frames captured by screencast show it.
- With home put back at rest while hidden (a live test: the same reset on the hidden event, transitions off for it, style flushed),
  every frame drawn on return is the finished home screen.
- The 4 s `settled` hold no longer helps. With it, the return draws more tiles and uses more GPU time, and the veil and rows are drawn
  again at about 4.2 s, so a Down near then pays for them. Rows below the screen get no tiles until they are near the screen, and the
  veil is at opacity 0, so drawing them costs little. The hold was measured before the glass changes on 2026-10-23 and 2026-10-25.
- Away 3 s or 8 s made no difference: the same 25 image decodes, so Lumen's 5 s wallpaper release is not the cost.
- What is left, about 1 s of GPU work for 250 tiles and the wallpaper decode, is the browser dropping a hidden page's tiles.
- Seen on the TV: the system does show Lumen's last frame from before it was hidden. Lumen gets `blur` only 11 ms before it is hidden,
  about 250 ms after OK on a tile, too late to draw anything. So any reset to home shows as a jump.
- Done 2026-10-26: Lumen comes back where it left (Home.tsx no longer resets on return; a launch that asks for a row still goes there),
  and `html.settled` is gone, so the veil and rows are always drawn. Sam tried both live.

## Still open

- **Grid:** the lower rows are drawn 3.5 s after launch in one go, followed by a 0.4-1 s frozen stretch. Draw them one row at a time.
- **Logos:** store each logo under its own localStorage key (or keep the row's logos with the Live TV cache), so drawing the row never
  parses the whole logo cache (now 45-85 ms, so low priority). Also remember logo paths that failed to read.
- Not timed on these builds: the Immich wallpaper with Live TV on.

## Where the Live TV work stands

See `docs/live-tv-build.md` (Status). In short: the row (under the app grid, channels picked in Settings > Channels, scrolls so the focused
channel's now/next fits), the Guide (Now and Next, typed channel numbers), Settings and the Guide on the dock's backdrop. Not yet confirmed
on the TV: the number keys arriving as digit key codes in the Guide, and OK opening Live TV from the row. Phase 2 (full guide grid) not
started.
