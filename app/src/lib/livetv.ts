// Live TV: the aerial channels, their logos, and what is on now and next (docs/live-tv-build.md). Everything comes through the root shell
// (lib/root.ts). A cold start draws the last answer from localStorage at once (lib/boot.ts); the TV is asked again after the first frame.

import {isWebOS} from './luna';
import {channelList, nowNext, readIcons} from './root';
import {readCache, writeCache} from './boot';
import {timeParts} from './clock';
import {getClockMode} from './i18n';
import {cachedTimeFormat} from './timeFormat';

export interface Channel {
	/** what openChannel takes: "1_41_2_102_16522_17472_9018" */
	id: string;
	/** the last three numbers of the id, which the guide's rows carry: "16522_17472_9018" */
	signal: string;
	number: string;
	name: string;
	/** the logo's file on the TV (/tmp/gibbips/logo/...), when it has one */
	logoPath?: string;
}

/** One listing; times in ms since the epoch. */
export interface Programme {
	title: string;
	start: number;
	end: number;
}

/** The listings read for each channel (about two: now and next), by signal id, earliest first. */
export type Listings = Record<string, Programme[]>;

export interface NowNext {
	now?: Programme;
	next?: Programme;
}

const CHANNEL_ID = /^\d+(_\d+){6}$/;
const SIGNAL_ID = /^\d+_\d+_\d+$/;

// ---------- channels ----------

interface RawChannel {
	channelId?: string;
	signalChannelId?: string;
	channelNumber?: string | number;
	channelName?: string;
	imgUrl?: string;
	Radio?: boolean;
	Data?: boolean;
	skipped?: boolean;
}

/** The TV's channels in number order, without radio, data and skipped channels. */
export function readChannels (): Promise<Channel[]> {
	if (!isWebOS()) return Promise.resolve(import.meta.env.DEV ? MOCK_CHANNELS : []);
	return channelList().then(parseChannels);
}

export function parseChannels (text: string): Channel[] {
	const reply = JSON.parse(text) as Record<string, unknown>;
	if (reply.returnValue === false) throw new Error('getChannelList refused');
	// the list's key is not documented: take the reply's array of channels, whatever it is called
	const raw = (Array.isArray(reply.channelList) ? reply.channelList : Object.keys(reply).map((k) => reply[k]).filter(Array.isArray)[0] || []) as RawChannel[];
	const out: Channel[] = [];
	for (const c of raw) {
		if (!c || c.Radio || c.Data || c.skipped || typeof c.channelId !== 'string' || !CHANNEL_ID.test(c.channelId)) continue;
		const signal = typeof c.signalChannelId === 'string' && SIGNAL_ID.test(c.signalChannelId) ? c.signalChannelId : c.channelId.split('_').slice(4).join('_');
		out.push({
			id: c.channelId,
			signal,
			number: String(c.channelNumber === undefined ? '' : c.channelNumber),
			name: c.channelName || String(c.channelNumber || ''),
			logoPath: c.imgUrl || undefined
		});
	}
	const num = (c: Channel) => { const n = parseFloat(c.number); return isNaN(n) ? Infinity : n; };
	return out.sort((a, b) => num(a) - num(b) || (a.number < b.number ? -1 : a.number > b.number ? 1 : 0));
}

/** channels on the Live TV row until some are picked in Settings > Channels */
export const DEFAULT_ROW_CHANNELS = 5;

/** The Live TV row's channels: the ones picked (ids, in order, those the TV still has), or the first few by number. */
export function rowChannels (channels: Channel[], ids: string[] | null): Channel[] {
	if (!ids) return channels.slice(0, DEFAULT_ROW_CHANNELS);
	const byId: Record<string, Channel> = {};
	channels.forEach((c) => { byId[c.id] = c; });
	return ids.map((id) => byId[id]).filter((c): c is Channel => !!c);
}

/** Where typing a number lands: the channel with that number, else the first one after it (the list is in number order), else -1. */
export function findChannel (channels: Channel[], typed: string): number {
	const exact = channels.findIndex((c) => c.number === typed);
	if (exact >= 0) return exact;
	const n = Number(typed);
	return channels.findIndex((c) => parseFloat(c.number) >= n);
}

// ---------- now and next ----------

interface RawProgramme {
	signalChannelId?: string;
	programName?: string;
	startTime?: string;
	endTime?: string;
}

/** db8 returns up to 500 rows a page; about two per channel, so one page is expected. More than this many pages is a reply gone wrong. */
const MAX_PAGES = 4;

/** Now and next for every channel. Asks for the five fields Lumen reads; if the TV refuses the select, asks for whole rows instead. */
export function readListings (): Promise<Listings> {
	if (!isWebOS()) return Promise.resolve(import.meta.env.DEV ? mockListings() : {});
	const rows: RawProgramme[] = [];
	const page = (key: string | undefined, slim: boolean, n: number): Promise<Listings> => nowNext(key, slim).then((text) => {
		const reply = JSON.parse(text) as {returnValue?: boolean; results?: RawProgramme[]; next?: string};
		if (reply.returnValue === false) {
			if (slim && n === 0) return page(undefined, false, 0);
			throw new Error('epgdb find refused');
		}
		rows.push(...(reply.results || []));
		return reply.next && n + 1 < MAX_PAGES ? page(reply.next, slim, n + 1) : groupListings(rows);
	});
	return page(undefined, true, 0);
}

/** "2026,10,17,17,05,00" (UTC) as ms since the epoch, or NaN. */
export function utcTime (text: string | undefined): number {
	const p = (text || '').split(',').map(Number);
	if (p.length < 6 || p.some(isNaN)) return NaN;
	return Date.UTC(p[0], p[1] - 1, p[2], p[3], p[4], p[5]);
}

export function groupListings (rows: RawProgramme[]): Listings {
	const out: Listings = {};
	for (const r of rows) {
		const start = utcTime(r.startTime);
		const end = utcTime(r.endTime);
		if (!r.signalChannelId || isNaN(start) || isNaN(end) || end <= start) continue;
		(out[r.signalChannelId] || (out[r.signalChannelId] = [])).push({title: r.programName || '', start, end});
	}
	for (const k in out) out[k].sort((a, b) => a.start - b.start);
	return out;
}

/** What is on at `t`, and what follows. Worked out from the times rather than the TV's isPresent, so listings read a while ago still
 *  show the right programme. No `now` with a `next`: the channel is off air until next.start. */
export function nowNextAt (list: Programme[] | undefined, t: number): NowNext {
	if (!list) return {};
	let now: Programme | undefined;
	for (const p of list) {
		if (p.start <= t && t < p.end) now = p;
		else if (p.start > t) return {now, next: p};
	}
	return {now};
}

/** How far through a programme `t` is, 0 to 1. */
export function progress (p: Programme, t: number): number {
	return Math.max(0, Math.min(1, (t - p.start) / (p.end - p.start)));
}

/** "18:45" or "6:45 PM", following the clock setting. */
export function clockText (ms: number): string {
	const mode = getClockMode();
	const {time, period} = timeParts(new Date(ms), mode === '12h' || mode === '24h' ? mode : cachedTimeFormat());
	return period ? `${time} ${period}` : time;
}

/** "40 min left", "1 hr 5 min left" */
export function timeLeft (p: Programme, t: number): string {
	const min = Math.max(1, Math.ceil((p.end - t) / 60000));
	return min < 60 ? `${min} min left` : `${Math.floor(min / 60)} hr${min % 60 ? ` ${min % 60} min` : ''} left`;
}

// ---------- logos ----------

/** Logos as data: URIs, by their path on the TV. Kept apart from the channel list, so a full localStorage loses only the logos. */
const LOGO_CACHE_KEY = 'lumen-livetv-logos-v1';

export function cachedLogos (): Record<string, string> {
	return readCache<Record<string, string>>(LOGO_CACHE_KEY) || {};
}

/** Reads the logos not in the cache yet, in one shell round-trip, and returns the whole cache. A logo whose file is missing (the TV
 *  clears /tmp on a reboot and fetches them again later) is simply asked for again next time. */
export function readLogos (channels: Channel[]): Promise<Record<string, string>> {
	const cache = cachedLogos();
	const missing = channels.map((c) => c.logoPath).filter((p, i, all): p is string => !!p && !cache[p] && all.indexOf(p) === i);
	if (!missing.length || !isWebOS()) return Promise.resolve(cache);
	return readIcons(missing).then((out) => {
		for (const line of out.split('\n')) {
			const m = /^(\d+) ([A-Za-z0-9+\/=]+)$/.exec(line);
			const path = m && missing[Number(m[1])];
			if (m && path) cache[path] = `data:image/png;base64,${m[2]}`;
		}
		writeCache(LOGO_CACHE_KEY, cache);
		return cache;
	});
}

// ---------- what the last launch showed ----------

const CACHE_KEY = 'lumen-boot-livetv-v1';

export interface LiveCache {
	channels: Channel[];
	listings: Listings;
}

export function cachedLive (): LiveCache {
	const saved = readCache<LiveCache>(CACHE_KEY);
	return saved && Array.isArray(saved.channels) && saved.listings ? saved : {channels: [], listings: {}};
}

export function saveLive (value: LiveCache): void {
	writeCache(CACHE_KEY, value);
}

// ---------- dev preview (not on a TV) ----------

const MOCK_CHANNELS: Channel[] = [
	['1', 'BBC ONE HD'], ['2', 'BBC TWO HD'], ['3', 'ITV1 HD'], ['4', 'Channel 4 HD'], ['5', '5'], ['6', 'ITV2'], ['7', 'BBC THREE'],
	['8', 'More4'], ['9', 'BBC FOUR'], ['10', 'Sky Arts'], ['11', 'Quest'], ['12', 'E4']
].map(([number, name], i) => ({id: `1_41_${number}_10${i}_16522_174${i}_9018`, signal: `16522_174${i}_9018`, number, name}));

const MOCK_TITLES = [
	['BBC News at Six', 'Look North'], ['Rick Stein\'s Cornwall', 'Gardeners\' World'], ['ITV Evening News', 'Emmerdale'],
	['Four in a Bed', 'Come Dine with Me'], ['Judge Rinder', 'Police Interceptors'], ['Family Fortunes', 'The Masked Singer'],
	['Gavin and Stacey', 'Pointless'], ['Grand Designs', 'Location, Location, Location'], ['', 'Timeshift'], ['Classic Albums', 'Landscape Artist of the Year'],
	['Gold Rush', 'Wheeler Dealers'], ['The Big Bang Theory', 'Hollyoaks']
];

function mockListings (): Listings {
	const t = Date.now();
	const hour = t - (t % 3600000);
	const out: Listings = {};
	MOCK_CHANNELS.forEach((c, i) => {
		const [now, next] = MOCK_TITLES[i];
		const start = hour - (i % 3) * 20 * 60000;
		const end = start + (30 + (i % 4) * 15) * 60000;
		// the ninth channel is off air until the next hour
		out[c.signal] = now
			? [{title: now, start, end}, {title: next, start: end, end: end + 3600000}]
			: [{title: next, start: hour + 3600000, end: hour + 7200000}];
	});
	return out;
}
