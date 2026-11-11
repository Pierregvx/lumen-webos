// What a Lumen plugin is, and what it may use (docs/plans/plugins.md). A plugin is TypeScript compiled into the app: the build takes every
// folder of LUMEN_PLUGINS_DIR (default app/private/plugins/, gitignored) that has an index.ts, whose default export is a LumenPlugin.
// Nothing is ever loaded from the network at run time. A plugin imports from 'lumen-plugin-api' (this file) and nothing else of Lumen.
//
// A plugin gives data and actions; Lumen draws them. It has no components of its own, so a plugin cannot break a screen's layout, and every
// call into it goes through the registry's guard (registry.ts): a throw is caught and logged, a promise that hangs is cut after a while.
import type {Platform, SeerrPerson, SeerrTitle} from '../lib/seerr';

export type {Platform, SeerrPerson, SeerrTitle};
export {readCache, writeCache} from '../lib/boot';
export {loggedFetch, logError} from '../lib/log';

// ---------- the plugin ----------

export interface LumenPlugin {
	/** lower case, digits and dashes: its settings and storage are kept under it */
	id: string;
	name: string;
	/** one line, shown under its switch in Settings > Plugins */
	description: string;
	/** on before the person has touched its switch (for example: its server is already set) */
	defaultOn?: () => boolean;
	/** its rows in Settings > Plugins, under its switch, shown while it is on */
	settings?: () => PluginSetting[];
	/** called once when it is turned on (at start, or from Settings) */
	start?: (ctx: PluginContext) => void | Promise<void>;
	/** called when it is turned off */
	stop?: () => void;
	/** Lumen came back to the front (another app was used) */
	foreground?: () => void | Promise<void>;
	/** its words in other languages: {fr: {'Watch later': 'À voir plus tard'}} (Lumen's own table wins) */
	strings?: Record<string, Record<string, string>>;

	// ----- the hook points: each optional; Lumen asks the active plugins in the order they were installed -----

	/** Films & series' catalog (Discover, search, a title's record, pages, requests): the first plugin that gives one replaces Lumen's own
	 *  Seerr calls */
	catalog?: () => CatalogSource | null;
	/** where the player keeps the subtitle choice and timing (Lumen keeps its own copy too, used when this one fails) */
	choices?: () => ChoiceStore | null;
	/** extra buttons on a title in Films & series, after Lumen's own */
	titleActions?: (t: TitleRef) => TitleAction[];
	/** a score was given to a title (Films & series' Rate) */
	rated?: (t: RatedTitle, score: number) => void;
}

export interface PluginContext {
	/** a short message at the foot of the screen */
	toast: (text: string, kind?: 'info' | 'error') => void;
	/** the plugin's data changed: the screens read their plugin parts again */
	changed: () => void;
	/** the Jellyfin server Lumen is signed in to, or null */
	jellyfin: () => {url: string; userId: string; token: string} | null;
	/** the plugin's own storage, kept under its id */
	store: {get: <T>(key: string) => T | null; set: (key: string, value: unknown) => void};
	/** Lumen's translation of a text (with the plugin's own strings) */
	t: (text: string) => string;
}

/** A row in Settings > Plugins. `set` returns an error to show, or nothing. */
export type PluginSetting =
	| {kind: 'text'; id: string; label: string; description: string; placeholder?: string; value: () => string; valueText?: () => string; set: (v: string) => string | void}
	| {kind: 'toggle'; id: string; label: string; description: string; value: () => boolean; set: (on: boolean) => void}
	| {kind: 'action'; id: string; label: string; description: string; valueText?: () => string; run: () => void};

// ---------- Films & series ----------

/** a title as a plugin sees it: what Lumen knows of the focused title */
export interface TitleRef {
	type: 'movie' | 'tv';
	title: string;
	year?: number;
	tmdbId?: string;
	/** the library's film or series (an episode: its series) */
	jellyfinId?: string;
	/** the library's film or episode playing on that button (Play) */
	fileId?: string;
	/** in the library, all of it or some seasons */
	here: boolean;
	/** the catalog's record of it, once read */
	details?: SeerrTitle;
}

/** a row of posters (titles) or of tiles (a genre, a platform: OK opens a page) */
export interface Row { id: string; label: string; titles?: SeerrTitle[]; tiles?: Tile[] }
export interface Tile { key: string; name: string; image?: string; /** the picture is a logo, drawn whole */ logo?: boolean; page: PageRef }
export type PageRef = {kind: 'platform'; id: string} | {kind: 'person'; person: SeerrPerson} | {kind: 'tile'; id: string};
/** a page over the tabs: rows, and optionally one button for some of its titles (« Request the missing ones ») */
export interface Page { name: string; logo?: string; rows: Row[]; action?: PageAction }
export interface PageAction { label: string; applies: (t: SeerrTitle) => boolean; run: () => Promise<ActionResult> }
/** a chip under a title's facts (a season's state) */
export interface Chip { text: string; tone?: 'ok' | 'busy' | 'asked' | 'none' }

export interface CatalogSource {
	/** Discover's rows, in order, as they come; `onForYou` the day's picks (null: none) */
	discover: (onRows: (rows: Row[]) => void, onForYou: (titles: SeerrTitle[] | null) => void) => void;
	/** titles not in the library matching `text` (the library's are Jellyfin's) */
	search: (text: string) => Promise<SeerrTitle[]>;
	/** the full record: cast, seasons, the person's score (`mine`), `later`, `release` */
	title: (t: TitleRef) => Promise<SeerrTitle>;
	/** chips under the title (a series' seasons), once its record is read */
	chips?: (t: TitleRef, record: SeerrTitle) => Promise<Chip[]>;
	page: (ref: PageRef) => Promise<Page>;
	/** Discover's row of platforms */
	platforms: () => Promise<Tile[]>;
	/** true, or a message to show */
	request: (t: SeerrTitle, seasons?: number[]) => Promise<true | string>;
	/** the person's requests not in the library yet (the home screen's row) */
	requestsMine: () => Promise<SeerrTitle[]>;
}

export interface TitleAction { id: string; label: string; run: () => Promise<ActionResult> }
/** what Lumen does after an action: say something, open a page, a form or a short list, or read the title again */
export interface ActionResult {
	toast?: string;
	error?: string;
	page?: Promise<Page>;
	form?: FormSpec;
	choice?: ChoiceSpec;
	/** read the title's record again (a button's label changes) */
	reload?: boolean;
}
/** a form over the screen: one of a few options, a line of text (the TV's keyboard), Send; notes under it */
export interface FormSpec {
	heading: string;
	title: string;
	options: {id: string; label: string; hint?: string}[];
	placeholder: string;
	notes?: {text: string; tone?: 'ok' | 'busy'}[];
	send: (option: string, text: string) => Promise<ActionResult>;
}
export interface ChoiceSpec { title: string; note?: string; rows: string[]; pick: (row: number) => Promise<ActionResult> }

export interface RatedTitle { id: string; type: 'Movie' | 'Series'; title: string; year?: number }

// ---------- the player ----------

export interface SavedChoice { subtitle?: {index: number; lang?: string} | 'off'; offset?: number }
export interface ChoiceStore {
	/** the subtitle choice of the film or series (`titleId`) and the timing of the file (`fileId`); null: none kept there */
	load: (titleId: string, fileId: string) => Promise<SavedChoice | null>;
	subtitle: (titleId: string, track: {index: number; lang?: string} | null) => void;
	/** called on each press; the store decides when to send */
	offset: (fileId: string, seconds: number) => void;
	/** the player closes or the file changes */
	flush: () => void;
}
