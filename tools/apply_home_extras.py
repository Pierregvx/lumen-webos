#!/usr/bin/env python3
"""Fifth patch layer (after apply_polish.py): system apps option, app folders, status chips (network / mute / sleep timer), date + weather, pointer tilt."""
import os
APP = os.path.expanduser('~/Developer/webos-launcher-tvos/app')
def P(p): return os.path.join(APP, p)
def sub(p, pairs):
    s = open(P(p)).read()
    for a, b in pairs:
        assert a in s, (p, a[:80])
        s = s.replace(a, b, 1)
    open(P(p), 'w').write(s)
def write(p, s):
    os.makedirs(os.path.dirname(P(p)), exist_ok=True); open(P(p), 'w').write(s)
def cut(p, start, end, new):
    s = open(P(p)).read()
    i = s.index(start); j = s.index(end, i) + len(end)
    open(P(p), 'w').write(s[:i] + new + s[j:])

# ---------------------------------------------------------------- storage
sub('src/lib/storage.ts', [
 ("	nightDim: boolean;\n}", "	nightDim: boolean;\n	/** offer the TV's own apps (Live TV, AirPlay ...) in Settings */\n	showAllApps: boolean;\n	/** date and weather beside the clock */\n	showWeather: boolean;\n	/** app folders: apps listed here are shown inside the folder, not on the rows */\n	folders: {name: string; appIds: string[]}[];\n}"),
 ("	nightDim: false\n};", "	nightDim: false,\n	showAllApps: false,\n	showWeather: true,\n	folders: []\n};"),
 ("			nightDim: parsed.nightDim === true\n", "			nightDim: parsed.nightDim === true,\n			showAllApps: parsed.showAllApps === true,\n			showWeather: parsed.showWeather !== false,\n			folders: Array.isArray(parsed.folders) ? parsed.folders : []\n"),
])

# ---------------------------------------------------------------- 1. system apps
write('src/config/systemApps.ts', """// The TV's own apps, offered in Settings > Apps when "Show system apps" is on (launching them is allowed for any app).
import type {CatalogApp} from './catalog';

export const SYSTEM_APPS: CatalogApp[] = [
	{id: 'com.webos.app.livetv', title: 'Live TV', color: '#5d7b74'},
	{id: 'com.webos.app.lgchannels', title: 'LG Channels', color: '#f0402f'},
	{id: 'airplay', title: 'AirPlay', color: '#111111'},
	{id: 'com.webos.app.miracast', title: 'Screen Share', color: '#4458c8'},
	{id: 'com.webos.app.gameoptimizer', title: 'Game Optimizer', color: '#4d4e6c'},
	{id: 'com.palm.app.settings', title: 'TV Settings', color: '#4d4e6c'}
];
""")
sub('src/lib/apps.ts', [
 ("import {ICON_PACK} from '../config/iconpack';", "import {ICON_PACK} from '../config/iconpack';\nimport {SYSTEM_APPS} from '../config/systemApps';"),
 ("export function listApps (useHomebrew: boolean): Promise<AppList> {", """export function listApps (useHomebrew: boolean, showSystem = false): Promise<AppList> {
	return listAppsBase(useHomebrew).then((list) => (showSystem ? addSystemApps(list) : list));
}

function addSystemApps (list: AppList): Promise<AppList> {
	const have = list.apps.map((a) => a.id);
	const extra = SYSTEM_APPS.filter((a) => have.indexOf(a.id) === -1);
	const check = isWebOS() ? Promise.all(extra.map((a) => appExists(a.id))) : Promise.resolve(extra.map(() => true));
	return check.then((present) => ({...list, apps: list.apps.concat(extra.filter((_, i) => present[i]).map((a) => ({id: a.id, title: a.title, iconUrl: packIcon(a.id, a.title), color: a.color})))}));
}

function listAppsBase (useHomebrew: boolean): Promise<AppList> {"""),
])

# ---------------------------------------------------------------- glyphs
sub('src/components/Glyph.tsx', [
 ("'screensaver' | 'sliders';", "'screensaver' | 'sliders' | 'wifi' | 'ethernet' | 'muted' | 'timer' | 'folder';"),
 ("				: name === 'sliders'\n", """				: name === 'wifi'
				? <path d="M2.5 9a14 14 0 0 1 19 0M5.6 12.5a9.5 9.5 0 0 1 12.8 0M8.8 16a5 5 0 0 1 6.4 0M12 19.4h.01" />
				: name === 'ethernet'
				? <path d="M4 6h16v8h-3v3.5h-3V14h-4v3.5H7V14H4zM8 9.2v2.2M12 9.2v2.2M16 9.2v2.2" />
				: name === 'muted'
				? <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4zM16 9.5l5 5M21 9.5l-5 5" />
				: name === 'timer'
				? <path d="M12 8v4.5l3 1.8M12 4.5a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM9.5 2.5h5" />
				: name === 'folder'
				? <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
				: name === 'sliders'
"""),
])

# ---------------------------------------------------------------- tile: folder collage, pointer tilt
sub('src/components/Tile.tsx', [
 ("	/** monogram background when there is no artwork */\n	color?: string;\n}", "	/** monogram background when there is no artwork */\n	color?: string;\n	/** a folder: the icons of the apps inside (up to 4 are drawn as a small collage) */\n	children?: (string | undefined)[];\n}"),
 ("	return (\n		<div class={classes} onMouseEnter={onHover} onClick={onActivate}>", """	// pointer: the focused tile tilts a little towards the cursor, like the Apple TV parallax (transform only, set straight on the element)
	const tilt = (e: MouseEvent) => {
		const el = e.currentTarget as HTMLElement;
		const box = el.querySelector('.tile__box') as HTMLElement | null;
		if (!box) return;
		const r = el.getBoundingClientRect();
		box.style.setProperty('--rx', (-((e.clientY - r.top) / r.height - 0.5) * 10).toFixed(1) + 'deg');
		box.style.setProperty('--ry', (((e.clientX - r.left) / r.width - 0.5) * 12).toFixed(1) + 'deg');
	};
	const untilt = (e: MouseEvent) => {
		const box = (e.currentTarget as HTMLElement).querySelector('.tile__box') as HTMLElement | null;
		if (box) { box.style.removeProperty('--rx'); box.style.removeProperty('--ry'); }
	};
	return (
		<div class={classes} onMouseEnter={onHover} onClick={onActivate} onMouseMove={focused ? tilt : undefined} onMouseLeave={untilt}>"""),
 ("				{model.imageUrl\n					? <img class=\"tile__image\" src={model.imageUrl} alt=\"\" />", """				{model.children
					? <div class="tile__folder">{model.children.slice(0, 4).map((u, i) => <div key={i} class="tile__mini" style={u ? {backgroundImage: `url("${u}")`} : undefined} />)}</div>
					: model.imageUrl
					? <img class="tile__image" src={model.imageUrl} alt="" />"""),
])

# ---------------------------------------------------------------- 3 + 4. status chips, date, weather
write('src/lib/status.ts', """// What the status chips show: how the TV is connected, whether it is muted, whether a sleep timer is running.
// All three are read with calls a normal web app may make. Anything that fails simply shows no chip.

import {isWebOS, lunaCall} from './luna';

export interface TvStatus {
	network: 'wifi' | 'ethernet' | 'offline' | 'unknown';
	muted: boolean;
	sleep: boolean;
}

export function readStatus (): Promise<TvStatus> {
	const out: TvStatus = {network: 'wifi', muted: false, sleep: false};
	if (!isWebOS()) return Promise.resolve(out);
	out.network = 'unknown';
	const net = lunaCall<{wired?: {state?: string}; wifi?: {state?: string}}>('luna://com.webos.service.connectionmanager/getStatus', {}).then((r) => {
		out.network = r.wired && r.wired.state === 'connected' ? 'ethernet' : r.wifi && r.wifi.state === 'connected' ? 'wifi' : 'offline';
	}).catch(() => undefined);
	const audio = lunaCall<{muted?: boolean; mute?: boolean; volumeStatus?: {muteStatus?: boolean}}>('luna://com.webos.audio/getStatus', {}).then((r) => {
		out.muted = !!((r.volumeStatus && r.volumeStatus.muteStatus) || r.muted || r.mute);
	}).catch(() => undefined);
	const sleep = lunaCall<Record<string, unknown>>('luna://com.webos.service.tvReservationAgent/timer/sleep/getRemainTime', {}).then((r) => {
		out.sleep = Object.keys(r).some((k) => /remain/i.test(k) && Number(r[k]) > 0);
	}).catch(() => undefined);
	return Promise.all([net, audio, sleep]).then(() => out);
}
""")
write('src/lib/weather.ts', """// Local temperature for the status pill. The place comes from the internet connection (ipwho.is, no key), the weather from
// open-meteo.com (no key). Cached for 30 minutes in localStorage; any failure just shows nothing.

export interface Weather {
	temp: number;
	label: string;
}

const KEY = 'launcher-weather-v1';
const MAX_AGE_MS = 30 * 60 * 1000;

function describe (code: number): string {
	if (code === 0) return 'Clear';
	if (code <= 2) return 'Partly cloudy';
	if (code === 3) return 'Cloudy';
	if (code === 45 || code === 48) return 'Fog';
	if (code >= 51 && code <= 67) return 'Rain';
	if (code >= 71 && code <= 77) return 'Snow';
	if (code >= 80 && code <= 82) return 'Showers';
	if (code >= 95) return 'Storm';
	return '';
}

export function readWeather (): Promise<Weather> {
	try {
		const cached = JSON.parse(localStorage.getItem(KEY) || 'null') as {t: number; w: Weather} | null;
		if (cached && Date.now() - cached.t < MAX_AGE_MS) return Promise.resolve(cached.w);
	} catch { /* fetch fresh */ }
	return fetch('https://ipwho.is/')
		.then((r) => r.json() as Promise<{success?: boolean; latitude?: number; longitude?: number}>)
		.then((p) => {
			if (!p.success || typeof p.latitude !== 'number') throw new Error('no location');
			return fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}&current=temperature_2m,weather_code&timezone=auto`);
		})
		.then((r) => r.json() as Promise<{current?: {temperature_2m?: number; weather_code?: number}}>)
		.then((d) => {
			const c = d.current;
			if (!c || typeof c.temperature_2m !== 'number') throw new Error('no weather');
			const w: Weather = {temp: Math.round(c.temperature_2m), label: describe(c.weather_code || 0)};
			try { localStorage.setItem(KEY, JSON.stringify({t: Date.now(), w})); } catch { /* ignore */ }
			return w;
		});
}
""")
write('src/components/Status.tsx', """import {useEffect, useState} from 'preact/hooks';
import {Glyph} from './Glyph';
import {readStatus, type TvStatus} from '../lib/status';
import {readWeather, type Weather} from '../lib/weather';

const dateText = () => new Date().toLocaleDateString(undefined, {weekday: 'short', day: 'numeric', month: 'short'});

/** A small glass pill left of the top buttons: network, mute and sleep-timer icons, today's date and the temperature. Not focusable. */
export function Status ({showWeather}: {showWeather?: boolean}) {
	const [status, setStatus] = useState<TvStatus>({network: 'unknown', muted: false, sleep: false});
	const [weather, setWeather] = useState<Weather | null>(null);
	const [date, setDate] = useState(dateText);

	useEffect(() => {
		const load = () => {
			setDate(dateText());
			readStatus().then(setStatus).catch(() => undefined);
		};
		const tick = () => { if (!document.hidden) load(); };
		load();
		const id = window.setInterval(tick, 30000);
		document.addEventListener('visibilitychange', tick);
		return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', tick); };
	}, []);

	useEffect(() => {
		if (!showWeather) { setWeather(null); return; }
		const load = () => readWeather().then(setWeather).catch(() => undefined);
		load();
		const id = window.setInterval(load, 30 * 60000);
		return () => window.clearInterval(id);
	}, [showWeather]);

	return (
		<div class="pill status">
			{status.network === 'wifi' && <Glyph name="wifi" />}
			{status.network === 'ethernet' && <Glyph name="ethernet" />}
			{status.network === 'offline' && <span class="status__off">Offline</span>}
			{status.muted && <Glyph name="muted" />}
			{status.sleep && <Glyph name="timer" />}
			<span class="status__text">{date}</span>
			{weather && <span class="status__text">{`${weather.temp}\\u00b0 ${weather.label}`}</span>}
		</div>
	);
}
""")

# ---------------------------------------------------------------- 2. folders (Home)
H = 'src/screens/Home.tsx'
sub(H, [
 ("import {useOkPress} from '../hooks/useOkPress';", "import {useOkPress} from '../hooks/useOkPress';\nimport {Status} from '../components/Status';"),
 ("	onEdit?: (action: 'move' | 'remove', rowId: string, key: string, dir?: number) => void;\n}", "	onEdit?: (action: 'move' | 'remove' | 'folder-add' | 'folder-out', rowId: string, key: string, arg?: number | string) => void;\n	/** the apps inside each folder, by folder name */\n	folders?: Record<string, TileModel[]>;\n	/** date and weather in the status pill */\n	showWeather?: boolean;\n}"),
 ("const CTX_ITEMS = ['Move', 'Remove from Home'];", "const FOLDER_PRESETS = ['Games', 'Tools', 'Media'];\nconst CTX_ITEMS = ['Move', 'Remove from Home'].concat(FOLDER_PRESETS.map((f) => 'Add to ' + f));\nconst CTX_FOLDER_ITEMS = ['Take out of Folder'];\nconst FOLDER_PREFIX = 'folder:';"),
 ("type Zone = 'rows' | 'top' | 'panel' | 'menu' | 'ctx';", "type Zone = 'rows' | 'top' | 'panel' | 'menu' | 'ctx' | 'folder';"),
 ("	suppressClick: boolean;\n", "	suppressClick: boolean;\n	/** the open folder (its name) and the focused app in it */\n	folder: string;\n	folderIndex: number;\n	/** where the hold-OK menu was opened from, and where it returns to */\n	ctxFrom: 'rows' | 'folder';\n"),
 ("suppressClick: false, mode: 'key'});", "suppressClick: false, folder: '', folderIndex: 0, ctxFrom: 'rows', mode: 'key'});"),
 ("export function Home ({rows, topItems, menuItems, inputs, active, onActivate, showPeriod, onEdit}: Props) {", "export function Home ({rows, topItems, menuItems, inputs, active, onActivate, showPeriod, onEdit, folders, showWeather}: Props) {"),
 ("	const latest = useRef({rows, topItems, menuItems, inputs, onActivate, onEdit});\n	latest.current = {rows, topItems, menuItems, inputs, onActivate, onEdit};", "	const latest = useRef({rows, topItems, menuItems, inputs, onActivate, onEdit, folders});\n	latest.current = {rows, topItems, menuItems, inputs, onActivate, onEdit, folders};"),
 ("	const columnOf = (row: HomeRow)", """	// a folder that has become empty closes
	useEffect(() => {
		const n = nav.current;
		if (n.zone === 'folder' && !((folders || {})[n.folder] || []).length) { n.zone = 'rows'; render(); }
	}, [folders]);

	const columnOf = (row: HomeRow)"""),
])
cut(H, "	const activateCtx = (i: number) => {", "		render();\n	};\n", """	const activateCtx = (i: number) => {
		const n = nav.current;
		const {rows: allRows, folders: fl, onEdit: edit} = latest.current;
		if (n.ctxFrom === 'folder') {
			const inside = ((fl || {})[n.folder] || [])[n.folderIndex];
			n.zone = 'folder';
			if (inside && edit) edit('folder-out', n.folder, inside.key);
			render();
			return;
		}
		const row = allRows[clamp(n.rowIndex, 0, allRows.length - 1)];
		const item = row && row.items[columnOf(row)];
		n.zone = 'rows';
		if (!item) { render(); return; }
		if (i === 0) n.moving = item.key;
		else if (i === 1 && edit) { edit('remove', row.id, item.key); n.columns[row.id] = clamp(columnOf(row), 0, Math.max(0, row.items.length - 2)); }
		else if (edit) edit('folder-add', row.id, item.key, FOLDER_PRESETS[i - 2]);
		render();
	};

	/** OK on a tile in a row: a folder opens, anything else is handed to the app */
	const activateRowItem = (rowId: string, item: TileModel) => {
		const n = nav.current;
		if (item.key.indexOf(FOLDER_PREFIX) === 0) { n.folder = item.key.slice(FOLDER_PREFIX.length); n.folderIndex = 0; n.zone = 'folder'; render(); return; }
		latest.current.onActivate(rowId, item);
	};
""")
sub(H, [
 ("		else if (n.zone === 'ctx') activateCtx(n.ctxIndex);", "		else if (n.zone === 'ctx') activateCtx(n.ctxIndex);\n		else if (n.zone === 'folder') {\n			const inside = ((latest.current.folders || {})[n.folder] || [])[n.folderIndex];\n			if (inside) { n.zone = 'rows'; render(); act('folder', inside); }\n		}"),
 ("			if (item) act(row.id, item);\n		}\n	};", "			if (item) activateRowItem(row.id, item);\n		}\n	};"),
 ("		if (!n.engaged || n.zone !== 'rows' || n.moving) return;", "		if (n.engaged && n.zone === 'folder') { n.ctxFrom = 'folder'; n.ctxIndex = 0; n.zone = 'ctx'; render(); return; }\n		if (!n.engaged || n.zone !== 'rows' || n.moving) return;"),
 ("		if (!row || EDITABLE.indexOf(row.id) === -1 || !row.items[columnOf(row)]) return;\n		n.ctxIndex = 0; n.zone = 'ctx'; render();", "		const held = row && row.items[columnOf(row)];\n		if (!row || EDITABLE.indexOf(row.id) === -1 || !held || held.key.indexOf(FOLDER_PREFIX) === 0) return;\n		n.ctxFrom = 'rows'; n.ctxIndex = 0; n.zone = 'ctx'; render();"),
 ("		const {rows: allRows, topItems: tops, menuItems: menu, inputs: ins, onEdit: edit} = latest.current;", "		const {rows: allRows, topItems: tops, menuItems: menu, inputs: ins, onEdit: edit, folders: fl} = latest.current;"),
 ("		if (n.zone === 'ctx') {\n			switch (key) {\n				case 'up': n.ctxIndex = clamp(n.ctxIndex - 1, 0, CTX_ITEMS.length - 1); break;\n				case 'down': n.ctxIndex = clamp(n.ctxIndex + 1, 0, CTX_ITEMS.length - 1); break;\n				case 'back': n.zone = 'rows'; break;",
  """		if (n.zone === 'folder') {
			const last = ((fl || {})[n.folder] || []).length - 1;
			switch (key) {
				case 'left': n.folderIndex = clamp(n.folderIndex - 1, 0, last); break;
				case 'right': n.folderIndex = clamp(n.folderIndex + 1, 0, last); break;
				case 'up': if (n.folderIndex - PANEL_COLUMNS >= 0) n.folderIndex -= PANEL_COLUMNS; break;
				case 'down': if (n.folderIndex + PANEL_COLUMNS <= last) n.folderIndex += PANEL_COLUMNS; break;
				case 'back': n.zone = 'rows'; break;
			}
			render();
			return true;
		}
		if (n.zone === 'ctx') {
			const count = (n.ctxFrom === 'folder' ? CTX_FOLDER_ITEMS : CTX_ITEMS).length;
			switch (key) {
				case 'up': n.ctxIndex = clamp(n.ctxIndex - 1, 0, count - 1); break;
				case 'down': n.ctxIndex = clamp(n.ctxIndex + 1, 0, count - 1); break;
				case 'back': n.zone = n.ctxFrom; break;"""),
 ("	const overlay = n.zone === 'panel' || n.zone === 'menu' || n.zone === 'ctx';", "	const overlay = n.zone === 'panel' || n.zone === 'menu' || n.zone === 'ctx' || n.zone === 'folder';"),
 ("			<div class=\"topbar\">\n", "			<div class=\"topbar\">\n				<Status showWeather={showWeather} />\n"),
 ("						onActivate={(col) => { holdCancel(); if (n.suppressClick) { n.suppressClick = false; return; } latest.current.onActivate(row.id, row.items[col]); }}", "						onActivate={(col) => { holdCancel(); if (n.suppressClick) { n.suppressClick = false; return; } activateRowItem(row.id, row.items[col]); }}"),
 ("					<div class=\"panel-backdrop\" onClick={() => { n.zone = 'rows'; render(); }} />\n					<div class=\"panel panel--menu panel--ctx\">\n						{CTX_ITEMS.map((label, i) => (", "					<div class=\"panel-backdrop\" onClick={() => { n.zone = n.ctxFrom; render(); }} />\n					<div class=\"panel panel--menu panel--ctx\">\n						{(n.ctxFrom === 'folder' ? CTX_FOLDER_ITEMS : CTX_ITEMS).map((label, i) => ("),
 ("			{n.zone === 'ctx' && (", """			{n.zone === 'folder' && (
				<>
					<div class="panel-backdrop" onClick={() => { n.zone = 'rows'; render(); }} />
					<div class="panel panel--folder">
						<div class="panel__title">{n.folder}</div>
						<div class="panel__grid" onMouseDown={holdStart} onMouseUp={holdCancel} onMouseLeave={holdCancel}>
							{((folders || {})[n.folder] || []).map((item, i) => (
								<Tile
									key={item.key}
									model={item}
									focused={i === n.folderIndex}
									onHover={() => { n.folderIndex = i; render(); }}
									onActivate={() => { holdCancel(); if (n.suppressClick) { n.suppressClick = false; return; } n.zone = 'rows'; render(); latest.current.onActivate('folder', item); }}
								/>
							))}
						</div>
					</div>
				</>
			)}
			{n.zone === 'ctx' && ("""),
])

# ---------------------------------------------------------------- App wiring
A = 'src/app.tsx'
sub(A, [
 ("show-ampm', idle: 'idle-screensaver',", "show-ampm', showAll: 'show-all-apps', weather: 'show-weather', idle: 'idle-screensaver',"),
 ("		listApps(config.useHomebrew)\n", "		listApps(config.useHomebrew, config.showAllApps)\n"),
 ("	}, [config.useHomebrew, showToast]);", "	}, [config.useHomebrew, config.showAllApps, showToast]);"),
 ("	const rows: HomeRow[] = useMemo(", """	const folderTiles = useMemo(
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

	const rows: HomeRow[] = useMemo("""),
 ("items: shownApps.slice(0, FIRST_ROW).map(appTile), emptyText", "items: homeTiles.slice(0, FIRST_ROW), emptyText"),
 ("...(shownApps.length > FIRST_ROW ? [{id: ROW.dock, label: 'More apps', items: shownApps.slice(FIRST_ROW).map(appTile)}] : [])", "...(homeTiles.length > FIRST_ROW ? [{id: ROW.dock, label: 'More apps', items: homeTiles.slice(FIRST_ROW)}] : [])"),
 ("	], [shownApps, shownInputs, recentApps]);", "	], [homeTiles, shownInputs, recentApps]);"),
 ("		{\n			id: OPTION.idle,", "		{\n			id: OPTION.showAll,\n			label: 'Show system apps',\n			description: 'Offer the TV\\'s own apps (Live TV, LG Channels, AirPlay, Screen Share, Game Optimizer, TV Settings) in Settings > Apps, so you can add them to the home screen.',\n			value: config.showAllApps\n		},\n		{\n			id: OPTION.weather,\n			label: 'Date and weather',\n			description: 'Show today\\'s date and the local temperature beside the clock. Your area is found from your internet connection (ipwho.is) and the weather comes from open-meteo.com.',\n			value: config.showWeather\n		},\n		{\n			id: OPTION.idle,"),
 ("config.wpAutoMinutes, config.nightDim]);", "config.wpAutoMinutes, config.nightDim, config.showAllApps, config.showWeather]);"),
 ("		else if (optionId === OPTION.nightDim)", "		else if (optionId === OPTION.showAll) updateConfig({...config, showAllApps: !config.showAllApps});\n		else if (optionId === OPTION.weather) updateConfig({...config, showWeather: !config.showWeather});\n		else if (optionId === OPTION.nightDim)"),
 ("if (_rowId === ROW.apps || _rowId === ROW.dock || _rowId === ROW.recent) {", "if (_rowId === ROW.apps || _rowId === ROW.dock || _rowId === ROW.recent || _rowId === 'folder') {"),
 ("onEdit={onEdit} />", "onEdit={onEdit} folders={folderMap} showWeather={config.showWeather} />"),
])
cut(A, "	const onEdit = useCallback((action: 'move' | 'remove', _rowId: string, key: string, dir = 0) => {", "	}, [apps]);", """	const onEdit = useCallback((action: 'move' | 'remove' | 'folder-add' | 'folder-out', _rowId: string, key: string, arg: number | string = 0) => {
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
	}, [apps]);""")

# ---------------------------------------------------------------- CSS
css = open(P('src/theme/global.css')).read()
css += """
/* ---------- folders, status pill, pointer tilt ---------- */
.tile__folder { position: absolute; left: 12%; top: 14%; width: 76%; height: 72%; display: flex; flex-wrap: wrap; justify-content: space-between; align-content: space-between; }
.tile__mini { width: 47%; height: 47%; border-radius: 10px; background: rgba(255, 255, 255, 0.14) center / cover no-repeat; }
.panel--folder { left: 50%; right: auto; margin-left: -380px; top: 250px; }
.pill.status { width: auto; padding: 0 26px; color: var(--color-text-primary); pointer-events: none; }
.status svg { position: static; left: auto; top: auto; width: 28px; height: 28px; flex: 0 0 auto; margin-right: 14px; }
.pill.status { background-image: none; background-color: transparent; box-shadow: none; padding: 0 22px 0 0; text-shadow: 0 2px 10px rgba(0, 0, 0, 0.75); }
.status__text { font-weight: 500; opacity: 0.92; }
.status svg { filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.6)); }
.status__text { font-size: 22px; margin-right: 18px; white-space: nowrap; }
.status__text:last-child { margin-right: 0; }
.status__off { font-size: 20px; margin-right: 14px; opacity: 0.8; }
.row .tile--focused .tile__box { transform: perspective(900px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)) scale(var(--motion-focus-scale)) translateY(-6px); }
"""
open(P('src/theme/global.css'), 'w').write(css)
print('home extras applied')
