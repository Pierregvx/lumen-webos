import {t as tr} from '../lib/i18n';
import {ScreenBackdrop} from '../components/LowerVeil';
import {Rail, type RailItem} from '../components/Rail';
import {useCallback, useEffect, useMemo, useRef, useState} from 'preact/hooks';
import {useKeys, clamp, type NavKey} from '../hooks/useKeys';
import {useOkPress} from '../hooks/useOkPress';
import {channelColor, channelLogo, clockText, findChannel, matchChannels, nowNextAt, progress, timeLeft, type Channel, type Listings} from '../lib/livetv';
import {FullGuide} from './FullGuide';
import {Glyph} from '../components/Glyph';
import {CategoryMenu} from '../components/CategoryMenu';
import {categoryLabel, inCategory} from '../lib/iptv';
import {LivePreview} from '../components/LivePreview';
import {currentChannel} from '../lib/root';
import {isWebOS} from '../lib/luna';
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
	/** dev builds: a live picture of the channel in focus (components/LivePreview.tsx) */
	preview: boolean;
	/** the preview plays its sound */
	sound: boolean;
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
/** the focused row stays this many rows from the top while the list scrolls; lower with the live preview, which floats over the last rows */
const FOCUS_AT = 2;
const FOCUS_AT_PREVIEW = 3;
/** rows drawn beyond the view either side, so a scroll never shows a gap */
const SPARE = 2;
/** typing a channel number: the digits stay on screen this long after the last one, then the next digit starts a new number */
const TYPED_MS = 2000;
const TYPED_MAX = 4;
const RAIL: RailItem[] = [
	{key: 'nownext', label: 'Now and Next', glyph: 'list'},
	{key: 'full', label: 'Full guide', glyph: 'grid'}
];

/** a remote's number key (0-9, either row of a keyboard), or -1 */
const digitOf = (e: KeyboardEvent) => (e.keyCode >= 48 && e.keyCode <= 57 ? e.keyCode - 48 : e.keyCode >= 96 && e.keyCode <= 105 ? e.keyCode - 96 : -1);

/** The Guide. Now and Next: one row per channel (number, logo, now with its times and progress, next with its start time); the Full guide
 *  is the time grid (screens/FullGuide.tsx). The rail at the left edge picks between them: Left opens it (in the Full guide,
 *  Left past the earliest programme), Up/Down and OK pick, Right goes back to the channels. The choice is kept for next time.
 *  Up from the first channel reaches the top bar: the category button (when the IPTV list has categories) and the search field, Left/Right
 *  between them, Down back to the channels. OK on the search field brings up the TV's keyboard and the list keeps only the channels whose
 *  name (or number) matches, as it is typed; Down or Back puts the keyboard away, and Back with a search clears it before it closes the
 *  Guide. Up/Down move, OK opens Live TV on the channel, OK held puts it on the Live TV row or takes it off, Back returns home. The number
 *  keys type a channel number and the list follows each digit (1 goes to 1, then 0 to 10, then 1 to 101); the digits show at the top and
 *  clear a moment after the last one. Only the rows near the view are drawn. */
export function Guide ({channels: every, groups, category, onCategory, listings, logos, now, schedule, pending, full, preview, sound, onMode, active, onOpen, inRow, onPin, browse, onClose}: Props) {
	const [focus, setFocusNow] = useState(0);
	// the Guide opens on Live TV's channel, once the TV says which it is, unless a key has moved the focus first
	const moved = useRef(false);
	const setFocus = useCallback((f: number | ((f: number) => number)) => { moved.current = true; setFocusNow(f); }, []);
	/** the top bar has the keys: the category button or the search field */
	const [head, setHead] = useState<'group' | 'search' | null>(null);
	const [menu, setMenu] = useState(false);
	const hasGroups = groups.length > 1;
	const all = useMemo(() => inCategory(every, category), [every, category]);
	const [query, setQuery] = useState('');
	const [typing, setTyping] = useState(false);
	const field = useRef<HTMLInputElement>(null);
	const channels = useMemo(() => (query ? matchChannels(all, query) : all), [all, query]);
	const [tvChannel, setTvChannel] = useState('');
	useEffect(() => { if (isWebOS()) currentChannel().then(setTvChannel, () => undefined); }, []);
	useEffect(() => {
		if (!tvChannel || moved.current) return;
		const i = channels.findIndex((c) => c.id === tvChannel);
		if (i >= 0) { moved.current = true; setFocusNow(i); }
	}, [tvChannel, channels]);
	const [onRail, setOnRail] = useState(false);
	const [railAt, setRailAt] = useState(0);
	const openRail = useCallback(() => { setRailAt(full ? 1 : 0); setOnRail(true); }, [full]);
	const last = channels.length - 1;
	const at = clamp(focus, 0, Math.max(0, last));
	const gridKeys = active && full && !onRail && !head && !menu;
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
		else if (onRail) {
			if (key === 'up' || key === 'down') setRailAt((r) => clamp(r + (key === 'up' ? -1 : 1), 0, RAIL.length - 1));
			else if (key === 'right') setOnRail(false);
		}
		else if (head === 'group') {
			if (key === 'right') setHead('search');
			else if (key === 'down') setHead(null);
		}
		else if (head === 'search') {
			if (key === 'left' && hasGroups) setHead('group');
			else if (key === 'down') setHead(null);
		}
		else if (key === 'left') openRail();
		else if (key === 'up') { if (at > 0) setFocus(at - 1); else if (all.length > 0) setHead('search'); }
		else if (key === 'down') setFocus((f) => clamp(f + 1, 0, Math.max(0, last)));
		return true;
	}, [at, last, head, onRail, openRail, query, typing, hasGroups, all, onClose]);
	useKeys(handleKey, active && !gridKeys && !menu);
	useOkPress({onPress: () => {
		if (onRail) { onMode(railAt === 1); setOnRail(false); }
		else if (head === 'group') setMenu(true);
		else if (head === 'search') startTyping();
		else if (channels[at]) onOpen(channels[at]);
	}, onLongPress: () => { if (!head && !onRail && channels[at]) onPin(channels[at]); }}, active && !gridKeys && !typing && !menu);

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

	// with the preview the list scrolls on past its end, so even the last channels stop on the fourth row, clear of the box
	const {top, from, to} = rowWindow(preview ? channels.length + IN_VIEW - FOCUS_AT_PREVIEW - 1 : channels.length, at, IN_VIEW, preview ? FOCUS_AT_PREVIEW : FOCUS_AT, SPARE);
	const t = Date.now();
	const focused = channels[at];
	const focusedLogo = focused ? channelLogo(focused, logos) || undefined : undefined;

	return (
		<div class={`screen screen--settings screen--guide${full ? ' screen--guide-full' : ''}${preview ? ' screen--guide-preview' : ''}`}>
			<ScreenBackdrop />
			<div class="guide__head">
				<h1 class="guide__title">{tr('Guide')}</h1>
				{typed && <div class={`guide__typed${typedHit ? '' : ' guide__typed--miss'}`}>{typed}</div>}
				{all.length > 0 && <div class="guide__hint">▲ {tr('Search')} · ★ {tr('Hold OK to add a channel to the Live TV row, or take it off')}</div>}
				{hasGroups && <div class={`guide__cat${head === 'group' ? ' guide__cat--focused' : ''}`} onClick={() => { setHead('group'); setMenu(true); }}>{category ? categoryLabel(category) : tr('All categories')}</div>}
				{all.length > 0 && (
					<label class={`guide__search${head === 'search' ? ' guide__search--focused' : ''}${typing ? ' guide__search--typing' : ''}`} onClick={() => { setHead('search'); startTyping(); }}>
						<span class="search-glass"><Glyph name="search" /></span>
						<input ref={field} class="guide__search-input" type="text" value={query} placeholder={tr('Search channels')}
							onInput={(e) => { setQuery((e.target as HTMLInputElement).value); setFocus(0); }}
							onKeyDown={(e) => { if (e.keyCode === 13) { e.preventDefault(); stopTyping(); setHead(null); setFocus(0); } }} />
					</label>
				)}
			</div>
			{preview && channels.length > 0 && <div class="guide__side">
				<LivePreview channel={focused} logo={focusedLogo} active={active} sound={sound} />
			</div>}
			{full && <FullGuide channels={channels} listings={schedule.listings} from={schedule.from} thin={schedule.state === 'pf'} loading={schedule.state === 'loading'} logos={logos} now={now} at={at} onAt={setFocus} active={gridKeys} onOpen={onOpen} inRow={inRow} onPin={onPin} searched={!!query} onTop={() => { if (all.length > 0) setHead('search'); }} onLeft={openRail} railOpen={onRail} onClose={() => { if (query) { setQuery(''); setFocus(0); } else onClose(); }} />}
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
						// still waiting on the guide service: placeholder blocks, and the text fades in over them when it comes
						const waiting = !on && !next && !!pending[c.signal];
						return (
							<div
								key={c.id}
								class={`guide__row${i === at && !onRail ? ' guide__row--focused' : ''}${on ? '' : ' guide__row--off'}`}
								style={{top: `${i * ROW_STEP}px`}}
								onMouseEnter={() => setFocus(i)}
								onClick={() => onOpen(c)}
							>
								<div class="guide__num">{c.number}{inRow[c.id] && <span class="guide__star">★</span>}</div>
								<div class="guide__logo" style={color ? {backgroundColor: color} : undefined}>{logo ? <img src={logo} alt="" decoding="async" /> : <span>{c.name}</span>}</div>
								{waiting
									? <div class="guide__now" key="ph"><i class="ph guide__ph-title" /><div class="guide__meta"><i class="ph guide__ph-time" /><i class="ph guide__ph-meter" /></div></div>
									: <div class="guide__now reveal" key="on">
										<div class="guide__prog">{on ? on.title : tr(next ? 'Off air' : 'No guide data')}</div>
										<div class="guide__meta">
											{on
												? <><span>{clockText(on.start)} – {clockText(on.end)}</span><span class="guide__meter"><span style={{transform: `scaleX(${progress(on, t)})`}} /></span>{i === at && <span>{timeLeft(on, t)}</span>}</>
												: next && <span>{tr('Starts at')} {clockText(next.start)}</span>}
										</div>
									</div>}
								{waiting
									? <div class="guide__next" key="ph"><i class="ph guide__ph-next" /><div class="guide__meta"><i class="ph guide__ph-start" /></div></div>
									: <div class="guide__next reveal" key="on">
										{next && <><div class="guide__prog guide__prog--next">{next.title}</div><div class="guide__meta"><span>{clockText(next.start)}</span></div></>}
									</div>}
							</div>
						);
					})}
				</div>
			</div>
			</>}
			<Rail items={RAIL} on={full ? 1 : 0} at={railAt} open={onRail} />
			{menu && <CategoryMenu channels={every} groups={groups} value={category} active={active} onPick={(g) => { onCategory(g); setMenu(false); setHead(null); setFocus(0); }} onClose={() => setMenu(false)} />}
		</div>
	);
}
