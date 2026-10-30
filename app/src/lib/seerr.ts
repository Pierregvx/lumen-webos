// A Seerr server: what is popular, search, and requests. Seerr sends no CORS headers, but the TV does not check them for an installed app
// (docs/research/films-series-spikes.md), so it is called straight from the page with its API key. Requests are made with that key (the admin's).
import {readCache, writeCache} from './boot';
import {loggedFetch} from './log';

export interface SeerrServer { url: string; key: string }
export type Availability = 'none' | 'requested' | 'downloading' | 'available';

export interface SeerrTitle {
	tmdbId: string;
	type: 'movie' | 'tv';
	title: string;
	year?: number;
	overview?: string;
	rating?: number;
	/** TMDB w342 and w1280 */
	posterUrl?: string;
	backdropUrl?: string;
	availability: Availability;
	/** how far the download is, 0..100, while downloading */
	percent?: number;
	seasons?: {number: number; availability: Availability; aired?: boolean; airDate?: string}[];
	/** seasons with a request on them, whatever its state (pending, approved, declined) */
	askedSeasons?: number[];
	trailerYoutubeId?: string;
}

const SERVER_KEY = 'seerr-server';
const TIMEOUT_MS = 8000;
const BASE = /^https?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?$/;
const KEY = /^[A-Za-z0-9+\/=_-]{16,128}$/;
const TMDB_IMAGES = 'https://image.tmdb.org/t/p/';
/** what the home row asks for: the newest requests, of which the not-yet-available ones by this user are kept */
const REQUESTS_TAKE = 40;
const PENDING_MAX = 10;

export function cachedSeerr (): SeerrServer | null { return readCache<SeerrServer>(SERVER_KEY); }

export function saveSeerr (s: SeerrServer | null): void { writeCache(SERVER_KEY, s); }

function call<T> (s: SeerrServer, path: string, body?: object): Promise<T> {
	if (!BASE.test(s.url) || !KEY.test(s.key)) return Promise.reject(new Error('refused: seerr address or key'));
	const abort = new AbortController();
	const timer = window.setTimeout(() => abort.abort(), TIMEOUT_MS);
	const headers: Record<string, string> = {'x-api-key': s.key, accept: 'application/json'};
	if (body) headers['content-type'] = 'application/json';
	return loggedFetch(s.url + '/api/v1' + path, {method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined, signal: abort.signal})
		.then((r) => {
			if (!r.ok) throw new Error(`Seerr ${r.status}`);
			return r.json() as Promise<T>;
		})
		.then((v) => { window.clearTimeout(timer); return v; }, (e: Error) => { window.clearTimeout(timer); throw e; });
}

/** Checks the address and key (cleaned as Settings shows them). A string is a message to show. */
export function testSeerr (typed: SeerrServer): Promise<SeerrServer | string> {
	const url = (/^https?:\/\//.test(typed.url.trim()) ? typed.url.trim() : 'http://' + typed.url.trim()).replace(/\/+$/, '');
	const s = {url, key: typed.key.trim()};
	if (!BASE.test(url)) return Promise.resolve('The address should look like http://192.168.1.10:5055, with no path');
	if (!KEY.test(s.key)) return Promise.resolve('The API key is in Seerr: Settings > General');
	return call<{id: number}>(s, '/auth/me').then(() => s, (e: Error) => /40[13]/.test(e.message) ? 'Seerr refused the API key' : 'The server did not answer');
}

// ---------- titles ----------

interface RawMediaInfo {
	status?: number;
	downloadStatus?: {size?: number; sizeLeft?: number}[];
	seasons?: {seasonNumber: number; status?: number}[];
	requests?: {seasons?: {seasonNumber: number}[]}[];
}
interface RawTitle {
	id: number; mediaType?: string; title?: string; name?: string; releaseDate?: string; firstAirDate?: string; overview?: string;
	voteAverage?: number; posterPath?: string; backdropPath?: string; mediaInfo?: RawMediaInfo;
	seasons?: {seasonNumber: number; airDate?: string}[]; relatedVideos?: {site?: string; key?: string; type?: string}[];
}

/** Seerr's media status: 2 pending, 3 processing, 4 partly and 5 fully available. */
function availabilityOf (status: number | undefined, downloading: boolean): Availability {
	if (status === 4 || status === 5) return 'available';
	if (status === 3) return downloading ? 'downloading' : 'requested';
	if (status === 2) return 'requested';
	return 'none';
}

function percentOf (info: RawMediaInfo | undefined): number | undefined {
	const parts = ((info && info.downloadStatus) || []).filter((d) => d.size);
	if (!parts.length) return undefined;
	const done = parts.reduce((sum, d) => sum + (1 - (d.sizeLeft || 0) / (d.size || 1)), 0) / parts.length;
	return Math.max(0, Math.min(100, Math.round(done * 100)));
}

function toTitle (r: RawTitle, type?: 'movie' | 'tv'): SeerrTitle {
	const info = r.mediaInfo;
	const percent = percentOf(info);
	const date = r.releaseDate || r.firstAirDate;
	const trailer = (r.relatedVideos || []).filter((v) => v.site === 'YouTube' && v.type === 'Trailer' && v.key)[0];
	const seasonStatus: Record<number, number | undefined> = {};
	((info && info.seasons) || []).forEach((x) => { seasonStatus[x.seasonNumber] = x.status; });
	return {
		tmdbId: String(r.id),
		type: type || (r.mediaType === 'tv' ? 'tv' : 'movie'),
		title: r.title || r.name || '',
		year: date ? Number(date.slice(0, 4)) || undefined : undefined,
		overview: r.overview,
		rating: r.voteAverage || undefined,
		posterUrl: r.posterPath ? TMDB_IMAGES + 'w342' + r.posterPath : undefined,
		backdropUrl: r.backdropPath ? TMDB_IMAGES + 'w1280' + r.backdropPath : undefined,
		availability: availabilityOf(info && info.status, percent !== undefined),
		percent,
		seasons: r.seasons ? r.seasons.filter((x) => x.seasonNumber > 0).map((x) => ({number: x.seasonNumber, availability: availabilityOf(seasonStatus[x.seasonNumber], false),
			aired: !!x.airDate && x.airDate <= new Date().toISOString().slice(0, 10), airDate: x.airDate})) : undefined,
		trailerYoutubeId: trailer && trailer.key,
		askedSeasons: info && info.requests ? info.requests.reduce((all, q) => all.concat((q.seasons || []).map((x) => x.seasonNumber)), [] as number[]) : undefined
	};
}

const LISTS = {trending: '/discover/trending', popular: '/discover/movies', upcoming: '/discover/movies/upcoming', series: '/discover/tv'} as const;

/** A page of a discover list. People (trending has some) are left out. */
export function discover (s: SeerrServer, list: keyof typeof LISTS, page = 1): Promise<SeerrTitle[]> {
	return call<{results?: RawTitle[]}>(s, `${LISTS[list]}?page=${page}`)
		.then((r) => (r.results || []).filter((x) => x.mediaType !== 'person').map((x) => toTitle(x, list === 'trending' ? undefined : list === 'series' ? 'tv' : 'movie')));
}

/** TMDB's titles like this one (for the AI picks' candidates). */
export function similar (s: SeerrServer, t: Pick<SeerrTitle, 'tmdbId' | 'type'>): Promise<SeerrTitle[]> {
	return call<{results?: RawTitle[]}>(s, `/${t.type}/${encodeURIComponent(t.tmdbId)}/recommendations?page=1`)
		.then((r) => (r.results || []).map((x) => toTitle(x, t.type)));
}

export function searchSeerr (s: SeerrServer, text: string): Promise<SeerrTitle[]> {
	return call<{results?: RawTitle[]}>(s, `/search?query=${encodeURIComponent(text)}&page=1`)
		.then((r) => (r.results || []).filter((x) => x.mediaType === 'movie' || x.mediaType === 'tv').map((x) => toTitle(x)));
}

/** The full record: seasons for a series, the trailer, and up-to-date availability. */
export function details (s: SeerrServer, t: Pick<SeerrTitle, 'tmdbId' | 'type'>): Promise<SeerrTitle> {
	return call<RawTitle>(s, `/${t.type}/${encodeURIComponent(t.tmdbId)}`).then((r) => toTitle(r, t.type));
}

/** Requests a film, or a series' seasons (all of them when none are given). A string is a message to show. */
export function request (s: SeerrServer, t: SeerrTitle, seasons?: number[]): Promise<true | string> {
	const body = t.type === 'tv'
		? {mediaType: 'tv', mediaId: Number(t.tmdbId), seasons: seasons && seasons.length ? seasons : 'all'}
		: {mediaType: 'movie', mediaId: Number(t.tmdbId)};
	return call<object>(s, '/request', body).then(() => true as const, (e: Error) => /409/.test(e.message) ? 'Already requested' : 'Seerr did not take the request');
}

interface RawRequest { media?: {tmdbId?: number; mediaType?: string; status?: number}; requestedBy?: {jellyfinUserId?: string} }

/** The requests made by the Seerr user linked to this Jellyfin user that are not available yet, newest first, with their titles. */
export function myPending (s: SeerrServer, jellyfinUserId: string): Promise<SeerrTitle[]> {
	return call<{results?: RawRequest[]}>(s, `/request?take=${REQUESTS_TAKE}&filter=all&sort=added`).then((r) => {
		const mine = (r.results || []).filter((x) => x.media && x.media.tmdbId && x.media.status !== 4 && x.media.status !== 5 &&
			(x.requestedBy && x.requestedBy.jellyfinUserId || '').replace(/-/g, '') === jellyfinUserId.replace(/-/g, ''));
		const seen: Record<string, true> = {};
		const unique = mine.filter((x) => { const k = String(x.media!.mediaType) + x.media!.tmdbId; if (seen[k]) return false; seen[k] = true; return true; }).slice(0, PENDING_MAX);
		return Promise.all(unique.map((x) => details(s, {tmdbId: String(x.media!.tmdbId), type: x.media!.mediaType === 'tv' ? 'tv' : 'movie'}).catch(() => null)));
	}).then((list) => list.filter((t): t is SeerrTitle => !!t && t.availability !== 'available'));
}
