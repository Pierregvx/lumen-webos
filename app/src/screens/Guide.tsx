import {t as tr} from '../lib/i18n';
import {ScreenBackdrop} from '../components/LowerVeil';
import {useCallback, useEffect, useRef, useState} from 'preact/hooks';
import {useKeys, clamp, type NavKey} from '../hooks/useKeys';
import {useOkPress} from '../hooks/useOkPress';
import {channelColor, clockText, findChannel, nowNextAt, progress, timeLeft, type Channel, type Listings} from '../lib/livetv';
import {FullGuide} from './FullGuide';
import {rowWindow} from '../lib/windowedList';
import type {LiveTv} from '../hooks/useLiveTv';

interface Props {
	channels: Channel[];
	listings: Listings;
	logos: Record<string, string>;
	/** the current minute, ms */
	now: number;
	/** the Full guide's listings (useLiveTv) */
	schedule: LiveTv['schedule'];
	/** channels the guide service has still to answer for */
	pending: LiveTv['pending'];
	/** showing the Full guide rather than Now and Next */
	full: boolean;
	onMode: (full: boolean) => void;
	active: boolean;
	onOpen: (channel: Channel) => void;
	onClose: () => void;
}

/** a row's height and the space under it (keep in step with .guide__row in theme/guide.css) */
const ROW_STEP = 132;
/** rows in view at once */
const IN_VIEW = 6;
/** the focused row stays this many rows from the top while the list scrolls */
const FOCUS_AT = 2;
/** rows drawn beyond the view either side, so a scroll never shows a gap */
const SPARE = 2;
/** typing a channel number: the digits stay on screen this long after the last one, then the next digit starts a new number */
const TYPED_MS = 2000;
const TYPED_MAX = 4;

/** a remote's number key (0-9, either row of a keyboard), or -1 */
const digitOf = (e: KeyboardEvent) => (e.keyCode >= 48 && e.keyCode <= 57 ? e.keyCode - 48 : e.keyCode >= 96 && e.keyCode <= 105 ? e.keyCode - 96 : -1);

/** The Guide. Now and Next: one row per channel (number, logo, now with its times and progress, next with its start time); the Full guide
 *  is the time grid (screens/FullGuide.tsx). The switcher at the top right picks between them: Up from the first channel reaches it,
 *  Left/Right or OK on it switch, Down goes back to the channels. The choice is kept for next time. Up/Down move, OK opens Live TV on the
 *  channel, Back returns home. The number keys type a channel number and the list follows each digit (1 goes to 1, then 0 to 10, then 1 to
 *  101); the digits show at the top and clear a moment after the last one. Only the rows near the view are drawn. */
export function Guide ({channels, listings, logos, now, schedule, pending, full, onMode, active, onOpen, onClose}: Props) {
	const [focus, setFocus] = useState(0);
	const [onSwitch, setOnSwitch] = useState(false);
	const last = channels.length - 1;
	const at = clamp(focus, 0, Math.max(0, last));
	const gridKeys = active && full && !onSwitch;
	// the Full guide reads the channels near the focus first
	useEffect(() => { schedule.focus(at); }, [at]);

	const handleKey = useCallback((key: NavKey): boolean => {
		if (key === 'back') onClose();
		else if (onSwitch) {
			if (key === 'left' || key === 'right') onMode(key === 'right');
			else if (key === 'down') setOnSwitch(false);
		}
		else if (key === 'up') { if (at === 0) setOnSwitch(true); else setFocus(at - 1); }
		else if (key === 'down') setFocus((f) => clamp(f + 1, 0, Math.max(0, last)));
		return true;
	}, [at, last, onSwitch, onMode, onClose]);
	useKeys(handleKey, active && !gridKeys);
	useOkPress({onPress: () => { if (onSwitch) onMode(!full); else if (channels[at]) onOpen(channels[at]); }, onLongPress: () => undefined}, active && !gridKeys);

	const [typed, setTyped] = useState('');
	const typedRef = useRef('');
	const list = useRef(channels);
	list.current = channels;
	useEffect(() => {
		if (!active) return undefined;
		let timer = 0;
		const onKey = (e: KeyboardEvent) => {
			const d = digitOf(e);
			if (d < 0) return;
			e.preventDefault();
			const next = (typedRef.current.length >= TYPED_MAX ? '' : typedRef.current) + d;
			typedRef.current = next;
			setTyped(next);
			const i = findChannel(list.current, next);
			if (i >= 0) setFocus(i);
			window.clearTimeout(timer);
			timer = window.setTimeout(() => { typedRef.current = ''; setTyped(''); }, TYPED_MS);
		};
		window.addEventListener('keydown', onKey);
		return () => { window.clearTimeout(timer); window.removeEventListener('keydown', onKey); };
	}, [active]);
	const typedHit = typed !== '' && channels.some((c) => c.number === typed);

	const {top, from, to} = rowWindow(channels.length, at, IN_VIEW, FOCUS_AT, SPARE);
	const t = Date.now();

	return (
		<div class={`screen screen--settings screen--guide${full ? ' screen--guide-full' : ''}`}>
			<ScreenBackdrop />
			<div class="guide__head">
				<h1 class="guide__title">{tr('Guide')}</h1>
				{typed && <div class={`guide__typed${typedHit ? '' : ' guide__typed--miss'}`}>{typed}</div>}
				<div class={`guide__switch${onSwitch ? ' guide__switch--focused' : ''}`}>
					<span class={`guide__seg${full ? '' : ' guide__seg--on'}`} onClick={() => onMode(false)}>{tr('Now and Next')}</span>
					<span class={`guide__seg${full ? ' guide__seg--on' : ''}`} onClick={() => onMode(true)}>{tr('Full guide')}</span>
				</div>
			</div>
			{full && <FullGuide channels={channels} listings={schedule.listings} from={schedule.from} thin={schedule.state === 'pf'} loading={schedule.state === 'loading'} logos={logos} now={now} at={at} onAt={setFocus} active={gridKeys} onOpen={onOpen} onTop={() => setOnSwitch(true)} onClose={onClose} />}
			{!full && <>
			<div class="guide__cols">
				<span class="guide__col guide__col--now">{tr('Now')} · {clockText(now)}</span>
				<span class="guide__col guide__col--next">{tr('Next')}</span>
			</div>
			<div class="guide__view">
				{channels.length === 0 && <div class="guide__empty">{tr('No channels yet. Open Live TV once, then come back.')}</div>}
				<div class="guide__track" style={{transform: `translateY(${-top * ROW_STEP}px)`}}>
					{channels.slice(from, to).map((c, k) => {
						const i = from + k;
						const {now: on, next} = nowNextAt(listings[c.signal], t);
						const logo = c.logoPath && logos[c.logoPath];
						const color = channelColor(c.name);
						return (
							<div
								key={c.id}
								class={`guide__row${i === at ? ' guide__row--focused' : ''}${on ? '' : ' guide__row--off'}`}
								style={{top: `${i * ROW_STEP}px`}}
								onMouseEnter={() => setFocus(i)}
								onClick={() => onOpen(c)}
							>
								<div class="guide__num">{c.number}</div>
								<div class="guide__logo" style={color ? {backgroundColor: color} : undefined}>{logo ? <img src={logo} alt="" decoding="async" /> : <span>{c.name}</span>}</div>
								<div class="guide__now">
									<div class="guide__prog">{on ? on.title : tr(next ? 'Off air' : pending[c.signal] ? 'Loading…' : 'No guide data')}</div>
									<div class="guide__meta">
										{on
											? <><span>{clockText(on.start)} – {clockText(on.end)}</span><span class="guide__meter"><span style={{transform: `scaleX(${progress(on, t)})`}} /></span>{i === at && <span>{timeLeft(on, t)}</span>}</>
											: next && <span>{tr('Starts at')} {clockText(next.start)}</span>}
									</div>
								</div>
								<div class="guide__next">
									{next && <><div class="guide__prog guide__prog--next">{next.title}</div><div class="guide__meta"><span>{clockText(next.start)}</span></div></>}
								</div>
							</div>
						);
					})}
				</div>
			</div>
			</>}
		</div>
	);
}
