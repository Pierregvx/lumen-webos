# Le lecteur dans Lumen : plan de construction

> **Pour les agents :** SOUS-SKILL REQUIS : superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans, tâche par
> tâche. Les étapes sont des cases à cocher (`- [ ]`).

**But :** lire les films et épisodes Jellyfin dans Lumen (un lecteur posé par-dessus l'écran en cours), avec bandeau, ±10 s, sous-titres automatiques, compte à
rebours vers l'épisode suivant, et la lecture déclarée à Jellyfin.

**Architecture :** un `<video>` plein écran sur le flux direct de Jellyfin, derrière une page rendue transparente (le plan vidéo de la TV
est sous la page). La logique sans écran (choix des sous-titres, épisode suivant, moment du compte à rebours, VTT) vit dans
`lib/playerLogic.ts`, testée par un script Node ; les appels serveur dans `lib/player.ts` ; l'écran dans `screens/Player.tsx`. Le chemin
actuel par l'app Jellyfin (`lib/play.ts` + `service/media.js`) reste comme repli.

**Technique :** Preact + TypeScript, cible `chrome79` ; HTML5 video du webOS 24 ; API Jellyfin 12.2.

**Spec :** `docs/plans/player.md` (validée le 2026-10-29). Lire aussi `docs/research/films-series-spikes.md` (section « A player inside
Lumen ») et `docs/films-series.md`.

## Contraintes globales

- Règles de `CLAUDE.md` : `chrome79`, script classique ; animer seulement `transform` et `opacity` ; couleurs et durées en tokens
  (`theme/tokens.css`) ; styles dans un nouveau `theme/player.css` importé après `media.css` ; `<part>--focused` sur le focus ; DevTools
  d'abord pour l'apparence (l'utilisateur juge en direct).
- TV de l'utilisateur, Developer Mode : installer avec `npm run build:ipk` puis `npx ares-install -d lgtv build/com.samrenfrew.lumen.dev_*.ipk`
  (depuis `app/`) ; inspecter avec `npx ares-inspect -d lgtv --app com.samrenfrew.lumen.dev` et `tools/tv/cdp.mjs` (borné par
  `perl -e 'alarm 25; exec @ARGV' …`). Caméra du Mac : `tools/node_modules/ffmpeg-static/ffmpeg -f avfoundation -i "0" -frames:v 1 …`.
- Flux : `{url}/Videos/{id}/stream?static=true&mediaSourceId={msid}&api_key={token}`. Ne pas se fier à `canPlayType`.
- Pendant la lecture : classe `html.playing` qui rend transparents `html`, `body`, cache `#wpimage` et `#root` (sauf l'écran du lecteur),
  et met en pause le fond vidéo (`setVideoPaused(true)`, `lib/wallpaperVideo.ts`).
- Durées : bandeau masqué après **4 s** ; saut **10 s** ; carte de fin **8 s** avant l'épisode suivant (avec marqueur `Outro`) ou **15 s**
  avant la fin (sans) ; **3** épisodes d'affilée sans touche → « Still there? » ; repli si rien ne joue après **10 s**.
- Branche `feat/films-series` (suite), jamais poussée. Commits : `Player: <ce qui change pour l'utilisateur>`.
- Vérification : `npm --prefix app run build` (types) + `node` sur `scratch/player-logic-check.mjs` pour la logique + l'essai sur la TV
  écrit dans la tâche.

## Points à surveiller en revue

1. **Erreur ou blocage du flux** (fichier déplacé, serveur coupé en cours) : message clair, repli vers l'app Jellyfin, page remise opaque
   et Lumen utilisable → tâche 4.
2. **Quitter à tout moment** (Retour pendant le chargement, pendant la carte, TV en veille) : `Stopped` envoyé avec la position, rien ne
   reste en transparence, le fond vidéo reprend → tâche 3.
3. **Dernier épisode d'une série / film** : pas de carte, retour dans Lumen à la fin → tâche 5.
4. **Fichier sans sous-titres anglais** ou piste audio sans langue : rien d'affiché ou anglais selon la règle, jamais d'erreur → tâche 2.
5. **Saut au-delà du début ou de la fin** (Gauche à 0:05, Droite à 30 s de la fin) : borné, pas de saut hors de la vidéo → tâche 3.

---

### Tâche 1 : la vidéo plein écran (essai et socle)

**Fichiers :** Créer `app/src/lib/player.ts`, `app/src/screens/Player.tsx`, `app/src/theme/player.css`. Modifier `app/src/app.tsx`
(état `playing: MediaItem | null` ; le lecteur se pose **par-dessus** l'écran en cours, qui reste monté et inactif), `app/src/main.tsx` (import du css), `app/src/theme/tokens.css`.

**Interfaces, produit :**
```ts
// lib/player.ts
export interface Stream { url: string; itemId: string; mediaSourceId: string; playSessionId: string; startTicks: number; subtitles: SubTrack[]; audioLang?: string; outroStartTicks?: number }
export interface SubTrack { index: number; lang?: string; title?: string; isDefault: boolean; vttUrl: string }
export function openStream (s: JellyfinServer, item: MediaItem): Promise<Stream>;   // GET /Items/{id}/PlaybackInfo (userId) + /MediaSegments/{id}
// screens/Player.tsx
// <Player server={JellyfinServer} item={MediaItem} active={boolean} onClose={() => void} onFallback={(item: MediaItem) => void} onToast={...} />
```

- [ ] **Étape 1 :** `openStream` : `MediaSources[0]` de PlaybackInfo → `mediaSourceId`, la piste audio par défaut (`Language`), les pistes
  `Subtitle` texte → `SubTrack` (`vttUrl` = `{url}/Videos/{id}/{msid}/Subtitles/{index}/0/Stream.vtt?api_key={token}`) ; `outroStartTicks`
  = `StartTicks` du segment `Outro` s'il y en a ; `startTicks` = `item.resumeTicks || 0` ; `playSessionId` = celui de PlaybackInfo.
- [ ] **Étape 2 :** `Player.tsx` monte un `<video class="player__video">` plein écran sur `stream.url`, saute à `startTicks / 1e7` au
  premier `loadedmetadata`, ajoute `html.playing` au montage et l'enlève au démontage (+ `setVideoPaused`). Retour → `onClose`.
- [ ] **Étape 3 :** `app.tsx` : une fonction `startPlayer(item)` met `playing` ; `<Player>` est rendu **en plus** de l'écran courant
  (accueil ou Films & séries garde son état : onglet, rangée, focus), qui passe `active={false}` tant que `playing` est posé. Reprendre et
  Films & séries appellent `startPlayer` (le réglage « Play in », tâche 6, rétablit `playAndOpen`).
- [ ] **Étape 4 :** vérifier sur la TV : depuis Reprendre, un film en cours démarre **dans Lumen** à sa position (caméra), Retour
  revient sur Reprendre, l'accueil est redevenu opaque et normal. Un MKV 4K aussi.
- [ ] **Étape 5 :** commit `Player: films and episodes start inside Lumen, where you left them`.

### Tâche 2 : logique pure et sous-titres

**Fichiers :** Créer `app/src/lib/playerLogic.ts`, `scratch/player-logic-check.mjs` (hors app, dans le scratchpad de session ; non commité).
Modifier `Player.tsx`, `player.css`.

**Interfaces, produit :**
```ts
export function pickSubtitle (tracks: SubTrack[], audioLang: string | undefined, saved: number | 'off' | undefined): SubTrack | null;
export interface Cue { start: number; end: number; text: string }   // secondes
export function parseVtt (text: string): Cue[];
export function cueAt (cues: Cue[], t: number): string;              // '' sans réplique
export function savedSubtitle (seriesId: string): number | 'off' | undefined;   // localStorage 'player-subs'
export function saveSubtitle (seriesId: string, choice: number | 'off'): void;
```

- [ ] **Étape 1 : le test** (`player-logic-check.mjs`, esbuild de `playerLogic.ts` puis assertions Node) :
  - `pickSubtitle([en, fr], 'eng', undefined)` → la piste `en` ; `pickSubtitle([en], 'fre', undefined)` → `null` ;
    `pickSubtitle([en], undefined, undefined)` → `en` (langue inconnue = VO) ; `pickSubtitle([en], 'und', undefined)` → `en` ;
    `pickSubtitle([fr], 'eng', undefined)` → `null` (pas d'anglais) ; `saved = 'off'` → `null` ; `saved = fr.index` → `fr`.
    Le français est reconnu sur `fre`, `fra`, `fr`.
  - `parseVtt` d'un VTT de deux répliques (avec en-tête, heures `00:01:02.500`, balises `<i>`) → 2 cues, balises retirées ;
    `cueAt(cues, 62.6)` → la 1re ; entre deux → `''`.
- [ ] **Étape 2 :** lancer, voir échouer (fonctions absentes). **Étape 3 :** écrire `playerLogic.ts`. **Étape 4 :** lancer, tout passe.
- [ ] **Étape 5 :** `Player.tsx` charge le VTT choisi (`loggedFetch`) et affiche `cueAt` dans `.player__subs` (texte en bas, ombre), mis à
  jour sur `timeupdate`. Vérifier sur la TV : un épisode affiche les sous-titres anglais en face des répliques (caméra).
- [ ] **Étape 6 :** commit `Player: English subtitles by themselves on original-language titles`.

### Tâche 3 : bandeau, télécommande, déclaration à Jellyfin

**Fichiers :** Modifier `Player.tsx`, `player.css`, `lib/player.ts`, `theme/tokens.css`.

**Interfaces, produit :**
```ts
export function reportStart (s: JellyfinServer, st: Stream, positionTicks: number): Promise<void>;     // POST /Sessions/Playing
export function reportProgress (s: JellyfinServer, st: Stream, positionTicks: number, paused: boolean): Promise<void>;  // /Progress
export function reportStopped (s: JellyfinServer, st: Stream, positionTicks: number): Promise<void>;  // /Stopped
```

- [ ] **Étape 1 :** bandeau (maquette 1) : titre, sous-titre (épisode), barre (`transform: scaleX`), temps écoulé / restant, boutons
  Pause, Sous-titres, Épisode suivant (si `nextEpisode` existe, tâche 5). Apparaît à toute touche, se masque après 4 s sans touche.
  `player__btn--focused` sur le bouton focalisé.
- [ ] **Étape 2 :** touches : Gauche / Droite = ±10 s cumulés dans une pastille centrale (`+20 s`), appliqués 400 ms après le dernier appui,
  bornés à [0, durée − 1] ; maintenu = pas de 30 s ; OK = pause / lecture (hors boutons) ; Bas = boutons ; Retour = fermer. Touches
  télécommande : 415 lecture, 19 pause, 417 avance (+30 s), 412 retour (−30 s).
- [ ] **Étape 3 :** bouton Sous-titres : liste « Off » + chaque piste (`slist` de Settings ou `RequestPanel`), choix gardé par série
  (`saveSubtitle`).
- [ ] **Étape 4 :** déclaration : `reportStart` au premier `playing`, `reportProgress` toutes les 10 s, à chaque pause et après chaque saut,
  `reportStopped` à la fermeture (tous chemins : Retour, fin, erreur, `visibilitychange` caché). `PositionTicks = currentTime * 1e7`,
  `PlayMethod: 'DirectPlay'`, `CanSeek: true`.
- [ ] **Étape 5 :** vérifier sur la TV avec l'utilisateur (DevTools pour l'apparence) : bandeau, ±10 s, pause ; quitter à 12:40 puis relancer
  depuis Reprendre reprend à 12:40 ; Reprendre se met à jour au retour. Point 2 et 5.
- [ ] **Étape 6 :** commit `Player: a bar on demand, ten seconds back and forth, and Jellyfin keeps your place`.

### Tâche 4 : repli vers l'app Jellyfin

**Fichiers :** Modifier `Player.tsx`, `app.tsx`.

- [ ] **Étape 1 :** sur `error` du `<video>`, ou si aucun `playing` 10 s après le montage : `reportStopped`, fermer, toast « Couldn't play
  it here: opening Jellyfin », puis `playAndOpen(server, item, …)` (`lib/play.ts`).
- [ ] **Étape 2 :** vérifier : une URL de flux cassée (DevTools : `api_key` faux) → message, Jellyfin s'ouvre, accueil opaque. Point 1.
- [ ] **Étape 3 :** commit `Player: when a file will not play here, Jellyfin takes over`.

### Tâche 5 : épisode suivant et compte à rebours

**Fichiers :** Modifier `lib/playerLogic.ts`, `lib/player.ts`, `Player.tsx`, `player.css`, le test Node.

**Interfaces, produit :**
```ts
export function nextEpisodeAfter (s: JellyfinServer, ep: MediaItem): Promise<MediaItem | null>;   // /Shows/{seriesId}/Episodes, après celui-ci (saisons comprises)
export function countdownStart (durationS: number, outroStartS: number | undefined): {cardAt: number; nextAt: number};
export const STILL_THERE_AFTER = 3;
```

- [ ] **Étape 1 : test** : `countdownStart(1800, 1700)` → `{cardAt: 1700, nextAt: 1708}` ; `countdownStart(1800, undefined)` →
  `{cardAt: 1785, nextAt: 1800}` ; `outroStartS` hors durée (≥ durée ou ≤ 0) → comme `undefined`.
- [ ] **Étape 2 :** échec, puis `countdownStart`, puis passe.
- [ ] **Étape 3 :** carte (maquette 3) à `cardAt` : « Next episode in N s », titre et vignette (`imageUrl Thumb`), **Play now** / **Cancel**.
  À `nextAt` (ou Play now) : `reportStopped`, puis le lecteur charge l'épisode suivant (même écran). Cancel / Retour : la carte part, la
  lecture finit, puis retour dans Lumen. Un compteur d'épisodes enchaînés sans touche ; à 3, la carte dit « Still there? » et n'enchaîne pas.
  Film ou dernier épisode : pas de carte, retour dans Lumen à la fin. Point 3.
- [ ] **Étape 4 :** vérifier sur la TV : sauter à 20 s de la fin d'un épisode → carte, enchaînement ; Cancel ; un film.
- [ ] **Étape 5 :** commit `Player: the next episode after a countdown you can cancel`.

### Tâche 6 : réglage, docs

**Fichiers :** Modifier `app.tsx` (réglage **Play in** : `Lumen` / `The Jellyfin app`, `config.playIn`, défaut `'lumen'`),
`lib/storage.ts`, `docs/films-series.md` (section « The player »), `docs/plans/PLAN.md` (Verify on the TV), `docs/plans/player.md` (statut).

- [ ] **Étape 1 :** tous les lancements (Reprendre, écran Films & séries, « Dispo ») passent par `startPlayer` ou, si `playIn` vaut
  `'jellyfin'`, par `playAndOpen` comme avant.
- [ ] **Étape 2 :** vérifier les deux réglages sur la TV ; build.
- [ ] **Étape 3 :** docs, puis commit `Player: choose where titles play, and how it works`.
