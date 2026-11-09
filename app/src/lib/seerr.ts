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
	/** who made it (a film's directors, a series' creators), then the main actors in billing order (the full record only) */
	cast?: SeerrPerson[];
}

/** A person in the cast: their TMDB id, which opens their page, and TMDB's w185 photo (2:3, as a poster). `job` is set for who made the title. */
export interface SeerrPerson { id: string; name: string; character?: string; photoUrl?: string; job?: 'director' | 'creator' }

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
	if (!BASE.test(url)) return Promise.resolve('The address should look like http://192.0.2.20:5055, with no path');
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
	credits?: {cast?: {id?: number; name?: string; character?: string; order?: number; profilePath?: string | null}[]; crew?: RawMaker[]};
	createdBy?: RawMaker[];
	/** a person's credits only */
	genreIds?: number[]; voteCount?: number; character?: string; job?: string;
}

interface RawMaker { id?: number; name?: string; job?: string; profilePath?: string | null }

/** how many actors a title's Cast row shows */
const CAST_MAX = 20;
/** how many directors or creators come before the actors */
const MAKERS_MAX = 4;

/** Who made a title, for the head of its cast: a film's directors, a series' creators, once each. */
function makersOf (r: RawTitle, kind: 'movie' | 'tv'): SeerrPerson[] {
	const seen: Record<string, true> = {};
	const all: RawMaker[] = kind === 'tv' ? r.createdBy || [] : ((r.credits && r.credits.crew) || []).filter((p) => p.job === 'Director');
	return all.filter((p) => { if (!p.id || !p.name || seen[p.id]) return false; seen[p.id] = true; return true; }).slice(0, MAKERS_MAX)
		.map((p) => ({id: String(p.id), name: p.name || '', photoUrl: p.profilePath ? TMDB_IMAGES + 'w185' + p.profilePath : undefined, job: kind === 'tv' ? 'creator' as const : 'director' as const}));
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
		askedSeasons: info && info.requests ? info.requests.reduce((all, q) => all.concat((q.seasons || []).map((x) => x.seasonNumber)), [] as number[]) : undefined,
		cast: r.credits && r.credits.cast ? makersOf(r, type || (r.mediaType === 'tv' ? 'tv' : 'movie')).concat(r.credits.cast.filter((p) => p.id && p.name).sort((a, b) => (a.order || 0) - (b.order || 0)).slice(0, CAST_MAX)
			.map((p) => ({id: String(p.id), name: p.name || '', character: p.character || undefined, photoUrl: p.profilePath ? TMDB_IMAGES + 'w185' + p.profilePath : undefined}))) : undefined
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

// ---------- platforms and people (the same lists as Ciné Pierro's, server/src/web.ts in cine-pierro) ----------

/** A streaming service (its TMDB network for its series, its watch provider in France for its films) or a studio (its films). */
export interface Platform { id: string; name: string; logoUrl: string; network?: number; provider?: number; studio?: number }

/** TMDB's logos, made white for the dark screen (as Seerr does) */
const LOGO = TMDB_IMAGES + 'w500_filter(duotone,ffffff,bababa)';

export const PLATFORMS: Platform[] = [
	{id: 'netflix', name: 'Netflix', logoUrl: LOGO + '/wwemzKWzjKYJFfCeiB57q3r4Bcm.png', network: 213, provider: 8},
	{id: 'apple', name: 'Apple TV', logoUrl: LOGO + '/bngHRFi794mnMq34gfVcm9nDxN1.png', network: 2552, provider: 350},
	{id: 'prime', name: 'Prime Video', logoUrl: LOGO + '/w7HfLNm9CWwRmAMU58udl2L7We7.png', network: 1024, provider: 119},
	{id: 'disney', name: 'Disney+', logoUrl: LOGO + '/1edZOYAfoyZyZ3rklNSiUpXX30Q.png', network: 2739, provider: 337},
	{id: 'max', name: 'HBO Max', logoUrl: LOGO + '/nmU0UMDJB3dRRQSTUqawzF2Od1a.png', network: 49, provider: 1899},
	{id: 'canal', name: 'Canal+', logoUrl: LOGO + '/9aotxauvc9685tq9pTcRJszuT06.png', network: 285, provider: 381},
	{id: 'paramount', name: 'Paramount+', logoUrl: LOGO + '/fi83B1oztoS47xxcemFdPMhIzK.png', network: 4330, provider: 531},
	{id: 'a24', name: 'A24', logoUrl: LOGO + '/1ZXsGaFPgrgS6ZZGS37AqD5uU12.png', studio: 41077},
	{id: 'neon', name: 'NEON', logoUrl: LOGO + '/3K9wCZTyDgop3ITK1rDi6T2PckE.png', studio: 90733},
	{id: 'pixar', name: 'Pixar', logoUrl: LOGO + '/1TjvGVDMYsj6JBxOAkUHpPEwLf7.png', studio: 3},
	{id: 'ghibli', name: 'Studio Ghibli', logoUrl: LOGO + '/uFuxPEZRUcBTEiYIxjHJq62Vr77.png', studio: 10342},
	{id: 'blumhouse', name: 'Blumhouse', logoUrl: LOGO + '/rzKluDcRkIwHZK2pHsiT667A2Kw.png', studio: 3172}
];

/** a film on a streaming service with fewer TMDB votes is left out (by popularity alone, the week's unknown releases come first) */
const KNOWN_VOTES = 100;
/** a row of a platform's or a person's page: two of Seerr's pages, or forty titles */
const PAGES = 2;
const ROW_MAX = 40;
/** TMDB's talk show and news genres, and its name for a part where the person is themselves: left off a person's page */
const NOT_A_ROLE = [10763, 10767];
const AS_THEMSELVES = /\b(self|himself|herself|themselves)\b/i;

function pages (s: SeerrServer, path: string, type: 'movie' | 'tv'): Promise<SeerrTitle[]> {
	const join = path.indexOf('?') >= 0 ? '&' : '?';
	const asks: Promise<RawTitle[]>[] = [];
	for (let i = 1; i <= PAGES; i++) asks.push(call<{results?: RawTitle[]}>(s, `${path}${join}page=${i}`).then((r) => r.results || [], () => []));
	return Promise.all(asks).then((all) => all.reduce((a, b) => a.concat(b), [] as RawTitle[]).map((x) => toTitle(x, type)));
}

/** A platform's series (its own) and films (a service's in France, a studio's that are out). */
export function platformTitles (s: SeerrServer, p: Platform): Promise<{series: SeerrTitle[]; films: SeerrTitle[]}> {
	const today = new Date().toISOString().slice(0, 10);
	return Promise.all([
		p.network ? pages(s, `/discover/tv/network/${p.network}`, 'tv') : Promise.resolve([]),
		p.studio ? pages(s, `/discover/movies?studio=${p.studio}&primaryReleaseDateLte=${today}`, 'movie')
			: p.provider ? pages(s, `/discover/movies?watchProviders=${p.provider}&watchRegion=FR&voteCountGte=${KNOWN_VOTES}`, 'movie') : Promise.resolve([])
	]).then(([series, films]) => ({series, films}));
}

/** The categories, as Netflix and Canal+ have them: a genre of films or of series (TMDB's genre ids; the same as Ciné Pierro's). */
const CATEGORIES: {id: string; label: string; type: 'movie' | 'tv'; genre: number}[] = [
	{id: 'action', label: 'Action films', type: 'movie', genre: 28},
	{id: 'crime-tv', label: 'Crime series', type: 'tv', genre: 80},
	{id: 'comedy', label: 'Comedies', type: 'movie', genre: 35},
	{id: 'thriller', label: 'Thrillers', type: 'movie', genre: 53},
	{id: 'drama-tv', label: 'Drama series', type: 'tv', genre: 18},
	{id: 'scifi', label: 'Science fiction', type: 'movie', genre: 878},
	{id: 'scifi-tv', label: 'Sci-fi and fantasy series', type: 'tv', genre: 10765},
	{id: 'horror', label: 'Horror', type: 'movie', genre: 27},
	{id: 'comedy-tv', label: 'Comedy series', type: 'tv', genre: 35},
	{id: 'drama', label: 'Dramas', type: 'movie', genre: 18},
	{id: 'romance', label: 'Romance', type: 'movie', genre: 10749},
	{id: 'animation', label: 'Animation', type: 'movie', genre: 16},
	{id: 'animation-tv', label: 'Animated series', type: 'tv', genre: 16},
	{id: 'docs', label: 'Documentaries', type: 'movie', genre: 99},
	{id: 'docs-tv', label: 'Documentary series', type: 'tv', genre: 99}
];
/** a category row with fewer titles is left out (a studio has few comedies) */
const CATEGORY_MIN = 6;

export interface Category { id: string; label: string; titles: SeerrTitle[] }

/** The category rows, one page each, in order: Discover's (no platform), or a platform's (its series by its network, its films as on its
 *  page). Each row comes as it answers; one that fails or is too short does not come. */
export function categories (s: SeerrServer, p: Platform | null, onRow: (row: Category, at: number) => void): void {
	const today = new Date().toISOString().slice(0, 10);
	CATEGORIES.forEach((c, at) => {
		const path = c.type === 'tv'
			? (!p ? `/discover/tv?genre=${c.genre}` : p.network ? `/discover/tv?network=${p.network}&genre=${c.genre}` : '')
			: !p ? `/discover/movies?genre=${c.genre}&voteCountGte=${KNOWN_VOTES}`
				: p.studio ? `/discover/movies?studio=${p.studio}&genre=${c.genre}&primaryReleaseDateLte=${today}`
					: p.provider ? `/discover/movies?watchProviders=${p.provider}&watchRegion=FR&genre=${c.genre}&voteCountGte=${KNOWN_VOTES}` : '';
		if (!path) return;
		call<{results?: RawTitle[]}>(s, path).then((r) => {
			const titles = (r.results || []).map((x) => toTitle(x, c.type));
			if (titles.length >= CATEGORY_MIN) onRow({id: c.id, label: c.label, titles}, at);
		}, () => undefined);
	});
}

/** The films and series a person played in, directed or created, the best known first (TMDB's vote count), one line per title. */
export function personTitles (s: SeerrServer, id: string): Promise<{series: SeerrTitle[]; films: SeerrTitle[]}> {
	if (!/^\d{1,9}$/.test(id)) return Promise.reject(new Error('refused: person id'));
	return call<{cast?: RawTitle[]; crew?: RawTitle[]}>(s, `/person/${id}/combined_credits`).then((r) => {
		const seen: Record<string, true> = {};
		// a series counts for its creator, not for who directed one episode of it
		const made = (r.crew || []).filter((c) => c.job === (c.mediaType === 'tv' ? 'Creator' : 'Director'));
		const roles = (r.cast || []).concat(made)
			.filter((c) => (c.mediaType === 'movie' || c.mediaType === 'tv') && !(c.genreIds || []).some((g) => NOT_A_ROLE.indexOf(g) >= 0) && !AS_THEMSELVES.test(c.character || ''))
			.sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0))
			.filter((c) => { const k = String(c.mediaType) + c.id; if (seen[k]) return false; seen[k] = true; return true; })
			.map((c) => toTitle(c));
		return {films: roles.filter((x) => x.type === 'movie').slice(0, ROW_MAX), series: roles.filter((x) => x.type === 'tv').slice(0, ROW_MAX)};
	});
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
