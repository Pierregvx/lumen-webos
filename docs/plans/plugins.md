# Plugins

Written 2026-11-11. Lumen's plugins are TypeScript compiled into the app at build time, from a folder outside the repository. A plugin
gives data and actions; Lumen draws them. Without a plugin, Lumen builds and runs as the plain launcher it is.

The plugin system is generic: nothing in it names a particular server or service, so it can be proposed upstream as it is. A plugin for
one home's own server (for example the owner's Ciné Pierro) lives in that server's own repository, not here.

## What is allowed

- **Compiled in, never loaded.** The build reads the plugins' source and bundles it with Lumen (the app is one classic script loaded from
  `file://`; webOS refuses module scripts there). Nothing is fetched and run at run time: no `eval`, no remote script.
- **Lumen's side only through `lumen-plugin-api`** (`app/src/plugins/api.ts`): its types, and a few helpers (`readCache`, `writeCache`,
  `loggedFetch`, `logError`). A plugin imports nothing else of Lumen, so Lumen's files can change without breaking it.
- **No components.** A plugin returns data (rows of titles, tiles, chips) and actions (what a button does: a toast, a page, a form, a short
  list); Lumen draws them with its own components, its focus rules and its GPU budget (`docs/research/RESEARCH.md` section 4). A plugin
  cannot break a screen's layout or animate anything.
- **No secrets in this repository.** A plugin's addresses and keys are typed in Settings and kept in the TV's storage under the plugin's id.
- **Isolated.** Every call into a plugin goes through the registry (`app/src/plugins/registry.ts`): a throw is caught and logged and
  the screen goes on without it; a promise that has not settled after 20 s is cut; after 3 throws or cut calls the plugin is set aside
  until Lumen restarts (Settings > Plugins says so). A promise that rejects is the plugin's own answer (its server is off) and is not
  counted. The screens treat a rejection as « no answer » and keep what they had.

## The interface

A plugin's `index.ts` has a default export of type `LumenPlugin` (all in `app/src/plugins/api.ts`):

| Field | What |
|---|---|
| `id`, `name`, `description` | `id`: lower case, digits, dashes (its storage and settings are kept under it). The name and description show in Settings > Plugins. |
| `defaultOn()` | On before the person has touched its switch (for example: its server's address is already known). Off otherwise. |
| `settings()` | Its rows in Settings > Plugins, under its switch, while it is on: `text` (an address), `toggle`, `action` (pair, forget). |
| `start(ctx)`, `stop()`, `foreground()` | Turned on (at start, or from Settings), turned off, Lumen back to the front. |
| `strings` | Its words in other languages, `{fr: {'Watch later': 'À voir plus tard'}}`. Lumen's own table wins. |

`ctx` (`PluginContext`) gives `toast`, `changed()` (its data changed: the screens read their plugin parts again), `jellyfin()` (the server
Lumen is signed in to), `store` (its own storage) and `t` (Lumen's translation).

**Hook points** (each optional; Lumen asks the active plugins in the order they were installed):

| Hook | Where Lumen uses it | Shape |
|---|---|---|
| `catalog()` | Films & series: Discover, search, a title's record, the pages (a platform, a person, a tile), requests, the home screen's requests row. The first plugin that gives one replaces Lumen's own Seerr calls. | `CatalogSource` |
| `choices()` | The player: where the subtitle choice and timing are kept (Lumen keeps its own copy too, used when the plugin fails). | `ChoiceStore` |
| `titleActions(title)` | Films & series: buttons after Lumen's own on the title in focus. Each returns an `ActionResult`: a toast or an error, a page, a form (`FormPanel`), a short list (`ChoicePanel`), or « read the title again ». | `TitleAction[]` |
| `rated(title, score)` | A score was given with Rate. | |

What a catalog's titles may carry, which Lumen draws: `mine` (the person's score: « ★ 8 » on the poster, « ★ Already rated : 8 / 10 » on
the title), `release` (a date on the poster, « Out on … »), `later`, `reason` (For you's line). Its rows may hold `tiles` (a genre) that
open a `Page`; a page may have one button for some of its titles (`PageAction`, « Request the missing ones »). `chips()` gives chips under a
title's facts (a series' seasons).

Hooks not there yet, added when a plugin needs them (each is a few lines in the screen that has the place): home screen rows, a Control
Center row, a screen of its own, a play source, a wallpaper source.

## Writing a plugin

```
my-plugin/
  index.ts          export default {id: 'my-plugin', name: …, description: …, catalog: …} satisfies LumenPlugin
  *.ts              its own modules (relative imports with the .ts extension, so node runs its tests as they are)
  test/*.test.mjs   node --test, against fakes
```

```ts
import type {LumenPlugin} from 'lumen-plugin-api';
import {loggedFetch} from 'lumen-plugin-api';

const plugin: LumenPlugin = {
	id: 'hello',
	name: 'Hello',
	description: 'Says hello on every title.',
	titleActions: (t) => [{id: 'hi', label: 'Hello', run: async () => ({toast: `Hello, ${t.title}`})}]
};
export default plugin;
```

To type-check it against Lumen, point `lumen-plugin-api` at Lumen's `app/src/plugins/api.ts` in its own `tsconfig.json` (`paths`). Lumen's
`npm --prefix app run build` does not type-check plugins: it compiles them.

## Building Lumen with a plugin

The build takes the plugins from `LUMEN_PLUGINS_DIR` (in the repository's `.env`, or the environment), else from `app/private/plugins/`
(gitignored, as the rest of `app/private/`). The folder is one plugin (an `index.ts` in it) or holds several (each folder with an
`index.ts`). `vite.config.ts` (`lumenPlugins`) turns them into `virtual:lumen-plugins`, which `app/src/plugins/index.ts` installs; the
build prints `plugins: <names>`. `LUMEN_PRIVATE=0` builds with no plugin (as a public release).

```bash
LUMEN_PLUGINS_DIR=~/cine-pierro/lumen-plugin npm run deploy:home
```

Or put `LUMEN_PLUGINS_DIR=~/cine-pierro/lumen-plugin` in `.env` once; then `npm run deploy:home`, `npm run build:ipk` and
`npm --prefix app run build` all build it in. A link works too: `ln -s ~/cine-pierro/lumen-plugin app/private/plugins`.

Each plugin is then turned on in Settings > Plugins (the page shows only when the build has a plugin).

## Lumen's parts that could become plugins later

Not changed now; each one already talks to a server of its own:

- **Immich** (`lib/immich.ts`, `lib/wallpaper.ts`): the wallpaper's photos. A wallpaper-source hook.
- **Live TV from Jellyfin, and the IPTV categories** (`lib/iptv.ts`, `hooks/useLiveTv.ts`, the categories read from the picks server).
- **Home Assistant in Control Center** (`lib/home.ts`): the Home row (lamp, speaker, air). A Control Center row hook.
- **The picks server's parts**: For you (`lib/recos.ts`), the prepared-copy marks (`lib/prepared.ts`), the ratings sent there.
- **Seerr itself** (`lib/seerr.ts`): it could become the default catalog plugin, so Lumen's core keeps only Jellyfin.

## Updating from upstream

This fork tracks `samrenfrew/lumen-webos`. Its remote here is `origin` (`git remote -v`); the fork itself is `fork` (`Pierregvx/lumen-webos`).

```bash
git fetch origin
git merge origin/main
```

Merge rather than rebase: the fork's `main` is pushed and is what the TV runs, so its history is not rewritten. Rebase only a short local
branch that was never pushed.

The plugin system touches few files outside `app/src/plugins/`; these are where a conflict can come:

| File | What the plugin system adds |
|---|---|
| `app/vite.config.ts` | `lumenPlugins()`, the `lumen-plugin-api` alias, `server.fs.allow` |
| `app/src/env.d.ts` | `virtual:lumen-plugins` |
| `app/src/screens/Media.tsx` | the catalog in place of Seerr, the title's plugin buttons, pages, forms, chips, `mine` and dates on posters |
| `app/src/screens/Player.tsx` | the choice store (one effect, three lines in the subtitle and timing handlers) |
| `app/src/hooks/useMedia.ts` | the catalog's requests row, `foreground` |
| `app/src/app.tsx` | `startPlugins`, Settings > Plugins rows (three lines) |
| `app/src/screens/Settings.tsx`, `components/SettingsList.tsx` | the Plugins group |
| `app/src/lib/i18n.ts` | `addStrings` |
| `app/src/lib/seerr.ts` | optional fields a catalog may fill on a title |
| `app/src/components/Poster.tsx`, `theme/media.css`, `theme/tokens.css` | the score, the date and the tile on a poster; chips; the form |

New files (no conflict): `app/src/plugins/` (`api.ts`, `registry.ts`, `index.ts`, `settings.ts`), `components/FormPanel.tsx`,
`components/ChoicePanel.tsx`, `app/test/plugins.test.mjs`, this file.

After a merge: `npm --prefix app test` (the registry's tests), then build with the plugin and try it (`LUMEN_PLUGINS_DIR=… npm --prefix app
run build`). A plugin that no longer fits Lumen's API fails its own type check, or the build when something it imports is gone. If upstream takes the plugin system, the fork
has almost no difference left: its own code is in its plugin's repository.

## Tests

`npm --prefix app test`: the registry with fake plugins (`app/test/plugins.test.mjs`): installing, the switch kept, `defaultOn`, each hook,
a throw caught, a promise cut after the timeout, a rejection passed through, a plugin set aside after three failures, the screens told when
the plugins have started. A plugin tests itself in its own repository.

## Is it too much for Lumen?

No, in this shape: a registry of about 170 lines, one interface file, and short hooks in the screens that have a place for them. What was
left out on purpose: plugins drawing their own components (they would bypass the focus rules and the GPU budget, and would need Preact
resolved from outside the repository), and hook points no plugin uses yet.
