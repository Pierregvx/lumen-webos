import {useCallback, useEffect, useMemo, useRef, useState} from 'preact/hooks';
import {Home, type HomeRow} from './screens/Home';
import {Settings, type SettingsTab, type WallpaperTab} from './screens/Settings';
import {Guide} from './screens/Guide';
import type {WallpaperEntry} from './components/WallpaperPicker';
import type {OptionItem} from './components/SettingsList';
import {Toast, type ToastMessage} from './components/Toast';
import type {TileModel} from './components/Tile';
import {BUILTIN, BUILTIN_APPS, withBuiltins} from './config/builtinApps';
import {cachedApps, listApps, sameApps, saveAppsCache, seedAppIds, type AppEntry} from './lib/apps';
import {afterFirstFrame, readCache, writeCache} from './lib/boot';
import {listInputs, MOCK_INPUTS, type InputSource} from './lib/inputs';
import {launchApp, launchLgHome} from './lib/launch';
import {isWebOS} from './lib/luna';
import {hidePointerOnForeground} from './lib/pointer';
import {DEFAULT_CONFIG, DOCK_IDLE_SECONDS, hasSavedConfig, loadConfig, saveConfig, toggleId, type UserConfig} from './lib/storage';
import {readBackup, scheduleBackup} from './lib/backup';
import {onRelaunch, startParams, type LaunchParams} from './lib/launchParams';
import {appTile, inputTile, pickInOrder} from './lib/tiles';
import {TIMING} from './config/constants';
import {LOCAL_WALLPAPERS, WALLPAPERS, WALLPAPER_CATEGORIES, cloudUrl} from './config/wallpapers';
import {resized, setFavorites, setLiveBlur, setWallpaper} from './lib/wallpaper';
import {restoreLeftoverBacklight} from './lib/tvcontrols';
import {albums as immichAlbums, cachedServer, IMMICH_SOURCES, loadServer} from './lib/immich';
import {Ambient} from './components/Ambient';
import {setVideoChoice, setVideoPaused, setVideoWallpaper, VIDEO_PLACES} from './lib/wallpaperVideo';
import {setAmbientFlag, setVideoFlag, startScreensaver} from './lib/system';
import {setFpsCounter} from './lib/fps';
import {ControlCenter, type CenterAction} from './components/ControlCenter';
import {CITIES, COUNTRIES} from './config/cities';
import {AUTO_PLACE, peekWeather, readWeather, type Weather} from './lib/weather';
import {useLiveTv} from './hooks/useLiveTv';
import {channelColor, nowNextAt, rowChannels, type Channel} from './lib/livetv';
import {openChannel} from './lib/root';
import {bootMark, navMark} from './lib/log';
import {isDark, LANGS, nextDark, setClockMode, setLang} from './lib/i18n';

type Screen = 'home' | 'settings' | 'ambient' | 'guide';

const ROW = {apps: 'apps', sources: 'sources', misc: 'misc', dock: 'dock', live: 'livetv', channels: 'channels'} as const;
/** the Live TV row: the Guide tile first, then its channels' tiles (channel:<channelId>) */
const LIVE = {prefix: 'channel:', guide: 'livetv:guide'} as const;
/** the width of a channel tile's now/next block (.chan__info in global.css): the row scrolls on so the focused tile always has this to its right */
const LIVE_INFO_W = 660;
/** how much higher the Live TV row sits when focused, so its now/next block fits on screen */
const LIVE_BELOW = 150;
const MISC = {lgHome: 'lg-home', settings: 'settings'} as const;
const OPTION = {liveTv: 'live-tv-row', ambient: 'ambient', ambientSeconds: 'ambient-seconds', ambientBrightness: 'ambient-brightness', fps: 'fps-counter', restore: 'restore-backup', focus: 'focus-strength', firstRow: 'first-row', videoHours: 'video-hours', liveBlur: 'live-blur', reduceMotion: 'reduce-motion', hideNames: 'hide-names', useHomebrew: 'use-homebrew', videoWallpaper: 'video-wallpaper', videoClip: 'video-clip', dockHide: 'dock-hide', dockIdle: 'dock-idle', showAmPm: 'show-ampm', showAll: 'show-all-apps', weather: 'show-weather', city: 'weather-city', country: 'weather-country', idle: 'idle-screensaver', wpAuto: 'wp-auto', nightDim: 'night-dim', darkMode: 'dark-mode', language: 'language', clock: 'clock-format'} as const;
const WP_AUTO_CHOICES = [0, 0.5, 1, 5, 15, 30, 60];   // minutes
/** when the video wallpaper plays (Settings > Wallpaper > Video wallpaper hours): [first hour, hour it stops]; always = no limit */
const VIDEO_HOURS: Record<string, [number, number]> = {day: [7, 19], evening: [17, 23], night: [19, 7]};
function inVideoHours (mode: string, now = new Date()): boolean {
	const span = VIDEO_HOURS[mode];
	if (!span) return true;
	const h = now.getHours();
	return span[0] < span[1] ? h >= span[0] && h < span[1] : h >= span[0] || h < span[1];
}
/** tile sizes for 5, 6 or 7 apps a row: always about 1670px wide, with 40px of glass round them (the bar about 91% of the screen), still 5:3 */
const TILES_FOR: Record<number, {size: number; height: number; gap: number}> = {5: {size: 288, height: 173, gap: 58}, 6: {size: 240, height: 144, gap: 46}, 7: {size: 206, height: 124, gap: 38}};
const IDLE_CHOICES = [0, 5, 10, 20, 30];
/** the backlight the screensaver lowers the TV to, by Settings > Screensaver > Brightness */
const AMBIENT_BACKLIGHT: Record<string, number> = {dim: 30, low: 10};
const RECENT_MAX = 8;
/** what the last launch showed, drawn at once on a cold start (lib/boot.ts) */
const INPUTS_CACHE_KEY = 'lumen-boot-inputs-v1';

/** The top bar: Inputs, Control Center and Settings. */
const TOP_ITEMS: TileModel[] = [
	{key: 'inputs', label: 'Inputs', glyph: 'inputs'},
	{key: 'controls', label: 'Control Center', glyph: 'sliders'},
	{key: MISC.settings, label: 'Settings', glyph: 'gear'}
];
/** What the time pill's menu lists. */
const MENU_ITEMS: TileModel[] = [
	{key: 'controls', label: 'Quick Controls', glyph: 'sliders'},
	{key: MISC.lgHome, label: 'LG Home', glyph: 'house'},
	{key: MISC.settings, label: 'Settings', glyph: 'gear'},
	{key: 'screensaver', label: 'Start Screensaver', glyph: 'screensaver'}
];


export function App () {
	const [screen, setScreen] = useState<Screen>(import.meta.env.DEV && /[?&]settings/.test(location.search) ? 'settings' : 'home');
	// Immich (Settings > Wallpaper > Photos): whether a server is set up on the TV, and its albums; read again each time Settings opens
	const [immich, setImmich] = useState<{ready: boolean; albums: {id: string; title: string}[]}>({ready: !!cachedServer(), albums: []});
	useEffect(() => {
		if (screen !== 'settings') return;
		loadServer().then((srv) => {
			if (!srv) { setImmich({ready: false, albums: []}); return; }
			immichAlbums(srv).then((a) => setImmich({ready: true, albums: a}), () => setImmich({ready: true, albums: []}));
		});
	}, [screen]);
	const [config, setConfig] = useState<UserConfig>(loadConfig);
	// set before anything renders, so every label below reads the chosen language and clock
	setLang(config.language);
	setClockMode(config.clockFormat);
	// a cold start draws what the last launch showed (lib/boot.ts); the TV is asked again once the first frame is up
	const [apps, setApps] = useState<AppEntry[]>(() => cachedApps(config.useHomebrew, config.showAllApps) || []);
	const [inputs, setInputs] = useState<InputSource[]>(() => (isWebOS() && readCache<InputSource[]>(INPUTS_CACHE_KEY)) || []);
	const [toast, setToast] = useState<ToastMessage | null>(null);
	const [controls, setControls] = useState(false);
	const configRef = useRef(config);
	configRef.current = config;
	const toastTimer = useRef(0);
	// a fresh install first looks for the settings backup on the TV (lib/backup.ts); nothing is seeded until that has answered
	const [restoring, setRestoring] = useState(() => !hasSavedConfig());
	const [focusRow, setFocusRow] = useState<{id: string; seq: number} | undefined>(undefined);
	const live = useLiveTv(config.liveTvRow, screen === 'guide', config.liveChannels, screen === 'guide' && config.guideFull);

	const showToast = useCallback((text: string, kind: ToastMessage['kind'] = 'info') => {
		window.clearTimeout(toastTimer.current);
		setToast({text, kind});
		toastTimer.current = window.setTimeout(() => setToast(null), TIMING.toastMs);
	}, []);

	// Magic Remote scroll wheel = Up/Down (rows on the home screen, lists and grids elsewhere)
	useEffect(() => {
		let last = 0;
		const onWheel = (e: WheelEvent) => {
			const now = Date.now();
			if (now - last < 220 || Math.abs(e.deltaY) < 4) return;
			last = now;
			const code = e.deltaY > 0 ? 40 : 38;
			window.dispatchEvent(new KeyboardEvent('keydown', {keyCode: code, which: code, bubbles: true}));
		};
		window.addEventListener('wheel', onWheel, {passive: true});
		return () => window.removeEventListener('wheel', onWheel);
	}, []);

	useEffect(() => {
		if (!restoring) return;
		readBackup().then((saved) => {
			if (saved && !hasSavedConfig()) { updateConfig(saved); showToast('Settings restored from the TV'); }
			setRestoring(false);
		});
	}, []);

	// launch parameters: {"view":"recent"} opens on the app grid (it opened the Recent row, which has gone: every app is in the grid)
	useEffect(() => {
		let seq = 0;
		const apply = (p: LaunchParams) => {
			if (p.view === 'recent') setFocusRow({id: ROW.dock, seq: ++seq});
			// watch.sh opens Lumen with {"view":"ambient"} when the TV's screensaver starts (Settings > Screensaver)
			if (p.view === 'ambient' && configRef.current.ambient) setScreen('ambient');
			// a plain relaunch is the remote's Home button: back to the home screen from Settings, the Guide, the screensaver or Control Center
			if (!p.view) { setScreen('home'); setControls(false); }
		};
		apply(startParams());
		return onRelaunch(apply);
	}, []);

	// Start in remote (5-way) mode: hide the Magic Remote pointer whenever we come to the
	// front. Shaking the remote still brings it back.
	useEffect(() => hidePointerOnForeground(), []);

	// Load apps at start and whenever the Homebrew option changes; refresh inputs whenever
	// the app comes back to the foreground (labels or connections may have changed).
	// With a list from the last launch on screen, the first read waits for the first frame; a changed option reads at once.
	const appsShown = useRef(apps);
	appsShown.current = apps;
	const firstAppsRead = useRef(true);
	useEffect(() => {
		const useHomebrew = config.useHomebrew;
		const showAll = config.showAllApps;
		const read = () => listApps(useHomebrew, showAll)
			.then(({apps: list, source}) => {
				bootMark('apps');
				if (!sameApps(list, appsShown.current)) setApps(list);
				saveAppsCache(useHomebrew, showAll, list);
				if (useHomebrew && source !== 'homebrew') showToast('Homebrew Channel not available, using the built-in app list', 'error');
			})
			.catch(() => showToast('Could not read the app list', 'error'));
		const wait = firstAppsRead.current && apps.length > 0;
		firstAppsRead.current = false;
		if (!wait) { read(); return undefined; }
		return afterFirstFrame(read);
	}, [config.useHomebrew, config.showAllApps, showToast]);

	useEffect(() => {
		const refresh = () => {
			if (!isWebOS()) { setInputs(MOCK_INPUTS); return; }
			listInputs().then((list) => {
				writeCache(INPUTS_CACHE_KEY, list);
				setInputs((now) => (JSON.stringify(now) === JSON.stringify(list) ? now : list));
			}).catch(() => showToast('Could not read the inputs', 'error'));
		};
		const cancel = isWebOS() ? afterFirstFrame(refresh) : (refresh(), () => undefined);
		const onVisibility = () => { if (!document.hidden) refresh(); };
		document.addEventListener('visibilitychange', onVisibility);
		return () => { cancel(); document.removeEventListener('visibilitychange', onVisibility); };
	}, [showToast]);

	useEffect(() => { setFavorites(config.favoriteWallpapers); setWallpaper(config.wallpaper); }, [config.wallpaper]);
	useEffect(() => setFavorites(config.favoriteWallpapers), [config.favoriteWallpapers]);

	// the weather under the clock at the top left
	const weatherCity = (c: UserConfig) => (c.weatherCity === AUTO_PLACE ? null : CITIES.filter((x) => x.name === c.weatherCity)[0] || null);
	// the last reading is shown at once on a cold start, however old, so the pill does not change size when the new one comes in
	const [weather, setWeather] = useState<Weather | null>(() => (config.showWeather && config.weatherCity && (config.weatherCity === AUTO_PLACE || weatherCity(config)) ? peekWeather(weatherCity(config)) : null));
	useEffect(() => {
		// no place chosen, no weather (and no request to anyone): Auto, which asks ipwho.is, has to be picked on purpose
		if (!config.showWeather || !config.weatherCity) { setWeather(null); return; }
		const city = weatherCity(config);
		if (!city && config.weatherCity !== AUTO_PLACE) { setWeather(null); return; }
		const load = () => readWeather(city).then(setWeather).catch(() => setWeather(null));
		const cancel = afterFirstFrame(load);
		const id = window.setInterval(load, 30 * 60000);
		return () => { cancel(); window.clearInterval(id); };
	}, [config.showWeather, config.weatherCity]);

	// a new wallpaper every N minutes (only for a shuffle or Immich photos: a fixed picture has nothing to change to)
	useEffect(() => {
		if (!config.wpAutoMinutes || (config.wallpaper.indexOf('shuffle') !== 0 && config.wallpaper.indexOf('immich:') !== 0)) return;
		const id = window.setInterval(() => { if (!document.hidden) setWallpaper(config.wallpaper); }, config.wpAutoMinutes * 60000);
		return () => window.clearInterval(id);
	}, [config.wpAutoMinutes, config.wallpaper]);

	// a backlight left low by a screensaver that never ended goes back up
	useEffect(() => afterFirstFrame(restoreLeftoverBacklight, 3000), []);

	// night: a dimmer wallpaper between 19:00 and 06:00
	useEffect(() => {
		const apply = () => { const h = new Date().getHours(); document.documentElement.classList.toggle('night', config.nightDim && (h >= 19 || h < 6)); };
		apply();
		const id = window.setInterval(apply, 60000);
		return () => { window.clearInterval(id); document.documentElement.classList.remove('night'); };
	}, [config.nightDim]);
	useEffect(() => {
		const apply = () => { const dark = isDark(config.darkMode); document.documentElement.classList.toggle('dark', dark); document.documentElement.classList.toggle('light', !dark); };
		apply();
		const id = window.setInterval(apply, 60000);
		return () => window.clearInterval(id);
	}, [config.darkMode]);
	useEffect(() => { document.documentElement.classList.toggle('reduce-motion', config.reduceMotion); }, [config.reduceMotion]);
	useEffect(() => { document.documentElement.classList.toggle('hide-names', config.hideNames); }, [config.hideNames]);
	useEffect(() => setFpsCounter(__LUMEN_DEV__ && config.fpsCounter), [config.fpsCounter]);
	useEffect(() => { document.documentElement.classList.toggle('liveblur', config.liveBlur); setLiveBlur(config.liveBlur); }, [config.liveBlur]);
	useEffect(() => setVideoChoice(config.videoPlaces), [config.videoPlaces]);
	// the video wallpaper plays only within its hours (checked each minute); the still wallpaper shows the rest of the time
	const [videoTime, setVideoTime] = useState(() => inVideoHours(config.videoHours));
	useEffect(() => {
		const check = () => setVideoTime(inVideoHours(config.videoHours));
		check();
		const id = window.setInterval(check, 60000);
		return () => window.clearInterval(id);
	}, [config.videoHours]);
	const videoOn = config.videoWallpaper && videoTime;
	useEffect(() => setVideoWallpaper(videoOn), [videoOn]);
	useEffect(() => {
		const root = document.documentElement.classList;
		root.toggle('focus-subtle', config.focusStrength === 'subtle');
		root.toggle('focus-strong', config.focusStrength === 'strong');
	}, [config.focusStrength]);
	useEffect(() => { setAmbientFlag(config.ambient !== ''); }, [config.ambient]);
	useEffect(() => { setVideoPaused(screen !== 'home'); document.documentElement.classList.toggle('in-settings', screen === 'settings' || screen === 'guide'); }, [screen]);
	const lastScreen = useRef(screen);
	useEffect(() => { if (lastScreen.current !== screen) navMark(`${lastScreen.current}>${screen}`); lastScreen.current = screen; }, [screen]);

	const updateConfig = (next: UserConfig) => { configRef.current = next; setConfig(next); saveConfig(next); scheduleBackup(next); };

	// first run: put the installed apps on the home screen (the catalogue's favourites first)
	useEffect(() => {
		const c = configRef.current;
		if (restoring || apps.length === 0) return;
		const builtins = (ids: string[]) => ids.concat(BUILTIN_APPS.map((b) => b.id).filter((id) => ids.indexOf(id) === -1));
		if (!c.seeded) updateConfig({...c, seeded: true, builtinTiles: true, appIds: builtins(seedAppIds(apps, DEFAULT_CONFIG.appIds))});
		// an install from before the built-in tiles: add them once at the end
		else if (!c.builtinTiles) updateConfig({...c, builtinTiles: true, appIds: builtins(c.appIds)});
	}, [apps, restoring]);
	const allApps = useMemo(() => withBuiltins(apps), [apps]);

	// idle screensaver: after the chosen minutes without a key press or pointer move, while the launcher is in front
	useEffect(() => {
		if (!config.idleMinutes || videoOn) return;   // no screensaver of our own while the video plays
		let timer = 0;
		const arm = () => {
			window.clearTimeout(timer);
			timer = window.setTimeout(() => { if (!document.hidden) startScreensaver().catch(() => undefined); }, config.idleMinutes * 60000);
		};
		arm();
		const events = ['keydown', 'mousemove', 'click'];
		events.forEach((e) => window.addEventListener(e, arm));
		return () => { window.clearTimeout(timer); events.forEach((e) => window.removeEventListener(e, arm)); };
	}, [config.idleMinutes, videoOn]);
	useEffect(() => { setVideoFlag(videoOn); }, [videoOn]);

	// ----- derived rows -----
	const shownApps = useMemo(() => pickInOrder(allApps, config.appIds, (a) => a.id), [allApps, config.appIds]);
	const shownInputs = useMemo(
		() => (config.sourceIds ? pickInOrder(inputs, config.sourceIds, (s) => s.appId) : inputs),
		[inputs, config.sourceIds]
	);


	const folderTiles = useMemo(
		() => config.folders.map((f) => ({name: f.name, items: pickInOrder(allApps, f.appIds, (a) => a.id).map(appTile)})).filter((f) => f.items.length > 0),
		[allApps, config.folders]
	);
	const folderMap = useMemo(() => {
		const map: Record<string, TileModel[]> = {};
		folderTiles.forEach((f) => { map[f.name] = f.items; });
		return map;
	}, [folderTiles]);
	/** what the home rows show: the apps that are not in a folder, then one tile per folder */
	const homeTiles = useMemo(() => {
		const inFolder = config.folders.reduce((all, f) => all.concat(f.appIds), [] as string[]);
		return shownApps.filter((a) => inFolder.indexOf(a.id) === -1).map(appTile)
			.concat(folderTiles.map((f): TileModel => ({key: 'folder:' + f.name, label: f.name, color: '#3b4256', children: f.items.map((t) => t.imageUrl)})));
	}, [shownApps, folderTiles, config.folders]);

	// the first row (in the glass bar) holds config.firstRow apps; the rest make a grid of rows as wide below it, like the tvOS home screen
	// (the grid rows are 'dock', 'dock:1', 'dock:2'...)
	const firstRow = config.firstRow;
	/** the Live TV row: the Guide tile, then the channels picked in Settings > Channels (or the first few), each with what is on now */
	const liveTiles = useMemo((): TileModel[] => {
		if (!config.liveTvRow || !live.channels.length) return [];
		const guide: TileModel = {key: LIVE.guide, label: 'Guide', glyph: 'guide', color: 'rgba(255, 255, 255, 0.16)'};
		return [guide].concat(rowChannels(live.channels, config.liveChannels).map((c): TileModel => ({
			key: LIVE.prefix + c.id,
			label: c.name,
			live: {number: c.number, name: c.name, logo: c.logoPath && live.logos[c.logoPath], at: live.now, ...nowNextAt(live.listings[c.signal], live.now)}
		})));
	}, [config.liveTvRow, config.liveChannels, live, config.language]);
	/** the furthest along the row a focused channel may sit with its now/next block still on the row (Row's slot) */
	const liveSlot = useMemo(() => {
		const t = TILES_FOR[firstRow] || TILES_FOR[6];
		return Math.max(0, Math.floor((firstRow * (t.size + t.gap) - t.gap - LIVE_INFO_W) / (t.size + t.gap)));
	}, [firstRow]);
	const rows: HomeRow[] = useMemo(() => {
		const list: HomeRow[] = [{id: ROW.apps, label: 'Apps', items: homeTiles.slice(0, firstRow), emptyText: 'No apps selected — add some in Settings'}];
		for (let at = firstRow, n = 0; at < homeTiles.length; at += firstRow, n++) list.push({id: n ? `${ROW.dock}:${n}` : ROW.dock, label: 'More apps', items: homeTiles.slice(at, at + firstRow)});
		if (liveTiles.length) list.push({id: ROW.live, label: 'Live TV', titled: true, className: 'row--live', below: LIVE_BELOW, slot: liveSlot, items: liveTiles});
		return list;
	}, [homeTiles, shownInputs, config.language, firstRow, liveTiles, liveSlot]);

	// Settings' tabs are only built while Settings is open
	const inSettings = screen === 'settings';
	const tabs: SettingsTab[] = useMemo(() => {
		if (!inSettings) return [];
		const list: SettingsTab[] = [
			{id: ROW.apps, label: 'Apps', glyph: 'grid', noun: 'apps', items: allApps.map(appTile), shown: shownApps.map(appTile)},
			{id: ROW.sources, label: 'Sources', glyph: 'inputs', noun: 'sources', items: inputs.map(inputTile), shown: shownInputs.map(inputTile)}
		];
		// the Live TV row's channels: every channel, the row's ticked, in the row's order
		if (config.liveTvRow && live.channels.length) {
			const tile = (c: Channel): TileModel => {
				const logo = c.logoPath && live.logos[c.logoPath];
				return {key: c.id, label: `${c.number} · ${c.name}`, imageUrl: logo || undefined, plain: true, color: `linear-gradient(160deg, rgba(255, 255, 255, 0.1) 0%, rgba(0, 0, 0, 0.28) 100%) ${channelColor(c.name) || '#22263a'}`, wordmark: logo ? undefined : c.name};
			};
			list.push({id: ROW.channels, label: 'Channels', glyph: 'guide', noun: 'channels', items: live.channels.map(tile), shown: rowChannels(live.channels, config.liveChannels).map(tile)});
		}
		return list;
	}, [inSettings, allApps, inputs, shownApps, shownInputs, config.language, config.liveTvRow, config.liveChannels, live.channels, live.logos]);

	/** options that pick from a list: the labels shown in the pop-up list, the stored values, and which one is set now */
	type Choice = {labels: string[]; values: (string | number)[]; now: string | number};
	const choices: Record<string, Choice> = useMemo(() => {
		const country = COUNTRIES.filter((c) => c.code === config.weatherCountry)[0];
		const cities = (country ? country.cities : CITIES).map((c) => c.name);
		return {
			[OPTION.country]: {labels: ['Any'].concat(COUNTRIES.map((c) => c.name)), values: [''].concat(COUNTRIES.map((c) => c.code)), now: config.weatherCountry},
			[OPTION.city]: {labels: ['Not set', 'Auto'].concat(cities), values: ['', AUTO_PLACE].concat(cities), now: config.weatherCity},
			[OPTION.wpAuto]: {labels: ['Off', '30 sec', '1 min', '5 min', '15 min', '30 min', '60 min'], values: WP_AUTO_CHOICES, now: config.wpAutoMinutes},
			[OPTION.dockHide]: {labels: ['Off', 'Down arrow', 'After idle', 'Both'], values: ['off', 'down', 'idle', 'both'], now: config.dockHide},
			[OPTION.dockIdle]: {labels: ['30 seconds', '1 minute', '2 minutes', '5 minutes'], values: DOCK_IDLE_SECONDS, now: config.dockIdleSeconds},
			[OPTION.darkMode]: {labels: ['Light', 'Dark', 'Auto'], values: ['off', 'on', 'auto'], now: config.darkMode},
			[OPTION.language]: {labels: ['Auto'].concat(LANGS.map((l) => l.name)), values: ['auto'].concat(LANGS.map((l) => l.code)), now: config.language},
			[OPTION.clock]: {labels: ['Auto', '12-hour', '24-hour'], values: ['auto', '12h', '24h'], now: config.clockFormat},
			[OPTION.focus]: {labels: ['Subtle', 'Normal', 'Strong'], values: ['subtle', 'normal', 'strong'], now: config.focusStrength},
			[OPTION.firstRow]: {labels: ['5', '6', '7'], values: [5, 6, 7], now: config.firstRow},
			[OPTION.ambient]: {labels: ['LG\'s own'].concat(IMMICH_SOURCES.map((x) => `Photos: ${x.title}`), immich.albums.map((a) => `Photos: ${a.title}`)), values: [''].concat(IMMICH_SOURCES.map((x) => x.key), immich.albums.map((a) => `immich:album:${a.id}`)), now: config.ambient},
			[OPTION.ambientSeconds]: {labels: ['10 seconds', '20 seconds', '30 seconds', '1 minute', '2 minutes', '5 minutes'], values: [10, 20, 30, 60, 120, 300], now: config.ambientSeconds},
			[OPTION.ambientBrightness]: {labels: ['As the TV is set', 'Dim', 'Very dim'], values: ['tv', 'dim', 'low'], now: config.ambientBrightness},
			[OPTION.videoHours]: {labels: ['Always', 'Daytime (7 am to 7 pm)', 'Evenings (5 pm to 11 pm)', 'Night (7 pm to 7 am)'], values: ['always', 'day', 'evening', 'night'], now: config.videoHours}
		};
	}, [config, immich]);
	/** the list fields of an option: its choices, which is set, and the text shown on the right */
	const listed = (id: string, fallback = '') => {
		const c = choices[id];
		const at = c.values.indexOf(c.now);
		return {choices: c.labels, choice: Math.max(0, at), valueText: at >= 0 ? c.labels[at] : fallback || c.labels[0]};
	};

	const options: OptionItem[] = useMemo(() => [
		{
			id: OPTION.liveTv,
			group: 'home' as const,
			label: 'Live TV row',
			description: 'A row of TV channels under your apps, showing what is on now and next, with the Guide at the end. OK on a channel opens Live TV on it. Needs the Homebrew Channel.',
			value: config.liveTvRow
		},
		{
			id: OPTION.useHomebrew,
			group: 'system' as const,
			label: 'Live app list via Homebrew Channel',
			description: 'Rooted TVs only. Lists every installed app with its real icon, using the Homebrew Channel, which runs commands as root. When off, the built-in app catalogue is used.',
			value: config.useHomebrew
		},
		{
			id: OPTION.showAll,
			group: 'system' as const,
			label: 'Show system apps',
			description: 'Offer the TV\'s own apps (Live TV, LG Channels, AirPlay, Screen Share, Game Optimizer, TV Settings) in Settings > Apps, so you can add them to the home screen.',
			value: config.showAllApps
		},
		{
			id: OPTION.weather,
			group: 'weather' as const,
			label: 'Date and weather',
			description: 'Show today\'s date and the temperature at the top left of the home screen. The temperature needs a Weather city below; it comes from open-meteo.com.',
			value: config.showWeather
		},
		{
			id: OPTION.country,
			group: 'weather' as const,
			label: 'Weather country',
			description: 'Pick your country, then the city below. Until a city is chosen no weather is shown and nothing is fetched.',
			value: config.weatherCountry !== '',
			...listed(OPTION.country)
		},
		{
			id: OPTION.city,
			group: 'weather' as const,
			label: 'Weather city',
			description: 'Not set: no weather. Auto finds your area from your internet connection, which sends your IP address to ipwho.is and can be a few towns off. Or pick a city.',
			value: config.weatherCity !== '',
			...listed(OPTION.city, config.weatherCity)
		},
		{
			id: OPTION.wpAuto,
			group: 'wallpaper' as const,
			label: 'Change wallpaper automatically',
			description: 'With a Shuffle or Photos wallpaper chosen, show a new picture every 30 seconds to 60 minutes.',
			value: config.wpAutoMinutes > 0,
			...listed(OPTION.wpAuto)
		},
		{
			id: OPTION.ambient,
			group: 'screensaver' as const,
			label: 'Screensaver',
			description: immich.ready
				? 'When the TV\'s screensaver starts, show your photos from Immich instead: a slow crossfade every 30 seconds, with the clock. Any key returns to the home screen.'
				: 'Your photos from Immich instead of LG\'s screensaver. Set up Immich first (Settings > Wallpaper > Choose wallpaper > Photos).',
			value: config.ambient !== '',
			...listed(OPTION.ambient)
		},
		...(config.ambient ? [{
			id: OPTION.ambientSeconds,
			group: 'screensaver' as const,
			label: 'Time on each photo',
			description: 'How long each photo stays on the screensaver before the next one fades in.',
			value: true,
			...listed(OPTION.ambientSeconds)
		}, {
			id: OPTION.ambientBrightness,
			group: 'screensaver' as const,
			label: 'Brightness',
			description: 'Turns the TV\'s backlight down while your photos show, and back up when you press a key.',
			value: config.ambientBrightness !== 'tv',
			...listed(OPTION.ambientBrightness)
		}] : []),
		{
			id: OPTION.videoHours,
			group: 'wallpaper' as const,
			label: 'Video wallpaper hours',
			description: 'When the video wallpaper plays. Outside these hours the still wallpaper shows instead, and nothing streams.',
			value: config.videoHours !== 'always',
			...listed(OPTION.videoHours)
		},
		{
			id: OPTION.nightDim,
			group: 'wallpaper' as const,
			label: 'Dim the wallpaper at night',
			description: 'Between 7 pm and 6 am the wallpaper is darker, easier on the eyes in a dark room.',
			value: config.nightDim
		},
		{
			id: OPTION.dockHide,
			group: 'home' as const,
			label: 'Hide the dock',
			description: 'Down arrow: Down on the last row slides the dock away. After idle: it hides itself when no key has been pressed for a while. Any key brings it back.',
			value: config.dockHide !== 'off',
			...listed(OPTION.dockHide)
		},
		...(config.dockHide === 'idle' || config.dockHide === 'both' ? [{
			id: OPTION.dockIdle,
			group: 'home' as const,
			label: 'Hide the dock after',
			description: 'How long the home screen waits with no key pressed before the dock slides away.',
			value: true,
			...listed(OPTION.dockIdle)
		}] : []),
		{
			id: OPTION.firstRow,
			group: 'home' as const,
			label: 'Apps in the glass bar',
			description: 'How many apps a row holds: the glass bar, and each row of the grid below it. With 7 the tiles are a little smaller, with 5 a little bigger.',
			value: true,
			...listed(OPTION.firstRow)
		},
		{
			id: OPTION.focus,
			group: 'appearance' as const,
			label: 'Focus highlight',
			description: 'How much the app in focus stands out: how far it grows and how strong its shadow and shine are.',
			value: config.focusStrength !== 'normal',
			...listed(OPTION.focus)
		},
		{
			id: OPTION.darkMode,
			group: 'appearance' as const,
			label: 'Appearance',
			description: 'Light: bright glass with dark text. Dark: dark glass and a dimmer wallpaper or video. Auto is dark from 7 pm to 6 am.',
			value: config.darkMode !== 'off',
			...listed(OPTION.darkMode)
		},
		{
			id: OPTION.language,
			group: 'language' as const,
			label: 'Language',
			description: "Language of the menus, dates and weather. Auto follows the TV. The long descriptions on this screen stay in English.",
			value: config.language !== 'auto',
			...listed(OPTION.language)
		},
		{
			id: OPTION.clock,
			group: 'language' as const,
			label: 'Clock',
			description: "Auto follows the TV's own 12/24-hour setting. Choose 12-hour or 24-hour to override it.",
			value: config.clockFormat !== 'auto',
			...listed(OPTION.clock)
		},
		{
			id: OPTION.hideNames,
			group: 'home' as const,
			label: 'Hide app names',
			description: 'No names under the apps on the home screen, not even the one in focus. Settings still shows them.',
			value: config.hideNames
		},
		{
			id: OPTION.reduceMotion,
			group: 'appearance' as const,
			label: 'Reduce motion',
			description: 'Focus, rows and panels change at once, without sliding, fading or zooming.',
			value: config.reduceMotion
		},
		{
			id: OPTION.liveBlur,
			group: 'appearance' as const,
			label: 'Live blur',
			description: 'The glass bar, the top buttons and the panels blur whatever is behind them, live, instead of showing a blurred copy of the wallpaper. The full-screen backdrops (lower rows, Settings) stay a blurred copy. On by default. Off: the cheaper blurred copy everywhere.',
			value: config.liveBlur
		},
		{
			id: OPTION.showAmPm,
			group: 'language' as const,
			label: 'AM/PM on the clock',
			description: 'Show AM or PM beside the time when the TV is set to a 12-hour clock.',
			value: config.showAmPm
		},
		{
			id: OPTION.restore,
			group: 'system' as const,
			label: 'Restore settings from the TV',
			description: 'Lumen keeps a copy of its settings on the TV (/var/lib/homehook/lumen-config.json) after every change. This puts that copy back, replacing the settings here. Needs the Homebrew Channel.',
			value: false,
			valueText: 'Restore'
		},
		...(__LUMEN_DEV__ ? [{
			id: OPTION.fps,
			group: 'system' as const,
			label: 'Frame-rate counter (dev builds)',
			description: 'Frames drawn in the last second and the longest frame, in the top-left corner. Only in dev builds.',
			value: config.fpsCounter
		}] : [])
	], [config.liveTvRow, config.fpsCounter, choices, config.weatherCountry, config.dockHide, config.dockIdleSeconds, config.videoPlaces, config.videoClip, config.darkMode, config.language, config.clockFormat, config.useHomebrew, config.videoWallpaper, config.showAmPm, config.idleMinutes, config.wpAutoMinutes, config.nightDim, config.showAllApps, config.showWeather, config.weatherCity, config.hideNames, config.reduceMotion, config.liveBlur, config.ambient, config.ambientSeconds, config.ambientBrightness, immich.ready]);

	const wallpaper: WallpaperTab = useMemo(() => {
		if (!inSettings) return {categories: [], entries: [], current: '', onPick: () => undefined, onFavorite: () => undefined};
		const entries: WallpaperEntry[] = [
			{key: 'shuffle', title: 'Shuffle (a new one each time)', category: 'Defaults'},
			{key: 'none', title: 'Plain background', category: 'Defaults'}
		];
		LOCAL_WALLPAPERS.forEach((w, i) => entries.push({key: `local:${i}`, title: w.title, category: 'Defaults', thumb: w.file}));
		WALLPAPER_CATEGORIES.forEach((c) => entries.push({key: `shuffle:${c}`, title: `Shuffle ${c}`, category: c}));
		entries.push({key: 'shuffle:Favorites', title: 'Shuffle my favorites', category: 'Favorites'});
		if (immich.ready) {
			IMMICH_SOURCES.forEach((src) => entries.push({key: src.key, title: src.title, category: 'Photos'}));
			immich.albums.forEach((a) => entries.push({key: `immich:album:${a.id}`, title: a.title, category: 'Photos'}));
		} else {
			entries.push({key: 'immich:setup', title: 'Set up Immich', category: 'Photos'});
		}
		WALLPAPERS.forEach((w) => {
			const fav = config.favoriteWallpapers.indexOf(w.id) !== -1;
			const e = {key: `cloud:${w.id}`, title: w.title, category: w.category, thumb: resized(cloudUrl(w), 360), fav};
			entries.push(e);
			if (fav) entries.push({...e, category: 'Favorites'});
		});
		const tint = (i: number) => `linear-gradient(150deg, ${["#e9a15b,#6d3d4a", "#d8b46a,#3e5a78", "#9fc2d6,#2d4a6b", "#7fc79a,#1e4a52", "#e07f8a,#4a2d5e", "#c9a0dc,#2f2f6b", "#f0c16a,#8a4a2a", "#8ab0e0,#1d2f5a", "#d6a07a,#4a3430", "#86c5c0,#27495a"][i % 10]})`;
		entries.push({key: 'video:', title: 'Shuffle all places', category: 'Video', tint: tint(0), on: config.videoWallpaper && config.videoPlaces.length === 0});
		VIDEO_PLACES.forEach((p, i) => entries.push({key: `video:${p}`, title: p, category: 'Video', tint: tint(i + 1), on: config.videoWallpaper && config.videoPlaces.indexOf(p) >= 0}));
		return {
			categories: ['Defaults', 'Photos', 'Favorites', 'Video'].concat(WALLPAPER_CATEGORIES, 'All'),
			entries,
			current: config.videoWallpaper ? 'video' : config.wallpaper,
			onPick: (key: string) => key === 'immich:setup'
				? showToast('Put your Immich address and an API key in /var/lib/homehook/immich.json on the TV (see docs/immich.md), then open Settings again', 'error')
				: updateConfig(key.indexOf('video:') === 0 ? {...config, videoWallpaper: true, videoPlaces: key === 'video:' ? [] : config.videoPlaces.indexOf(key.slice(6)) >= 0 ? config.videoPlaces.filter((x) => x !== key.slice(6)) : config.videoPlaces.concat(key.slice(6))} : {...config, wallpaper: key, videoWallpaper: false}),
			onFavorite: (key: string) => {
				if (key.indexOf('cloud:') !== 0) return;
				const id = key.slice(6);
				const has = config.favoriteWallpapers.indexOf(id) !== -1;
				updateConfig({...config, favoriteWallpapers: has ? config.favoriteWallpapers.filter((x) => x !== id) : config.favoriteWallpapers.concat(id)});
				showToast(has ? 'Removed from Favorites' : 'Added to Favorites');
			}
		};
	}, [config, immich, inSettings]);

	// ----- actions -----
	const open = (id: string, label: string) => {
		launchApp(id).catch(() => showToast(`Couldn't open ${label}`, 'error'));
	};

	const watchChannel = useCallback((c: Channel) => {
		openChannel(c.id).catch(() => showToast(`Couldn't open ${c.name}`, 'error'));
	}, [showToast]);

	const onActivate = useCallback((_rowId: string, item: TileModel) => {
		if (item.key === LIVE.guide) { setScreen('guide'); return; }
		if (item.key.indexOf(LIVE.prefix) === 0) { openChannel(item.key.slice(LIVE.prefix.length)).catch(() => showToast(`Couldn't open ${item.label}`, 'error')); return; }
		if (item.key === MISC.settings || item.key === BUILTIN.settings) { setScreen('settings'); return; }
		if (item.key === 'screensaver') { startScreensaver().catch(() => showToast("Couldn't start the screensaver (it needs the Homebrew Channel)", 'error')); return; }
		if (item.key === MISC.lgHome) { launchLgHome().catch(() => showToast("Couldn't open LG Home", 'error')); return; }
		if (item.key === 'controls') { setControls(true); return; }
		if (_rowId === ROW.apps || _rowId.indexOf(ROW.dock) === 0 || _rowId === 'folder') {
			const c = configRef.current;
			updateConfig({...c, recentIds: [item.key].concat(c.recentIds.filter((x) => x !== item.key)).slice(0, RECENT_MAX)});
		}
		open(item.key, item.label);
	}, [showToast]);

	/** hold OK on an app: move it one place along the home rows, or take it off the home screen */
	const onEdit = useCallback((action: 'move' | 'remove' | 'folder-add' | 'folder-out', _rowId: string, key: string, arg: number | string = 0) => {
		const c = configRef.current;
		const strip = (folders: UserConfig['folders']) => folders.map((f) => ({...f, appIds: f.appIds.filter((id) => id !== key)}));
		if (action === 'folder-add') {
			const folders = strip(c.folders);
			const target = folders.filter((f) => f.name === String(arg))[0];
			if (target) target.appIds.push(key); else folders.push({name: String(arg), appIds: [key]});
			updateConfig({...c, folders: folders.filter((f) => f.appIds.length > 0)});
			return;
		}
		if (action === 'folder-out') { updateConfig({...c, folders: strip(c.folders).filter((f) => f.appIds.length > 0)}); return; }
		const inFolder = c.folders.reduce((all, f) => all.concat(f.appIds), [] as string[]);
		const ids = c.appIds.filter((id) => allApps.some((a) => a.id === id) && inFolder.indexOf(id) === -1);   // what the rows show, in order
		const kept = c.appIds.filter((id) => ids.indexOf(id) === -1);                                          // apps in folders keep their place
		const at = ids.indexOf(key);
		if (at < 0) return;
		if (action === 'remove') { updateConfig({...c, appIds: ids.filter((id) => id !== key).concat(kept)}); return; }
		const to = at + Number(arg);
		if (to < 0 || to >= ids.length) return;
		const next = ids.slice();
		next.splice(at, 1);
		next.splice(to, 0, key);
		updateConfig({...c, appIds: next.concat(kept)});
	}, [allApps]);

	const onToggle = useCallback((tabId: string, key: string) => {
		if (tabId === ROW.channels) {
			updateConfig({...config, liveChannels: toggleId(rowChannels(live.channels, config.liveChannels).map((c) => c.id), key)});
		} else if (tabId === ROW.apps) {
			updateConfig({...config, appIds: toggleId(config.appIds, key)});
		} else {
			const current = config.sourceIds || inputs.map((s) => s.appId);
			updateConfig({...config, sourceIds: toggleId(current, key)});
		}
	}, [config, inputs, live.channels]);

	const onOption = useCallback((optionId: string) => {
		if (optionId === OPTION.restore) {
			readBackup().then((saved) => {
				if (!saved) { showToast('No settings backup found on the TV', 'error'); return; }
				updateConfig({...saved, seeded: true});
				showToast('Settings restored from the TV');
			});
			return;
		}
		if (optionId === OPTION.useHomebrew) updateConfig({...config, useHomebrew: !config.useHomebrew});
		else if (optionId === OPTION.liveTv) updateConfig({...config, liveTvRow: !config.liveTvRow});
		else if (optionId === OPTION.videoWallpaper) updateConfig({...config, videoWallpaper: !config.videoWallpaper});
		else if (optionId === OPTION.videoClip) {
			const names = [''].concat(VIDEO_PLACES);
			updateConfig({...config, videoClip: names[(names.indexOf(config.videoClip) + 1) % names.length]});
		} else if (optionId === OPTION.showAmPm) updateConfig({...config, showAmPm: !config.showAmPm});
		else if (optionId === OPTION.showAll) updateConfig({...config, showAllApps: !config.showAllApps});
		else if (optionId === OPTION.weather) updateConfig({...config, showWeather: !config.showWeather});
		else if (optionId === OPTION.fps) updateConfig({...config, fpsCounter: !config.fpsCounter});
		else if (optionId === OPTION.hideNames) updateConfig({...config, hideNames: !config.hideNames});
		else if (optionId === OPTION.reduceMotion) updateConfig({...config, reduceMotion: !config.reduceMotion});
		else if (optionId === OPTION.liveBlur) updateConfig({...config, liveBlur: !config.liveBlur});
		else if (optionId === OPTION.nightDim) updateConfig({...config, nightDim: !config.nightDim});
		else if (optionId === OPTION.idle) updateConfig({...config, idleMinutes: IDLE_CHOICES[(IDLE_CHOICES.indexOf(config.idleMinutes) + 1) % IDLE_CHOICES.length]});
	}, [config]);

	/** a value picked from an option's pop-up list */
	const onChoose = useCallback((optionId: string, index: number) => {
		const c = configRef.current;
		const value = choices[optionId] && choices[optionId].values[index];
		if (value === undefined) return;
		const v = String(value);
		if (optionId === OPTION.country) {
			const first = COUNTRIES.filter((x) => x.code === v)[0];
			// a new country starts with no city (no weather until one is picked); the same country keeps its city
			updateConfig({...c, weatherCountry: v, weatherCity: v === c.weatherCountry ? c.weatherCity : first ? '' : c.weatherCity});
		} else if (optionId === OPTION.city) {
			const owner = COUNTRIES.filter((x) => x.cities.some((y) => y.name === v))[0];
			updateConfig({...c, weatherCity: v, weatherCountry: c.weatherCountry || (owner ? owner.code : '')});
		}
		else if (optionId === OPTION.wpAuto) updateConfig({...c, wpAutoMinutes: Number(value)});
		else if (optionId === OPTION.dockHide) updateConfig({...c, dockHide: v});
		else if (optionId === OPTION.dockIdle) updateConfig({...c, dockIdleSeconds: Number(value)});
		else if (optionId === OPTION.darkMode) updateConfig({...c, darkMode: v});
		else if (optionId === OPTION.language) updateConfig({...c, language: v});
		else if (optionId === OPTION.clock) updateConfig({...c, clockFormat: v});
		else if (optionId === OPTION.focus) updateConfig({...c, focusStrength: v});
		else if (optionId === OPTION.firstRow) updateConfig({...c, firstRow: Number(value)});
		else if (optionId === OPTION.videoHours) updateConfig({...c, videoHours: v});
		else if (optionId === OPTION.ambient) updateConfig({...c, ambient: v});
		else if (optionId === OPTION.ambientSeconds) updateConfig({...c, ambientSeconds: Number(value)});
		else if (optionId === OPTION.ambientBrightness) updateConfig({...c, ambientBrightness: v});
	}, [choices]);

	/** Replace a row's order with `keys` (the full list of what's shown). */
	const onReorder = useCallback((tabId: string, keys: string[]) => {
		if (tabId === ROW.apps) updateConfig({...config, appIds: keys});
		else if (tabId === ROW.channels) updateConfig({...config, liveChannels: keys});
		else updateConfig({...config, sourceIds: keys});
	}, [config]);

	return (
		<>
			{/* Home stays mounted under Settings so it keeps its focus position. */}
			<Home rows={rows} tiles={TILES_FOR[firstRow] || TILES_FOR[6]} perRow={firstRow} topItems={TOP_ITEMS} menuItems={MENU_ITEMS} inputs={shownInputs.map(inputTile)} active={screen === 'home' && !controls} onActivate={onActivate} showPeriod={config.showAmPm} onEdit={onEdit} folders={folderMap} weather={weather} dockHide={config.dockHide} dockIdleSeconds={config.dockIdleSeconds} focusRow={focusRow} />
			{screen === 'ambient' && <Ambient source={config.ambient} seconds={config.ambientSeconds} backlight={AMBIENT_BACKLIGHT[config.ambientBrightness]} weather={weather} showPeriod={config.showAmPm} onExit={() => setScreen('home')} />}
			{screen === 'guide' && <Guide channels={live.channels} listings={live.listings} logos={live.logos} now={live.now} schedule={live.schedule} full={config.guideFull} onMode={(full) => { if (configRef.current.guideFull !== full) updateConfig({...configRef.current, guideFull: full}); }} active={!controls} onOpen={watchChannel} onClose={() => setScreen('home')} />}
			{screen === 'settings' && <Settings tabs={tabs} wallpaper={wallpaper} options={options} active onToggle={onToggle} onReorder={onReorder} onOption={onOption} onChoose={onChoose} onClose={() => setScreen('home')} />}
			{controls && <ControlCenter
				darkMode={config.darkMode}
				clockFormat={config.clockFormat}
				onDarkMode={() => updateConfig({...configRef.current, darkMode: nextDark(configRef.current.darkMode)})}
				onClockFormat={() => { const modes = ['auto', '12h', '24h']; const c = configRef.current; updateConfig({...c, clockFormat: modes[(modes.indexOf(c.clockFormat) + 1) % modes.length]}); }}
				onClose={() => setControls(false)}
				onError={(text) => showToast(text, 'error')}
				onAction={(a: CenterAction) => { setControls(false); onActivate('menu', a === 'lg-home' ? {key: MISC.lgHome, label: 'LG Home'} : a === 'art' ? {key: 'com.ammar027.lumen.gallery', label: 'Frame'} : {key: 'screensaver', label: 'Screensaver'}); }}
			/>}
			<Toast message={toast} />
		</>
	);
}
