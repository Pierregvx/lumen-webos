# Lumen roadmap

Target TV: LG 43UT91006LA, webOS 25 (Chromium 120), rooted, Homebrew Channel installed, Home button remapped with LG Input Hook.
Apps in daily use: PlxNative (Plex), youtube-webos, BBC iPlayer, Channel 4, Channel 5.

This is a personal fork. Nothing goes back to partridgeworks/webos-launcher. Features are tried against this TV first and kept only if they work here.

Code that needs a TV answer is written defensively (it does nothing harmful if the answer is no) and goes in **Verify on the TV** until
Sam has seen it work. The agent installs each change on the TV over SSH (`npm run deploy:home`), so "verify" means: Sam tries it on the TV
and reports back. Once Sam has seen it work, delete the item; git history keeps it.

The list was cleared on 2026-10-26. Older items that were never ticked are in git history (`git show 19db1f3:PLAN.md`); treat them as
seen unless something looks wrong.

---

## Where things stand (2026-10-26)

- Design audit done (branch `design/system-cleanup`, `docs/research/design-audit.md`): the stylesheet split, three glass materials, two focus
  styles, one type scale (18, 22, 26, 32, 56, 80, 120), the wallpaper category bar with a sliding pill, and left-aligned Settings
  headers. Sam checked each change live on the TV on 2026-10-26, and the build is installed. Step 9's focus-zone helper was dropped
  (no shared logic to pull out). Not committed yet.
- Pick up next: the two Control Center items in Open on the TV (open timing against Inputs, and the sub-menu lag).

---

## Plugins, and Ciné Pierro par tv/v1 (2026-11-11, branch `claude/tv-v1-parite-6eb48b`)

Lumen has a generic plugin system (`docs/plans/plugins.md`): plugins compiled in from a folder outside the repository
(`LUMEN_PLUGINS_DIR`, or `app/private/plugins/`), each turned on in Settings > Plugins, every call into one guarded. Without a plugin Lumen
is the plain launcher. It is written to be proposed upstream as it is.

**Ciné Pierro is a plugin, kept out of this public repository**: its draft is in `~/cine-pierro-wt/lumen-plugin-draft/` on the Mac (not a
git checkout; to become `lumen-plugin/` in the private `cine-pierro` repository). It talks to the cine-pierro server through its
versioned contract `/api/tv/v1` (contract revision 2 at cine-pierro `cca1e0c`), so Films & series has what the web page has. Build:
`LUMEN_PLUGINS_DIR=~/cine-pierro/lumen-plugin npm run deploy:home` (or that line in `.env`). Its README says what is wired, what waits for
the server (pairing, Jellyfin's address in `/me`, `mine` on every list) and its tests (`npm test` there: the contract check and 20 tests).

What it brings, through Lumen's hooks: Discover from the server in the page's order (For you, Watch later, Trending, Platforms, Popular
films, Film genres, Popular series, Series genres, the categories, Coming soon at the bottom), Watch later, More like this (the saga with
Request the missing ones, Recommended, In the same spirit), each season's state as chips, the score already given on posters and the
title, Report a problem on a title that is here, ⚡ Prepare now or 🌙 tonight (main account), requests through the server, and the
subtitle choice and timing shared with the page's player (Lumen keeps its own copy as the fallback). Tried in the preview against a fake
server made from the contract's examples, built in from the draft folder; not on the TV.

---

## Verify on the TV (built, not yet seen working)

Add new items here, with the branch and what to check. Delete an item once Sam has seen it work.

- [ ] Plugins and Ciné Pierro (branch `claude/tv-v1-parite-6eb48b`, the section above) **(verify)**. Not installed. Built with the plugin:
      Settings > Plugins shows Ciné Pierro on, its Server row says « v1.2 »; turned off, Films & series is Lumen's own again; Discover's rows come in the page's
      order (For you, Watch later, Trending, Platforms, Popular films, Film genres, Popular series, Series genres, the categories, Films and
      Series coming soon at the bottom) and scroll smoothly with the genre tiles; a poster already rated shows « ★ 8 »; a coming film shows
      its date; Watch later on and off follows in the row; More like this on a film of a saga (Harry Potter) shows the saga first, and
      Request the missing ones asks each; a series' sheet shows its seasons' chips (an episode in Resume too); Report a problem (only on a
      title that is here) reaches Telegram and shows in the page; ⚡ Prepare › Tonight shows « 🌙 Tonight, 1 am » on the poster; a request
      shows in Seerr under the person's own name; the requests' row on home; a subtitle picked on the TV shows picked in the page's
      player for the same series, and the other way; the timing (‹ ›) set on the TV holds after a restart of Lumen and in the page; with
      the server stopped, the player keeps the TV's own choice and Films & series falls back to nothing worse than « Seerr is not
      answering ». Nothing of it is seen on the TV yet.
      **Speed against the version before (fork `main`, `7151467`): no worse than 10 %.** Measure each version the same way, the TV on,
      Lumen in front, three times, and keep the median (DevTools commands: `~/tv-outils/tv eval '…'` from the NAS, or
      `node tools/tv/cdp.mjs` from the Mac; see the `tv` skill):
      - First screen: launch Lumen cold three times; `grep ' boot ' /var/lib/homehook/lumen.log | tail -3` gives `frame` and `grid` in ms
        (`docs/research/startup-perf.md`). Pass: each within 10 % of the old version's.
      - Opening a title: in Discover, OK on a poster (`key enter`, a real key: a KeyboardEvent made in `eval` has no key code), captured
        as `tools/tv/perf/updown.mjs` does, then `node tools/tv/perf/key-timeline.mjs <capture> <mark>`: the time from the key to the frame
        with the buttons. Then the record's extra buttons (Watch later…) by eye. Pass: within 10 %, and the extra buttons in under 1 s.
      - A row's scroll: `node tools/tv/perf/swaps-per-key.mjs` on ten Right presses in Discover's Trending row (`docs/research/frame-rate.md`:
        frames in the 320 ms after each key). Pass: at most 10 % fewer frames than the old version.
      - Memory: `eval 'Math.round(performance.memory.usedJSHeapSize/1e6)'` after opening Discover and scrolling it to the bottom. Pass: at
        most 10 % more.
      Measured without the TV (2026-11-11): the app's script is 504.6 KB before, 519.7 KB with the plugin system and no plugin (+3.0 %),
      545.0 KB with Ciné Pierro (+8.0 %; gzip 157.5, 162.8, 172.0 KB); the .ipk 2.96, 2.97, 2.98 MB. At start the home screen asks what
      it asked before, once, and the plugin adds `GET /api/tv/v1`, `/requests/mine` (in place of Seerr's request list and one call per
      pending title) and `/me`, all after the first frame.
- [ ] Films & series (`nas-split`, `docs/films-series.md` > The Films & series screen) **(verify)**: Library opens on Resume; Rate on a
      title's buttons (library and Seerr titles), the score shown on it after; the season list of a long series (South Park) scrolls in
      the request panel. Installed 2026-11-08; not yet tried with the remote. Installed again on 2026-11-10 (branch `tv/dev-speaker`,
      after a build from `main` had left it out).
- [ ] Sur la TV (`nas-split`, Ciné Pierro's player) **(verify)**: `luna-send -n 1 luna://com.webos.applicationManager/launch
      '{"id":"com.samrenfrew.lumen","params":{"play":{"id":"<an episode's id>","ticks":6000000000}}}'` opens the episode at 10 min, with
      Lumen closed or already open; it replaces a title already playing; the position sent wins over Jellyfin's; an unknown id says so.
- [ ] IPTV channels from Jellyfin's Live TV (`nas-split`, `docs/plans/live-tv-build.md` > IPTV): seen on the TV over DevTools on
      2026-11-05: TF1 plays, Down zaps to M6, Back returns to the row and Jellyfin keeps no stream open. Still to see: the channels after
      the aerial ones in the Guide and in Settings > Channels, CH+/CH- on the remote, and how a zap of about 10 s feels.
- [ ] The player's episode list (`main`, `docs/films-series.md` > The player): Episodes on the bar of a series opens on the season
      and episode playing; Up to the seasons, Left/Right changes the season; OK on another episode plays it where it was left and Jellyfin
      keeps the place of the one left; Back closes the list; the next-episode card shows the episode's own picture. And a poster with no
      picture has its title in the middle.
- [ ] The player with the pointer (`main`, `docs/films-series.md` > The player > Pointer): moving it shows the bar; hover and click on
      Pause, Subtitles, Episodes, Next episode, the card's buttons, the subtitle rows and ‹ ›, the seasons and episodes; a click on the
      progress line jumps there; a click on the picture pauses; the wheel scrolls the episodes; one press of OK on a button acts once,
      not twice (pause toggling back would show it); pressing Down after using the pointer still reaches the buttons.
- [ ] Platforms, categories and actors in Films & series (branch `feat/platforms-tv`, `docs/films-series.md`): seen working on
      2026-11-02: the Platforms row, the category rows, Netflix's page with its logo above the title, Cast on every title (Discover and the
      library), an actor's page, OK on a poster in any row reaching its buttons, and Back out of each. Still to see: switching All / Films /
      Series on a page, and Discover scrolling smoothly down all 19 rows.
- [ ] Home Assistant in Control Center (branch `films-series`, `server/README.md` > Home Assistant in cine-pierro): the Home row shows under the
      backlight bar; the lamp turns the four living-room plugs on and off; Left/Right on the speaker bar changes the Sonos volume; play and
      pause; the air line reads right; with the server off, Control Center opens as before with no Home row. Seen 2026-11-10 over
      DevTools, the owner at home: the Home row under the backlight bar; the air line matches Home Assistant (20.4° · 59 %); the lamp turns
      the plugs off, then all on (three plugs now, the fourth is unavailable in Home Assistant); Left/Right moves the Sonos by 2, and since
      the fix of 2026-11-10 (`d304163`) the number shown and the next press no longer lag one press behind. Still to see: play and pause
      (sound in the room; from the speaker bar, Right changes the volume, so the play button is hard to reach with the arrows), the server
      off.
- [ ] Films & séries (branch `feat/films-series`, the owner's TV, `docs/films-series.md`): seen working on 2026-10-29: Resume row → title
      starts in Jellyfin where left; series → next episode; replacing a playing title; Library, Discover and Search screens. Still to see:
      Jellyfin cold start (the app closed), the TV keyboard in Search, a real request (film, and a series' seasons), Quick Connect sign-in
      from the Settings rows, a server switched off (home as fast, no row), frame rate on a long poster row.
- [ ] Player (branch `feat/films-series`, the owner's TV, `docs/plans/player.md`): seen 2026-10-29 by camera: plays in Lumen with picture
      (an episode; a 4K Dolby Vision TrueHD film earlier), English subtitles, bar, +20 s, fallback to Jellyfin on a broken stream, next-episode card and
      autoplay. Still to see: the owner's feel (bar, pill, card), the remote's media keys, "Still there?", Play in = Jellyfin. The media
      keys sent by Home Assistant (`webostv.button` PAUSE and PLAY, 2026-11-10) did nothing in the player, but the real remote's Pause and
      Play do work (seen the same evening: paused, then playing again). So the media keys are seen; only Home Assistant's do not reach Lumen. The subtitle
      menu was seen on 2026-11-10 (Timing ‹ › In sync, Off, English - SUBRIP - External ✓); it mixes English and French labels.
      Fixed 2026-10-30: in the light look the track and focused button were near-black on the shade (seen on the TV, fixed and installed);
      subtitles ran under the next-episode card (now centred to its left; seen with a test card, not yet on a real one).

- [ ] The Live TV row with the sport channels (2026-11-10, the `liveChannels` setting, set over DevTools): the row shows Ligue+ 1,
      Canal+, Canal+ Sport, Canal+ Foot, beIN Sports 1 to 3, RMC Sport Live 1, Eurosport 1 and L'Équipe with their programmes. Still to see:
      one of them playing from the row. Tried 2026-11-10: Canal+ plays; **Ligue+ 1 does not** (« Cette chaîne ne passe pas », media error 4:
      the TV refuses its stream's format). Swap it for another sport channel, or find which of Ligue+'s streams the TV plays.
- [ ] Prepared copies (`dev`, `1b8fbe7` and `4cd3f74`): the « Prêt, sans bruit » mark seen again on The Last of Us in Resume on
      2026-11-10. Seen the same evening: a copy (Parks and Recreation S6E16, opened with the `play` launch parameter) plays from the NVMe,
      and its resume point is copied back on the original.

---

## Open on the TV

- [ ] Cold start after a reboot: the TV showed Live TV for 10 to 15 s before Lumen (2026-10-24). Lumen is now a TV input (`eim/addDevice`,
      id `MVPD_IP-com.samrenfrew.lumen`, done over SSH), picked once as the last input; the next restart drew at 8.3 s (one sample). Next:
      more samples, check that Live TV no longer shows first, and why `/tmp/homehook.log` was missing after that boot. Removing the input
      is `eim/deleteDevice` with the same appId (untested).
- [ ] Keep apps alive (`docs/keep-alive.md`): Lumen, iPlayer, YouTube, Plex, Channel 4 and Channel 5 stay open in the background. Lumen's
      home screen lags for a moment on return. Next and untried: "Not tried yet" in that doc. Check Plex and iPlayer go quiet in the
      background and carry on from the same point.
- [ ] Control Center timings (Sam, 2026-10-26): Control Center opens much faster than Inputs does, so the two panels feel different. Make
      them match: compare their open durations and easing in source, pick one, and try it live over DevTools with Sam before building.
- [ ] Control Center sub-menus are laggy again (Sam, 2026-10-26; about 16 fps open, 20 fps close, measured 2026-10-22): 21 live blurs
      change every frame, and the key press runs 60-70 ms of script before the first frame. Possible fix: the grid controls drop their live
      blur late in their fade (a switch at the start shows), and the list choices share one blur. Details in `docs/research/frame-rate.md`. Measure
      again first, since the design cleanup may have changed the cost.
- [ ] Exiting an app, or pressing Exit on the remote, opens LG Home, not Lumen (Sam, 2026-10-26). Only the Home key is rebound by Input
      Hook. The likely fix is the Native Home item under "Next" (`setDefaultApp`), so check whether it covers Exit and app close first.
- [ ] Draw the lower rows one row at a time, not all at once 3.5 s after launch (`docs/research/startup-perf.md`, Still open).

### Spikes (yes/no answers, noted in `docs/research/spikes.md`)
- [ ] Recents button: rebind it with Input Hook to launch Lumen with `{"view":"recent"}`.
- [ ] Guide button: rebind it with Input Hook to launch Lumen with `{"view":"guide"}`.
- [ ] Colour buttons: which does this remote have, and which key codes reach the app? (Gates the colour-button idea in Later.)
- [ ] `https://sylvan.apple.com/` videos play directly (then the plain HTTP fallback in `lib/wallpaperVideo.ts` goes).
- [ ] `hosts-extra`: capture what this TV calls (LG ads and tracking) and fill it in. It is empty now.

---

## Next: ideas from other launchers (2026-10-24)

From `docs/research/prior-art.md` and upstream (ammar027/lumen-webos). Build without the TV; try each one on the TV later.

- [ ] Frigate front door card: over the home screen or the screensaver, a card with the door camera's live view when Frigate sees a person or
      motion. Lumen listens to Home Assistant over its WebSocket API. Test which stream the TV plays (HLS, or JPEG frames from go2rtc).
- [ ] Home Assistant buttons in Control Center: a short row of chosen entities (for example the lounge lights).
- [ ] Native Home: `appCategory: ["home"]` is in appinfo.json (built). Next is the TV step, `setDefaultApp` (upstream
      `docs/native-home.md`), so LG's own Home routes open Lumen, not only the remote's Home key that Input Hook rebinds. Restore LG Home
      before removing Lumen.
- [ ] Free memory by stopping LG services. Read on the TV 2026-10-24: eight services cleanyourtv-WebOS stops (`remotelogger`,
      `service-logger`, `contentminer`, `nudge`, `admanager`, `sportsalarm`, `adoverlay-service`, `uploadd`) run here, about 10 MB
      together. Small but worth doing. `ss.apiadapter.pub` (23 MB) is unknown; find out what it is before touching it. Method: that repo's
      `scripts/debloat-stop.sh`, re-applied at boot from init.d.

## Later

- **Releases from this fork (2026-11-09).** A push to `main` of `Pierregvx/lumen-webos` publishes nothing: its release workflow has
  never run there (0 runs, no release), and the Homebrew Channel's builds come from `samrenfrew/lumen-webos`, which this account cannot push
  to. For now the TV runs dev builds (`npm run deploy:home`), and work is merged into `dev`; `main` waits for a real release. Decided with
  the owner on 2026-11-10: keep to dev builds; the workflow stays off in this fork; `main` is what the TV runs (pushed after each install,
  publishing nothing); the owner never updates Lumen from the Homebrew Channel (its build has no `app/private/`). Fixes from
  `samrenfrew/lumen-webos` (the `origin` remote) are merged in when wanted.
- **Ciné Pierro as the TV's back end**: under way as a plugin, see « Plugins, and Ciné Pierro par tv/v1 » above; what is left is play through the server (step
  3), pairing and the library through the server (step 4), and the TV screens for the contract's other parts.

In rough order of value:

1. Picture and sound mode per app (root; `watch.sh` already knows which app is in front).
2. YouTube subscriptions row (YouTube Data API, TV sign-in with a code), opening videos in youtube-webos with its `contentTarget` launch
   parameter (`{"contentTarget":"v=<id>"}` is documented; `target` is not).
3. Long-press shortcuts per app (for example YouTube: Subscriptions, Search).
4. Bedtime button: lower backlight, Eye Comfort and sleep timer together (all three work as root).
5. Colour buttons (if the spike finds any reach the app): Settings > Remote, an action per button (open an app, Control Center, screen off,
   sleep timer, picture mode, screensaver, nothing). Optionally Input Hook mappings so they work inside other apps too.
6. Auto-switch to an HDMI input when its device turns on; power off when idle.
7. Privacy page: LG ad and Live Plus settings, plus hosts-level blocking of LG ad and tracking hosts (check what the Homebrew Channel's own
   telemetry and ad blocking already covers before adding to `hosts-extra`).
8. One language on screen: French everywhere but names (the subtitle menu mixes English and French, seen 2026-11-10).

## Parked

- Set aside with the owner on 2026-11-10, kept in case: Plex Continue Watching row from the Plex server's On Deck. Tiles open PlxNative. Opening a specific episode needs a launch parameter that
  PlxNative does not have; that is a request to its author, not something this repo can add.
- Same day: Profiles, and a kids mode with a PIN and allowed hours.
- Native (GPU) version of Lumen. Reference: PlxNative (Rust, SDL2, OpenGL ES, webosbrew native NDK; GPL-3.0-or-later, so read for approach
  only). If picked up again, start with a native Immich screensaver as a pilot rather than the whole launcher.
- `content-visibility: auto` on off-screen rows: the lower rows are kept painted at opacity 0 on purpose, so showing them is a fade, not a
  first paint. Revisit only with a trace.

## Not doing

- Live blur over large areas or full screen (too expensive on this GPU). Full-screen backdrops are a blurred copy of the wallpaper.
- Google Photos (since March 2025 third-party apps can only read photos they created or ones picked by hand).
- iPlayer, Channel 4 and Channel 5 content rows (no public APIs).
- Splitting the bundle: the app loads from `file://`, where ES module chunks do not load.
- Contributing any of this upstream.
