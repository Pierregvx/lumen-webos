# Lumen roadmap

Target TV: LG 43UT91006LA, webOS 25 (Chromium 120), rooted, Homebrew Channel installed, Home button remapped with LG Input Hook.
Apps in daily use: PlxNative (Plex), youtube-webos, BBC iPlayer, Channel 4, Channel 5.

This repo was written for a different TV (LG 65UQ8040PSB, webOS 22, Chromium 87, in India). Everything in it that was tuned for that TV, from the
clock fix to the no-live-blur rule, is an assumption here until it has been tested on this one. Phase 2 is where those assumptions get tested.

This is a personal fork. Nothing goes back to partridgeworks/webos-launcher. Features are tried against this TV first and kept only if they work here.

Work is split in two: what can be built without the TV, and what needs someone at the TV. Code that needs a TV answer is still written when it
can be written defensively (it does nothing harmful if the answer is no), and is marked **(verify)** until it has been seen working on the TV.
Every push to a branch other than `main` reaches the TV as a Homebrew Channel update, so "verify" means: update in the Channel, try it, report back.

---

## Where things stand (2026-10-15)

- Phase 0 and Phase 1 are done apart from the TV-side items below. The app is built from this repo and installed on the TV from the Homebrew
  Channel (`com.samrenfrew.lumen`, dev channel). LG Input Hook owns the Home button.
- Built without the TV, waiting to be checked on it: everything in **Verify on the TV** below.
- Next without the TV: the rest of **No TV needed**.

---

## On the TV

### Verify on the TV (built, not yet seen working)
Update Lumen in the Homebrew Channel first (dev build from commit 8e2bd15 or later).
- [ ] Settings backup: change something in Lumen, wait 5 s, then `cat /var/lib/homehook/lumen-config.json` over ssh. Then uninstall and
      reinstall (or install the other id): the settings should come back with a "Settings restored from the TV" message.
- [ ] Error log: `cat /var/lib/homehook/lumen.log`. It should exist after anything has failed (for example turning on Live app list with the
      Homebrew service stopped). Empty is fine if nothing failed.
- [ ] Control Center: picture mode, sound mode and screensaver time still read and change (they now go through `lib/root.ts`).
- [ ] Sleep timer: set one from Control Center, reopen it (shows the time) and check the status chip; then turn it off. webOS 25 denies
      `tvReservationAgent` to apps, so reading and setting now go through root (the root calls were checked over ssh on 2026-10-15).
- [ ] Weather: shows nothing until Settings > Options > Weather city is set. **Your current setup will lose the weather** until you pick
      Auto or a city, because "no city" used to mean Auto.
- [ ] Launch parameter: `luna-send -n 1 luna://com.webos.applicationManager/launch '{"id":"com.samrenfrew.lumen","params":{"view":"recent"}}'`,
      once with Lumen closed and once with it in front. Both should land on the Recent row. This is the launch-parameter spike as well.
- [ ] Hide app names and Reduce motion in Settings > Options; the top-right button's label no longer shows above Control Center.

### Put the TV scripts in place
`watch.sh` is probably not running (it did not seem to work). Without it there is no video-wallpaper screensaver suppression, no Frame art
mode, no hosts blocking, no clock fix and no system-wide Recent row; Lumen itself works without it.
- [ ] Copy `tools/tv/watch.sh`, `clockfix.sh`, `hosts-extra`, `stop_watch.sh` to `/var/lib/homehook/` and `60-homehook` to
      `/var/lib/webosbrew/init.d/`, `chmod +x` them, start it, and check `ps -ef | grep watch.sh` (plain `ps` on webOS 25 does not show it).
- [x] Home button: LG Input Hook owns it. `watch.sh` only takes over LG Home when `/var/lib/homehook/home-takeover` exists (off by default;
      it would still be useful for the cold-boot case where LG Home is the first thing on screen).
- [x] `watch.sh` running (one copy; the boot hook now checks `/proc`, plain `ps` missed it and started duplicates).
- [ ] Recent row: `watch.sh` writes `/var/lib/homehook/recent` correctly (seen 2026-10-15: PlxNative, YouTube), but no Recent row was seen
      on the home screen, only the 6-app glass row and 2 apps below it. Find out why (row not rendered, or the file not read).

### Spikes (yes/no answers, noted in `docs/spikes.md`)
- [ ] Does the clock go wrong after a cold boot here? If no, delete `clockfix.sh` and its line in `watch.sh`. (It no longer forces
      Asia/Kolkata and gets the time over HTTPS; `TZ_NAME` at the top forces a zone if one is needed.)
- [x] Does the TV kill background apps? Lumen yes, YouTube no (see `docs/spikes.md`). Cold start stays the thing to make fast.
- [ ] Recents button: rebind it with Input Hook to launch Lumen with `{"view":"recent"}` (needs the launch-parameter check above).
- [ ] Colour buttons: which does this remote have, and which key codes reach the app?
- [ ] Chrome DevTools on the TV: which method works on webOS 25 (Dev Manager Desktop inspect, `ares-inspect`). Needed for Phase 4 traces.
- [ ] Settings keys: read works for `picture/backlight`, `picture/eyeComfortMode`, `sound/soundOutput` (`docs/spikes.md`). Backlight set works. Still to do: setting
      Eye Comfort and sound output, and the `soundOutput` values for ARC, optical and Bluetooth.
- [ ] Live TV channel service, for the Freeview tiles idea in Later.
- [ ] `backdrop-filter` on the dock only, behind a temporary flag: 60 fps while moving focus and while the video wallpaper plays?
- [ ] `https://sylvan.apple.com/` videos play directly (then the plain HTTP fallback in `lib/wallpaperVideo.ts` goes).
- [ ] Immich: endpoint paths against the server's `/api` docs and which permissions a read-only key needs.
- [ ] `hosts-extra`: capture what this TV calls (LG ads and tracking) and fill it in. It is empty now; the old entries were JioHotstar's.

### Also at the TV
- [ ] Note the current Lumen settings, in case the backup does not work.
- [ ] Use the build for a day and note anything that differs from 1.0.9 (apart from the missing private assets, see Phase 1).
- [ ] `npm run deploy` over SSH: untried on webOS 25; only needed for a private build with your logos and font.
- [ ] Lower rows transition: trace coming back up (see Phase 4) before changing more.

---

## No TV needed

### Done (2026-10-15)
- [x] Every root shell command in one module, `app/src/lib/root.ts`, with fixed commands, setting keys and values from a list, paths checked,
      everything shell-quoted, and files written as base64.
- [x] Settings backup to `/var/lib/homehook/lumen-config.json` after each change, restored on a fresh install (`lib/backup.ts`). Shared by
      stable, dev and reinstalls.
- [x] On-TV error log (`lib/log.ts`): failed Luna calls (root included) and failed fetches go to `/var/lib/homehook/lumen.log`, capped at
      64 KB, buffered in `localStorage` so a failing root service does not lose its own failure.
- [x] Weather location is opt-in: no city means no weather and no request; Auto (ipwho.is) has to be picked.
- [x] Launch parameters: `{"view":"recent"}` on a cold start (`webOSSystem.launchParams` / `PalmSystem.launchParams`) or a relaunch
      (`webOSRelaunch`) focuses the Recent row (`lib/launchParams.ts`). **(verify)**
- [x] Recent row merges `/var/lib/homehook/recent` (written by `watch.sh`) with Lumen's own list (`lib/recent.ts`). **(verify)**
- [x] `watch.sh`: Home takeover behind a flag, recent-apps file, `hosts-extra` only copies `0.0.0.0 <name>` / `:: <name>` lines, duplicate
      function definitions removed. `clockfix.sh`: TV's own zone unless `TZ_NAME` is set, HTTPS time. **(verify)**
- [x] Settings: Hide app names, Reduce motion. Control Center no longer shows the top button's label through it.
- [x] Error log (seen on the TV): it caught `timer/sleep/getRemainTime` being denied. Sleep timer read and set moved to `lib/root.ts`.
- [x] Lazy-loading Settings and Control Center: tried and dropped. The build is one IIFE script because the app loads from `file://`, where
      ES module chunks do not load; splitting would need a second classic script, and the two are a small share of the 186 KB bundle anyway.
      Revisit only if the Phase 4 trace shows script parse time matters.

### Next
- [ ] Pop-up list picker for long options (weather city, country, language, picture mode, sound mode) instead of stepping through with OK.
- [ ] Settings: focus highlight strength; tiles per dock row (5, 6, 7); video wallpaper only between set hours.
- [ ] Settings: import from the backup on demand (today only automatic on a fresh install).
- [ ] Wallpaper: `img.decode()` before the swap (it already waits for `onload`).
- [ ] `content-visibility: auto` on off-screen rows and panels; video wallpaper at 720p (the Mixkit catalogue has both).
- [ ] Frame-rate counter in dev builds only.
- [ ] Settings descriptions: check the rest against what the app does now.
- [ ] Tag `v1.1.0` and switch the TV to the stable repository once the dev build has been lived with.

---

## Phase 1 notes: the rewrite, build and deploy (done)

- `app/` is the committed source (fork of webos-launcher at 1e2c39b); the `tools/apply_*.py` pipeline is gone. Proven against the published
  1.0.9 ipk.
- `.env` (from `.env.example`) sets `LUMEN_APP_ID`, `LUMEN_APP_TITLE`, `LUMEN_TV_HOST`; `npm run build:ipk` builds into `build/`;
  `npm run deploy` installs over SSH; personal assets live in gitignored `app/private/`.
- Homebrew Channel repository instead of a LAN server: every push to a branch other than `main` builds the public `.ipk`, publishes it as the
  rolling `dev` release and writes `hbc-repo/dev/apps.json`; a `v*` tag does the same into `hbc-repo/stable/`. The TV has the dev
  repository added, so updating is a push plus Update in the Channel. Two consequences: (1) this is the public build, without `app/private/`
  (no third-party logos, no SF font, no personal wallpapers); (2) dev versions are `1.0.9xxx`, so the next tagged stable must be at least
  `1.1.0`, or the Channel will see it as older than the dev build already installed under the same id.

---

## Phase 4: Performance (needs DevTools on the TV)

Goal: know how fast Lumen is on this TV, make cold start faster, and check every later change against the numbers.

- [ ] Record three numbers as the baseline, with DevTools traces: Home press to home screen visible; key press to focus moving; cold start to
      interactive.
- [ ] Then the cold-start items: draw the first row first (done), defer the rest until the first frame is up, images at screen size or smaller.
- [ ] Graphics setting Low/High, only if the blur spike passed.

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

Done when: the three numbers are recorded before and after, none got worse, and Recents opens Lumen on the Recent row.

---

## Phase 5: Control Center additions (needs the settings keys spike)

- [ ] Sound output: TV speakers, soundbar (ARC or optical), Bluetooth
- [ ] Backlight slider
- [ ] Eye Comfort toggle

---

## Phase 6: Colour buttons

Only if the colour-button spike found buttons that reach the app.

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
