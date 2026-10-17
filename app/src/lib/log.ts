// The on-TV error log: failed Luna calls (root commands included) and failed network requests, written to /var/lib/homehook/lumen.log
// (read it over ssh). Entries wait in localStorage and are flushed through root a few seconds later, so a failing root service does not
// also lose the record of its own failure: whatever could not be written is kept and tried again on the next flush.

import {setLunaErrorHook} from './luna';
import {appendLog, setRootTimer} from './root';

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

// ---------- boot timeline (dev builds) ----------
// One line per launch: when each stage was reached and every root call made in the first BOOT_WINDOW_MS, in ms since the page started
// ("wallpaper 1840 ... listLaunchPoints 420-1310"). For finding what makes a cold start slow on the TV.

const BOOT_WINDOW_MS = 20000;
const boot: string[] = [];

/** A stage of the cold start was reached; `note` adds a detail ("2300KB 140ms"). */
export function bootMark (label: string, note?: string): void {
	if (!__LUMEN_DEV__) return;
	const t = performance.now();
	if (t < BOOT_WINDOW_MS) boot.push(`${label} ${Math.round(t)}${note ? ' ' + note : ''}`);
}

/** Start recording failed Luna calls, and flush whatever is left over from the last run. */
export function startLog (): void {
	setLunaErrorHook((uri, e) => logError(uri, e.message));
	if (__LUMEN_DEV__) {
		// every stretch the page was frozen for more than 50 ms ("long 2410+830"): what holds up the timers and the screen
		try {
			new PerformanceObserver((list) => list.getEntries().forEach((e) => {
				if (e.startTime < BOOT_WINDOW_MS) boot.push(`long ${Math.round(e.startTime)}+${Math.round(e.duration)}`);
				if (nav && e.startTime + e.duration > nav.t0) nav.parts.push(`long ${Math.round(e.startTime - nav.t0)}+${Math.round(e.duration)}`);
			})).observe({entryTypes: ['longtask']});
			window.addEventListener('keydown', () => { lastKey = performance.now(); }, true);
		} catch { /* no long task timing on this engine */ }
		setRootTimer((tag, start, end) => { if (start < BOOT_WINDOW_MS) boot.push(`${tag} ${Math.round(start)}-${Math.round(end)}`); });
		window.setTimeout(() => {
			write(read().concat(`${new Date().toISOString()} boot ${boot.join(', ')}`));
			window.clearTimeout(timer);
			timer = window.setTimeout(flush, 100);
		}, BOOT_WINDOW_MS);
	}
	if (read().length) timer = window.setTimeout(flush, FLUSH_DELAY_MS);
}

// ---------- screen switches (dev builds) ----------
// One line per switch ("nav settings>home key 40, frame 18, gap 120+380, long 20+300"), ms from the switch: the key press before it, the first
// frame after it, every frame gap over 50 ms, and every frozen stretch, for the NAV_WINDOW_MS after it.

const NAV_WINDOW_MS = 3000;
let nav: {t0: number; parts: string[]} | null = null;
let lastKey = 0;

/** The visible screen changed (`label` like "settings>home"): time the next few seconds. */
export function navMark (label: string): void {
	if (!__LUMEN_DEV__) return;
	const t0 = performance.now();
	const mine = {t0, parts: lastKey && t0 - lastKey < 2000 ? [`key ${Math.round(lastKey - t0)}`] : []};
	nav = mine;
	let prev = t0;
	const tick = (t: number) => {
		if (nav !== mine) return;
		if (prev === t0) mine.parts.push(`frame ${Math.round(t - t0)}`);
		else if (t - prev > 50) mine.parts.push(`gap ${Math.round(prev - t0)}+${Math.round(t - prev)}`);
		prev = t;
		if (t - t0 < NAV_WINDOW_MS) window.requestAnimationFrame(tick);
	};
	window.requestAnimationFrame(tick);
	window.setTimeout(() => {
		if (nav !== mine) return;
		nav = null;
		write(read().concat(`${new Date().toISOString()} nav ${label} ${mine.parts.join(', ')}`));
		window.clearTimeout(timer);
		timer = window.setTimeout(flush, 100);
	}, NAV_WINDOW_MS + 200);
}
