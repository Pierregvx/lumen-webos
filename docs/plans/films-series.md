# Films & séries : Jellyfin et Seerr dans Lumen

Conception écrite le 2026-10-29 avec l'utilisateur. Statut : étape 1 construite sur `feat/films-series` (voir `docs/films-series.md`) ; étape 2 (recos IA) construite aussi (rangée « For you » dans Découvrir).

## Pourquoi

Sur la TV de l'utilisateur, la seule app utilisée est Jellyfin. Il veut un endroit facile et beau pour retrouver ses films et séries, et pour
demander ceux qu'il n'a pas (via Seerr, qui envoie la demande à ses outils de téléchargement), le tout intégré à l'accueil de Lumen.
L'accueil actuel lui plaît : on garde son design et on y ajoute peu.

## La TV et le serveur

- TV : LG, webOS 24, à <tv-ip>. **Pas rootée** : Lumen y est installée en
  Developer Mode (`ares-install`, appareil `lgtv`, utilisateur `prisoner`, port 9922), sous l'id `com.samrenfrew.lumen.dev`. L'utilisateur
  rootera la TV s'il aime le résultat.
- Serveur : 192.168.1.10 sur le réseau local.
  - Jellyfin 12.2.0 sur le port 8096. Envoie `Access-Control-Allow-Origin: *` et répond aux preflights : la page peut l'appeler.
  - Seerr 3.5.1 sur le port 5055. N'envoie aucun en-tête CORS et refuse le preflight (405) : la page ne peut pas l'appeler.
- Ce dépôt est un clone de `samrenfrew/lumen-webos`. **Ne rien pousser** : un push sur `main` publie une release de Sam. Travailler sur une
  branche locale.

## Objectifs

1. **Accueil** (le design actuel ne change pas) :
   - Le dock garde les apps de l'utilisateur (Jellyfin, éventuellement d'autres ; pas de Netflix ni de Prime, c'est déjà réglable).
   - Une tuile **« Films & séries »** dans le dock ouvre l'écran dédié.
   - Une tuile par **entrée HDMI branchée** (et seulement celles-là), avec le nom donné dans la TV. OK bascule sur l'entrée.
     `lib/inputs.ts` sait déjà lister les entrées sans root (`eim/getAllInputStatus`, champ `connected`).
   - Une rangée **« Reprendre »** sous le dock : films et épisodes en cours dans Jellyfin, avec barre de progression, puis les titres
     demandés dans Seerr et pas encore disponibles (pastille « Demandé » ou pourcentage). OK lance la lecture (voir « Lecture »).
   - Quand le focus est dans « Reprendre », le fond peut prendre l'image du titre focalisé (fondu en `opacity`). Voir avec l'utilisateur sur la TV.
2. **Écran « Films & séries »**, trois onglets en haut :
   - **Bibliothèque** : grande image et infos du titre focalisé en haut (titre, année, durée, genre, note, résumé, boutons Lecture et
     Bande-annonce), puis des rangées d'affiches : Ajouts récents, Films, Séries, puis une par genre.
   - **Découvrir** (Seerr) : rangées Tendances, Populaires, Bientôt. Chaque affiche porte une pastille : **Dispo** (dans Jellyfin, OK lit),
     **Demandé**, ou le **% de téléchargement**. Sans pastille, le bouton est **Demander**. Pour une série, Demander propose toutes les
     saisons ou un choix de saisons.
   - **Rechercher** : un champ (clavier de la TV ou micro de la télécommande) qui cherche dans la bibliothèque et dans le catalogue Seerr.
     Mêmes affiches et pastilles.
3. **Réglages** : une page « Films & séries » dans Settings, sur le modèle de Settings > Photos (Immich) : adresse Jellyfin + identifiant
   et mot de passe, adresse Seerr + clé API, un bouton Tester la connexion qui dit lequel échoue.

## Étape 2 (après le reste) : recommandations par l'IA

- Une rangée **« Pour toi »** en tête de Découvrir.
- Entrées envoyées à Claude : le profil de goûts de l'utilisateur (texte libre, collé dans les réglages ; son exemple liste notes, coups de cœur,
  abandons et genres), l'historique Jellyfin (vu, en cours, abandonné), et une liste de candidats pris dans Seerr (tendances, et
  recommandations TMDB des coups de cœur via Seerr), pour que chaque reco existe et soit demandable.
- Sortie : une dizaine de titres (id TMDB) avec une phrase « parce que » chacun, affichée sous l'affiche focalisée.
- Calculé au plus une fois par jour et gardé en cache. Il faut une clé API Anthropic (console.anthropic.com), saisie dans les réglages.
  L'API accepte les appels directs depuis une page (en-tête `anthropic-dangerous-direct-browser-access: true`).
- Le choix du modèle et le format exact de la réponse sont laissés au constructeur (consulter la doc de l'API au moment de construire).

## Non-objectifs

- Pas de lecteur vidéo dans Lumen : la lecture se fait dans l'app Jellyfin.
- Pas de Home Assistant pour l'instant (peut-être plus tard).
- Pas de gestion des demandes côté admin (approuver, refuser) : on demande, c'est tout.
- Pas de changement sur le serveur de l'utilisateur, sauf le repli Seerr ci-dessous.

## Si les essais échouent (décidé par l'utilisateur le 2026-10-29)

- **Lecture** : si Jellyfin ne lance pas le titre à distance, Lumen sert à parcourir et à demander. OK ouvre l'app Jellyfin, et l'écran le
  dit (« Ouvre-le dans Jellyfin »), sans faire croire que le titre va se lancer. Pas de lecteur dans Lumen.
- **Seerr** : si le service JS ne tourne pas en Developer Mode, on ajoute un petit reverse proxy (un conteneur Docker) devant Seerr sur le
  serveur, qui renvoie les en-têtes CORS. Rien d'autre ne change sur le serveur. Montrer à l'utilisateur la config avant qu'il l'installe.

## Anti-objectifs (ce qui serait un échec même si ça marche)

- Un accueil plus chargé ou plus lent qu'aujourd'hui. L'accueil ne charge qu'une rangée d'images.
- Un clic sur un titre qui ouvre Jellyfin sur sa page d'accueil sans lancer le titre, présenté comme si ça marchait.
- Des écrans qui ne ressemblent pas au reste de Lumen.

## Contraintes

- Toutes les règles de `CLAUDE.md` s'appliquent : cible `chrome79` en script classique, animer seulement `transform` et `opacity`, flou en
  direct seulement sur le contrôle focalisé, chiffres proportionnels, styles via les tokens de `app/src/theme/`, classe `<part>--focused`
  sur l'élément focalisé, commandes root seulement dans `lib/root.ts`.
- Le GPU de la TV est faible : affiches redimensionnées par le serveur (`maxWidth`/`fillWidth` côté Jellyfin, tailles TMDB `w342`
  côté Seerr), chargées seulement quand la rangée est visible, peu d'éléments vivants à la fois.
- Tout doit marcher **sans root** (Developer Mode) et continuer de marcher une fois la TV rootée.
- L'app doit fonctionner sans `app/private/` et sans serveur configuré : sans réglages, ni tuile ni rangée, aucun appel réseau.
- Développement : les changements se testent en direct sur la TV avant tout build (voir `CLAUDE.md`). En Developer Mode, l'inspecteur
  passe par `ares-inspect -d lgtv`, pas par le chemin root du skill `tv` ; à vérifier.

## Choix techniques faits (par Claude, à revoir si besoin)

- **Lecture (à vérifier sur la TV)** : l'app Jellyfin pour webOS (`org.jellyfin.webos`) ne lit aucun paramètre de lancement, donc on ne
  peut pas l'ouvrir sur un titre. Lumen la lance, attend que sa session apparaisse sur le serveur (`GET /Sessions`, filtrée sur ce
  client et cet appareil), puis lui demande de lire le titre : `POST /Sessions/{id}/Playing?playCommand=PlayNow&itemIds=…&startPositionTicks=…`
  (la télécommande à distance de Jellyfin). Repli si ça échoue : ouvrir Jellyfin et dire clairement sur l'écran que le titre n'a pas pu être
  lancé. À essayer en premier, avant le reste, car tout le projet en dépend.
- **Seerr** passe par un **service JS webOS** embarqué dans l'ipk (Node, sans root), qui fait les requêtes HTTP à la place de la page,
  puisque Seerr ne renvoie pas d'en-têtes CORS. Il ne fait que relayer une liste fixe de chemins de l'API Seerr vers l'adresse configurée,
  à la manière des listes de `lib/root.ts`. À vérifier : qu'un service JS tourne bien en Developer Mode sur webOS 24.
- **Jellyfin** est appelé directement depuis la page (CORS ouvert). Connexion par identifiant et mot de passe
  (`/Users/AuthenticateByName`), qui donne un jeton et l'id utilisateur ; on garde le jeton, pas le mot de passe.
- **Réglages** gardés dans `localStorage` (pas de root). Une fois la TV rootée, ils pourront aussi aller dans `/var/lib/homehook/` comme
  `immich.json`, pour survivre à une réinstallation.
- **Pastilles** : l'état de chaque titre vient de Seerr (`mediaInfo.status` : disponible, en cours, demandé) ; le % vient des
  téléchargements que Seerr connaît.

- **Lecture d'une série** : OK ou Lecture sur une série lance l'épisode en cours, sinon le prochain non vu (`/Shows/NextUp` de Jellyfin).
  Pas de sélecteur de saison et d'épisode dans cette version.
- **Bande-annonce** : ouvre l'app YouTube sur la vidéo (`RemoteTrailers` de Jellyfin, vidéos TMDB via Seerr), en passant l'id de la vidéo
  au lancement. Si YouTube ne s'ouvre pas sur la vidéo, le bouton est retiré plutôt que d'ouvrir YouTube à vide.
- **Rangées de l'accueil** : « Reprendre » s'ajoute juste sous le dock. Les rangées existantes (autres rangées d'apps, Récents) restent
  en dessous. « Une rangée d'images » veut dire qu'elle est la seule rangée d'affiches ; les autres sont des icônes d'apps.
- **Utilisateur Seerr** : les demandes partent avec la clé API (donc en admin, c'est le serveur de l'utilisateur). Les titres « Demandé » de
  l'accueil sont filtrés sur l'utilisateur Seerr lié au compte Jellyfin connecté (champ `jellyfinUserId` des utilisateurs Seerr).

## Laissé au constructeur

- Le découpage en composants (réutiliser `Row`, `Tile`, `Grid` quand ça colle), les noms, les clés de cache.
- Les rangées par genre exactes, le nombre d'éléments par rangée, la pagination.
- Le choix des saisons dans la demande d'une série, tant qu'il reste simple à la télécommande.
- Où se mettent les tuiles HDMI dans le dock (proposé : à la fin) et leur icône.

## Ordre proposé

1. Essai jetable sur la TV : lecture via la session Jellyfin, et un service JS qui appelle Seerr en Developer Mode.
2. Réglages et connexion.
3. Accueil : tuile, entrées HDMI, rangée Reprendre.
4. Écran Films & séries : Bibliothèque, Découvrir, Rechercher, demandes.
5. Étape 2 : recommandations par l'IA.
