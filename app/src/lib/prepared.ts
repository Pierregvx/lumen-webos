// What is prepared on the NAS's fast disk (a copy of a film or an episode, so it plays without the hard disk's noise). The picks server
// knows (lumen-recos, GET /prepared): each copy's state by its path among the copies, and how a library file's path turns into that path.
// Lumen marks the originals (a banner on a poster or a Resume tile, a mark on an episode and on a season all prepared) and leaves the
// copies out of its lists, since Jellyfin shows them as a library of their own. Nothing here names a path: the server gives them.
import {useEffect, useState} from 'preact/hooks';
import {readCache, writeCache} from './boot';
import {loggedFetch} from './log';
import {recoServer} from './recos';

export type PrepState = 'waiting' | 'copying' | 'scanning' | 'ready' | 'failed';
export interface Prep { state: PrepState; progress?: number }
interface Answer { on: boolean; map: [string, string][]; copies: string; items: Record<string, Prep> }

const CACHE_KEY = 'lumen-prepared-v1';
/** read again this often while a screen shows marks, and faster while a copy moves */
const EVERY_MS = 60000;
const MOVING_MS = 5000;
const TIMEOUT_MS = 8000;

let last: Answer | null = readCache<Answer>(CACHE_KEY);
const listeners = new Set<() => void>();
let busy = false;

function read (): Promise<void> {
	const url = recoServer();
	if (!url || busy) return Promise.resolve();
	busy = true;
	const abort = new AbortController();
	const timer = window.setTimeout(() => abort.abort(), TIMEOUT_MS);
	return loggedFetch(`${url}/prepared`, {signal: abort.signal})
		.then((r) => (r.ok ? r.json() as Promise<Answer> : null))
		.then((a) => {
			if (a && Array.isArray(a.map) && a.items) {
				const changed = JSON.stringify(a) !== JSON.stringify(last);
				last = a;
				if (changed) { writeCache(CACHE_KEY, a); listeners.forEach((f) => f()); }
			}
		}, () => undefined)
		.then(() => { window.clearTimeout(timer); busy = false; });
}

const moving = () => !!last && Object.keys(last.items).some((k) => last && /waiting|copying|scanning/.test(last.items[k].state));

/** Marks on screen: reads the server now, then every minute (every 5 s while a copy moves). Returns a number that changes with each new answer. */
export function usePrepared (on = true): number {
	const [n, setN] = useState(0);
	useEffect(() => {
		if (!on) return undefined;
		const bump = () => setN((x) => x + 1);
		listeners.add(bump);
		let timer = 0;
		const tick = () => { read().then(() => { timer = window.setTimeout(tick, moving() ? MOVING_MS : EVERY_MS); }); };
		tick();
		return () => { listeners.delete(bump); window.clearTimeout(timer); };
	}, [on]);
	return n;
}

/** a library file's path as the copy's path, or null */
function relOf (path: string | undefined): string | null {
	if (!path || !last) return null;
	for (const [from, to] of last.map) if (path.indexOf(from) === 0) return to + path.slice(from.length);
	return null;
}

/** An item that is itself a copy: lists leave it out (its original shows, marked). */
export function isCopy (path: string | undefined): boolean {
	return !!path && !!last && !!last.copies && path.indexOf(last.copies) === 0;
}

/** A film's or an episode's preparation, if any. */
export function prepOf (path: string | undefined): Prep | null {
	const rel = relOf(path);
	return rel && last ? last.items[rel] || null : null;
}

/** How many episodes of a series (its folder's path) are ready. */
export function readyIn (seriesPath: string | undefined): number {
	const head = relOf(seriesPath ? seriesPath.replace(/\/?$/, '/') : undefined);
	if (!head || !last) return 0;
	let n = 0;
	for (const k in last.items) if (k.indexOf(head) === 0 && last.items[k].state === 'ready') n++;
	return n;
}

/** The banner's words for a preparation: ready, or how it goes. Empty for none (and for a failed one, which Ciné Pierro shows). */
export function prepLabel (p: Prep | null, tr: (s: string) => string): string {
	if (!p) return '';
	if (p.state === 'ready') return tr('Ready, quiet');
	if (p.state === 'copying') return `${tr('Copying')} ${Math.round((p.progress || 0) * 100)} %`;
	if (p.state === 'waiting' || p.state === 'scanning') return tr('Preparing…');
	return '';
}
