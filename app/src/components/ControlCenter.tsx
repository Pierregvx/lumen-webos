import {t as tr} from '../lib/i18n';
import {useCallback, useEffect, useRef, useState} from 'preact/hooks';
import {Glyph, type GlyphName} from './Glyph';
import {useKeys, clamp, type NavKey} from '../hooks/useKeys';
import {PICTURE_LABEL, PICTURE_MODES, SCREENSAVER_MINUTES, SOUND_LABEL, SOUND_MODES, setSoundMode, SLEEP_MINUTES, readControls, restartTv, screenOff, setMuted, setScreensaverTime, setPictureMode, setSleepTimer, setVolume, type Controls} from '../lib/tvcontrols';
import {readStatus, type TvStatus} from '../lib/status';

export type CenterAction = 'lg-home' | 'settings' | 'screensaver' | 'art';

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

type CellId = 'sound' | 'picture' | 'sleep' | 'saver' | 'startsaver' | 'art' | 'home' | 'settings' | 'screenoff' | 'restart' | 'volume' | 'dark' | 'clock';

/** The layout, like a control centre: two wide tiles, two wide tiles, a row of round buttons, then the volume slider. */
const GRID: CellId[][] = [['sound', 'picture'], ['sleep', 'saver'], ['dark', 'clock'], ['home', 'settings', 'art', 'startsaver', 'screenoff', 'restart'], ['volume']];

/** Control Center (opened from the round button top right): sound, picture mode, sleep timer, screensaver, LG Home, Settings, screen off, restart, volume.
 *  Arrows move between tiles, OK presses one, Left/Right on the volume bar change the volume, Back closes. */
export function ControlCenter ({onClose, onError, onAction, darkMode, clockFormat, onDarkMode, onClockFormat}: Props) {
	const outer = useRef({darkMode, clockFormat, onDarkMode, onClockFormat});
	outer.current = {darkMode, clockFormat, onDarkMode, onClockFormat};
	const [values, setValues] = useState<Controls>({volume: 0, muted: false, picture: 'normal', sound: 'standard', sleepMinutes: 0, screensaver: 10});
	const [net, setNet] = useState<TvStatus['network']>('unknown');
	const [pos, setPos] = useState({row: 0, col: 0});
	const [confirm, setConfirm] = useState(false);
	const state = useRef({values, pos, confirm});
	state.current = {values, pos, confirm};

	// read the TV's values a moment after the panel is on screen, so opening it is never held up by the TV answering
	useEffect(() => {
		const id = window.setTimeout(() => { readControls().then(setValues); readStatus().then((s) => setNet(s.network)).catch(() => undefined); }, 250);
		return () => window.clearTimeout(id);
	}, []);

	const fail = (what: string) => () => onError(`Couldn't change ${what}`);
	const patch = (p: Partial<Controls>) => setValues((v) => ({...v, ...p}));

	const volume = (next: number) => { const v = clamp(next, 0, 100); patch({volume: v, muted: false}); setVolume(v).catch(fail('volume')); };

	const press = (cell: CellId) => {
		const v = state.current.values;
		if (cell === 'volume') { patch({muted: !v.muted}); setMuted(!v.muted).catch(fail('mute')); }
		else if (cell === 'sound') {
			const next = SOUND_MODES[(Math.max(0, SOUND_MODES.indexOf(v.sound)) + 1) % SOUND_MODES.length];
			const before = v.sound;
			patch({sound: next}); setSoundMode(next).catch(() => { patch({sound: before}); onError("This TV didn't accept that sound mode"); });
		}
		else if (cell === 'picture') {
			const next = PICTURE_MODES[(PICTURE_MODES.indexOf(v.picture) + 1) % PICTURE_MODES.length];
			patch({picture: next}); setPictureMode(next).catch(fail('the picture mode'));
		} else if (cell === 'sleep') {
			const next = SLEEP_MINUTES[(Math.max(0, SLEEP_MINUTES.indexOf(v.sleepMinutes)) + 1) % SLEEP_MINUTES.length];
			patch({sleepMinutes: next}); setSleepTimer(next).catch(fail('the sleep timer'));
		}
		else if (cell === 'saver') {
			const next = SCREENSAVER_MINUTES[(Math.max(0, SCREENSAVER_MINUTES.indexOf(v.screensaver)) + 1) % SCREENSAVER_MINUTES.length];
			patch({screensaver: next}); setScreensaverTime(next).catch(fail('the screensaver time'));
		}
		else if (cell === 'dark') outer.current.onDarkMode();
		else if (cell === 'clock') outer.current.onClockFormat();
		else if (cell === 'art') onAction('art');
		else if (cell === 'startsaver') onAction('screensaver');
		else if (cell === 'home') onAction('lg-home');
		else if (cell === 'settings') onAction('settings');
		else if (cell === 'screenoff') { onClose(); screenOff().catch(() => onError("Couldn't turn the screen off (it needs the Homebrew Channel)")); }
		else if (cell === 'restart') {
			if (!state.current.confirm) { setConfirm(true); return; }
			onClose(); restartTv().catch(() => onError("Couldn't restart the TV (it needs the Homebrew Channel)"));
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
			<div class="cc__label">{tr(cell === 'restart' && confirm ? 'Press OK again' : label)}</div>
		</div>
	);

	return (
		<>
			<div class="panel-backdrop" onClick={onClose} />
			<div class="panel panel--cc">
				<div class="cc__top">
					<span class="cc__title">{tr('Control Center')}</span>
					{net !== 'unknown' && <span class="cc__net">{net === 'wifi' ? 'Wi-Fi' : net === 'ethernet' ? 'Ethernet' : tr('Offline')}</span>}
				</div>
				<div class="cc__row">
					{wide('sound', 'speaker', tr('Sound mode'), SOUND_LABEL[values.sound] || values.sound)}
					{wide('picture', 'picture', tr('Picture'), PICTURE_LABEL[values.picture] || values.picture)}
				</div>
				<div class="cc__row">
					{wide('sleep', 'timer', tr('Sleep timer'), values.sleepMinutes ? tr('{n} min', {n: values.sleepMinutes}) : tr('Off'), values.sleepMinutes > 0)}
					{wide('saver', 'screensaver', tr('Screensaver'), tr('After {n} min', {n: values.screensaver}))}
				</div>
				<div class="cc__row">
					{wide('dark', 'screensaver', tr('Appearance'), darkMode === 'on' ? tr('Dark') : darkMode === 'auto' ? tr('Auto') : tr('Light'), darkMode === 'on')}
					{wide('clock', 'timer', tr('Clock'), clockFormat === '12h' ? tr('12-hour') : clockFormat === '24h' ? tr('24-hour') : tr('Auto'), clockFormat !== 'auto')}
				</div>
				<div class="cc__row cc__row--round">
					{round('home', 'house', tr('LG Home'))}
					{round('settings', 'gear', tr('Settings'))}
					{round('art', 'picture', tr('Art mode'))}
					{round('startsaver', 'screensaver', tr('Start now'))}
					{round('screenoff', 'power', tr('Screen off'))}
					{round('restart', 'restart', tr('Restart'))}
				</div>
				<div
					class={`cc__slider${focused('volume') ? ' cc__slider--focused' : ''}`}
					onMouseEnter={() => setPos(at('volume'))}
					onClick={(e: MouseEvent) => { const box = (e.currentTarget as HTMLElement).getBoundingClientRect(); volume(Math.round(((e.clientX - box.left) / box.width) * 100)); }}
				>
					<div class="cc__fill" style={`width:${values.muted ? 0 : values.volume}%`} />
					<div class="cc__slidertext"><Glyph name={values.muted ? 'muted' : 'speaker'} /><span>{tr('Volume')}</span><span class="cc__num">{values.muted ? tr('Muted') : values.volume}</span></div>
				</div>
			</div>
		</>
	);
}
