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
	onDarkMode: (mode: string) => void;
	onClockFormat: (format: string) => void;
}

type CellId = 'sound' | 'picture' | 'art' | 'home' | 'screenoff' | 'restart' | 'backlight' | 'eye' | 'dark' | 'clock';
/** the tiles that open a list of choices in place of the grid, as tvOS does for Sleep Timer */
type MenuCell = 'sound' | 'picture' | 'dark' | 'clock';
const MENU_CELLS: CellId[] = ['sound', 'picture', 'dark', 'clock'];
const MENU_GLYPH: Record<MenuCell, GlyphName> = {sound: 'speaker', picture: 'picture', dark: 'screensaver', clock: 'timer'};

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

/** Opening a list: the tile's text and the rest of the grid fade, then a copy of the tile grows to the list's size by transform and fades as
 *  the list fades in. Closing runs it backwards. These match the transitions on .cc__grid, .cc__morph and .cc__list in global.css. */
const TEXT_MS = 80;
const GROW_MS = 200;
/** a list choice's height and the gap between choices, as .cc__opt in global.css */
const OPT_H = 72;
const OPT_GAP = 12;
const listHeight = (count: number) => count * OPT_H + (count - 1) * OPT_GAP;

type Phase = 'grid' | 'fading' | 'opening' | 'list' | 'closing';

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
	// the open list: which tile it belongs to and the focused choice
	const [menu, setMenu] = useState<{cell: MenuCell; idx: number} | null>(null);
	const [phase, setPhase] = useState<Phase>('grid');
	// the tile the list opens from: its text is faded while set, and its glass is hidden while the copy stands in for it
	const [source, setSource] = useState<{cell: CellId; gone: boolean} | null>(null);
	// the copy of the tile, laid out at the tile's size and place, that grows into the list and shrinks back
	const [morph, setMorph] = useState<{box: string; transform: string; opacity: number; motion: '' | 'grow' | 'shrink'} | null>(null);
	const state = useRef({values, pos, confirm, menu, phase});
	state.current = {values, pos, confirm, menu, phase};
	const tiles = useRef<Partial<Record<CellId, HTMLElement | null>>>({});
	const panel = useRef<HTMLDivElement>(null);
	const timers = useRef<number[]>([]);
	useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);
	const still = () => document.documentElement.classList.contains('reduce-motion');
	const after = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, still() ? 0 : ms)); };
	// two frames, so the box is drawn at its start before the transition to its end begins
	const nextFrame = (fn: () => void) => requestAnimationFrame(() => requestAnimationFrame(fn));

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
		if (state.current.phase !== 'grid') return;
		const v = state.current.values;
		if (cell === 'eye') {
			const on = !v.eyeComfort;
			patch({eyeComfort: on}); setEyeComfort(on).catch(() => { patch({eyeComfort: !on}); onError("Couldn't change Eye Comfort"); });
		}
		else if (MENU_CELLS.indexOf(cell) >= 0) openMenu(cell as MenuCell);
		else if (cell === 'art') onAction('art');
		else if (cell === 'home') onAction('lg-home');
		else if (cell === 'screenoff') { onClose(); screenOff().catch(() => onError("Couldn't turn the screen off (it needs the Homebrew Channel)")); }
		else if (cell === 'restart') {
			if (!state.current.confirm) { setConfirm(true); return; }
			onClose(); restartTv().catch(() => onError("Couldn't restart the TV (it needs the Homebrew Channel)"));
		}
	};

	const options = (cell: MenuCell): {value: string; label: string}[] =>
		cell === 'sound' ? SOUND_MODES.map((m) => ({value: m, label: SOUND_LABEL[m] || m}))
			: cell === 'picture' ? PICTURE_MODES.map((m) => ({value: m, label: PICTURE_LABEL[m] || m}))
				: cell === 'dark' ? [{value: 'off', label: tr('Light')}, {value: 'on', label: tr('Dark')}, {value: 'auto', label: tr('Auto')}]
					: [{value: 'auto', label: tr('Auto')}, {value: '12h', label: tr('12-hour')}, {value: '24h', label: tr('24-hour')}];
	const chosen = (cell: MenuCell): string => {
		const v = state.current.values;
		const o = outer.current;
		return cell === 'sound' ? v.sound : cell === 'picture' ? v.picture : cell === 'dark' ? o.darkMode : o.clockFormat;
	};

	const apply = (cell: MenuCell, value: string) => {
		if (value === chosen(cell)) return;
		const v = state.current.values;
		if (cell === 'sound') {
			const before = v.sound;
			patch({sound: value}); setSoundMode(value).catch(() => { patch({sound: before}); onError("This TV didn't accept that sound mode"); });
		}
		else if (cell === 'picture') {
			// each picture mode has its own backlight, so show the new mode's
			patch({picture: value}); setPictureMode(value).then(readBacklight).then((b) => { if (b !== null) patch({backlight: b}); }).catch(fail('the picture mode'));
		}
		else if (cell === 'dark') outer.current.onDarkMode(value);
		else outer.current.onClockFormat(value);
	};

	/** Where the copy sits (the tile's own box, so its corners match) and the transforms for its two ends: the focused tile (scaled 1.1 about
	 *  its centre) and the whole list. */
	const copyOf = (cell: MenuCell, count: number) => {
		const el = tiles.current[cell];
		const w = el ? el.offsetWidth : 1;
		const h = el ? el.offsetHeight : 1;
		const x = el ? el.offsetLeft : 0;
		const y = el ? el.offsetTop : 0;
		const full = panel.current ? panel.current.offsetWidth : w;
		return {
			box: `left:${x}px;top:${y}px;width:${w}px;height:${h}px`,
			tile: `translate(${-0.05 * w}px, ${-0.05 * h}px) scale(1.1)`,
			list: `translate(${-x}px, ${-y}px) scale(${full / w}, ${listHeight(count) / h})`
		};
	};

	const openMenu = (cell: MenuCell) => {
		if (state.current.phase !== 'grid') return;
		const list = options(cell);
		const idx = Math.max(0, list.map((o) => o.value).indexOf(chosen(cell)));
		const c = copyOf(cell, list.length);
		setConfirm(false); setMenu({cell, idx}); setPhase('fading'); setSource({cell, gone: false});
		after(TEXT_MS, () => {
			setSource({cell, gone: true}); setPhase('opening');
			setMorph({box: c.box, transform: c.tile, opacity: 1, motion: ''});
			nextFrame(() => {
				setMorph({box: c.box, transform: c.list, opacity: 0, motion: 'grow'});
				after(GROW_MS + 20, () => { setPhase('list'); setMorph(null); });
			});
		});
	};

	/** Back to the grid, after applying the choice if one was picked. */
	const closeMenu = (pick: boolean, idx?: number) => {
		const {menu: m, phase: ph} = state.current;
		if (!m || ph !== 'list') return;
		if (pick) apply(m.cell, options(m.cell)[idx === undefined ? m.idx : idx].value);
		const c = copyOf(m.cell, options(m.cell).length);
		setPhase('closing');
		setMorph({box: c.box, transform: c.list, opacity: 0, motion: ''});
		nextFrame(() => {
			setMorph({box: c.box, transform: c.tile, opacity: 1, motion: 'shrink'});
			after(GROW_MS + 20, () => {
				// the tile's glass takes over from the copy in the same frame, then its text fades back in
				setSource({cell: m.cell, gone: false}); setMorph(null); setMenu(null); setPhase('grid');
				nextFrame(() => setSource(null));
			});
		});
	};

	const move = (row: number, x: number) => { setPos({row, x}); setConfirm(false); };

	const handleKey = useCallback((key: NavKey): boolean => {
		const {pos: p, values: v, menu: m, phase: ph} = state.current;
		if (ph === 'fading' || ph === 'opening' || ph === 'closing') return true;
		if (m) {
			if (key === 'back') closeMenu(false);
			else if (key === 'enter') closeMenu(true);
			else if (key === 'up' || key === 'down') setMenu({cell: m.cell, idx: clamp(m.idx + (key === 'up' ? -1 : 1), 0, options(m.cell).length - 1)});
			return true;
		}
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
			ref={(el) => { tiles.current[cell] = el; }}
			class={`cc__mod cc__tile${current === cell ? ' cc__mod--focused' : ''}${source && source.cell === cell ? ` cc__mod--source${source.gone ? ' cc__mod--gone' : ''}` : ''}${on ? ' cc__mod--on' : ''}`}
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
	const caption = !named || menu ? '' : named.cell === 'restart' && confirm ? tr('Press OK again') : named.cell === 'eye' ? `${tr(named.label)}: ${tr(values.eyeComfort ? 'On' : 'Off')}` : tr(named.label);
	// the backlight label, drawn twice: light over the glass, dark over the filled part, so it reads at any level
	const sliderText = <div class="cc__slidertext"><Glyph name="sun" /><span>{tr('Backlight')}</span><span class="cc__num">{values.backlight}</span></div>;

	return (
		<>
			<div class="panel-backdrop panel-backdrop--clear" onClick={onClose} />
			<div class="panel panel--cc" ref={panel}>
				<div class={`cc__grid${phase === 'grid' || phase === 'closing' ? '' : ' cc__grid--leaving'}`}>
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
				{morph && <div class={`cc__mod cc__mod--focused cc__morph${morph.motion ? ` cc__morph--${morph.motion}` : ''}`} style={`${morph.box};transform:${morph.transform};opacity:${morph.opacity}`} />}
				{menu && (
					<div class={`cc__list${phase === 'opening' || phase === 'list' ? ' cc__list--shown' : ''}`}>
						{options(menu.cell).map((o, i) => (
							<div
								key={o.value}
								class={`cc__mod cc__tile cc__opt${menu.idx === i ? ' cc__mod--focused' : ''}${o.value === chosen(menu.cell) ? ' cc__mod--on' : ''}`}
								onMouseEnter={() => setMenu({cell: menu.cell, idx: i})}
								onClick={() => closeMenu(true, i)}
							>
								<div class="cc__icon"><Glyph name={MENU_GLYPH[menu.cell]} /></div>
								<div class="cc__text"><div class="cc__name">{o.label}</div></div>
							</div>
						))}
					</div>
				)}
			</div>
		</>
	);
}
