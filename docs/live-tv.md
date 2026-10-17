# Live TV channel list: spike in progress

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
