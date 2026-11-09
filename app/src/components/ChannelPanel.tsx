// The live player's channel list (screens/LivePlayer.tsx, docs/plans/live-tv-build.md > IPTV): a panel down the left of the picture, the
// channel playing focused. Up/Down move (held, they run; CH+/CH- jump ten), OK switches to the focused channel, Right or Back closes it.
// Up from the first channel reaches the search field: OK there brings up the TV's keyboard and the list keeps only the channels whose
// name or number matches, as it is typed; Down or Back puts the keyboard away, and Back with a search clears it first. Only the rows near
// the view are drawn, so a list of thousands stays light.
import {useCallback, useEffect, useMemo, useRef, useState} from 'preact/hooks';
import {t as tr} from '../lib/i18n';
import {useKeys, clamp, type NavKey} from '../hooks/useKeys';
import {useOkPress} from '../hooks/useOkPress';
import {rowWindow} from '../lib/windowedList';
import {Glyph} from './Glyph';
import {CategoryMenu} from './CategoryMenu';
import {categoryLabel, inCategory} from '../lib/iptv';
import {channelColor, channelLogo, matchChannels, nowNextAt, progress, type Channel, type Listings} from '../lib/livetv';

interface Props {
	channels: Channel[];
	/** the channel playing: focused when the panel opens, and marked */
	current: Channel;
	listings: Listings;
	logos: Record<string, string>;
	/** the current minute, ms */
	now: number;
	/** channels the guide is still being read for */
	pending: Record<string, true>;
	active: boolean;
	onPick: (c: Channel) => void;
	/** the IPTV list's categories, the one picked ('' for all) and picking another */
	groups: string[];
	category: string;
	onCategory: (group: string) => void;
	/** the channels on screen, nearest the focus first (useLiveTv browse: their IPTV guide is read) */
	browse: (shown: Channel[]) => void;
	onClose: () => void;
}

/** a row's height and the space under it (keep in step with .chpanel__row in theme/player.css) */
const ROW_STEP = 104;
const IN_VIEW = 8;
const FOCUS_AT = 3;
const SPARE = 2;
const PAGE = 10;
/** the remote's channel keys (webOS: CH+ is PageUp, CH- is PageDown) */
const CH_KEY = {up: 33, down: 34} as const;

export function ChannelPanel ({channels: every, current, listings, logos, now, pending, active, onPick, groups, category, onCategory, browse, onClose}: Props) {
	const all = useMemo(() => inCategory(every, category), [every, category]);
	const hasGroups = groups.length > 1;
	/** on the category line, between the search and the channels, and its menu open */
	const [onGroup, setOnGroup] = useState(false);
	const [menu, setMenu] = useState(false);
	const [query, setQuery] = useState('');
	const [typing, setTyping] = useState(false);
	const [onField, setOnField] = useState(false);
	const field = useRef<HTMLInputElement>(null);
	const channels = useMemo(() => (query ? matchChannels(all, query) : all), [all, query]);
	const [focus, setFocus] = useState(() => Math.max(0, all.findIndex((c) => c.id === current.id)));
	const last = channels.length - 1;
	const at = clamp(focus, 0, Math.max(0, last));

	useEffect(() => { browse(channels.slice(at, at + 25).concat(channels.slice(Math.max(0, at - 5), at))); }, [at, channels]);

	const startTyping = () => { setTyping(true); if (field.current) field.current.focus(); };
	const stopTyping = () => { setTyping(false); if (field.current) field.current.blur(); };
	const toList = () => { stopTyping(); setOnField(false); setOnGroup(false); setFocus(0); };

	const handleKey = useCallback((key: NavKey): boolean => {
		if (typing) {
			if (key === 'back') { stopTyping(); return true; }
			if (key === 'down') { toList(); return true; }
			return false;         // the arrows move the caret, OK is the keyboard's
		}
		if (key === 'back') { if (query) { setQuery(''); setFocus(Math.max(0, all.findIndex((c) => c.id === current.id))); } else onClose(); }
		else if (key === 'right') onClose();
		// Left from the channels: straight into the search, keyboard up
		else if (key === 'left' && !onField) { setOnGroup(false); setOnField(true); startTyping(); }
		else if (onField) { if (key === 'down') { setOnField(false); setOnGroup(hasGroups); } }
		else if (onGroup) { if (key === 'up') { setOnGroup(false); setOnField(true); } else if (key === 'down') setOnGroup(false); }
		else if (key === 'up') { if (at > 0) setFocus(at - 1); else if (hasGroups) setOnGroup(true); else setOnField(true); }
		else if (key === 'down') setFocus((f) => clamp(f + 1, 0, Math.max(0, last)));
		return true;
	}, [typing, query, onField, onGroup, hasGroups, at, last, all, current.id, onClose]);
	useKeys(handleKey, active && !menu);
	useOkPress({onPress: () => {
		if (onField) startTyping();
		else if (onGroup) setMenu(true);
		else if (channels[at]) onPick(channels[at]);
	}, onLongPress: () => undefined}, active && !typing && !menu);

	useEffect(() => {
		if (!active || typing || menu) return undefined;
		const onKey = (e: KeyboardEvent) => {
			if (e.keyCode !== CH_KEY.up && e.keyCode !== CH_KEY.down) return;
			e.preventDefault();
			setOnField(false);
			setOnGroup(false);
			setFocus((f) => clamp(f + (e.keyCode === CH_KEY.down ? PAGE : -PAGE), 0, Math.max(0, last)));
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [active, typing, menu, last]);

	const {top, from, to} = rowWindow(channels.length, at, IN_VIEW, FOCUS_AT, SPARE);
	return (
		<div class="chpanel">
			<label class={`chpanel__search${onField ? ' chpanel__search--focused' : ''}`} onClick={() => { setOnField(true); startTyping(); }}>
				<span class="search-glass"><Glyph name="search" /></span>
				<input ref={field} class="chpanel__input" type="text" value={query} placeholder={tr('Search channels')}
					onInput={(e) => { setQuery((e.target as HTMLInputElement).value); setFocus(0); }}
					onKeyDown={(e) => { if (e.keyCode === 13) { e.preventDefault(); toList(); } }} />
			</label>
			<div class={`chpanel__count${onGroup ? ' chpanel__count--focused' : ''}`} onClick={() => { if (hasGroups) setMenu(true); }}>{hasGroups && <>{category ? categoryLabel(category) : tr('All categories')} · </>}{query ? `${channels.length} / ${all.length}` : `${all.length} ${tr('channels')}`}{onGroup ? ' · OK' : ` · ◀ ${tr('Search')}`}</div>
			<div class="chpanel__view">
				{channels.length === 0 && <div class="chpanel__empty">{tr('No channel matches')}</div>}
				<div class="chpanel__track" style={{transform: `translateY(${-top * ROW_STEP}px)`}}>
					{channels.slice(from, to).map((c, k) => {
						const i = from + k;
						const {now: on, next} = nowNextAt(listings[c.signal], now);
						const logo = channelLogo(c, logos);
						const color = channelColor(c.name);
						return (
							<div key={c.id} class={`chpanel__row${i === at && !onField && !onGroup ? ' chpanel__row--focused' : ''}${c.id === current.id ? ' chpanel__row--playing' : ''}`}
								style={{top: `${i * ROW_STEP}px`}} onMouseEnter={() => { setOnField(false); setOnGroup(false); setFocus(i); }} onClick={() => onPick(c)}>
								<div class="chpanel__num">{c.number}</div>
								<div class="chpanel__logo" style={color ? {backgroundColor: color} : undefined}>{logo ? <img src={logo} alt="" decoding="async" /> : <span>{c.name}</span>}</div>
								<div class="chpanel__info">
									<div class="chpanel__name">{c.name}</div>
									<div class="chpanel__prog">
										{on ? on.title : tr(next ? 'Off air' : pending[c.signal] ? 'Loading…' : 'No guide data')}
									</div>
									{on && <div class="chpanel__meter"><span style={{transform: `scaleX(${progress(on, now)})`}} /></div>}
								</div>
							</div>
						);
					})}
				</div>
			</div>
			{menu && <CategoryMenu channels={every} groups={groups} value={category} active={active} onPick={(g) => { onCategory(g); setMenu(false); setOnGroup(false); setFocus(0); }} onClose={() => setMenu(false)} />}
		</div>
	);
}
