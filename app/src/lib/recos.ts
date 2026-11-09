// AI picks for Films & series > Discover (docs/plans/films-series.md, step 2). They are made on the NAS by the picks server (lumen-recos,
// server/ in the cine-pierro repository), which keeps the Claude key and the taste profile: Claude reads the profile, the ratings sent from here, what was watched in
// Jellyfin and a list of candidates from Seerr, and picks about ten with a line on why. The TV only asks for them. The last answer is kept
// in localStorage, so Discover draws it at once.
import {readCache, writeCache} from './boot';
import {loggedFetch} from './log';
import {ratings} from './ratings';
import type {SeerrTitle} from './seerr';

export interface AiPick { title: SeerrTitle; reason: string }

const SERVER_KEY = 'recos-server';
const CACHE_KEY = 'recos-v1';
const BASE = /^https?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?$/;
/** the server may be making the picks when asked, and Claude can take a minute or two */
const PICKS_TIMEOUT_MS = 200000;
const SEND_TIMEOUT_MS = 8000;

// The Claude key and taste profile were kept here when the TV called Claude itself: the server has them now, so the TV forgets them.
try { localStorage.removeItem('recos-settings'); } catch { /* storage off: nothing kept either */ }

/** The picks server's address, or ''. */
export function recoServer (): string { return readCache<string>(SERVER_KEY) || ''; }

/** Keeps the address as typed, cleaned (http:// added, trailing slash dropped). False when it is not an address. */
export function saveRecoServer (typed: string): boolean {
	const t = typed.trim();
	const url = t ? (/^https?:\/\//.test(t) ? t : 'http://' + t).replace(/\/+$/, '') : '';
	if (url && !BASE.test(url)) return false;
	writeCache(SERVER_KEY, url);
	writeCache(CACHE_KEY, null);
	return true;
}

/** the NAS's day, as the server writes it: YYYY-MM-DD in local time */
function today (): string {
	const d = new Date();
	const two = (n: number) => (n < 10 ? '0' : '') + n;
	return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

/** The last picks the server gave, with whether they are today's. */
export function cachedPicks (): {picks: AiPick[]; fresh: boolean} | null {
	const c = readCache<{day: string; picks: AiPick[]}>(CACHE_KEY);
	return c && c.picks && c.picks.length ? {picks: c.picks, fresh: c.day === today()} : null;
}

function call (path: string, timeout: number, body?: unknown): Promise<Response> {
	const url = recoServer();
	if (!url) return Promise.reject(new Error('Set the picks server in Settings > Films & series'));
	const abort = new AbortController();
	const timer = window.setTimeout(() => abort.abort(), timeout);
	const init: RequestInit = body === undefined ? {signal: abort.signal}
		: {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body), signal: abort.signal};
	return loggedFetch(url + path, init).then((r) => { window.clearTimeout(timer); return r; }, (e: Error) => { window.clearTimeout(timer); throw e; });
}

/** Sends every rating to the server, which reads them with the profile. Best effort: they go again with the next ask. */
export function sendRatings (): Promise<void> {
	if (!recoServer()) return Promise.resolve();
	return call('/ratings', SEND_TIMEOUT_MS, ratings()).then(() => undefined, () => undefined);
}

/** Today's picks from the server (or the last ones, while it makes today's). Rejects with a message to show when it cannot. */
export function picks (): Promise<AiPick[]> {
	return sendRatings().then(() => call('/picks', PICKS_TIMEOUT_MS)).then(
		(r) => r.json().then((v: {day?: string; picks?: AiPick[]; error?: string}) => {
			if (!r.ok || !v.picks || !v.picks.length) throw new Error(v.error || 'The picks server gave no picks');
			writeCache(CACHE_KEY, {day: v.day || '', picks: v.picks});
			return v.picks;
		}),
		(e: Error) => { throw new Error(/Set the picks server/.test(e.message) ? e.message : 'The picks server did not answer'); });
}

/** Settings > Pick again today: the server makes new picks now; Discover shows them once they are made. */
export function pickAgain (): Promise<boolean> {
	writeCache(CACHE_KEY, null);
	return call('/refresh', SEND_TIMEOUT_MS, {}).then((r) => r.ok, () => false);
}

/** A pick was requested: the kept picks say so too, so a reopen does not offer Request again. */
export function markPickRequested (type: 'movie' | 'tv', tmdbId: string): void {
	const c = readCache<{day: string; picks: AiPick[]}>(CACHE_KEY);
	if (!c) return;
	writeCache(CACHE_KEY, {...c, picks: c.picks.map((p) => (p.title.type === type && p.title.tmdbId === tmdbId ? {...p, title: {...p.title, availability: 'requested'}} : p))});
}
