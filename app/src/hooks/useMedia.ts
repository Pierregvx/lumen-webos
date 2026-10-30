import {useCallback, useEffect, useRef, useState} from 'preact/hooks';
import {afterFirstFrame, readCache, writeCache} from '../lib/boot';
import {cachedServer, resume, type JellyfinServer, type MediaItem} from '../lib/jellyfin';
import {cachedSeerr, myPending, type SeerrServer, type SeerrTitle} from '../lib/seerr';
import {newSeasons, type NewSeason} from '../lib/seasons';
import {isWebOS} from '../lib/luna';

export interface MediaState {
	jellyfin: JellyfinServer | null;
	seerr: SeerrServer | null;
	/** in progress and next up (Jellyfin) */
	resume: MediaItem[];
	/** asked for and not in the library yet (Seerr) */
	pending: SeerrTitle[];
	/** new seasons of the series followed (lib/seasons.ts) */
	seasons: NewSeason[];
	/** a new season was requested: it leaves the row */
	dropSeason: (tmdbId: string) => void;
	/** read the servers again (after Settings changes them) */
	refresh: () => void;
}

const CACHE_KEY = 'lumen-boot-media-v1';

/** The Resume row's titles. The last read is drawn at once on a cold start; the servers are asked again after the first frame, and each time
 *  Lumen comes back to the front (a film may have been watched since). Nothing is asked with no server set up. */
export function useMedia (autoSeasons: boolean): MediaState {
	const [jellyfin, setJellyfin] = useState<JellyfinServer | null>(cachedServer);
	const [seerr, setSeerr] = useState<SeerrServer | null>(cachedSeerr);
	const [seasons, setSeasons] = useState<NewSeason[]>([]);
	const auto = useRef(autoSeasons);
	auto.current = autoSeasons;
	const [lists, setLists] = useState<{resume: MediaItem[]; pending: SeerrTitle[]}>(() => readCache(CACHE_KEY) || {resume: [], pending: []});

	const refresh = useCallback(() => {
		const jf = cachedServer();
		const sr = cachedSeerr();
		setJellyfin(jf);
		setSeerr(sr);
		if (!jf) { setLists({resume: [], pending: []}); setSeasons([]); writeCache(CACHE_KEY, null); return; }
		if (sr) newSeasons(jf, sr, auto.current).then(setSeasons, () => undefined);
		else setSeasons([]);
		Promise.all([
			resume(jf).catch(() => null),
			sr ? myPending(sr, jf.userId).catch(() => null) : Promise.resolve([])
		]).then(([r, p]) => {
			// one that forgot the sign-in (401) has cleared it; a server that did not answer takes its row away (the cache only serves the
			// first paint), so there are no tiles pointing at a server that is off
			if (!cachedServer()) { setJellyfin(null); setLists({resume: [], pending: []}); writeCache(CACHE_KEY, null); return; }
			setLists((now) => {
				const next = {resume: r || [], pending: p || []};
				if (r) writeCache(CACHE_KEY, next);
				return JSON.stringify(next) === JSON.stringify(now) ? now : next;
			});
		});
	}, []);

	useEffect(() => {
		const cancel = isWebOS() ? afterFirstFrame(refresh) : (refresh(), () => undefined);
		const onVisibility = () => { if (!document.hidden) refresh(); };
		document.addEventListener('visibilitychange', onVisibility);
		return () => { cancel(); document.removeEventListener('visibilitychange', onVisibility); };
	}, [refresh]);

	const dropSeason = useCallback((tmdbId: string) => setSeasons((list) => list.filter((x) => x.title.tmdbId !== tmdbId)), []);
	return {jellyfin, seerr, resume: lists.resume, pending: lists.pending, seasons, dropSeason, refresh};
}
