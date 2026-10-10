#!/usr/bin/env python3
"""Ninth patch layer (after apply_status_cc.py): a tvOS-style Control Center. The time moves to the top left (with the date and weather);
the top-right time pill becomes a Control Center button whose panel holds everything the old menu and Quick Controls had."""
import os
APP = os.path.expanduser('~/Developer/webos-launcher-tvos/app')
def P(p): return os.path.join(APP, p)
def sub(p, pairs):
    s = open(P(p)).read()
    for a, b in pairs:
        assert a in s, (p, a[:80])
        s = s.replace(a, b, 1)
    open(P(p), 'w').write(s)

sub('src/components/Glyph.tsx', [
 ("'timer' | 'folder';", "'timer' | 'folder' | 'speaker' | 'picture' | 'power' | 'restart';"),
 ("				: name === 'folder'\n", """				: name === 'speaker'
				? <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" />
				: name === 'picture'
				? <path d="M3.5 5.5h17v11h-17zM8 20h8M12 16.5V20" />
				: name === 'power'
				? <path d="M12 3.5v8M7 6.5a7.5 7.5 0 1 0 10 0" />
				: name === 'restart'
				? <path d="M19 12a7 7 0 1 1-2.2-5.1M19 4.5V8h-3.5" />
				: name === 'folder'
"""),
])

open(P('src/components/ControlCenter.tsx'), 'w').write("""import {useCallback, useEffect, useRef, useState} from 'preact/hooks';
import {Glyph, type GlyphName} from './Glyph';
import {useKeys, clamp, type NavKey} from '../hooks/useKeys';
import {PICTURE_LABEL, PICTURE_MODES, SLEEP_MINUTES, readControls, restartTv, screenOff, setMuted, setPictureMode, setSleepTimer, setVolume, type Controls} from '../lib/tvcontrols';
import {readStatus, type TvStatus} from '../lib/status';

export type CenterAction = 'lg-home' | 'settings' | 'screensaver';

interface Props {
	onClose: () => void;
	onError: (text: string) => void;
	/** buttons that leave the launcher or open another screen */
	onAction: (action: CenterAction) => void;
}

type CellId = 'mute' | 'picture' | 'sleep' | 'screensaver' | 'home' | 'settings' | 'screenoff' | 'restart' | 'volume';

/** The layout, like a control centre: two wide tiles, two wide tiles, a row of round buttons, then the volume slider. */
const GRID: CellId[][] = [['mute', 'picture'], ['sleep', 'screensaver'], ['home', 'settings', 'screenoff', 'restart'], ['volume']];

/** Control Center (opened from the round button top right): sound, picture mode, sleep timer, screensaver, LG Home, Settings, screen off, restart, volume.
 *  Arrows move between tiles, OK presses one, Left/Right on the volume bar change the volume, Back closes. */
export function ControlCenter ({onClose, onError, onAction}: Props) {
	const [values, setValues] = useState<Controls>({volume: 0, muted: false, picture: 'standard', sleepMinutes: 0});
	const [net, setNet] = useState<TvStatus['network']>('unknown');
	const [pos, setPos] = useState({row: 0, col: 0});
	const [confirm, setConfirm] = useState(false);
	const state = useRef({values, pos, confirm});
	state.current = {values, pos, confirm};

	useEffect(() => { readControls().then(setValues); readStatus().then((s) => setNet(s.network)).catch(() => undefined); }, []);

	const fail = (what: string) => () => onError(`Couldn't change ${what}`);
	const patch = (p: Partial<Controls>) => setValues((v) => ({...v, ...p}));

	const volume = (next: number) => { const v = clamp(next, 0, 100); patch({volume: v, muted: false}); setVolume(v).catch(fail('volume')); };

	const press = (cell: CellId) => {
		const v = state.current.values;
		if (cell === 'mute') { patch({muted: !v.muted}); setMuted(!v.muted).catch(fail('mute')); }
		else if (cell === 'picture') {
			const next = PICTURE_MODES[(PICTURE_MODES.indexOf(v.picture) + 1) % PICTURE_MODES.length];
			patch({picture: next}); setPictureMode(next).catch(fail('the picture mode'));
		} else if (cell === 'sleep') {
			const next = SLEEP_MINUTES[(Math.max(0, SLEEP_MINUTES.indexOf(v.sleepMinutes)) + 1) % SLEEP_MINUTES.length];
			patch({sleepMinutes: next}); setSleepTimer(next).catch(fail('the sleep timer'));
		}
		else if (cell === 'screensaver') onAction('screensaver');
		else if (cell === 'home') onAction('lg-home');
		else if (cell === 'settings') onAction('settings');
		else if (cell === 'screenoff') { onClose(); screenOff().catch(() => onError(\"Couldn't turn the screen off (it needs the Homebrew Channel)\")); }
		else if (cell === 'restart') {
			if (!state.current.confirm) { setConfirm(true); return; }
			onClose(); restartTv().catch(() => onError(\"Couldn't restart the TV (it needs the Homebrew Channel)\"));
		}
	};

	const move = (row: number, col: number) => { setPos({row: clamp(row, 0, GRID.length - 1), col}); setConfirm(false); };

	const handleKey = useCallback((key: NavKey): boolean => {
		const {pos: p, values: v} = state.current;
		const cell = GRID[p.row][p.col];
		if (key === 'back') { onClose(); return true; }
		if (key === 'enter') { press(cell); return true; }
		if (cell === 'volume' && (key === 'left' || key === 'right')) { volume(v.volume + (key === 'left' ? -2 : 2)); return true; }
		if (key === 'left') move(p.row, clamp(p.col - 1, 0, GRID[p.row].length - 1));
		else if (key === 'right') move(p.row, clamp(p.col + 1, 0, GRID[p.row].length - 1));
		else if (key === 'up' || key === 'down') {
			const row = clamp(p.row + (key === 'up' ? -1 : 1), 0, GRID.length - 1);
			move(row, clamp(p.col, 0, GRID[row].length - 1));
		}
		return true;
	}, []);
	useKeys(handleKey, true);

	const focused = (cell: CellId) => GRID[pos.row][pos.col] === cell;
	const at = (cell: CellId) => { for (let r = 0; r < GRID.length; r++) { const c = GRID[r].indexOf(cell); if (c >= 0) return {row: r, col: c}; } return {row: 0, col: 0}; };

	const wide = (cell: CellId, glyph: GlyphName, title: string, sub: string, on = false) => (
		<div
			key={cell}
			class={`cc__tile${focused(cell) ? ' cc__tile--focused' : ''}${on ? ' cc__tile--on' : ''}`}
			onMouseEnter={() => setPos(at(cell))}
			onClick={() => press(cell)}
		>
			<div class="cc__badge"><Glyph name={glyph} /></div>
			<div class="cc__text"><div class="cc__name">{title}</div><div class="cc__sub">{sub}</div></div>
		</div>
	);
	const round = (cell: CellId, glyph: GlyphName, label: string) => (
		<div key={cell} class="cc__round" onMouseEnter={() => setPos(at(cell))} onClick={() => press(cell)}>
			<div class={`cc__circle${focused(cell) ? ' cc__circle--focused' : ''}`}><Glyph name={glyph} /></div>
			<div class="cc__label">{cell === 'restart' && confirm ? 'Press OK again' : label}</div>
		</div>
	);

	return (
		<>
			<div class="panel-backdrop" onClick={onClose} />
			<div class="panel panel--cc">
				<div class="cc__top">
					<span class="cc__title">Control Center</span>
					{net !== 'unknown' && <span class="cc__net">{net === 'wifi' ? 'Wi-Fi' : net === 'ethernet' ? 'Ethernet' : 'Offline'}</span>}
				</div>
				<div class="cc__row">
					{wide('mute', values.muted ? 'muted' : 'speaker', 'Sound', values.muted ? 'Muted' : 'On', values.muted)}
					{wide('picture', 'picture', 'Picture', PICTURE_LABEL[values.picture] || values.picture)}
				</div>
				<div class="cc__row">
					{wide('sleep', 'timer', 'Sleep timer', values.sleepMinutes ? `${values.sleepMinutes} min` : 'Off', values.sleepMinutes > 0)}
					{wide('screensaver', 'screensaver', 'Screensaver', 'Start now')}
				</div>
				<div class="cc__row cc__row--round">
					{round('home', 'house', 'LG Home')}
					{round('settings', 'gear', 'Settings')}
					{round('screenoff', 'power', 'Screen off')}
					{round('restart', 'restart', 'Restart')}
				</div>
				<div
					class={`cc__slider${focused('volume') ? ' cc__slider--focused' : ''}`}
					onMouseEnter={() => setPos(at('volume'))}
					onClick={(e: MouseEvent) => { const box = (e.currentTarget as HTMLElement).getBoundingClientRect(); volume(Math.round(((e.clientX - box.left) / box.width) * 100)); }}
				>
					<div class="cc__fill" style={`width:${values.muted ? 0 : values.volume}%`} />
					<div class="cc__slidertext"><Glyph name={values.muted ? 'muted' : 'speaker'} /><span>Volume</span><span class="cc__num">{values.muted ? 'Muted' : values.volume}</span></div>
				</div>
			</div>
		</>
	);
}
""")

# Home: the top-right button opens the Control Center directly; the clock moves to the top-left status block
sub('src/screens/Home.tsx', [
 ("		else if (item.key === MENU_KEY) { n.menuIndex = 0; n.zone = 'menu'; render(); }", "		else if (item.key === MENU_KEY) { n.menuIndex = 0; n.zone = 'menu'; render(); }\n		else latest.current.onActivate('top', item);"),
 ("			<Status weatherText={weatherText} />", "			<Status weatherText={weatherText} showPeriod={showPeriod} />"),
])
sub('src/components/Status.tsx', [
 ("import {useEffect, useState} from 'preact/hooks';", "import {useEffect, useState} from 'preact/hooks';\nimport {Clock} from './Clock';"),
 ("export function Status ({weatherText}: {weatherText?: string}) {", "export function Status ({weatherText, showPeriod}: {weatherText?: string; showPeriod?: boolean}) {"),
 ("		<div class=\"pill status\">\n", "		<div class=\"pill status\">\n			<Clock showPeriod={showPeriod} />\n"),
])
sub('src/app.tsx', [
 ("import {QuickControls} from './components/QuickControls';", "import {ControlCenter, type CenterAction} from './components/ControlCenter';"),
 ("	{key: 'menu', label: 'Menu'}\n", "	{key: 'controls', label: 'Control Center', glyph: 'sliders'}\n"),
 ("			{controls && <QuickControls onClose={() => setControls(false)} onError={(text) => showToast(text, 'error')} />}", """			{controls && <ControlCenter
				onClose={() => setControls(false)}
				onError={(text) => showToast(text, 'error')}
				onAction={(a: CenterAction) => { setControls(false); onActivate('menu', a === 'settings' ? {key: MISC.settings, label: 'Settings'} : a === 'lg-home' ? {key: MISC.lgHome, label: 'LG Home'} : {key: 'screensaver', label: 'Screensaver'}); }}
			/>}"""),
])

css = open(P('src/theme/global.css')).read()
css += """
/* ---------- time top left ---------- */
.screen > .pill.status { align-items: center; }
.screen > .pill.status .clock { background: none; box-shadow: none; padding: 0; margin: 0 22px 0 0; border-radius: 0; height: auto; text-shadow: 0 2px 10px rgba(0, 0, 0, 0.7); }
.screen > .pill.status .clock__time { font-size: 52px; font-weight: 300; line-height: 1; letter-spacing: 0; }
.screen > .pill.status .clock__period { font-size: 22px; }

/* ---------- Control Center: glass tiles (no live blur: the panel's glass is the pre-blurred wallpaper copy) ---------- */
.panel--cc { width: 700px; padding: 26px 26px 26px; top: 130px; border-radius: 48px; }
.cc__top { display: flex; flex-direction: row; justify-content: space-between; align-items: baseline; margin: 0 8px 18px; }
.cc__title { font-size: 30px; color: var(--color-text-primary); letter-spacing: 0.02em; }
.cc__net { font-size: 22px; opacity: 0.75; color: var(--color-text-primary); }
.cc__row { display: flex; flex-direction: row; justify-content: space-between; margin-bottom: 16px; }
.cc__tile { width: 322px; height: 96px; border-radius: 48px; display: flex; flex-direction: row; align-items: center; padding: 0 18px 0 16px; box-sizing: border-box; color: var(--color-text-primary); background: rgba(255, 255, 255, 0.16); box-shadow: inset 2px 2px 1.5px -1px rgba(255, 255, 255, 0.55), inset -2px -2px 1.5px -1px rgba(255, 255, 255, 0.22); }
.cc__badge { flex: 0 0 auto; width: 62px; height: 62px; border-radius: 31px; margin-right: 16px; background: rgba(255, 255, 255, 0.22); display: flex; align-items: center; justify-content: center; }
.cc__badge svg, .cc__circle svg, .cc__slidertext svg { position: static; left: auto; top: auto; width: 32px; height: 32px; stroke: #fff; }
.cc__text { min-width: 0; }
.cc__name { font-size: 26px; font-weight: 600; white-space: nowrap; }
.cc__sub { font-size: 21px; opacity: 0.8; white-space: nowrap; margin-top: 2px; }
.cc__tile--on .cc__badge { background: #fff; }
.cc__tile--on .cc__badge svg { stroke: #111; }
.cc__tile--focused { background: #fff; color: #111; transform: scale(1.03); }
.cc__tile--focused .cc__badge { background: rgba(0, 0, 0, 0.1); }
.cc__tile--focused .cc__badge svg { stroke: #111; }
.cc__row--round { padding: 4px 12px 0; }
.cc__round { width: 130px; display: flex; flex-direction: column; align-items: center; }
.cc__circle { width: 96px; height: 96px; border-radius: 48px; display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.16); box-shadow: inset 2px 2px 1.5px -1px rgba(255, 255, 255, 0.55), inset -2px -2px 1.5px -1px rgba(255, 255, 255, 0.22); }
.cc__circle--focused { background: #fff; transform: scale(1.1); }
.cc__circle--focused svg { stroke: #111; }
.cc__label { margin-top: 10px; font-size: 20px; color: var(--color-text-primary); opacity: 0.85; white-space: nowrap; }
.cc__slider { position: relative; height: 80px; border-radius: 40px; overflow: hidden; margin-top: 8px; background: rgba(255, 255, 255, 0.16); box-shadow: inset 2px 2px 1.5px -1px rgba(255, 255, 255, 0.55), inset -2px -2px 1.5px -1px rgba(255, 255, 255, 0.22); }
.cc__fill { position: absolute; left: 0; top: 0; bottom: 0; background: rgba(255, 255, 255, 0.55); }
.cc__slidertext { position: absolute; left: 0; right: 0; top: 0; bottom: 0; display: flex; flex-direction: row; align-items: center; padding: 0 26px; font-size: 26px; font-weight: 600; color: #111; }
.cc__slidertext svg { margin-right: 14px; stroke: #111; }
.cc__num { margin-left: auto; font-weight: 500; }
.cc__slider--focused { box-shadow: 0 0 0 4px #fff; transform: scale(1.02); }
"""
css += """
/* ---------- Control Center polish ---------- */
.screen > .pill.status { flex-direction: row; }
.screen > .pill.status .clock { position: static; opacity: 1; flex: 0 0 auto; }
.topbar .pill:last-child .pill__label { left: auto; right: 0; transform: none; }
.panel--cc { top: 150px; }
.cc__tile, .cc__circle, .cc__slider { background: rgba(28, 34, 48, 0.34); }
.cc__tile--focused { background: #fff; }
.cc__circle--focused { background: #fff; }
"""
open(P('src/theme/global.css'), 'w').write(css)
print('control center applied')
