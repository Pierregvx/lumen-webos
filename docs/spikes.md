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
nothing: no LG app and not youtube-webos uses it, so whatever keeps YouTube alive is not this key. Not yet tried on Lumen.

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
