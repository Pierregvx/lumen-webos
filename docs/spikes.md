# Spikes: answers from the TV

LG 43UT91006LA, webOS 25. One entry per question in PLAN.md "Spikes", with the date and what was run.

## Background apps (2026-10-15)
Opened Lumen, then Plex; with Plex in front, `luna-send -n 1 luna://com.webos.applicationManager/running '{}'` listed lgchannels, LG Home,
YouTube (opened before Lumen), Live TV, HDMI 1 and PlxNative. Lumen was not running. Lumen has no code that closes itself, so the TV ended it,
while an app opened earlier (YouTube) stayed. So it is not "the TV kills every background app"; it kills Lumen. Unknown why (memory, a policy
for some app types, or a keep-alive allow list). Every Home press is a cold start either way.
Possible follow-up: `"keepAlive": true` in appinfo.json. In webOS OSE it makes the app manager suspend an app instead of ending it when
another app opens; LG's webOS TV docs don't list it, and LG's forum answer is that background apps can be ended for memory with no way to
stop it. `grep -l keepAlive /usr/palm/applications/*/appinfo.json /media/developer/apps/usr/palm/applications/*/appinfo.json` found
nothing: no LG app and not youtube-webos uses it, so whatever keeps YouTube alive is not this key. Tried on Lumen 2026-10-16 (dev build with
`"keepAlive": true`): no effect, Lumen still reloads from scratch after Plex. Removed again.

Update 2026-10-22: it is an allow list. The app manager (`/usr/sbin/sam`) reads `com.webos.applicationManager.keepAliveApps` and
`com.webos.applicationManager.restrictedKeepAliveApps` from the config service. As root,
`luna-send -n 1 -f luna://com.webos.service.config/getConfigs '{"configNames":["com.webos.applicationManager.restrictedKeepAliveApps"]}'`
gives `["youtube.leanback.v4","netflix"]`, which is why YouTube stays. `keepAliveApps` is LG Home, AirPlay, the voice apps, Alexa and
`com.webos.app.dvrpopup`. The same call's
`com.webos.applicationManager.lifeCycle` names who may close a background app: the memory manager (`memoryReclaim`) and the window manager
(`windowPolicy`, `userTimeout`). The sam binary has a `skip_to_close_to_keep_alive` path in its close handler. The config service has a
`setConfigs` method and override files in `/var/preferences/` (`configd_debug.json` among them). Not tried yet: add Lumen to either list,
then open Plex and check `running`. The Settings overlay is not kept alive either: it is not in `running` when closed. It only leaves the app
under it running because it opens as a transparent window, not a full-screen one.
The overlay comes from Settings' appinfo.json: `"transparent": true`, `"defaultWindowType": "overlay"`, `"trustLevel": "trusted"`, and also
`"usePrerendering": true`. Other values in use on the TV: `card`, `popup`, `home` (Senior Home), `screenSaver`, `minimal`, `system_ui`.
No store or developer app sets `defaultWindowType`, so it is unknown whether the app manager honours it for Lumen.

## Memory manager (2026-10-22)
Read only, with the TV in use. The memory manager is `/usr/sbin/memchute` (`com.webos.memorymanager`). Its policy is in the config service
too: `python3` over `/var/preferences/configd_db.json`, keys starting `com.webos.memorymanager.`. The ones that bear on app switching:
- `clearBackgroundApp`: `true`. The likely reason the app you were in closes when another app opens. Not proven: the log
  (`/tmp/var/log/legacy-log`) has no line for each close.
- `KeepOnLaunchEx`: LG Home, Senior Home, Google Assistant, Alexa, `com.webos.app.familycare`. Probably apps whose launch leaves the current
  app running, which would explain why LG Home does not end the app you were in.
- `HomeGroup`: LG Home, Senior Home. `KeepOnLaunch`, `FreezeTarget` (empty), `AppHibernationEnable` (`false`) are also there.
- `DefaultRequiredMemory` and `LaunchThreshold`: 120 (MB, by the look of it).

Memory at the time (BBC iPlayer, lgchannels, LG Home and AirPlay running): 1222 MB total, of which about 580 MB is reserved for video (CMA);
182 MB available; swap 900 MB on two flash partitions (`/proc/swaps`, not zram), 433 MB used. `luna-send -n 1 luna://com.webos.memorymanager/getCurrentMemState '{}'` (with `-tt`) gave
`{"currentLevel":"medium","usable":232}`. Other read methods (from `strings`): `getRecordInfo`, `getModeledRank`, `running`.
At boot, `memchute-ready.service` looks for `/home/root/memchute_debug.sh` and skips it when missing.

## Sleep timer (2026-10-15)
`timer/sleep/getRemainTime` from the app: `Denied method call "getRemainTime" for category "/timer/sleep"`. As root, both `getRemainTime`
and `add` (`{"sleepTimeMinute":10}`, then `0`) return `returnValue:true`. Moved to `lib/root.ts`.

## ps on webOS 25 (2026-10-15)
Plain `ps` lists only processes on the current terminal, so a watcher started with `setsid` is invisible to it. Use `ps -ef`, or `/proc`.

## Settings keys (2026-10-15)
Read as root with `settingsservice/getSystemSettings`:
- `picture` / `backlight`: `"100"`. Per picture mode and input (`dimension: {pictureMode: "normal", input: "default"}`).
- `picture` / `eyeComfortMode`: `"off"`.
- `sound` / `soundOutput`: `"tv_external_speaker"` (`dimension: {audioOutput: "default"}`). The other values (soundbar over ARC or optical,
  Bluetooth) are still unknown: switch output in LG's settings and read it again.
Setting `backlight` as root works (80 then back to 100, visibly dimmed, `returnValue:true`). Eye Comfort `"on"`/`"off"` set the same way works (visibly warmer). Sound output: not needed (TV speakers only), so not tested.

## Clock after a reboot (2026-10-15)
`clockfix.sh` moved aside, then `reboot`. After boot `date` gave `Thu Oct 15 21:33:52 BST 2026`: right zone, right time. `clockfix.sh`
deleted. Only a software reboot was tried, not a power cut at the wall. The boot hook started `watch.sh` on its own.

## Live TV channel list and guide (2026-10-17)
Yes. As root: `iepg/getChannelList` with `"channelMode":"Terrestrial"` gives the 188 aerial channels with names, numbers and logo paths
(PNGs under `/tmp/gibbips/logo`); the guide is in `epgdb`, kind `com.webos.service.legacybroadcast.programSCH:4`, joined on
`signalChannelId`. Tuning: `luna://com.webos.service.apiadapter/tv/openChannel {"channelId":...}` opens Live TV on that channel, even
from Home (found from the SSAP gateway's `filtering-uris.js`; Home Assistant's `tv/openChannel` ends up there). Found by watching `ls-monitor` while
`com.webos.app.channeledit` loaded. The full trail and the calls are in `docs/live-tv.md`.
