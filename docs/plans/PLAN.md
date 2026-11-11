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

## Where things stand (2026-11-08)

- Lumen 2.2.0 is the latest release, numbered for Lumen Guide (2.1.6 had it first). 2.1.5 brought branch `live-tv-preview` to `main`: the Guide's rail and placeholder shapes, the
  live preview (dev builds), the brightness per input, the Home stand-in fix, the Stadia script fixes, and Lumen Guide, the overlay
  over Live TV (`docs/plans/guide-overlay.md`). From 2.2.0 the release workflow builds Lumen Guide too and lists it
  in the Homebrew Channel beside Lumen. `watch.sh` does nothing for it when it is not installed.
- Credits for the forks and projects this work drew on are in `README.md` (Credits) and `THIRD_PARTY_NOTICES.md`.
- Pick up next: the Verify items below, then Lumen Guide's own (verify) list in `docs/plans/guide-overlay.md` (Status).

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

- [ ] Upstream 2.2.0 merged into the fork (2026-11-11, branch `claude/merge-upstream-2-2-7857a1`) **(verify)**, installed on the TV
      that evening with the plugin (and Lumen Guide). **Switch-on seen working, 2026-11-11, the owner at home:** TV scripts updated (the
      old ones kept in `/var/lib/homehook/backup-avant-upstream-2-2/`), Home takeover and power-on set to Lumen, then a reboot: Lumen was
      in front as soon as the TV answered (41 s after the boot, `poweron_loaded` Lumen). Then with the remote: switch off, switch on 15 s
      later, and Home from an app: the owner saw all of it right (Lumen in front, no LG Home, no HDMI 1). Recorded on the TV: after 14 s
      in standby, Lumen in front 1 s after the wake (it had been preloaded 10 s into standby); after 2 s in standby, about 3 s; from
      YouTube, Home brought Lumen back with nothing in front between. `homeAutoLaunch` is still off.
      **The Guide, seen working the same evening** (keys sent over DevTools, the owner watching): GUIDE opens it with the search field
      and the category button at the top; Left opens the rail, Down and OK switch to the Full guide; Up from the first channel reaches
      the search field, Left the category button, OK its menu (14 categories, 2938 channels), Back closes it; Left past the earliest
      programme opens the rail again. The French hint at the top was cut off by the two buttons: « ▲ Search · » is dropped (the field
      is beside it), and « Now » and « Next » are in Lumen's own table (« Next » showed in English); the owner approved both live. Not tried: OK held to star a channel, typing a search.
      **Control Center, seen working the same evening** (over DevTools, the owner watching): the settings button's launch opens it with
      the Home row (lamp, Living Room at 25, play) and the air line; OK on Sound opens its 7 choices with the whole grid, the Home row and
      the air line faded to 0 behind them; Back closes the list with nothing changed and the grid comes back. Not tried: its 460 ms open
      by eye, a choice picked from a list.
      **The screensaver, seen the same evening**: after the update the setting reads Disabled (Show: Wallpaper pictures) and
      `/var/lib/homehook/no-screensaver` is gone; Control Center's picture button opens Lumen's screensaver on a wallpaper picture with
      the clock and the date, and a key goes back to the home screen. The fork's old « Off » choice is gone, so LG's own screensaver
      runs again where it was set to Off (upstream's choice: turning it off belongs to the service menu). Not tried: the idle timer
      (set to 0), Immich photos, a key over an app. Brightness is off (`brightnessOn` false), not tried.
      **Films & series with the plugin, seen unchanged the same evening**: Library opens on Resume, The Last of Us first with « Prêt,
      sans bruit », its score (« ★ Déjà noté : 8 / 10 »), the season chips (S1 · là, S2 · là) and the plugin's buttons (À voir plus tard,
      Dans le même genre, Signaler un problème, Préparer); Discover has the server's rows in the page's order, For you to Séries à venir.
      Not tried: playing a title, the speaker bar.
      Still to try: (4) The
      screensaver (Enabled/Disabled, Show: wallpaper or Immich), Brightness, the two-value settings that flip on OK. (5) Films & series
      with the plugin, Resume's prepared copies, the speaker bar: unchanged.

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
      **Measured on the TV on 2026-11-11** (the owner at home; median of 3; installed then and left installed): cold launch, script
      ready 223 → 267 ms, first frame 375 → 423 ms (+48 ms, +13 %: the 40 KB more script before the first frame), app grid 2883 → 2691 ms;
      a Discover row scrolled 54.6 → 53.3 frames/s (−2.4 %, the page's own frames); OK on a poster to its buttons 30 → 25 ms; memory 10 →
      10 MB. The plugin turned itself on (the picks server's address was set); the server answered contract revision 3. Seen with the keys,
      nothing written: Discover's rows in the page's order with 31 genre tiles, the ★ scores and the dates, a series' season chips, a
      library film's buttons (Report a problem's form and Prepare's Now / Tonight open and close with Back), More like this. Still to see:
      a saga, the subtitles shared with the page (needs a play), Watch later on and off (writes). The way back: `build/rollback/` has the
      previous version's package (the same files as the build installed before).
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
- [ ] Lumen's Guide has the overlay's rail in place of the switch at the top right (branch `live-tv-preview`, on the TV). Left from
      Now and Next opens it, and Left past the earliest programme in the Full guide. Up/Down and OK pick a view, Right goes back. Up at
      the top of the list no longer leaves the list. The rail is 340px open and each item is as wide as its name (tried live; the
      build with it is not installed yet).
- [ ] Placeholder blocks while guide data loads (branch `live-tv-preview`, on the TV). In Lumen's Guide, a channel still waiting for
      its programmes shows blocks for the title, times, progress and Next, and the text fades in over them. In the Full guide (Lumen's
      and the overlay's) each row shows three blocks while the schedule loads, and the details at the top show blocks, not "No guide data".
- [ ] Lumen Guide: the (verify) items at the end of `docs/plans/guide-overlay.md` (Status).
- [ ] The overlay guide survives GUIDE then LIST after the reboot (branch `live-tv-preview`). The keep list took effect at the
      2026-11-08 reboot; before it the memory manager closed the hidden guide (docs/plans/guide-overlay.md).
- [ ] Home over Lumen no longer goes black (branch `live-tv-preview`, `tools/tv/home-setup.sh` stand-in, already on the TV). Press Home
      on the remote from Lumen's screensaver and from Lumen's home screen: Lumen comes back after a short black flash at most.
- [ ] Stadia reconnect from the remote (branch `claude/stadia-controller-reconnect-iax0gd`, `tools/tv/stadia.sh`). In Moonlight, after a
      drop or a reconnect: the Controller check alert says B on the controller dismisses it, OK on the remote reconnects. OK shows the
      Stadia + Y alert at once, and Stadia + Y pairs it without waiting for the dead link to time out. Check `stadia.log` for "controller
      reconnected on its own" (a drop that came back inside one 2 s poll) and "OK on the remote: re-pairing". Also whether Back on the
      remote closes the alert. After a repair the check alert returns until a button press arrives; "Controller paired." shows then, not
      before. In the log, "controller in the scan after Ns" should come only after Stadia + Y (a "no live scan entry ... pairing anyway"
      line shows the scan guess was wrong).
- Stadia bridge (`tools/tv/stadia-bridge.py`, uncommitted on `live-tv-preview`): works when LG's GATT client is fresh, fails after a
  power-cycle because LG's `monitorCharacteristic` stops registering for notifications (`docs/research/spikes.md`, "Bridge built").
  Cause found: a disconnect while a sign-up is live leaves LG's lower layer stale, and only a Bluetooth service restart has cleared it.
  Sam dropped the bridge on 2026-11-06: it is unwired from the boot hook, the install list and the README, and parked in `tools/tv/`.
  Next session: dig into the LG bug itself (where the HID host and the SIL keep their stale state, and whether anything short of a
  Bluetooth restart clears it). The TV was off before cleanup, so on the TV: install the repo's `60-homehook` (it still starts the
  bridge, which stays idle while `no-stadia-bridge` exists), then delete `stadia-bridge.py`, `no-stadia-bridge` and the jail node
  `/var/palm/jail/com.limelight.webos/dev/hidraw1`. HCI snoop and the stack trace are still on (RAM, up to 20 MB each); they help the
  next session, so turn them off (`bt_stack.conf.orig`) only when the Stadia work ends.

- main, 2.1.3: switch-on follows Settings > Home and Power > When the TV turns on. With Lumen, a switch-on from standby still opens
  Lumen. With Last input, it leaves Live TV (or the last app) in front. Update the TV scripts from Settings first (issue 6).

- [ ] Preload guard in `watch.sh` (`docs/keep-alive.md`, item 4). After a reboot, `/var/preferences/webos-preload-manager-conf.json`
      still has `false` for Netflix, AirPlay and LG Channels, and `/tmp/homehook.log` shows a "preload: set back to off" line whenever
      the TV had flipped one back on. YouTube is left preloading on purpose.

- [ ] TV scripts, Home and Power, and Privacy in Settings (branch `ccr-dba88192-ygl4fc`; `docs/home-and-power-on.md`, `docs/privacy.md`).
      Live first over DevTools where it can be: the rows' text and layout. The root calls need a build with the scripts in it.
      1. Settings > System > TV scripts says Install or Update; OK installs them. Check `/tmp/homehook.log` and that `watch.sh` restarted.
         Also `sh /var/lib/homehook/home-setup.sh check` over SSH once, for the fullest report.
      Tested remotely 2026-11-01: step 1 works (Install, then Up to date, watchers restarted). Power-on works: after a restart from
      Live TV, bootd opened Lumen first and Live TV never showed. Home button opens: setDefaultApp did nothing for Exit, so it is now
      the Home takeover (`docs/home-and-power-on.md`); Exit and Back out of YouTube open Lumen after about 1 s, and the guard mounts it
      again after a restart. Still for Sam: how the 1 s hand-over looks, the real remote's Home and Exit, and Wake-on-LAN and remote
      power-on from standby.
      4. Privacy, one row at a time, with an app or two in daily use between each (Plex, iPlayer, YouTube): agreements, Limit ad
         tracking, Live Plus, Block LG ad servers, Stop LG tracking services. Note the values after a restart. Block TV software updates
         last.
         Tested remotely 2026-11-01: the agreements were already withdrawn and Live Plus already off. Limit ad tracking, Block LG ad
         servers (178 lines) and Stop LG tracking services are on; iPlayer and YouTube still open. The services row reports 2 still
         running (`service-logger` and `nudge` sat in "deactivating"). Plex not tried.
      5. Power-on works, so remove the TV input added on 2026-10-24 (`eim/deleteDevice`, appId `com.samrenfrew.lumen`) and the item
         "Cold start after a reboot" below.
- [ ] Screensaver without Immich (`design/system-cleanup`): Settings > Screensaver offers Enabled or Disabled, with no Off; Disabled hides the other rows. Enabled with
      Show set to Wallpaper pictures, LG's screensaver timer opens this app's, which crossfades the pictures ticked in Choose wallpaper.
      Immich photos still work. Check that `/var/lib/homehook/no-screensaver` is gone after a launch.
- [ ] Switch-on leaves Live TV alone (`design/system-cleanup`, `tools/tv/watch.sh`, on the TV 2026-10-31): the watcher opens Lumen at switch-on only
      if Lumen was the last app in front, or the TV came up on LG Home. Check: watch Live TV, switch off, switch on, and Live TV stays with no
      Lumen. Then switch off from Lumen and on again, and Lumen opens. `/var/lib/homehook/last-front` should name the app you were in.
- [ ] Home soon after switch-on is warm (`tools/tv/watch.sh`, on the TV 2026-10-31): switching off closes Lumen, so the watcher starts it
      hidden 10 s into standby. Seen: it loads in standby and survives the TV's deeper sleep (Lumen up 1 s after LG Home, 26 s after a
      switch-on). Not yet seen: Home pressed within 5 s of switching on into Live TV, after at least a minute in standby.
- [ ] Settings > Brightness (2026-11-02; `lib/brightness.ts`, `tools/tv/watch.sh`). Needs the TV scripts updated. Turn off Home
      Assistant's brightness and Eye Comfort automations first. Check: `/var/lib/homehook/backlight-schedule` holds three lines; within a
      minute `/tmp/homehook.log` shows a "brightness:" line and the backlight matches. Set a start time a minute or two ahead and watch it
      change. A change by hand stays until the next part of the day. With Lumen's screensaver up across a start time, the screensaver stays
      dim, and a key press brings back the new level, not the old one. Eye Comfort follows the schedule unless set to As the TV is set.
      Change set to Over 30 minutes or more: from each start time the backlight moves from the last part's level to the new one, a
      little each minute, with a "brightness:" line per change in the log. Check that a 1-point step each minute is not visible.
      Each input keeps its own backlight (2026-11-06: the night level reached apps but Live TV stayed at the day's 80). Switch from an
      app to Live TV and back: within about 3 s the log shows "backlight <level> on <input>" for Live TV's input, and it matches.
      Seen remotely 2026-11-06: "backlight 80 on dtv" 3 s after Live TV opened. It was already 80, so a real change at 18:00 is still to see.
- [ ] Live preview in the Guide (2026-11-06, dev builds; `components/LivePreview.tsx`, branch `live-tv-preview`). The spike is
      done (`docs/research/live-tv.md`): it plays in 115 to 335 ms, under the page with no hole needed. Then with Settings > System > Live preview on: stop on a channel and the picture shows in about half a second;
      flick through and nothing tunes until you stop; Live TV's last channel is unchanged after; leaving the Guide lets the tuner go.
      Round 2 (2026-11-06, not yet on the TV): Settings > Live TV (dev builds) has Preview in the Guide, Preview on the Live TV row and
      Sound. Check: the logo holds until the picture shows, with no black gap;
      with Sound on, the preview plays the channel's sound; on Home, the focused channel tile on the Live TV row fills with the picture,
      and the lift animation does not misplace it; with Live TV in front, Lumen holds no preview. Also: the Guide button from Live TV
      opens the Guide on the channel being watched (`root.ts` `currentChannel`). Seen 2026-11-06: it does not, because
      `apiadapter/tv/getCurrentChannel` gives the last channel Lumen opened, not one changed to inside Live TV.
      `legacybroadcast.broadcast/getCurrentChannel` needs a `broadcastId` that only Live TV holds. Still to find: a source for Live
      TV's real channel. The Guide button now reopens the Guide afresh each press. The Guide's first preview waits for two frames and
      800 ms (`previewTiming.first`), so it does not slow the Guide's opening.
      Round 3 (2026-11-06): the dwell before tuning is 600 ms, after a 250 ms try made scrolling lag (`docs/research/frame-rate.md`). Sam saw a long black gap after the logo went: the TV keeps the
      picture muted about 2.5 s past `playing` (`docs/research/live-tv.md`). Installed 2026-11-06: the logo holds until the TV's
      `listMuteStatus` says the picture is unmuted (4 s fallback), then fades after 200 ms (Sam's pick, live). A spinner sits where the
      Live tag goes (20 px in on the row tiles) until the picture shows. All seen right live; check the build matches: no black between
      the logo and the picture, the spinner goes as the picture comes, and scrolling the Guide does not lag. `lumen.preview` on DevTools shows
      the waits (change them live) and `last` gives the newest tune's ms to `playing` and to first frames.
      Idea (Sam, 2026-11-06), spike first: when the Guide opens, start Live TV hidden (`applicationManager/launch` with
      `"preload":"full"`, as `watch.sh` does for Lumen) so OK on a channel opens it faster. Check it does not take the preview's tuner,
      play sound, or come to the front, and time OK to picture with and without it. Live TV is often still running already.
- [ ] Screensaver goes back to the app (2026-11-02; `watch.sh` passes `from`, `leaveAmbient` in `app.tsx`). Pause a film in Plex and in
      YouTube, let the screensaver start, press OK: the paused film comes back where it was, not Lumen's home screen. Home over the
      screensaver still goes to Lumen's home screen. If an app restarts instead of resuming, note which (codefarm-eu moved to an overlay
      for this, which hints that some apps lose their place).
- [ ] Wallpaper fade without the stall (2026-11-02, from quangtdev's fork): night dimming is now a black sheet (`#wpimage::before`), not
      opacity, and a new picture is drawn 150 ms before its fade starts. Check at night: a wallpaper change fades smoothly, and the
      dimming looks the same as before.
- [ ] App names drop a store tagline (2026-11-02, from juanrusch's fork): "Spotify - Music and Podcasts" reads "Spotify", and a long name
      in the dock ends in "…" inside the focused glass.

---

## Open on the TV

- [ ] Cold start after a reboot: the TV showed Live TV for 10 to 15 s before Lumen (2026-10-24). Lumen is now a TV input (`eim/addDevice`,
      id `MVPD_IP-com.samrenfrew.lumen`, done over SSH), picked once as the last input; the next restart drew at 8.3 s (one sample). Next:
      more samples, check that Live TV no longer shows first, and why `/tmp/homehook.log` was missing after that boot. Removing the input
      is `eim/deleteDevice` with the same appId (untested).
      Idea from Hearth 2.0 (`docs/research/prior-art.md`, "Opening an app when the TV is switched on"): a copy of
      `/etc/palm/bootd.json` at `/var/luna/preferences/bootd.json` with `remoteKey`, `localKey` and `micomPower` set to Lumen makes
      the TV open Lumen first, behind LG's start-up cover. Check first, read-only: does `/usr/sbin/bootd` name that path, and what is in
      this TV's `firstAppByPowerOnReason` table.
- [ ] Keep apps alive (`docs/keep-alive.md`): Lumen, iPlayer, YouTube, Plex, Channel 4 and Channel 5 stay open in the background. Lumen's
      home screen lags for a moment on return. Next and untried: "Not tried yet" in that doc. Check Plex and iPlayer go quiet in the
      background and carry on from the same point.
- [ ] Control Center timings (Sam, 2026-10-26): Control Center opened much faster than Inputs, because its first frame takes 100 to
      200 ms and about half of the 260 ms grow had gone before it showed. Its grow is now 460 ms (Inputs stays 260); Sam liked it live on
      2026-10-27. Next: build it and confirm on the TV.
- [ ] Sound and Picture lists feel slower to open and close than Theme and Clock (Sam, 2026-10-27). Not a speed problem: 50 and 100 ms
      faster did not help. Their lists grow only downward, so the tile's "Sound" or "Picture" text is seen to slide and fade, while Theme
      and Clock grow both ways and their text barely moves. Next: Sam to come back with a direction.
- [ ] Draw the lower rows one row at a time, not all at once 3.5 s after launch (`docs/research/startup-perf.md`, Still open).
- [ ] Up and Down between the home screen's lower rows lag (the owner, 2026-11-11): each press rasters 300 to 600 ms on the GPU, several
      full-screen layers (`docs/research/frame-rate.md` > The Resume row and the rows' Up and Down). Seen with the plugin build, and the
      cause is older than it: the Resume row's picture (since `films-series`) and layers under the Live TV row. Done: the picture waits
      700 ms and is decoded first. Next: name the two full-screen layers that raster on Down into the Live TV row
      (`tools/tv/perf/rows-updown.mjs`, hiding its parts one by one). Done when a row change shows at most 10 % more raster than a move
      along a row.

### Spikes (yes/no answers, noted in `docs/research/spikes.md`)
- [ ] Recents button: rebind it with Input Hook to launch Lumen with `{"view":"recent"}`.
- [ ] Colour buttons: which does this remote have, and which key codes reach the app? (Gates the colour-button idea in Later.)
- [ ] `https://sylvan.apple.com/` videos play directly (then the plain HTTP fallback in `lib/wallpaperVideo.ts` goes).
- [ ] `hosts-extra`: capture what this TV calls (LG ads and tracking) and fill it in. It is empty now.

---

## Next: ideas from other launchers (2026-10-24)

From `docs/research/prior-art.md` and upstream (ammar027/lumen-webos). Build without the TV; try each one on the TV later.

- [ ] Frigate front door card: over the home screen or the screensaver, a card with the door camera's live view when Frigate sees a person or
      motion. Lumen listens to Home Assistant over its WebSocket API. Test which stream the TV plays (HLS, or JPEG frames from go2rtc).
- [ ] Home Assistant buttons in Control Center: a short row of chosen entities (for example the lounge lights).

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
7. One language on screen: French everywhere but names (the subtitle menu mixes English and French, seen 2026-11-10).

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
