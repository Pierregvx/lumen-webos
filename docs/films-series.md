# Films & series: Jellyfin and Seerr in Lumen

Lumen shows what you are watching in Jellyfin on the home screen, opens your library on a screen of its own, and finds and requests
titles you do not have through Seerr. Playback stays in the Jellyfin app. Built for an LG TV on webOS 24 (Developer Mode,
not rooted); the design is `docs/plans/films-series.md`, the build plan `docs/plans/films-series-build.md`, the findings behind it
`docs/research/films-series-spikes.md`.

## Set up

Settings > Films & series:

1. **Jellyfin address**: the server as you would open it in a browser at home, scheme, host and port, no path (`http://` is added when left
   out), for example `192.168.1.10:8096`. A Tailscale address only works if the TV can reach it.
2. **Sign in with Quick Connect**: the row shows a 6-digit code. In Jellyfin on a phone, open your avatar > Quick Connect and type it.
   Lumen checks every 2 s for 3 minutes, then is signed in. The server must have Quick Connect on (Dashboard > General).
   Or: **user name**, **password**, **Sign in**. The password is only sent to the server; Lumen keeps the token Jellyfin gives back.
3. **Seerr address** (`192.168.1.10:5055`) and **Seerr API key** (Seerr: Settings > General > API Key, copied whole, `==` included),
   then **Test Seerr**.

The first sign-in puts the Films & series tile first on the home screen. **Sign out of Jellyfin** forgets the token; the tile and the
Resume row go until you sign in again. Everything is kept in the app's `localStorage` (`jellyfin-server`, `seerr-server`), so a
reinstall of a different app id starts again.

Settings > Home Screen > **Plugged-in inputs** (on by default) adds a tile at the end of the apps for each input with something plugged
in, named as in the TV's input settings.

## Home screen

**Resume** is a titled row under the apps: films and episodes in progress, then the next episode of each series being watched, most recent
first, one per series (Jellyfin `UserItems/Resume` and `Shows/NextUp`). After them come the titles you requested in Seerr that are not in
the library yet, with Requested or the download's percentage. OK on a title starts it in Jellyfin where you left it. While the focus is on the row, the focused title's picture fades in over the wallpaper, under the same shade as
the Films & series screen, 250 ms after the focus stops (a picture, no live blur). The row is read after
the first frame and each time Lumen comes back to the front; a server that does not answer keeps the last row; a refused token (401)
signs Lumen out and the row goes.

## The Films & series screen

Three tabs (Library, Discover, Search; Discover only with Seerr set up). The focused title fills the screen behind the rows a moment after
the focus stops, with its year, length, genres, rating and summary, and its buttons.

- **Library**: Recently added, Films, Series, then the six best-filled genres. OK plays.
- **Discover**: Seerr's trending, popular and upcoming films. Badges: Available (in the library: OK plays it), Requested, a percentage while
  it downloads. OK on a title that is not in the library requests it; a series opens a panel: All seasons, or tick seasons and Request.
- **Search**: OK on the field brings up the TV's keyboard (or speak into the remote). Results from both servers in one row, 400 ms after the
  last key; a title in the library shows once, as yours.

Up from the first row reaches the buttons (Play or Resume, Request, Trailer), Up again the tabs. Back returns home.

**Trailer** opens the YouTube app on the video (`youtube.leanback.v4` with `contentTarget: "v=<id>"`), from Jellyfin's `RemoteTrailers` or
Seerr's TMDB videos.

## For you: picks by Claude

With a **Claude API key** and a **Taste profile** in Settings > Films & series, Discover opens on a **For you** row: about ten titles
Claude picks for the day, each with one line on why (shown in gold under the title's details). `lib/recos.ts` sends Claude the profile,
the 60 titles last watched in Jellyfin, and up to 160 candidates from Seerr (trending, popular films and series, and TMDB's look-alikes of
the six titles last watched) that are neither in the library nor requested; Claude may only pick from that list, so every pick can be
requested. One request a day (Claude Opus 5.5, effort medium, structured output checked with zod, server-side fallback on), about 15 s,
kept in `localStorage` (`recos-v1`); **Pick again today** forgets it. The key is called straight from the TV with the Anthropic SDK
(`dangerouslyAllowBrowser`); it is the user's own and only sent to Anthropic. The SDK and zod add about 460 KB to `app.js`; measured on
the owner's TV, the page's script is ready about 35 ms later than without them (165 ms against 130 ms, warm reloads). The owner chose to keep the SDK (2026-10-29); a plain `fetch` to `/v1/messages` would remove that cost if it ever matters.

## New seasons and ratings

**New seasons**: once a day, Lumen looks at the series followed (at least one episode watched in Jellyfin, the 25 most recent) and asks
Seerr for their seasons. A season that started airing in the last 180 days, comes after every season in the library, and is neither in
the library nor requested leads the Resume row with a **New season** badge; OK requests that season. An old season simply missing is not
shown. Settings > Films & series > **Request new seasons** (off by default) requests them straight away instead. `lib/seasons.ts`, cached
as `seasons-v1`.

**Ratings**: each time Lumen comes back to the front, it looks for a film finished, or a series whose episodes are now all watched, since
the last look (the first look only starts the clock, so nothing older is asked about). A panel asks "You finished X": Left/Right pick 1 to
10, OK keeps it, Back skips (not asked again). Ratings go to Claude with the taste profile, ahead of it. `lib/ratings.ts`, kept as
`ratings-v1`.

Settings > Films & series > **For you row** turns Claude's row off (Claude is then not asked).

## The player

Titles play in Lumen's own player (`screens/Player.tsx`, design `docs/plans/player.md`), over the screen that started them: Back returns
to the same tab, row and tile. The TV plays every file in the library straight from Jellyfin's static stream, with no transcoding; the
picture is on the TV's video plane behind the page, so the page goes transparent while it plays (`html.playing`, `theme/player.css`) and
the video wallpaper pauses.

- **Bar**: any key shows title, episode, progress, time, **Pause**, **Subtitles**, **Next episode**; it hides 4 s after the last key.
- **Keys**: Left/Right jump 10 s (held 30 s), added up in a pill and applied 400 ms after the last press; OK pauses; Down reaches the
  buttons; Back leaves. The remote's play, pause, fast-forward and rewind keys work too.
- **Subtitles** (`lib/playerLogic.ts`): English on anything not in French (an unknown audio language counts as not French), none on
  French; a choice made with the button sticks for the series (`player-subs`). Jellyfin's WebVTT, drawn by Lumen over the picture.
- **Next episode**: a card from the start of the end credits when Jellyfin has an Outro segment (next episode 8 s later), else 15 s
  before the end (next at the end). Play now, Cancel or Back. After 3 episodes in a row with no key pressed it asks "Still there?".
- **Jellyfin keeps the place**: start, progress every 10 s, pauses, jumps and stop are reported (`/Sessions/Playing…`), as a "Lumen"
  session.
- **Fallback**: a stream that errors, or does not start within 10 s, closes the player and opens the Jellyfin app on the title, as below.
  Settings > Films & series > **Play in** chooses Lumen (default) or the Jellyfin app for every title.

## How a title starts in Jellyfin

The Jellyfin app (`org.jellyfin.webos`) reads no launch parameters, so Lumen opens it and asks the server to play the title on the app's
own session (`POST /Sessions/{id}/Playing?playCommand=PlayNow`). Only the session whose client is "Jellyfin for WebOS" obeys; the "Jellyfin
Web" session inside the app ignores play commands.

This runs in **Lumen's media service** (`app/service/media.js`, a webOS JS service packaged with the app as `<app id>.media` by
`app/scripts/package.sh`), not in the page: once Jellyfin is in front the TV stops Lumen's timers, and a command sent while Jellyfin is
still loading is dropped. The service finds the session, stops whatever is playing and waits until the server reports nothing playing, plus 1.5 s (a title replaced while playing, or
sent 1.2 s after a stop, keeps its sound and loses its picture), sends the command at once to the app's session (the app keeps the same one from launch to launch) and again until the server reports the title playing (8 tries, 2 s apart), and if it never does, shows
"Lumen could not start it: pick it here" inside Jellyfin. For checking from DevTools: `luna://<app id>.media/status` gives the last outcome.

## Seerr without CORS

Seerr sends no CORS headers, but the TV does not check them for an installed app (`file://`), so the page calls Seerr with `fetch` and the
`x-api-key` header. Requests are made with that key, so as Seerr's admin. If a firmware ever starts checking CORS, the media service can
relay Seerr too (it ran in Developer Mode during the spike).
