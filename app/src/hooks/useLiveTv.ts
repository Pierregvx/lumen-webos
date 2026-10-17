import {useEffect, useRef, useState} from 'preact/hooks';
import {cachedLive, cachedLogos, readChannels, readListings, readLogos, saveLive, type Channel, type Listings, type LiveCache} from '../lib/livetv';
import {wallpaperShown} from '../lib/wallpaper';

export interface LiveTv {
	channels: Channel[];
	listings: Listings;
	/** logos as data: URIs, by path on the TV */
	logos: Record<string, string>;
	/** the current minute (ms), for progress and what is on now */
	now: number;
}

const minute = () => { const t = Date.now(); return t - (t % 60000); };
/** after the wallpaper is up: how long before the row is drawn from the cache, and then before the TV is asked */
const DRAW_AFTER_MS = 600;
const READ_AFTER_MS = 2000;
/** if the wallpaper never reports in (a picture that hangs), Live TV starts anyway */
const WALLPAPER_WAIT_MS = 10000;
const NONE: LiveCache = {channels: [], listings: {}};

/** The Live TV row's and the Guide's data. Nothing happens until the wallpaper is on screen, so a cold start draws the wallpaper and the
 *  apps first: then the last answer (and its logos) comes out of localStorage, and a moment later the TV is asked again. After that it is asked
 *  whenever the Guide opens, and when a programme on one of the first `watch` channels (the row's) ends. No timer reads the TV:
 *  the once-a-minute tick only moves the progress bars. */
export function useLiveTv (enabled: boolean, guideOpen: boolean, watch: number): LiveTv {
	const [data, setData] = useState(NONE);
	const [logos, setLogos] = useState<Record<string, string>>({});
	const [started, setStarted] = useState(false);
	const [now, setNow] = useState(minute);
	const readAt = useRef(0);
	const busy = useRef(false);
	const latest = useRef({data, watch});
	latest.current = {data, watch};

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
			.then(() => { busy.current = false; });
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
				if (!started) { setData(cachedLive()); setLogos(cachedLogos()); setStarted(true); }
				timers.push(window.setTimeout(() => refresh(true), READ_AFTER_MS));
			}, DRAW_AFTER_MS));
		};
		wallpaperShown.then(start);
		timers.push(window.setTimeout(start, WALLPAPER_WAIT_MS));
		return () => { done = true; timers.forEach((t) => window.clearTimeout(t)); };
	}, [enabled]);

	useEffect(() => { if (guideOpen && started) refresh(false); }, [guideOpen]);

	useEffect(() => {
		if (!enabled || !started) return undefined;
		const id = window.setInterval(() => {
			const t = minute();
			setNow(t);
			// a programme on a row channel ended since the last read: read the guide again
			const {data: d, watch: w} = latest.current;
			const ended = d.channels.slice(0, w).some((c) => (d.listings[c.signal] || []).some((p) => p.end > readAt.current && p.end <= Date.now()));
			if (ended && !document.hidden) refresh(false);
		}, 15000);
		return () => window.clearInterval(id);
	}, [enabled, started]);

	return {channels: data.channels, listings: data.listings, logos, now};
}
