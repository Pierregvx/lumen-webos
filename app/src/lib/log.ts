// The on-TV error log: failed Luna calls (root commands included) and failed network requests, written to /var/lib/homehook/lumen.log
// (read it over ssh). Entries wait in localStorage and are flushed through root a few seconds later, so a failing root service does not
// also lose the record of its own failure: whatever could not be written is kept and tried again on the next flush.

import {setLunaErrorHook} from './luna';
import {appendLog} from './root';

const KEY = 'lumen-log-buffer-v1';
const MAX_ENTRIES = 100;
const FLUSH_DELAY_MS = 5000;
let timer = 0;

function read (): string[] {
	try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}

function write (lines: string[]): void {
	try { localStorage.setItem(KEY, JSON.stringify(lines.slice(-MAX_ENTRIES))); } catch { /* full: drop */ }
}

/** Record one failure. `source` says what failed (a Luna URI, "fetch", "video"); keep `message` short. */
export function logError (source: string, message: string): void {
	const line = `${new Date().toISOString()} ${source} ${message}`.replace(/[\r\n]+/g, ' ').slice(0, 400);
	if (import.meta.env.DEV) console.warn('[lumen]', line);
	write(read().concat(line));
	window.clearTimeout(timer);
	timer = window.setTimeout(flush, FLUSH_DELAY_MS);
}

function flush (): void {
	const lines = read();
	if (!lines.length) return;
	appendLog(lines.join('\n') + '\n')
		.then(() => { const now = read(); write(now.slice(lines.length)); })   // anything logged while writing stays for the next flush
		.catch(() => undefined);
}

/** fetch() that logs a failure (network error or an HTTP error status) before passing it on. */
export function loggedFetch (url: string, init?: RequestInit): Promise<Response> {
	return fetch(url, init).then((r) => {
		if (!r.ok) logError('fetch', `${r.status} ${url.split('?')[0]}`);
		return r;
	}, (e: Error) => {
		logError('fetch', `${e.message} ${url.split('?')[0]}`);
		throw e;
	});
}

/** Start recording failed Luna calls, and flush whatever is left over from the last run. */
export function startLog (): void {
	setLunaErrorHook((uri, e) => logError(uri, e.message));
	if (read().length) timer = window.setTimeout(flush, FLUSH_DELAY_MS);
}
