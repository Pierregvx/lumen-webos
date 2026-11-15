// New seasons of the series followed (at least one episode watched in Jellyfin): a season that started airing in the last NEW_DAYS days,
// comes after every season in the library, and is not in the library or requested. An old season simply missing is not news. They lead the Resume row with a New season badge; OK requests the season, or
// Lumen requests it by itself when Settings > Films & series > Request new seasons is on (once per season, ever). Looked up at most once a
// day (cached). Where from: a plugin's catalog when one is on (the request is then the person's own, as any other from Films & series), else
// Seerr with Lumen's key (SeasonSource).
import {readCache, writeCache} from './boot';
import {followedSeries, type JellyfinServer} from './jellyfin';
import {details, request, type SeerrServer, type SeerrTitle} from './seerr';

export interface NewSeason { title: SeerrTitle; season: number }

/** where a followed series' seasons are read (`aired` and `airDate` needed) and a new one is asked */
export interface SeasonSource {
	details: (series: {tmdbId: string; jellyfinId: string; title: string}) => Promise<SeerrTitle>;
	request: (t: SeerrTitle, season: number) => Promise<true | string>;
}
export const seerrSource = (sr: SeerrServer): SeasonSource => ({
	details: (x) => details(sr, {tmdbId: x.tmdbId, type: 'tv'}),
	request: (t, season) => request(sr, t, [season])
});

/** the seasons Lumen has asked by itself: never twice, even when a declined one shows as not asked again */
const AUTO_KEY = 'seasons-auto-v1';
const autoAsked = (): string[] => readCache<string[]>(AUTO_KEY) || [];

const CACHE_KEY = 'seasons-v1';
/** how recently a season must have started to count as new */
const NEW_DAYS = 180;
/** series looked at per day, the most recently watched first */
const SERIES_MAX = 25;
const today = () => new Date().toISOString().slice(0, 10);

/** The new season of one series, if it has one. */
function newSeasonOf (t: SeerrTitle): number | null {
	const seasons = t.seasons || [];
	const have = seasons.filter((x) => x.availability !== 'none').map((x) => x.number);
	if (!have.length) return null;
	const after = Math.max.apply(null, have);
	const since = new Date(Date.now() - NEW_DAYS * 86400000).toISOString().slice(0, 10);
	// a season with any request on it (pending, declined) is not news, and is never requested twice
	const asked = t.askedSeasons || [];
	const next = seasons.filter((x) => x.number > after && x.aired && x.availability === 'none' && (x.airDate || '') >= since && asked.indexOf(x.number) === -1)[0];
	return next ? next.number : null;
}

/** one look at a time: refreshes that overlap share it, so a season is never requested twice */
let looking: Promise<NewSeason[]> | null = null;

/** Today's new seasons (from the cache when already looked up today). `auto` requests each one in Seerr as it is found. */
export function newSeasons (s: JellyfinServer, sr: SeasonSource, auto: boolean): Promise<NewSeason[]> {
	const cached = readCache<{day: string; list: NewSeason[]}>(CACHE_KEY);
	if (cached && cached.day === today()) return Promise.resolve(cached.list);
	if (looking) return looking;
	looking = look(s, sr, auto).then((list) => { looking = null; return list; }, (e: Error) => { looking = null; throw e; });
	return looking;
}

/** Forgets today's look (Settings changed): the next refresh looks again. */
export function lookAgain (): void { writeCache(CACHE_KEY, null); }

function look (s: JellyfinServer, sr: SeasonSource, auto: boolean): Promise<NewSeason[]> {
	let answered = 0;
	return followedSeries(s).then((series) => {
		const withTmdb = series.filter((x) => x.tmdbId).slice(0, SERIES_MAX);
		return Promise.all(withTmdb.map((x) => sr.details({tmdbId: x.tmdbId as string, jellyfinId: x.id, title: x.title}).then((d) => { answered++; return d; }, () => null)));
	}).then((titles) => {
		// Seerr did not answer at all: nothing is cached, so the next refresh tries again
		if (titles.length && !answered) throw new Error('Seerr is not answering');
		const found: NewSeason[] = [];
		titles.forEach((t) => {
			const n = t && newSeasonOf(t);
			if (t && n) found.push({title: t, season: n});
		});
		if (!auto) return found;
		// requested now: shown as requested in the row (from the requests list), not as new; one already asked by Lumen stays a tile
		const done = autoAsked();
		return Promise.all(found.map((f) => {
			const k = f.title.tmdbId + ':' + f.season;
			if (done.indexOf(k) >= 0) return Promise.resolve(f);
			return sr.request(f.title, f.season).then((r) => {
				if (r !== true) return f;
				writeCache(AUTO_KEY, autoAsked().concat(k).slice(-200));
				return null;
			}, () => f);
		})).then((left) => left.filter((f): f is NewSeason => !!f));
	}).then((list) => {
		writeCache(CACHE_KEY, {day: today(), list});
		return list;
	});
}

/** A new season was requested by hand: it leaves the cached list. */
export function forgetNewSeason (tmdbId: string): void {
	const cached = readCache<{day: string; list: NewSeason[]}>(CACHE_KEY);
	if (cached) writeCache(CACHE_KEY, {...cached, list: cached.list.filter((x) => x.title.tmdbId !== tmdbId)});
}
