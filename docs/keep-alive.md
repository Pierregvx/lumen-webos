# Keeping apps alive: test plan

Goal: switching apps does not end the app you were in. Press Home in Plex, then go back to Plex: it carries on where it was, with no launch
screen. The same for the Recents button, which is off on the remote for now because it has the same problem. One app kept alive for a minute
is enough; the TV may still clear apps that have not been used for a while. Second goal: Lumen itself opens at once, with no launch screen.

Now: opening an app ends the one you were in, and going back is a cold start. That holds for Lumen, for Recents, and between other apps.
Apps on LG's lists (YouTube, Netflix, LG Home) are spared. YouTube is on them only because youtube-webos reuses the official app's id.

Sam's reading of LG's lists: they favour the apps with their own button on LG's stock remotes, so a Netflix button opens Netflix fast. Sam's
remote has none of those buttons. So the plan is to take LG's apps off the lists and put the apps in daily use on them instead.

## What the TV's config says (2026-10-22)

Details and commands are in `docs/spikes.md` (Background apps, Memory manager). Every key below is read from the config service
(`com.webos.service.config`, methods `getConfigs` and `setConfigs`, stored in `/var/preferences/configd_db.json`).

| Key | Now | Likely meaning |
|---|---|---|
| `com.webos.memorymanager.clearBackgroundApp` | `true` | Opening an app clears the one in the background. The main suspect. |
| `com.webos.memorymanager.KeepOnLaunchEx` | LG Home, Senior Home, Google Assistant, Alexa, `com.webos.app.familycare` | Opening one of these leaves the current app running. |
| `com.webos.memorymanager.HomeGroup` | LG Home, Senior Home | Apps treated as the home screen. |
| `com.webos.applicationManager.keepAliveApps` | LG Home, AirPlay, voice apps, Alexa, `com.webos.app.dvrpopup` | Apps the app manager does not close. |
| `com.webos.applicationManager.restrictedKeepAliveApps` | `youtube.leanback.v4`, `netflix` | Same, with some limit. |
| `com.webos.service.preloadmanager.supportAppList` | 22 apps, see Free room | Apps started in the background before they are asked for, up to `maxPreloadApp` (6) at once. |
| `profile.blockedAppList` | not set | Read by the app manager. Probably apps it refuses to open. The value's shape is unknown. |

Save the full current value of each key with `getConfigs` before changing it. Putting those values back with `setConfigs` is the undo.

Memory is tight: 1222 MB in all, about 580 MB of it reserved for video, about 180 to 300 MB usable with three or four apps running. Swap is
900 MB on two flash partitions (`/proc/swaps`), about 430 MB used.

App ids in daily use: Lumen `com.samrenfrew.lumen`, Plex `com.beb.plxnative`, BBC iPlayer `bbc.iplayer.3.0`, YouTube `youtube.leanback.v4`,
Channel 4 `com.fvp.ch4`, Channel 5 `demand5`, Moonlight `com.limelight.webos`.

## Ready (made 2026-10-22)

- `sh tools/tv/switchtest.sh [dwell-seconds]`: the measured run. It opens Lumen, Plex, iPlayer, YouTube, Channel 4 and Channel 5 in a fixed
  order of 13 steps, with Lumen between them as Home is used, and waits 20 seconds on each (about 5 minutes in all). Per step it prints
  whether the app was still running (warm) or not (cold), seconds until it was in front, usable MB, and the apps still running. It ends with
  how many opens were warm. It opens apps on screen.
- `sh tools/tv/memwatch.sh [seconds] [count]`: the memory sampler. Read only. One line per sample: time, app in front, the memory
  manager's level and usable MB, `MemAvailable`, swap used, then each running app as `id=RSS+swap` MB (its own process; the shared
  WebAppMgr process is not counted).
- `sh tools/tv/variant.sh <in.ipk> '<json>' <out-dir>`: a copy of a built `.ipk` with extra appinfo keys and nothing else changed.
- `build/dev/com.samrenfrew.lumen_1.0.9158_all.ipk`: the dev build installed on 2026-10-22, to put back at the end.
- `build/variant-a/com.samrenfrew.lumen_1.0.9158_all.ipk`: the same build plus `"noSplashOnLaunch": true`.

If a newer dev build is installed before the session, download it into `build/dev/` and run `variant.sh` again. `build/` is gitignored.

## At the TV

Ask Sam before the first change to the TV. One yes covers the session.

Before any change, copy `/var/preferences/configd_db.json` to `/var/lib/homehook/configd_db.backup.json`. A `setConfigs` change may
persist across reboots. If the TV misbehaves after one, SSH still works: copy the backup back and reboot.

### The measure

Every result comes from the same measure, so runs compare like for like:

1. Reboot the TV, then wait 2 minutes for the preloads to settle.
2. Start `memwatch.sh 2` in the background, saving to the scratchpad.
3. Run `switchtest.sh`, saving to the scratchpad.
4. Sam's check, once: start something playing in Plex, press Home, open Plex again from Lumen's Recent row. Does it carry on from the same
   point? Note whether Lumen showed a launch screen.

Keep each run's two outputs, named by step. Compare with the baseline: warm opens, lowest usable MB, and which apps the TV ended.

### Steps

1. Baseline: the measure, with nothing changed.
2. Remove LG Channels, AirPlay and the built-in Chromecast (below). The measure.
3. Preload list: off for every app not in daily use, on for Lumen and Plex (below). The measure.
4. Lumen in `KeepOnLaunchEx` (the full current list plus `com.samrenfrew.lumen`), and in `HomeGroup` if that alone does nothing. The
   measure. This is the smallest change for the Home button, since other app switches keep LG's behaviour.
5. Lumen and Plex in `restrictedKeepAliveApps` (the full current list plus both). The measure.
6. `clearBackgroundApp` to `false`. The measure. Watch the sampler: level `low` or worse, a "restarting to free memory" message, or an app
   that fails to open means the TV needs the room.
7. Variant A (no launch screen, `build/variant-a/`). The measure. Watch for a black gap where the launch screen was.
8. Keep what helped, then use the TV normally for ten minutes, with the Recents button on again.

Each step keeps the changes before it, unless one made things worse; undo that one before going on. After each `setConfigs`, check with
`getConfigs`. The reboot in the measure also shows whether the change survives a reboot: check with `getConfigs` again afterwards.

### Remove LG Channels, AirPlay, built-in Chromecast

None is used: the Chromecast is an external one on HDMI. On 2026-10-22, LG Channels and AirPlay were running with nothing opened. LG Channels
is threaded through the memory manager: `KeepAppHib`, `AppBoostingList`, `InputList`, and preloaded at 100 MB. AirPlay is in `keepAliveApps`.
The built-in Chromecast runs as services from `/media/system/apps/usr/palm/services/com.webos.chromecast.*`. In order, stop at the first
that works:

1. LG's settings menus: turn off LG Channels, AirPlay and HomeKit, and Chromecast built-in, where the menus offer it.
2. Config: take each one off every list it is on (preloads, `keepAliveApps`, `KeepAppHib`, `AppBoostingList`, `InputList`). Then
   `closeByAppId` each one and check that it stays closed after a reboot.
3. `profile.blockedAppList`, once its shape is known (look for it in `strings /usr/sbin/sam` and in the app manager's log lines).

After removing LG Channels, check the Live TV app and Lumen's Live TV row: LG Channels may add channels to the TV's channel list. Deleting
the apps' folders is not in this plan: LG's updates manage `/media/system/apps`, and a missing system app could break something less visible.

### Free room: the preload list

`com.webos.service.preloadmanager.supportAppList` now (id, MB, type, on): LG Channels 100 periodic on, LG Home 40 periodic `criu` on,
`com.webos.app.tnativehome` 40 `criu` on, Netflix 100 periodic on, AirPlay 50 off, YouTube 135 periodic `semi-full` on, browser 72 oneshot on,
voice 55 oneshot on, Vudu 73 oneshot on, Amazon 100 oneshot on, Pooq 100 oneshot on, Live TV 40 periodic on, HDMI 1 to 4 40 periodic on,
Live menu (Guide) 40 periodic on, Miracast and its overlay 40 periodic on, Alexa 57 periodic on, Globoplay 65 periodic on, Yandex Alice 45
periodic on.

- Off: LG Channels, Netflix, AirPlay, browser, voice, Vudu, Amazon, Pooq, Miracast and its overlay, Alexa, Globoplay, Yandex Alice. LG Home
  and its native twin too: Lumen replaces LG Home, except for the "LG Home" button in Lumen, which still opens it, just not preloaded.
- On: YouTube, Live TV, the Guide, and the HDMI input the Chromecast is on.
- Added: Lumen and Plex, each with `"preloadType": "periodic"` and `"preloadMode": "partial"`, copying LG Channels' entry's shape. LG's
  developer apps may not be allowed; the measure shows it.

### If the steps fall short

- Freeze instead of end: `com.webos.memorymanager.FreezeTarget` (empty now) with Plex. A frozen app uses no CPU, and its memory can go to
  swap without the app closing.
- Hibernation: `AppHibernationEnable` (`false` now) saves an app to flash and restores it, the way the TV keeps LG Home and the inputs
  (`CRIUSupportApps`). Highest risk. Swap and hibernation both write to the TV's flash storage, and the memory manager has daily flash-write
  limits (`EfsDailyWrSize`), which may be part of why LG closes apps so readily.
- Lumen as an overlay, like LG's Settings panel (`"transparent": true`, `"defaultWindowType": "overlay"`), and `"usePrerendering": true`.
  Both are in `docs/spikes.md`. LG may honour them for its own apps only.
- Lumen's own size: if the profile shows it large next to the others, trimming it is work in Lumen, not on the TV.

To finish: put back every saved value Sam is not keeping, install the dev build again if variant A is not kept, and check that Home opens
Lumen.

## After the session

Write each result into `docs/spikes.md`. For a config change Sam keeps: if it survives a reboot, note that. If not, apply it at boot
from `tools/tv/60-homehook`, before apps open. If the memory manager reads its policy only when it starts, the change must land before that.
`memchute-ready.service` runs `/home/root/memchute_debug.sh` at that moment if the file exists, which is a possible place. Move the appinfo
keys that worked into `app/public/appinfo.json`. Update the Spikes entry in `PLAN.md`.
