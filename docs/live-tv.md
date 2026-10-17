# Live TV channel list: spike in progress (tuning left)

Goal: read the TV's aerial (Freeview, DVB-T, digital only) channel list, so Lumen can show channel tiles and later a guide
(PLAN.md, Spikes and Later item 9). The TV has been scanned and Live TV shows channels.

All commands so far are read-only and run as root over SSH on the TV.

## What we know (2026-10-17)

- EPG-related services on the TV include `com.webos.app.universalepg.nav`, `com.webos.epgdb`, `com.webos.service.iepg` and several
  `com.webos.service.broadcast-*` services (from `ls /usr/share/luna-service2/services.d /usr/share/dbus-1/system-services`).
- `com.webos.epgdb` is a db8 instance (`find`, `get`, `dump`, `getProfile`, ...). Not queried yet: we don't know its kind names.
- `luna://com.webos.service.iepg/getChannelGroupList '{}'` works: groups All (0), DTV (1), Radio (2), Favourites A to E (200 to 204).
- `luna://com.webos.service.iepg/getChannelList` always returns `"channelListCount": 0` and no error, whatever we pass:
  - no parameters (reply echoes `dataType: 3`, `dataSource: 2`, `ipAntennaSupport: true`, `ipChanInteractiveUrl` on `cdplauncher.lgtvcommon.com`);
  - `dataSource` 0 to 3 against `dataType` 0 to 4;
  - `channelGroup`, `channelGroupId`, `channelGroupName`, `groupId` set to All/DTV or 0/1.
- Working guess, not confirmed: `iepg` is LG's internet channels (LG Channels), not the aerial list. The `ip*Support` fields and the logo
  server URL point that way.
- `ls-monitor` while flipping channels in Live TV: the first filter caught only image paths from LG's Always Ready and Gallery apps;
  the second filter (image paths removed) printed nothing. So either Live TV's calls don't go over the bus in a form `ls-monitor` shows,
  or the filter is wrong. Unknown which.

- **Step 1 result (2026-10-17): `ls-monitor` works and found the guide data.** With Live TV in front, `com.webos.service.legacy-broadcast`
  (shown truncated as `legacy-broadcas.db`) writes programmes into `com.webos.epgdb` with `//put` and removes old ones with `//del`.
  Kind: `com.webos.service.legacybroadcast.programSCH:4`. Each programme has `programName`, `description`, `genre`, `startTime`/`endTime`
  (UTC) and `localStartTime`/`localEndTime` as `"2026,10,17,16,40,00"`, `duration` in seconds, `isAD`, `isSubtitle`, CRIDs, and
  `signalChannelId` like `"16522_18176_9018"`. Guess: that is service id, transport stream id, original network id (9018 is the UK
  Freeview network id). Programme rows do not carry the channel name or number, so the channel list is still to find, probably another
  kind in `epgdb` or a method on `legacy-broadcast`.
- **Step 1b (2026-10-17): reading `epgdb` as root works.** `luna-send -n 1 -f luna://com.webos.epgdb/find
  '{"query":{"from":"com.webos.service.legacybroadcast.programSCH:4","limit":1}}'` returns a programme. The capture has only two guide
  kinds, `programSCH:4` (schedule, about 11,900 writes) and `programPF:4` (present/following, about 290). No channel kind went into
  `epgdb`. Busiest TV services in the capture: `legacybroadcast.program`, `utp.broadcast`, `app.livetv`, `tvrmclient.tv`,
  `legacybroadcast.broadcast`. The channel list most likely comes from `utp.broadcast` or `legacybroadcast.broadcast`. Next: list the
  methods Live TV calls on those two, and look for `channelName`/`channelNumber` in any reply.
- **Step 1c (2026-10-17): channel names found on the bus.** Methods seen: `utp.broadcast` calls `legacybroadcast.broadcast` with
  `getCurrentChannel`, `changeChannel`, `getChannelState`, `getBroadcastComponentList`, `setBroadcastComponent`, and calls a separate
  service `com.webos.service.legacybroadcast.channel` (only `/ci/getSasMessage` seen in this capture). Replies carry
  `channelName` ("BBC ONE Yks HD", "BBC TWO HD", "ITV1 HD", "Channel 4 HD"), `channelNumber` ("101"...) and two channel id forms:
  `"1_41_101_101_16522_17546_9018"` (guess: type, ?, major, minor, service id, transport stream id, network id) and the short
  `"16522_17546_9018"` that matches the guide's `signalChannelId`. Only the channels flipped to appear, so this is the current-channel
  reply, not a list. Next: try `getChannelList` on `legacybroadcast.channel`, `utp.broadcast` and `legacybroadcast.broadcast`, and
  capture the `changeChannel` payload for tuning from Lumen.
- **Step 1d (2026-10-17):** `getChannelList` is `Unknown method` on all three (`legacybroadcast.channel`, `utp.broadcast`,
  `legacybroadcast.broadcast`). Next: ask each service for its method list (luna-service2 introspection, and the api-permissions
  files). The `changeChannel` grep printed nothing, probably because `[^»]` breaks on the multibyte `«` in busybox grep; use a plain
  grep with `cut` instead.
- **Step 1e (2026-10-17): method list for `com.webos.service.legacybroadcast.channel`** (introspection `{"type":"flat"}` on
  `/com/palm/luna/private/introspection`, first 40 shown). Read-only candidates for the list: `getPrimaryChannelList`,
  `getChannelZappingList`, `getChannelGroup`, `getChannel`, `getCurrentChannelId`, `getLastChannelId`, `getChannelGroupList`,
  `getChannelTypeList`, `getChannelModeList`, `getDirectTuneChannel`. **Never call** the writing ones: `clearChannelMap`, `deleteChannel`,
  `saveChannelList`, `updateChannelMap`, `revertChannelMap`, `importChannelMap`, `moveChannel`, `setChannel*`, `changeChannelNumber`,
  `changeChannelType`, `sortAnalogChannelList`, `*ForAstra`; they can wipe or reorder the tuned channels.
  Tuning: Live TV calls `luna://com.webos.service.utp.broadcast/changeChannelUp`; `utp.broadcast` then calls
  `legacybroadcast.broadcast/changeChannel` with `{"broadcastId":..., "channelId":"1_41_102_102_16522_17472_9018",
  "currentChannelId":..., "sessionId":8}`. The broadcastId and sessionId belong to Live TV's own session, so from Lumen the likely
  route is launching `com.webos.app.livetv` with a channel id (still a guess).
- **Step 1f (2026-10-17)**, each with `'{}'`: `getPrimaryChannelList` → `ERROR_06 invalid param(channelId)` (probably the related
  channels of one channel, not a list); `getChannelZappingList` → `Message status unknown` plus a cancel error (no reply in time, or it
  wants parameters); `getChannelGroup` → `{"channelGroupId":0,"channelGroupName":"All"}` (the current group). Next: list every `get*`
  method and category (the first introspection was cut at 40 lines), and retry `getChannelZappingList` with a group and a channel id.
- **Step 1g (2026-10-17):** categories `/`, `/oipfdrmagent`, `/ci`, `/scan`. Full `get*` list saved on the TV in `/tmp/intro.txt`.
  List-shaped ones worth trying: `getChannelZappingList`, `getChannelZappingListCount`, `getSortedList`,
  `getChannelListToSolveConflictLcnForLiveTV`, `getLogoImage` (for tiles later). `getChannelZappingList` gives
  `Message status unknown` with `{"channelGroupId":0}`, `{"channelGroupName":"All"}` and a channel id too. Guess: `-n 1` stops luna-send
  at a first status message before the real reply. Next: try the count and `getSortedList`, and the zapping list without `-n 1` for 5 s.
  If that fails, capture with `ls-monitor` while opening Live TV's own channel list (the list button), to copy its exact call.
- **Step 1h (2026-10-17): `getChannelZappingListCount '{}'` → `{"channelListCount": 330}`.** The aerial list is there. `getSortedList` →
  `not handled`. luna-send refuses to run without `-n` or `-i`, so the 5 s test did not run. Next: `-i` with a timeout, then paging
  parameters in case the 330-channel reply is too big for one message.
- **Step 1i (2026-10-17):** `getChannelZappingList` with `-i` gives no reply at all in 5 s; with `{"startIndex":0,"count":5}` and
  `{"startIndex":1,"endIndex":5}` the same `Message status unknown`. Stop guessing parameters. Next: `ls-monitor` while opening Live TV's
  channel list and the Guide, then copy the exact call (and see whether the reply comes back on the bus at all).
- **Step 1j (2026-10-17): found the real call.** There is no separate Guide app (`listApps` has `livetv`, `channeledit`,
  `channelsetting`, `lgchannels`, ...; `com.webos.exampleapp.*.epg` are LG sample apps, not the Guide). Launching
  `com.webos.app.channeledit` over SSH (`applicationManager/launch`) with `ls-monitor` running showed it asks **`iepg`** after all, so the
  "iepg is internet channels only" guess was wrong. It just needs `channelMode`:
  `luna://com.webos.service.iepg/getChannelList {"dataType":0,"sort":0,"channelMode":"Terrestrial","attribute":[{"filterType":"Invisible","value":false}],"requestField":["channelId"]}`
  (also with `"Cable"`, `"Satellite"` and `["IP"]`), then `iepg/getChannelInfo {"dataType":0,"channelId":"1_41_104_104_16522_17664_9018"}`.
  It also calls `com.webos.service.utp.channel` `getChannelModeList '{}'` and `getChannelTypeList {"channelModeId":0..2}`.
  Next: the same `getChannelList` without `requestField`, to see which fields come back per channel.
- **Step 1k (2026-10-17): the aerial list works as root.** `luna-send -n 1 -f luna://com.webos.service.iepg/getChannelList
  '{"dataType":0,"sort":0,"channelMode":"Terrestrial","attribute":[{"filterType":"Invisible","value":false}]}'` → `channelListCount: 188`.
  Fields per channel include `channelNumber` ("1"), `channelId` ("1_41_1_101_16522_17546_9018": type, physical 41, major 1, minor 101,
  then the signal id), `signalChannelId` ("16522_17546_9018", the join key to the guide's programmes), `majorNumber`, `minorNumber`,
  `physicalNumber`, `HDTV`, `DTV`, `Radio`, `Data`, `ATV`, `skipped`, `PrimaryCh`, `payChan`, `adultFlag`, `isFreeviewPlay`,
  `groupIdList`, `favoriteIdxA..`, `playerService: "com.webos.service.legacybroadcast"`. Lumen can make this call through
  `app/src/lib/root.ts` (Homebrew Channel exec). Next: confirm the name and logo fields, then try tuning to a channel from SSH.
  Spike answer so far: **yes, the channel list and the guide are both readable.**
- **Step 1l (2026-10-17): names confirmed.** `channelName` on all 188 ("BBC ONE Yks HD" on 1, "BBC TWO HD" 2, "ITV1" 3, "Channel 4" 4,
  "5" 5, ...), plus `channelNameSortKey`. Logo candidates: `imgUrl` and `channelLogoSize` on every channel, `channelLogoServerUrl` once
  (LG's logo server, seen in Step 0). Next: look at `imgUrl` values, then tuning.
- **Step 1m (2026-10-17): logos are cached files on the TV.** `imgUrl` is a path like `/tmp/gibbips/logo/s210a81942c909451daf38c567c71af39`
  (no extension), `channelLogoSize` like `"H133x100"` or `"H356x200"` (empty for channel 1). Being in `/tmp`, they are probably
  fetched again after each boot (from `channelLogoServerUrl`, LG's `gftsDownload.lge` server), so Lumen should copy them (as root) or
  read them through the root exec rather than keep the paths. Next: check the files exist and what format they are.
- **Step 1n (2026-10-17): logos are PNGs.** 176 files in `/tmp/gibbips/logo` (for 188 channels, so a few have none), about 2 to 3 KB
  each, PNG signature. Lumen can read them as base64 through the root exec and cache them. Next: tuning, by launching
  `com.webos.app.livetv` with `{"params":{"channelId":...}}` (a guess).
- **Step 1o (2026-10-17): tuning not solved.** `luna-send -n 1 luna://com.webos.applicationManager/launch
  '{"id":"com.webos.app.livetv","params":{"channelId":"1_41_2_102_16522_17472_9018"}}'` returned `returnValue: true` but the channel did
  **not** change (Live TV was already in front). Next: the same launch with something else in front, so Live TV starts fresh and reads
  the parameter; if not, capture Live TV's own call when a channel number is typed on the remote.
- **Step 1p (2026-10-17):** same launch with Home in front: Live TV opened, but on the channel it was already on (BBC One), so the
  `channelId` launch parameter is ignored. Next: `ls-monitor` while typing a channel number on the remote, to copy Live TV's call.
- **Step 1q (2026-10-17):** typing 2 on the remote: `com.webos.app.livetv` calls `luna://com.webos.service.utp.broadcast/changeChannel`
  (multi-line payload, not seen in full yet), then `utp.broadcast` calls `legacybroadcast.broadcast/changeChannel` with
  `{"broadcastId":"bE439...","channelId":"1_41_2_102_16522_17472_9018","currentChannelId":"1_41_1_101_...","sessionId":5}`.
  Also seen: the HbbTV plugin calls `iepg/getChannelList {"channelGroup":["All"],"channelMode":["Tuner"],"dataType":0,"sort":0}`
  (another working form), and `nlpmanager` calls `iepg/getEventInfo {"channelMode":["Tuner","IP"],"programId":"bbc_two_hd_1/2026-10-1717:05","dataType":0}`.
  Next: print Live TV's full `changeChannel` payload.
- **Step 1r (2026-10-17): Live TV's tune call in full:** `luna://com.webos.service.utp.broadcast/changeChannel`
  `{"broadcastId":"00000001-559c-d46a-2902-723da034b853","channelId":"1_41_2_102_16522_17472_9018","connection_timeout":500,"fallback":true,"ignorable":false}`.
  The `broadcastId` is Live TV's own broadcast session, so another caller needs the current one. Next: send the same call as root with
  that id while Live TV is open, and list `utp.broadcast` methods that could return the current broadcast id.
- **Step 1s (2026-10-17): tuning works as root.** With Live TV open, `luna-send -n 1 luna://com.webos.service.utp.broadcast/changeChannel
  '{"broadcastId":"00000001-559c-d46a-2902-723da034b853","channelId":"1_41_2_102_16522_17472_9018","connection_timeout":500,"fallback":true,"ignorable":false}'`
  → `{"reason":"changeChannel","returnValue":true,"nextChannelId":"1_41_2_..."}` and the TV switched to BBC Two (seen on the TV).
  The broadcast id captured earlier was still accepted, even though `/tmp/ch.txt` had gone in between (a restart, or `/tmp` cleared).
  Guess: the id is fixed per tuner (`00000001-...`), not per Live TV session. `getCurrentChannel` and `getBroadcastState` with `'{}'` →
  `-106 No resource` (they probably want the broadcast id). `utp.broadcast` `get*` methods: getBroadcastState, getChannelChangeResult,
  getChannelChangeStatus, getChannelState, getCurrentChannel, getPlayState, getSignalStatus, getVideoInfo and others.
  Next: confirm the id survives Live TV closing and opening (launch Live TV over SSH, then change channel).
- **Step 1t (2026-10-17):** from Home, launch Live TV over SSH, wait 5 s, `changeChannel` to Channel 4 HD with the same broadcast id:
  Live TV opened on the last channel (BBC Two) and did not switch. `changeChannel` and `getCurrentChannel` both answered
  `-106 No resource: 00000001-559c-...`, so **the broadcast id is per Live TV session**: it changes when Live TV restarts (the Step 1s
  guess that it is fixed was wrong). Tuning this way needs the current id, which nothing found so far returns.
  Lead: Home Assistant's LG webOS integration changes channel by name with Live TV closed. It talks SSAP (the websocket API on port
  3000/3001): `ssap://tv/getChannelList`, then `ssap://tv/openChannel {"channelId":...}` (from aiowebostv; my understanding, not checked
  against its source this session). Next: `ls-monitor` while Home Assistant changes channel, to see which luna call the SSAP gateway
  makes. That call, made as root, is likely the one Lumen should use.

## Answer

| What | Call | Notes |
|---|---|---|
| Channel list | `iepg/getChannelList {"dataType":0,"sort":0,"channelMode":"Terrestrial","attribute":[{"filterType":"Invisible","value":false}]}` | Root. 188 channels. `channelNumber`, `channelName`, `channelId`, `signalChannelId`, `imgUrl`, `Radio`, `HDTV`, `skipped`. |
| Logos | read the file at `imgUrl` | Root. PNG, 2 to 3 KB, under `/tmp/gibbips/logo`, so cache them. 176 of 188 have one. |
| Guide | `epgdb/find {"query":{"from":"com.webos.service.legacybroadcast.programSCH:4", ...}}` | Root. Join on `signalChannelId`. `programPF:4` holds now and next. Filled while Live TV runs, so it may be thin if Live TV has not been opened lately (untested). |
| Tune | `utp.broadcast/changeChannel {"broadcastId":...,"channelId":...,"connection_timeout":500,"fallback":true,"ignorable":false}` | Root, Live TV open. Worked (Step 1s). Launching Live TV with `{"channelId":...}` does not tune (Step 1o). The broadcast id changes each time Live TV starts (Step 1t). |

Still unknown: how to get Live TV's current broadcast id (or a tune call that needs none); whether the guide data stays filled when Live TV hasn't been used for a while, and the `epgdb` query syntax for one
channel and a time window (db8 `where` on `signalChannelId` and `startTime` needs an index on those fields; check `getProfile` or try it).

## Plan (do in order, stop when one works)

1. **Check `ls-monitor` sees anything at all.** Save the raw output and look at it unfiltered:
   ```
   timeout 20 ls-monitor > /tmp/lsmon.txt 2>&1; wc -l /tmp/lsmon.txt; grep -ciE 'channel' /tmp/lsmon.txt; head -40 /tmp/lsmon.txt
   ```
   Change channel during the 20 seconds with Live TV in front. If it shows traffic, grep `/tmp/lsmon.txt` for the service names next to
   the channel change.
2. **Find which service declares a channel list method.** The bus permission files list every method:
   ```
   grep -rlE 'getChannelList|getCurrentChannel|channelList' /usr/share/luna-service2/ /etc/luna-service2/ 2>/dev/null
   grep -rhoE '"[A-Za-z0-9./_-]*(getChannelList|getCurrentChannel)[A-Za-z0-9_]*"' /usr/share/luna-service2/ 2>/dev/null | sort -u
   ```
   Any service other than `iepg` that turns up here is the next candidate. Try it with `'{}'` first, then with a group from the list above.
3. **Query `epgdb` directly.** Find its kind names, then `find` with a small limit:
   ```
   grep -rlis epg /etc/palm/db/kinds /etc/palm/db_kinds /usr/palm/db/kinds 2>/dev/null
   luna-send -n 1 -f luna://com.webos.epgdb/find '{"query":{"from":"<kind name>","limit":3}}'
   ```
4. **Fall back to LG's second-screen API (SSAP).** This is what phone remote apps use, and community libraries (lgtv2, aiowebostv) call
   `ssap://tv/getChannelList`, `ssap://tv/getCurrentChannel` and `ssap://tv/getChannelProgramInfo` over the websocket on port 3000 (3001
   for TLS). It needs a one-off pairing prompt on the TV, but no root, so Lumen could call it itself. Untested on webOS 25.
5. **Write down the answer** in `docs/spikes.md`: which call works, the fields per channel (number, name, id, logo), and how to tune to
   one from Lumen (launching Live TV with a channel id is a guess until tried). Then tick the Live TV spike in PLAN.md.

If none of these returns the aerial channels, the Freeview tiles idea goes to Not doing in PLAN.md, with the reason.
