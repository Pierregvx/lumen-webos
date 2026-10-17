import {useEffect, useRef, useState} from 'preact/hooks';
import {afterFirstFrame} from '../lib/boot';
import {cachedLive, cachedLogos, readChannels, readListings, readLogos, saveLive, type Channel, type Listings} from '../lib/livetv';

export interface LiveTv {
	channels: Channel[];
	listings: Listings;
	/** logos as data: URIs, by path on the TV */
	logos: Record<string, string>;
	/** the current minute (ms), for progress and what is on now */
	now: number;
}

const minute = () => { const t = Date.now(); return t - (t % 60000); };

/** The Live TV row's and the Guide's data. The last answer is drawn at once on a cold start; the TV is asked again after the first frame,
 *  whenever the Guide opens, and when a programme on one of the first `watch` channels (the row's) ends. No timer reads the TV:
 *  the once-a-minute tick only moves the progress bars. */
export function useLiveTv (enabled: boolean, guideOpen: boolean, watch: number): LiveTv {
	const [data, setData] = useState(cachedLive);
	const [logos, setLogos] = useState(cachedLogos);
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

	useEffect(() => {
		if (!enabled) return undefined;
		return afterFirstFrame(() => refresh(true));
	}, [enabled]);

	useEffect(() => { if (guideOpen) refresh(false); }, [guideOpen]);

	useEffect(() => {
		if (!enabled) return undefined;
		const id = window.setInterval(() => {
			const t = minute();
			setNow(t);
			// a programme on a row channel ended since the last read: read the guide again
			const {data: d, watch: w} = latest.current;
			const ended = d.channels.slice(0, w).some((c) => (d.listings[c.signal] || []).some((p) => p.end > readAt.current && p.end <= Date.now()));
			if (ended && !document.hidden) refresh(false);
		}, 15000);
		return () => window.clearInterval(id);
	}, [enabled]);

	return {channels: data.channels, listings: data.listings, logos, now};
}
