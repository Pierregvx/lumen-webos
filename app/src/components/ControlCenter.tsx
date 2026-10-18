import {t as tr} from '../lib/i18n';
import {useCallback, useEffect, useRef, useState} from 'preact/hooks';
import {Glyph, type GlyphName} from './Glyph';
import {useKeys, clamp, type NavKey} from '../hooks/useKeys';
import {PICTURE_LABEL, PICTURE_MODES, SOUND_LABEL, SOUND_MODES, setSoundMode, readBacklight, readControls, setBacklight, setEyeComfort, restartTv, screenOff, setPictureMode, type Controls} from '../lib/tvcontrols';

export type CenterAction = 'lg-home' | 'art';

interface Props {
	onClose: () => void;
	onError: (text: string) => void;
	/** buttons that leave the launcher or open another screen */
	onAction: (action: CenterAction) => void;
	darkMode: string;
	clockFormat: string;
	onDarkMode: () => void;
	onClockFormat: () => void;
}

type CellId = 'sound' | 'picture' | 'art' | 'home' | 'screenoff' | 'restart' | 'backlight' | 'eye' | 'dark' | 'clock';

/** The layout, like the tvOS Control Center: a grid four squares wide, where a tile spans two squares and the backlight bar three. */
const GRID: {id: CellId; span: number}[][] = [
	[{id: 'sound', span: 2}, {id: 'picture', span: 2}],
	[{id: 'dark', span: 2}, {id: 'clock', span: 2}],
	[{id: 'home', span: 1}, {id: 'art', span: 1}, {id: 'screenoff', span: 1}, {id: 'restart', span: 1}],
	[{id: 'backlight', span: 3}, {id: 'eye', span: 1}]
];

/** The cell in a row that covers grid column x (0 to 3), and the column it starts at. */
const cellAt = (row: number, x: number) => {
	let start = 0;
	for (const c of GRID[row]) { if (x < start + c.span) return {cell: c.id, start}; start += c.span; }
	return {cell: GRID[row][GRID[row].length - 1].id, start: 4 - GRID[row][GRID[row].length - 1].span};
};
const startOf = (row: number, i: number) => GRID[row].slice(0, i).reduce((n, c) => n + c.span, 0);

/** Each backlight change is a root command (a luna-send process on the TV), so a run of presses sends only the last level, this long after. */
const BACKLIGHT_DELAY_MS = 300;

/** Control Center (opened from the round button top right): sound, picture mode, appearance, clock, LG Home, Art mode (your photos), screen off,
 *  restart, backlight and Eye Comfort. Volume is left to the remote's own buttons. Arrows move between controls, OK presses one, Left/Right on
 *  the backlight bar change it, Back closes. */
export function ControlCenter ({onClose, onError, onAction, darkMode, clockFormat, onDarkMode, onClockFormat}: Props) {
	const outer = useRef({darkMode, clockFormat, onDarkMode, onClockFormat});
	outer.current = {darkMode, clockFormat, onDarkMode, onClockFormat};
	const [values, setValues] = useState<Controls>({volume: 0, muted: false, picture: 'normal', sound: 'standard', backlight: 100, eyeComfort: false});
	// x is the grid column the remote is on, kept when moving up and down, so Down from Restart lands on Eye Comfort
	const [pos, setPos] = useState({row: 0, x: 0});
	const [confirm, setConfirm] = useState(false);
	const state = useRef({values, pos, confirm});
	state.current = {values, pos, confirm};

	// read the TV's values a moment after the panel is on screen, so opening it is never held up by the TV answering
	useEffect(() => {
		const id = window.setTimeout(() => { readControls().then(setValues); }, 250);
		return () => window.clearTimeout(id);
	}, []);

	const fail = (what: string) => () => onError(`Couldn't change ${what}`);
	const patch = (p: Partial<Controls>) => setValues((v) => ({...v, ...p}));

	// the backlight level waiting to be sent; sent at once if the panel closes first
	const pendingBacklight = useRef<{id: number; level: number} | null>(null);
	const sendBacklight = () => {
		const p = pendingBacklight.current;
		if (!p) return;
		window.clearTimeout(p.id);
		pendingBacklight.current = null;
		setBacklight(p.level).catch(() => onError("Couldn't change the backlight"));
	};
	useEffect(() => sendBacklight, []);
	const backlight = (next: number) => {
		const level = clamp(next, 0, 100);
		patch({backlight: level});
		if (pendingBacklight.current) window.clearTimeout(pendingBacklight.current.id);
		pendingBacklight.current = {id: window.setTimeout(sendBacklight, BACKLIGHT_DELAY_MS), level};
	};

	const press = (cell: CellId) => {
		const v = state.current.values;
		if (cell === 'eye') {
			const on = !v.eyeComfort;
			patch({eyeComfort: on}); setEyeComfort(on).catch(() => { patch({eyeComfort: !on}); onError("Couldn't change Eye Comfort"); });
		}
		else if (cell === 'sound') {
			const next = SOUND_MODES[(Math.max(0, SOUND_MODES.indexOf(v.sound)) + 1) % SOUND_MODES.length];
			const before = v.sound;
			patch({sound: next}); setSoundMode(next).catch(() => { patch({sound: before}); onError("This TV didn't accept that sound mode"); });
		}
		else if (cell === 'picture') {
			const next = PICTURE_MODES[(PICTURE_MODES.indexOf(v.picture) + 1) % PICTURE_MODES.length];
			// each picture mode has its own backlight, so show the new mode's
			patch({picture: next}); setPictureMode(next).then(readBacklight).then((b) => { if (b !== null) patch({backlight: b}); }).catch(fail('the picture mode'));
		}
		else if (cell === 'dark') outer.current.onDarkMode();
		else if (cell === 'clock') outer.current.onClockFormat();
		else if (cell === 'art') onAction('art');
		else if (cell === 'home') onAction('lg-home');
		else if (cell === 'screenoff') { onClose(); screenOff().catch(() => onError("Couldn't turn the screen off (it needs the Homebrew Channel)")); }
		else if (cell === 'restart') {
			if (!state.current.confirm) { setConfirm(true); return; }
			onClose(); restartTv().catch(() => onError("Couldn't restart the TV (it needs the Homebrew Channel)"));
		}
	};

	const move = (row: number, x: number) => { setPos({row, x}); setConfirm(false); };

	const handleKey = useCallback((key: NavKey): boolean => {
		const {pos: p, values: v} = state.current;
		const {cell, start} = cellAt(p.row, p.x);
		if (key === 'back') { onClose(); return true; }
		if (key === 'enter') { press(cell); return true; }
		if (cell === 'backlight' && (key === 'left' || key === 'right')) { backlight(v.backlight + (key === 'left' ? -5 : 5)); return true; }
		if (key === 'left' || key === 'right') {
			const i = GRID[p.row].map((c) => c.id).indexOf(cell);
			const j = clamp(i + (key === 'left' ? -1 : 1), 0, GRID[p.row].length - 1);
			if (j !== i) move(p.row, startOf(p.row, j));
		}
		else if (key === 'up' || key === 'down') move(clamp(p.row + (key === 'up' ? -1 : 1), 0, GRID.length - 1), start);
		return true;
	}, []);
	useKeys(handleKey, true);

	const current = cellAt(pos.row, pos.x).cell;
	const focus = (cell: CellId) => () => {
		for (let r = 0; r < GRID.length; r++) { const i = GRID[r].map((c) => c.id).indexOf(cell); if (i >= 0) { setPos({row: r, x: startOf(r, i)}); return; } }
	};

	const wide = (cell: CellId, glyph: GlyphName, title: string, sub: string, on = false) => (
		<div
			key={cell}
			class={`cc__mod cc__tile${current === cell ? ' cc__mod--focused' : ''}${on ? ' cc__mod--on' : ''}`}
			onMouseEnter={focus(cell)}
			onClick={() => press(cell)}
		>
			<div class="cc__icon"><Glyph name={glyph} /></div>
			<div class="cc__text"><div class="cc__name">{title}</div><div class="cc__sub">{sub}</div></div>
		</div>
	);
	// icon-only circles, as on tvOS; the focused one is named in the caption under the panel
	const CIRCLES: {cell: CellId; glyph: GlyphName; label: string}[] = [
		{cell: 'home', glyph: 'house', label: 'LG Home'}, {cell: 'art', glyph: 'image', label: 'Art mode'},
		{cell: 'screenoff', glyph: 'power', label: 'Screen off'}, {cell: 'restart', glyph: 'restart', label: 'Restart'},
		{cell: 'eye', glyph: 'eye', label: 'Eye Comfort'}
	];
	const circle = (cell: CellId, on = false) => {
		const c = CIRCLES.filter((q) => q.cell === cell)[0];
		return <div key={cell} class={`cc__mod cc__circle${current === cell ? ' cc__mod--focused' : ''}${on ? ' cc__mod--on' : ''}`} onMouseEnter={focus(cell)} onClick={() => press(cell)}><Glyph name={c.glyph} /></div>;
	};
	const named = CIRCLES.filter((q) => q.cell === current)[0];
	const caption = !named ? '' : named.cell === 'restart' && confirm ? tr('Press OK again') : named.cell === 'eye' ? `${tr(named.label)}: ${tr(values.eyeComfort ? 'On' : 'Off')}` : tr(named.label);
	// the backlight label, drawn twice: light over the glass, dark over the filled part, so it reads at any level
	const sliderText = <div class="cc__slidertext"><Glyph name="sun" /><span>{tr('Backlight')}</span><span class="cc__num">{values.backlight}</span></div>;

	return (
		<>
			<div class="panel-backdrop panel-backdrop--clear" onClick={onClose} />
			<div class="panel panel--cc">
				<div class="cc__row">
					{wide('sound', 'speaker', tr('Sound'), SOUND_LABEL[values.sound] || values.sound)}
					{wide('picture', 'picture', tr('Picture'), PICTURE_LABEL[values.picture] || values.picture)}
				</div>
				<div class="cc__row">
					{wide('dark', 'screensaver', tr('Theme'), darkMode === 'on' ? tr('Dark') : darkMode === 'auto' ? tr('Auto') : tr('Light'), darkMode === 'on')}
					{wide('clock', 'timer', tr('Clock'), clockFormat === '12h' ? tr('12-hour') : clockFormat === '24h' ? tr('24-hour') : tr('Auto'), clockFormat !== 'auto')}
				</div>
				<div class="cc__row">{circle('home')}{circle('art')}{circle('screenoff')}{circle('restart')}</div>
				<div class="cc__row">
					<div
						class={`cc__mod cc__slider${current === 'backlight' ? ' cc__mod--focused' : ''}`}
						onMouseEnter={focus('backlight')}
						onClick={(e: MouseEvent) => { const box = (e.currentTarget as HTMLElement).getBoundingClientRect(); backlight(Math.round(((e.clientX - box.left) / box.width) * 100)); }}
					>
						{sliderText}
						<div class="cc__fill" style={`width:${values.backlight}%`}>{sliderText}</div>
					</div>
					{circle('eye', values.eyeComfort)}
				</div>
				<div class="cc__caption">{caption}</div>
			</div>
		</>
	);
}
