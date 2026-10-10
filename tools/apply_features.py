#!/usr/bin/env python3
"""Second patch layer, run AFTER apply_tvos.py: Quick Controls panel, hold-OK app menu (move / remove), Recent row, idle screensaver.
Run from app/: python3 ../tools/apply_features.py"""
import os
APP = os.path.expanduser('~/Developer/webos-launcher-tvos/app')
def P(p): return os.path.join(APP, p)
def sub(p, pairs):
    s = open(P(p)).read()
    for a, b in pairs:
        assert a in s, (p, a[:70])
        s = s.replace(a, b, 1)
    open(P(p), 'w').write(s)
def write(p, s):
    os.makedirs(os.path.dirname(P(p)), exist_ok=True); open(P(p), 'w').write(s)

# ---------------------------------------------------------------- storage: recent apps, idle screensaver minutes
sub('src/lib/storage.ts', [
 ("	showAmPm: boolean;\n}", "	showAmPm: boolean;\n	/** the last apps opened, newest first */\n	recentIds: string[];\n	/** start the screensaver after this many idle minutes; 0 = never */\n	idleMinutes: number;\n}"),
 ("	showAmPm: false\n};", "	showAmPm: false,\n	recentIds: [],\n	idleMinutes: 0\n};"),
 ("			showAmPm: parsed.showAmPm === true\n", "			showAmPm: parsed.showAmPm === true,\n			recentIds: Array.isArray(parsed.recentIds) ? parsed.recentIds : [],\n			idleMinutes: typeof parsed.idleMinutes === 'number' ? parsed.idleMinutes : 0\n"),
])

# ---------------------------------------------------------------- TV controls (volume, mute, picture mode, sleep timer, screen off, restart)
write('src/lib/tvcontrols.ts', """// Quick Controls: what the TV lets a normal web app do (volume, mute, picture mode, sleep timer) and what needs the Homebrew Channel's
// root service (screen off, restart). Fixed commands only. Off the TV (the dev preview) the values are kept in memory.

import {LUNA} from '../config/constants';
import {isWebOS, lunaCall} from './luna';

const AUDIO = 'luna://com.webos.audio/';
const SETTINGS = 'luna://com.webos.settingsservice/';
const SLEEP = 'luna://com.webos.service.tvReservationAgent/timer/sleep/';

export const PICTURE_MODES = ['vivid', 'standard', 'eco', 'cinema', 'sports', 'game', 'filmMaker'];
export const PICTURE_LABEL: Record<string, string> = {vivid: 'Vivid', standard: 'Standard', eco: 'Eco', cinema: 'Cinema', sports: 'Sports', game: 'Game', filmMaker: 'FILMMAKER', expert1: 'Expert (bright room)', expert2: 'Expert (dark room)', hdrEffect: 'HDR Effect', hdrStandard: 'HDR Standard', hdrCinema: 'HDR Cinema', hdrGame: 'HDR Game'};
export const SLEEP_MINUTES = [0, 15, 30, 60, 90, 120];

export interface Controls {
	volume: number;
	muted: boolean;
	picture: string;
	sleepMinutes: number;
}

const mock: Controls = {volume: 18, muted: false, picture: 'standard', sleepMinutes: 0};

export function readControls (): Promise<Controls> {
	if (!isWebOS()) return Promise.resolve({...mock});
	const out: Controls = {volume: 0, muted: false, picture: 'standard', sleepMinutes: 0};
	const audio = lunaCall<{volume?: number; muted?: boolean; mute?: boolean; volumeStatus?: {volume?: number; muteStatus?: boolean}}>(AUDIO + 'getStatus', {}).then((r) => {
		const s = r.volumeStatus || r;
		out.volume = Number((s as {volume?: number}).volume) || 0;
		out.muted = !!((r.volumeStatus && r.volumeStatus.muteStatus) || r.muted || r.mute);
	}).catch(() => undefined);
	const picture = lunaCall<{settings?: {pictureMode?: string}}>(SETTINGS + 'getSystemSettings', {category: 'picture', keys: ['pictureMode']}).then((r) => {
		if (r.settings && r.settings.pictureMode) out.picture = r.settings.pictureMode;
	}).catch(() => undefined);
	return Promise.all([audio, picture]).then(() => out);
}

export function setVolume (volume: number): Promise<void> {
	mock.volume = volume;
	if (!isWebOS()) return Promise.resolve();
	return lunaCall(AUDIO + 'setVolume', {volume}).then(() => undefined);
}

export function setMuted (muted: boolean): Promise<void> {
	mock.muted = muted;
	if (!isWebOS()) return Promise.resolve();
	return lunaCall(AUDIO + 'setMuted', {muted}).then(() => undefined);
}

export function setPictureMode (mode: string): Promise<void> {
	mock.picture = mode;
	if (!isWebOS()) return Promise.resolve();
	return lunaCall(SETTINGS + 'setSystemSettings', {category: 'picture', settings: {pictureMode: mode}}).then(() => undefined);
}

/** 0 cancels the timer. */
export function setSleepTimer (minutes: number): Promise<void> {
	mock.sleepMinutes = minutes;
	if (!isWebOS()) return Promise.resolve();
	if (minutes === 0) return lunaCall(SLEEP + 'clear', {}).then(() => undefined);
	return lunaCall(SLEEP + 'add', {time: minutes}).then(() => undefined);
}

const root = (command: string) => lunaCall(LUNA.homebrewExec, {command}, 6000).then(() => undefined);

/** Screen off, the TV keeps running (a press on the remote wakes it). */
export function screenOff (): Promise<void> {
	if (!isWebOS()) return Promise.reject(new Error('not on a TV'));
	return root("luna-send -n 1 luna://com.webos.service.tvpower/power/turnOffScreen '{}'");
}

export function restartTv (): Promise<void> {
	if (!isWebOS()) return Promise.reject(new Error('not on a TV'));
	return root("luna-send -n 1 luna://com.webos.service.tvpower/power/reboot '{\\"reason\\":\\"restart\\"}'");
}
""")

write('src/components/QuickControls.tsx', """import {useCallback, useEffect, useRef, useState} from 'preact/hooks';
import {useKeys, clamp, type NavKey} from '../hooks/useKeys';
import {PICTURE_LABEL, PICTURE_MODES, SLEEP_MINUTES, readControls, restartTv, screenOff, setMuted, setPictureMode, setSleepTimer, setVolume, type Controls} from '../lib/tvcontrols';

interface Props {
	onClose: () => void;
	onError: (text: string) => void;
}

const ROWS = ['volume', 'mute', 'picture', 'sleep', 'screenoff', 'restart'] as const;
type RowId = typeof ROWS[number];

/** The Quick Controls panel (opened from the time-pill menu): volume, mute, picture mode, sleep timer, screen off, restart.
 *  Up/Down choose a row, Left/Right change it, OK toggles or runs it, Back closes. */
export function QuickControls ({onClose, onError}: Props) {
	const [values, setValues] = useState<Controls>({volume: 0, muted: false, picture: 'standard', sleepMinutes: 0});
	const [index, setIndex] = useState(0);
	const [confirmRestart, setConfirmRestart] = useState(false);
	const state = useRef({values, index, confirmRestart});
	state.current = {values, index, confirmRestart};

	useEffect(() => { readControls().then(setValues); }, []);

	const fail = (what: string) => () => onError(`Couldn't change ${what}`);
	const patch = (p: Partial<Controls>) => setValues((v) => ({...v, ...p}));

	const change = (row: RowId, dir: number) => {
		const v = state.current.values;
		if (row === 'volume') {
			const next = clamp(v.volume + dir * 2, 0, 100);
			patch({volume: next, muted: false});
			setVolume(next).catch(fail('volume'));
		} else if (row === 'picture') {
			const at = PICTURE_MODES.indexOf(v.picture);
			const next = PICTURE_MODES[(at + dir + PICTURE_MODES.length) % PICTURE_MODES.length];
			patch({picture: next});
			setPictureMode(next).catch(fail('the picture mode'));
		} else if (row === 'sleep') {
			const at = Math.max(0, SLEEP_MINUTES.indexOf(v.sleepMinutes));
			const next = SLEEP_MINUTES[clamp(at + dir, 0, SLEEP_MINUTES.length - 1)];
			patch({sleepMinutes: next});
			setSleepTimer(next).catch(fail('the sleep timer'));
		}
	};

	const press = (row: RowId) => {
		const v = state.current.values;
		if (row === 'mute') { patch({muted: !v.muted}); setMuted(!v.muted).catch(fail('mute')); }
		else if (row === 'volume' || row === 'picture' || row === 'sleep') change(row, 1);
		else if (row === 'screenoff') { onClose(); screenOff().catch(() => onError("Couldn't turn the screen off (it needs the Homebrew Channel)")); }
		else if (row === 'restart') {
			if (!state.current.confirmRestart) { setConfirmRestart(true); return; }
			onClose(); restartTv().catch(() => onError("Couldn't restart the TV (it needs the Homebrew Channel)"));
		}
	};

	const handleKey = useCallback((key: NavKey): boolean => {
		const {index: i} = state.current;
		const row = ROWS[i];
		if (key === 'back') { onClose(); return true; }
		if (key === 'up') { setIndex(clamp(i - 1, 0, ROWS.length - 1)); setConfirmRestart(false); }
		else if (key === 'down') { setIndex(clamp(i + 1, 0, ROWS.length - 1)); setConfirmRestart(false); }
		else if (key === 'left') change(row, -1);
		else if (key === 'right') change(row, 1);
		else if (key === 'enter') press(row);
		return true;
	}, []);
	useKeys(handleKey, true);

	const rows: {id: RowId; label: string; value?: string; bar?: number; on?: boolean}[] = [
		{id: 'volume', label: 'Volume', value: String(values.volume), bar: values.volume},
		{id: 'mute', label: 'Mute', on: values.muted},
		{id: 'picture', label: 'Picture mode', value: PICTURE_LABEL[values.picture] || values.picture},
		{id: 'sleep', label: 'Sleep timer', value: values.sleepMinutes ? `${values.sleepMinutes} min` : 'Off'},
		{id: 'screenoff', label: 'Screen off'},
		{id: 'restart', label: confirmRestart ? 'Press OK again to restart' : 'Restart TV'}
	];

	return (
		<>
			<div class="panel-backdrop" onClick={onClose} />
			<div class="panel panel--controls">
				<div class="panel__title">Quick Controls</div>
				{rows.map((r, i) => (
					<div
						key={r.id}
						class={`menu__row qc__row${i === index ? ' menu__row--focused' : ''}`}
						onMouseEnter={() => { setIndex(i); setConfirmRestart(false); }}
						onClick={() => press(r.id)}
					>
						<span class="qc__label">{r.label}</span>
						{r.bar !== undefined && <span class="qc__bar"><span class="qc__fill" style={`width:${r.bar}%`} /></span>}
						{r.value !== undefined && <span class="qc__value">{r.value}</span>}
						{r.on !== undefined && <span class={`switch${r.on ? ' switch--on' : ''}`}><span class="switch__knob" /></span>}
					</div>
				))}
			</div>
		</>
	);
}
""")

# ---------------------------------------------------------------- glyph: sliders (Quick Controls)
sub('src/components/Glyph.tsx', [
 ("'inputs' | 'screensaver';", "'inputs' | 'screensaver' | 'sliders';"),
 ("				: name === 'screensaver'\n", "				: name === 'sliders'\n				? <path d=\"M4 7h8M16 7h4M4 17h4M12 17h8M12 4.5v5M8 14.5v5\" />\n				: name === 'screensaver'\n"),
])

# ---------------------------------------------------------------- option list: a value instead of a switch (idle screensaver time)
sub('src/components/OptionList.tsx', [
 ("	value: boolean;\n}", "	value: boolean;\n	/** shown instead of the switch (options that pick from a list) */\n	valueText?: string;\n}"),
 ("					<div class={`switch${o.value ? ' switch--on' : ''}`} role=\"switch\" aria-checked={o.value}>\n						<div class=\"switch__knob\" />\n					</div>",
  "					{o.valueText !== undefined\n						? <div class=\"option__value\">{o.valueText}</div>\n						: <div class={`switch${o.value ? ' switch--on' : ''}`} role=\"switch\" aria-checked={o.value}>\n							<div class=\"switch__knob\" />\n						</div>}"),
])

# ---------------------------------------------------------------- Home: hold OK on an app for Move / Remove
sub('src/screens/Home.tsx', [
 ("import {useKeys, clamp, type NavKey} from '../hooks/useKeys';", "import {useKeys, clamp, type NavKey} from '../hooks/useKeys';\nimport {useOkPress} from '../hooks/useOkPress';"),
 ("	showPeriod?: boolean;\n}", "	showPeriod?: boolean;\n	/** hold OK on an app: move it one place along its row, or take it off the home screen */\n	onEdit?: (action: 'move' | 'remove', rowId: string, key: string, dir?: number) => void;\n}\n\n/** the rows whose apps can be moved or removed (Recent is automatic) */\nconst EDITABLE = ['apps', 'dock'];\nconst CTX_ITEMS = ['Move', 'Remove from Home'];"),
 ("type Zone = 'rows' | 'top' | 'panel' | 'menu';", "type Zone = 'rows' | 'top' | 'panel' | 'menu' | 'ctx';"),
 ("	menuIndex: number;\n", "	menuIndex: number;\n	ctxIndex: number;\n	/** the key of the app being moved with the arrows, or null */\n	moving: string | null;\n	/** the OK that brought the focus up must not also open the app on release */\n	swallowOk: boolean;\n"),
 ("panelIndex: 0, menuIndex: 0, mode: 'key'});", "panelIndex: 0, menuIndex: 0, ctxIndex: 0, moving: null, swallowOk: false, mode: 'key'});"),
 ("export function Home ({rows, topItems, menuItems, inputs, active, onActivate, showPeriod}: Props) {", "export function Home ({rows, topItems, menuItems, inputs, active, onActivate, showPeriod, onEdit}: Props) {"),
 ("	const latest = useRef({rows, topItems, menuItems, inputs, onActivate});\n	latest.current = {rows, topItems, menuItems, inputs, onActivate};", "	const latest = useRef({rows, topItems, menuItems, inputs, onActivate, onEdit});\n	latest.current = {rows, topItems, menuItems, inputs, onActivate, onEdit};"),
 ("	const columnOf = (row: HomeRow)", """	// while an app is being moved, keep the focus on it as it changes places (it may cross from one row to the next)
	useEffect(() => {
		const n = nav.current;
		if (!n.moving) return;
		for (let r = 0; r < rows.length; r++) {
			const c = rows[r].items.findIndex((t) => t.key === n.moving);
			if (c >= 0) { n.rowIndex = r; n.columns[rows[r].id] = c; render(); return; }
		}
	}, [rows]);

	const columnOf = (row: HomeRow)"""),
 ("	const pointerLeft = () => {", """	const activateCtx = (i: number) => {
		const n = nav.current;
		const {rows: allRows, onEdit: edit} = latest.current;
		const row = allRows[clamp(n.rowIndex, 0, allRows.length - 1)];
		const item = row && row.items[columnOf(row)];
		if (!item) { n.zone = 'rows'; render(); return; }
		n.zone = 'rows';
		if (i === 0) n.moving = item.key;
		else if (edit) { edit('remove', row.id, item.key); n.columns[row.id] = clamp(columnOf(row), 0, Math.max(0, row.items.length - 2)); }
		render();
	};

	/** a short OK press: open / activate whatever is focused */
	const press = () => {
		const n = nav.current;
		if (n.swallowOk) { n.swallowOk = false; return; }
		if (!n.engaged) return;
		const {rows: allRows, topItems: tops, onActivate: act} = latest.current;
		if (n.zone === 'panel') activatePanel(n.panelIndex);
		else if (n.zone === 'menu') activateMenu(n.menuIndex);
		else if (n.zone === 'ctx') activateCtx(n.ctxIndex);
		else if (n.zone === 'top') { if (tops[n.topIndex]) activateTop(n.topIndex); }
		else if (n.moving) { n.moving = null; render(); }
		else {
			const row = allRows[clamp(n.rowIndex, 0, allRows.length - 1)];
			const item = row && row.items[columnOf(row)];
			if (item) act(row.id, item);
		}
	};

	/** holding OK on an app opens its menu */
	const longPress = () => {
		const n = nav.current;
		if (!n.engaged || n.zone !== 'rows' || n.moving) return;
		const {rows: allRows} = latest.current;
		const row = allRows[clamp(n.rowIndex, 0, allRows.length - 1)];
		if (!row || EDITABLE.indexOf(row.id) === -1 || !row.items[columnOf(row)]) return;
		n.ctxIndex = 0; n.zone = 'ctx'; render();
	};
	useOkPress({onPress: press, onLongPress: longPress}, active);

	const pointerLeft = () => {"""),
 ("		n.mode = 'key';\n		if (!n.engaged) { n.engaged = true; render(); return true; }   // the first press only brings the focus up\n",
  "		n.mode = 'key';\n		if (!n.engaged) { n.engaged = true; if (key === 'enter') n.swallowOk = true; render(); return true; }   // the first press only brings the focus up\n		if (key === 'enter') return true;   // handled by useOkPress (press vs hold)\n"),
 ("		const {rows: allRows, topItems: tops, menuItems: menu, inputs: ins, onActivate: act} = latest.current;", "		const {rows: allRows, topItems: tops, menuItems: menu, inputs: ins, onEdit: edit} = latest.current;"),
 ("				case 'enter': activatePanel(n.panelIndex); return true;\n", ""),
 ("				case 'enter': activateMenu(n.menuIndex); return true;\n", ""),
 ("				case 'enter': activateTop(n.topIndex); return true;\n", ""),
 ("		if (n.zone === 'top') {", """		if (n.zone === 'ctx') {
			switch (key) {
				case 'up': n.ctxIndex = clamp(n.ctxIndex - 1, 0, CTX_ITEMS.length - 1); break;
				case 'down': n.ctxIndex = clamp(n.ctxIndex + 1, 0, CTX_ITEMS.length - 1); break;
				case 'back': n.zone = 'rows'; break;
			}
			render();
			return true;
		}
		if (n.zone === 'top') {"""),
 ("		switch (key) {\n			case 'up': if (rowIndex === 0) n.zone = 'top'; else moveRow(rowIndex - 1); break;", """		if (n.moving) {
			if (key === 'left' || key === 'right') { if (edit) edit('move', row.id, n.moving, key === 'left' ? -1 : 1); return true; }
			if (key === 'back') n.moving = null;
			render();
			return true;
		}
		switch (key) {
			case 'up': if (rowIndex === 0) n.zone = 'top'; else moveRow(rowIndex - 1); break;"""),
 ("			case 'enter': { const item = row.items[columnOf(row)]; if (item) act(row.id, item); return true; }\n", ""),
 ("	const overlay = n.zone === 'panel' || n.zone === 'menu';", "	const overlay = n.zone === 'panel' || n.zone === 'menu' || n.zone === 'ctx';"),
 ("		<div class={`screen${n.zone === 'rows' && rowIndex >= 1 ? ' screen--lower' : ''}`}>", "		<div class={`screen${n.zone === 'rows' && rowIndex >= 1 ? ' screen--lower' : ''}${n.moving ? ' screen--moving' : ''}`}>"),
 ("			{n.zone === 'menu' && (", """			{n.moving && <div class="movehint">Move with the arrows · OK to drop</div>}
			{n.zone === 'ctx' && (
				<>
					<div class="panel-backdrop" onClick={() => { n.zone = 'rows'; render(); }} />
					<div class="panel panel--menu panel--ctx">
						{CTX_ITEMS.map((label, i) => (
							<div
								key={label}
								class={`menu__row${i === n.ctxIndex ? ' menu__row--focused' : ''}`}
								onMouseEnter={() => { n.ctxIndex = i; render(); }}
								onClick={() => activateCtx(i)}
							>
								<span>{label}</span>
							</div>
						))}
					</div>
				</>
			)}
			{n.zone === 'menu' && ("""),
])

# ---------------------------------------------------------------- App: Quick Controls entry, Recent row, hold-OK edits, idle screensaver
sub('src/app.tsx', [
 ("import {startScreensaver} from './lib/system';", "import {startScreensaver} from './lib/system';\nimport {QuickControls} from './components/QuickControls';"),
 ("const ROW = {apps: 'apps', sources: 'sources', misc: 'misc', dock: 'dock'} as const;", "const ROW = {apps: 'apps', sources: 'sources', misc: 'misc', dock: 'dock', recent: 'recent'} as const;"),
 ("const OPTION = {useHomebrew: 'use-homebrew', videoWallpaper: 'video-wallpaper', showAmPm: 'show-ampm'} as const;", "const OPTION = {useHomebrew: 'use-homebrew', videoWallpaper: 'video-wallpaper', showAmPm: 'show-ampm', idle: 'idle-screensaver'} as const;\nconst IDLE_CHOICES = [0, 5, 10, 20, 30];\nconst RECENT_MAX = 8;"),
 ("const MENU_ITEMS: TileModel[] = [\n", "const MENU_ITEMS: TileModel[] = [\n	{key: 'controls', label: 'Quick Controls', glyph: 'sliders'},\n"),
 ("	const [toast, setToast] = useState<ToastMessage | null>(null);", "	const [toast, setToast] = useState<ToastMessage | null>(null);\n	const [controls, setControls] = useState(false);\n	const configRef = useRef(config);\n	configRef.current = config;"),
 ("	const updateConfig = (next: UserConfig) => { setConfig(next); saveConfig(next); };", """	const updateConfig = (next: UserConfig) => { configRef.current = next; setConfig(next); saveConfig(next); };

	// idle screensaver: after the chosen minutes without a key press or pointer move, while the launcher is in front
	useEffect(() => {
		if (!config.idleMinutes) return;
		let timer = 0;
		const arm = () => {
			window.clearTimeout(timer);
			timer = window.setTimeout(() => { if (!document.hidden) startScreensaver().catch(() => undefined); }, config.idleMinutes * 60000);
		};
		arm();
		const events = ['keydown', 'mousemove', 'click'];
		events.forEach((e) => window.addEventListener(e, arm));
		return () => { window.clearTimeout(timer); events.forEach((e) => window.removeEventListener(e, arm)); };
	}, [config.idleMinutes]);"""),
 ("		...(shownApps.length > FIRST_ROW ? [{id: ROW.dock, label: 'More apps', items: shownApps.slice(FIRST_ROW).map(appTile)}] : [])\n	], [shownApps, shownInputs]);",
  "		...(shownApps.length > FIRST_ROW ? [{id: ROW.dock, label: 'More apps', items: shownApps.slice(FIRST_ROW).map(appTile)}] : []),\n		...(recentApps.length > 0 ? [{id: ROW.recent, label: 'Recent', items: recentApps.map(appTile)}] : [])\n	], [shownApps, shownInputs, recentApps]);"),
 ("	const rows: HomeRow[] = useMemo(", "	const recentApps = useMemo(() => pickInOrder(apps, config.recentIds, (a) => a.id), [apps, config.recentIds]);\n\n	const rows: HomeRow[] = useMemo("),
 ("		},\n		{\n			id: OPTION.showAmPm,", "		},\n		{\n			id: OPTION.idle,\n			label: 'Screensaver when idle',\n			description: 'Start the TV screensaver after this long without any button press while the launcher is in front. Needs the Homebrew Channel.',\n			value: config.idleMinutes > 0,\n			valueText: config.idleMinutes ? `${config.idleMinutes} min` : 'Off'\n		},\n		{\n			id: OPTION.showAmPm,"),
 ("	], [config.useHomebrew, config.videoWallpaper, config.showAmPm]);", "	], [config.useHomebrew, config.videoWallpaper, config.showAmPm, config.idleMinutes]);"),
 ("	const open = (id: string, label: string) => {\n		launchApp(id)", "	const open = (id: string, label: string) => {\n		launchApp(id)"),
 ("		open(item.key, item.label);\n	}, [showToast]);", """		if (item.key === 'controls') { setControls(true); return; }
		if (_rowId === ROW.apps || _rowId === ROW.dock || _rowId === ROW.recent) {
			const c = configRef.current;
			updateConfig({...c, recentIds: [item.key].concat(c.recentIds.filter((x) => x !== item.key)).slice(0, RECENT_MAX)});
		}
		open(item.key, item.label);
	}, [showToast]);

	/** hold OK on an app: move it one place along the home rows, or take it off the home screen */
	const onEdit = useCallback((action: 'move' | 'remove', _rowId: string, key: string, dir = 0) => {
		const c = configRef.current;
		const ids = c.appIds.filter((id) => apps.some((a) => a.id === id));   // what the home screen shows, in order
		const at = ids.indexOf(key);
		if (at < 0) return;
		if (action === 'remove') { updateConfig({...c, appIds: ids.filter((id) => id !== key)}); return; }
		const to = at + dir;
		if (to < 0 || to >= ids.length) return;
		const next = ids.slice();
		next.splice(at, 1);
		next.splice(to, 0, key);
		updateConfig({...c, appIds: next});
	}, [apps]);"""),
 ("		else if (optionId === OPTION.showAmPm) updateConfig({...config, showAmPm: !config.showAmPm});", "		else if (optionId === OPTION.showAmPm) updateConfig({...config, showAmPm: !config.showAmPm});\n		else if (optionId === OPTION.idle) updateConfig({...config, idleMinutes: IDLE_CHOICES[(IDLE_CHOICES.indexOf(config.idleMinutes) + 1) % IDLE_CHOICES.length]});"),
 ("active={screen === 'home'} onActivate={onActivate} showPeriod={config.showAmPm} />", "active={screen === 'home' && !controls} onActivate={onActivate} showPeriod={config.showAmPm} onEdit={onEdit} />"),
 ("			<Toast message={toast} />", "			{controls && <QuickControls onClose={() => setControls(false)} onError={(text) => showToast(text, 'error')} />}\n			<Toast message={toast} />"),
])

# ---------------------------------------------------------------- CSS
css = open(P('src/theme/global.css')).read()
css += """
/* ---------- hold-OK menu, move hint, Quick Controls, option values ---------- */
.panel--ctx { left: 50%; right: auto; margin-left: -220px; top: 300px; }
.movehint { position: absolute; left: 0; right: 0; top: 120px; text-align: center; font-size: 26px; color: var(--color-text-primary); text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8); z-index: 5; }
.screen--moving .tile--focused { transform: scale(1.14); }
.panel--controls { width: 680px; padding: 26px 22px 18px; top: 120px; }
.panel--controls .panel__title { margin: 0 0 16px 14px; }
.qc__row { justify-content: flex-start; }
.qc__label { flex: 1 1 auto; }
.qc__value { flex: 0 0 auto; font-size: 26px; opacity: 0.85; }
.qc__bar { flex: 0 0 220px; height: 10px; margin-right: 22px; border-radius: 5px; background: rgba(255, 255, 255, 0.28); overflow: hidden; }
.qc__fill { display: block; height: 100%; background: currentColor; border-radius: 5px; }
.qc__row .switch { flex: 0 0 auto; }
.option__value { flex: 0 0 auto; font-size: var(--font-option-label); color: var(--color-text-primary); padding: 0 8px; }
"""
open(P('src/theme/global.css'), 'w').write(css)
print('features applied')
