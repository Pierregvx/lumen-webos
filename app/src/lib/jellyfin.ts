// A Jellyfin server on the home network: what is in progress, the library, search, and images. Called straight from the page, since Jellyfin
// answers cross-origin requests (and the TV does not check them for an installed app, docs/research/films-series-spikes.md). Sign-in is by
// Quick Connect (a code approved in Jellyfin on a phone) or by user and password; only the token is kept, never the password.
import {APP_ID} from '../config/constants';
import {readCache, writeCache} from './boot';
import {loggedFetch} from './log';

export interface JellyfinServer { url: string; userId: string; token: string; deviceId: string }

export interface MediaItem {
	id: string;
	type: 'Movie' | 'Series' | 'Episode';
	title: string;
	/** an episode's "S2 E4 · Its title" */
	subtitle?: string;
	year?: number;
	minutes?: number;
	genres: string[];
	rating?: number;
	overview?: string;
	/** 0..1, for the Resume row */
	progress?: number;
	/** watched to the end (a series: every episode) */
	played?: boolean;
	/** when it was last watched (ISO), for spotting what was just finished */
	lastPlayed?: string;
	/** a series' episodes not watched yet */
	unplayed?: number;
	resumeTicks?: number;
	seriesId?: string;
	tmdbId?: string;
	trailerYoutubeId?: string;
	/** the item whose Backdrop, Thumb and Primary images stand for this one (an episode borrows its series'), when it has any */
	backdropOf?: string;
	thumbOf?: string;
	primaryOf?: string;
}

const SERVER_KEY = 'jellyfin-server';
const TIMEOUT_MS = 8000;
const CLIENT_VERSION = '2.0';
const FIELDS = 'Overview,Genres,ProviderIds,RemoteTrailers,UserData';
/** an address as typed: scheme, host and port, no path */
const BASE = /^https?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?$/;

/** The server as last signed in, or null. */
export function cachedServer (): JellyfinServer | null { return readCache<JellyfinServer>(SERVER_KEY); }

export function saveServer (s: JellyfinServer | null): void { writeCache(SERVER_KEY, s); }

/** Signs out: the server ends the token (best effort, the server may be off), and Lumen forgets it. */
export function signOut (): Promise<void> {
	const s = cachedServer();
	saveServer(null);
	if (!s) return Promise.resolve();
	return call<void>(s.url, '/Sessions/Logout', {token: s.token, device: s.deviceId, method: 'POST'}).catch(() => undefined);
}

/** The address as typed, cleaned: http:// added when left out, a trailing slash dropped. Null when it is not an address. */
export function cleanUrl (typed: string): string | null {
	const url = (/^https?:\/\//.test(typed.trim()) ? typed.trim() : 'http://' + typed.trim()).replace(/\/+$/, '');
	return BASE.test(url) ? url : null;
}

function deviceId (): string {
	const known = readCache<string>('jellyfin-device');
	if (known) return known;
	const made = APP_ID + '-' + Math.random().toString(36).slice(2, 10);
	writeCache('jellyfin-device', made);
	return made;
}

function authHeader (device: string, token?: string): string {
	return `MediaBrowser Client="Lumen", Device="LG TV", DeviceId="${device}", Version="${CLIENT_VERSION}"` + (token ? `, Token="${token}"` : '');
}

/** One request with the 8 s limit. A 401 with a saved server forgets it, so the Resume row goes and Settings says Not connected. */
function call<T> (url: string, path: string, opts: {token?: string; device?: string; method?: string; body?: object} = {}): Promise<T> {
	const abort = new AbortController();
	const timer = window.setTimeout(() => abort.abort(), TIMEOUT_MS);
	const headers: Record<string, string> = {Authorization: authHeader(opts.device || deviceId(), opts.token)};
	if (opts.body) headers['Content-Type'] = 'application/json';
	return loggedFetch(url + path, {method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined, signal: abort.signal})
		.then((r) => {
			if (r.status === 401 && opts.token) {
				const s = cachedServer();
				if (s && s.token === opts.token) saveServer(null);
			}
			if (!r.ok) throw new Error(`Jellyfin ${r.status}`);
			return r.status === 204 ? (undefined as unknown as T) : r.json() as Promise<T>;
		})
		.then((v) => { window.clearTimeout(timer); return v; }, (e: Error) => { window.clearTimeout(timer); throw e; });
}

interface AuthResult { AccessToken: string; User: {Id: string} }

function signedIn (url: string, device: string, r: AuthResult): JellyfinServer {
	return {url, userId: r.User.Id, token: r.AccessToken, deviceId: device};
}

/** Signs in with a user name and password. A string is a message to show. */
export function signIn (typed: string, user: string, password: string): Promise<JellyfinServer | string> {
	const url = cleanUrl(typed);
	if (!url) return Promise.resolve('The address should look like http://192.168.1.10:8096, with no path');
	const device = deviceId();
	return call<AuthResult>(url, '/Users/AuthenticateByName', {device, method: 'POST', body: {Username: user, Pw: password}})
		.then((r) => signedIn(url, device, r), (e: Error) => /401/.test(e.message) ? 'Wrong user name or password' : 'The server did not answer');
}

/** Starts a Quick Connect sign-in: the code to approve in Jellyfin (avatar > Quick Connect), and the secret to wait on. A string is a message. */
export function quickConnectStart (typed: string): Promise<{url: string; code: string; secret: string} | string> {
	const url = cleanUrl(typed);
	if (!url) return Promise.resolve('The address should look like http://192.168.1.10:8096, with no path');
	return call<{Code: string; Secret: string}>(url, '/QuickConnect/Initiate', {method: 'POST'})
		.then((r) => ({url, code: r.Code, secret: r.Secret}), () => 'Quick Connect is off on this server, or it did not answer');
}

/** The signed-in server once the code has been approved, null while it has not been yet. */
export function quickConnectCheck (url: string, secret: string): Promise<JellyfinServer | null> {
	const device = deviceId();
	return call<{Authenticated: boolean}>(url, `/QuickConnect/Connect?secret=${encodeURIComponent(secret)}`).then((r) => {
		if (!r.Authenticated) return null;
		return call<AuthResult>(url, '/Users/AuthenticateWithQuickConnect', {device, method: 'POST', body: {Secret: secret}}).then((a) => signedIn(url, device, a));
	});
}

// ---------- items ----------

interface RawItem {
	Id: string; Type: string; Name: string; ProductionYear?: number; RunTimeTicks?: number; Genres?: string[]; CommunityRating?: number;
	Overview?: string; SeriesId?: string; SeriesName?: string; ParentIndexNumber?: number; IndexNumber?: number;
	ProviderIds?: Record<string, string>; RemoteTrailers?: {Url?: string}[];
	UserData?: {PlayedPercentage?: number; PlaybackPositionTicks?: number; LastPlayedDate?: string; Played?: boolean; UnplayedItemCount?: number};
	ImageTags?: Record<string, string>; BackdropImageTags?: string[]; ParentBackdropItemId?: string; ParentBackdropImageTags?: string[];
	ParentThumbItemId?: string; SeriesPrimaryImageTag?: string;
}

function youtubeId (trailers: RawItem['RemoteTrailers']): string | undefined {
	for (const t of trailers || []) {
		const m = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/.exec(t.Url || '');
		if (m) return m[1];
	}
	return undefined;
}

function toItem (r: RawItem): MediaItem {
	const episode = r.Type === 'Episode';
	const tags = r.ImageTags || {};
	const ud = r.UserData || {};
	return {
		id: r.Id,
		type: episode ? 'Episode' : r.Type === 'Series' ? 'Series' : 'Movie',
		title: episode && r.SeriesName ? r.SeriesName : r.Name,
		subtitle: episode ? `S${r.ParentIndexNumber || 0} E${r.IndexNumber || 0} · ${r.Name}` : undefined,
		year: r.ProductionYear,
		minutes: r.RunTimeTicks ? Math.round(r.RunTimeTicks / 600000000) : undefined,
		genres: r.Genres || [],
		rating: r.CommunityRating,
		overview: r.Overview,
		progress: ud.PlayedPercentage ? ud.PlayedPercentage / 100 : undefined,
		played: ud.Played || undefined,
		lastPlayed: ud.LastPlayedDate,
		unplayed: ud.UnplayedItemCount,
		resumeTicks: ud.PlaybackPositionTicks || undefined,
		seriesId: r.SeriesId,
		tmdbId: (r.ProviderIds || {}).Tmdb,
		trailerYoutubeId: youtubeId(r.RemoteTrailers),
		backdropOf: (r.BackdropImageTags || []).length ? r.Id : (r.ParentBackdropImageTags || []).length ? r.ParentBackdropItemId : undefined,
		thumbOf: tags.Thumb ? r.Id : r.ParentThumbItemId,
		primaryOf: episode && r.SeriesPrimaryImageTag ? r.SeriesId : tags.Primary ? r.Id : undefined
	};
}

function items (s: JellyfinServer, path: string): Promise<MediaItem[]> {
	return call<{Items?: RawItem[]} | RawItem[]>(s.url, path, {token: s.token, device: s.deviceId})
		.then((r) => (Array.isArray(r) ? r : r.Items || []).map(toItem));
}

const q = (s: JellyfinServer, more: string) => `userId=${s.userId}&fields=${FIELDS}&enableImageTypes=Primary,Backdrop,Thumb&imageTypeLimit=1&${more}`;

/** Films and episodes in progress, then the next episode of each series being watched, most recently watched first, one per series. */
export function resume (s: JellyfinServer): Promise<MediaItem[]> {
	const when = (it: MediaItem) => it.lastPlayed || '';
	return Promise.all([
		items(s, `/UserItems/Resume?${q(s, 'mediaTypes=Video&limit=12')}`),
		items(s, `/Shows/NextUp?${q(s, 'limit=12&enableResumable=false')}`)
	]).then(([inProgress, next]) => {
		const seen: Record<string, true> = {};
		return inProgress.concat(next).sort((a, b) => (when(a) < when(b) ? 1 : when(a) > when(b) ? -1 : 0)).filter((it) => {
			const k = it.seriesId || it.id;
			if (seen[k]) return false;
			seen[k] = true;
			return true;
		});
	});
}

export function latest (s: JellyfinServer): Promise<MediaItem[]> {
	return items(s, `/Items/Latest?${q(s, 'includeItemTypes=Movie,Series&limit=30')}`);
}

export function byType (s: JellyfinServer, type: 'Movie' | 'Series', genre?: string): Promise<MediaItem[]> {
	const g = genre ? `&genres=${encodeURIComponent(genre)}` : '';
	return items(s, `/Items?${q(s, `includeItemTypes=${type}&recursive=true&sortBy=SortName&limit=60${g}`)}`);
}

/** Films and series in a genre, the best rated first. */
export function byGenre (s: JellyfinServer, genre: string): Promise<MediaItem[]> {
	return items(s, `/Items?${q(s, `includeItemTypes=Movie,Series&recursive=true&sortBy=CommunityRating&sortOrder=Descending&limit=40&genres=${encodeURIComponent(genre)}`)}`);
}

/** Films and series watched, the most recent first (for the AI picks). */
export function watched (s: JellyfinServer): Promise<MediaItem[]> {
	return items(s, `/Items?${q(s, 'includeItemTypes=Movie,Series&recursive=true&isPlayed=true&sortBy=DatePlayed&sortOrder=Descending&limit=60')}`);
}

/** Series with at least one episode watched: the ones followed, for new seasons. */
export function followedSeries (s: JellyfinServer): Promise<MediaItem[]> {
	return items(s, `/Items?${q(s, 'includeItemTypes=Series&recursive=true&sortBy=DatePlayed&sortOrder=Descending&limit=200')}`)
		.then((list) => list.filter((it) => it.played || (it.progress || 0) > 0));
}

/** Films and episodes watched to the end, the most recent first (for asking for a rating). */
export function justFinished (s: JellyfinServer): Promise<MediaItem[]> {
	return items(s, `/Items?${q(s, 'includeItemTypes=Movie,Episode&recursive=true&isPlayed=true&sortBy=DatePlayed&sortOrder=Descending&limit=10')}`);
}

/** One item (a series, for its episodes left). */
export function item (s: JellyfinServer, id: string): Promise<MediaItem | null> {
	return items(s, `/Items?${q(s, `ids=${id}`)}`).then((list) => list[0] || null);
}

/** A series' episodes in order, every season (specials left out). */
export function episodesOf (s: JellyfinServer, seriesId: string): Promise<MediaItem[]> {
	return call<{Items?: RawItem[]}>(s.url, `/Shows/${seriesId}/Episodes?${q(s, 'isMissing=false')}`, {token: s.token, device: s.deviceId})
		.then((r) => (r.Items || []).filter((x) => (x.ParentIndexNumber || 0) > 0).map(toItem));
}

/** Genre names, the best-filled first. */
export function genres (s: JellyfinServer): Promise<string[]> {
	return call<{Items?: {Name: string; MovieCount?: number; SeriesCount?: number}[]}>(s.url, `/Genres?userId=${s.userId}&includeItemTypes=Movie,Series&fields=ItemCounts`, {token: s.token, device: s.deviceId})
		.then((r) => (r.Items || []).sort((a, b) => ((b.MovieCount || 0) + (b.SeriesCount || 0)) - ((a.MovieCount || 0) + (a.SeriesCount || 0))).map((g) => g.Name));
}

export function search (s: JellyfinServer, text: string): Promise<MediaItem[]> {
	return items(s, `/Items?${q(s, `includeItemTypes=Movie,Series&recursive=true&limit=20&searchTerm=${encodeURIComponent(text)}`)}`);
}

/** The library's copy of a TMDB title, found by name and then matched on its TMDB id (Jellyfin has no lookup by provider id). */
export function findByTmdb (s: JellyfinServer, tmdbId: string, type: 'Movie' | 'Series', title: string): Promise<MediaItem | null> {
	return items(s, `/Items?${q(s, `includeItemTypes=${type}&recursive=true&hasTmdbId=true&limit=20&searchTerm=${encodeURIComponent(title)}`)}`)
		.then((list) => list.filter((it) => it.tmdbId === tmdbId)[0] || null);
}

/** The episode to play for a series: the one in progress, else the next one not watched. */
export function nextEpisode (s: JellyfinServer, seriesId: string): Promise<MediaItem | null> {
	return items(s, `/Shows/NextUp?${q(s, `seriesId=${seriesId}&limit=1&enableResumable=true`)}`).then((list) => list[0] || null);
}

/** An image sized by the server. Empty when the item has none of that kind (the caller draws its colour and title instead). */
export function imageUrl (s: JellyfinServer, item: MediaItem, kind: 'Primary' | 'Backdrop' | 'Thumb', width: number): string {
	const of = kind === 'Backdrop' ? item.backdropOf : kind === 'Thumb' ? item.thumbOf || item.backdropOf : item.primaryOf;
	if (!of) return '';
	const k = kind === 'Thumb' && !item.thumbOf ? 'Backdrop' : kind;
	return `${s.url}/Items/${of}/Images/${k}?fillWidth=${width}&quality=80`;
}

// ---------- sessions (lib/play.ts) ----------

export interface SessionInfo { Id: string; Client?: string; DeviceName?: string; LastActivityDate?: string; NowPlayingItem?: {Id: string} }

export function sessions (s: JellyfinServer): Promise<SessionInfo[]> {
	return call<SessionInfo[]>(s.url, '/Sessions', {token: s.token, device: s.deviceId});
}

/** Asks a session to play an item from a position (ticks). */
export function playOn (s: JellyfinServer, sessionId: string, itemId: string, startTicks: number): Promise<void> {
	return call<void>(s.url, `/Sessions/${sessionId}/Playing?playCommand=PlayNow&itemIds=${itemId}&startPositionTicks=${Math.round(startTicks)}`, {token: s.token, device: s.deviceId, method: 'POST'});
}
