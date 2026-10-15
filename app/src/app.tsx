import {useCallback, useEffect, useMemo, useRef, useState} from 'preact/hooks';
import {Home, type HomeRow} from './screens/Home';
import {Settings, type SettingsTab, type WallpaperTab} from './screens/Settings';
import type {WallpaperEntry} from './components/WallpaperPicker';
import type {OptionItem} from './components/OptionList';
import {Toast, type ToastMessage} from './components/Toast';
import type {TileModel} from './components/Tile';
import {listApps, seedAppIds, type AppEntry} from './lib/apps';
import {listInputs, MOCK_INPUTS, type InputSource} from './lib/inputs';
import {launchApp, launchLgHome} from './lib/launch';
import {isWebOS} from './lib/luna';
import {hidePointerOnForeground} from './lib/pointer';
import {DEFAULT_CONFIG, hasSavedConfig, loadConfig, saveConfig, toggleId, type UserConfig} from './lib/storage';
import {readBackup, scheduleBackup} from './lib/backup';
import {mergeRecent, readTvRecent} from './lib/recent';
import {onRelaunch, startParams, type LaunchParams} from './lib/launchParams';
import {appTile, inputTile, pickInOrder} from './lib/tiles';
import {TIMING} from './config/constants';
import {LOCAL_WALLPAPERS, WALLPAPERS, WALLPAPER_CATEGORIES, cloudUrl} from './config/wallpapers';
import {resized, setFavorites, setLiveBlur, setWallpaper} from './lib/wallpaper';
import {setVideoChoice, setVideoPaused, setVideoWallpaper, VIDEO_PLACES} from './lib/wallpaperVideo';
import {setVideoFlag, startScreensaver} from './lib/system';
import {setFpsCounter} from './lib/fps';
import {ControlCenter, type CenterAction} from './components/ControlCenter';
import {CITIES, COUNTRIES} from './config/cities';
import {AUTO_PLACE, readWeather} from './lib/weather';
import {isDark, LANGS, nextDark, setClockMode, setLang, t as tr} from './lib/i18n';

type Screen = 'home' | 'settings';

const ROW = {apps: 'apps', sources: 'sources', misc: 'misc', dock: 'dock', recent: 'recent'} as const;
const MISC = {lgHome: 'lg-home', settings: 'settings'} as const;
const OPTION = {fps: 'fps-counter', restore: 'restore-backup', focus: 'focus-strength', firstRow: 'first-row', videoHours: 'video-hours', liveBlur: 'live-blur', reduceMotion: 'reduce-motion', hideNames: 'hide-names', useHomebrew: 'use-homebrew', videoWallpaper: 'video-wallpaper', videoClip: 'video-clip', dockHide: 'dock-hide', showAmPm: 'show-ampm', showAll: 'show-all-apps', weather: 'show-weather', city: 'weather-city', country: 'weather-country', idle: 'idle-screensaver', wpAuto: 'wp-auto', nightDim: 'night-dim', darkMode: 'dark-mode', language: 'language', clock: 'clock-format'} as const;
const WP_AUTO_CHOICES = [0, 15, 30, 60];
/** when the video wallpaper plays (Settings > Options > Video wallpaper hours): [first hour, hour it stops]; always = no limit */
const VIDEO_HOURS: Record<string, [number, number]> = {day: [7, 19], evening: [17, 23], night: [19, 7]};
function inVideoHours (mode: string, now = new Date()): boolean {
	const span = VIDEO_HOURS[mode];
	if (!span) return true;
	const h = now.getHours();
	return span[0] < span[1] ? h >= span[0] && h < span[1] : h >= span[0] || h < span[1];
}
/** first-row sizes: 7 apps only fit the glass bar with smaller tiles (still 5:3) */
const TILES_FOR: Record<number, {size: number; height: number; gap: number}> = {5: {size: 236, height: 142, gap: 28}, 6: {size: 236, height: 142, gap: 28}, 7: {size: 208, height: 125, gap: 24}};
const IDLE_CHOICES = [0, 5, 10, 20, 30];
const RECENT_MAX = 8;

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
	const [config, setConfig] = useState<UserConfig>(loadConfig);
	// set before anything renders, so every label below reads the chosen language and clock
	setLang(config.language);
	setClockMode(config.clockFormat);
	const [apps, setApps] = useState<AppEntry[]>([]);
	const [inputs, setInputs] = useState<InputSource[]>([]);
	const [toast, setToast] = useState<ToastMessage | null>(null);
	const [controls, setControls] = useState(false);
	const configRef = useRef(config);
	configRef.current = config;
	const toastTimer = useRef(0);
	// a fresh install first looks for the settings backup on the TV (lib/backup.ts); nothing is seeded until that has answered
	const [restoring, setRestoring] = useState(() => !hasSavedConfig());
	const [focusRow, setFocusRow] = useState<{id: string; seq: number} | undefined>(undefined);

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

	// launch parameters: {"view":"recent"} opens on the Recent row
	useEffect(() => {
		let seq = 0;
		const apply = (p: LaunchParams) => { if (p.view === 'recent') setFocusRow({id: ROW.recent, seq: ++seq}); };
		apply(startParams());
		return onRelaunch(apply);
	}, []);

	// Start in remote (5-way) mode: hide the Magic Remote pointer whenever we come to the
	// front. Shaking the remote still brings it back.
	useEffect(() => hidePointerOnForeground(), []);

	// Load apps at start and whenever the Homebrew option changes; refresh inputs whenever
	// the app comes back to the foreground (labels or connections may have changed).
	useEffect(() => {
		listApps(config.useHomebrew, config.showAllApps)
			.then(({apps: list, source}) => {
				setApps(list);
				if (config.useHomebrew && source !== 'homebrew') showToast('Homebrew Channel not available, using the built-in app list', 'error');
			})
			.catch(() => showToast('Could not read the app list', 'error'));
	}, [config.useHomebrew, config.showAllApps, showToast]);

	// the apps watch.sh saw in front, read at start and each time Lumen comes back
	const [tvRecent, setTvRecent] = useState<string[]>([]);
	useEffect(() => {
		const read = () => { if (!document.hidden) readTvRecent().then(setTvRecent); };
		read();
		document.addEventListener('visibilitychange', read);
		return () => document.removeEventListener('visibilitychange', read);
	}, []);

	useEffect(() => {
		const refresh = () => {
			if (!isWebOS()) { setInputs(MOCK_INPUTS); return; }
			listInputs().then(setInputs).catch(() => showToast('Could not read the inputs', 'error'));
		};
		refresh();
		const onVisibility = () => { if (!document.hidden) refresh(); };
		document.addEventListener('visibilitychange', onVisibility);
		return () => document.removeEventListener('visibilitychange', onVisibility);
	}, [showToast]);

	useEffect(() => { setFavorites(config.favoriteWallpapers); setWallpaper(config.wallpaper); }, [config.wallpaper]);
	useEffect(() => setFavorites(config.favoriteWallpapers), [config.favoriteWallpapers]);

	// the weather line in the time-pill menu
	const [weatherText, setWeatherText] = useState('');
	useEffect(() => {
		// no place chosen, no weather (and no request to anyone): Auto, which asks ipwho.is, has to be picked on purpose
		if (!config.showWeather || !config.weatherCity) { setWeatherText(''); return; }
		const city = config.weatherCity === AUTO_PLACE ? null : CITIES.filter((c) => c.name === config.weatherCity)[0] || null;
		if (!city && config.weatherCity !== AUTO_PLACE) { setWeatherText(''); return; }
		const load = () => readWeather(city)
			.then((w) => setWeatherText(`${w.place ? w.place + ' \u00b7 ' : ''}${w.temp}\u00b0 ${tr(w.label)}`.trim()))
			.catch(() => setWeatherText(''));
		load();
		const id = window.setInterval(load, 30 * 60000);
		return () => window.clearInterval(id);
	}, [config.showWeather, config.weatherCity, config.language]);

	// a new wallpaper every N minutes (only when a shuffle is chosen)
	useEffect(() => {
		if (!config.wpAutoMinutes || config.wallpaper.indexOf('shuffle') !== 0) return;
		const id = window.setInterval(() => { if (!document.hidden) setWallpaper(config.wallpaper); }, config.wpAutoMinutes * 60000);
		return () => window.clearInterval(id);
	}, [config.wpAutoMinutes, config.wallpaper]);

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
	useEffect(() => { setVideoPaused(screen === 'settings'); document.documentElement.classList.toggle('in-settings', screen === 'settings'); }, [screen]);

	const updateConfig = (next: UserConfig) => { configRef.current = next; setConfig(next); saveConfig(next); scheduleBackup(next); };

	// first run: put the installed apps on the home screen (the catalogue's favourites first)
	useEffect(() => {
		const c = configRef.current;
		if (restoring || c.seeded || apps.length === 0) return;
		updateConfig({...c, seeded: true, appIds: seedAppIds(apps, DEFAULT_CONFIG.appIds)});
	}, [apps, restoring]);

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
	const shownApps = useMemo(() => pickInOrder(apps, config.appIds, (a) => a.id), [apps, config.appIds]);
	const shownInputs = useMemo(
		() => (config.sourceIds ? pickInOrder(inputs, config.sourceIds, (s) => s.appId) : inputs),
		[inputs, config.sourceIds]
	);

	const recentApps = useMemo(() => pickInOrder(apps, mergeRecent(tvRecent, config.recentIds, RECENT_MAX), (a) => a.id), [apps, config.recentIds, tvRecent]);

	const folderTiles = useMemo(
		() => config.folders.map((f) => ({name: f.name, items: pickInOrder(apps, f.appIds, (a) => a.id).map(appTile)})).filter((f) => f.items.length > 0),
		[apps, config.folders]
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

	// the first row (in the glass bar) holds config.firstRow apps; the rest go in a plain row below, like the tvOS home screen
	const firstRow = config.firstRow;
	const rows: HomeRow[] = useMemo(() => [
		{id: ROW.apps, label: 'Apps', items: homeTiles.slice(0, firstRow), emptyText: 'No apps selected — add some in Settings'},
		...(homeTiles.length > firstRow ? [{id: ROW.dock, label: 'More apps', items: homeTiles.slice(firstRow)}] : []),
		...(recentApps.length > 0 ? [{id: ROW.recent, label: 'Recent', titled: true, items: recentApps.map(appTile)}] : [])
	], [homeTiles, shownInputs, recentApps, config.language, firstRow]);

	const tabs: SettingsTab[] = useMemo(() => [
		{id: ROW.apps, label: 'Apps', noun: 'apps', items: apps.map(appTile), shown: shownApps.map(appTile)},
		{id: ROW.sources, label: 'Sources', noun: 'sources', items: inputs.map(inputTile), shown: shownInputs.map(inputTile)}
	], [apps, inputs, shownApps, shownInputs, config.language]);

	/** options that pick from a list: the labels shown in the pop-up list, the stored values, and which one is set now */
	type Choice = {labels: string[]; values: (string | number)[]; now: string | number};
	const choices: Record<string, Choice> = useMemo(() => {
		const country = COUNTRIES.filter((c) => c.code === config.weatherCountry)[0];
		const cities = (country ? country.cities : CITIES).map((c) => c.name);
		return {
			[OPTION.country]: {labels: ['Any'].concat(COUNTRIES.map((c) => c.name)), values: [''].concat(COUNTRIES.map((c) => c.code)), now: config.weatherCountry},
			[OPTION.city]: {labels: ['Not set', 'Auto'].concat(cities), values: ['', AUTO_PLACE].concat(cities), now: config.weatherCity},
			[OPTION.wpAuto]: {labels: ['Off', '15 min', '30 min', '60 min'], values: WP_AUTO_CHOICES, now: config.wpAutoMinutes},
			[OPTION.dockHide]: {labels: ['Off', 'Down arrow', 'After idle', 'Both'], values: ['off', 'down', 'idle', 'both'], now: config.dockHide},
			[OPTION.darkMode]: {labels: ['Light', 'Dark', 'Auto'], values: ['off', 'on', 'auto'], now: config.darkMode},
			[OPTION.language]: {labels: ['Auto'].concat(LANGS.map((l) => l.name)), values: ['auto'].concat(LANGS.map((l) => l.code)), now: config.language},
			[OPTION.clock]: {labels: ['Auto', '12-hour', '24-hour'], values: ['auto', '12h', '24h'], now: config.clockFormat},
			[OPTION.focus]: {labels: ['Subtle', 'Normal', 'Strong'], values: ['subtle', 'normal', 'strong'], now: config.focusStrength},
			[OPTION.firstRow]: {labels: ['5', '6', '7'], values: [5, 6, 7], now: config.firstRow},
			[OPTION.videoHours]: {labels: ['Always', 'Daytime (7 am to 7 pm)', 'Evenings (5 pm to 11 pm)', 'Night (7 pm to 7 am)'], values: ['always', 'day', 'evening', 'night'], now: config.videoHours}
		};
	}, [config]);
	/** the list fields of an option: its choices, which is set, and the text shown on the right */
	const listed = (id: string, fallback = '') => {
		const c = choices[id];
		const at = c.values.indexOf(c.now);
		return {choices: c.labels, choice: Math.max(0, at), valueText: at >= 0 ? c.labels[at] : fallback || c.labels[0]};
	};

	const options: OptionItem[] = useMemo(() => [
		{
			id: OPTION.useHomebrew,
			label: 'Live app list via Homebrew Channel',
			description: 'Rooted TVs only. Lists every installed app with its real icon, using the Homebrew Channel, which runs commands as root. When off, the built-in app catalogue is used.',
			value: config.useHomebrew
		},
		{
			id: OPTION.showAll,
			label: 'Show system apps',
			description: 'Offer the TV\'s own apps (Live TV, LG Channels, AirPlay, Screen Share, Game Optimizer, TV Settings) in Settings > Apps, so you can add them to the home screen.',
			value: config.showAllApps
		},
		{
			id: OPTION.weather,
			label: 'Date and weather',
			description: 'Show today\'s date and the temperature at the top left of the home screen. The temperature needs a Weather city below; it comes from open-meteo.com.',
			value: config.showWeather
		},
		{
			id: OPTION.country,
			label: 'Weather country',
			description: 'Pick your country, then the city below. Until a city is chosen no weather is shown and nothing is fetched.',
			value: config.weatherCountry !== '',
			...listed(OPTION.country)
		},
		{
			id: OPTION.city,
			label: 'Weather city',
			description: 'Not set: no weather. Auto finds your area from your internet connection, which sends your IP address to ipwho.is and can be a few towns off. Or pick a city.',
			value: config.weatherCity !== '',
			...listed(OPTION.city, config.weatherCity)
		},
		{
			id: OPTION.wpAuto,
			label: 'Change wallpaper automatically',
			description: 'With a Shuffle wallpaper chosen, pick a new picture every 15, 30 or 60 minutes.',
			value: config.wpAutoMinutes > 0,
			...listed(OPTION.wpAuto)
		},
		{
			id: OPTION.videoHours,
			label: 'Video wallpaper hours',
			description: 'When the video wallpaper plays. Outside these hours the still wallpaper shows instead, and nothing streams.',
			value: config.videoHours !== 'always',
			...listed(OPTION.videoHours)
		},
		{
			id: OPTION.nightDim,
			label: 'Dim the wallpaper at night',
			description: 'Between 7 pm and 6 am the wallpaper is darker, easier on the eyes in a dark room.',
			value: config.nightDim
		},
		{
			id: OPTION.dockHide,
			label: 'Hide the dock',
			description: 'Down arrow: Down on the last row slides the dock away. After idle: it hides itself after 8 seconds without a key press. Any key brings it back.',
			value: config.dockHide !== 'off',
			...listed(OPTION.dockHide)
		},
		{
			id: OPTION.firstRow,
			label: 'Apps in the glass bar',
			description: 'How many apps the first row holds; the rest go in the row below. With 7 the tiles are a little smaller so they still fit.',
			value: true,
			...listed(OPTION.firstRow)
		},
		{
			id: OPTION.focus,
			label: 'Focus highlight',
			description: 'How much the app in focus stands out: how far it grows and how strong its shadow and shine are.',
			value: config.focusStrength !== 'normal',
			...listed(OPTION.focus)
		},
		{
			id: OPTION.darkMode,
			label: 'Appearance',
			description: 'Light: bright glass with dark text. Dark: dark glass and a dimmer wallpaper or video. Auto is dark from 7 pm to 6 am.',
			value: config.darkMode !== 'off',
			...listed(OPTION.darkMode)
		},
		{
			id: OPTION.language,
			label: 'Language',
			description: "Language of the menus, dates and weather. Auto follows the TV. The long descriptions on this screen stay in English.",
			value: config.language !== 'auto',
			...listed(OPTION.language)
		},
		{
			id: OPTION.clock,
			label: 'Clock',
			description: "Auto follows the TV's own 12/24-hour setting. Choose 12-hour or 24-hour to override it.",
			value: config.clockFormat !== 'auto',
			...listed(OPTION.clock)
		},
		{
			id: OPTION.hideNames,
			label: 'Hide app names',
			description: 'No names under the apps on the home screen, not even the one in focus. Settings still shows them.',
			value: config.hideNames
		},
		{
			id: OPTION.reduceMotion,
			label: 'Reduce motion',
			description: 'Focus, rows and panels change at once, without sliding, fading or zooming.',
			value: config.reduceMotion
		},
		{
			id: OPTION.liveBlur,
			label: 'Live blur (test)',
			description: 'The glass bar, the top buttons and the panels blur whatever is behind them, live, instead of showing a blurred copy of the wallpaper. The full-screen backdrops (lower rows, Settings) stay a blurred copy. Smoother to look at, harder work for the TV.',
			value: config.liveBlur
		},
		{
			id: OPTION.showAmPm,
			label: 'AM/PM on the clock',
			description: 'Show AM or PM beside the time when the TV is set to a 12-hour clock.',
			value: config.showAmPm
		},
		{
			id: OPTION.restore,
			label: 'Restore settings from the TV',
			description: 'Lumen keeps a copy of its settings on the TV (/var/lib/homehook/lumen-config.json) after every change. This puts that copy back, replacing the settings here. Needs the Homebrew Channel.',
			value: false,
			valueText: 'Restore'
		},
		...(__LUMEN_DEV__ ? [{
			id: OPTION.fps,
			label: 'Frame-rate counter (dev builds)',
			description: 'Frames drawn in the last second and the longest frame, in the top-left corner. Only in dev builds.',
			value: config.fpsCounter
		}] : [])
	], [config.fpsCounter, choices, config.weatherCountry, config.dockHide, config.videoPlaces, config.videoClip, config.darkMode, config.language, config.clockFormat, config.useHomebrew, config.videoWallpaper, config.showAmPm, config.idleMinutes, config.wpAutoMinutes, config.nightDim, config.showAllApps, config.showWeather, config.weatherCity, config.hideNames, config.reduceMotion, config.liveBlur]);

	const wallpaper: WallpaperTab = useMemo(() => {
		const entries: WallpaperEntry[] = [
			{key: 'shuffle', title: 'Shuffle (a new one each time)', category: 'Defaults'},
			{key: 'none', title: 'Plain background', category: 'Defaults'}
		];
		LOCAL_WALLPAPERS.forEach((w, i) => entries.push({key: `local:${i}`, title: w.title, category: 'Defaults', thumb: w.file}));
		WALLPAPER_CATEGORIES.forEach((c) => entries.push({key: `shuffle:${c}`, title: `Shuffle ${c}`, category: c}));
		entries.push({key: 'shuffle:Favorites', title: 'Shuffle my favorites', category: 'Favorites'});
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
			categories: ['Defaults', 'Favorites', 'Video'].concat(WALLPAPER_CATEGORIES, 'All'),
			entries,
			current: config.videoWallpaper ? 'video' : config.wallpaper,
			onPick: (key: string) => updateConfig(key.indexOf('video:') === 0 ? {...config, videoWallpaper: true, videoPlaces: key === 'video:' ? [] : config.videoPlaces.indexOf(key.slice(6)) >= 0 ? config.videoPlaces.filter((x) => x !== key.slice(6)) : config.videoPlaces.concat(key.slice(6))} : {...config, wallpaper: key, videoWallpaper: false}),
			onFavorite: (key: string) => {
				if (key.indexOf('cloud:') !== 0) return;
				const id = key.slice(6);
				const has = config.favoriteWallpapers.indexOf(id) !== -1;
				updateConfig({...config, favoriteWallpapers: has ? config.favoriteWallpapers.filter((x) => x !== id) : config.favoriteWallpapers.concat(id)});
				showToast(has ? 'Removed from Favorites' : 'Added to Favorites');
			}
		};
	}, [config]);

	// ----- actions -----
	const open = (id: string, label: string) => {
		launchApp(id).catch(() => showToast(`Couldn't open ${label}`, 'error'));
	};

	const onActivate = useCallback((_rowId: string, item: TileModel) => {
		if (item.key === MISC.settings) { setScreen('settings'); return; }
		if (item.key === 'screensaver') { startScreensaver().catch(() => showToast("Couldn't start the screensaver (it needs the Homebrew Channel)", 'error')); return; }
		if (item.key === MISC.lgHome) { launchLgHome().catch(() => showToast("Couldn't open LG Home", 'error')); return; }
		if (item.key === 'controls') { setControls(true); return; }
		if (_rowId === ROW.apps || _rowId === ROW.dock || _rowId === ROW.recent || _rowId === 'folder') {
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
		const ids = c.appIds.filter((id) => apps.some((a) => a.id === id) && inFolder.indexOf(id) === -1);   // what the rows show, in order
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
	}, [apps]);

	const onToggle = useCallback((tabId: string, key: string) => {
		if (tabId === ROW.apps) {
			updateConfig({...config, appIds: toggleId(config.appIds, key)});
		} else {
			const current = config.sourceIds || inputs.map((s) => s.appId);
			updateConfig({...config, sourceIds: toggleId(current, key)});
		}
	}, [config, inputs]);

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
		else if (optionId === OPTION.darkMode) updateConfig({...c, darkMode: v});
		else if (optionId === OPTION.language) updateConfig({...c, language: v});
		else if (optionId === OPTION.clock) updateConfig({...c, clockFormat: v});
		else if (optionId === OPTION.focus) updateConfig({...c, focusStrength: v});
		else if (optionId === OPTION.firstRow) updateConfig({...c, firstRow: Number(value)});
		else if (optionId === OPTION.videoHours) updateConfig({...c, videoHours: v});
	}, [choices]);

	/** Replace a row's order with `keys` (the full list of what's shown). */
	const onReorder = useCallback((tabId: string, keys: string[]) => {
		if (tabId === ROW.apps) updateConfig({...config, appIds: keys});
		else updateConfig({...config, sourceIds: keys});
	}, [config]);

	return (
		<>
			{/* Home stays mounted under Settings so it keeps its focus position. */}
			<Home rows={rows} tiles={TILES_FOR[firstRow] || TILES_FOR[6]} perRow={firstRow} topItems={TOP_ITEMS} menuItems={MENU_ITEMS} inputs={shownInputs.map(inputTile)} active={screen === 'home' && !controls} onActivate={onActivate} showPeriod={config.showAmPm} onEdit={onEdit} folders={folderMap} weatherText={weatherText} dockHide={config.dockHide} focusRow={focusRow} />
			{screen === 'settings' && <Settings tabs={tabs} wallpaper={wallpaper} options={options} active onToggle={onToggle} onReorder={onReorder} onOption={onOption} onChoose={onChoose} onClose={() => setScreen('home')} />}
			{controls && <ControlCenter
				darkMode={config.darkMode}
				clockFormat={config.clockFormat}
				onDarkMode={() => updateConfig({...configRef.current, darkMode: nextDark(configRef.current.darkMode)})}
				onClockFormat={() => { const modes = ['auto', '12h', '24h']; const c = configRef.current; updateConfig({...c, clockFormat: modes[(modes.indexOf(c.clockFormat) + 1) % modes.length]}); }}
				onClose={() => setControls(false)}
				onError={(text) => showToast(text, 'error')}
				onAction={(a: CenterAction) => { setControls(false); onActivate('menu', a === 'settings' ? {key: MISC.settings, label: 'Settings'} : a === 'lg-home' ? {key: MISC.lgHome, label: 'LG Home'} : a === 'art' ? {key: 'com.ammar027.lumen.gallery', label: 'Frame'} : {key: 'screensaver', label: 'Screensaver'}); }}
			/>}
			<Toast message={toast} />
		</>
	);
}
