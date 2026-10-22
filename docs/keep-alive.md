# Keeping apps alive

Goal: switching apps does not end the app you were in. Press Home in iPlayer, then go back to iPlayer: it carries on where it was, with no
launch screen. Lumen itself opens at once. Other apps do not have to stay open for long: going back within a minute or so is the use.

## Where it stands (2026-10-22)

Sam's check at the TV, after the session:
- Lumen opens much faster and with no launch screen at all. But the home screen lags for a moment after it appears, as if it is still
  catching up, so getting back to the last app quickly is still a struggle.
- iPlayer and Plex stay open long enough to go back to them.
- Not reported yet: whether their sound stops in the background, whether they carry on from the same point, and how the running dot looks.

On the TV now (each list is LG's list plus the ids named):
- Lumen is in `com.webos.memorymanager.KeepAlive`: the memory manager never closes it.
- Lumen, iPlayer, YouTube, Plex, Channel 4 and Channel 5 are in `com.webos.memorymanager.KeepOnLaunchEx`: opening another app does not
  close them, but the memory manager still can when it needs room.
- iPlayer's appinfo is patched to `"closeOnBackground": false` (original at `/var/lib/homehook/iplayer-appinfo.backup.json`).
- Lumen is a hand install, not a Channel build: version 1.0.9158 built from the working copy, with `"noSplashOnLaunch": true` and the running
  dot (a dot above each app that is open). Nothing of it is committed. A newer dev build from the Channel replaces it.
- Every other config key has its value from before the session. The whole config's backup is `/var/lib/homehook/configd_db.backup.json`.

The config changes survive a reboot. The memory manager reads them only when it starts, so a change needs a reboot to take effect.

## How the TV closes apps

Found with `ls-monitor` during app switches. The details are in `docs/spikes.md` (Keeping apps alive).

- The memory manager (`/usr/sbin/memchute`, `com.webos.memorymanager`) closes the app you were in the moment another app opens:
  `applicationManager/closeByAppId`, reason `memoryReclaim`. It does this with 250 MB free and when the new app asks for 0 MB. It is policy,
  not a lack of memory.
- `KeepOnLaunchEx` protects the app on the list from that close (a soft keep). `KeepAlive` also protects it when the memory manager reclaims
  memory (a hard keep). Opening YouTube makes it reclaim, and it often closes every soft-kept app at once.
- An app can ask to be closed when it leaves the screen: `"closeOnBackground": true` in its appinfo. The app manager then closes it
  (`killApp`, reason `undefined`) whatever the memory manager's lists say. Of the apps in daily use, only iPlayer does this.
- These have no effect: `clearBackgroundApp` (nothing reads it), `applicationManager.keepAliveApps` and `restrictedKeepAliveApps` (they do
  not override the memory manager or `closeOnBackground`), `bindAppProperties` (it only binds Live TV's icons).
- The preload manager starts apps in the background on its own: YouTube, LG Channels and AirPlay among them. It keeps its own policy and
  ignores the config's `supportAppList`.

## Results

Each run: reboot, wait 2 minutes, then `switchtest.sh` with `memwatch.sh 2`. Warm means the app was still open when it was opened again.
Memory is tight: 1222 MB in all, about 580 MB of it reserved for video. Usable memory never went below 150 MB in any run.

Standard sequence (Lumen, Plex, iPlayer, YouTube, Channel 4, Channel 5 with Home between, 13 opens):

| Run | Change | Warm | Lowest usable MB |
|---|---|---|---|
| 1 | Baseline | 0 | 168 |
| 2 | LG Channels and AirPlay off the lists | 1 | 202 |
| 3 | Plus preloads off (lost at reboot) | 1 | 194 |
| 4 | Plus Lumen in `KeepOnLaunchEx` | 3 | 174 |
| 5 | Plus Plex in `KeepOnLaunchEx` | 4 | 176 |
| 6 | Plus Lumen and Plex in `KeepAlive` | 6 | 160 |
| 7 | Plus `clearBackgroundApp` false | 6 | 158 |
| 8 | `clearBackgroundApp` back, no launch screen installed | 6 | 159 |
| 9 | Only the two lists for Lumen and Plex, all else put back | 6 | 187 |
| 10 | Lumen hard-kept; iPlayer, YouTube, Plex, Channel 4, Channel 5 soft-kept | 3 | 152 |

Sam's sequence (Lumen and iPlayer in turn, with Plex and YouTube between, 20 opens; `SWITCH_SEQ` in `switchtest.sh`):

| Run | Change | Warm | Lowest usable MB |
|---|---|---|---|
| 11 | As run 10 | 9 | 185 |
| 12 | Plus iPlayer in `applicationManager.keepAliveApps` | 9 | 150 |
| 13 | That undone; iPlayer's appinfo patched | 12 | 168 |

A warm open is 0.4 to 1.6 s to the front, against 3 to 11 s cold. Lumen's own process is about 35 MB in the background (its share of the
shared web engine is not counted).

## Not tried yet

Most useful first:

1. Lumen's lag on return. Lumen lets go of its wallpaper 5 s after it leaves the screen (`lib/wallpaper.ts`, and the video's decoder in
   `lib/wallpaperVideo.ts`), so each return decodes the full picture and its blurred copy again. That saved memory when Lumen was closed
   anyway. Keeping them costs memory, so measure both. The memory manager also pushes background apps to swap on flash, and paging back in
   is slow. A DevTools performance trace of a return (over `tools/tv/cdp.mjs`) would show which it is.
2. Lumen's memory footprint, measured fully (with its share of the web engine), then trimmed. Sam's next benchmark.
3. Lumen at boot. `watch.sh` only swaps LG Home for Lumen after a boot or wake. When the TV boots into Live TV, nothing starts Lumen, so
   the first Home press is a cold start (about 8 s).
4. Turn off the preloads Sam does not use (YouTube, LG Channels, AirPlay) at each boot from the boot hook, with
   `preloadmanager/setPreloadPolicy {"application":{"id":"...","isEnabled":false}}`. The call works, but the change is lost at reboot.
   This also stops YouTube getting a running dot before anyone opens it.
5. Preload our own apps. Adding them to the config did not work, and `setPreloadPolicy` answers "Cannot find" for an app it does not know.
   Untried: `allowedApps` in `/var/preferences/webos-preload-manager-conf.json`, and the preload manager's own stored list.
6. Keep the iPlayer patch after an iPlayer update: reapply it at boot when the flag is back. Unknown whether the app manager reads the
   change without a reboot.
7. The Recents button: still off on the remote. Now that apps stay open, it is worth turning on again.
8. Freeze instead of close: `com.webos.memorymanager.FreezeTarget` (empty now). A frozen app uses no CPU and can go to swap without
   closing, which may survive YouTube's reclaim. memchute has an `updateFreezeTarget` function, which may mean the list can change without
   a reboot.
9. A cap such as "Lumen plus the last three apps". It needs a watcher that rewrites the lists and restarts the memory manager at each
   switch, since it reads them only at start. Heavy; only if soft keeping turns out too loose.
10. memchute's debug log, to see why it picks the apps it closes.
11. Hibernation (`AppHibernationEnable`, `false` now): saves an app to flash and restores it. Highest risk: it writes to flash, and the
    memory manager has daily flash-write limits (`EfsDailyWrSize`).
12. Lumen as an overlay window, like LG's Settings panel (`"defaultWindowType": "overlay"`, `"transparent": true`), and
    `"usePrerendering": true`. LG may honour them for its own apps only.

## Tools

- `sh tools/tv/switchtest.sh [dwell-seconds]`: opens apps in a fixed order (13 steps, 20 s each) and prints, per step, warm or cold,
  seconds to the front, usable MB and the apps still open. `SWITCH_SEQ="<ids>"` replaces the order. It opens apps on screen.
- `sh tools/tv/memwatch.sh [seconds] [count]`: read only. Per sample: time, app in front, the memory manager's level and usable MB,
  `MemAvailable`, swap used, then each open app as `id=RSS+swap` MB.
- `sh tools/tv/variant.sh <in.ipk> '<json>' <out-dir>`: a copy of a built `.ipk` with extra appinfo keys.
- `reboot` over SSH brings the TV back on, and it stays on. Wake-on-LAN is on (`eth0`, `00:a1:59:e8:89:08`) if it ever stays off.

## Undo

- A config key: `setConfigs` with its old value. The old values are in the backup above.
- All config: copy `/var/lib/homehook/configd_db.backup.json` back to `/var/preferences/configd_db.json` and reboot.
- iPlayer: copy the backup over `/media/cryptofs/apps/usr/palm/applications/bbc.iplayer.3.0/appinfo.json` and reboot.
- Lumen: update it in the Homebrew Channel.
