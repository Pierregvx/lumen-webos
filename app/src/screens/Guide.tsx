import {t as tr} from '../lib/i18n';
import {ScreenBackdrop} from '../components/LowerVeil';
import {useCallback, useEffect, useMemo, useRef, useState} from 'preact/hooks';
import {useKeys, clamp, type NavKey} from '../hooks/useKeys';
import {useOkPress} from '../hooks/useOkPress';
import {channelColor, channelLogo, clockText, findChannel, matchChannels, nowNextAt, progress, timeLeft, type Channel, type Listings} from '../lib/livetv';
import {FullGuide} from './FullGuide';
import {Glyph} from '../components/Glyph';
import {CategoryMenu} from '../components/CategoryMenu';
import {categoryLabel, inCategory} from '../lib/iptv';
import {rowWindow} from '../lib/windowedList';
import type {LiveTv} from '../hooks/useLiveTv';

interface Props {
	channels: Channel[];
	/** the IPTV list's categories, the one picked ('' for all) and picking another */
	groups: string[];
	category: string;
	onCategory: (group: string) => void;
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
	/** the channels on the Live TV row, by id: they carry a star */
	inRow: Record<string, true>;
	/** OK held on a channel: onto the Live TV row, or off it */
	onPin: (channel: Channel) => void;
	/** the channels on screen, nearest the focus first (useLiveTv browse: their IPTV guide is read) */
	browse: (shown: Channel[]) => void;
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
 *  Left/Right or OK on it switch, Down goes back to the channels. Left from Now and Next reaches the search field: OK there brings up the
 *  TV's keyboard and the list keeps only the channels whose name (or number) matches, as it is typed; Down or Back puts the keyboard
 *  away, and Back with a search clears it before it closes the Guide. The choice is kept for next time. Up/Down move, OK opens Live TV on the
 *  channel, Back returns home. The number keys type a channel number and the list follows each digit (1 goes to 1, then 0 to 10, then 1 to
 *  101); the digits show at the top and clear a moment after the last one. Only the rows near the view are drawn. */
export function Guide ({channels: every, groups, category, onCategory, listings, logos, now, schedule, pending, full, onMode, active, onOpen, inRow, onPin, browse, onClose}: Props) {
	const [focus, setFocus] = useState(0);
	/** the top bar has the keys: the search field or the switcher */
	const [head, setHead] = useState<'group' | 'search' | 'switch' | null>(null);
	const [menu, setMenu] = useState(false);
	const hasGroups = groups.length > 1;
	const all = useMemo(() => inCategory(every, category), [every, category]);
	const onSwitch = head === 'switch';
	const [query, setQuery] = useState('');
	const [typing, setTyping] = useState(false);
	const field = useRef<HTMLInputElement>(null);
	const channels = useMemo(() => (query ? matchChannels(all, query) : all), [all, query]);
	const last = channels.length - 1;
	const at = clamp(focus, 0, Math.max(0, last));
	const gridKeys = active && full && !head && !menu;
	// the channels near the focus are read first (the aerial guide by index, while the list is not filtered)
	useEffect(() => {
		if (!query) schedule.focus(at);
		browse(channels.slice(at, at + 25).concat(channels.slice(Math.max(0, at - 5), at)));
	}, [at, channels]);

	const startTyping = () => { setTyping(true); if (field.current) field.current.focus(); };
	const stopTyping = () => { setTyping(false); if (field.current) field.current.blur(); };

	const handleKey = useCallback((key: NavKey): boolean => {
		if (typing) {
			if (key === 'back') { stopTyping(); return true; }
			if (key === 'down') { stopTyping(); setHead(null); setFocus(0); return true; }
			return false;         // the arrows move the caret, OK is the keyboard's
		}
		if (key === 'back') {
			if (query) { setQuery(''); setFocus(0); }
			else onClose();
		}
		else if (head === 'group') {
			if (key === 'right') setHead('search');
			else if (key === 'down') setHead(null);
		}
		else if (head === 'search') {
			if (key === 'right') setHead('switch');
			else if (key === 'left' && hasGroups) setHead('group');
			else if (key === 'down') setHead(null);
		}
		else if (onSwitch) {
			if (key === 'left' && !full) setHead('search');
			else if (key === 'left' || key === 'right') onMode(key === 'right');
			else if (key === 'down') setHead(null);
		}
		else if (key === 'up') { if (at === 0) setHead('switch'); else setFocus(at - 1); }
		else if (key === 'down') setFocus((f) => clamp(f + 1, 0, Math.max(0, last)));
		// Left from the channels: straight into the search, keyboard up (the Full guide keeps Left for its times)
		else if (key === 'left') { setHead('search'); startTyping(); }
		return true;
	}, [at, last, head, full, query, typing, hasGroups, onMode, onClose]);
	useKeys(handleKey, active && !gridKeys && !menu);
	useOkPress({onPress: () => {
		if (head === 'group') setMenu(true);
		else if (head === 'search') startTyping();
		else if (onSwitch) onMode(!full);
		else if (channels[at]) onOpen(channels[at]);
	}, onLongPress: () => { if (!head && channels[at]) onPin(channels[at]); }}, active && !gridKeys && !typing && !menu);

	const [typed, setTyped] = useState('');
	const typedRef = useRef('');
	const list = useRef(channels);
	list.current = channels;
	useEffect(() => {
		if (!active || typing || menu) return undefined;
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
	}, [active, typing, menu]);
	const typedHit = typed !== '' && channels.some((c) => c.number === typed);

	const {top, from, to} = rowWindow(channels.length, at, IN_VIEW, FOCUS_AT, SPARE);
	const t = Date.now();

	return (
		<div class={`screen screen--settings screen--guide${full ? ' screen--guide-full' : ''}`}>
			<ScreenBackdrop />
			<div class="guide__head">
				<h1 class="guide__title">{tr('Guide')}</h1>
				{typed && <div class={`guide__typed${typedHit ? '' : ' guide__typed--miss'}`}>{typed}</div>}
				{all.length > 0 && <div class="guide__hint">{full ? '' : `◀ ${tr('Search')} · `}★ {tr('Hold OK to add a channel to the Live TV row, or take it off')}</div>}
				{hasGroups && <div class={`guide__cat${head === 'group' ? ' guide__cat--focused' : ''}`} onClick={() => { setHead('group'); setMenu(true); }}>{category ? categoryLabel(category) : tr('All categories')}</div>}
				{all.length > 0 && (
					<label class={`guide__search${head === 'search' ? ' guide__search--focused' : ''}${typing ? ' guide__search--typing' : ''}`} onClick={() => { setHead('search'); startTyping(); }}>
						<span class="search-glass"><Glyph name="search" /></span>
						<input ref={field} class="guide__search-input" type="text" value={query} placeholder={tr('Search channels')}
							onInput={(e) => { setQuery((e.target as HTMLInputElement).value); setFocus(0); }}
							onKeyDown={(e) => { if (e.keyCode === 13) { e.preventDefault(); stopTyping(); setHead(null); setFocus(0); } }} />
					</label>
				)}
				<div class={`guide__switch${onSwitch ? ' guide__switch--focused' : ''}`}>
					<span class={`guide__seg${full ? '' : ' guide__seg--on'}`} onClick={() => onMode(false)}>{tr('Now and Next')}</span>
					<span class={`guide__seg${full ? ' guide__seg--on' : ''}`} onClick={() => onMode(true)}>{tr('Full guide')}</span>
				</div>
			</div>
			{full && <FullGuide channels={channels} listings={schedule.listings} from={schedule.from} thin={schedule.state === 'pf'} loading={schedule.state === 'loading'} logos={logos} now={now} at={at} onAt={setFocus} active={gridKeys} onOpen={onOpen} inRow={inRow} onPin={onPin} searched={!!query} onTop={() => setHead('switch')} onClose={() => { if (query) { setQuery(''); setFocus(0); } else onClose(); }} />}
			{!full && <>
			<div class="guide__cols">
				<span class="guide__col guide__col--now">{tr('Now')} · {clockText(now)}</span>
				<span class="guide__col guide__col--next">{tr('Next')}</span>
			</div>
			<div class="guide__view">
				{channels.length === 0 && <div class="guide__empty">{tr(query ? 'No channel matches' : 'No channels yet. Open Live TV once, then come back.')}</div>}
				<div class="guide__track" style={{transform: `translateY(${-top * ROW_STEP}px)`}}>
					{channels.slice(from, to).map((c, k) => {
						const i = from + k;
						const {now: on, next} = nowNextAt(listings[c.signal], t);
						const logo = channelLogo(c, logos);
						const color = channelColor(c.name);
						return (
							<div
								key={c.id}
								class={`guide__row${i === at ? ' guide__row--focused' : ''}${on ? '' : ' guide__row--off'}`}
								style={{top: `${i * ROW_STEP}px`}}
								onMouseEnter={() => setFocus(i)}
								onClick={() => onOpen(c)}
							>
								<div class="guide__num">{c.number}{inRow[c.id] && <span class="guide__star">★</span>}</div>
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
			{menu && <CategoryMenu channels={every} groups={groups} value={category} active={active} onPick={(g) => { onCategory(g); setMenu(false); setHead(null); setFocus(0); }} onClose={() => setMenu(false)} />}
		</div>
	);
}
