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

## Verify on the TV (built, not yet seen working)

Add new items here, with the branch and what to check. Delete an item once Sam has seen it work.

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
      pause; the air line reads right; with the server off, Control Center opens as before with no Home row.
- [ ] Films & séries (branch `feat/films-series`, the owner's TV, `docs/films-series.md`): seen working on 2026-10-29: Resume row → title
      starts in Jellyfin where left; series → next episode; replacing a playing title; Library, Discover and Search screens. Still to see:
      Jellyfin cold start (the app closed), the TV keyboard in Search, a real request (film, and a series' seasons), Quick Connect sign-in
      from the Settings rows, a server switched off (home as fast, no row), frame rate on a long poster row.
- [ ] Player (branch `feat/films-series`, the owner's TV, `docs/plans/player.md`): seen 2026-10-29 by camera: plays in Lumen with picture
      (an episode; a 4K Dolby Vision TrueHD film earlier), English subtitles, bar, +20 s, fallback to Jellyfin on a broken stream, next-episode card and
      autoplay. Still to see: the owner's feel (bar, pill, card), the remote's media keys, the subtitle menu, "Still there?", Play in = Jellyfin.
      Fixed 2026-10-30: in the light look the track and focused button were near-black on the shade (seen on the TV, fixed and installed);
      subtitles ran under the next-episode card (now centred to its left; seen with a test card, not yet on a real one).

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

- **Ciné Pierro as the TV's back end (2026-11-10, planned in cine-pierro's `docs/roadmap.md`).** The TV would talk only to the cine-pierro
  server for everything but the video bytes: pairing with a code instead of keeping the Jellyfin, Seerr and Immich keys, the subtitle choice
  and timing shared with the web player, one play logic (`/api/tv/v1/play`), and the Films & series side gathered into a plugin
  (`app/src/plugins/cinepierro/`, built in, turned on by one setting). Adding subtitles from the TV comes with it; tracks added from the
  web page show on the TV by themselves.

In rough order of value:

1. Plex Continue Watching row from the Plex server's On Deck. Tiles open PlxNative. Opening a specific episode needs a launch parameter that
   PlxNative does not have; that is a request to its author, not something this repo can add.
2. Picture and sound mode per app (root; `watch.sh` already knows which app is in front).
3. YouTube subscriptions row (YouTube Data API, TV sign-in with a code), opening videos in youtube-webos with its `contentTarget` launch
   parameter (`{"contentTarget":"v=<id>"}` is documented; `target` is not).
4. Long-press shortcuts per app (for example YouTube: Subscriptions, Search).
5. Bedtime button: lower backlight, Eye Comfort and sleep timer together (all three work as root).
6. Colour buttons (if the spike finds any reach the app): Settings > Remote, an action per button (open an app, Control Center, screen off,
   sleep timer, picture mode, screensaver, nothing). Optionally Input Hook mappings so they work inside other apps too.
7. Auto-switch to an HDMI input when its device turns on; power off when idle.
8. Profiles, and a kids mode with a PIN and allowed hours.
9. Privacy page: LG ad and Live Plus settings, plus hosts-level blocking of LG ad and tracking hosts (check what the Homebrew Channel's own
   telemetry and ad blocking already covers before adding to `hosts-extra`).

## Parked

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
