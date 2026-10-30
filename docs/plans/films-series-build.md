# Films & séries : plan de construction

> **Pour les agents :** SOUS-SKILL REQUIS : superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans, tâche par
> tâche. Les étapes sont des cases à cocher (`- [ ]`).

**But :** ajouter à Lumen une rangée « Reprendre » (Jellyfin), des tuiles d'entrées HDMI et un écran « Films & séries » (Bibliothèque
Jellyfin, Découvrir, Rechercher et demandes Seerr).

**Architecture :** sur le modèle de la rangée Live TV et de l'écran Guide. Une rangée titrée sous le dock (`HomeRow` dans `app.tsx`) et un
nouvel écran (`Screen = … | 'media'`). Jellyfin est appelé depuis la page (CORS ouvert). Seerr passe par un service JS webOS embarqué dans
l'ipk ou, si l'essai échoue, par un proxy CORS sur le serveur. Un seul module (`lib/seerr.ts`) cache ce choix. La lecture lance l'app
Jellyfin puis lui envoie le titre via l'API de sessions de Jellyfin.

**Technique :** Preact + TypeScript, Vite (cible `chrome79`, script classique), service JS webOS (Node, module `webos-service`),
`ares-*` en Developer Mode.

**Spec :** `docs/plans/films-series.md` (validée par l'utilisateur le 2026-10-29). Lire aussi `CLAUDE.md` et `docs/plans/live-tv-build.md`.

## Contraintes globales

- Cible `chrome79`, script classique, pas de module (`app/vite.config.ts`) : pas de `?.` ni `??` dans le service non plus si Node est ancien.
- Animer seulement `transform` et `opacity`. Flou en direct seulement sur le contrôle focalisé.
- Jamais `tabular-nums` ni `'tnum'` (sauf l'horloge).
- Styles : nouveau fichier `app/src/theme/media.css`, importé dans `main.tsx` après `live-tv.css` ; valeurs en tokens dans `tokens.css`.
  Jamais de règle de surcharge plus bas.
- L'élément focalisé porte `<part>--focused` (`media-tab--focused`, `poster--focused`, `resume--focused`).
- Toute commande root passe par `lib/root.ts`. Ce projet n'en ajoute aucune.
- Sans réglages Jellyfin ni Seerr : aucune tuile, aucune rangée, aucun appel réseau. Doit marcher sans `app/private/`.
- Doit marcher en Developer Mode (TV <tv-ip>, appareil ares `lgtv`, id `com.samrenfrew.lumen.dev`) et après le root.
- Textes d'interface en anglais dans le code, traduits en français dans `lib/i18n.ts` (comme le reste).
- **DevTools d'abord, build en dernier** (`CLAUDE.md`). En Developer Mode : `npx ares-inspect -d lgtv --app com.samrenfrew.lumen.dev`
  donne l'adresse de l'inspecteur ; `tools/tv/cdp.mjs` s'y branche avec `LUMEN_CDP_PORT`. Installer : `npm run build:ipk` puis
  `npx ares-install -d lgtv build/com.samrenfrew.lumen.dev_*.ipk` (depuis `app/`).
- Pas de suite de tests dans le projet : la vérification d'une tâche est `npm --prefix app run build` (types + build), plus le contrôle
  écrit dans la tâche, fait dans la preview (`app-dist`, port 5198) ou sur la TV.
- Branche locale `feat/films-series`. **Ne jamais pousser.** Sujets de commit : `Films & séries: <ce qui change pour l'utilisateur>`.

## Points à surveiller en revue

1. **Serveur injoignable** (serveur éteint, TV hors réseau) : l'accueil s'affiche aussi vite qu'aujourd'hui, la rangée « Reprendre » est
   absente (pas vide), aucune erreur à l'écran. Chaque appel a un délai maximal (8 s) → tâches 3 et 6.
2. **Jeton Jellyfin refusé** (401, mot de passe changé) : la rangée disparaît, Réglages > Films & séries affiche « Non connecté » → tâche 3.
3. **Jellyfin ne prend pas la lecture** (session introuvable en 15 s, ou une autre lecture en cours) : message honnête « Ouvre-le dans
   Jellyfin », jamais de faux succès → tâche 5.
4. **Titre Seerr « Dispo » introuvable dans Jellyfin** (pas d'id TMDB correspondant) : OK ouvre Jellyfin avec le même message, pas de plantage
   → tâche 8.
5. **Données incomplètes** (pas d'image, titre très long, accents, série sans épisode à reprendre) : tuile couleur avec le titre en texte,
   titre coupé par une ellipse, rien de décalé → tâches 6 et 7.

---

### Tâche 1 : essai lecture (jetable, porte de décision)

**Fichiers :** Créer `docs/research/films-series-spikes.md` (résultats seulement).

- [ ] **Étape 1 :** depuis le Mac, `POST http://192.168.1.10:8096/Users/AuthenticateByName` avec l'en-tête
  `Authorization: MediaBrowser Client="Lumen", Device="LG TV", DeviceId="lumen-spike", Version="0.1"` et `{"Username","Pw"}` (demander à
  l'utilisateur). Noter `AccessToken` et `User.Id`. Vérifier les chemins réels sur `GET /api-docs/openapi.json` (serveur 12.2.0).
- [ ] **Étape 2 :** sur la TV, `npx ares-launch -d lgtv org.jellyfin.webos`. Toutes les secondes pendant 15 s, `GET /Sessions` : noter le
  `Client`, `DeviceName`, `DeviceId` de la session de la TV et si `SupportsRemoteControl` est vrai.
- [ ] **Étape 3 :** `POST /Sessions/{id}/Playing?playCommand=PlayNow&itemIds=<un film>&startPositionTicks=6000000000`. Attendu : le film
  démarre à 10 min. Recommencer avec Jellyfin déjà ouvert sur autre chose, puis juste après un lancement à froid.
- [ ] **Étape 4 :** essayer la bande-annonce : `npx ares-launch -d lgtv youtube.leanback.v4 '{"contentTarget":"v=<id>"}'`. Noter si la vidéo
  s'ouvre.
- [ ] **Étape 5 :** écrire les résultats dans le fichier de recherche (ce qui marche, délais, champs pour reconnaître la session). Si la
  lecture à distance échoue : la tâche 5 prend la branche « parcourir seulement » de la spec. Si YouTube ne s'ouvre pas sur la vidéo : pas
  de bouton Bande-annonce. Commit `docs/research/films-series-spikes.md: lecture à distance et bande-annonce sur webOS 24`.

### Tâche 2 : essai service Seerr (jetable, porte de décision)

**Fichiers :** dossier jetable `.scratch/seerr-spike/` (non commité). Résultats dans `docs/research/films-series-spikes.md`.

- [ ] **Étape 1 :** un service JS minimal `com.samrenfrew.lumen.dev.media` (`services.json`, `package.json` avec `"main"`, un fichier qui
  enregistre la méthode `get` via `webos-service` et fait un `http.get` vers `http://192.168.1.10:5055/api/v1/status`). Le packager avec
  l'app : `npx ares-package dist .scratch/seerr-spike/service -o build`. Installer et lancer.
- [ ] **Étape 2 :** dans l'inspecteur de la page, appeler `luna://com.samrenfrew.lumen.dev.media/get` avec `PalmServiceBridge`. Attendu :
  la réponse JSON de Seerr (`version: 3.5.1`). Noter la version de Node du service (`process.version`) et le délai du premier appel.
- [ ] **Étape 3 :** écrire le résultat. Si le service ne tourne pas : préparer pour l'utilisateur un `Caddyfile` (conteneur `caddy`) qui écoute
  sur 5056, relaie vers `seerr:5055` et ajoute `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Headers: x-api-key, content-type`,
  `Access-Control-Allow-Methods: GET, POST`, et répond 204 aux `OPTIONS`. **Le montrer à l'utilisateur ; c'est lui qui l'installe.** Commit des
  résultats.

### Tâche 3 : client Jellyfin

**Fichiers :** Créer `app/src/lib/jellyfin.ts`.

**Interfaces, produit :**
```ts
export interface JellyfinServer { url: string; userId: string; token: string; deviceId: string }
export interface MediaItem {
  id: string; type: 'Movie' | 'Series' | 'Episode'; title: string; subtitle?: string;  // « S2 E4 · Titre de l'épisode »
  year?: number; minutes?: number; genres: string[]; rating?: number; overview?: string;
  progress?: number;            // 0..1, pour Reprendre
  resumeTicks?: number; seriesId?: string; tmdbId?: string; trailerYoutubeId?: string;
}
export function cachedServer (): JellyfinServer | null;
export function signIn (url: string, user: string, password: string): Promise<JellyfinServer | string>;  // string = message d'erreur affichable
export function saveServer (s: JellyfinServer | null): void;
export function resume (s: JellyfinServer): Promise<MediaItem[]>;          // Reprendre + NextUp, triés par date de visionnage
export function latest (s: JellyfinServer): Promise<MediaItem[]>;
export function byType (s: JellyfinServer, type: 'Movie' | 'Series', genre?: string): Promise<MediaItem[]>;
export function genres (s: JellyfinServer): Promise<string[]>;
export function search (s: JellyfinServer, text: string): Promise<MediaItem[]>;
export function findByTmdb (s: JellyfinServer, tmdbId: string, type: 'Movie' | 'Series'): Promise<MediaItem | null>;
export function nextEpisode (s: JellyfinServer, seriesId: string): Promise<MediaItem | null>;
export function imageUrl (s: JellyfinServer, item: MediaItem, kind: 'Primary' | 'Backdrop' | 'Thumb', width: number): string;
```

- [ ] **Étape 1 :** écrire le module. `fetch` via `loggedFetch` avec un délai de 8 s. En-tête `Authorization: MediaBrowser Client="Lumen",
  Device="LG TV", DeviceId="<deviceId>", Version="<version appinfo>", Token="<token>"`. `deviceId` tiré au hasard une fois et gardé. Le
  serveur est gardé avec `readCache`/`writeCache` (`lib/boot.ts`), clé `jellyfin-server`. Le mot de passe n'est jamais gardé. Un 401 appelle
  `saveServer(null)`. Les images passent `maxWidth`/`fillWidth` et `quality=80`. Les chemins viennent de l'OpenAPI vue à la tâche 1.
- [ ] **Étape 2 :** vérifier. `npm --prefix app run build` passe. Dans la console de la preview, `signIn` puis `resume` et `latest` sur le
  serveur de l'utilisateur rendent des listes non vides avec des titres justes. Avec un faux jeton : `resume` échoue et `cachedServer()` vaut
  `null`. Avec une adresse injoignable : échec en 8 s au plus.
- [ ] **Étape 3 :** commit `Films & séries: Lumen sait lire ta bibliothèque Jellyfin`.

### Tâche 4 : client Seerr et son transport

**Fichiers :** Créer `app/src/lib/seerr.ts`. Si la tâche 2 a validé le service : créer `app/service/` (`services.json`, `package.json`,
`media.js`), modifier `app/scripts/package.sh` (packager `dist` et `service`, avec l'id du service réécrit en `<APP_ID>.media` comme
`vite.config.ts` réécrit l'id de l'app). Sinon : pas de service, `seerr.ts` appelle le proxy (`http://<hôte>:5056`) avec `fetch`.

**Interfaces, produit :**
```ts
export interface SeerrServer { url: string; key: string }
export type Availability = 'none' | 'requested' | 'downloading' | 'available';
export interface SeerrTitle {
  tmdbId: string; type: 'movie' | 'tv'; title: string; year?: number; overview?: string; rating?: number;
  posterUrl?: string; backdropUrl?: string;      // TMDB w342 et w1280
  availability: Availability; percent?: number;  // percent quand downloading
  seasons?: {number: number; availability: Availability}[];
  trailerYoutubeId?: string;
}
export function cachedSeerr (): SeerrServer | null;
export function testSeerr (s: SeerrServer): Promise<true | string>;
export function saveSeerr (s: SeerrServer | null): void;
export function discover (s: SeerrServer, list: 'trending' | 'popular' | 'upcoming', page?: number): Promise<SeerrTitle[]>;
export function searchSeerr (s: SeerrServer, text: string): Promise<SeerrTitle[]>;
export function details (s: SeerrServer, t: Pick<SeerrTitle, 'tmdbId' | 'type'>): Promise<SeerrTitle>;
export function request (s: SeerrServer, t: SeerrTitle, seasons?: number[]): Promise<true | string>;
export function myPending (s: SeerrServer, jellyfinUserId: string): Promise<SeerrTitle[]>;  // demandés pas encore dispo, de l'utilisateur lié
```

- [ ] **Étape 1 :** le service (si gardé). Deux méthodes, `get` et `post`, avec `{url, key, path, body?}`. Il refuse tout ce qui ne passe pas :
  `url` contre `/^https?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?$/`, `key` contre `/^[A-Za-z0-9+\/=_-]{16,128}$/`, `path` contre une liste fixe
  (`/api/v1/status`, `/api/v1/discover/(trending|movies|tv|movies/upcoming)?page=N`, `/api/v1/search?query=…&page=N`,
  `/api/v1/(movie|tv)/\d+`, `/api/v1/request` en POST, `/api/v1/request?take=…&filter=…`, `/api/v1/user?take=…`). Délai 8 s. Même idée que
  `lib/root.ts` : une liste, rien d'autre ne passe.
- [ ] **Étape 2 :** `seerr.ts`. `availability` vient de `mediaInfo.status` (2 → requested, 3 → downloading, 4 et 5 → available, sinon none) ;
  `percent` de `mediaInfo.downloadStatus` (`1 - sizeLeft / size`, moyenne). `myPending` relie l'utilisateur Seerr par son `jellyfinUserId`.
  Réglages gardés avec `writeCache`, clé `seerr-server`. Rien n'est appelé si `cachedSeerr()` est `null`.
- [ ] **Étape 3 :** vérifier. Build OK. Sur la TV (inspecteur) : `discover('trending')` rend des titres avec affiches, `details` d'un titre
  déjà présent rend `available`. Un chemin hors liste est refusé par le service.
- [ ] **Étape 4 :** commit `Films & séries: Lumen parle à Seerr`.

### Tâche 5 : lecture et bande-annonce

**Fichiers :** Créer `app/src/lib/play.ts`. Modifier `app/src/config/constants.ts` (ids `jellyfin: 'org.jellyfin.webos'`,
`youtube: 'youtube.leanback.v4'` dans `SYSTEM_APP`).

**Interfaces :** consomme `JellyfinServer`, `MediaItem`, `nextEpisode` (tâche 3), `launchApp` (`lib/launch.ts`). Produit :
```ts
export type PlayResult = 'playing' | 'opened';   // 'opened' : Jellyfin ouvert mais le titre n'a pas été lancé
export function play (s: JellyfinServer, item: MediaItem): Promise<PlayResult>;
export function openTrailer (youtubeId: string): Promise<void>;  // absent si la tâche 1 l'a exclu
```

- [ ] **Étape 1 :** `play`. Une série se résout d'abord par `nextEpisode`. Lancer Jellyfin, puis chercher toutes les 500 ms pendant 15 s la
  session de la TV (champs notés à la tâche 1), puis `PlayNow` avec `startPositionTicks = resumeTicks`. Tout échec rend `'opened'`. Si la
  tâche 1 a échoué, `play` ne fait que lancer Jellyfin et rend `'opened'`.
- [ ] **Étape 2 :** l'appelant affiche un toast (`components/Toast.tsx`) quand c'est `'opened'` : « Ouvre-le dans Jellyfin » (et sa traduction).
- [ ] **Étape 3 :** vérifier sur la TV : un film en cours reprend au bon endroit ; un épisode de série en cours reprend ; serveur coupé →
  Jellyfin s'ouvre et le toast s'affiche.
- [ ] **Étape 4 :** commit `Films & séries: un titre se lance dans Jellyfin, au bon endroit`.

### Tâche 6 : réglages et accueil

**Fichiers :** Modifier `app/src/app.tsx` (options, rangée, tuile), `app/src/components/SettingsList.tsx` (`OptionGroup` gagne `'media'`),
`app/src/config/builtinApps.ts` (`BUILTIN.media = 'lumen:media'`, tuile « Films & séries »), `app/src/lib/i18n.ts`. Créer
`app/src/hooks/useMedia.ts`, `app/src/components/ResumeTile.tsx`, `app/src/theme/media.css`.

**Interfaces :** consomme les tâches 3 à 5. Produit :
```ts
// hooks/useMedia.ts
export interface MediaState { jellyfin: JellyfinServer | null; seerr: SeerrServer | null; resume: MediaItem[]; pending: SeerrTitle[] }
export function useMedia (onHome: boolean): MediaState;  // lit après le fond d'écran (comme useLiveTv), relit au retour sur l'accueil, cache
```

- [ ] **Étape 1 :** Réglages > **Films & séries** (`OptionGroup 'media'`), sur le modèle de Photos : adresse Jellyfin, utilisateur, mot de
  passe (affiché masqué), « Se connecter » ; adresse Seerr, clé API, « Tester ». État : « Connecté » / « Non connecté » / « Échec : <motif> ».
- [ ] **Étape 2 :** tuile intégrée « Films & séries » (glyphe à ajouter dans `Glyph.tsx`), présente seulement quand Jellyfin est connecté ;
  OK ouvre l'écran `'media'` (tâche 7).
- [ ] **Étape 3 :** tuiles HDMI : chaque `InputSource` de `listInputs()` avec `connected === true` s'ajoute à la fin de la rangée d'apps, avec
  son `label` et son icône (`glyphImageUrl`) ; OK fait `launchApp(appId)`. Une option Réglages > Accueil « Entrées branchées sur l'accueil »
  (activée par défaut). Relire les entrées au retour sur l'accueil.
- [ ] **Étape 4 :** rangée « Reprendre » : `HomeRow` titrée `row--resume`, juste après les rangées d'apps et avant Live TV, avec
  `resume` puis `pending`. `ResumeTile` dessine une vignette 16:9 (`Thumb` ou `Backdrop`), le titre et le sous-titre, la barre de progression
  (`transform: scaleX`), ou la pastille « Demandé » / « 42 % ». Sans image : fond coloré et titre. Absente si les deux listes sont vides.
- [ ] **Étape 5 :** focus dans « Reprendre » : le fond d'écran passe en fondu (`opacity`) sur le `Backdrop` du titre, flouté une fois en copie
  comme les fonds existants (`lib/blurCanvas.ts`), pas de flou en direct. Retour au fond normal en quittant la rangée.
- [ ] **Étape 6 :** vérifier en direct sur la TV avec l'utilisateur (DevTools d'abord), puis build. Points à surveiller 1, 2 et 5 :
  serveur coupé → accueil normal sans rangée ; faux jeton → rangée absente et réglages « Non connecté ».
- [ ] **Étape 7 :** commit `Films & séries: une rangée Reprendre et tes entrées HDMI sur l'accueil`.

### Tâche 7 : écran Films & séries, onglet Bibliothèque

**Fichiers :** Créer `app/src/screens/Media.tsx`, `app/src/components/Poster.tsx`, `app/src/components/MediaHero.tsx`. Modifier `app.tsx`
(`Screen` gagne `'media'`, Back revient à l'accueil, `setWhere`), `theme/media.css`, `lib/i18n.ts`.

**Interfaces :** consomme `MediaState` et les tâches 3 à 5. Produit :
```ts
export type MediaTab = 'library' | 'discover' | 'search';
export interface PosterModel { key: string; title: string; imageUrl?: string; availability?: Availability; percent?: number }
// Media.tsx : <Media state={MediaState} tab={MediaTab} onTab={(t) => void} onBack={() => void} onToast={(text: string) => void} />
```

- [ ] **Étape 1 :** onglets en pastilles en haut au centre (`media-tab--focused`), Haut depuis la première rangée y va.
- [ ] **Étape 2 :** `MediaHero` : `Backdrop` du titre focalisé flouté en copie à gauche, titre, année · durée · genre · note, résumé (3 lignes
  max), boutons Lecture et Bande-annonce. Le hero change 250 ms après le dernier mouvement, pour ne pas charger une image par pression.
- [ ] **Étape 3 :** rangées d'affiches 2:3 (`Poster`, `poster--focused`) : Ajouts récents, Films, Séries, puis une par genre (les 6 genres
  les plus fournis). Images chargées seulement pour les rangées visibles et la suivante. OK sur une affiche → `play`.
- [ ] **Étape 4 :** vérifier sur la TV : la navigation reste fluide sur une rangée de 50 affiches (compteur d'images par seconde des builds
  dev), Back revient à l'accueil sur la tuile « Films & séries », `lumen.where()` dit où est le focus.
- [ ] **Étape 5 :** commit `Films & séries: un écran pour parcourir ta bibliothèque`.

### Tâche 8 : onglets Découvrir et Rechercher, demandes

**Fichiers :** Modifier `screens/Media.tsx`, `components/Poster.tsx`, `theme/media.css`, `lib/i18n.ts`. Créer
`app/src/components/RequestPanel.tsx`.

- [ ] **Étape 1 :** Découvrir (présent seulement si Seerr est réglé) : rangées Tendances, Populaires, Bientôt. Pastilles sur `Poster` :
  Dispo, Demandé, %. Le hero montre le bouton **Demander**, ou **Lecture** quand c'est `available` (via `findByTmdb` puis `play` ; pas
  trouvé → toast « Ouvre-le dans Jellyfin », point 4).
- [ ] **Étape 2 :** `RequestPanel` pour une série : « Toutes les saisons » en premier, puis une ligne par saison pas encore disponible,
  cochables, puis « Demander ». Un film se demande directement. Après une demande : la pastille passe à « Demandé » sans recharger la rangée.
- [ ] **Étape 3 :** Rechercher : un champ texte (clavier de la TV, micro possible), recherche 400 ms après la dernière frappe, dans Jellyfin
  et Seerr. Résultats en une rangée, doublons fusionnés par id TMDB (la version Jellyfin gagne).
- [ ] **Étape 4 :** vérifier sur la TV : demander un film rare puis le voir « Demandé » sur l'accueil (`myPending`) ; rechercher « interstel »
  trouve Interstellar ; Seerr coupé → l'onglet affiche « Seerr ne répond pas » et Bibliothèque marche toujours.
- [ ] **Étape 5 :** commit `Films & séries: découvrir, chercher et demander un film ou une série`.

### Tâche 9 : documentation

**Fichiers :** Créer `docs/films-series.md` (comment ça marche et comment le régler, sur le modèle de `docs/immich.md`). Modifier
`docs/plans/PLAN.md` (une ligne par point à vérifier sur la TV dans **Verify on the TV**, branche `feat/films-series`) et
`docs/plans/films-series.md` (statut).

- [ ] **Étape 1 :** écrire les docs. **Étape 2 :** commit `docs/films-series.md: régler et utiliser Films & séries`.

---

## Étape 2 de la spec : recommandations par l'IA

Pas dans ce plan. Elle a besoin des tâches 3, 4 et 8. Écrire son plan à part une fois la tâche 8 vue sur la TV par l'utilisateur, avec la clé
Anthropic de l'utilisateur et la doc de l'API à jour (skill `claude-api`).
