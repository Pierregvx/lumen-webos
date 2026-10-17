// The user's choices: which apps and which inputs appear on the home rows, in order,
// plus options. Persisted in localStorage (private to this app on the TV).

import {STORAGE_KEY} from '../config/constants';
import {DEFAULT_APP_IDS} from '../config/catalog';

export interface UserConfig {
	/** ordered app IDs for the Apps row */
	appIds: string[];
	/** ordered input appIds (com.webos.app.hdmiN) for the Sources row; null → all inputs */
	sourceIds: string[] | null;
	/** read the live app list through the Homebrew Channel (root). Off by default. */
	useHomebrew: boolean;
	/** play a video behind the home screen (aerials and stock clips, streamed from the internet). Off by default. */
	videoWallpaper: boolean;
	/** which still wallpaper: local:N (bundled), cloud:<id> (from the library), shuffle, or none */
	wallpaper: string;
	/** show AM/PM beside the time when the TV uses a 12-hour clock */
	showAmPm: boolean;
	/** menu language: 'auto' follows the TV, else a code from lib/i18n.ts */
	language: string;
	/** 'auto' follows the TV's 12/24-hour setting, else '12h' or '24h' */
	clockFormat: string;
	/** place the video wallpaper plays ('' = shuffle all) (the older single choice, now videoPlaces) */
	videoClip: string;
	/** the places the video wallpaper shuffles through; empty = every place */
	videoPlaces: string[];
	/** when the dock slides away: off | down | idle | both */
	dockHide: string;
	/** dark glass and a dimmer wallpaper */
	darkMode: string;
	/** the last apps opened, newest first */
	recentIds: string[];
	/** start the screensaver after this many idle minutes; 0 = never */
	idleMinutes: number;
	/** cloud wallpaper ids marked as favourites (hold OK in the picker) */
	favoriteWallpapers: string[];
	/** pick a new wallpaper every N minutes when a shuffle is chosen; 0 = never */
	wpAutoMinutes: number;
	/** dim the wallpaper between 19:00 and 06:00 */
	nightDim: boolean;
	/** offer the TV's own apps (Live TV, AirPlay ...) in Settings */
	showAllApps: boolean;
	/** date and weather beside the clock */
	showWeather: boolean;
	/** weather country (a code from config/cities.ts), '' = not chosen */
	weatherCountry: string;
	/** weather place: '' = from the internet connection, else a name from config/cities.ts */
	weatherCity: string;
	/** app folders: apps listed here are shown inside the folder, not on the rows */
	folders: {name: string; appIds: string[]}[];
	/** no transitions or animations */
	reduceMotion: boolean;
	/** no app names under the tiles on the home screen */
	hideNames: boolean;
	/** test: glass blurs what is behind it live (backdrop-filter) instead of showing a pre-blurred copy of the wallpaper */
	liveBlur: boolean;
	/** Screensaver: '' = LG's own; an Immich source (immich:recent, immich:album:<id>, ...) = Lumen's ambient screen with those photos */
	ambient: string;
	/** seconds each photo stays on the ambient screen */
	ambientSeconds: number;
	/** how strongly the focused tile stands out: subtle | normal | strong */
	focusStrength: string;
	/** apps in the first row (the glass bar): 5, 6 or 7 */
	firstRow: number;
	/** when the video wallpaper plays: always | day (7:00-19:00) | evening (17:00-23:00) | night (19:00-7:00); the still wallpaper otherwise */
	videoHours: string;
	/** dev builds: show the frame-rate counter (lib/fps.ts) */
	fpsCounter: boolean;
	/** false on a fresh install until the installed apps have been put on the home screen once */
	seeded: boolean;
	/** the built-in tiles (Settings, TV Settings, Inputs) have been put on the home screen once; taken off, they stay off */
	builtinTiles: boolean;
	/** a row of aerial channels under the apps, with what is on now (needs the Homebrew Channel) */
	liveTvRow: boolean;
	/** the Live TV row's channels (channel ids), in order, picked in Settings > Channels; null = the first five by number */
	liveChannels: string[] | null;
	/** the Guide opens on the Full guide (the time grid) rather than Now and Next; the switcher at its top right sets it */
	guideFull: boolean;
}

export const DEFAULT_CONFIG: UserConfig = {
	appIds: DEFAULT_APP_IDS.slice(),
	sourceIds: null,
	useHomebrew: true,
	videoWallpaper: false,
	wallpaper: 'local:0',
	showAmPm: true,
	language: 'auto',
	darkMode: 'on',
	dockHide: 'down',
	videoClip: '',
	videoPlaces: [],
	clockFormat: 'auto',
	recentIds: [],
	idleMinutes: 0,
	favoriteWallpapers: [],
	wpAutoMinutes: 0,
	nightDim: false,
	showAllApps: false,
	showWeather: true,
	weatherCountry: '',
	weatherCity: '',
	folders: [],
	reduceMotion: false,
	hideNames: false,
	liveBlur: true,
	ambient: '',
	ambientSeconds: 30,
	focusStrength: 'normal',
	firstRow: 6,
	videoHours: 'always',
	fpsCounter: false,
	seeded: false,
	builtinTiles: false,
	liveTvRow: true,
	liveChannels: null,
	guideFull: false
};

export function loadConfig (): UserConfig {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? parseConfig(raw) : {...DEFAULT_CONFIG};
	} catch {
		return {...DEFAULT_CONFIG};
	}
}

/** Whether this install has settings of its own yet (false on a fresh install, before anything has been saved). */
export function hasSavedConfig (): boolean {
	try { return localStorage.getItem(STORAGE_KEY) !== null; } catch { return false; }
}

/** A config from JSON, with every field checked and anything missing or wrong replaced by its default. Throws on malformed JSON. */
export function parseConfig (raw: string): UserConfig {
	const parsed = JSON.parse(raw) as Partial<UserConfig>;
	return {
		appIds: Array.isArray(parsed.appIds) ? parsed.appIds : DEFAULT_CONFIG.appIds,
		sourceIds: Array.isArray(parsed.sourceIds) ? parsed.sourceIds : null,
		useHomebrew: parsed.useHomebrew !== false,
		videoWallpaper: parsed.videoWallpaper === true,
		wallpaper: typeof parsed.wallpaper === 'string' ? parsed.wallpaper : DEFAULT_CONFIG.wallpaper,
		showAmPm: parsed.showAmPm !== false,
		dockHide: parsed.dockHide === 'off' || parsed.dockHide === 'idle' || parsed.dockHide === 'both' ? parsed.dockHide : 'down',
		darkMode: parsed.darkMode === 'auto' ? 'auto' : parsed.darkMode === 'off' ? 'off' : 'on',
		videoClip: typeof parsed.videoClip === 'string' ? parsed.videoClip : '',
		videoPlaces: Array.isArray(parsed.videoPlaces) ? parsed.videoPlaces : typeof parsed.videoClip === 'string' && parsed.videoClip ? [parsed.videoClip] : [],
		language: typeof parsed.language === 'string' ? parsed.language : 'auto',
		clockFormat: parsed.clockFormat === '12h' || parsed.clockFormat === '24h' ? parsed.clockFormat : 'auto',
		recentIds: Array.isArray(parsed.recentIds) ? parsed.recentIds : [],
		idleMinutes: typeof parsed.idleMinutes === 'number' ? parsed.idleMinutes : 0,
		favoriteWallpapers: Array.isArray(parsed.favoriteWallpapers) ? parsed.favoriteWallpapers : [],
		wpAutoMinutes: typeof parsed.wpAutoMinutes === 'number' ? parsed.wpAutoMinutes : 0,
		nightDim: parsed.nightDim === true,
		showAllApps: parsed.showAllApps === true,
		showWeather: parsed.showWeather !== false,
		weatherCountry: typeof parsed.weatherCountry === 'string' ? parsed.weatherCountry : '',
		weatherCity: typeof parsed.weatherCity === 'string' ? parsed.weatherCity : '',
		folders: Array.isArray(parsed.folders) ? parsed.folders : [],
		reduceMotion: parsed.reduceMotion === true,
		hideNames: parsed.hideNames === true,
		liveBlur: parsed.liveBlur !== false,
		ambientSeconds: [10, 20, 30, 60, 120, 300].indexOf(Number(parsed.ambientSeconds)) !== -1 ? Number(parsed.ambientSeconds) : 30,
		ambient: typeof parsed.ambient === 'string' && parsed.ambient.indexOf('immich:') === 0 ? parsed.ambient : '',
		focusStrength: parsed.focusStrength === 'subtle' || parsed.focusStrength === 'strong' ? parsed.focusStrength : 'normal',
		firstRow: parsed.firstRow === 5 || parsed.firstRow === 7 ? parsed.firstRow : 6,
		videoHours: parsed.videoHours === 'day' || parsed.videoHours === 'evening' || parsed.videoHours === 'night' ? parsed.videoHours : 'always',
		fpsCounter: parsed.fpsCounter === true,
		seeded: parsed.seeded !== false,
		builtinTiles: parsed.builtinTiles === true,
		liveTvRow: parsed.liveTvRow !== false,
		liveChannels: Array.isArray(parsed.liveChannels) ? parsed.liveChannels.filter((x) => typeof x === 'string') : null,
		guideFull: parsed.guideFull === true
	};
}

export function saveConfig (config: UserConfig): void {
	try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); }
	catch { /* nothing sensible to do on a TV */ }
}

/** Toggle an ID in an ordered list: remove if present, else append. */
export function toggleId (ids: string[], id: string): string[] {
	return ids.indexOf(id) === -1 ? ids.concat(id) : ids.filter((x) => x !== id);
}
