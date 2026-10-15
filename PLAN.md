# Lumen roadmap

Target TV: LG 43UT91006LA, webOS 25 (Chromium 120), rooted, Homebrew Channel installed, Home button remapped with LG Input Hook.
Apps in daily use: PlxNative (Plex), youtube-webos, BBC iPlayer, Channel 4, Channel 5.

This repo was written for a different TV (LG 65UQ8040PSB, webOS 22, Chromium 87, in India). Everything in it that was tuned for that TV, from the
clock fix to the no-live-blur rule, is an assumption here until it has been tested on this one. Phase 2 is where those assumptions get tested.

This is a personal fork. Nothing goes back to partridgeworks/webos-launcher. Features are tried against this TV first and kept only if they work here.

Each phase ends with a check on the TV before the next one starts. Items marked **(spike)** are answered in Phase 2; items marked **(verify)**
depend on something not yet tested on this TV.

---

## Phase 0: Safety net

Goal: the working install on the TV is never at risk while we change things.

- [ ] Find the `.ipk` that is actually installed (the GitHub release ipk is the logo-free one; the installed app directory on the TV is not an ipk).
      If it is not on disk anywhere, rollback is simply "never uninstall the stable copy", which the side-by-side install below gives us.
- [ ] Note the current Lumen settings (dock order, folders, wallpaper, options) so they can be recreated. Settings are per app id, so the dev
      build starts empty.
- [x] `tools/tv/watch.sh` only knows `com.ammar027.lumen` (`ME=` at the top). Change it to a list of app ids so the Home takeover and the
      video-wallpaper screensaver suppression work for whichever build is in front. The flag files under `/var/lib/homehook/` are shared by both
      builds; that is fine as long as only one is in front at a time.
      Done in the repo (Home opens whichever build was last in front). Still to copy to `/var/lib/homehook/` on the TV.
- [ ] Decide which thing owns the Home button: LG Input Hook (already set up on this TV) or the LG Home polling in `watch.sh`. Both fire today.
      Keep one, remove the other from the TV. **(spike)** if unsure which is faster.

Done when: the stable build is still installed and working, and `watch.sh` on the TV accepts more than one app id.

---

## Phase 1: The rewrite, confirmed by a build and a deploy

Goal: `app/` becomes real source in this repo, one command builds it, one command puts it on the TV, and the result is the same app as 1.0.9.
No behaviour changes in this phase. That is what makes it checkable: the build from committed source must match the build from the patch pipeline.

### Fork
- [x] Clone partridgeworks/webos-launcher into `app/`, record the upstream commit in `THIRD_PARTY_NOTICES.md`, run the REBUILD.md pipeline
      once (on a machine where the hardcoded `~/Developer/webos-launcher-tvos` path can be satisfied, a symlink is enough), and commit the result.
- [x] Prove it: build `dist/` from the committed source and from the pipeline, diff them. They must be identical before anything else changes.
      Done against the published 1.0.9 release ipk instead, which is stronger: the pipeline itself did not reproduce 1.0.9 (version 1.0.7 and
      one hand-edited icon colour were missing), so both were added to the committed source. Remaining difference: the post-1.0.9 fix 497e918.
- [x] Delete every `tools/apply_*.py` (all 50-odd of them, including the three that were never in the pipeline: `apply_clearer_glass.py`,
      `apply_motion.py`, `apply_launchfx.py`). Their job is done once the source is committed.
- [x] Fix the hardcoded `~/Developer/webos-launcher-tvos` path in the scripts that stay: `build_release.py`, `harvest.py`, `harvest_mixkit.py`,
      `blur_defaults.py`, `extract.py`, `gen_iconpack.py`, `gen_cities.py`, `make_sf_font.py`, `build_catalog.py`, `build_iconpack.py`,
      `gen_appicon.py`. Paths relative to the repo root. (`build_iconpack.py` was deleted instead: the build makes the icon list now.)

### Build
- [x] `.env` (gitignored) with `.env.example` committed. Holds at least `LUMEN_APP_ID` (default `com.ammar027.lumen.dev`), `LUMEN_APP_TITLE`
      (default `Lumen Dev`), `LUMEN_TV_HOST`. The build reads it and stamps `appinfo.json` and the app id constant in the source; nothing in the
      source hardcodes the id any more. Stable is `.env` with `LUMEN_APP_ID=com.ammar027.lumen`.
- [x] Single build command, `npm run build:ipk`, that produces the `.ipk` into `build/`.
- [x] Personal assets (third-party app logos, the private SF font, personal wallpapers) live in one gitignored directory, for example
      `app/private/`, and the build copies them in if present. `build_release.py` currently finds them with `git ls-files --others` inside `app/`,
      which stops working once `app/` is committed here. Replace that with "build without `app/private/`".
- [x] Keep `tools/screenshots.mjs` working as a visual check (it defaults to the macOS Chrome path; take it from `.env` or `CHROME`).

### Deploy
- [x] `npm run deploy`: scp the `.ipk` to `LUMEN_TV_HOST` and install it with the Homebrew Channel install service, or `ares-install` if that is
      simpler. One command from a clean clone to the app running on the TV. **(verify)** Written and dry-run with a fake ssh; the
      `appInstallService/dev/install` call has not been run on webOS 25 yet.
- [ ] Install the dev build beside stable and use it for a day.

Done when: a fresh clone with a `.env` builds and deploys with two commands, both builds are on the TV, and the dev build is indistinguishable from
1.0.9 apart from its name on the tile.

---

## Phase 2: Spikes on this TV

Goal: answer every open question about this TV with a throwaway test on the dev build, before building anything on top of the answer.
Each spike is a yes/no with a note in `docs/spikes.md`. Nothing from a spike is kept in the app unless it is trivially small.

### How the TV behaves
- [ ] Does the clock go wrong after a cold boot here? (`clockfix.sh` exists for that bug on the old TV. If no, delete the script.)
- [ ] Does the TV kill background apps? It looks like it: the Recents button cold-loads the last app every time. Confirm with Lumen: open it,
      open Plex, press Home, does Lumen cold start? If yes, "resume" is off the table and cold-start time is the number that matters.
- [ ] Launch parameters: when Lumen is launched with `{"params":{...}}` while not running, does it see them at start (`webOSLaunch` /
      `PalmSystem.launchParams`)? When it is already in front, does `webOSRelaunch` fire? Both are needed later (Recents button, colour
      buttons, ambient mode).
- [ ] Recents button: Input Hook can rebind Home, so it can rebind this. Confirm a launch with `{"view":"recent"}` reaches Lumen as a
      parameter (this is the launch-parameter spike above, with a real use).
- [ ] Colour buttons: which does this remote have, and which key codes reach the app? Some Magic Remotes only show them on the on-screen 123 pad.
- [ ] Attaching Chrome DevTools to the dev build on the TV: which method works on webOS 25 (Dev Manager Desktop inspect, `ares-inspect`).

### Settings keys on webOS 25
- [ ] The ones the app already uses through root: `pictureMode`, `soundMode`, `screenSaverTimer`. Do the same `setSystemSettings` calls work?
- [ ] New ones: backlight, Eye Comfort, sound output (TV speakers, ARC/optical, Bluetooth). Find the category and key for each.
- [ ] Live TV channel service, for the Freeview tiles idea in Later.

### Graphics
- [ ] `backdrop-filter` on the dock only, behind a temporary flag: does the dock hold 60 fps while moving focus and while the video wallpaper plays?
      This decides the Graphics: Low/High setting in Phase 4. The no-live-blur rule in RESEARCH.md was written for a Mali-T820; this chip is
      different, but still entry level.
- [ ] `https://sylvan.apple.com/` videos play directly on this TV (the plain HTTP fallback exists because the old TV refused Apple's certificate).

### Network and services
- [ ] Homebrew Channel accepts a plain HTTP repository on the LAN. If not, it is HTTPS with a local CA, or the repository idea is dropped.
- [ ] Immich: endpoint paths against the server's own `/api` docs (albums, favourites, random, memories, thumbnail and preview sizes) and
      which permissions a read-only key needs. `memory.read`, `asset.read`, `album.read` exist; `asset.view` may also be needed for thumbnails.

Done when: every line above has an answer in `docs/spikes.md`, and the dev build on the TV is back to the Phase 1 state.

---

## Phase 3: Fixes and plumbing

Goal: the known correctness and privacy issues are gone, and the dev loop has the tools it needs. Each fix is shaped by its Phase 2 answer.

### Correctness and privacy
- [ ] `tools/tv/clockfix.sh`: delete if the spike said the clock is fine. Otherwise: no forced `Asia/Kolkata` (use the TV's own zone or a
      variable at the top), and get the time over HTTPS, not from the `Date` header of plain HTTP requests.
- [ ] `tools/tv/hosts-extra`: the entries are JioHotstar ad hosts from the old TV. Replace with whatever this TV actually calls, or empty it.
- [ ] `watch.sh`: only append `hosts-extra` lines that match `0.0.0.0 <hostname>` or `:: <hostname>`.
- [ ] Weather location: ipwho.is becomes opt-in. Default to no city until one is chosen.
- [ ] Remove the plain HTTP fallback for `sylvan.apple.com` if the spike said HTTPS plays; otherwise make it a setting.
- [ ] Every root shell command in one module with a fixed allowlist. Shell-quote or validate any value inserted into a command, including the
      three that are safe today (picture mode, sound mode, screensaver minutes).

### Settings export and import
- [ ] Export the Lumen config to `/var/lib/homehook/lumen-config.json` via root, import on first launch or on demand. Needed because dev, stable
      and any reinstall each keep separate settings. The JSON goes through the root command as base64, never as a quoted string (that is the
      injection problem the allowlist above exists for).

### On-TV error log
- [ ] Failures from root commands, Luna calls and network requests go to a size-capped file readable over `ssh`. Buffer in `localStorage` and
      flush through root, so a failing root service does not also lose the log of its own failure.

### Home-network repository
- [ ] A static `apps.json` in the Homebrew Channel format (`paging` wrapper, `packages[]`, each with a `manifest` carrying `id`, `version`,
      `type: "web"`, `title`, `appDescription`, `iconUri`, `sourceUrl`, `rootRequired`, `ipkUrl`, `ipkHash.sha256`, `ipkSize`) plus the `.ipk`,
      generated by the build and served from a machine on the LAN. HTTP or HTTPS per the spike.
- [ ] Add it on the TV once: launch `org.webosbrew.hbchannel` with `{"launchMode":"addRepository","url":"..."}`.
- [ ] Use it for stable updates; `npm run deploy` stays the dev path.

Done when: the dev build behaves the same as 1.0.9 apart from the fixes above, settings survive a reinstall, and a failure shows up in the log.

---

## Phase 4: Performance

Goal: know how fast Lumen is on this TV, make cold start faster (the TV kills background apps, so every Home press is a cold start), and check
every later change against the numbers.

### Measure
- [ ] Record three numbers as the baseline, with DevTools traces (method from Phase 2):
  - Home press to home screen visible (this is cold start on this TV)
  - Key press to focus moving (frame time while moving along the dock)
  - Cold start to interactive
- [ ] Frame-rate counter in dev builds only.

### Cold start
- [ ] Load Settings and Control Center only when first opened, so the home screen parses less JavaScript at start.
- [ ] Draw the first row first (already done), then defer everything else until the first frame is up.
- [ ] Decode the next wallpaper or photo before swapping it in (`img.decode()` or `createImageBitmap`).
- [ ] `content-visibility: auto` on off-screen rows and panels.
- [ ] Images at screen size or smaller. Video wallpaper at 720p rather than 1080p (the Mixkit catalogue already has both).
- [ ] Handle `webOSRelaunch` and launch parameters at start, per the Phase 2 spike, so a launch with `{"view":"recent"}` lands on the Recent row.

### Recents button
- [ ] Rebind the Recents button with LG Input Hook to launch Lumen with `{"view":"recent"}`, the same way Home is already rebound. Lumen's
      Recent row is the app switcher; LG's own recents window is not needed. The TV's "go back to the last app" is a cold load either way, so
      going through Lumen costs nothing extra and gives a choice.
- [ ] Make the Recent row truthful. Today it only records apps opened from Lumen (`recentIds` in storage), so anything opened through LG Home,
      the Input Hook or a cold boot never appears. `watch.sh` already sees every foreground app change; have it keep the last eight distinct
      app ids in `/var/lib/homehook/recent`, and have Lumen read that file through root at start and merge it with its own list.

### Lower rows transition (Down from the dock to the blurred backdrop)
Done so far (commit 167253b, dev 1.0.9003): the rows slide with `transform` instead of `top`; the blurred backdrop is a permanent
`.lowerveil` layer that only fades; the glass shows a plain tint (`.screen--plainglass`) while lower and for 300 ms after, instead of the
fixed-position wallpaper copy; the lower rows stay painted at opacity 0. Going down is better on the TV.
Still wrong, seen on the TV:
- [ ] Coming back up is now noticeably laggy. Likely cause: after the 300 ms the glass switches back to the fixed-position picture, so
      every glass shape repaints at once, and the lower rows fading out may still repaint. Trace it on the TV before changing anything.
- [ ] The backgrounds don't change together: the glass flips to a plain tint at once while the backdrop fades over 220 ms (and flips
      back 300 ms after the backdrop has gone). Options: crossfade the two glass looks as two stacked layers (opacity only); or give the
      glass a fixed-offset `scroll` background (as `.panel` already does) so it never needs `background-attachment: fixed` and can move
      with the rows; or drop the picture from the dock glass entirely and use a tint everywhere.

### Blur
- [ ] If the Phase 2 blur spike passed: a Graphics setting, Low (current pre-blurred glass) / High (live blur on the dock only). If it failed,
      nothing to do here.

Done when: the three numbers are recorded before and after, none got worse, and Recents opens Lumen on the Recent row.

---

## Phase 5: UI tweaks

- [ ] Pop-up list picker for long options (weather city, country, language, picture mode, sound mode) instead of stepping through values with OK.
- [ ] Fix the focus label of the top-right button ("Control Center") showing through above the open Control Center panel.
- [ ] New settings:
  - [ ] Focus highlight strength
  - [ ] Tiles per dock row (5, 6, 7)
  - [ ] Hide app names under focused tiles
  - [ ] Video wallpaper only between set hours
  - [ ] Reduce motion (no animations)
- [ ] Control Center, using the keys found in Phase 2:
  - [ ] Sound output: TV speakers, soundbar (ARC or optical), Bluetooth
  - [ ] Backlight slider
  - [ ] Eye Comfort toggle
- [ ] Update the Settings descriptions that are out of date (video wallpaper text still says only Apple's aerials).

Done when: each new setting works on the TV and the Phase 4 numbers have not got worse.

---

## Phase 6: Colour buttons

Only if the Phase 2 spike found buttons that reach the app.

- [ ] Settings > Remote: an action per colour button (red, green, yellow, blue). Actions:
  - Open a chosen app
  - Open Control Center
  - Screen off
  - Sleep timer (cycle)
  - Picture mode (cycle)
  - Sound output (cycle)
  - Start screensaver / ambient
  - Nothing
- [ ] These work while Lumen is in front (normal key events).
- [ ] Optional: LG Input Hook mappings so the buttons also work inside other apps, by launching Lumen with a parameter (needs the launch
      parameter handling from Phase 4).

Done when: each button does its chosen action on the TV.

---

## Phase 7: Immich photos

- [ ] Settings > Photos: Immich server address and a read-only API key (permissions per the Phase 2 spike).
- [ ] Photos are fetched directly from the Immich server on the LAN. Never through images.weserv.nl or any other public proxy.
- [ ] Glass without live blur: fetch the small thumbnail, blur it once on an `OffscreenCanvas` in a worker, and use that as the glass backdrop.
      No per-frame cost.
- [ ] Step 1: Immich as a wallpaper source (chosen albums, favourites, shuffle, change every N minutes).
- [ ] Step 2: ambient screensaver that replaces LG's screensaver, through the same `watch.sh` hook that launches Lumen Gallery: full-screen
      photos, crossfades, slow zoom (opacity and transform only), clock and weather overlay, "On this day" memories.
- [ ] Decide the rule for ambient versus video wallpaper. Today, with video wallpaper on and Lumen in front, `watch.sh` ends LG's screensaver as
      soon as it starts, so the ambient hook would never fire in that state. Proposed: ambient wins after N minutes idle even with video on,
      and the video-wallpaper flag only suppresses LG's own screensaver.
- [ ] Prefetch and decode the next photo before it is shown.

Done when: photos load from Immich on the TV, the ambient screen runs for an hour without stutter or memory growth, and the Phase 4 numbers have
not got worse.

---

## Later

In rough order of value:

1. Plex Continue Watching row from the Plex server's On Deck. Tiles open PlxNative. Opening a specific episode needs a launch parameter that
   PlxNative does not have (nothing documented in its README); that is a request to its author, not something this repo can add.
2. Picture and sound mode per app (root; `watch.sh` already knows which app is in front).
3. YouTube subscriptions row (YouTube Data API, TV sign-in with a code), opening videos in youtube-webos with its `contentTarget` launch
   parameter (`{"contentTarget":"v=<id>"}` is documented; `target` is not).
4. Long-press shortcuts per app (for example YouTube: Subscriptions, Search).
5. Bedtime button: lower backlight, Eye Comfort and sleep timer together.
6. Auto-switch to an HDMI input when its device turns on; power off when idle.
7. Profiles, and a kids mode with a PIN and allowed hours.
8. Privacy page: LG ad and Live Plus settings, plus hosts-level blocking of LG ad and tracking hosts (check what the Homebrew Channel's own
   telemetry and ad blocking already covers before adding to `hosts-extra`).
9. Live Freeview channel tiles, if the Phase 2 channel service spike worked.

## Parked

- Native (GPU) version of Lumen. Reference: PlxNative (Rust, SDL2, OpenGL ES, webosbrew native NDK; GPL-3.0-or-later, so read for approach
  only). If picked up again, start with a native Immich ambient screen as a pilot rather than the whole launcher.

## Not doing

- Resuming Lumen from the background. The TV kills background apps, so every Home press is a cold start; the work goes into making cold start
  fast instead. A "close background apps" button is pointless for the same reason.
- Live blur over large areas or full screen (too expensive on this class of GPU; the dock-only test in Phase 2 is the exception).
- Google Photos (since March 2025 third-party apps can only read photos they created or ones picked by hand).
- iPlayer, Channel 4 and Channel 5 content rows (no public APIs).
- Contributing any of this upstream.
