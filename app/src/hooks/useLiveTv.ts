import {useEffect, useMemo, useRef, useState} from 'preact/hooks';
import {cachedLive, cachedLogos, mergeListings, readChannels, readEventsNear, readListings, readLogos, readSchedule, rowChannels, saveLive, type Channel, type Listings, type LiveCache} from '../lib/livetv';
import {wallpaperShown} from '../lib/wallpaper';
import {bootMark, logError} from '../lib/log';
import {IPTV_PREFIX, isIptv, readIptvCategories, readIptvChannels, readIptvGuide, savedCategory, saveCategory, withCategories, type IptvCategories} from '../lib/iptv';
import {recoServer} from '../lib/recos';
import {type JellyfinServer} from '../lib/jellyfin';

export interface LiveTv {
	channels: Channel[];
	/** what the guide service read, with the TV's now and next table where it has nothing */
	listings: Listings;
	/** logos as data: URIs, by path on the TV */
	logos: Record<string, string>;
	/** the current minute (ms), for progress and what is on now */
	now: number;
	/** channels (by signal) the guide service is still to answer for in the read under way: they show "Loading…" rather than "No guide data" */
	pending: Record<string, true>;
	/** the Full guide: the grid starts at `from`. 'pf' when neither the guide service nor the schedule table could be read, so the grid holds only now and next */
	schedule: {listings: Listings; from: number; state: 'loading' | 'ready' | 'pf'; focus: (i: number) => void};
	/** The channels on screen in a list (the Guide, filtered or not, or the live player's channel list), nearest the focus first: their IPTV
	 *  guide is read once the focus rests. */
	browse: (shown: Channel[]) => void;
	/** the IPTV list's categories in its order, and the one picked ('' for every channel) */
	groups: string[];
	category: string;
	setCategory: (group: string) => void;
}

/** how far ahead the guide service is read, and so how far right the Full guide scrolls */
export const SCHEDULE_HOURS = 8;
/** read straight after start-up, with the row's channels: the first channels in the list, which the Guide shows when it opens */
const FIRST_CHANNELS = 10;
const HALF_HOUR = 1800000;
/** a channel's read is used for this long before it is read again */
const READ_STALE_MS = 30 * 60000;
/** after the guide service refuses, it is not asked again for this long */
const FAILED_WAIT_MS = 5 * 60000;
/** the cache keeps this much of the schedule, so start-up stays quick */
const CACHE_HOURS = 4;

const minute = () => { const t = Date.now(); return t - (t % 60000); };
/** after the wallpaper is up: how long before the row is drawn from the cache, and then before the TV is asked */
const DRAW_AFTER_MS = 600;
const READ_AFTER_MS = 2000;
/** if the wallpaper never reports in (a picture that hangs), Live TV starts anyway */
const WALLPAPER_WAIT_MS = 10000;
const NONE: LiveCache = {channels: [], listings: {}};
/** IPTV guide reads: a call's worth of channels (lib/iptv.ts asks Jellyfin 60 at a time), the favourites read without the Guide open, and
 *  the channels read around the Guide's focus (above and below it) */
const IPTV_BATCH = 60;
const IPTV_FAVS = 120;
const IPTV_ABOVE = 5;
const IPTV_BELOW = 25;
/** the Guide's focus has to rest this long before the channels around it are read */
const IPTV_FOCUS_WAIT_MS = 300;
/** the cache keeps this many IPTV channels (the row's and the favourites): the rest come with the first read after start-up */
const IPTV_CACHED = 150;

/** while no channel has anything on now (just after the TV is switched on the TV's table can be empty), the TV is asked again this often */
const EMPTY_RETRY_MS = 60000;

let lastLine = '';

/** how many channels have a programme on at `t` (IPTV ones left out with `aerialOnly`: they come from Jellyfin, not the TV's table) */
function onNow (listings: Listings, t: number, aerialOnly = false): number {
	let n = 0;
	for (const k in listings) if (!(aerialOnly && k.indexOf(IPTV_PREFIX) === 0) && listings[k].some((p) => p.start <= t && t < p.end)) n++;
	return n;
}

/** The new read, plus the last one's programmes not yet over for any channel the new read left out, so a thin read never blanks the row. */
function keepUnfinished (fresh: Listings, old: Listings, t: number): Listings {
	const out: Listings = {...fresh};
	for (const k in old) {
		if (out[k] && out[k].length > 0) continue;
		const left = old[k].filter((p) => p.end > t);
		if (left.length > 0) out[k] = left;
	}
	return out;
}

/** The row's channels, then the first FIRST_CHANNELS in the list: what is read before the Guide is opened. */
function firstRead (list: Channel[], rowIds: string[] | null): Channel[] {
	const row = rowChannels(list, rowIds);
	return row.concat(list.slice(0, FIRST_CHANNELS).filter((c) => row.indexOf(c) === -1));
}

/** `l` cut to programmes on between `t` and CACHE_HOURS on, for the channels in `keep` */
function forCache (l: Listings, keep: Channel[], t: number): Listings {
	const out: Listings = {};
	for (const c of keep) {
		const left = (l[c.signal] || []).filter((p) => p.end > t && p.start < t + CACHE_HOURS * 3600000);
		if (left.length > 0) out[c.signal] = left;
	}
	return out;
}

/** The Live TV row's and the Guide's data. Nothing happens until the wallpaper is on screen, so a cold start draws the wallpaper and the
 *  apps first: then the last answer (and its logos) comes out of localStorage, and a moment later the TV is asked again. Two sources: the
 *  TV's now and next table (one quick call, but empty or part filled after switch-on), and the guide service, read SCHEDULE_HOURS ahead.
 *  The guide service is read for the row's channels and the first channels in the list at start-up, and for every channel when the Guide
 *  opens, nearest the focus first. Each channel's read lasts READ_STALE_MS. */
export function useLiveTv (enabled: boolean, guideOpen: boolean, rowIds: string[] | null, jf: JellyfinServer | null): LiveTv {
	const [data, setData] = useState(NONE);
	const [logos, setLogos] = useState<Record<string, string>>({});
	const [started, setStarted] = useState(false);
	const [now, setNow] = useState(minute);
	const [groups, setGroups] = useState<string[]>([]);
	const [category, setCategoryState] = useState(savedCategory);
	/** the last categories read: a failed read keeps them */
	const categories = useRef<IptvCategories | null>(null);
	const readAt = useRef(0);
	const busy = useRef(false);
	const latest = useRef({data, rowIds, guideOpen, jf});
	latest.current = {data, rowIds, guideOpen, jf};
	/** when Jellyfin's IPTV channel list was last read: read again with the aerial one after READ_STALE_MS */
	const iptvListAt = useRef(0);
	/** IPTV guide reads: when each channel was last asked (by signal), one read at a time, and whether another was asked for meanwhile */
	const iptvAskedAt = useRef<Record<string, number>>({});
	const iptvBusy = useRef(false);
	const iptvAgain = useRef(false);
	const focusTimer = useRef(0);
	/** the IPTV channels on screen in a list (browse), read before the rest */
	const browsed = useRef<Channel[]>([]);

	// what the guide service read: listings by signal, and when each channel was last asked
	const [sch, setSch] = useState<{listings: Listings; state: 'loading' | 'ready' | 'pf'}>({listings: {}, state: 'loading'});
	const [pending, setPending] = useState<Record<string, true>>({});
	const askedAt = useRef<Record<string, number>>({});
	const schBusy = useRef(false);
	const failedAt = useRef(0);
	const focusAt = useRef(0);
	const schLatest = useRef(sch.listings);
	schLatest.current = sch.listings;

	const save = (d: LiveCache, l: Listings) => {
		const t = Date.now();
		// a few thousand IPTV channels would make the cache slow to read at start-up: it keeps the row's and the favourites, and CACHE_HOURS of their guide
		const row: Record<string, true> = {};
		rowChannels(d.channels, latest.current.rowIds).forEach((c) => { row[c.id] = true; });
		const iptv = d.channels.filter((c) => isIptv(c) && (row[c.id] || c.fav)).slice(0, IPTV_CACHED);
		const channels = d.channels.filter((c) => !isIptv(c)).concat(iptv);
		const listings: Listings = {};
		for (const c of channels) {
			const list = d.listings[c.signal];
			if (list) listings[c.signal] = isIptv(c) ? list.filter((p) => p.end > t && p.start < t + CACHE_HOURS * 3600000) : list;
		}
		saveLive({channels, listings, schedule: forCache(l, firstRead(d.channels, latest.current.rowIds), t)});
	};

	/** The IPTV channels whose guide is wanted now: the row's and the favourites, and while the Guide is open those around its focus. */
	const iptvWanted = (): Channel[] => {
		const {data: d, rowIds: ids, guideOpen: open} = latest.current;
		if (!d.channels.some(isIptv)) return [];
		const out = rowChannels(d.channels, ids).filter(isIptv).concat(d.channels.filter((c) => isIptv(c) && c.fav).slice(0, IPTV_FAVS));
		if (browsed.current.length) out.unshift(...browsed.current);
		else if (open) {
			const f = focusAt.current;
			// nearest the focus first: the ones in view and under it, then the few above
			out.unshift(...d.channels.slice(f, f + IPTV_BELOW).filter(isIptv), ...d.channels.slice(Math.max(0, f - IPTV_ABOVE), f).filter(isIptv));
		}
		return out;
	};

	/** Reads Jellyfin's guide for the wanted IPTV channels whose read is old, IPTV_BATCH a call, one call at a time, until none is left. */
	const readIptv = () => {
		if (document.hidden) return;
		if (iptvBusy.current) { iptvAgain.current = true; return; }
		const t = Date.now();
		const seen: Record<string, true> = {};
		const stale = iptvWanted().filter((c) => {
			if (seen[c.signal]) return false;
			seen[c.signal] = true;
			return t - (iptvAskedAt.current[c.signal] || 0) >= READ_STALE_MS;
		}).slice(0, IPTV_BATCH);
		if (stale.length === 0) return;
		stale.forEach((c) => { iptvAskedAt.current[c.signal] = t; });
		iptvBusy.current = true;
		const wait: Record<string, true> = {};
		stale.forEach((c) => { wait[c.signal] = true; });
		setPending((p) => ({...p, ...wait}));
		const from = t - (t % HALF_HOUR);
		readIptvGuide(latest.current.jf, stale, from, from + SCHEDULE_HOURS * 3600000).then((got) => {
			const d = latest.current.data;
			const next = {...d, listings: {...d.listings, ...got}};
			setData(next); latest.current.data = next; save(next, schLatest.current);
		}, (e: Error) => {
			// Jellyfin off or slow: these are asked again FAILED_WAIT_MS on, not on every tick
			const back = Date.now() - READ_STALE_MS + FAILED_WAIT_MS;
			stale.forEach((c) => { iptvAskedAt.current[c.signal] = back; });
			logError('guide', `IPTV guide failed: ${e.message}`);
		}).then(() => {
			iptvBusy.current = false;
			setPending((p) => { const out = {...p}; stale.forEach((c) => { delete out[c.signal]; }); return out; });
			const more = iptvAgain.current || stale.length === IPTV_BATCH;
			iptvAgain.current = false;
			if (more) readIptv();
		});
	};

	/** Ask the guide service for the channels whose read is old: every channel while the Guide is open, else the first read's. */
	const readGuide = () => {
		const {data: d, guideOpen: all} = latest.current;
		if (d.channels.length === 0 || document.hidden) return;
		const t = Date.now();
		// the Guide always asks, as it falls back to the schedule table
		if (!all && t - failedAt.current < FAILED_WAIT_MS) return;
		// IPTV channels have their guide from Jellyfin, read with the channels (refresh)
		const list = (all ? d.channels : firstRead(d.channels, latest.current.rowIds)).filter((c) => !isIptv(c));
		if (list.length === 0) return;
		const fresh = list.map((c) => t - (askedAt.current[c.signal] || 0) < READ_STALE_MS);
		if (fresh.every(Boolean)) return;
		const wait: Record<string, true> = {};
		list.forEach((c, i) => { if (!fresh[i]) wait[c.signal] = true; });
		// the Guide opened during the first read: its channels show as loading until the full read that follows
		if (schBusy.current) { if (all) setPending((p) => ({...wait, ...p})); return; }
		schBusy.current = true;
		setPending(wait);
		setSch((s) => ({...s, state: 'loading'}));
		const from = t - (t % HALF_HOUR);
		const to = from + SCHEDULE_HOURS * 3600000;
		const got = (l: Listings) => setSch((s) => ({...s, listings: {...s.listings, ...l}}));
		const part = (l: Listings, batch: Channel[]) => {
			const at = Date.now();
			batch.forEach((c) => { askedAt.current[c.signal] = at; });
			got(l);
			setPending((p) => { const out = {...p}; batch.forEach((c) => { delete out[c.signal]; }); return out; });
		};
		// the Guide closed during a full read: the rest waits for the next time it opens
		const stopped = () => all && !latest.current.guideOpen;
		readEventsNear(list, from, to, () => (all ? focusAt.current : 0), part, stopped, fresh)
			.then(() => 'ready' as const, () => {
				failedAt.current = Date.now();
				if (!all) return 'ready' as const;
				// the guide service refused: the TV's own schedule table, which is often empty after switch-on
				return readSchedule(from, to, got, stopped).then(() => 'ready' as const, () => 'pf' as const);
			})
			.then((state) => {
				schBusy.current = false;
				setPending({});
				setSch((s) => { save(latest.current.data, s.listings); return {...s, state}; });
				// the Guide may have opened while the first read ran
				if (latest.current.guideOpen && !all) readGuide();
			});
	};

	const refresh = (withChannels: boolean) => {
		if (busy.current) return;
		busy.current = true;
		readAt.current = Date.now();
		const old = latest.current.data.channels;
		const server = latest.current.jf;
		// the aerial channels and Jellyfin's IPTV ones are read apart: either failing keeps the last list of that kind
		const channels = withChannels || !old.length
			? Promise.all([
				readChannels().catch((e: Error) => { logError('guide', `channels failed: ${e.message}`); return old.filter((c) => !isIptv(c)); }),
				Promise.all([readIptvChannels(server), readIptvCategories(recoServer()).then((c) => { categories.current = c; setGroups(c.groups); }, (e: Error) => logError('guide', `IPTV categories failed: ${e.message}`))]).then(([l]) => { iptvListAt.current = Date.now(); return categories.current ? withCategories(l, categories.current) : l; }, (e: Error) => {
					// asked again FAILED_WAIT_MS on, not on every tick
					iptvListAt.current = Date.now() - READ_STALE_MS + FAILED_WAIT_MS;
					logError('guide', `IPTV channels failed: ${e.message}`);
					return server ? old.filter(isIptv) : [];
				})
			]).then(([aerial, iptv]) => aerial.concat(iptv))
			: Promise.resolve(old);
		channels
			.then((list) => {
				const iptv = list.filter(isIptv);
				return readListings().catch((e: Error) => { logError('guide', `now and next failed: ${e.message}`); return {} as Listings; }).then((aerialRead) => {
					// the IPTV guide is read apart (readIptv); what it read is kept by keepUnfinished
					const read = aerialRead;
					const t = Date.now();
					const line = `now and next: ${Object.keys(aerialRead).length} channels listed, ${onNow(aerialRead, t)} with something on now${iptv.length ? `; IPTV: ${iptv.length} channels (${iptv.filter((c) => c.fav).length} favourites)` : ''}`;
					if (line !== lastLine) { lastLine = line; logError('guide', line); }   // the retry asks every minute: log only a change
					// listings of channels no longer in the list (an IPTV channel unticked in Jellyfin) are dropped
					const kept = keepUnfinished(read, latest.current.data.listings, t);
					const signals: Record<string, true> = {};
					list.forEach((c) => { signals[c.signal] = true; });
					for (const k in kept) if (k.indexOf(IPTV_PREFIX) === 0 && !signals[k]) delete kept[k];
					const next = {channels: list, listings: kept};
					if (JSON.stringify(next) !== JSON.stringify(latest.current.data)) { setData(next); latest.current.data = next; save(next, schLatest.current); }
					readGuide();
					readIptv();
					return readLogos(list).then((l) => setLogos((was) => (Object.keys(l).length === Object.keys(was).length ? was : {...l})));
				});
			})
			.catch((e: Error) => logError('guide', `now and next failed: ${e.message}`))
			.then(() => { busy.current = false; bootMark('live-read'); });
	};

	// wait for the wallpaper, then draw from the cache, then ask the TV
	useEffect(() => {
		if (!enabled) return undefined;
		let done = false;
		const timers: number[] = [];
		const start = () => {
			if (done) return;
			done = true;
			timers.push(window.setTimeout(() => {
				if (!started) {
					const t = performance.now();
					const cached = cachedLive();
					const l = cachedLogos();
					bootMark('live-cache', `${cached.channels.length}ch ${Object.keys(l).length}logos ${Math.round(performance.now() - t)}ms`);
					setData({channels: cached.channels, listings: cached.listings});
					if (cached.schedule) setSch((s) => ({...s, listings: cached.schedule as Listings}));
					setLogos(l); setStarted(true);
				}
				timers.push(window.setTimeout(() => refresh(true), READ_AFTER_MS));
			}, DRAW_AFTER_MS));
		};
		wallpaperShown.then(start);
		timers.push(window.setTimeout(start, WALLPAPER_WAIT_MS));
		return () => { done = true; timers.forEach((t) => window.clearTimeout(t)); };
	}, [enabled]);

	useEffect(() => { if (started) bootMark('live-drawn'); }, [started]);
	// signed in or out of Jellyfin: its IPTV channels come or go
	const jfKey = jf ? jf.url + jf.token : '';
	const firstJf = useRef(true);
	useEffect(() => { if (firstJf.current) { firstJf.current = false; return; } if (started) { iptvListAt.current = 0; iptvAskedAt.current = {}; refresh(true); } }, [jfKey]);
	useEffect(() => { if (guideOpen && started) { refresh(false); readGuide(); readIptv(); } }, [guideOpen]);

	useEffect(() => {
		if (!enabled || !started) return undefined;
		const id = window.setInterval(() => {
			const t = minute();
			setNow(t);
			const {data: d, rowIds: ids} = latest.current;
			// a programme on a row channel ended since the last read of the now and next table: read it again
			const ended = rowChannels(d.channels, ids).some((c) => (d.listings[c.signal] || []).some((p) => p.end > readAt.current && p.end <= Date.now()));
			// or nothing is on anywhere (an empty table just after switch-on, or a read that failed): ask again every minute until something is
			const empty = (d.channels.length === 0 || (d.channels.some((c) => !isIptv(c)) && onNow(d.listings, Date.now(), true) === 0)) && Date.now() - readAt.current >= EMPTY_RETRY_MS;
			// Jellyfin's channel list may have changed (a channel marked as a favourite): read it again with the aerial one when due
			const iptvDue = !!latest.current.jf && Date.now() - iptvListAt.current >= READ_STALE_MS;
			if (iptvDue && !document.hidden) { refresh(true); return; }
			if ((ended || empty) && !document.hidden) refresh(d.channels.length === 0);
			else readGuide();     // reads only the channels whose read is old
			readIptv();           // the same, for the IPTV channels wanted
		}, 15000);
		return () => window.clearInterval(id);
	}, [enabled, started]);

	const listings = useMemo(() => mergeListings(sch.listings, data.listings), [sch.listings, data.listings]);
	const schedule = {listings, from: now - (now % HALF_HOUR), state: sch.state, focus: (i: number) => {
		focusAt.current = i;
		// the IPTV channels around the focus, once it rests
		window.clearTimeout(focusTimer.current);
		focusTimer.current = window.setTimeout(readIptv, IPTV_FOCUS_WAIT_MS);
	}};
	const browse = (shown: Channel[]) => {
		browsed.current = shown.filter(isIptv).slice(0, IPTV_BELOW + IPTV_ABOVE);
		window.clearTimeout(focusTimer.current);
		focusTimer.current = window.setTimeout(readIptv, IPTV_FOCUS_WAIT_MS);
	};
	const setCategory = (group: string) => { setCategoryState(group); saveCategory(group); };
	return {channels: data.channels, listings, logos, now, pending, schedule, browse, groups, category: groups.indexOf(category) >= 0 ? category : '', setCategory};
}
