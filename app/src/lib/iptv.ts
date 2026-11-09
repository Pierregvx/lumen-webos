// IPTV through Jellyfin (docs/plans/live-tv-build.md > IPTV): the channels of Jellyfin's Live TV (an M3U tuner, an Xtream account given
// as its M3U link, an HDHomeRun...), their guide, and a live stream to play in Lumen. Lumen does not know or care which provider is behind
// Jellyfin: the playlist, the guide and the account's password are set up in Jellyfin's dashboard and stay there.
// The channels join the aerial ones on the Live TV row and in the Guide (lib/livetv.ts Channel, with `iptv` set); OK on one plays it in
// screens/LivePlayer.tsx, since the TV's own Live TV app knows nothing of them.
import {logError, loggedFetch} from './log';
import {readCache, writeCache} from './boot';
import {isWebOS} from './luna';
import {type JellyfinServer} from './jellyfin';
import {type Channel, type Listings, type Programme} from './livetv';

const TIMEOUT_MS = 8000;
/** opening a live stream waits on the provider and Jellyfin's probe of it: give it longer */
const OPEN_TIMEOUT_MS = 20000;
/** Every channel of Jellyfin's Live TV comes into the Guide, up to this many (a list past it is cut, with a line in the log). Their
 *  guide is read as the Guide scrolls to them (hooks/useLiveTv.ts), not all at once. */
export const MAX_IPTV_CHANNELS = 5000;
/** the guide is asked for this many channels a call */
const GUIDE_BATCH = 60;
/** an IPTV channel's id and signal start with this, so they never meet an aerial one ("1_41_..." and "16522_...") */
export const IPTV_PREFIX = 'jf:';

export function isIptv (c: Channel): boolean { return c.id.indexOf(IPTV_PREFIX) === 0; }

/** Jellyfin's id for an IPTV channel */
function itemId (c: Channel): string { return c.id.slice(IPTV_PREFIX.length); }

function auth (s: JellyfinServer): string {
	return `MediaBrowser Client="Lumen", Device="LG TV", DeviceId="${s.deviceId}", Version="2.0", Token="${s.token}"`;
}

function call<T> (s: JellyfinServer, path: string, opts: {body?: object; method?: string; timeout?: number} = {}): Promise<T> {
	const abort = new AbortController();
	const timer = window.setTimeout(() => abort.abort(), opts.timeout || TIMEOUT_MS);
	const headers: Record<string, string> = {Authorization: auth(s)};
	if (opts.body) headers['Content-Type'] = 'application/json';
	const method = opts.method || (opts.body ? 'POST' : 'GET');
	return loggedFetch(s.url + path, {method, headers, body: opts.body ? JSON.stringify(opts.body) : undefined, signal: abort.signal})
		.then((r) => {
			window.clearTimeout(timer);
			if (!r.ok) throw new Error(`Jellyfin ${r.status}`);
			return r.status === 204 || r.headers.get('content-length') === '0' ? (undefined as unknown as T) : r.json() as Promise<T>;
		}, (e: Error) => { window.clearTimeout(timer); throw e; });
}

// ---------- channels ----------

interface RawChannel { Id: string; Name?: string; ChannelNumber?: string; Number?: string; ImageTags?: {Primary?: string}; UserData?: {IsFavorite?: boolean} }
interface RawList<T> { Items?: T[]; TotalRecordCount?: number }

/** A provider's channel name as a person reads it: "|FR| TF1 ᵁᴴᴰ" and "FR: France 2 FHD" become "TF1" and "France 2". Drops the country
 *  code in front and the quality marks at the end, which every channel of a list carries. */
export function cleanName (name: string): string {
	const out = name
		.replace(/^\s*(\|\s*[A-Z]{2,4}\s*\||[A-Z]{2,4}\s*[:|-])\s*/, '')
		.replace(/(\s*[.(\[]?\s*(ᵁᴴᴰ|ᴴᴰ|ˢᴰ|FHD|UHD|U\.H\.D|4K|HDR|HEVC|H265|HD|SD|RAW)\s*[)\]]?)+\s*$/i, '')
		.trim();
	return out || name.trim();
}

function toChannels (s: JellyfinServer, raw: RawChannel[]): Channel[] {
	return raw.filter((r) => r && r.Id).map((r, i) => ({
		id: IPTV_PREFIX + r.Id,
		signal: IPTV_PREFIX + r.Id,
		// a playlist without numbers: their place in Jellyfin's list
		number: String(r.ChannelNumber || r.Number || i + 1),
		name: cleanName(r.Name || String(r.ChannelNumber || '')),
		iptv: true,
		fav: !!(r.UserData && r.UserData.IsFavorite),
		logoUrl: r.ImageTags && r.ImageTags.Primary ? `${s.url}/Items/${r.Id}/Images/Primary?fillHeight=200&quality=90&tag=${r.ImageTags.Primary}` : undefined
	}));
}

/** Every channel of Jellyfin's Live TV, the ones marked as favourites in Jellyfin first, each part in Jellyfin's order. Empty when Live TV
 *  has no tuner. */
export function readIptvChannels (s: JellyfinServer | null): Promise<Channel[]> {
	if (!s) return Promise.resolve(import.meta.env.DEV && !isWebOS() ? MOCK_IPTV : []);
	return call<RawList<RawChannel>>(s, `/LiveTv/Channels?userId=${s.userId}&type=TV&enableImages=true&enableImageTypes=Primary&imageTypeLimit=1&enableUserData=true&limit=${MAX_IPTV_CHANNELS}`, {timeout: 30000})
		.then((r) => {
			if ((r.TotalRecordCount || 0) > MAX_IPTV_CHANNELS) logError('iptv', `${r.TotalRecordCount} channels in Jellyfin, the first ${MAX_IPTV_CHANNELS} taken`);
			const list = toChannels(s, r.Items || []);
			return list.filter((c) => c.fav).concat(list.filter((c) => !c.fav));
		});
}

// ---------- categories ----------

/** The provider's categories: Jellyfin drops them, so the picks server reads them from the list (lumen-recos, GET /live/categories). */
export interface IptvCategories { groups: string[]; channels: Record<string, number> }

export function readIptvCategories (server: string): Promise<IptvCategories> {
	if (!server) return Promise.resolve(import.meta.env.DEV && !isWebOS() ? MOCK_CATEGORIES : {groups: [], channels: {}});
	const abort = new AbortController();
	const timer = window.setTimeout(() => abort.abort(), TIMEOUT_MS);
	return loggedFetch(`${server}/live/categories`, {signal: abort.signal}).then((r) => {
		window.clearTimeout(timer);
		if (!r.ok) throw new Error(`categories ${r.status}`);
		return r.json() as Promise<IptvCategories>;
	}, (e: Error) => { window.clearTimeout(timer); throw e; });
}

/** Each channel with its category, by Jellyfin id. */
export function withCategories (list: Channel[], c: IptvCategories): Channel[] {
	return list.map((x) => {
		const g = c.groups[c.channels[itemId(x)]];
		return g ? {...x, group: g} : x;
	});
}

const CATEGORY_KEY = 'lumen-livetv-category';

/** the category picked last time, '' for every channel */
export function savedCategory (): string { return readCache<string>(CATEGORY_KEY) || ''; }
export function saveCategory (group: string): void { writeCache(CATEGORY_KEY, group || null); }

/** "|FR| ✪ LIGUE + ᴴᴰ" as "FR · LIGUE + HD": the TV's font has no small capitals and no ✪ */
export function categoryLabel (group: string): string {
	return group
		.replace(/ᵁᴴᴰ/g, 'UHD').replace(/ᴴᴰ/g, 'HD')
		.replace(/✪/g, ' ')
		.replace(/^\s*\|\s*([A-Z]{2,4})\s*\|\s*/, '$1 · ')
		.replace(/\s+/g, ' ')
		.trim();
}

export function categoryCounts (channels: Channel[]): Record<string, number> {
	const out: Record<string, number> = {};
	for (const c of channels) if (c.group) out[c.group] = (out[c.group] || 0) + 1;
	return out;
}

/** The channels of a category, all of them for '' or a category no channel has. */
export function inCategory (channels: Channel[], group: string): Channel[] {
	if (!group) return channels;
	const out = channels.filter((c) => c.group === group);
	return out.length ? out : channels;
}

// ---------- guide ----------

interface RawProgramme { ChannelId?: string; Name?: string; EpisodeTitle?: string; StartDate?: string; EndDate?: string; Overview?: string }

/** What Jellyfin's guide has (from the XMLTV set up beside the tuner) for these channels between `from` and `to`, by signal. Channels
 *  without a guide are simply missing. */
export function readIptvGuide (s: JellyfinServer | null, channels: Channel[], from: number, to: number): Promise<Listings> {
	const list = channels.filter(isIptv);
	if (!list.length) return Promise.resolve({});
	if (!s) return Promise.resolve(import.meta.env.DEV && !isWebOS() ? mockGuide(list, from, to) : {});
	const out: Listings = {};
	const batches: Channel[][] = [];
	for (let i = 0; i < list.length; i += GUIDE_BATCH) batches.push(list.slice(i, i + GUIDE_BATCH));
	// one batch after another: the TV is slow to parse, and Jellyfin's guide query is not cheap either
	return batches.reduce<Promise<void>>((p, batch) => p.then(() => call<RawList<RawProgramme>>(s, '/LiveTv/Programs', {body: {
		UserId: s.userId,
		ChannelIds: batch.map(itemId),
		MinEndDate: new Date(from).toISOString(),
		MaxStartDate: new Date(to).toISOString(),
		EnableImages: false,
		EnableUserData: false,
		Fields: ['Overview'],
		SortBy: ['StartDate']
	}}).then((r) => {
		for (const row of r.Items || []) {
			const start = Date.parse(row.StartDate || '');
			const end = Date.parse(row.EndDate || '');
			if (!row.ChannelId || isNaN(start) || isNaN(end) || end <= start) continue;
			const prog: Programme = {title: row.EpisodeTitle && row.Name ? `${row.Name} · ${row.EpisodeTitle}` : row.Name || row.EpisodeTitle || '', start, end};
			if (row.Overview) prog.desc = row.Overview;
			(out[IPTV_PREFIX + row.ChannelId] || (out[IPTV_PREFIX + row.ChannelId] = [])).push(prog);
		}
	})), Promise.resolve()).then(() => {
		for (const k in out) out[k].sort((a, b) => a.start - b.start);
		return out;
	});
}

// ---------- the live stream ----------

export interface LiveStream {
	url: string;
	itemId: string;
	mediaSourceId: string;
	playSessionId: string;
	/** the tuner's open stream: closed when the player stops, so a subscription with one connection is free for the next channel */
	liveStreamId?: string;
}

/** What Lumen asks Jellyfin for: HLS, with the picture and sound copied as they come when the TV reads them (no re-encoding, so the NAS
 *  only repackages), re-encoded only when not (MPEG-2 video, odd sound). Direct play is off: a raw endless TS over HTTP is not something
 *  the TV's player is known to take, HLS is (verify). */
const DEVICE_PROFILE = {
	Name: 'Lumen live',
	MaxStreamingBitrate: 120000000,
	DirectPlayProfiles: [],
	TranscodingProfiles: [{
		Container: 'ts', Type: 'Video', Protocol: 'hls', Context: 'Streaming',
		VideoCodec: 'h264,hevc', AudioCodec: 'aac,ac3,eac3,mp3', MaxAudioChannels: '6', BreakOnNonKeyFrames: true, MinSegments: 1
	}],
	CodecProfiles: [],
	SubtitleProfiles: []
};

interface RawSource { Id: string; LiveStreamId?: string; TranscodingUrl?: string }

/** The stream open in Jellyfin, kept on the TV until it is closed: if Lumen goes without closing it (the TV switched off mid-channel, a
 *  crash, an install), the next player closes it first, else it would hold the subscription's one connection and every channel would fail
 *  ("M3U simultaneous stream limit has been reached", seen 2026-11-05). */
const OPEN_KEY = 'lumen-iptv-open';

/** Closes the stream a last player left open, if any. Resolves once Jellyfin has answered or given up. */
export function closeLeftover (s: JellyfinServer): Promise<void> {
	const st = readCache<LiveStream>(OPEN_KEY);
	if (!st || !st.playSessionId) return Promise.resolve();
	logError('iptv', 'closing the stream the last player left open');
	return closeLive(s, st);
}

/** Opens a channel's live stream in Jellyfin and gives the address to play. */
export function openLive (s: JellyfinServer, c: Channel): Promise<LiveStream> {
	if (!isIptv(c)) return Promise.reject(new Error('Not an IPTV channel'));
	if (c.mockUrl) return Promise.resolve({url: c.mockUrl, itemId: itemId(c), mediaSourceId: '', playSessionId: ''});
	const id = itemId(c);
	return call<{MediaSources?: RawSource[]; PlaySessionId?: string; ErrorCode?: string}>(s, `/Items/${id}/PlaybackInfo?userId=${s.userId}`, {timeout: OPEN_TIMEOUT_MS, body: {
		UserId: s.userId,
		AutoOpenLiveStream: true,
		EnableDirectPlay: false,
		EnableDirectStream: false,
		EnableTranscoding: true,
		AllowVideoStreamCopy: true,
		AllowAudioStreamCopy: true,
		MaxStreamingBitrate: DEVICE_PROFILE.MaxStreamingBitrate,
		DeviceProfile: DEVICE_PROFILE
	}}).then((info) => {
		const src = (info.MediaSources || [])[0];
		if (info.ErrorCode) throw new Error(`Jellyfin: ${info.ErrorCode}`);
		if (!src || !src.TranscodingUrl) throw new Error('Jellyfin gave no stream');
		const url = s.url + src.TranscodingUrl;
		const st: LiveStream = {
			url: /[?&](api_key|ApiKey)=/i.test(url) ? url : `${url}${url.indexOf('?') >= 0 ? '&' : '?'}api_key=${s.token}`,
			itemId: id,
			mediaSourceId: src.Id,
			playSessionId: info.PlaySessionId || '',
			liveStreamId: src.LiveStreamId
		};
		writeCache(OPEN_KEY, st);
		return st;
	});
}

function report (s: JellyfinServer, path: string, st: LiveStream): Promise<void> {
	return call<void>(s, path, {body: {
		ItemId: st.itemId, MediaSourceId: st.mediaSourceId, PlaySessionId: st.playSessionId, LiveStreamId: st.liveStreamId,
		CanSeek: false, IsPaused: false, PlayMethod: 'Transcode'
	}}).catch(() => undefined);
}

/** Jellyfin hears the channel started, so its dashboard shows it and it keeps the stream open */
export function reportLiveStart (s: JellyfinServer, st: LiveStream): Promise<void> {
	return st.playSessionId ? report(s, '/Sessions/Playing', st) : Promise.resolve();
}

/** Stops a live stream for good: Stopped, then its repackaging and the tuner's stream are closed, each best effort (the server may be
 *  off). Resolves once Jellyfin has answered or given up, so the next channel opens on a free connection. */
export function closeLive (s: JellyfinServer, st: LiveStream): Promise<void> {
	if (!st.playSessionId) return Promise.resolve();
	const left = readCache<LiveStream>(OPEN_KEY);
	if (left && left.playSessionId === st.playSessionId) writeCache(OPEN_KEY, null);
	return report(s, '/Sessions/Playing/Stopped', st)
		.then(() => call<void>(s, `/Videos/ActiveEncodings?deviceId=${encodeURIComponent(s.deviceId)}&playSessionId=${st.playSessionId}`, {method: 'DELETE'}).catch(() => undefined))
		.then(() => (st.liveStreamId ? call<void>(s, `/LiveStreams/Close?liveStreamId=${encodeURIComponent(st.liveStreamId)}`, {method: 'POST'}).catch(() => undefined) : undefined));
}

// ---------- dev preview (no Jellyfin signed in, not on a TV) ----------

/** public test streams, so the live player can be tried in a browser */
const MOCK_IPTV: Channel[] = [
	['201', 'Arte', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'],
	['202', 'France 24', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'],
	['203', 'Euronews', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'],
	['204', 'TV5Monde', 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8']
].map(([number, name, url], i) => ({id: `${IPTV_PREFIX}mock${i}`, signal: `${IPTV_PREFIX}mock${i}`, number, name, iptv: true, mockUrl: url}));

const MOCK_CATEGORIES: IptvCategories = {groups: ['|FR| ✪ TNT HD', '|FR| ✪ INFOS'], channels: {mock0: 0, mock1: 1, mock2: 1, mock3: 0}};

const MOCK_SHOWS = ['Le journal', 'Documentaire', 'Météo', 'Le grand débat', 'Cinéma', 'Reportage'];

function mockGuide (list: Channel[], from: number, to: number): Listings {
	const out: Listings = {};
	list.forEach((c, i) => {
		const progs: Programme[] = [];
		let t = from - (i % 3) * 15 * 60000;
		for (let k = 0; t < to; k++) {
			const len = (30 + ((i + k) % 3) * 15) * 60000;
			progs.push({title: MOCK_SHOWS[(i * 2 + k) % MOCK_SHOWS.length], start: t, end: t + len, desc: 'Un programme pour essayer le guide IPTV.'});
			t += len;
		}
		out[c.signal] = progs;
	});
	return out;
}
