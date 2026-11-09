# Films & series: Jellyfin and Seerr in Lumen

Lumen shows what you are watching in Jellyfin on the home screen, opens your library on a screen of its own, and finds and requests
titles you do not have through Seerr. Playback stays in the Jellyfin app. Built for an LG TV on webOS 24 (Developer Mode,
not rooted); the design is `docs/plans/films-series.md`, the build plan `docs/plans/films-series-build.md`, the findings behind it
`docs/research/films-series-spikes.md`.

## Set up

Settings > Films & series:

1. **Jellyfin address**: the server as you would open it in a browser at home, scheme, host and port, no path (`http://` is added when left
   out), for example `192.0.2.20:8096`. A Tailscale address only works if the TV can reach it.
2. **Sign in with Quick Connect**: the row shows a 6-digit code. In Jellyfin on a phone, open your avatar > Quick Connect and type it.
   Lumen checks every 2 s for 3 minutes, then is signed in. The server must have Quick Connect on (Dashboard > General).
   Or: **user name**, **password**, **Sign in**. The password is only sent to the server; Lumen keeps the token Jellyfin gives back.
3. **Seerr address** (`192.0.2.20:5055`) and **Seerr API key** (Seerr: Settings > General > API Key, copied whole, `==` included),
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

- **Library**: Recently added, Films, Series, then the six best-filled genres. OK twice plays (see the buttons below).
- **Discover**: Seerr's trending, popular and upcoming films. Badges: Available (in the library: Play plays it), Requested, a percentage
  while it downloads. Request on a title that is not in the library asks for it; a series opens a panel: All seasons, or tick seasons and
  Request.
- **Search**: OK on the field brings up the TV's keyboard (or speak into the remote). Results from both servers in one row, 400 ms after the
  last key; a title in the library shows once, as yours.

- **Platforms**: a row of logos in Discover, under its first row (Netflix, Apple TV, Prime Video, Disney+, HBO Max, Canal+, Paramount+, A24,
  NEON, Pixar, Studio Ghibli, Blumhouse; the same list as Ciné Pierro's, `PLATFORMS` in `lib/seerr.ts`). OK opens the platform's page: a
  service's own series and its films in France with at least 100 TMDB votes, or a studio's films that are out. Seerr is asked straight, as
  for Discover. Each logo's width follows the square root of its shape, so a square logo and a long one cover about the same area.
- **Categories**: after Seerr's lists, Discover has rows by genre, as Netflix and Canal+ do (Action films, Crime series, Comedies, Thrillers,
  Drama series, Science fiction, Sci-fi and fantasy series, Horror, Comedy series, Dramas, Romance, Animation, Animated series,
  Documentaries, Documentary series; `CATEGORIES` in `lib/seerr.ts`, the same as Ciné Pierro's). A platform's page has them too, under its
  series and films, limited to that platform; a row with fewer than 6 titles is left out.

OK on a poster, in any row, reaches its buttons (Play or Resume, Request, Trailer, Cast), with the first one focused, so OK twice plays or
requests. Up from the first row reaches them too. Back from the buttons returns to the row; Up from them reaches the tabs. Back from the rows
returns home.

**Cast** (a title Seerr knows, the library's too by its TMDB id) opens a row of its actors, with their photos (a title with no actors listed says so instead). OK on one opens their page:
their films and series, the best known first (TMDB's vote count), without talk shows, news or parts as themselves. A page of its own
(a platform's, a cast, an actor's) shows its name where the tabs are; Back closes it, back to where it was opened. A page with films and
series both has All, Films and Series there instead, which Left/Right switch as they do the tabs (an actor's name stays beside them); a
platform's page draws its logo above the title in focus, as Ciné Pierro does. The platforms are not the
first row of Discover because only the first row reaches the buttons.

**Trailer** opens the YouTube app on the video (`youtube.leanback.v4` with `contentTarget: "v=<id>"`), from Jellyfin's `RemoteTrailers` or
Seerr's TMDB videos.

## For you: picks by Claude

The picks are made on the NAS by **lumen-recos** (`server/` in the private cine-pierro repository, whose README says how to install and run it), not on the TV. With the
server's address in Settings > Films & series > **Picks server**, Discover opens on a **For you** row: about ten titles Claude picks for
the day, each with one line on why (shown in gold under the title's details). The server sends Claude the taste profile (`profile.txt`
on the NAS), the ratings from the TV, the 60 titles last watched in Jellyfin, and up to 160 candidates from Seerr (trending, popular films
and series, and TMDB's look-alikes of the six titles last watched) that are neither in the library nor requested; Claude may only pick
from that list, so every pick can be requested. Claude Opus 5.5, effort medium, structured output checked with zod, server-side fallback
on.

The server makes the day's picks from 5:00, so they are ready before Discover opens. `GET /picks` gives today's, or the last ones while
today's are made; each pick's availability is read from Seerr again, so one requested since shows as requested. The TV keeps the last
answer in `localStorage` (`recos-v1`) and draws it at once, then asks again only when it is not today's. **Pick again today** has the
server pick again now (`POST /refresh`). The Claude, Seerr and Jellyfin keys are in the server's `.env` on the NAS: the TV holds none of
them, and it forgets the Claude key and profile it kept before (`recos-settings`). Moving Claude off the TV also took the Anthropic SDK
and zod (about 460 KB) out of `app.js`.

## New seasons and ratings

**New seasons**: once a day, Lumen looks at the series followed (at least one episode watched in Jellyfin, the 25 most recent) and asks
Seerr for their seasons. A season that started airing in the last 180 days, comes after every season in the library, and is neither in
the library nor requested leads the Resume row with a **New season** badge; OK requests that season. An old season simply missing is not
shown. Settings > Films & series > **Request new seasons** (off by default) requests them straight away instead. `lib/seasons.ts`, cached
as `seasons-v1`.

**Ratings**: each time Lumen comes back to the front, it looks for a film finished, or a series whose episodes are now all watched, since
the last look (the first look only starts the clock, so nothing older is asked about). A panel asks "You finished X": Left/Right pick 1 to
10, OK keeps it, Back skips (not asked again). `lib/ratings.ts`, kept as `ratings-v1`. Every rating is sent to the picks server
(`POST /ratings`, the whole list), where Claude reads them with the taste profile, ahead of it.

Settings > Films & series > **For you row** turns Claude's row off (Claude is then not asked).

## The player

Titles play in Lumen's own player (`screens/Player.tsx`, design `docs/plans/player.md`), over the screen that started them: Back returns
to the same tab, row and tile. The TV plays every file in the library straight from Jellyfin's static stream, with no transcoding; the
picture is on the TV's video plane behind the page, so the page goes transparent while it plays (`html.playing`, `theme/player.css`) and
the video wallpaper pauses.

- **Bar**: any key shows title, episode, progress, time, **Pause**, **Subtitles**, **Episodes**, **Next episode**; it hides 4 s after the last key.
- **Episodes** (a series): the series' episodes over the picture, opened on the season and the episode playing. The seasons are pills
  (Up reaches them, Left/Right changes the season), then the season's episodes as cards along one row: the episode's own picture
  (its Primary, a still; the series' Thumb when it has none), a white bar for how far it was watched, "3. Its name", then "Playing ·
  42 min · Watched" (the separator only when something follows it). OK plays that episode from where it was left; Back closes the list.
  White is the focus there, so the episode playing is marked by its yellow label, not a ring. The bar, the subtitles and the next-episode
  card wait while the list is open. The list is read again for each episode, so what was just watched shows as watched.
- **Keys**: Left/Right jump 10 s (held 30 s), added up in a pill and applied 400 ms after the last press; OK pauses; Down reaches the
  buttons; Back leaves. The remote's play, pause, fast-forward and rewind keys work too.
- **Pointer** (the Magic Remote): moving it shows the bar, which stays up while the pointer is over it; hovering moves the focus
  (buttons, the next-episode card, the subtitle menu, the seasons and episodes); a click does what OK does there; a click on the
  progress line goes to that place; a click on the picture pauses or plays; the wheel scrolls the episode list a card per notch; a click
  beside the subtitle menu closes it. With the pointer showing, the TV may send a click and an OK for one press, so the two count once
  within 400 ms **(verify)**. Hovering only moves the focus: the episode row scrolls with the keys and the wheel, never under the pointer.
- **Subtitles** (`lib/playerLogic.ts`): English on anything not in French (an unknown audio language counts as not French), none on
  French; a choice made with the button sticks for the series (`player-subs`). Jellyfin's WebVTT, drawn by Lumen over the picture.
- **Next episode**: a card, with the episode's own picture, from the start of the end credits when Jellyfin has an Outro segment (next episode 8 s later), else 15 s
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
