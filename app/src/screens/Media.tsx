// Films & series (docs/plans/films-series.md): three tabs over rows of posters, with the focused title large behind them.
//  - Library: Jellyfin's Recently added, Films, Series and genre rows. OK plays.
//  - Discover (with Seerr set up): trending, popular and upcoming films, each with its status (available, requested, downloading). OK on one
//    that is not in the library requests it (a series asks which seasons).
//  - Search: one field for both. The library's copy wins when Seerr has the same title.
// Up from the first row reaches the title's buttons, Up again the tabs (Left/Right switch). Back returns home. Only the rows near the view
// load their pictures, and the large picture changes a moment after the focus stops moving.
import {useCallback, useEffect, useMemo, useRef, useState} from 'preact/hooks';
import {t as tr} from '../lib/i18n';
import {useKeys, clamp, type NavKey} from '../hooks/useKeys';
import {useOkPress} from '../hooks/useOkPress';
import {Poster} from '../components/Poster';
import {RequestPanel} from '../components/RequestPanel';
import {byGenre, byType, findByTmdb, genres, imageUrl, latest, search as searchJellyfin, type JellyfinServer, type MediaItem} from '../lib/jellyfin';
import {details, discover, request, searchSeerr, type Availability, type SeerrServer, type SeerrTitle} from '../lib/seerr';
import {openTrailer} from '../lib/play';
import {launchApp} from '../lib/launch';
import {SYSTEM_APP} from '../config/constants';
import type {MediaState} from '../hooks/useMedia';
import {cachedPicks, markPickRequested, picks as aiPicks, recoSettings} from '../lib/recos';

export type MediaTab = 'library' | 'discover' | 'search';

/** a title on a row: from the library (jf) or from Seerr (sr) */
interface Entry { key: string; title: string; reason?: string; posterUrl?: string; backdropUrl?: string; year?: number; minutes?: number; genres: string[]; rating?: number; overview?: string; jf?: MediaItem; sr?: SeerrTitle }
interface Shelf { id: string; label: string; items: Entry[] }
type Button = 'play' | 'trailer' | 'request' | 'status';

interface Props {
	state: MediaState;
	/** show Claude's picks (Settings > Films & series > For you row) */
	forYou: boolean;
	/** play a library title in Lumen's player */
	onPlay: (item: MediaItem) => void;
	active: boolean;
	onClose: () => void;
	onToast: (text: string, kind?: 'info' | 'error') => void;
}

/** poster width + gap, and a row's height with its label (keep in step with theme/media.css) */
const POSTER_STEP = 228;
const ROW_STEP = 420;
/** posters the focused one may sit from the left before the row scrolls */
const FOCUS_COL = 2;
const GENRE_ROWS = 6;
const HERO_AFTER_MS = 250;
const SEARCH_AFTER_MS = 400;

const fromJellyfin = (s: JellyfinServer, it: MediaItem): Entry => ({
	key: 'jf:' + it.id, title: it.title, posterUrl: imageUrl(s, it, 'Primary', 300) || undefined, backdropUrl: imageUrl(s, it, 'Backdrop', 1280) || undefined,
	year: it.year, minutes: it.minutes, genres: it.genres, rating: it.rating, overview: it.overview, jf: it
});
const fromSeerr = (t: SeerrTitle): Entry => ({
	key: 'sr:' + t.type + t.tmdbId, title: t.title, posterUrl: t.posterUrl, backdropUrl: t.backdropUrl, year: t.year, genres: [], rating: t.rating, overview: t.overview, sr: t
});

/** what each tab read last, kept while Lumen runs so the screen opens at once the second time; for one sign-in only */
const cache: Record<string, Shelf[]> = {};
let cacheOwner = '';

function loadLibrary (s: JellyfinServer, onPart: (list: Shelf[]) => void): void {
	const list: Shelf[] = [];
	const put = (shelf: Shelf, at: number) => {
		if (!shelf.items.length) return;
		list[at] = shelf;
		onPart(list.filter(Boolean));
	};
	const entries = (items: MediaItem[]) => items.map((it) => fromJellyfin(s, it));
	latest(s).then((items) => put({id: 'latest', label: 'Recently added', items: entries(items)}, 0), () => undefined);
	byType(s, 'Movie').then((items) => put({id: 'movies', label: 'Films', items: entries(items)}, 1), () => undefined);
	byType(s, 'Series').then((items) => put({id: 'series', label: 'Series', items: entries(items)}, 2), () => undefined);
	genres(s).then((names) => names.slice(0, GENRE_ROWS).forEach((g, i) => {
		byGenre(s, g).then((items) => put({id: 'genre:' + g, label: g, items: entries(items)}, 3 + i), () => undefined);
	}), () => undefined);
}

function loadDiscover (sr: SeerrServer, onPart: (list: Shelf[]) => void): void {
	const list: Shelf[] = [];
	const lists: {id: 'trending' | 'popular' | 'upcoming'; label: string}[] = [{id: 'trending', label: 'Trending'}, {id: 'popular', label: 'Popular films'}, {id: 'upcoming', label: 'Coming soon'}];
	lists.forEach((l, i) => discover(sr, l.id).then((titles) => {
		if (!titles.length) return;
		list[i] = {id: l.id, label: l.label, items: titles.map(fromSeerr)};
		onPart(list.filter(Boolean));
	}, () => undefined));
}

/** a Seerr status as the hero's button shows it */
const statusText = (a: Availability, percent?: number) => a === 'downloading' ? `${tr('Downloading')} · ${percent || 0} %` : tr('Requested');

export function Media ({state, forYou: showForYou, onPlay, active, onClose, onToast}: Props) {
	const s = state.jellyfin;
	const sr = state.seerr;
	const tabs = useMemo((): MediaTab[] => (sr ? ['library', 'discover', 'search'] : ['library', 'search']), [!!sr]);
	const [tab, setTab] = useState<MediaTab>('library');
	const owner = (s ? s.url + s.token : '') + '|' + (sr ? sr.url + sr.key : '');
	if (owner !== cacheOwner) { Object.keys(cache).forEach((k) => { delete cache[k]; }); cacheOwner = owner; }
	const [shelves, setShelves] = useState<Record<string, Shelf[]>>(() => ({...cache}));
	const [zone, setZone] = useState<'tabs' | 'field' | 'buttons' | 'rows'>('rows');
	const [rows, setRows] = useState<Record<string, number>>({});
	const [cols, setCols] = useState<Record<string, number>>({});
	const [button, setButton] = useState(0);
	const [hero, setHero] = useState<Entry | null>(null);
	/** Seerr's full record of the hero (seasons, trailer, fresh status) */
	const [more, setMore] = useState<SeerrTitle | null>(null);
	const [query, setQuery] = useState('');
	const [typing, setTyping] = useState(false);
	const [asking, setAsking] = useState<SeerrTitle | null>(null);
	const [failed, setFailed] = useState(false);
	const field = useRef<HTMLInputElement>(null);
	/** the latest search sent: an older one that answers later is dropped */
	const searchSeq = useRef(0);
	const [seerrDown, setSeerrDown] = useState(false);

	const show = useCallback((id: string, list: Shelf[]) => { cache[id] = list; setShelves((all) => ({...all, [id]: list})); }, []);

	useEffect(() => {
		if (!s) return undefined;
		const timer = window.setTimeout(() => { if (!cache.library) setFailed(true); }, 9000);
		loadLibrary(s, (list) => { show('library', list); setFailed(false); });
		return () => window.clearTimeout(timer);
	}, [s && s.token]);
	// Discover's first row: today's AI picks (lib/recos.ts), when a Claude key is set; worked out once a day
	const [forYou, setForYou] = useState<Shelf | null>(() => {
		const p = cachedPicks();
		return p ? {id: 'foryou', label: 'For you', items: p.map((x) => ({...fromSeerr(x.title), reason: x.reason}))} : null;
	});
	const [forYouNote, setForYouNote] = useState('');
	useEffect(() => {
		if (!showForYou || !s || !sr || tab !== 'discover' || forYou || !recoSettings().key) return;
		setForYouNote('Picking titles for you…');
		aiPicks(s, sr).then((p) => {
			// the row arrives above the shelves: the focus moves down one with them, so it stays on the same shelf
			setRows((all) => ({...all, discover: (all.discover || 0) + 1}));
			setForYou({id: 'foryou', label: 'For you', items: p.map((x) => ({...fromSeerr(x.title), reason: x.reason}))}); setForYouNote(''); },
			(e: Error) => setForYouNote(e.message));
	}, [tab, s && s.token, sr && sr.key]);

	useEffect(() => {
		if (!sr || tab !== 'discover' || cache.discover) return undefined;
		const timer = window.setTimeout(() => { if (!cache.discover) setSeerrDown(true); }, 9000);
		loadDiscover(sr, (list) => { show('discover', list); setSeerrDown(false); });
		return () => window.clearTimeout(timer);
	}, [sr && sr.key, tab]);

	// search: both servers, a moment after the last key; the library's copy of a title wins
	useEffect(() => {
		const text = query.trim();
		if (text.length < 2) { show('search', []); return undefined; }
		const timer = window.setTimeout(() => {
			const seq = ++searchSeq.current;
			Promise.all([
				s ? searchJellyfin(s, text).catch(() => [] as MediaItem[]) : Promise.resolve([] as MediaItem[]),
				sr ? searchSeerr(sr, text).catch(() => [] as SeerrTitle[]) : Promise.resolve([] as SeerrTitle[])
			]).then(([mine, theirs]) => {
				if (seq !== searchSeq.current) return;
				const have: Record<string, true> = {};
				// TMDB numbers films and series apart: match on both
				mine.forEach((it) => { if (it.tmdbId) have[(it.type === 'Movie' ? 'movie' : 'tv') + it.tmdbId] = true; });
				const items = mine.map((it) => fromJellyfin(s as JellyfinServer, it)).concat(theirs.filter((t) => !have[t.type + t.tmdbId]).map(fromSeerr));
				show('search', items.length ? [{id: 'results', label: 'Results', items}] : []);
			});
		}, SEARCH_AFTER_MS);
		return () => window.clearTimeout(timer);
	}, [query]);

	const list = useMemo(() => (tab === 'discover' && forYou && showForYou ? [forYou].concat(shelves.discover || []) : shelves[tab] || []), [tab, shelves, forYou, showForYou]);
	const r = clamp(rows[tab] || 0, 0, Math.max(0, list.length - 1));
	const shelf = list[r];
	const colKey = (sh: Shelf) => tab + ':' + sh.id;
	const c = shelf ? clamp(cols[colKey(shelf)] || 0, 0, shelf.items.length - 1) : 0;
	const item = shelf ? shelf.items[c] : undefined;

	// the large picture and its text follow the focus once it stops moving; a Seerr title then reads its full record
	useEffect(() => {
		const timer = window.setTimeout(() => {
			setHero(item || null);
			setMore(null);
			const asked = item && item.sr;
			if (asked && sr) details(sr, asked).then((d) => { if (d.tmdbId === asked.tmdbId && d.type === asked.type) setMore(d); }, () => undefined);
		}, hero ? HERO_AFTER_MS : 0);
		return () => window.clearTimeout(timer);
	}, [item && item.key]);

	const t = hero && hero.sr ? (more && more.tmdbId === hero.sr.tmdbId ? more : hero.sr) : null;
	const trailer = hero ? (hero.jf ? hero.jf.trailerYoutubeId : t && t.trailerYoutubeId) : undefined;
	const buttons = useMemo((): Button[] => {
		if (!hero) return [];
		const first: Button = hero.jf || (t && t.availability === 'available') ? 'play' : t && t.availability === 'none' ? 'request' : 'status';
		return trailer ? [first, 'trailer'] : [first];
	}, [hero, t, trailer]);

	const play = useCallback((e: Entry) => {
		if (!s) return;
		const opened = () => { onToast(tr('Opening Jellyfin: pick it there')); return new Promise<void>((done) => window.setTimeout(done, 1500)); };
		if (e.jf) { onPlay(e.jf); return; }
		if (!e.sr) return;
		const found = findByTmdb(s, e.sr.tmdbId, e.sr.type === 'tv' ? 'Series' : 'Movie', e.sr.title).catch(() => null);
		// Seerr says it is in the library but Jellyfin has no copy with that TMDB id: open Jellyfin and say so
		found.then((it) => (it ? onPlay(it) : opened().then(() => launchApp(SYSTEM_APP.jellyfin))));
	}, [s, onToast]);

	/** a title is now requested: every row showing it says so */
	const markRequested = useCallback((type: 'movie' | 'tv', tmdbId: string) => {
		setShelves((all) => {
			const next: Record<string, Shelf[]> = {};
			Object.keys(all).forEach((k) => {
				next[k] = all[k].map((sh) => ({...sh, items: sh.items.map((e) => (e.sr && e.sr.type === type && e.sr.tmdbId === tmdbId && e.sr.availability === 'none' ? {...e, sr: {...e.sr, availability: 'requested' as Availability}} : e))}));
				cache[k] = next[k];
			});
			return next;
		});
		markPickRequested(type, tmdbId);
		setForYou((f) => (f ? {...f, items: f.items.map((e) => (e.sr && e.sr.type === type && e.sr.tmdbId === tmdbId && e.sr.availability === 'none' ? {...e, sr: {...e.sr, availability: 'requested' as Availability}} : e))} : f));
		setMore((m) => (m && m.type === type && m.tmdbId === tmdbId ? {...m, availability: 'requested'} : m));
		setHero((h) => (h && h.sr && h.sr.type === type && h.sr.tmdbId === tmdbId ? {...h, sr: {...h.sr, availability: 'requested'}} : h));
		state.refresh();
	}, [state]);

	const sending = useRef('');
	const ask = useCallback((title: SeerrTitle, seasons?: number[]) => {
		if (!sr || sending.current === title.type + title.tmdbId) return;
		sending.current = title.type + title.tmdbId;
		request(sr, title, seasons).then((r) => {
			sending.current = '';
			if (r === true) { markRequested(title.type, title.tmdbId); onToast(tr('Requested') + ' · ' + title.title); }
			else onToast(tr(r), 'error');
		});
	}, [sr, markRequested, onToast]);

	/** a series: the panel needs its seasons, which only the full record has */
	const askSeasons = (title: SeerrTitle) => {
		if (title.seasons) { setAsking(title); return; }
		if (!sr) return;
		details(sr, title).then((d) => setAsking(d), () => onToast(tr('Seerr did not answer'), 'error'));
	};

	const press = (b: Button | undefined, e: Entry | null) => {
		if (!e) return;
		if (b === 'trailer' && trailer) openTrailer(trailer).catch(() => onToast(tr('Couldn\'t open YouTube'), 'error'));
		else if (b === 'play') play(e);
		else if (b === 'request' && t) { if (t.type === 'tv') askSeasons(t); else ask(t); }
		else if (b === 'status' && t) onToast(statusText(t.availability, t.percent));
	};

	const startTyping = () => { setZone('field'); setTyping(true); if (field.current) field.current.focus(); };
	const stopTyping = () => { setTyping(false); if (field.current) field.current.blur(); };

	const handleKey = useCallback((key: NavKey): boolean => {
		if (asking) return true;    // the request panel has the keys
		if (typing) {
			if (key === 'back') { stopTyping(); return true; }
			if (key === 'down') { stopTyping(); setZone(list.length ? 'rows' : 'field'); return true; }
			return false;           // the arrows move the caret, OK is the keyboard's
		}
		if (key === 'back') { onClose(); return true; }
		const below = tab === 'search' ? 'field' : hero ? 'buttons' : 'rows';
		if (zone === 'tabs') {
			if (key === 'left' || key === 'right') {
				const next = tabs[clamp(tabs.indexOf(tab) + (key === 'right' ? 1 : -1), 0, tabs.length - 1)];
				if (next !== tab) { setTab(next); setHero(null); }
			}
			else if (key === 'down') setZone(below);
			return true;
		}
		if (zone === 'field') {
			if (key === 'up') setZone('tabs');
			else if (key === 'down') setZone(hero ? 'buttons' : list.length ? 'rows' : 'field');
			return true;
		}
		if (zone === 'buttons') {
			if (key === 'up') setZone(tab === 'search' ? 'field' : 'tabs');
			else if (key === 'down') setZone(list.length ? 'rows' : 'buttons');
			else if (key === 'left' || key === 'right') setButton((b) => clamp(b + (key === 'right' ? 1 : -1), 0, buttons.length - 1));
			return true;
		}
		if (!shelf) { if (key === 'up') setZone(tab === 'search' ? 'field' : 'tabs'); return true; }
		if (key === 'up') { if (r === 0) { setButton(0); setZone(hero ? 'buttons' : tab === 'search' ? 'field' : 'tabs'); } else setRows((all) => ({...all, [tab]: r - 1})); }
		else if (key === 'down') setRows((all) => ({...all, [tab]: clamp(r + 1, 0, list.length - 1)}));
		else if (key === 'left' || key === 'right') setCols((all) => ({...all, [colKey(shelf)]: clamp(c + (key === 'right' ? 1 : -1), 0, shelf.items.length - 1)}));
		return true;
	}, [asking, typing, zone, tab, tabs, hero, buttons, list.length, shelf, r, c, onClose]);
	useKeys(handleKey, active);

	useOkPress({onPress: () => {
		if (asking || typing) return;
		if (zone === 'field') startTyping();
		else if (zone === 'buttons') press(buttons[button], hero);
		else if (zone === 'rows' && item) {
			// OK on a poster: what its first button does (play, or request one that is not in the library)
			const first: Button = item.jf || (item.sr && item.sr.availability === 'available') ? 'play' : item.sr && item.sr.availability === 'none' ? 'request' : 'status';
			if (first === 'request' && item.sr) { if (item.sr.type === 'tv') askSeasons(item.sr); else ask(item.sr); }
			else if (first === 'status' && item.sr) onToast(statusText(item.sr.availability, item.sr.percent));
			else play(item);
		}
	}, onLongPress: () => undefined}, active && !asking && !typing);

	// the hero picture: the new one fades in over the last one
	const heroUrl = hero && hero.backdropUrl || '';
	const [pictures, setPictures] = useState({now: '', under: ''});
	if (pictures.now !== heroUrl) setPictures({now: heroUrl, under: pictures.now});
	const under = pictures.under;

	const meta = hero ? [hero.year, hero.minutes ? `${Math.floor(hero.minutes / 60) ? Math.floor(hero.minutes / 60) + ' h ' : ''}${hero.minutes % 60} min` : '',
		hero.genres.slice(0, 2).join(', '), hero.rating ? `★ ${hero.rating.toFixed(1)}` : '', hero.sr ? tr(hero.sr.type === 'tv' ? 'Series' : 'Film') : ''].filter(Boolean).join(' · ') : '';
	const label = (b: Button) => b === 'play' ? '▶ ' + tr(hero && hero.jf && hero.jf.progress ? 'Resume' : 'Play')
		: b === 'trailer' ? tr('Trailer') : b === 'request' ? '+ ' + tr('Request') : t ? statusText(t.availability, t.percent) : '';
	const empty = tab === 'library' ? (!s ? 'Sign in to Jellyfin in Settings > Films & series' : failed ? 'Jellyfin is not answering' : 'Loading…')
		: tab === 'discover' ? (seerrDown ? 'Seerr is not answering' : 'Loading…') : query.trim().length < 2 ? 'Type a title' : 'Nothing found';

	return (
		<div class={`screen screen--media screen--media-${tab}`}>
			{under && <img class="media__hero" src={under} alt="" />}
			{heroUrl && <img key={heroUrl} class="media__hero media__hero--in" src={heroUrl} alt="" decoding="async" />}
			<div class="media__shade" />
			<div class="media__tabs">
				{tabs.map((x) => (
					<span key={x} class={`media-tab${x === tab ? ' media-tab--on' : ''}${zone === 'tabs' && x === tab ? ' media-tab--focused' : ''}`}
						onClick={() => { setTab(x); setHero(null); }}>{tr(x === 'library' ? 'Library' : x === 'discover' ? 'Discover' : 'Search')}</span>
				))}
			</div>
			{tab === 'search' && (
				<div class={`media-field${zone === 'field' ? ' media-field--focused' : ''}`} onClick={startTyping}>
					<input ref={field} class="media-field__input" type="text" value={query} placeholder={tr('Films and series, yours or to request')}
						autocomplete="off" autocapitalize="off" spellcheck={false}
						onInput={(e) => setQuery((e.target as HTMLInputElement).value)} onFocus={() => { setTyping(true); setZone('field'); }} onBlur={() => setTyping(false)} />
				</div>
			)}
			{hero && (
				<div class="media__info">
					<h1 class="media__title">{hero.title}</h1>
					{meta && <div class="media__meta">{meta}</div>}
					{hero.reason && <div class="media__why">✦ {hero.reason}</div>}
					{hero.overview && <p class="media__overview">{hero.overview}</p>}
					<div class="media__buttons">
						{buttons.map((b, i) => (
							<span key={b} class={`media-btn${i === 0 && b !== 'status' ? ' media-btn--primary' : ''}${zone === 'buttons' && i === button ? ' media-btn--focused' : ''}`}
								onClick={() => { setButton(i); setZone('buttons'); press(b, hero); }}>{label(b)}</span>
						))}
					</div>
				</div>
			)}
			{!list.length && <div class="media__empty">{tr(empty)}</div>}
			{tab === 'discover' && showForYou && forYouNote && <div class="media__note">{tr(forYouNote)}</div>}
			<div class="media__rows">
				<div class="media__track" style={{transform: `translateY(${-r * ROW_STEP}px)`}}>
					{list.map((sh, i) => {
						const at = i === r ? c : clamp(cols[colKey(sh)] || 0, 0, sh.items.length - 1);
						const offset = Math.max(0, at - FOCUS_COL) * POSTER_STEP;
						const near = i >= r - 1 && i <= r + 1;
						return (
							<section key={sh.id} class="media__row" style={{top: `${i * ROW_STEP}px`}}>
								<h2 class="media__label">{tr(sh.label)}</h2>
								<div class="media__strip" style={{transform: `translateX(${-offset}px)`}}>
									{sh.items.map((e, k) => (
										<Poster key={e.key} model={{key: e.key, title: e.title, imageUrl: e.posterUrl, availability: e.sr ? e.sr.availability : undefined, percent: e.sr && e.sr.percent}}
											focused={zone === 'rows' && i === r && k === at} load={near && k >= at - FOCUS_COL - 1 && k <= at + 8}
											onHover={() => { setZone('rows'); setRows((all) => ({...all, [tab]: i})); setCols((all) => ({...all, [colKey(sh)]: k})); }}
											onActivate={() => press(e.jf ? 'play' : undefined, e)} />
									))}
								</div>
							</section>
						);
					})}
				</div>
			</div>
			{asking && <RequestPanel title={asking} active={active} onRequest={(seasons) => { ask(asking, seasons); setAsking(null); }} onClose={() => setAsking(null)} />}
		</div>
	);
}
