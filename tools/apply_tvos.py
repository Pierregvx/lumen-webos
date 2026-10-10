#!/usr/bin/env python3
"""Turns a fresh clone of partridgeworks/webos-launcher (in ../app) into the Apple TV-style launcher with a wallpaper library.
Safe to run once on a clean checkout:  cd app && git checkout . && git clean -fd src && python3 ../tools/apply_tvos.py"""
import os, json, re
APP = os.path.expanduser('~/Developer/webos-launcher-tvos/app')
def P(p): return os.path.join(APP, p)
def sub(p, pairs):
    s = open(P(p)).read()
    for a, b in pairs:
        assert a in s, (p, a[:60])
        s = s.replace(a, b, 1)
    open(P(p), 'w').write(s)
def write(p, s):
    os.makedirs(os.path.dirname(P(p)), exist_ok=True); open(P(p), 'w').write(s)

# ---------------------------------------------------------------- tokens: bigger landscape tiles, glass
sub('src/theme/tokens.ts', [
 ("tileSize: 144,", "tileSize: 236,          // Apple TV's home-screen icons are 5:3 landscape\n\ttileHeight: 142,"),
 ("tileGap: 28,", "tileGap: 28,"),
 ("tileRadius: 24,", "tileRadius: 34,"),
 ("rowsTop: 236,", "rowsTop: 640,"),
 ("focusScale: 1.12,", "focusScale: 1.16,"),
 ("unfocusedRowOpacity: 0.55", "unfocusedRowOpacity: 0.6"),
 ("tileBg: '#161616',", "tileBg: 'rgba(255, 255, 255, 0.10)',"),
 ("tileBgFocus: '#202020',", "tileBgFocus: 'rgba(255, 255, 255, 0.18)',"),
 ("tileBorder: '#2a2a2a',", "tileBorder: 'rgba(255, 255, 255, 0.0)',"),
 ("rowGap: 28,", "rowGap: 40,"),
 ("gridColumns: 9 ", "dockTileSize: 84,       // the small Sources / More dock at the bottom\n\tdockTileHeight: 84,\n\tdockTileGap: 26,\n\tdockTileRadius: 24,\n\tgridColumns: 9 "),
])

# (tiles: the stock <img class="tile__image"> already fills the tile edge to edge, centred and cropped: like Apple TV)

# ---------------------------------------------------------------- row / home: compact dock
sub('src/components/Row.tsx', [
 ("	emptyText?: string;\n	onSelect", "	emptyText?: string;\n	compact?: boolean;\n	onSelect"),
 ("const VIEWPORT_WIDTH = LAYOUT.screenWidth - 2 * LAYOUT.edgePadding;\nconst STEP = LAYOUT.tileSize + LAYOUT.tileGap;\n", "const VIEWPORT_WIDTH = LAYOUT.screenWidth - 2 * LAYOUT.edgePadding;\n"),
 ("export function Row ({label, items, focused, selected, emptyText, onSelect, onActivate}: Props) {\n	const total = items.length * STEP - LAYOUT.tileGap;",
  "export function Row ({label, items, focused, selected, emptyText, compact, onSelect, onActivate}: Props) {\n	const size = compact ? LAYOUT.dockTileSize : LAYOUT.tileSize;\n	const gap = compact ? LAYOUT.dockTileGap : LAYOUT.tileGap;\n	const STEP = size + gap;\n	const total = items.length * STEP - gap;"),
 ("clamp(selected * STEP + LAYOUT.tileSize / 2 - VIEWPORT_WIDTH / 2", "clamp(selected * STEP + size / 2 - VIEWPORT_WIDTH / 2"),
 ("		<section class={`row${focused ? ' row--focused' : ''}`}>", "		<section class={`row${focused ? ' row--focused' : ''}${compact ? ' row--dock' : ''}`}>"),
])
sub('src/screens/Home.tsx', [
 ("	emptyText?: string;\n}", "	emptyText?: string;\n	/** a small dock at the bottom of the screen instead of a full-size row */\n	compact?: boolean;\n}"),
 ("						emptyText={row.emptyText}\n", "						emptyText={row.emptyText}\n						compact={row.compact}\n"),
])

# ---------------------------------------------------------------- storage
sub('src/lib/storage.ts', [
 ("	useHomebrew: boolean;\n}", "	useHomebrew: boolean;\n	/** play Apple's aerial videos behind the home screen (streams from the internet). Off by default. */\n	videoWallpaper: boolean;\n	/** which still wallpaper: local:N (bundled), cloud:<id> (from the library), shuffle, or none */\n	wallpaper: string;\n}"),
 ("	useHomebrew: false\n};", "	useHomebrew: false,\n	videoWallpaper: false,\n	wallpaper: 'local:0'\n};"),
 ("			useHomebrew: parsed.useHomebrew === true\n", "			useHomebrew: parsed.useHomebrew === true,\n			videoWallpaper: parsed.videoWallpaper === true,\n			wallpaper: typeof parsed.wallpaper === 'string' ? parsed.wallpaper : DEFAULT_CONFIG.wallpaper\n"),
])

# ---------------------------------------------------------------- wallpaper plumbing
write('src/config/wallpaperVideos.ts', open('/tmp/wallpaperVideos.ts').read() if os.path.exists('/tmp/wallpaperVideos.ts') else "export interface WallpaperVideo { name: string; url: string }\nexport const WALLPAPER_VIDEOS: WallpaperVideo[] = [];\n")

write('src/lib/wallpaper.ts', '''// Still wallpaper behind the home screen. Choices: local:N (bundled in the app, always works), cloud:<id> (from the cloud
// library in config/wallpapers.ts, loaded over the internet when picked), shuffle (a random cloud one each launch), none.
// A cloud picture that can't load falls back to the bundled default, so the screen is never blank.

import {LOCAL_WALLPAPERS, WALLPAPERS, cloudUrl} from '../config/wallpapers';

const HTML_CLASS = 'wp-image';
const PROXY = 'https://images.weserv.nl/';       // free image resizer: a 1920-wide copy instead of the multi-MB original

/** Resized copy of a cloud picture (width in px). */
export function resized (url: string, width: number): string {
	return `${PROXY}?url=${encodeURIComponent(url.replace(/^https?:\\/\\//, ''))}&w=${width}&h=${Math.round(width * 9 / 16)}&fit=cover&q=${width > 800 ? 82 : 70}&output=jpg`;
}

function candidates (sel: string): string[] {
	const fallback = LOCAL_WALLPAPERS.length > 0 ? [LOCAL_WALLPAPERS[0].file] : [];
	if (sel === 'none') return [];
	if (sel.indexOf('local:') === 0) {
		const item = LOCAL_WALLPAPERS[Number(sel.slice(6))];
		return item ? [item.file].concat(fallback) : fallback;
	}
	let id = sel.indexOf('cloud:') === 0 ? sel.slice(6) : '';
	if (sel === 'shuffle' && WALLPAPERS.length > 0) id = WALLPAPERS[Math.floor(Math.random() * WALLPAPERS.length)].id;
	const item = WALLPAPERS.filter((w) => w.id === id)[0];
	if (!item) return fallback;
	const url = cloudUrl(item);
	return [resized(url, 1920), url].concat(fallback);
}

let element: HTMLElement | null = null;
let token = 0;

function ensureElement (): HTMLElement {
	if (element) return element;
	element = document.createElement('div');
	element.id = 'wpimage';
	document.body.insertBefore(element, document.body.firstChild);
	return element;
}

export function setWallpaper (sel: string): void {
	const el = ensureElement();
	const mine = ++token;
	const list = candidates(sel);
	const root = document.documentElement.classList;
	if (list.length === 0) { root.remove(HTML_CLASS); el.style.backgroundImage = 'none'; return; }
	const tryAt = (i: number) => {
		if (mine !== token) return;                      // a newer choice replaced this one
		if (i >= list.length) { root.remove(HTML_CLASS); return; }
		const img = new Image();
		img.onload = () => {
			if (mine !== token) return;
			el.style.backgroundImage = `url("${list[i]}")`;
			root.add(HTML_CLASS);
		};
		img.onerror = () => tryAt(i + 1);
		img.src = list[i];
	};
	tryAt(0);
}
''')

write('src/lib/wallpaperVideo.ts', '''// The optional video wallpaper: one muted <video> behind the launcher that plays the list in a random order. Plays only while
// the launcher is on screen, and the launcher falls back to the still wallpaper if a video can't play.

import {WALLPAPER_VIDEOS} from '../config/wallpaperVideos';

const HTML_CLASS = 'wp-video';
const APPLE_HTTPS = /^https:\\/\\/sylvan\\.apple\\.com\\//;

let video: HTMLVideoElement | null = null;
let enabled = false;
let order: number[] = [];
let position = 0;
let useHttp = false;      // some TVs refuse Apple's certificate; the same file over http then plays
let failures = 0;

function shuffle (): number[] {
	const list = WALLPAPER_VIDEOS.map((_, i) => i);
	for (let i = list.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		const t = list[i]; list[i] = list[j]; list[j] = t;
	}
	return list;
}

function playCurrent (): void {
	if (!video || !enabled || WALLPAPER_VIDEOS.length === 0) return;
	if (order.length === 0) order = shuffle();
	const url = WALLPAPER_VIDEOS[order[position % order.length]].url;
	video.src = useHttp ? url.replace(APPLE_HTTPS, 'http://sylvan.apple.com/') : url;
	video.play().catch(() => { /* onerror moves on */ });
}

function next (): void {
	position += 1;
	if (position >= order.length) { order = shuffle(); position = 0; }
	playCurrent();
}

function onError (): void {
	failures += 1;
	if (!useHttp && failures === 1) { useHttp = true; playCurrent(); return; }
	if (failures >= 4) { stop(); return; }
	next();
}

function ensureVideo (): HTMLVideoElement {
	if (video) return video;
	video = document.createElement('video');
	video.id = 'bgvideo';
	video.muted = true;
	video.setAttribute('playsinline', '');
	video.preload = 'auto';
	video.addEventListener('playing', () => { failures = 0; document.documentElement.classList.add(HTML_CLASS); });
	video.addEventListener('ended', next);
	video.addEventListener('error', onError);
	document.body.insertBefore(video, document.body.firstChild);
	document.addEventListener('visibilitychange', () => {
		if (!video || !enabled) return;
		if (document.hidden) video.pause(); else video.play().catch(() => {});
	});
	return video;
}

function stop (): void {
	enabled = false;
	document.documentElement.classList.remove(HTML_CLASS);
	if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
}

export function setVideoWallpaper (on: boolean): void {
	if (on === enabled) return;
	if (!on) { stop(); return; }
	enabled = true;
	failures = 0;
	ensureVideo();
	playCurrent();
}
''')

# ---------------------------------------------------------------- picker component
write('src/components/WallpaperPicker.tsx', '''import {clamp} from '../hooks/useKeys';

export interface WallpaperEntry {
	key: string;            // local:N | cloud:<id> | shuffle | none
	title: string;
	category: string;
	thumb?: string;         // picture; shuffle / none are drawn as plain tiles
}

interface Props {
	categories: string[];
	categoryIndex: number;
	entries: WallpaperEntry[];            // already filtered to the category
	current: string;                      // the chosen key
	chipsFocused: boolean;
	gridFocused: boolean;
	selected: number;
	onCategory: (index: number) => void;
	onSelect: (index: number) => void;
	onActivate: (index: number) => void;
}

export const WALLPAPER_COLUMNS = 4;
const VIEWPORT_HEIGHT = 640;          // .wp__viewport in global.css
const ROW_STEP = 203 + 70;             // thumbnail height + title + gap (see .wp__item)

/** Wallpaper tab of Settings: category chips on top, a grid of thumbnails below. */
export function WallpaperPicker ({categories, categoryIndex, entries, current, chipsFocused, gridFocused, selected, onCategory, onSelect, onActivate}: Props) {
	const rows = Math.ceil(entries.length / WALLPAPER_COLUMNS);
	const total = rows * ROW_STEP;
	const row = Math.floor(selected / WALLPAPER_COLUMNS);
	const offset = total <= VIEWPORT_HEIGHT ? 0 : clamp(row * ROW_STEP - (VIEWPORT_HEIGHT - ROW_STEP) / 2, 0, total - VIEWPORT_HEIGHT);
	return (
		<div class="wp">
			<div class="wp__chips">
				{categories.map((c, i) => (
					<div
						key={c}
						class={['wp__chip', i === categoryIndex && 'wp__chip--on', chipsFocused && i === categoryIndex && 'wp__chip--focused'].filter(Boolean).join(' ')}
						onMouseEnter={() => onCategory(i)}
					>{c}</div>
				))}
			</div>
			<div class="wp__viewport">
				<div class="wp__track" style={{transform: `translateY(${-offset}px)`}}>
					{entries.map((e, i) => (
						<div
							key={e.key}
							class={['wp__item', gridFocused && i === selected && 'wp__item--focused', e.key === current && 'wp__item--current'].filter(Boolean).join(' ')}
							onMouseEnter={() => onSelect(i)}
							onClick={() => onActivate(i)}
						>
							<div class="wp__thumb" style={e.thumb ? {backgroundImage: `url("${e.thumb}")`} : undefined}>
								{!e.thumb && <span class="wp__thumbtext">{e.key === 'none' ? 'Plain' : 'Shuffle'}</span>}
								{e.key === current && <span class="wp__tick">\\u2713</span>}
							</div>
							<div class="wp__title">{e.title}</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
''')

# ---------------------------------------------------------------- Settings: Wallpaper tab
sub('src/screens/Settings.tsx', [
 ("import {LAYOUT} from '../theme/tokens';", "import {LAYOUT} from '../theme/tokens';\nimport {WallpaperPicker, WALLPAPER_COLUMNS, type WallpaperEntry} from '../components/WallpaperPicker';"),
 ("interface Props {\n	tabs: SettingsTab[];", "export interface WallpaperTab {\n	categories: string[];\n	entries: WallpaperEntry[];\n	current: string;\n	onPick: (key: string) => void;\n}\n\ninterface Props {\n	tabs: SettingsTab[];\n	wallpaper: WallpaperTab;"),
 ("type Zone = 'tabs' | 'button' | 'content';", "type Zone = 'tabs' | 'button' | 'content' | 'chips';"),
 ("const OPTIONS_LABEL = 'Options';", "const OPTIONS_LABEL = 'Options';\nconst WALLPAPER_LABEL = 'Wallpaper';"),
 ("	options: 'OK turns an option on or off · Back returns home'\n}", "	options: 'OK turns an option on or off · Back returns home',\n	wallpaper: 'Left and right change category · OK sets the wallpaper · Back returns home'\n}"),
 ("export function Settings ({tabs, options, active,", "export function Settings ({tabs, wallpaper, options, active,"),
 ("	const [held, setHeld] = useState<Held | null>(null);\n", "	const [held, setHeld] = useState<Held | null>(null);\n	const [wpCat, setWpCat] = useState(0);\n	const [wpIndex, setWpIndex] = useState(0);\n"),
 ("	const tabCount = tabs.length + 1;                  // grid tabs + Options\n	const onOptions = tabIndex === tabs.length;\n	const tab: SettingsTab | undefined = onOptions ? undefined : tabs[tabIndex];",
  "	const tabCount = tabs.length + 2;                  // grid tabs + Wallpaper + Options\n	const onWallpaper = tabIndex === tabs.length;\n	const onOptions = tabIndex === tabs.length + 1;\n	const tab: SettingsTab | undefined = (onOptions || onWallpaper) ? undefined : tabs[tabIndex];\n	const wpName = wallpaper.categories[wpCat];\n	const wpList = wallpaper.entries.filter((e) => wpName === 'All' || e.category === wpName);"),
 ("	const count = onOptions ? options.length : items.length;", "	const count = onOptions ? options.length : onWallpaper ? wpList.length : items.length;"),
 ("		setGridIndex(0);\n		setOptionIndex(0);\n	};", "		setGridIndex(0);\n		setOptionIndex(0);\n		setWpIndex(0);\n	};\n\n	const changeCategory = (i: number) => { setWpCat(clamp(i, 0, wallpaper.categories.length - 1)); setWpIndex(0); };"),
 ("		if (zone === 'tabs') { if (count > 0) setZone('content'); return; }\n		if (onOptions)", "		if (zone === 'chips') { if (count > 0) setZone('content'); return; }\n		if (zone === 'tabs') { if (onWallpaper) setZone('chips'); else if (count > 0) setZone('content'); return; }\n		if (onWallpaper) { if (wpList[wpIndex]) wallpaper.onPick(wpList[wpIndex].key); return; }\n		if (onOptions)"),
 ("			else if (key === 'down' && count > 0) setZone('content');\n			return true;\n		}\n		if (zone === 'button') {", "			else if (key === 'down') { if (onWallpaper) setZone('chips'); else if (count > 0) setZone('content'); }\n			return true;\n		}\n		if (zone === 'chips') {\n			if (key === 'left') changeCategory(wpCat - 1);\n			else if (key === 'right') changeCategory(wpCat + 1);\n			else if (key === 'up') setZone('tabs');\n			else if (key === 'down' && count > 0) setZone('content');\n			return true;\n		}\n		if (zone === 'button') {"),
 ("		if (onOptions) {\n			if (key === 'up')", "		if (onWallpaper) {\n			const last = count - 1;\n			if (key === 'left') setWpIndex((i) => clamp(i - 1, 0, last));\n			else if (key === 'right') setWpIndex((i) => clamp(i + 1, 0, last));\n			else if (key === 'up') { if (wpIndex < WALLPAPER_COLUMNS) setZone('chips'); else setWpIndex((i) => i - WALLPAPER_COLUMNS); }\n			else if (key === 'down') setWpIndex((i) => (i + WALLPAPER_COLUMNS <= last ? i + WALLPAPER_COLUMNS : i));\n			return true;\n		}\n\n		if (onOptions) {\n			if (key === 'up')"),
 ("	}, [zone, tabIndex, tabCount, gridIndex, optionIndex, count, tab, onOptions, options, reordering, held, items, onReorder, onClose]);", "	}, [zone, tabIndex, tabCount, gridIndex, optionIndex, wpIndex, wpCat, wpList, wallpaper, onWallpaper, count, tab, onOptions, options, reordering, held, items, onReorder, onClose]);"),
 ("	const hint = onOptions ? HINT.options : held", "	const hint = onWallpaper ? HINT.wallpaper : onOptions ? HINT.options : held"),
 ("	const labels = tabs.map((t) => t.label).concat(OPTIONS_LABEL);", "	const labels = tabs.map((t) => t.label).concat(WALLPAPER_LABEL, OPTIONS_LABEL);"),
 ("				{onOptions && (\n					<OptionList", "				{onWallpaper && (\n					<WallpaperPicker\n						categories={wallpaper.categories}\n						categoryIndex={wpCat}\n						entries={wpList}\n						current={wallpaper.current}\n						chipsFocused={zone === 'chips'}\n						gridFocused={zone === 'content'}\n						selected={wpIndex}\n						onCategory={(i) => { setZone('chips'); changeCategory(i); }}\n						onSelect={(i) => { setZone('content'); setWpIndex(i); }}\n						onActivate={(i) => { setZone('content'); if (wpList[i]) wallpaper.onPick(wpList[i].key); }}\n					/>\n				)}\n				{onOptions && (\n					<OptionList"),
])

# ---------------------------------------------------------------- app.tsx
sub('src/app.tsx', [
 ("import {Settings, type SettingsTab} from './screens/Settings';", "import {Settings, type SettingsTab, type WallpaperTab} from './screens/Settings';\nimport type {WallpaperEntry} from './components/WallpaperPicker';"),
 ("import {TIMING} from './config/constants';", "import {TIMING} from './config/constants';\nimport {LOCAL_WALLPAPERS, WALLPAPERS, WALLPAPER_CATEGORIES, cloudUrl} from './config/wallpapers';\nimport {resized, setWallpaper} from './lib/wallpaper';\nimport {setVideoWallpaper} from './lib/wallpaperVideo';"),
 ("const ROW = {apps: 'apps', sources: 'sources', misc: 'misc'} as const;", "const ROW = {apps: 'apps', sources: 'sources', misc: 'misc', dock: 'dock'} as const;"),
 ("const OPTION = {useHomebrew: 'use-homebrew'} as const;", "const OPTION = {useHomebrew: 'use-homebrew', videoWallpaper: 'video-wallpaper'} as const;"),
 ("	const updateConfig = (next: UserConfig)", "	useEffect(() => setWallpaper(config.wallpaper), [config.wallpaper]);\n	useEffect(() => setVideoWallpaper(config.videoWallpaper), [config.videoWallpaper]);\n\n	const updateConfig = (next: UserConfig)"),
 ("""		{id: ROW.sources, label: 'Sources', items: shownInputs.map(inputTile), emptyText: 'No sources selected'},
		{id: ROW.misc, label: 'More', items: MISC_TILES}
""", """		// Sources and More share one small dock at the bottom; the apps are the main thing on the screen
		{id: ROW.dock, label: 'Sources and more', compact: true, items: shownInputs.map(inputTile).concat(MISC_TILES)}
"""),
 ("""			value: config.useHomebrew
		}
	], [config.useHomebrew]);""", """			value: config.useHomebrew
		},
		{
			id: OPTION.videoWallpaper,
			label: 'Video wallpaper',
			description: "Plays Apple's aerial videos behind the home screen instead of the still wallpaper. Streamed from the internet: about 2-3 GB per hour while this screen is open.",
			value: config.videoWallpaper
		}
	], [config.useHomebrew, config.videoWallpaper]);

	const wallpaper: WallpaperTab = useMemo(() => {
		const entries: WallpaperEntry[] = [
			{key: 'shuffle', title: 'Shuffle (a new one each time)', category: 'Defaults'},
			{key: 'none', title: 'Plain background', category: 'Defaults'}
		];
		LOCAL_WALLPAPERS.forEach((w, i) => entries.push({key: `local:${i}`, title: w.title, category: 'Defaults', thumb: w.file}));
		WALLPAPERS.forEach((w) => entries.push({key: `cloud:${w.id}`, title: w.title, category: w.category, thumb: resized(cloudUrl(w), 360)}));
		return {
			categories: ['Defaults'].concat(WALLPAPER_CATEGORIES, 'All'),
			entries,
			current: config.wallpaper,
			onPick: (key: string) => updateConfig({...config, wallpaper: key})
		};
	}, [config]);"""),
 ("		if (optionId === OPTION.useHomebrew) updateConfig({...config, useHomebrew: !config.useHomebrew});", "		if (optionId === OPTION.useHomebrew) updateConfig({...config, useHomebrew: !config.useHomebrew});\n		else if (optionId === OPTION.videoWallpaper) updateConfig({...config, videoWallpaper: !config.videoWallpaper});"),
 ("useCallback((rowId: string, item: TileModel) => {\n		if (rowId === ROW.misc) {\n			if (item.key === MISC.settings) setScreen('settings');\n			else if (item.key === MISC.lgHome) launchLgHome().catch(() => showToast(\"Couldn't open LG Home\", 'error'));\n			return;\n		}",
  "useCallback((_rowId: string, item: TileModel) => {\n		if (item.key === MISC.settings) { setScreen('settings'); return; }\n		if (item.key === MISC.lgHome) { launchLgHome().catch(() => showToast(\"Couldn't open LG Home\", 'error')); return; }"),
 ("<Settings tabs={tabs} options={options}", "<Settings tabs={tabs} wallpaper={wallpaper} options={options}"),
])
sub('src/screens/Home.tsx', [("import {useCallback, useState} from 'preact/hooks';", "import {useCallback, useState} from 'preact/hooks';")])

# ---------------------------------------------------------------- CSS
css = open(P('src/theme/global.css')).read()
def rep(a, b):
    global css
    assert a in css, a[:50]; css = css.replace(a, b, 1)
rep(""".screen {
	position: absolute;
	left: 0; top: 0;
	width: 100%; height: 100%;
	padding: 0 var(--layout-edge-padding);
	background: radial-gradient(ellipse 70% 60% at 50% 42%, var(--color-bg-gradient-inner) 0%, var(--color-bg-gradient-mid) 55%, var(--color-bg-gradient-outer) 100%);
}""", """.screen {
	position: absolute;
	left: 0; top: 0;
	width: 100%; height: 100%;
	padding: 0 var(--layout-edge-padding);
	/* the soft colour glows shown when there is no wallpaper picture (Plain background, or while one loads) */
	background:
		radial-gradient(ellipse 60% 55% at 18% 18%, rgba(70, 120, 255, 0.45) 0%, rgba(70, 120, 255, 0) 70%),
		radial-gradient(ellipse 55% 60% at 85% 30%, rgba(170, 80, 230, 0.38) 0%, rgba(170, 80, 230, 0) 70%),
		radial-gradient(ellipse 70% 50% at 55% 100%, rgba(30, 170, 190, 0.34) 0%, rgba(30, 170, 190, 0) 70%),
		#0a0f1e;
}""")
rep(".header__greeting {\n\tmargin: 0;", ".header__greeting {\n\tdisplay: none;\n\tmargin: 0;")
rep(".row__label {\n", ".row__label {\n\tdisplay: none;\n")
rep(".row__viewport {\n	overflow: hidden;\n	padding: 16px 0;\n	margin: -16px 0;", ".row__viewport {\n	overflow: hidden;\n	/* room around the tiles so a focused (enlarged, glowing) one is never clipped */\n	padding: 40px 70px 90px;\n	margin: -40px -70px -90px;")
rep("	height: var(--layout-tile-size);\n	border-radius: var(--layout-tile-radius);", "	height: var(--layout-tile-height);\n	border-radius: var(--layout-tile-radius);")
a = css.index(".tile--focused .tile__box {"); b = css.index("}", a) + 1
css = css[:a] + """.tile--focused .tile__box {
	transform: scale(var(--motion-focus-scale)) translateY(-6px);
	background: var(--color-tile-bg-focus);
	box-shadow: 0 34px 56px rgba(0, 0, 0, 0.5), 0 10px 20px rgba(0, 0, 0, 0.3);
	z-index: 1;
}""" + css[b:]
rep("""	color: var(--color-text-secondary);
	white-space: normal;
	overflow: hidden;
	transition: color var(--motion-focus-ms) ease-out;
}
.tile--focused .tile__label { color: var(--color-text-primary); }""", """	color: var(--color-text-primary);
	white-space: normal;
	overflow: hidden;
	opacity: 0;
	transition: opacity var(--motion-focus-ms) ease-out;
	text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
}
.tile--focused .tile__label { opacity: 1; }""")
rep("	margin: 14px 0 0 calc((var(--layout-tile-gap) - 8px) / -2);", "	margin: 26px 0 0 calc((var(--layout-tile-gap) - 8px) / -2);")
css += """
/* ---------- Apple TV look: frosted-glass shelf behind the apps row, small dock, time pill ---------- */

.row:not(.row--dock) { position: relative; }
.row:not(.row--dock)::before {
	content: '';
	position: absolute;
	left: -70px; right: -70px;
	top: 4px;
	height: calc(var(--layout-tile-height) + 72px);
	border-radius: 60px;
	background: rgba(255, 255, 255, 0.14);
	-webkit-backdrop-filter: blur(40px) saturate(1.8);
	backdrop-filter: blur(40px) saturate(1.8);
	box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.22), 0 24px 60px rgba(0, 0, 0, 0.25);
}
.row .row__viewport { position: relative; z-index: 1; }
.row--dock {
	position: fixed;
	left: var(--layout-edge-padding);
	right: var(--layout-edge-padding);
	bottom: 56px;
	margin: 0;
	--layout-tile-size: 84px;
	--layout-tile-height: 84px;
	--layout-tile-gap: 26px;
	--layout-tile-radius: 24px;
	--motion-focus-scale: 1.22;
	--font-tile-label: 20px;
}
.row--dock .row__viewport { padding: 30px 70px 70px; margin: -30px -70px -70px; opacity: 0.7; }
.row--dock.row--focused .row__viewport { opacity: 1; }
.row--dock .tile__label { margin-top: 12px; text-align: center; }
.row--dock .tile__monogram { font-size: 34px; }
.clock { background: rgba(255, 255, 255, 0.14); padding: 10px 26px; border-radius: 40px; -webkit-backdrop-filter: blur(30px); backdrop-filter: blur(30px); box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.2); color: var(--color-text-primary); }
.clock__line { display: none; }
.clock__time { font-size: 30px; font-weight: 400; letter-spacing: 0.01em; }

/* ---------- wallpaper: still picture (lib/wallpaper.ts) and optional video (lib/wallpaperVideo.ts) ---------- */

#wpimage, #bgvideo {
	position: fixed;
	left: 0; top: 0;
	width: 100%; height: 100%;
	z-index: 0;
}
#wpimage { background: center / cover no-repeat; }
#bgvideo { object-fit: cover; background: #000; }
#root { position: relative; z-index: 1; }
/* with a picture or video behind, the screen keeps only a dark fade for legibility */
.wp-image .screen, .wp-video .screen {
	background:
		linear-gradient(to top, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0.0) 45%),
		linear-gradient(to bottom, rgba(0, 0, 0, 0.35) 0%, rgba(0, 0, 0, 0.0) 25%);
}

/* ---------- Settings > Wallpaper ---------- */

.wp__chips { display: flex; flex-direction: row; flex-wrap: wrap; margin-bottom: 26px; }
.wp__chip {
	margin-right: 14px; margin-bottom: 12px; padding: 10px 26px; border-radius: 999px;
	font-size: var(--font-settings-button); color: var(--color-text-secondary);
	background: rgba(255, 255, 255, 0.08);
	transition: background var(--motion-focus-ms) ease-out, color var(--motion-focus-ms) ease-out;
}
.wp__chip--on { background: rgba(255, 255, 255, 0.22); color: var(--color-text-primary); }
.wp__chip--focused { background: #fff; color: #000; }
.wp__viewport { overflow: hidden; height: 640px; padding-top: 20px; margin-top: -20px; }
.wp__track { display: flex; flex-direction: row; flex-wrap: wrap; width: 1640px; transition: transform var(--motion-scroll-ms) cubic-bezier(0.2, 0.7, 0.2, 1); will-change: transform; }
.wp__item { width: 360px; height: 273px; margin-right: 66.66px; text-align: left; }
.wp__item:nth-child(4n) { margin-right: 0; }
.wp__thumb {
	position: relative; width: 360px; height: 203px; border-radius: 22px; overflow: hidden;
	background: rgba(255, 255, 255, 0.1) center / cover no-repeat;
	transition: transform var(--motion-focus-ms) ease-out, box-shadow var(--motion-focus-ms) ease-out;
}
.wp__thumbtext { position: absolute; left: 0; right: 0; top: 50%; margin-top: -16px; text-align: center; font-size: 28px; color: var(--color-text-secondary); }
.wp__tick { position: absolute; right: 12px; top: 12px; width: 38px; height: 38px; border-radius: 50%; background: #fff; color: #000; text-align: center; line-height: 38px; font-size: 24px; }
.wp__title { margin-top: 14px; font-size: 20px; color: var(--color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 360px; }
.wp__item--focused .wp__thumb { transform: scale(1.06); box-shadow: 0 22px 40px rgba(0, 0, 0, 0.5), 0 0 0 4px #fff; }
.wp__item--focused .wp__title { color: var(--color-text-primary); }
"""
open(P('src/theme/global.css'), 'w').write(css)
print('applied')

# ---------------------------------------------------------------- icon pack (public/iconpack/*, see tools/build_iconpack.py)
sub('src/lib/apps.ts', [
 ("import {appExists} from './launch';", "import {appExists} from './launch';\nimport {ICON_PACK} from '../config/iconpack';"),
 ("const ICON_DIR = 'icons/apps/';", "const ICON_DIR = 'icons/apps/';\n\nconst slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');\n\n/** An icon from the drop-in icon pack (public/iconpack), matched by the app's id or title. It wins over every other icon. */\nexport function packIcon (id: string, title: string): string | undefined {\n	const file = ICON_PACK[slug(id)] || ICON_PACK[slug(title)];\n	return file ? 'iconpack/' + file : undefined;\n}"),
 ("		iconUrl: a.icon ? ICON_DIR + a.icon : undefined,\n		color: a.color\n	}));", "		iconUrl: packIcon(a.id, a.title) || (a.icon ? ICON_DIR + a.icon : undefined),\n		color: a.color\n	}));"),
 ("					iconUrl: icons[p.id] || (known && known.icon ? ICON_DIR + known.icon : undefined),", "					iconUrl: packIcon(p.id, known ? known.title : p.title) || icons[p.id] || (known && known.icon ? ICON_DIR + known.icon : undefined),"),
])

# ---------------------------------------------------------------- this TV's own apps (ids read from the TV with listLaunchPoints)
write('src/config/catalog.local.ts', """// This TV's apps that the stock catalogue doesn't know. Generated by tools/apply_tvos.py.
import type {CatalogApp} from './catalog';

export const EXTRA_APPS: CatalogApp[] = [
	{id: 'hotstar', title: 'JioHotstar', icon: 'hotstar.png'},
	{id: 'com.tvweb.dashboard', title: 'Glasshouse', icon: 'com.tvweb.dashboard.png'},
	{id: 'com.halfbrick.fruitninja', title: 'Fruit Ninja', icon: 'com.halfbrick.fruitninja.png'}
];

export const DEFAULT_APP_IDS: string[] = [
	'hotstar', 'netflix', 'amazon', 'youtube.leanback.v4', 'cdp-30', 'com.webos.app.mediadiscovery',
	'com.webos.app.browser', 'org.webosbrew.hbchannel', 'com.tvweb.dashboard'
];   // Fruit Ninja stays in the catalogue (Settings > Apps) but is not on the home screen by default
""")

# ---------------------------------------------------------------- Settings must not be see-through; load every installed app by default
sub('src/screens/Settings.tsx', [("		<div class=\"screen\">\n			<div class=\"settings\">", "		<div class=\"screen screen--settings\">\n			<div class=\"settings\">")])
sub('src/config/constants.ts', [("export const STORAGE_KEY = 'launcher-config-v1';", "export const STORAGE_KEY = 'launcher-config-v2';")])
sub('src/lib/storage.ts', [
 ("	useHomebrew: false,\n	videoWallpaper", "	useHomebrew: true,\n	videoWallpaper"),
 ("useHomebrew: parsed.useHomebrew === true,", "useHomebrew: parsed.useHomebrew !== false,"),
])
css = open(P('src/theme/global.css')).read()
css += """
/* Settings is its own solid frosted panel over the wallpaper: nothing of the home screen (shelf, dock) may show through */
.screen.screen--settings, .wp-image .screen.screen--settings, .wp-video .screen.screen--settings {
	background: rgba(12, 14, 22, 0.94);
	-webkit-backdrop-filter: blur(60px) saturate(1.4);
	backdrop-filter: blur(60px) saturate(1.4);
	z-index: 10;
}
"""
open(P('src/theme/global.css'), 'w').write(css)

# ---------------------------------------------------------------- Settings grid for the wider tiles
sub('src/theme/tokens.ts', [("gridColumns: 9", "gridColumns: 6")]) if "gridColumns: 9" in open(P('src/theme/tokens.ts')).read() else None
sub('src/components/Grid.tsx', [("const ROW_STEP = LAYOUT.tileSize + LABEL_HEIGHT + GRID_ROW_GAP;", "const ROW_STEP = LAYOUT.tileHeight + LABEL_HEIGHT + GRID_ROW_GAP;")])

# ---------------------------------------------------------------- only the apps that matter on this TV
KEEP = ['youtube.leanback.v4', 'netflix', 'amazon', 'cdp-30', 'com.webos.app.mediadiscovery', 'com.webos.app.browser', 'org.webosbrew.hbchannel']
cat = open(P('src/config/catalog.ts')).read()
a = cat.index('const BASE_CATALOG: CatalogApp[] = ['); b = cat.index('\n];', a)
body = [l.strip().rstrip(',') for l in cat[a:b].split('\n')[1:] if l.strip().startswith("{id: '")]
kept = [l for l in body if re.match(r"\{id: '([^']+)'", l).group(1) in KEEP]
cat = cat[:a] + 'const BASE_CATALOG: CatalogApp[] = [\n\t' + ',\n\t'.join(kept) + cat[b:]
open(P('src/config/catalog.ts'), 'w').write(cat)
sub('src/config/catalog.ts', [("'youtube.leanback.v4', 'netflix', 'amazon', 'com.disney.disneyplus-prod',\n	'com.apple.appletv', 'com.wbd.stream', 'cdp-30', 'spotify-beehive'", "'youtube.leanback.v4', 'netflix', 'amazon', 'cdp-30'")])
# the live list (Homebrew Channel) shows only these too: the tool apps (updater, update blocker, screensaver, AmazOff, LG store ...) stay out
sub('src/lib/apps.ts', [("			const points = (parsed.launchPoints || []).filter((p) => p.id && p.title && HIDDEN_IDS.indexOf(p.id) === -1);", "			const wanted = APP_CATALOG.map((c) => c.id);\n			const points = (parsed.launchPoints || []).filter((p) => p.id && p.title && HIDDEN_IDS.indexOf(p.id) === -1 && wanted.indexOf(p.id) !== -1);")])


# ================================================================ PERFORMANCE-FIRST UI (LG UQ80: Chromium 87, ~1.5 GB RAM, weak GPU)
# Research summary (see RESEARCH.md): live blur (backdrop-filter) and SVG refraction are the most expensive effects on a TV GPU, and each
# promoted layer costs width x height x 4 bytes of GPU memory. So: no live blur anywhere. Glass is faked with (a) a pre-blurred copy of
# the wallpaper shown through the glass shapes, (b) bright specular rims made of static inset shadows. Only transform/opacity animate.

# --- the clock draws itself (once a second) instead of re-rendering the whole home screen every second
write('src/components/Clock.tsx', """import {timeParts} from '../lib/clock';
import {useClock} from '../hooks/useClock';
import {useTimeFormat} from '../hooks/useTimeFormat';

/** Self-contained: only this small pill re-renders each second, not the rows and tiles. */
export function Clock () {
	const now = useClock();
	const format = useTimeFormat();
	const {time, period} = timeParts(now, format);
	return (
		<div class="clock">
			<div class="clock__time">
				{time}
				{period && <span class="clock__period">{period}</span>}
			</div>
		</div>
	);
}
""")
sub('src/screens/Home.tsx', [
 ("import {Header} from '../components/Header';\n", ""),
 ("import {useClock} from '../hooks/useClock';\nimport {useTimeFormat} from '../hooks/useTimeFormat';\n", ""),
 ("	const now = useClock();\n	const timeFormat = useTimeFormat();\n", ""),
 ("			<Header now={now} />\n			<Clock now={now} format={timeFormat} />", "			<Clock />"),
])

# --- the wallpaper also publishes a pre-blurred copy (--wp-blur) that the glass shapes show
sub('src/lib/wallpaper.ts', [
 ("let element: HTMLElement | null = null;", """/** A small pre-blurred copy of the picture now shown: bundled defaults have a -blur.jpg beside them; cloud pictures get a tiny
 *  blurred version from the same resizer. The glass shapes show it through, which costs nothing per frame (no live blur). */
function blurFor (shown: string): string | undefined {
	if (shown.indexOf('wallpapers/default-') === 0) return new URL(shown.replace(/\\.jpg$/, '-blur.jpg'), location.href).href;
	if (shown.indexOf(PROXY) === 0) return shown.replace(/w=\\d+&h=\\d+/, 'w=960&h=540').replace(/q=\\d+/, 'q=80') + '&blur=5';
	return undefined;
}

function setBlur (shown: string | null): void {
	const style = document.documentElement.style;
	const url = shown ? blurFor(shown) : undefined;
	if (!url) { style.removeProperty('--wp-blur'); return; }
	const probe = new Image();
	probe.onload = () => style.setProperty('--wp-blur', `url("${url}")`);
	probe.src = url;
}

let element: HTMLElement | null = null;"""),
 ("	if (list.length === 0) { root.remove(HTML_CLASS); el.style.backgroundImage = 'none'; return; }", "	if (list.length === 0) { root.remove(HTML_CLASS); el.style.backgroundImage = 'none'; setBlur(null); return; }"),
 ("			el.style.backgroundImage = `url(\"${list[i]}\")`;\n			root.add(HTML_CLASS);", "			el.style.backgroundImage = `url(\"${list[i]}\")`;\n			root.add(HTML_CLASS);\n			setBlur(list[i]);"),
])

# --- the wallpaper picker draws only the rows near the one in view (233 thumbnails at once would eat the TV's memory)
write('src/components/WallpaperPicker.tsx', open(P('src/components/WallpaperPicker.tsx')).read()
 .replace("const ROW_STEP = 203 + 70;             // thumbnail height + title + gap (see .wp__item)", "const ROW_STEP = 203 + 70;             // thumbnail height + title + gap (see .wp__item)\nconst COL_STEP = 360 + 66.67;         // thumbnail width + gap\nconst ROWS_BEFORE = 1;                // rows kept drawn above and below the visible ones\nconst ROWS_AFTER = 3;")
 .replace("""				<div class="wp__track" style={{transform: `translateY(${-offset}px)`}}>
					{entries.map((e, i) => (
						<div
							key={e.key}""", """				<div class="wp__track" style={{transform: `translateY(${-offset}px)`, height: `${total}px`}}>
					{entries.map((e, i) => ({e, i})).slice(Math.max(0, row - ROWS_BEFORE) * WALLPAPER_COLUMNS, (row + ROWS_AFTER) * WALLPAPER_COLUMNS).map(({e, i}) => (
						<div
							key={e.key}
							style={{left: `${(i % WALLPAPER_COLUMNS) * COL_STEP}px`, top: `${Math.floor(i / WALLPAPER_COLUMNS) * ROW_STEP}px`}}""")
)

# --- CSS: strip every live blur, then add the cheap glass
css = open(P('src/theme/global.css')).read()
css = re.sub(r'\s*-webkit-backdrop-filter:[^;]*;', '', css)
css = re.sub(r'\s*backdrop-filter:[^;]*;', '', css)
css += """
/* ---------- lite glass: no live blur; a pre-blurred wallpaper copy (--wp-blur) shows through the shapes ---------- */

:root { --glass-fallback: linear-gradient(rgba(74, 84, 106, 0.60), rgba(40, 46, 62, 0.60)); }
.row:not(.row--dock)::before,
.clock,
.row--dock .tile__box,
.wp__chip, .option, .settings__button {
	background-image: linear-gradient(135deg, rgba(255, 255, 255, 0.26) 0%, rgba(255, 255, 255, 0.07) 42%, rgba(255, 255, 255, 0.16) 100%), var(--wp-blur, var(--glass-fallback));
	background-size: auto, 100vw 100vh;
	background-attachment: scroll, fixed;
	background-position: 0 0, 0 0;
	background-repeat: no-repeat;
	background-color: rgba(30, 36, 50, 0.30);
}
/* bright rim lights (static inset shadows: the part that makes it read as glass, at almost no cost) */
.row:not(.row--dock)::before {
	box-shadow: inset 3px 3px 2px -1px rgba(255, 255, 255, 0.85), inset -3px -3px 2px -1px rgba(255, 255, 255, 0.40), inset 0 0 36px rgba(255, 255, 255, 0.10), 0 20px 44px rgba(0, 0, 0, 0.28);
}
.row:not(.row--dock)::after {
	content: '';
	position: absolute;
	left: -30px; right: -30px;
	top: 6px;
	height: 3px;
	border-radius: 3px;
	background: linear-gradient(to right, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.75) 22%, rgba(255, 255, 255, 0.35) 70%, rgba(255, 255, 255, 0));
	z-index: 2;
	pointer-events: none;
}
.clock, .row--dock .tile__box {
	box-shadow: inset 2px 2px 1.5px -1px rgba(255, 255, 255, 0.9), inset -2px -2px 1.5px -1px rgba(255, 255, 255, 0.42), inset 0 0 14px rgba(255, 255, 255, 0.10), 0 8px 18px rgba(0, 0, 0, 0.25);
}
.row--dock .tile--focused .tile__box {
	background-image: linear-gradient(145deg, rgba(255, 255, 255, 0.44), rgba(255, 255, 255, 0.16) 55%, rgba(255, 255, 255, 0.30)), var(--wp-blur, var(--glass-fallback));
}
.wp__chip, .option, .settings__button {
	box-shadow: inset 2px 2px 1px -1px rgba(255, 255, 255, 0.7), inset -2px -2px 1px -1px rgba(255, 255, 255, 0.28);
}
.wp__chip--on { background-image: linear-gradient(145deg, rgba(255, 255, 255, 0.34), rgba(255, 255, 255, 0.14)), var(--wp-blur, var(--glass-fallback)); }
.wp__chip--focused { background-image: none; background-color: #fff; box-shadow: 0 8px 18px rgba(0, 0, 0, 0.35); }
.option--focused { background-image: linear-gradient(145deg, rgba(255, 255, 255, 0.34), rgba(255, 255, 255, 0.12)), var(--wp-blur, var(--glass-fallback)); box-shadow: inset 2px 2px 1px -1px rgba(255, 255, 255, 0.95), inset -2px -2px 1px -1px rgba(255, 255, 255, 0.5), 0 0 0 4px #fff; }

/* Settings: a solid dark panel (a full-screen blur would be the single most expensive thing on this TV) */
.screen.screen--settings, .wp-image .screen.screen--settings, .wp-video .screen.screen--settings { background: rgba(12, 14, 22, 0.97); }

/* focus: only `transform` animates (the compositor moves it); the shadow and shine appear at once instead of being animated */
.tile__box { transition: transform var(--motion-focus-ms) ease-out; }
.tile--focused .tile__box { will-change: transform; box-shadow: 0 22px 34px rgba(0, 0, 0, 0.45); }
.row:not(.row--dock) .tile--focused .tile__box::after {
	content: '';
	position: absolute;
	left: 0; top: 0; right: 0; bottom: 0;
	background: linear-gradient(115deg, rgba(255, 255, 255, 0.36) 0%, rgba(255, 255, 255, 0.10) 28%, rgba(255, 255, 255, 0) 46%);
	pointer-events: none;
}
.row--dock .tile--focused .tile__box { box-shadow: inset 2px 2px 1.5px -1px #fff, inset -2px -2px 1.5px -1px rgba(255, 255, 255, 0.6), 0 14px 24px rgba(0, 0, 0, 0.35); }

/* wallpaper picker: windowed rows are positioned by hand */
.wp__track { display: block; position: relative; }
.wp__item { position: absolute; margin: 0; }
.wp__thumb { transition: transform var(--motion-focus-ms) ease-out; }
.wp__item--focused .wp__thumb { box-shadow: 0 0 0 4px #fff; }
"""
open(P('src/theme/global.css'), 'w').write(css)

# ================================================================ tvOS-style navigation: rows + top bar; Sources move into an Inputs panel
sub('src/components/Glyph.tsx', [
 ("export type GlyphName = 'house' | 'gear';", "export type GlyphName = 'house' | 'gear' | 'inputs';"),
 ("			{name === 'house'\n				? <path d=\"M3 11.5 12 4l9 7.5M5.5 9.8V20h13V9.8M10 20v-6h4v6\" />\n				: <>", "			{name === 'house'\n				? <path d=\"M3 11.5 12 4l9 7.5M5.5 9.8V20h13V9.8M10 20v-6h4v6\" />\n				: name === 'inputs'\n				? <path d=\"M3.5 7.5h17v7.2a2 2 0 0 1-2 2h-3.2l-1 2.3H9.7l-1-2.3H5.5a2 2 0 0 1-2-2zM8 10.5v2.4M12 10.5v2.4M16 10.5v2.4\" />\n				: <>"),
])
sub('src/theme/tokens.ts', [("rowsTop: 640,", "rowsTop: 846,")])   # dock bottom at ~93% of the screen height, like the Apple TV home screen
write('src/screens/Home.tsx', """import {useCallback, useState} from 'preact/hooks';
import {Clock} from '../components/Clock';
import {Glyph} from '../components/Glyph';
import {Row} from '../components/Row';
import {Tile, type TileModel} from '../components/Tile';
import {useKeys, clamp, type NavKey} from '../hooks/useKeys';

export interface HomeRow {
	id: string;
	label: string;
	items: TileModel[];
	emptyText?: string;
	compact?: boolean;
}

interface Props {
	rows: HomeRow[];
	/** the round buttons at the top right: Inputs, LG Home, Settings */
	topItems: TileModel[];
	/** what the Inputs panel lists */
	inputs: TileModel[];
	active: boolean;
	onActivate: (rowId: string, item: TileModel) => void;
}

/** Where the remote's focus is: a row of apps, the top bar, or the open Inputs panel. */
type Zone = 'rows' | 'top' | 'panel';

const PANEL_COLUMNS = 3;
const INPUTS_KEY = 'inputs';

/** The home screen, navigated like tvOS:
 *  - Left/Right move along a row; Up/Down move between rows, and each row remembers its column.
 *  - Up from the first row reaches the top bar (Inputs, LG Home, Settings); Down goes back to the same column.
 *  - OK on Inputs opens a glass panel; Back closes it (Back anywhere else on the top bar returns to the apps). */
export function Home ({rows, topItems, inputs, active, onActivate}: Props) {
	const [zone, setZone] = useState<Zone>('rows');
	const [rowIndex, setRowIndex] = useState(0);
	const [columns, setColumns] = useState<Record<string, number>>({});
	const [topIndex, setTopIndex] = useState(0);
	const [panelIndex, setPanelIndex] = useState(0);

	const columnOf = (row: HomeRow) => clamp(columns[row.id] || 0, 0, Math.max(0, row.items.length - 1));
	const setColumn = (rowId: string, col: number) => setColumns((c) => ({...c, [rowId]: col}));

	const openPanel = () => { setPanelIndex(0); setZone('panel'); };
	const activateTop = (i: number) => {
		const item = topItems[i];
		if (!item) return;
		if (item.key === INPUTS_KEY) openPanel(); else onActivate('top', item);
	};
	const activatePanel = (i: number) => {
		const item = inputs[i];
		if (!item) return;
		setZone('top');
		onActivate('inputs', item);
	};

	const handleKey = useCallback((key: NavKey): boolean => {
		if (zone === 'panel') {
			const last = inputs.length - 1;
			switch (key) {
				case 'left': setPanelIndex((i) => clamp(i - 1, 0, last)); break;
				case 'right': setPanelIndex((i) => clamp(i + 1, 0, last)); break;
				case 'up': setPanelIndex((i) => (i - PANEL_COLUMNS >= 0 ? i - PANEL_COLUMNS : i)); break;
				case 'down': setPanelIndex((i) => (i + PANEL_COLUMNS <= last ? i + PANEL_COLUMNS : i)); break;
				case 'enter': activatePanel(panelIndex); break;
				case 'back': setZone('top'); break;
			}
			return true;
		}
		if (zone === 'top') {
			switch (key) {
				case 'left': setTopIndex((i) => clamp(i - 1, 0, topItems.length - 1)); break;
				case 'right': setTopIndex((i) => clamp(i + 1, 0, topItems.length - 1)); break;
				case 'down': case 'back': setZone('rows'); break;
				case 'enter': activateTop(topIndex); break;
			}
			return true;
		}
		const row = rows[rowIndex];
		if (!row) return false;
		// like tvOS, moving to another row keeps the same column (as far as that row reaches)
		const moveRow = (next: number) => {
			const target = rows[next];
			if (!target) return;
			setColumn(target.id, clamp(columnOf(row), 0, target.items.length - 1));
			setRowIndex(next);
		};
		switch (key) {
			case 'up': if (rowIndex === 0) setZone('top'); else moveRow(rowIndex - 1); return true;
			case 'down': moveRow(Math.min(rows.length - 1, rowIndex + 1)); return true;
			case 'left': setColumn(row.id, clamp(columnOf(row) - 1, 0, row.items.length - 1)); return true;
			case 'right': setColumn(row.id, clamp(columnOf(row) + 1, 0, row.items.length - 1)); return true;
			case 'enter': {
				const item = row.items[columnOf(row)];
				if (item) onActivate(row.id, item);
				return true;
			}
			case 'back': return true;   // swallow: Back on the home screen does nothing
		}
	}, [zone, rows, rowIndex, columns, topIndex, panelIndex, topItems, inputs, onActivate]);

	useKeys(handleKey, active);

	return (
		<div class="screen">
			<div class="topbar">
				{topItems.map((item, i) => (
					<div
						key={item.key}
						class={`pill${zone === 'top' && i === topIndex ? ' pill--focused' : ''}${zone === 'panel' && item.key === INPUTS_KEY ? ' pill--open' : ''}`}
						onMouseEnter={() => { if (zone !== 'panel') { setZone('top'); setTopIndex(i); } }}
						onClick={() => { setTopIndex(i); activateTop(i); }}
					>
						{item.glyph && <Glyph name={item.glyph} />}
						<span class="pill__label">{item.label}</span>
					</div>
				))}
				<Clock />
			</div>
			<div class="rows">
				{rows.map((row, i) => (
					<Row
						key={row.id}
						label={row.label}
						items={row.items}
						emptyText={row.emptyText}
						focused={zone === 'rows' && i === rowIndex}
						selected={columnOf(row)}
						onSelect={(col) => { if (zone === 'panel') return; setZone('rows'); setRowIndex(i); setColumn(row.id, col); }}
						onActivate={(col) => onActivate(row.id, row.items[col])}
					/>
				))}
			</div>
			{zone === 'panel' && (
				<>
					<div class="panel-backdrop" onClick={() => setZone('top')} />
					<div class="panel">
						<div class="panel__title">Inputs</div>
						<div class="panel__grid">
							{inputs.map((item, i) => (
								<Tile
									key={item.key}
									model={item}
									focused={i === panelIndex}
									onHover={() => setPanelIndex(i)}
									onActivate={() => activatePanel(i)}
								/>
							))}
							{inputs.length === 0 && <div class="panel__empty">No inputs selected: add some in Settings &gt; Sources</div>}
						</div>
					</div>
				</>
			)}
		</div>
	);
}
""")
sub('src/app.tsx', [
 ("const MISC_TILES: TileModel[] = [\n	{key: MISC.lgHome, label: 'LG Home', glyph: 'house'},\n	{key: MISC.settings, label: 'Settings', glyph: 'gear'}\n];", "const TOP_ITEMS: TileModel[] = [\n	{key: 'inputs', label: 'Inputs', glyph: 'inputs'},\n	{key: MISC.lgHome, label: 'LG Home', glyph: 'house'},\n	{key: MISC.settings, label: 'Settings', glyph: 'gear'}\n];\n\n/** The first row (in the glass shelf) holds this many apps; the rest go in a plain row below, like the tvOS home screen. */\nconst FIRST_ROW = 6;"),
 ("""		// Sources and More share one small dock at the bottom; the apps are the main thing on the screen
		{id: ROW.dock, label: 'Sources and more', compact: true, items: shownInputs.map(inputTile).concat(MISC_TILES)}
""", """		...(shownApps.length > FIRST_ROW ? [{id: ROW.dock, label: 'More apps', items: shownApps.slice(FIRST_ROW).map(appTile)}] : [])
"""),
 ("{id: ROW.apps, label: 'Apps', items: shownApps.map(appTile), emptyText:", "{id: ROW.apps, label: 'Apps', items: shownApps.slice(0, FIRST_ROW).map(appTile), emptyText:"),
 ("<Home rows={rows} active={screen === 'home'} onActivate={onActivate} />", "<Home rows={rows} topItems={TOP_ITEMS} inputs={shownInputs.map(inputTile)} active={screen === 'home'} onActivate={onActivate} />"),
])
css = open(P('src/theme/global.css')).read()
css += """
/* ---------- tvOS-style home: glass shelf on the first row only, top bar with round glass buttons, Inputs panel ---------- */

.rows > .row:not(:first-child)::before, .rows > .row:not(:first-child)::after { display: none; }
.rows > .row + .row { margin-top: 10px; }

.topbar { position: absolute; top: 64px; right: var(--layout-edge-padding); display: flex; flex-direction: row; align-items: center; z-index: 5; }
.topbar .clock { position: static; margin: 0; }
.pill {
	position: relative; width: 76px; height: 76px; border-radius: 38px; margin-right: 22px;
	display: flex; align-items: center; justify-content: center;
	transition: transform var(--motion-focus-ms) ease-out;
}
.pill svg { width: 36px; height: 36px; fill: none; stroke: #fff; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.pill__label { position: absolute; top: 92px; left: 50%; transform: translateX(-50%); font-size: 22px; white-space: nowrap; opacity: 0; transition: opacity var(--motion-focus-ms) ease-out; text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8); }
.pill--focused, .pill--open { transform: scale(1.14); }
.pill--focused .pill__label { opacity: 1; }
.pill--focused, .pill--open { background-image: linear-gradient(145deg, rgba(255, 255, 255, 0.50), rgba(255, 255, 255, 0.20) 55%, rgba(255, 255, 255, 0.34)), var(--wp-blur, var(--glass-fallback)); }
.pill--focused svg, .pill--open svg { stroke: #fff; }

.pill, .panel {
	background-image: linear-gradient(135deg, rgba(255, 255, 255, 0.26) 0%, rgba(255, 255, 255, 0.07) 42%, rgba(255, 255, 255, 0.16) 100%), var(--wp-blur, var(--glass-fallback));
	background-size: auto, 100vw 100vh;
	background-attachment: scroll, fixed;
	background-position: 0 0, 0 0;
	background-repeat: no-repeat;
	background-color: rgba(30, 36, 50, 0.30);
	box-shadow: inset 2px 2px 1.5px -1px rgba(255, 255, 255, 0.9), inset -2px -2px 1.5px -1px rgba(255, 255, 255, 0.42), inset 0 0 14px rgba(255, 255, 255, 0.10), 0 8px 18px rgba(0, 0, 0, 0.25);
}
.pill--focused, .pill--open { background-image: linear-gradient(145deg, rgba(255, 255, 255, 0.50), rgba(255, 255, 255, 0.20) 55%, rgba(255, 255, 255, 0.34)), var(--wp-blur, var(--glass-fallback)); }

.panel-backdrop { position: absolute; left: 0; top: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.38); z-index: 19; }
.panel {
	position: absolute; top: 190px; right: var(--layout-edge-padding); width: 760px; padding: 30px 36px 14px; border-radius: 44px; z-index: 20;
	animation: panel-in 180ms ease-out;
	--layout-tile-size: 200px; --layout-tile-height: 120px; --layout-tile-gap: 24px; --layout-tile-radius: 24px; --font-tile-label: 22px;
}
@keyframes panel-in { from { opacity: 0; transform: translateY(-14px); } to { opacity: 1; transform: none; } }
.panel__title { font-size: 30px; color: var(--color-text-primary); margin: 0 0 22px 6px; letter-spacing: 0.02em; }
.panel__grid { display: flex; flex-direction: row; flex-wrap: wrap; padding: 6px 6px 0; }
.panel .tile { margin: 0 24px 18px 0; }
.panel .tile:nth-child(3n) { margin-right: 0; }
.panel .tile__label { opacity: 1; height: auto; margin: 12px 0 0 0; width: var(--layout-tile-size); text-align: center; }
.panel .tile--focused .tile__box { box-shadow: 0 0 0 4px #fff, 0 14px 24px rgba(0, 0, 0, 0.35); }
.panel__empty { font-size: 24px; color: var(--color-text-secondary); padding: 10px 6px 24px; }
"""
open(P('src/theme/global.css'), 'w').write(css)

# ---------------------------------------------------------------- the second row stays hidden until the remote goes down to it
sub('src/components/Row.tsx', [
 ("	compact?: boolean;\n	onSelect", "	compact?: boolean;\n	/** a row revealed only when the remote navigates down to it (tvOS-style) */\n	hidden?: boolean;\n	onSelect"),
 ("emptyText, compact, onSelect, onActivate}", "emptyText, compact, hidden, onSelect, onActivate}"),
 ("${compact ? ' row--dock' : ''}`}>", "${compact ? ' row--dock' : ''}${hidden ? ' row--hidden' : ''}`}>"),
])
sub('src/screens/Home.tsx', [
 ("						focused={zone === 'rows' && i === rowIndex}\n", "						focused={zone === 'rows' && i === rowIndex}\n						hidden={i > 0 && !(zone === 'rows' && rowIndex >= i)}\n"),
])
css = open(P('src/theme/global.css')).read()
css += """
/* lower rows fade in from slightly below when the remote goes down to them, and fade out again when it leaves */
.row { transition: opacity 200ms ease-out, transform 200ms ease-out, visibility 0s linear 0s; }
.row--hidden { opacity: 0; transform: translateY(26px); visibility: hidden; pointer-events: none; transition: opacity 160ms ease-out, transform 160ms ease-out, visibility 0s linear 160ms; }
"""
open(P('src/theme/global.css'), 'w').write(css)

# ---------------------------------------------------------------- the shelf lives at the bottom; the stack slides up when the remote goes down to row 2
sub('src/screens/Home.tsx', [("			<div class=\"rows\">", "			<div class={`rows${zone === 'rows' && rowIndex >= 1 ? ' rows--lower' : ''}`}>")])
css = open(P('src/theme/global.css')).read()
css += """
/* the apps shelf sits at the bottom of the screen; going down to the second row slides the whole stack up (a compositor-only move) */
.rows { transition: transform 240ms cubic-bezier(0.2, 0.7, 0.2, 1); }
.rows--lower { transform: translateY(-300px); }
"""
open(P('src/theme/global.css'), 'w').write(css)

# ---------------------------------------------------------------- concentric corners: dock radius = icon radius + the even gap around the icons
sub('src/components/Row.tsx', [("		<section class={`row${focused ? ' row--focused' : ''}${compact ? ' row--dock' : ''}${hidden ? ' row--hidden' : ''}`}>", "		<section class={`row${focused ? ' row--focused' : ''}${compact ? ' row--dock' : ''}${hidden ? ' row--hidden' : ''}`} style={`--row-w:${total}px`}>")])
css = open(P('src/theme/global.css')).read()
css += """
/* The glass dock hugs the icons with the same gap on every side, and its corner radius is the icon radius plus that gap, so the
   outer and inner corners are concentric (as in the real tvOS dock). Gap = 24px (the real dock's gap is about 8% of the icon width). */
.row:not(.row--dock)::before {
	left: calc(50% - var(--row-w, 1556px) / 2 - 24px);
	right: auto;
	width: calc(var(--row-w, 1556px) + 48px);
	top: 16px;
	height: calc(var(--layout-tile-height) + 48px);
	border-radius: calc(var(--layout-tile-radius) + 24px);
}
.row:not(.row--dock)::after {
	left: calc(50% - var(--row-w, 1556px) / 2 + 8px);
	right: auto;
	width: calc(var(--row-w, 1556px) - 16px);
	top: 22px;
}
"""
open(P('src/theme/global.css'), 'w').write(css)

# ---------------------------------------------------------------- rest state: nothing is focused until the remote (or pointer) is used
sub('src/components/Row.tsx', [
 ("	hidden?: boolean;\n	onSelect", "	hidden?: boolean;\n	/** resting: no tile is focused (nothing lifted or named) until the remote is used */\n	rest?: boolean;\n	onSelect"),
 ("emptyText, compact, hidden, onSelect, onActivate}", "emptyText, compact, hidden, rest, onSelect, onActivate}"),
 ("<section class={`row${focused ? ' row--focused' : ''}", "<section class={`row${focused || rest ? ' row--focused' : ''}"),
 ("focused={focused && i === selected}", "focused={focused && !rest && i === selected}"),
])
sub('src/screens/Home.tsx', [
 ("import {useCallback, useState} from 'preact/hooks';", "import {useCallback, useEffect, useState} from 'preact/hooks';"),
 ("	const [zone, setZone] = useState<Zone>('rows');\n", "	const [zone, setZone] = useState<Zone>('rows');\n	// Resting state: until the first key press (or the pointer moving over something) no icon is focused. The first key press only\n	// brings the focus up on the first app; coming back to the launcher from another app rests again.\n	const [engaged, setEngaged] = useState(false);\n	useEffect(() => {\n		const rest = () => { if (!document.hidden) { setEngaged(false); setZone('rows'); setRowIndex(0); } };\n		document.addEventListener('visibilitychange', rest);\n		return () => document.removeEventListener('visibilitychange', rest);\n	}, []);\n"),
 ("	const handleKey = useCallback((key: NavKey): boolean => {\n", "	const handleKey = useCallback((key: NavKey): boolean => {\n		if (!engaged) { setEngaged(true); return true; }\n"),
 ("	}, [zone, rows, rowIndex, columns, topIndex, panelIndex, topItems, inputs, onActivate]);", "	}, [engaged, zone, rows, rowIndex, columns, topIndex, panelIndex, topItems, inputs, onActivate]);"),
 ("class={`pill${zone === 'top' && i === topIndex ? ' pill--focused' : ''}", "class={`pill${engaged && zone === 'top' && i === topIndex ? ' pill--focused' : ''}"),
 ("onMouseEnter={() => { if (zone !== 'panel') { setZone('top'); setTopIndex(i); } }}", "onMouseEnter={() => { if (zone !== 'panel') { setEngaged(true); setZone('top'); setTopIndex(i); } }}"),
 ("						focused={zone === 'rows' && i === rowIndex}\n", "						focused={engaged && zone === 'rows' && i === rowIndex}\n						rest={!engaged}\n"),
 ("onSelect={(col) => { if (zone === 'panel') return; setZone('rows');", "onSelect={(col) => { if (zone === 'panel') return; setEngaged(true); setZone('rows');"),
])

# ---------------------------------------------------------------- one clean top edge on the dock (the extra highlight line doubled the rim light)
css = open(P('src/theme/global.css')).read()
css += """
.row:not(.row--dock)::after { display: none; }
.row:not(.row--dock)::before {
	box-shadow: inset 0 2px 1px -1px rgba(255, 255, 255, 0.9), inset 2px 0 1px -1px rgba(255, 255, 255, 0.55), inset 0 -2px 1px -1px rgba(255, 255, 255, 0.30), inset -2px 0 1px -1px rgba(255, 255, 255, 0.30), inset 0 0 30px rgba(255, 255, 255, 0.08), 0 20px 44px rgba(0, 0, 0, 0.28);
}
"""
open(P('src/theme/global.css'), 'w').write(css)

# ---------------------------------------------------------------- pointer leaves the dock/top bar -> icons go back to rest (keys are unaffected)
sub('src/components/Row.tsx', [
 ("	rest?: boolean;\n	onSelect", "	rest?: boolean;\n	/** the pointer left this row */\n	onLeave?: () => void;\n	onSelect"),
 ("emptyText, compact, hidden, rest, onSelect, onActivate}", "emptyText, compact, hidden, rest, onLeave, onSelect, onActivate}"),
 ("style={`--row-w:${total}px`}>", "style={`--row-w:${total}px`} onMouseLeave={onLeave}>"),
])
sub('src/screens/Home.tsx', [
 ("import {useCallback, useEffect, useState} from 'preact/hooks';", "import {useCallback, useEffect, useRef, useState} from 'preact/hooks';"),
 ("	const [engaged, setEngaged] = useState(false);\n", "	const [engaged, setEngaged] = useState(false);\n	// who moved the focus last: with the pointer, leaving the dock puts the icons back to rest; with the keys it stays where it is\n	const mode = useRef<'key' | 'pointer'>('key');\n	const pointerLeft = () => { if (mode.current === 'pointer' && zone !== 'panel') setEngaged(false); };\n"),
 ("		if (!engaged) { setEngaged(true); return true; }\n", "		mode.current = 'key';\n		if (!engaged) { setEngaged(true); return true; }\n"),
 ("onMouseEnter={() => { if (zone !== 'panel') { setEngaged(true);", "onMouseLeave={pointerLeft}\n						onMouseEnter={() => { if (zone !== 'panel') { mode.current = 'pointer'; setEngaged(true);"),
 ("						rest={!engaged}\n", "						rest={!engaged}\n						onLeave={pointerLeft}\n"),
 ("onSelect={(col) => { if (zone === 'panel') return; setEngaged(true);", "onSelect={(col) => { if (zone === 'panel') return; mode.current = 'pointer'; setEngaged(true);"),
])

# ---------------------------------------------------------------- preview only: scale the fixed 1920x1080 layout to fit the browser window (compiled out of the real build)
main = open(P('src/main.tsx')).read()
main += """
// Dev preview only (import.meta.env.DEV is false in the real build): the layout is a fixed 1920x1080 "TV screen". Scale it to fit the
// window, centre it, and keep the wallpaper layers inside it, with black bars where the window is bigger than a 16:9 screen.
if (import.meta.env.DEV) {
	const style = document.createElement('style');
	style.textContent = 'html{background:#000;overflow:hidden}#wpimage,#bgvideo{left:var(--dev-left,0px)!important;top:var(--dev-top,0px)!important;width:1920px!important;height:1080px!important}';
	document.head.appendChild(style);
	const fit = () => {
		const z = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
		const root = document.documentElement;
		root.style.zoom = String(z);
		const left = Math.max(0, (window.innerWidth / z - 1920) / 2);
		const top = Math.max(0, (window.innerHeight / z - 1080) / 2);
		root.style.setProperty('--dev-left', left + 'px');
		root.style.setProperty('--dev-top', top + 'px');
		document.body.style.marginLeft = left + 'px';
		document.body.style.marginTop = top + 'px';
	};
	fit();
	window.addEventListener('resize', fit);
}
"""
open(P('src/main.tsx'), 'w').write(main)

# ---------------------------------------------------------------- a real gear for Settings (Material Design "settings" outline path, Apache-2.0); the old circle-with-spokes read as a sun
sub('src/components/Glyph.tsx', [
 ("""				: <>
					<circle cx="12" cy="12" r="3.2" />
					<path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />
				</>}""", """				: <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />}"""),
])

# ---------------------------------------------------------------- top bar: the three round buttons are the same height as the time pill (58px)
css = open(P('src/theme/global.css')).read()
css += """
.pill { width: 58px; height: 58px; border-radius: 29px; margin-right: 16px; }
.pill svg { width: 28px; height: 28px; }
.pill__label { top: 72px; font-size: 20px; }
.topbar .clock { height: 58px; box-sizing: border-box; display: flex; align-items: center; padding: 0 26px; border-radius: 29px; }
.topbar .clock__time { line-height: 1; }
"""
open(P('src/theme/global.css'), 'w').write(css)

# ================================================================ Settings in the tvOS look: solid wallpaper-tinted backdrop, centred glass tab bar, white-capsule selected tab
s_ = open(P('src/screens/Settings.tsx')).read()
a_ = '\t\t\t\t<div class="settings__tabs">\n\t\t\t\t\t{labels.map('
b_ = '\t\t\t\t\t))}\n\t\t\t\t\t{tab && ('
assert a_ in s_ and b_ in s_
s_ = s_.replace(a_, '\t\t\t\t<div class="settings__tabs">\n\t\t\t\t\t<div class="tabbar">\n\t\t\t\t\t{labels.map(', 1).replace(b_, '\t\t\t\t\t))}\n\t\t\t\t\t</div>\n\t\t\t\t\t{tab && (', 1)
open(P('src/screens/Settings.tsx'), 'w').write(s_)
css = open(P('src/theme/global.css')).read()
css += """
/* ---------- Settings, tvOS style ---------- */

/* a fully solid backdrop (nothing of the home screen shows through): the blurred wallpaper copy, darkened */
.screen.screen--settings, .wp-image .screen.screen--settings, .wp-video .screen.screen--settings {
	background-color: #0b0e16;
	background-image: linear-gradient(rgba(8, 10, 18, 0.50), rgba(8, 10, 18, 0.66)), var(--wp-blur, none);
	background-size: cover;
	background-position: center;
	background-repeat: no-repeat;
	background-attachment: scroll;
}
.settings__title { display: none; }
.settings__hint { text-align: center; margin: 0 0 26px; font-size: 22px; color: rgba(255, 255, 255, 0.55); }
.settings__tabs { position: relative; display: flex; flex-direction: row; justify-content: center; align-items: center; margin: 0 0 44px; }

/* the floating glass tab bar: the focused tab is a white capsule with dark text, the chosen one a lighter glass capsule */
.tabbar {
	display: flex; flex-direction: row; padding: 8px; border-radius: 48px;
	background-image: linear-gradient(135deg, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0.06) 45%, rgba(255, 255, 255, 0.14)), var(--wp-blur, var(--glass-fallback));
	background-size: auto, 100vw 100vh; background-attachment: scroll, fixed; background-position: 0 0, 0 0; background-repeat: no-repeat;
	background-color: rgba(30, 36, 50, 0.30);
	box-shadow: inset 2px 2px 1.5px -1px rgba(255, 255, 255, 0.85), inset -2px -2px 1.5px -1px rgba(255, 255, 255, 0.35), 0 12px 28px rgba(0, 0, 0, 0.30);
}
.tab {
	margin: 0 2px; padding: 14px 38px; border-radius: 40px; border-bottom: none;
	font-size: 30px; font-weight: 600; letter-spacing: 0.01em; text-transform: none;
	color: rgba(255, 255, 255, 0.72);
	transition: background-color var(--motion-focus-ms) ease-out, color var(--motion-focus-ms) ease-out;
}
.tab--active { background-color: rgba(255, 255, 255, 0.20); color: #fff; border-bottom-color: transparent; }
.tab--focused { background-color: #fff; color: #111; border-bottom-color: transparent; }
.tab--locked { opacity: 0.4; }
.settings__button { position: absolute; right: 0; top: 50%; margin: 0; transform: translateY(-50%); font-size: 24px; padding: 14px 30px; }
.settings__button--focused { transform: translateY(-50%) scale(1.06); background-image: none; background-color: #fff; color: #111; box-shadow: 0 10px 22px rgba(0, 0, 0, 0.35); }
.settings__button--active { background-image: none; background-color: rgba(255, 255, 255, 0.9); color: #111; }
"""
open(P('src/theme/global.css'), 'w').write(css)

# ================================================================ Home navigation state lives in a ref (always current), not in React state captured by a stale closure.
# On a slow TV a held arrow key can fire several events before the next redraw; with closure state those events act on old values and
# moves are dropped. Every key handler reads and writes `nav.current` directly, then asks for a redraw.
write('src/screens/Home.tsx', """import {useCallback, useEffect, useRef, useState} from 'preact/hooks';
import {Clock} from '../components/Clock';
import {Glyph} from '../components/Glyph';
import {Row} from '../components/Row';
import {Tile, type TileModel} from '../components/Tile';
import {useKeys, clamp, type NavKey} from '../hooks/useKeys';

export interface HomeRow {
	id: string;
	label: string;
	items: TileModel[];
	emptyText?: string;
	compact?: boolean;
}

interface Props {
	rows: HomeRow[];
	/** the round buttons at the top right: Inputs, LG Home, Settings */
	topItems: TileModel[];
	/** what the Inputs panel lists */
	inputs: TileModel[];
	active: boolean;
	onActivate: (rowId: string, item: TileModel) => void;
}

/** Where the remote's focus is: a row of apps, the top bar, or the open Inputs panel. */
type Zone = 'rows' | 'top' | 'panel';

interface Nav {
	/** false = resting: nothing is focused until the remote (or the pointer) is used */
	engaged: boolean;
	zone: Zone;
	rowIndex: number;
	columns: Record<string, number>;
	topIndex: number;
	panelIndex: number;
	/** who moved the focus last: leaving the dock with the pointer rests the icons, with the keys the focus stays */
	mode: 'key' | 'pointer';
}

const PANEL_COLUMNS = 3;
const INPUTS_KEY = 'inputs';

/** The home screen, navigated like tvOS:
 *  - Left/Right move along a row; Up/Down move between rows (same column, as far as that row reaches).
 *  - Up from the first row reaches the top bar (Inputs, LG Home, Settings); Down goes back to the same app.
 *  - OK on Inputs opens a glass panel; Back closes it (Back on the top bar returns to the apps).
 *  - The second row stays hidden until the remote goes down to it. */
export function Home ({rows, topItems, inputs, active, onActivate}: Props) {
	const nav = useRef<Nav>({engaged: false, zone: 'rows', rowIndex: 0, columns: {}, topIndex: 0, panelIndex: 0, mode: 'key'});
	const latest = useRef({rows, topItems, inputs, onActivate});
	latest.current = {rows, topItems, inputs, onActivate};
	const [, redraw] = useState(0);
	const render = () => redraw((n) => n + 1);

	// coming back to the launcher from another app: rest again
	useEffect(() => {
		const rest = () => {
			if (document.hidden) return;
			const n = nav.current;
			n.engaged = false; n.zone = 'rows'; n.rowIndex = 0;
			render();
		};
		document.addEventListener('visibilitychange', rest);
		return () => document.removeEventListener('visibilitychange', rest);
	}, []);

	const columnOf = (row: HomeRow) => clamp(nav.current.columns[row.id] || 0, 0, Math.max(0, row.items.length - 1));

	const openPanel = () => { const n = nav.current; n.panelIndex = 0; n.zone = 'panel'; render(); };
	const activateTop = (i: number) => {
		const {topItems: items, onActivate: act} = latest.current;
		const item = items[i];
		if (!item) return;
		if (item.key === INPUTS_KEY) openPanel(); else act('top', item);
	};
	const activatePanel = (i: number) => {
		const {inputs: list, onActivate: act} = latest.current;
		const item = list[i];
		if (!item) return;
		nav.current.zone = 'top';
		render();
		act('inputs', item);
	};
	const pointerLeft = () => {
		const n = nav.current;
		if (n.mode === 'pointer' && n.zone !== 'panel') { n.engaged = false; render(); }
	};

	const handleKey = useCallback((key: NavKey): boolean => {
		const n = nav.current;
		const {rows: allRows, topItems: tops, inputs: ins, onActivate: act} = latest.current;
		n.mode = 'key';
		if (!n.engaged) { n.engaged = true; render(); return true; }   // the first press only brings the focus up

		if (n.zone === 'panel') {
			const last = ins.length - 1;
			switch (key) {
				case 'left': n.panelIndex = clamp(n.panelIndex - 1, 0, last); break;
				case 'right': n.panelIndex = clamp(n.panelIndex + 1, 0, last); break;
				case 'up': if (n.panelIndex - PANEL_COLUMNS >= 0) n.panelIndex -= PANEL_COLUMNS; break;
				case 'down': if (n.panelIndex + PANEL_COLUMNS <= last) n.panelIndex += PANEL_COLUMNS; break;
				case 'enter': activatePanel(n.panelIndex); return true;
				case 'back': n.zone = 'top'; break;
			}
			render();
			return true;
		}
		if (n.zone === 'top') {
			switch (key) {
				case 'left': n.topIndex = clamp(n.topIndex - 1, 0, tops.length - 1); break;
				case 'right': n.topIndex = clamp(n.topIndex + 1, 0, tops.length - 1); break;
				case 'down': case 'back': n.zone = 'rows'; break;
				case 'enter': activateTop(n.topIndex); return true;
			}
			render();
			return true;
		}

		const rowIndex = clamp(n.rowIndex, 0, allRows.length - 1);
		const row = allRows[rowIndex];
		if (!row) return false;
		// like tvOS, moving to another row keeps the same column (as far as that row reaches)
		const moveRow = (next: number) => {
			const target = allRows[next];
			if (!target) return;
			n.columns[target.id] = clamp(columnOf(row), 0, target.items.length - 1);
			n.rowIndex = next;
		};
		switch (key) {
			case 'up': if (rowIndex === 0) n.zone = 'top'; else moveRow(rowIndex - 1); break;
			case 'down': moveRow(Math.min(allRows.length - 1, rowIndex + 1)); break;
			case 'left': n.columns[row.id] = clamp(columnOf(row) - 1, 0, row.items.length - 1); break;
			case 'right': n.columns[row.id] = clamp(columnOf(row) + 1, 0, row.items.length - 1); break;
			case 'enter': { const item = row.items[columnOf(row)]; if (item) act(row.id, item); return true; }
			case 'back': return true;   // swallow: Back on the home screen does nothing
		}
		render();
		return true;
	}, []);

	useKeys(handleKey, active);

	const n = nav.current;
	const rowIndex = clamp(n.rowIndex, 0, Math.max(0, rows.length - 1));
	return (
		<div class="screen">
			<div class="topbar">
				{topItems.map((item, i) => (
					<div
						key={item.key}
						class={`pill${n.engaged && n.zone === 'top' && i === n.topIndex ? ' pill--focused' : ''}${n.zone === 'panel' && item.key === INPUTS_KEY ? ' pill--open' : ''}`}
						onMouseLeave={pointerLeft}
						onMouseEnter={() => { if (n.zone !== 'panel') { n.mode = 'pointer'; n.engaged = true; n.zone = 'top'; n.topIndex = i; render(); } }}
						onClick={() => { n.topIndex = i; activateTop(i); }}
					>
						{item.glyph && <Glyph name={item.glyph} />}
						<span class="pill__label">{item.label}</span>
					</div>
				))}
				<Clock />
			</div>
			<div class={`rows${n.zone === 'rows' && rowIndex >= 1 ? ' rows--lower' : ''}`}>
				{rows.map((row, i) => (
					<Row
						key={row.id}
						label={row.label}
						items={row.items}
						emptyText={row.emptyText}
						focused={n.engaged && n.zone === 'rows' && i === rowIndex}
						hidden={i > 0 && !(n.zone === 'rows' && rowIndex >= i)}
						rest={!n.engaged}
						onLeave={pointerLeft}
						selected={columnOf(row)}
						onSelect={(col) => { if (n.zone === 'panel') return; n.mode = 'pointer'; n.engaged = true; n.zone = 'rows'; n.rowIndex = i; n.columns[row.id] = col; render(); }}
						onActivate={(col) => latest.current.onActivate(row.id, row.items[col])}
					/>
				))}
			</div>
			{n.zone === 'panel' && (
				<>
					<div class="panel-backdrop" onClick={() => { n.zone = 'top'; render(); }} />
					<div class="panel">
						<div class="panel__title">Inputs</div>
						<div class="panel__grid">
							{inputs.map((item, i) => (
								<Tile
									key={item.key}
									model={item}
									focused={i === n.panelIndex}
									onHover={() => { n.panelIndex = i; render(); }}
									onActivate={() => activatePanel(i)}
								/>
							))}
							{inputs.length === 0 && <div class="panel__empty">No inputs selected: add some in Settings &gt; Sources</div>}
						</div>
					</div>
				</>
			)}
		</div>
	);
}
""")

# ================================================================ glass fixes: the pre-blurred picture is sized to the 1920x1080 stage (it used 100vw/100vh and could fall short);
# Settings cards use plain translucent glass over the (already dark, already blurred) backdrop so text stays readable
css = open(P('src/theme/global.css')).read()
css = css.replace('100vw 100vh', '1920px 1080px').replace('background-position: 0 0, 0 0;', 'background-position: 0 0, var(--dev-left, 0px) var(--dev-top, 0px);')
css += """
/* Settings: translucent white glass over the dark blurred backdrop (no second picture, nothing to misalign) */
.tabbar, .option, .wp__chip, .settings__button {
	background-image: linear-gradient(145deg, rgba(255, 255, 255, 0.17), rgba(255, 255, 255, 0.06));
	background-size: auto;
	background-attachment: scroll;
	background-position: 0 0;
	background-color: rgba(255, 255, 255, 0.04);
}
.wp__chip--on { background-image: linear-gradient(145deg, rgba(255, 255, 255, 0.30), rgba(255, 255, 255, 0.14)); }
.wp__chip--focused { background-image: none; background-color: #fff; }
.option--focused { background-image: linear-gradient(145deg, rgba(255, 255, 255, 0.34), rgba(255, 255, 255, 0.12)); }
.option__description { color: rgba(255, 255, 255, 0.72); }
"""
open(P('src/theme/global.css'), 'w').write(css)
# preview only: open a given Settings tab straight from the address (?settings&tab=0..3), to check every page without keystrokes
sub('src/app.tsx', [("useState<Screen>('home')", "useState<Screen>(import.meta.env.DEV && /[?&]settings/.test(location.search) ? 'settings' : 'home')")])
sub('src/screens/Settings.tsx', [("const [tabIndex, setTabIndex] = useState(0);", r"const [tabIndex, setTabIndex] = useState(import.meta.env.DEV ? Number((/[?&]tab=(\d)/.exec(location.search) || [])[1] || 0) : 0);")])

# the "current wallpaper" tick: a JSX text node does not interpret escapes, so it printed the raw text; use a JS string instead
_bs = chr(92)
sub('src/components/WallpaperPicker.tsx', [('<span class="wp__tick">' + _bs + 'u2713</span>', '<span class="wp__tick">{' + chr(39) + _bs + 'u2713' + chr(39) + '}</span>')])

# ================================================================ second-row view like tvOS
# A transformed ancestor breaks `background-attachment: fixed`, which the glass uses to line its blurred picture up with the screen. So the
# stack slides up by animating `top` (not transform), and the wallpaper dims while the lower rows are in use.
sub('src/screens/Home.tsx', [("		<div class=\"screen\">\n			<div class=\"topbar\">", "		<div class={`screen${n.zone === 'rows' && rowIndex >= 1 ? ' screen--lower' : ''}`}>\n			<div class=\"topbar\">")])
css = open(P('src/theme/global.css')).read()
css += """
.rows { transition: top 240ms cubic-bezier(0.2, 0.7, 0.2, 1); }
.rows--lower { transform: none; top: calc(var(--layout-rows-top) - 300px); }
.screen--lower::before { content: ''; position: absolute; left: 0; top: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.34); animation: lower-dim 220ms ease-out; pointer-events: none; }
@keyframes lower-dim { from { opacity: 0; } to { opacity: 1; } }
"""
open(P('src/theme/global.css'), 'w').write(css)

# ================================================================ lower rows like the tvOS app grid: a strongly blurred full-screen backdrop, and row 2 left-aligned to the dock's columns
sub('src/lib/wallpaper.ts', [("""	if (!url) { style.removeProperty('--wp-blur'); return; }
	const probe = new Image();
	probe.onload = () => style.setProperty('--wp-blur', `url("${url}")`);
	probe.src = url;
}""", """	if (!url) { style.removeProperty('--wp-blur'); style.removeProperty('--wp-bg'); return; }
	const load = (name: string, src: string) => {
		const probe = new Image();
		probe.onload = () => style.setProperty(name, `url("${src}")`);
		probe.src = src;
	};
	load('--wp-blur', url);
	// the stronger, smaller copy shown behind the lower rows
	load('--wp-bg', url.replace(/-blur\\.jpg$/, '-bg.jpg').replace('w=960&h=540', 'w=480&h=270').replace(/blur=\\d+/, 'blur=18'));
}""")])
css = open(P('src/theme/global.css')).read()
css += """
/* going down into the lower rows fades the wallpaper to a strongly blurred, slightly darkened copy, as the tvOS app grid does */
.screen--lower::before {
	background-color: #10131c;
	background-image: linear-gradient(rgba(0, 0, 0, 0.26), rgba(0, 0, 0, 0.26)), var(--wp-bg, none);
	background-size: auto, cover;
	background-position: 0 0, center;
	background-repeat: no-repeat;
}
/* the second row lines up with the dock's columns (left-aligned) instead of floating in the middle */
.rows > .row:not(:first-child) .row__track--centered { margin-left: calc((1640px - 1556px) / 2); margin-right: 0; }
"""
open(P('src/theme/global.css'), 'w').write(css)

# row 2 starts at the same left edge as the dock's first icon; in the lower view the glass shows the same strong blur as the backdrop
css = open(P('src/theme/global.css')).read()
css += """
.rows > .row:not(:first-child) .row__track--centered { justify-content: flex-start; padding-left: calc((1640px - 1556px) / 2); margin-left: 0; }
.screen--lower { --wp-blur: var(--wp-bg); }
"""
open(P('src/theme/global.css'), 'w').write(css)

# ================================================================ a "Shuffle <category>" tile at the start of every wallpaper category
sub('src/lib/wallpaper.ts', [("	if (sel === 'shuffle' && WALLPAPERS.length > 0) id = WALLPAPERS[Math.floor(Math.random() * WALLPAPERS.length)].id;", """	if (sel.indexOf('shuffle') === 0) {
		// 'shuffle' = anything from the cloud library; 'shuffle:<category>' = only that category
		const group = sel.indexOf('shuffle:') === 0 ? WALLPAPERS.filter((w) => w.category === sel.slice(8)) : WALLPAPERS;
		if (group.length > 0) id = group[Math.floor(Math.random() * group.length)].id;
	}""")])
sub('src/app.tsx', [("		WALLPAPERS.forEach((w) => entries.push(", "		WALLPAPER_CATEGORIES.forEach((c) => entries.push({key: `shuffle:${c}`, title: `Shuffle ${c}`, category: c}));\n		WALLPAPERS.forEach((w) => entries.push(")])
# the "All" page lists every picture (and the global Shuffle) but not the per-category shuffle tiles
sub('src/screens/Settings.tsx', [("const wpList = wallpaper.entries.filter((e) => wpName === 'All' || e.category === wpName);", "const wpList = wallpaper.entries.filter((e) => (wpName === 'All' ? e.key.indexOf('shuffle:') !== 0 : e.category === wpName));")])

# ================================================================ lets the TV register this app as an input (com.webos.service.eim/addDevice needs supportGIP in the manifest)
sub('public/appinfo.json', [('"disableBackHistoryAPI": true,', '"disableBackHistoryAPI": true,\n  "supportGIP": true,')])

# ---------------------------------------------------------------- no instruction line above the Settings tab bar (the empty-state message further down keeps its own style)
css = open(P('src/theme/global.css')).read()
css += """
.settings__title + .settings__hint { display: none; }
.settings__tabs { margin-top: 24px; }
"""
open(P('src/theme/global.css'), 'w').write(css)

# ================================================================ AM/PM is hidden on the clock pill; Settings > Options has a switch to show it (only matters when the TV uses a 12-hour clock)
sub('src/lib/storage.ts', [
 ("	wallpaper: string;\n}", "	wallpaper: string;\n	/** show AM/PM beside the time when the TV uses a 12-hour clock */\n	showAmPm: boolean;\n}"),
 ("	wallpaper: 'local:0'\n};", "	wallpaper: 'local:0',\n	showAmPm: false\n};"),
 ("parsed.wallpaper : DEFAULT_CONFIG.wallpaper\n", "parsed.wallpaper : DEFAULT_CONFIG.wallpaper,\n			showAmPm: parsed.showAmPm === true\n"),
])
sub('src/app.tsx', [
 ("videoWallpaper: 'video-wallpaper'} as const;", "videoWallpaper: 'video-wallpaper', showAmPm: 'show-ampm'} as const;"),
 ("			value: config.videoWallpaper\n		}\n	], [config.useHomebrew, config.videoWallpaper]);", "			value: config.videoWallpaper\n		},\n		{\n			id: OPTION.showAmPm,\n			label: 'AM/PM on the clock',\n			description: 'Show AM or PM beside the time when the TV is set to a 12-hour clock. Off by default.',\n			value: config.showAmPm\n		}\n	], [config.useHomebrew, config.videoWallpaper, config.showAmPm]);"),
 ("		else if (optionId === OPTION.videoWallpaper) updateConfig({...config, videoWallpaper: !config.videoWallpaper});", "		else if (optionId === OPTION.videoWallpaper) updateConfig({...config, videoWallpaper: !config.videoWallpaper});\n		else if (optionId === OPTION.showAmPm) updateConfig({...config, showAmPm: !config.showAmPm});"),
 ("active={screen === 'home'} onActivate={onActivate} />", "active={screen === 'home'} onActivate={onActivate} showPeriod={config.showAmPm} />"),
])
sub('src/screens/Home.tsx', [
 ("	active: boolean;\n	onActivate: (rowId: string, item: TileModel) => void;\n}", "	active: boolean;\n	onActivate: (rowId: string, item: TileModel) => void;\n	/** show AM/PM beside the time (12-hour clocks) */\n	showPeriod?: boolean;\n}"),
 ("export function Home ({rows, topItems, inputs, active, onActivate}: Props) {", "export function Home ({rows, topItems, inputs, active, onActivate, showPeriod}: Props) {"),
 ("				<Clock />", "				<Clock showPeriod={showPeriod} />"),
])
sub('src/components/Clock.tsx', [
 ("export function Clock () {", "export function Clock ({showPeriod}: {showPeriod?: boolean}) {"),
 ("{period && <span class=\"clock__period\">{period}</span>}", "{showPeriod && period && <span class=\"clock__period\">{period}</span>}"),
])

# ================================================================ top bar: Inputs stays a round button; LG Home + Settings + the time share one glass pill
home = open(P('src/screens/Home.tsx')).read()
a_ = home.index('\t\t\t<div class="topbar">')
b_ = home.index('\t\t\t<div class={`rows')
home = home[:a_] + '''\t\t\t<div class="topbar">
\t\t\t\t{topItems.slice(0, 1).map((item, i) => pill(item, i))}
\t\t\t\t<div class="topcap">
\t\t\t\t\t{topItems.slice(1).map((item, j) => pill(item, j + 1))}
\t\t\t\t\t<Clock showPeriod={showPeriod} />
\t\t\t\t</div>
\t\t\t</div>
''' + home[b_:]
r_ = home.index('\treturn (\n\t\t<div class={`screen')
home = home[:r_] + '''\tconst pill = (item: TileModel, i: number) => (
\t\t<div
\t\t\tkey={item.key}
\t\t\tclass={`pill${n.engaged && n.zone === 'top' && i === n.topIndex ? ' pill--focused' : ''}${n.zone === 'panel' && item.key === INPUTS_KEY ? ' pill--open' : ''}`}
\t\t\tonMouseLeave={pointerLeft}
\t\t\tonMouseEnter={() => { if (n.zone !== 'panel') { n.mode = 'pointer'; n.engaged = true; n.zone = 'top'; n.topIndex = i; render(); } }}
\t\t\tonClick={() => { n.topIndex = i; activateTop(i); }}
\t\t>
\t\t\t{item.glyph && <Glyph name={item.glyph} />}
\t\t\t<span class="pill__label">{item.label}</span>
\t\t</div>
\t);
''' + home[r_:]
open(P('src/screens/Home.tsx'), 'w').write(home)
css = open(P('src/theme/global.css')).read()
css += """
/* the shared pill: Home and Settings icons, then the time. The selected icon gets a white circle (like a tvOS segmented control). */
.topcap {
	position: relative; display: flex; flex-direction: row; align-items: center; height: 58px; padding: 0 6px 0 8px; border-radius: 29px;
	background-image: linear-gradient(135deg, rgba(255, 255, 255, 0.26) 0%, rgba(255, 255, 255, 0.07) 42%, rgba(255, 255, 255, 0.16) 100%), var(--wp-blur, var(--glass-fallback));
	background-size: auto, 1920px 1080px; background-attachment: scroll, fixed; background-position: 0 0, var(--dev-left, 0px) var(--dev-top, 0px); background-repeat: no-repeat;
	background-color: rgba(30, 36, 50, 0.30);
	box-shadow: inset 2px 2px 1.5px -1px rgba(255, 255, 255, 0.9), inset -2px -2px 1.5px -1px rgba(255, 255, 255, 0.42), inset 0 0 14px rgba(255, 255, 255, 0.10), 0 8px 18px rgba(0, 0, 0, 0.25);
}
.topcap .pill { width: 42px; height: 42px; border-radius: 21px; margin: 0 4px 0 0; background-image: none; background-color: transparent; box-shadow: none; }
.topcap .pill svg { width: 26px; height: 26px; }
.topcap .pill__label { top: 62px; }
.topcap .pill--focused { background-color: #fff; transform: scale(1.1); }
.topcap .pill--focused svg { stroke: #111; }
.topcap .clock { background-image: none; background-color: transparent; box-shadow: none; padding: 0 20px 0 10px; border-radius: 0; height: 58px; margin: 0; }
"""
open(P('src/theme/global.css'), 'w').write(css)

# ================================================================ the time pill is a button: OK opens a glass menu (LG Home, Settings, Start Screensaver) like the Inputs panel
_bs = chr(92)
sub('src/components/Glyph.tsx', [
 ("export type GlyphName = 'house' | 'gear' | 'inputs';", "export type GlyphName = 'house' | 'gear' | 'inputs' | 'screensaver';"),
 ("				: name === 'inputs'\n", "				: name === 'screensaver'\n				? <path d=\"M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z\" />\n				: name === 'inputs'\n"),
])
write('src/lib/system.ts', """// System actions the web app cannot do itself. They go through the Homebrew Channel's root service (the same path as the live app list),
// with fixed commands only.

import {LUNA} from '../config/constants';
import {isWebOS, lunaCall} from './luna';

/** Starts the TV's screensaver now (tvpower/turnOnScreenSaver is a system-only call, so it runs as root via the Homebrew Channel). */
export function startScreensaver (): Promise<void> {
	if (!isWebOS()) return Promise.reject(new Error('not on a TV'));
	return lunaCall(LUNA.homebrewExec, {command: "luna-send -n 1 luna://com.webos.service.tvpower/power/turnOnScreenSaver '{}'"}, 6000).then(() => undefined);
}
""")
sub('src/app.tsx', [
 ("import {setVideoWallpaper} from './lib/wallpaperVideo';", "import {setVideoWallpaper} from './lib/wallpaperVideo';\nimport {startScreensaver} from './lib/system';"),
 ("""const TOP_ITEMS: TileModel[] = [
	{key: 'inputs', label: 'Inputs', glyph: 'inputs'},
	{key: MISC.lgHome, label: 'LG Home', glyph: 'house'},
	{key: MISC.settings, label: 'Settings', glyph: 'gear'}
];""", """/** The top bar: the Inputs button, and the time pill that opens the menu below. */
const TOP_ITEMS: TileModel[] = [
	{key: 'inputs', label: 'Inputs', glyph: 'inputs'},
	{key: 'menu', label: 'Menu'}
];
/** What the time pill's menu lists. */
const MENU_ITEMS: TileModel[] = [
	{key: MISC.lgHome, label: 'LG Home', glyph: 'house'},
	{key: MISC.settings, label: 'Settings', glyph: 'gear'},
	{key: 'screensaver', label: 'Start Screensaver', glyph: 'screensaver'}
];"""),
 ("		if (item.key === MISC.settings) { setScreen('settings'); return; }", "		if (item.key === MISC.settings) { setScreen('settings'); return; }\n		if (item.key === 'screensaver') { startScreensaver().catch(() => showToast(\"Couldn't start the screensaver (it needs the Homebrew Channel)\", 'error')); return; }"),
 ("topItems={TOP_ITEMS} inputs=", "topItems={TOP_ITEMS} menuItems={MENU_ITEMS} inputs="),
])
# Home: rewritten once more with the menu zone
write('src/screens/Home.tsx', """import {useCallback, useEffect, useRef, useState} from 'preact/hooks';
import {Clock} from '../components/Clock';
import {Glyph} from '../components/Glyph';
import {Row} from '../components/Row';
import {Tile, type TileModel} from '../components/Tile';
import {useKeys, clamp, type NavKey} from '../hooks/useKeys';

export interface HomeRow {
	id: string;
	label: string;
	items: TileModel[];
	emptyText?: string;
	compact?: boolean;
}

interface Props {
	rows: HomeRow[];
	/** the top bar: the Inputs button, then the time pill that opens the menu */
	topItems: TileModel[];
	/** what the time pill's menu lists (LG Home, Settings, Start Screensaver) */
	menuItems: TileModel[];
	/** what the Inputs panel lists */
	inputs: TileModel[];
	active: boolean;
	onActivate: (rowId: string, item: TileModel) => void;
	/** show AM/PM beside the time (12-hour clocks) */
	showPeriod?: boolean;
}

/** Where the remote's focus is: a row of apps, the top bar, or one of the two open panels. */
type Zone = 'rows' | 'top' | 'panel' | 'menu';

interface Nav {
	/** false = resting: nothing is focused until the remote (or the pointer) is used */
	engaged: boolean;
	zone: Zone;
	rowIndex: number;
	columns: Record<string, number>;
	topIndex: number;
	panelIndex: number;
	menuIndex: number;
	/** who moved the focus last: leaving the dock with the pointer rests the icons, with the keys the focus stays */
	mode: 'key' | 'pointer';
}

const PANEL_COLUMNS = 3;
const INPUTS_KEY = 'inputs';
const MENU_KEY = 'menu';

/** The home screen, navigated like tvOS:
 *  - Left/Right move along a row; Up/Down move between rows (same column, as far as that row reaches).
 *  - Up from the first row reaches the top bar (Inputs button, time pill); Down goes back to the same app.
 *  - OK on Inputs opens the inputs panel, OK on the time pill opens the menu; Back closes either.
 *  - The second row stays hidden until the remote goes down to it. */
export function Home ({rows, topItems, menuItems, inputs, active, onActivate, showPeriod}: Props) {
	const nav = useRef<Nav>({engaged: false, zone: 'rows', rowIndex: 0, columns: {}, topIndex: 0, panelIndex: 0, menuIndex: 0, mode: 'key'});
	const latest = useRef({rows, topItems, menuItems, inputs, onActivate});
	latest.current = {rows, topItems, menuItems, inputs, onActivate};
	const [, redraw] = useState(0);
	const render = () => redraw((n) => n + 1);

	// coming back to the launcher from another app: rest again
	useEffect(() => {
		const rest = () => {
			if (document.hidden) return;
			const n = nav.current;
			n.engaged = false; n.zone = 'rows'; n.rowIndex = 0;
			render();
		};
		document.addEventListener('visibilitychange', rest);
		return () => document.removeEventListener('visibilitychange', rest);
	}, []);

	const columnOf = (row: HomeRow) => clamp(nav.current.columns[row.id] || 0, 0, Math.max(0, row.items.length - 1));

	const activateTop = (i: number) => {
		const n = nav.current;
		const item = latest.current.topItems[i];
		if (!item) return;
		if (item.key === INPUTS_KEY) { n.panelIndex = 0; n.zone = 'panel'; render(); }
		else if (item.key === MENU_KEY) { n.menuIndex = 0; n.zone = 'menu'; render(); }
	};
	const activatePanel = (i: number) => {
		const item = latest.current.inputs[i];
		if (!item) return;
		nav.current.zone = 'top';
		render();
		latest.current.onActivate('inputs', item);
	};
	const activateMenu = (i: number) => {
		const item = latest.current.menuItems[i];
		if (!item) return;
		nav.current.zone = 'top';
		render();
		latest.current.onActivate('menu', item);
	};
	const pointerLeft = () => {
		const n = nav.current;
		if (n.mode === 'pointer' && n.zone !== 'panel' && n.zone !== 'menu') { n.engaged = false; render(); }
	};

	const handleKey = useCallback((key: NavKey): boolean => {
		const n = nav.current;
		const {rows: allRows, topItems: tops, menuItems: menu, inputs: ins, onActivate: act} = latest.current;
		n.mode = 'key';
		if (!n.engaged) { n.engaged = true; render(); return true; }   // the first press only brings the focus up

		if (n.zone === 'panel') {
			const last = ins.length - 1;
			switch (key) {
				case 'left': n.panelIndex = clamp(n.panelIndex - 1, 0, last); break;
				case 'right': n.panelIndex = clamp(n.panelIndex + 1, 0, last); break;
				case 'up': if (n.panelIndex - PANEL_COLUMNS >= 0) n.panelIndex -= PANEL_COLUMNS; break;
				case 'down': if (n.panelIndex + PANEL_COLUMNS <= last) n.panelIndex += PANEL_COLUMNS; break;
				case 'enter': activatePanel(n.panelIndex); return true;
				case 'back': n.zone = 'top'; break;
			}
			render();
			return true;
		}
		if (n.zone === 'menu') {
			switch (key) {
				case 'up': n.menuIndex = clamp(n.menuIndex - 1, 0, menu.length - 1); break;
				case 'down': n.menuIndex = clamp(n.menuIndex + 1, 0, menu.length - 1); break;
				case 'enter': activateMenu(n.menuIndex); return true;
				case 'back': n.zone = 'top'; break;
			}
			render();
			return true;
		}
		if (n.zone === 'top') {
			switch (key) {
				case 'left': n.topIndex = clamp(n.topIndex - 1, 0, tops.length - 1); break;
				case 'right': n.topIndex = clamp(n.topIndex + 1, 0, tops.length - 1); break;
				case 'down': case 'back': n.zone = 'rows'; break;
				case 'enter': activateTop(n.topIndex); return true;
			}
			render();
			return true;
		}

		const rowIndex = clamp(n.rowIndex, 0, allRows.length - 1);
		const row = allRows[rowIndex];
		if (!row) return false;
		// like tvOS, moving to another row keeps the same column (as far as that row reaches)
		const moveRow = (next: number) => {
			const target = allRows[next];
			if (!target) return;
			n.columns[target.id] = clamp(columnOf(row), 0, target.items.length - 1);
			n.rowIndex = next;
		};
		switch (key) {
			case 'up': if (rowIndex === 0) n.zone = 'top'; else moveRow(rowIndex - 1); break;
			case 'down': moveRow(Math.min(allRows.length - 1, rowIndex + 1)); break;
			case 'left': n.columns[row.id] = clamp(columnOf(row) - 1, 0, row.items.length - 1); break;
			case 'right': n.columns[row.id] = clamp(columnOf(row) + 1, 0, row.items.length - 1); break;
			case 'enter': { const item = row.items[columnOf(row)]; if (item) act(row.id, item); return true; }
			case 'back': return true;   // swallow: Back on the home screen does nothing
		}
		render();
		return true;
	}, []);

	useKeys(handleKey, active);

	const n = nav.current;
	const rowIndex = clamp(n.rowIndex, 0, Math.max(0, rows.length - 1));
	const overlay = n.zone === 'panel' || n.zone === 'menu';
	const topPointer = (i: number) => () => { if (!overlay) { n.mode = 'pointer'; n.engaged = true; n.zone = 'top'; n.topIndex = i; render(); } };
	const focusedTop = (i: number) => n.engaged && n.zone === 'top' && i === n.topIndex;
	return (
		<div class={`screen${n.zone === 'rows' && rowIndex >= 1 ? ' screen--lower' : ''}`}>
			<div class="topbar">
				{topItems.map((item, i) => item.key === MENU_KEY ? (
					<div
						key={item.key}
						class={`topcap${focusedTop(i) ? ' topcap--focused' : ''}${n.zone === 'menu' ? ' topcap--open' : ''}`}
						onMouseLeave={pointerLeft}
						onMouseEnter={topPointer(i)}
						onClick={() => { n.topIndex = i; activateTop(i); }}
					>
						<Clock showPeriod={showPeriod} />
						<span class="pill__label">{item.label}</span>
					</div>
				) : (
					<div
						key={item.key}
						class={`pill${focusedTop(i) ? ' pill--focused' : ''}${n.zone === 'panel' && item.key === INPUTS_KEY ? ' pill--open' : ''}`}
						onMouseLeave={pointerLeft}
						onMouseEnter={topPointer(i)}
						onClick={() => { n.topIndex = i; activateTop(i); }}
					>
						{item.glyph && <Glyph name={item.glyph} />}
						<span class="pill__label">{item.label}</span>
					</div>
				))}
			</div>
			<div class={`rows${n.zone === 'rows' && rowIndex >= 1 ? ' rows--lower' : ''}`}>
				{rows.map((row, i) => (
					<Row
						key={row.id}
						label={row.label}
						items={row.items}
						emptyText={row.emptyText}
						focused={n.engaged && n.zone === 'rows' && i === rowIndex}
						hidden={i > 0 && !(n.zone === 'rows' && rowIndex >= i)}
						rest={!n.engaged}
						onLeave={pointerLeft}
						selected={columnOf(row)}
						onSelect={(col) => { if (overlay) return; n.mode = 'pointer'; n.engaged = true; n.zone = 'rows'; n.rowIndex = i; n.columns[row.id] = col; render(); }}
						onActivate={(col) => latest.current.onActivate(row.id, row.items[col])}
					/>
				))}
			</div>
			{n.zone === 'panel' && (
				<>
					<div class="panel-backdrop" onClick={() => { n.zone = 'top'; render(); }} />
					<div class="panel">
						<div class="panel__title">Inputs</div>
						<div class="panel__grid">
							{inputs.map((item, i) => (
								<Tile
									key={item.key}
									model={item}
									focused={i === n.panelIndex}
									onHover={() => { n.panelIndex = i; render(); }}
									onActivate={() => activatePanel(i)}
								/>
							))}
							{inputs.length === 0 && <div class="panel__empty">No inputs selected: add some in Settings &gt; Sources</div>}
						</div>
					</div>
				</>
			)}
			{n.zone === 'menu' && (
				<>
					<div class="panel-backdrop" onClick={() => { n.zone = 'top'; render(); }} />
					<div class="panel panel--menu">
						{menuItems.map((item, i) => (
							<div
								key={item.key}
								class={`menu__row${i === n.menuIndex ? ' menu__row--focused' : ''}`}
								onMouseEnter={() => { n.menuIndex = i; render(); }}
								onClick={() => activateMenu(i)}
							>
								{item.glyph && <Glyph name={item.glyph} />}
								<span>{item.label}</span>
							</div>
						))}
					</div>
				</>
			)}
		</div>
	);
}
""")
css = open(P('src/theme/global.css')).read()
css += """
/* ---------- the time pill is a button; its menu is a narrow glass list ---------- */
.topcap { padding: 0 6px; transition: transform var(--motion-focus-ms) ease-out; }
.topcap .clock { padding: 0 22px; }
.topcap--focused, .topcap--open { transform: scale(1.06); background-image: linear-gradient(145deg, rgba(255, 255, 255, 0.50), rgba(255, 255, 255, 0.20) 55%, rgba(255, 255, 255, 0.34)), var(--wp-blur, var(--glass-fallback)); }
.topcap .pill__label { position: absolute; top: 72px; left: 50%; transform: translateX(-50%); font-size: 20px; white-space: nowrap; opacity: 0; transition: opacity var(--motion-focus-ms) ease-out; text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8); }
.topcap--focused .pill__label { opacity: 1; }
.panel--menu { width: 440px; padding: 16px; top: 150px; }
.menu__row { display: flex; flex-direction: row; align-items: center; padding: 0 24px; height: 76px; margin-bottom: 6px; border-radius: 38px; font-size: 28px; color: var(--color-text-primary); }
.menu__row:last-child { margin-bottom: 0; }
.menu__row .tile__glyph { position: static; width: 34px; height: 34px; margin-right: 20px; flex: 0 0 auto; }
.menu__row--focused { background-color: #fff; color: #111; }
.menu__row--focused .tile__glyph { stroke: #111; }
"""
open(P('src/theme/global.css'), 'w').write(css)
