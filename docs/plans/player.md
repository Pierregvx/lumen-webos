# Le lecteur dans Lumen

Conception écrite le 2026-10-29 avec l'utilisateur. Statut : validée par l'utilisateur le 2026-10-29, construite sur `feat/films-series` (voir `docs/films-series.md`, « The player »). Suite de `docs/plans/films-series.md`
(Films & séries) ; le fonctionnement actuel est dans `docs/films-series.md`, les essais dans `docs/research/films-series-spikes.md`.

## Pourquoi

Aujourd'hui, OK sur un titre ouvre l'app Jellyfin puis lui demande de lire le titre (`app/service/media.js`). C'est lent (l'app se
charge, se connecte, puis reçoit la commande), et fragile : un titre qui en remplace un autre peut perdre l'image. L'utilisateur veut que le titre
démarre tout de suite, dans Lumen.

## Quelle TV

La TV de l'utilisateur (LG, webOS 24, Developer Mode, sans root). C'est l'utilisateur qui juge chaque réglage, en direct sur sa TV
(`ares-inspect`, pas `deploy:home`). La TV de Sam (webOS 25) n'est pas dans ce projet : rien n'y a été vérifié.

## Ce que l'utilisateur fait pendant la lecture (ses mots)

« Lecture, ± k secondes, épisodes suivants, sous-titres. » Toujours en VO avec sous-titres anglais ; pour un titre en français, pas de
sous-titres. À la fin d'un épisode : un compte à rebours vers le suivant, qu'on peut annuler.

## Ce qui est vérifié sur la TV (2026-10-29)

- La TV lit **toute la bibliothèque** en direct, sans conversion par le serveur : MP4 et MKV, HEVC (Main, Main 10), H.264, AV1, SDR, HDR10,
  Dolby Vision, 1080p et 4K ; son AAC, E-AC-3, AC-3, TrueHD (entendu par l'utilisateur), DTS. Flux : `/Videos/{id}/stream?static=true&mediaSourceId={id}&api_key={token}`.
- `canPlayType` répond '' pour le MKV, le TrueHD et le DTS alors qu'ils passent : ne pas s'en servir pour décider.
- L'image est sur le plan vidéo de la TV, **derrière** la page : il faut rendre transparents `html`, `body`, `#wpimage` et `#root` pendant
  la lecture (comme `html.wp-video` pour le fond vidéo), sinon on entend sans rien voir.
- Avancer avec `currentTime` marche. Sous-titres : tous en texte (SubRip), anglais sur 63 fichiers sur 73.

## Objectifs

1. **Lancer** : tout ce qui lance un titre aujourd'hui (rangée Reprendre, écran Films & séries, « Dispo » dans Découvrir) le lance dans le
   lecteur de Lumen, à l'endroit où l'utilisateur s'était arrêté. Une série lance son épisode en cours, sinon le suivant (comme aujourd'hui).
2. **Pendant la lecture**, rien à l'écran (maquette 1 du 2026-10-29, `player.html`). Une touche fait apparaître un bandeau en bas, qui
   disparaît après 4 s : titre, épisode, barre de progression, temps écoulé et restant, boutons **Pause**, **Sous-titres**, **Épisode suivant**
   (ce dernier seulement pour une série qui a un épisode après).
3. **Télécommande** : Gauche / Droite = −10 s / +10 s (appuis cumulés, « +20 s »… dans une pastille au centre ; maintenu, ça accélère) ;
   OK = pause / lecture ; Bas = va sur les boutons du bandeau ; Retour = quitter et revenir là où on était dans Lumen. Les touches lecture,
   pause, avance et retour rapides de la télécommande font la même chose.
4. **Sous-titres automatiques** : si la langue audio par défaut du fichier n'est pas le français, les sous-titres anglais s'affichent
   (s'il y en a) ; si elle est française, aucun. Le bouton Sous-titres permet de les couper ou de prendre une autre langue disponible.
5. **Fin d'épisode** : pendant le générique de fin, une carte en bas à droite « Épisode suivant dans 8 s » avec l'épisode, **Lire maintenant**
   et **Annuler**. Annuler (ou Retour) laisse finir puis revient dans Lumen. Fin d'un film ou de la dernière saison : retour dans Lumen.
6. **Jellyfin suit** : la lecture est déclarée au serveur (début, progression régulière, pause, fin), pour que « Reprendre », « vu »,
   Jellyfin sur d'autres appareils, les notes et les nouvelles saisons de Lumen restent justes.

## Non-objectifs

- Pas de choix de piste audio (la piste par défaut du fichier, la VO chez l'utilisateur).
- Pas de conversion côté serveur dans cette version (tout passe en direct) ; pas de sous-titres en image (il n'y en a pas).
- Pas de lecture dans Lumen pour les bandes-annonces (YouTube, comme aujourd'hui).
- Pas de saut d'intro.

## Anti-objectifs

- Un démarrage plus lent qu'aujourd'hui.
- Du son sans image, ou une image figée sans que l'écran le dise.
- Un retour dans Lumen qui perd la position où on était (rangée, écran, onglet).
- Une progression non enregistrée : quitter puis revenir doit reprendre au bon endroit.

## Contraintes

- Toutes les règles de `CLAUDE.md` : cible `chrome79`, animer seulement `transform` et `opacity`, tokens dans `theme/tokens.css`,
  `<part>--focused`, DevTools d'abord (le bandeau et la carte se règlent en direct).
- Sans root (Developer Mode) ; doit continuer de marcher avec root.
- Le fond d'écran vidéo de Lumen, s'il tourne, est arrêté pendant la lecture (un seul décodeur matériel à prévoir) et repris après.

## Choix faits (par Claude, à revoir si besoin)

- **Repli** : si la vidéo renvoie une erreur ou ne démarre pas en 10 s, Lumen passe par l'app Jellyfin comme aujourd'hui (le service
  `media.js` reste) et le dit en une ligne. Un réglage « Lire dans : Lumen / l'app Jellyfin » (Lumen par défaut) garde l'ancien chemin.
- **Déclaration au serveur** : `POST /Sessions/Playing` au début, `/Sessions/Playing/Progress` toutes les 10 s et à chaque pause ou saut,
  `/Sessions/Playing/Stopped` en quittant ou à la fin (avec la position). `PlayMethod: DirectPlay`.
- **Sous-titres** : le fichier WebVTT de Jellyfin (`/Videos/{id}/{mediaSourceId}/Subtitles/{index}/0/Stream.vtt`), affiché par Lumen
  lui-même dans la page (au-dessus du plan vidéo), pas par `<track>`.
- **Épisode suivant** : l'épisode qui suit dans la série (`/Shows/{seriesId}/Episodes`, après celui-ci) ; la carte apparaît au début des
  crédits de fin si Jellyfin les connaît (marqueurs de chapitres), sinon 30 s avant la fin.
- **Où** : un nouvel écran `'player'` dans `app.tsx`, comme `'media'` ; `lib/player.ts` pour le flux, les sous-titres et la déclaration.

- **Choix de sous-titres qui reste** : un changement fait avec le bouton vaut pour toute la série (gardé par série dans `localStorage`),
  donc pour les épisodes suivants et les fois d'après. Langue audio inconnue (« und » ou absente) = pas du français : sous-titres anglais.
- **Compte à rebours** : quand Jellyfin connaît le début du générique de fin, la carte apparaît à ce moment et l'épisode suivant démarre
  8 s après (le générique est coupé, comme sur Netflix). Sinon, la carte apparaît 15 s avant la fin et l'épisode suivant démarre à la fin
  du fichier (rien n'est coupé). L'enchaînement passe d'une saison à la suivante. Après **3 épisodes d'affilée sans aucune touche**, Lumen
  s'arrête sur la carte et demande « Toujours là ? » au lieu d'enchaîner.

## Laissé au constructeur

- Le découpage des fichiers, les noms, les durées exactes (masquage du bandeau, accélération).
- L'apparence fine du bandeau, de la pastille et de la carte, dans le style de Lumen (à régler en direct avec l'utilisateur).
- Le comportement au retour de veille de la TV pendant une pause.
