// Lumen's plugins (docs/plans/plugins.md): the ones the build found (virtual:lumen-plugins, from LUMEN_PLUGINS_DIR or app/private/plugins/;
// none in the public build), in one registry. Each one is turned on and off in Settings > Plugins; with none on, Lumen is a plain launcher.
import {useEffect, useState} from 'preact/hooks';
import installed from 'virtual:lumen-plugins';
import {readCache, writeCache} from '../lib/boot';
import {addStrings, t} from '../lib/i18n';
import {cachedServer} from '../lib/jellyfin';
import {logError} from '../lib/log';
import type {CatalogSource, ChoiceStore, LumenPlugin} from './api';
import {createRegistry} from './registry';

export const plugins = createRegistry({
	store: {
		get: (key) => { try { return localStorage.getItem(key); } catch { return null; } },
		set: (key, value) => { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* storage off */ } }
	},
	log: (id, message) => logError('plugin', `${id}: ${message}`)
});

(installed as LumenPlugin[]).forEach((p) => {
	if (plugins.register(p) && p.strings) plugins.guard(p, 'strings', () => addStrings(p.strings as Record<string, Record<string, string>>), undefined);
});

/** Starts the plugins that are on (once, from the app), with how they reach the screen. */
export function startPlugins (toast: (text: string, kind?: 'info' | 'error') => void): void {
	plugins.startAll((p) => ({
		toast,
		changed: plugins.notify,
		jellyfin: () => { const s = cachedServer(); return s ? {url: s.url, userId: s.userId, token: s.token} : null; },
		store: {get: <T>(key: string) => readCache<T>(`plugin:${p.id}:${key}`), set: (key, value) => writeCache(`plugin:${p.id}:${key}`, value)},
		t
	}));
}

// the hooks that give one object, kept until a plugin changes (so a screen's effects do not run again on each drawing)
let cachedCatalog: CatalogSource | null | undefined;
let cachedChoices: ChoiceStore | null | undefined;
let version = 0;
plugins.subscribe(() => { cachedCatalog = undefined; cachedChoices = undefined; version++; });

/** Films & series' catalog from a plugin, or null (Lumen's own Seerr calls) */
export const catalog = (): CatalogSource | null => (cachedCatalog === undefined ? (cachedCatalog = plugins.first('catalog')) : cachedCatalog);
/** the player's choice store from a plugin, or null (Lumen's own copy alone) */
export const choiceStore = (): ChoiceStore | null => (cachedChoices === undefined ? (cachedChoices = plugins.first('choices')) : cachedChoices);

/** Draws the component again when a plugin is turned on or off, set aside, or says its data changed. Returns a number that changes then. */
export function usePlugins (): number {
	const [, bump] = useState(0);
	useEffect(() => plugins.subscribe(() => bump((n) => n + 1)), []);
	return version;
}
