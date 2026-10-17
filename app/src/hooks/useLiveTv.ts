import {useEffect, useRef, useState} from 'preact/hooks';
import {cachedLive, cachedLogos, mergeListings, readChannels, readListings, readLogos, readSchedule, rowChannels, saveLive, type Channel, type Listings, type LiveCache} from '../lib/livetv';
import {wallpaperShown} from '../lib/wallpaper';
import {bootMark} from '../lib/log';

export interface LiveTv {
	channels: Channel[];
	listings: Listings;
	/** logos as data: URIs, by path on the TV */
	logos: Record<string, string>;
	/** the current minute (ms), for progress and what is on now */
	now: number;
	/** the Full guide's listings: the schedule from `scheduleFrom` for SCHEDULE_HOURS, with Now and Next's where the schedule has nothing.
	 *  'pf' when the schedule could not be read, so the grid holds only now and next */
	schedule: {listings: Listings; from: number; state: 'loading' | 'ready' | 'pf'};
}

/** how far ahead the Full guide reads, and so how far right it scrolls */
export const SCHEDULE_HOURS = 8;
const HALF_HOUR = 1800000;
/** the schedule is read again when the Full guide opens this long after the last read */
const SCHEDULE_STALE_MS = 10 * 60000;

const minute = () => { const t = Date.now(); return t - (t % 60000); };
/** after the wallpaper is up: how long before the row is drawn from the cache, and then before the TV is asked */
const DRAW_AFTER_MS = 600;
const READ_AFTER_MS = 2000;
/** if the wallpaper never reports in (a picture that hangs), Live TV starts anyway */
const WALLPAPER_WAIT_MS = 10000;
const NONE: LiveCache = {channels: [], listings: {}};

/** The Live TV row's and the Guide's data. Nothing happens until the wallpaper is on screen, so a cold start draws the wallpaper and the
 *  apps first: then the last answer (and its logos) comes out of localStorage, and a moment later the TV is asked again. After that it is asked
 *  whenever the Guide opens, and when a programme on one of the row's channels (`rowIds`, see rowChannels) ends. No timer reads the TV:
 *  the once-a-minute tick only moves the progress bars. */
export function useLiveTv (enabled: boolean, guideOpen: boolean, rowIds: string[] | null, fullOpen: boolean): LiveTv {
	const [data, setData] = useState(NONE);
	const [logos, setLogos] = useState<Record<string, string>>({});
	const [started, setStarted] = useState(false);
	const [now, setNow] = useState(minute);
	const readAt = useRef(0);
	const busy = useRef(false);
	const latest = useRef({data, rowIds});
	latest.current = {data, rowIds};

	const refresh = (withChannels: boolean) => {
		if (busy.current) return;
		busy.current = true;
		readAt.current = Date.now();
		const channels = withChannels || !latest.current.data.channels.length ? readChannels() : Promise.resolve(latest.current.data.channels);
		channels
			.then((list) => readListings().then((listings) => {
				const next = {channels: list, listings};
				if (JSON.stringify(next) !== JSON.stringify(latest.current.data)) { setData(next); saveLive(next); }
				return readLogos(list).then((l) => setLogos((was) => (Object.keys(l).length === Object.keys(was).length ? was : {...l})));
			}))
			.catch(() => undefined)
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
					setData(cached); setLogos(l); setStarted(true);
				}
				timers.push(window.setTimeout(() => refresh(true), READ_AFTER_MS));
			}, DRAW_AFTER_MS));
		};
		wallpaperShown.then(start);
		timers.push(window.setTimeout(start, WALLPAPER_WAIT_MS));
		return () => { done = true; timers.forEach((t) => window.clearTimeout(t)); };
	}, [enabled]);

	useEffect(() => { if (started) bootMark('live-drawn'); }, [started]);
	useEffect(() => { if (guideOpen && started) refresh(false); }, [guideOpen]);

	// the Full guide: the schedule from the half hour now is in, read when it opens (again if the last read is old)
	const [sch, setSch] = useState<{listings: Listings; from: number; at: number; state: 'loading' | 'ready' | 'pf'}>({listings: {}, from: 0, at: 0, state: 'loading'});
	useEffect(() => {
		if (!fullOpen) return undefined;
		const t = Date.now();
		if (sch.state !== 'loading' && t - sch.at < SCHEDULE_STALE_MS) return undefined;
		let gone = false;
		const from = t - (t % HALF_HOUR);
		readSchedule(from, from + SCHEDULE_HOURS * 3600000)
			.then((listings) => ({listings, state: 'ready' as const}), () => ({listings: {}, state: 'pf' as const}))
			.then((r) => { if (!gone) setSch({...r, from, at: Date.now()}); });
		return () => { gone = true; };
	}, [fullOpen]);
	const schedule = {listings: mergeListings(sch.listings, data.listings), from: sch.from || now - (now % HALF_HOUR), state: sch.state};

	useEffect(() => {
		if (!enabled || !started) return undefined;
		const id = window.setInterval(() => {
			const t = minute();
			setNow(t);
			// a programme on a row channel ended since the last read: read the guide again
			const {data: d, rowIds: ids} = latest.current;
			const ended = rowChannels(d.channels, ids).some((c) => (d.listings[c.signal] || []).some((p) => p.end > readAt.current && p.end <= Date.now()));
			if (ended && !document.hidden) refresh(false);
		}, 15000);
		return () => window.clearInterval(id);
	}, [enabled, started]);

	return {channels: data.channels, listings: data.listings, logos, now, schedule};
}
