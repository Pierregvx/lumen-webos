# Films & séries : essais sur la TV

Essais du plan `docs/plans/films-series-build.md` (tâches 1 et 2), sur la TV de l'utilisateur : LG, webOS 24, en Developer Mode, Lumen installée sous `com.samrenfrew.lumen.dev`. Serveur 192.168.1.10 : Jellyfin 12.2.0 (8096), Seerr 3.5.1
(5055).

## Seerr depuis la page (2026-10-29)

Seerr n'envoie aucun en-tête CORS et refuse le preflight (`OPTIONS` → 405), vu depuis le Mac. Sur la TV, la page (chargée en
`file:///media/developer/apps/usr/palm/applications/com.samrenfrew.lumen.dev/index.html`) n'est pas bloquée pour autant :

- `fetch('http://192.168.1.10:5055/api/v1/status')` → 200.
- Avec l'en-tête `x-api-key` (une fausse clé) sur `/api/v1/settings/main` → 403, la vraie réponse de Seerr.
- `POST /api/v1/request` avec `x-api-key` et `content-type: application/json` → 400, la vraie réponse de Seerr.

Le moteur de webOS ne fait donc pas de contrôle CORS pour une app installée depuis `file://`. Lumen peut appeler Seerr avec `fetch`, sans
service ni proxy. Jellyfin répond aussi (`/System/Info/Public` → 200).

Le service JS a aussi été essayé, au cas où : un service `com.samrenfrew.lumen.dev.media` packagé avec l'app (`ares-package dist <service>`)
s'installe et tourne en Developer Mode. Appelé par `PalmServiceBridge`, il a lu `/api/v1/status` en 151 ms. Node sur la TV : v16.20.2. Il
reste le repli si un firmware se met un jour à appliquer CORS.

Ces essais passent par l'inspecteur du Developer Mode : `npx ares-inspect -d lgtv --app com.samrenfrew.lumen.dev` (depuis `app/`) donne un
port local ; `LUMEN_CDP_PORT=<port> node tools/tv/cdp.mjs eval '…'` marche avec, mais ne rend pas la main : le borner avec
`perl -e 'alarm 25; exec @ARGV' node …`.

## Lancer un titre dans l'app Jellyfin (2026-10-29)

L'app Jellyfin de LG (`org.jellyfin.webos`, 12.2.0) ne lit aucun paramètre de lancement. Une fois ouverte et connectée, elle a **deux
sessions** sur le serveur, toutes deux `DeviceName: "LG Smart TV"` et `RemoteEndPoint` = l'IP de la TV :

- `Client: "Jellyfin Web"` : la page Jellyfin chargée dans l'app. Elle reçoit `POST /Sessions/{id}/Message` (le bandeau s'affiche), mais
  ignore `Playing?playCommand=PlayNow` et `Viewing` (rien ne bouge), même avec un jeton d'utilisateur. Elle annonce
  `SupportsMediaControl: true`, `SupportsRemoteControl: false`.
- `Client: "Jellyfin for WebOS"` : l'enveloppe webOS. `POST /Sessions/{id}/Playing?playCommand=PlayNow&itemIds=<id>&startPositionTicks=<t>`
  **lance la lecture**, à la bonne position (vu par l'utilisateur), avec un jeton d'utilisateur (obtenu par Quick Connect). La lecture est ensuite
  rapportée par la session « Jellyfin Web ». Non essayé avec une clé API seule.

Donc Lumen doit viser la session `Client === "Jellyfin for WebOS"` de la TV. Elle existe quelques secondes après le lancement de l'app.

Quick Connect marche (`POST /QuickConnect/Initiate` → un code à 6 chiffres à valider dans Jellyfin, puis
`POST /Users/AuthenticateWithQuickConnect` avec le `Secret` → `AccessToken`) : une connexion sans taper de mot de passe sur la TV.

La clé API seule (sans utilisateur) passe dans l'en-tête `Authorization: MediaBrowser …, Token="<clé>"`, pas dans `X-Emby-Token` (refusé
par ce serveur).

## Bande-annonce (2026-10-29)

`ares-launch youtube.leanback.v4 -p '{"contentTarget":"v=<id YouTube>"}'` ouvre YouTube directement sur la vidéo (vu par l'utilisateur). Les ids
viennent de `RemoteTrailers` dans Jellyfin (`Fields=RemoteTrailers`).

## A player inside Lumen (2026-10-29)

The test library (73 files): MP4 62, MKV 11; video HEVC Main 44 / Main 10 25, H.264 3, AV1 1; SDR 69, Dolby Vision 3, HDR10 1; 1080p
mostly, three 4K; audio AAC mostly, some E-AC-3, AC-3, TrueHD, DTS; subtitles all text (SubRip), English on 63 of them (42 external).

On the TV, a `<video>` in Lumen's page with Jellyfin's static stream (`/Videos/{id}/stream?static=true&mediaSourceId={id}&api_key=…`)
plays without any transcoding: an HEVC Main 10 MP4 (1080p), a 4K MKV in HEVC Dolby Vision with TrueHD and a 4K MKV in AV1
HDR10 with TrueHD. The TrueHD sound was heard. `canPlayType` says '' for `video/x-matroska`, `audio/x-truehd` and `audio/vnd.dts`
although they play: do not trust it to pick direct play.

The picture is on the TV's video plane **behind** the page, not drawn in it: with the page opaque the video plays (time moves, 3840 wide)
but nothing shows. It shows once `html`, `body`, `#wpimage` and `#root` are transparent or hidden over it (as the video wallpaper does
with `html.wp-video`). Seeking with `currentTime` works.
