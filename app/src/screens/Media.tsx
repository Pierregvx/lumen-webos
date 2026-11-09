// Films & series (docs/plans/films-series.md): three tabs over rows of posters, with the focused title large behind them.
//  - Library: Jellyfin's Recently added, Films, Series and genre rows.
//  - Discover (with Seerr set up): trending, popular and upcoming films, each with its status (available, requested, downloading). Request
//    on one that is not in the library asks Seerr for it (a series asks which seasons).
//  - Search: one field for both. The library's copy wins when Seerr has the same title.
//  - Platforms (Discover's row of logos) and a title's Cast (its button) open a page of their own over the tabs: a platform's series and
//    films, a title's actors, an actor's films and series. Back closes it.
// OK on a poster in any row, or Up from the first row, reaches the title's buttons (Play first, so OK twice plays); Back from them returns to
// the row. Up from the buttons reaches the tabs (Left/Right switch). Back from the rows returns home. Only the rows near the view
// load their pictures, and the large picture changes a moment after the focus stops moving.
import {useCallback, useEffect, useMemo, useRef, useState} from 'preact/hooks';
import {t as tr} from '../lib/i18n';
import {useKeys, clamp, type NavKey} from '../hooks/useKeys';
import {useRealPointer} from '../hooks/useRealPointer';
import {useOkPress} from '../hooks/useOkPress';
import {Poster} from '../components/Poster';
import {RequestPanel} from '../components/RequestPanel';
import {byGenre, byType, findByTmdb, genres, imageUrl, latest, search as searchJellyfin, type JellyfinServer, type MediaItem} from '../lib/jellyfin';
import {categories, details, discover, personTitles, platformTitles, PLATFORMS, request, searchSeerr, type Availability, type Platform, type SeerrPerson, type SeerrServer, type SeerrTitle} from '../lib/seerr';
import {openTrailer} from '../lib/play';
import {launchApp} from '../lib/launch';
import {SYSTEM_APP} from '../config/constants';
import type {MediaState} from '../hooks/useMedia';
import {cachedPicks, markPickRequested, picks as aiPicks, recoServer} from '../lib/recos';

export type MediaTab = 'library' | 'discover' | 'search';

/** a title on a row: from the library (jf) or from Seerr (sr) */
interface Entry {
	key: string; title: string; reason?: string; posterUrl?: string; backdropUrl?: string; year?: number; minutes?: number; genres: string[]; rating?: number; overview?: string;
	jf?: MediaItem; sr?: SeerrTitle;
	/** a platform's logo, or an actor: OK opens their page */
	brand?: Platform; person?: SeerrPerson;
}
interface Shelf { id: string; label: string; items: Entry[] }
/** a page opened over the tabs (a platform's, a title's cast, an actor's); its shelves are null while they load */
interface Place {
	key: string; name: string; shelves: Shelf[] | null;
	/** a platform's categories, under its shelves */
	more?: Shelf[];
	/** a platform's logo, drawn above the title in focus */
	logo?: string;
}
/** All, Films or Series: what a platform's or an actor's page keeps in its rows */
type Kind = 'all' | 'movie' | 'tv';
const KINDS: {id: Kind; label: string}[] = [{id: 'all', label: 'All'}, {id: 'movie', label: 'Films'}, {id: 'tv', label: 'Series'}];
type Button = 'play' | 'trailer' | 'request' | 'status' | 'cast';

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
const fromPerson = (p: SeerrPerson): Entry => ({key: 'pp:' + p.id + (p.job ? ':' + p.job : ''), title: p.name, posterUrl: p.photoUrl, genres: [], overview: p.job === 'director' ? tr('Director') : p.job === 'creator' ? tr('Creator') : p.character, person: p});
/** Discover's row of platforms (the same on every TV: nothing to load) */
const BRANDS: Shelf = {id: 'platforms', label: 'Platforms', items: PLATFORMS.map((p): Entry => ({key: 'pf:' + p.id, title: p.name, posterUrl: p.logoUrl, genres: [], brand: p}))};

/** a title's TMDB id and kind, from Seerr's record or the library's (an episode has none of its own) */
function tmdbOf (e: Entry | null | undefined): Pick<SeerrTitle, 'tmdbId' | 'type'> | null {
	if (!e) return null;
	if (e.sr) return e.sr;
	return e.jf && e.jf.tmdbId && e.jf.type !== 'Episode' ? {tmdbId: e.jf.tmdbId, type: e.jf.type === 'Movie' ? 'movie' : 'tv'} : null;
}

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
	// the categories after Seerr's lists, each in its place whatever order they answer in
	categories(sr, null, (row, at) => {
		list[lists.length + at] = {id: 'cat:' + row.id, label: row.label, items: row.titles.map(fromSeerr)};
		onPart(list.filter(Boolean));
	});
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
	// a poster drawn under a resting pointer (Discover opening, a row scrolling in) is not a hover
	const realPointer = useRealPointer();
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
	/** the pages opened over the tabs, the last one showing */
	const [places, setPlaces] = useState<Place[]>([]);
	const place = places.length ? places[places.length - 1] : null;
	/** each page's All, Films or Series */
	const [kinds, setKinds] = useState<Record<string, Kind>>({});
	const kind: Kind = place ? kinds[place.key] || 'all' : 'all';
	/** what the rows' positions are kept under: the tab, or the page over it with its kind */
	const view = place ? place.key + ':' + kind : tab;
	const inSearch = tab === 'search' && !place;

	const show = useCallback((id: string, list: Shelf[]) => { cache[id] = list; setShelves((all) => ({...all, [id]: list})); }, []);

	useEffect(() => {
		if (!s) return undefined;
		const timer = window.setTimeout(() => { if (!cache.library) setFailed(true); }, 9000);
		loadLibrary(s, (list) => { show('library', list); setFailed(false); });
		return () => window.clearTimeout(timer);
	}, [s && s.token]);
	// Discover's first row: the AI picks from the picks server (lib/recos.ts). The last ones kept draw at once; when they are not today's, the
	// server is asked again (it makes them each morning, so they are usually ready)
	const [forYou, setForYou] = useState<Shelf | null>(() => {
		const kept = cachedPicks();
		return kept ? {id: 'foryou', label: 'For you', items: kept.picks.map((x) => ({...fromSeerr(x.title), reason: x.reason}))} : null;
	});
	const forYouShown = useRef(!!forYou);
	const [forYouNote, setForYouNote] = useState('');
	useEffect(() => {
		if (!showForYou || !sr || tab !== 'discover' || !recoServer()) return;
		const kept = cachedPicks();
		if (kept && kept.fresh) return;
		if (!kept) setForYouNote('Picking titles for you…');
		aiPicks().then((p) => {
			// the row arrives above the shelves: the focus moves down one with them, so it stays on the same shelf
			if (!forYouShown.current) setRows((all) => ({...all, discover: (all.discover || 0) + 1}));
			forYouShown.current = true;
			setForYou({id: 'foryou', label: 'For you', items: p.map((x) => ({...fromSeerr(x.title), reason: x.reason}))}); setForYouNote(''); },
			(e: Error) => { if (!kept) setForYouNote(e.message); });
	}, [tab, sr && sr.key]);

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

	// Discover: For you, Seerr's first list, the platforms, then its other lists. The platforms are not first: only the first row reaches the
	// title's buttons. For you arriving moves every row down one, as the focus does.
	const list = useMemo(() => {
		if (place) {
			const all = place.shelves ? place.shelves.concat(place.more || []) : [];
			return kind === 'all' ? all : all.map((sh) => ({...sh, items: sh.items.filter((e) => e.sr && e.sr.type === kind)})).filter((sh) => sh.items.length > 0);
		}
		if (tab !== 'discover') return shelves[tab] || [];
		const lists = shelves.discover || [];
		return (forYou && showForYou ? [forYou] : []).concat(lists.slice(0, 1), [BRANDS], lists.slice(1));
	}, [place, kind, tab, shelves, forYou, showForYou]);
	/** the page has films and series both: All, Films and Series are offered */
	const both = useMemo(() => {
		const all = place && place.shelves ? place.shelves.concat(place.more || []) : [];
		const has = (type: 'movie' | 'tv') => all.some((sh) => sh.items.some((e) => !!e.sr && e.sr.type === type));
		return has('movie') && has('tv');
	}, [place]);
	const r = clamp(rows[view] || 0, 0, Math.max(0, list.length - 1));
	const shelf = list[r];
	const colKey = (sh: Shelf) => view + ':' + sh.id;
	const c = shelf ? clamp(cols[colKey(shelf)] || 0, 0, shelf.items.length - 1) : 0;
	const item = shelf ? shelf.items[c] : undefined;

	// the large picture and its text follow the focus once it stops moving; a Seerr title then reads its full record
	useEffect(() => {
		const timer = window.setTimeout(() => {
			setHero(item || null);
			setMore(null);
			// a library title is read too, for its cast
			const asked = tmdbOf(item);
			if (asked && sr) details(sr, asked).then((d) => { if (d.tmdbId === asked.tmdbId && d.type === asked.type) setMore(d); }, () => undefined);
		}, hero ? HERO_AFTER_MS : 0);
		return () => window.clearTimeout(timer);
	}, [item && item.key]);

	const t = hero && hero.sr ? (more && more.tmdbId === hero.sr.tmdbId ? more : hero.sr) : null;
	const trailer = hero ? (hero.jf ? hero.jf.trailerYoutubeId : t && t.trailerYoutubeId) : undefined;
	const heroRef = tmdbOf(hero);
	const cast = more && heroRef && more.tmdbId === heroRef.tmdbId && more.type === heroRef.type ? more.cast : undefined;
	const buttons = useMemo((): Button[] => {
		if (!hero || hero.brand || hero.person) return [];
		const first: Button = hero.jf || (t && t.availability === 'available') ? 'play' : t && t.availability === 'none' ? 'request' : 'status';
		const list: Button[] = trailer ? [first, 'trailer'] : [first];
		// Cast sits with the other buttons on every title Seerr knows; a title with no actors says so on press
		return tmdbOf(hero) ? list.concat('cast') : list;
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
		const asked = (sh: Shelf): Shelf => ({...sh, items: sh.items.map((e) => (e.sr && e.sr.type === type && e.sr.tmdbId === tmdbId && e.sr.availability === 'none' ? {...e, sr: {...e.sr, availability: 'requested' as Availability}} : e))});
		setPlaces((all) => all.map((p) => ({...p, shelves: p.shelves ? p.shelves.map(asked) : null, more: p.more ? p.more.map(asked) : undefined})));
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

	/** a page over the tabs: shown at once (its shelves, or Loading…), filled when they come */
	const openPlace = (key: string, name: string, now: Shelf[] | null, later?: Promise<Shelf[]>, logo?: string) => {
		setPlaces((all) => all.filter((p) => p.key !== key).concat({key, name, shelves: now, logo}));
		setRows((all) => ({...all, [key]: 0}));
		setZone('rows');
		setHero(null);
		setButton(0);
		if (later) later.then((list) => setPlaces((all) => all.map((p) => (p.key === key ? {...p, shelves: list} : p))), () => {
			onToast(tr('Seerr did not answer'), 'error');
			setPlaces((all) => all.filter((p) => p.key !== key));
		});
	};
	const closePlace = () => { setPlaces((all) => all.slice(0, -1)); setHero(null); setZone('rows'); };
	const rowsOf = (first: {id: string; label: string; titles: SeerrTitle[]}, second: {id: string; label: string; titles: SeerrTitle[]}): Shelf[] =>
		[first, second].filter((x) => x.titles.length).map((x) => ({id: x.id, label: x.label, items: x.titles.map(fromSeerr)}));
	/** OK on a platform's logo or an actor: their page */
	const openEntry = (e: Entry) => {
		if (!sr) return;
		if (e.brand) {
			const key = e.key;
			openPlace(key, e.brand.name, null, platformTitles(sr, e.brand).then((x) => rowsOf({id: 'series', label: 'Series', titles: x.series}, {id: 'films', label: 'Films', titles: x.films})), e.brand.logoUrl);
			// its categories under its series and films, as they come (the page stays open while they do)
			const rows: Shelf[] = [];
			categories(sr, e.brand, (row, at) => {
				rows[at] = {id: 'cat:' + row.id, label: row.label, items: row.titles.map(fromSeerr)};
				setPlaces((all) => all.map((p) => (p.key === key ? {...p, more: rows.filter(Boolean)} : p)));
			});
		}
		else if (e.person) openPlace(e.key, e.person.name, null, personTitles(sr, e.person.id).then((x) => rowsOf({id: 'films', label: 'Films', titles: x.films}, {id: 'series', label: 'Series', titles: x.series})));
	};

	const press = (b: Button | undefined, e: Entry | null) => {
		if (!e) return;
		if (e.brand || e.person) openEntry(e);
		else if (b === 'cast') {
			if (cast && cast.length) openPlace('cast:' + e.key, e.title, [{id: 'cast', label: 'Cast', items: cast.map(fromPerson)}]);
			else onToast(tr('No cast listed for this title'));
		}
		else if (b === 'trailer' && trailer) openTrailer(trailer).catch(() => onToast(tr('Couldn\'t open YouTube'), 'error'));
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
		if (key === 'back') {
			if (zone === 'buttons' && list.length) setZone('rows');
			else if (place) closePlace();
			else onClose();
			return true;
		}
		const below = inSearch ? 'field' : buttons.length ? 'buttons' : 'rows';
		if (zone === 'tabs') {
			// a page's All, Films and Series switch as the tabs do (a page with one kind, or a cast, has only its name: nothing to switch)
			if ((key === 'left' || key === 'right') && place) {
				if (both) {
					const next = KINDS[clamp(KINDS.map((k) => k.id).indexOf(kind) + (key === 'right' ? 1 : -1), 0, KINDS.length - 1)].id;
					// the hero follows the new first title by itself (it stays when that is the same title)
					if (next !== kind) setKinds((all) => ({...all, [place.key]: next}));
				}
			}
			else if (key === 'left' || key === 'right') {
				const next = tabs[clamp(tabs.indexOf(tab) + (key === 'right' ? 1 : -1), 0, tabs.length - 1)];
				if (next !== tab) { setTab(next); setHero(null); }
			}
			else if (key === 'down') setZone(below);
			return true;
		}
		if (zone === 'field') {
			if (key === 'up') setZone('tabs');
			else if (key === 'down') setZone(buttons.length ? 'buttons' : list.length ? 'rows' : 'field');
			return true;
		}
		if (zone === 'buttons') {
			if (key === 'up') setZone(inSearch ? 'field' : 'tabs');
			else if (key === 'down') setZone(list.length ? 'rows' : 'buttons');
			else if (key === 'left' || key === 'right') setButton((b) => clamp(b + (key === 'right' ? 1 : -1), 0, buttons.length - 1));
			return true;
		}
		if (!shelf) { if (key === 'up') setZone(inSearch ? 'field' : 'tabs'); return true; }
		if (key === 'up') { if (r === 0) { setButton(0); setZone(buttons.length ? 'buttons' : inSearch ? 'field' : 'tabs'); } else setRows((all) => ({...all, [view]: r - 1})); }
		else if (key === 'down') setRows((all) => ({...all, [view]: clamp(r + 1, 0, list.length - 1)}));
		else if (key === 'left' || key === 'right') setCols((all) => ({...all, [colKey(shelf)]: clamp(c + (key === 'right' ? 1 : -1), 0, shelf.items.length - 1)}));
		return true;
	}, [asking, typing, zone, tab, tabs, hero, buttons, list.length, shelf, r, c, onClose, place, view, inSearch, both, kind]);
	useKeys(handleKey, active);

	useOkPress({onPress: () => {
		if (asking || typing) return;
		if (zone === 'field') startTyping();
		else if (zone === 'buttons') press(buttons[button], hero);
		else if (zone === 'rows' && item && (item.brand || item.person)) openEntry(item);
		else if (zone === 'rows' && item) {
			// OK on a poster, in any row: its buttons in the hero (Play first, so OK twice plays); Back returns to the row
			if (!hero || hero.key !== item.key) setHero(item);
			setButton(0);
			setZone('buttons');
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
		: b === 'trailer' ? tr('Trailer') : b === 'cast' ? tr('Cast') : b === 'request' ? '+ ' + tr('Request') : t ? statusText(t.availability, t.percent) : '';
	const empty = place ? (place.shelves ? 'Nothing found' : 'Loading…') : tab === 'library' ? (!s ? 'Sign in to Jellyfin in Settings > Films & series' : failed ? 'Jellyfin is not answering' : 'Loading…')
		: tab === 'discover' ? (seerrDown ? 'Seerr is not answering' : 'Loading…') : query.trim().length < 2 ? 'Type a title' : 'Nothing found';

	return (
		<div class={`screen screen--media screen--media-${tab}`}>
			{under && <img class="media__hero" src={under} alt="" />}
			{heroUrl && <img key={heroUrl} class="media__hero media__hero--in" src={heroUrl} alt="" decoding="async" />}
			<div class="media__shade" />
			<div class="media__tabs">
				{place && !both && <span class={`media-tab media-tab--on${zone === 'tabs' ? ' media-tab--focused' : ''}`} onClick={closePlace}>{place.name}</span>}
				{/* an actor's name stays beside All, Films and Series; a platform has its logo on the title instead */}
				{place && both && !place.logo && <span class="media-tab media-tab--name">{place.name}</span>}
				{place && both && KINDS.map((k) => (
					<span key={k.id} class={`media-tab${k.id === kind ? ' media-tab--on' : ''}${zone === 'tabs' && k.id === kind ? ' media-tab--focused' : ''}`}
						onClick={() => setKinds((all) => ({...all, [place.key]: k.id}))}>{tr(k.label)}</span>
				))}
				{!place && tabs.map((x) => (
						<span key={x} class={`media-tab${x === tab ? ' media-tab--on' : ''}${zone === 'tabs' && x === tab ? ' media-tab--focused' : ''}`}
							onClick={() => { setTab(x); setHero(null); }}>{tr(x === 'library' ? 'Library' : x === 'discover' ? 'Discover' : 'Search')}</span>
					))}
			</div>
			{inSearch && (
				<div class={`media-field${zone === 'field' ? ' media-field--focused' : ''}`} onClick={startTyping}>
					<input ref={field} class="media-field__input" type="text" value={query} placeholder={tr('Films and series, yours or to request')}
						autocomplete="off" autocapitalize="off" spellcheck={false}
						onInput={(e) => setQuery((e.target as HTMLInputElement).value)} onFocus={() => { setTyping(true); setZone('field'); }} onBlur={() => setTyping(false)} />
				</div>
			)}
			{hero && (
				<div class="media__info">
					{place && place.logo && <img class="media__logo" src={place.logo} alt="" decoding="async" />}
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
			{tab === 'discover' && !place && showForYou && forYouNote && <div class="media__note">{tr(forYouNote)}</div>}
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
										<Poster key={e.key} model={{key: e.key, title: e.title, imageUrl: e.posterUrl, availability: e.sr ? e.sr.availability : undefined, percent: e.sr && e.sr.percent, logo: !!e.brand}}
											focused={zone === 'rows' && i === r && k === at} load={near && k >= at - FOCUS_COL - 1 && k <= at + 8}
											onHover={() => { if (!realPointer.current) return; setZone('rows'); setRows((all) => ({...all, [view]: i})); setCols((all) => ({...all, [colKey(sh)]: k})); }}
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
