// The player inside Lumen (docs/plans/player.md): what to play and how Jellyfin hears about it. The TV plays every file in the library
// straight from Jellyfin's static stream, with no transcoding (docs/research/films-series-spikes.md); the picture is on the TV's video
// plane behind the page, so the page goes transparent while it plays (html.playing, theme/player.css).
import {loggedFetch} from './log';
import {episodesOf, type JellyfinServer, type MediaItem} from './jellyfin';

export interface SubTrack { index: number; lang?: string; title?: string; isDefault: boolean; vttUrl: string }
export interface Stream {
	url: string;
	itemId: string;
	mediaSourceId: string;
	playSessionId: string;
	startTicks: number;
	subtitles: SubTrack[];
	/** the default audio track's language (ISO 639-2, as Jellyfin gives it) */
	audioLang?: string;
	/** where the end credits start, when Jellyfin knows (an Outro media segment) */
	outroStartTicks?: number;
}

const TIMEOUT_MS = 8000;

function auth (s: JellyfinServer): string {
	return `MediaBrowser Client="Lumen", Device="LG TV", DeviceId="${s.deviceId}", Version="2.0", Token="${s.token}"`;
}

function call<T> (s: JellyfinServer, path: string, body?: object): Promise<T> {
	const abort = new AbortController();
	const timer = window.setTimeout(() => abort.abort(), TIMEOUT_MS);
	const headers: Record<string, string> = {Authorization: auth(s)};
	if (body) headers['Content-Type'] = 'application/json';
	return loggedFetch(s.url + path, {method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined, signal: abort.signal})
		.then((r) => {
			window.clearTimeout(timer);
			if (!r.ok) throw new Error(`Jellyfin ${r.status}`);
			return r.status === 204 ? (undefined as unknown as T) : r.json() as Promise<T>;
		}, (e: Error) => { window.clearTimeout(timer); throw e; });
}

interface RawStream { Type?: string; Index: number; Language?: string; Title?: string; DisplayTitle?: string; IsDefault?: boolean; IsTextSubtitleStream?: boolean }
interface RawSource { Id: string; MediaStreams?: RawStream[]; DefaultAudioStreamIndex?: number }

/** What to play for an item: its stream, subtitle tracks, audio language and where the end credits start. */
export function openStream (s: JellyfinServer, item: MediaItem): Promise<Stream> {
	return Promise.all([
		call<{MediaSources?: RawSource[]; PlaySessionId?: string}>(s, `/Items/${item.id}/PlaybackInfo?userId=${s.userId}`),
		call<{Items?: {Type?: string; StartTicks?: number}[]}>(s, `/MediaSegments/${item.id}`).catch(() => ({Items: []})),
		// where it was left, as the server has it now: the Resume row Lumen drew may be older than the last time it was stopped
		call<{PlaybackPositionTicks?: number}>(s, `/UserItems/${item.id}/UserData?userId=${s.userId}`).catch(() => null)
	]).then(([info, segments, userData]) => {
		const src = (info.MediaSources || [])[0];
		if (!src) throw new Error('No media source');
		const streams = src.MediaStreams || [];
		const audios = streams.filter((x) => x.Type === 'Audio');
		const audio = audios.filter((x) => x.Index === src.DefaultAudioStreamIndex)[0] || audios.filter((x) => x.IsDefault)[0] || audios[0];
		const outro = (segments.Items || []).filter((x) => x.Type === 'Outro' && x.StartTicks)[0];
		return {
			url: `${s.url}/Videos/${item.id}/stream?static=true&mediaSourceId=${src.Id}&api_key=${s.token}`,
			itemId: item.id,
			mediaSourceId: src.Id,
			playSessionId: info.PlaySessionId || '',
			startTicks: userData ? userData.PlaybackPositionTicks || 0 : item.resumeTicks || 0,
			audioLang: audio && audio.Language,
			outroStartTicks: outro && outro.StartTicks,
			subtitles: streams.filter((x) => x.Type === 'Subtitle' && x.IsTextSubtitleStream !== false).map((x) => ({
				index: x.Index,
				lang: x.Language,
				title: x.DisplayTitle || x.Title,
				isDefault: !!x.IsDefault,
				vttUrl: `${s.url}/Videos/${item.id}/${src.Id}/Subtitles/${x.Index}/0/Stream.vtt?api_key=${s.token}`
			}))
		};
	});
}

/** The episode after this one in its series (into the next season), or null after the last. */
export function nextEpisodeAfter (s: JellyfinServer, ep: MediaItem): Promise<MediaItem | null> {
	if (ep.type !== 'Episode' || !ep.seriesId) return Promise.resolve(null);
	return episodesOf(s, ep.seriesId).then((list) => {
		const at = list.findIndex((x) => x.id === ep.id);
		return at >= 0 && at + 1 < list.length ? list[at + 1] : null;
	}, () => null);
}

function report (s: JellyfinServer, path: string, st: Stream, positionTicks: number, paused: boolean): Promise<void> {
	return call<void>(s, path, {
		ItemId: st.itemId, MediaSourceId: st.mediaSourceId, PlaySessionId: st.playSessionId, PositionTicks: Math.round(positionTicks),
		IsPaused: paused, CanSeek: true, PlayMethod: 'DirectPlay'
	}).catch(() => undefined);
}

export function reportStart (s: JellyfinServer, st: Stream, positionTicks: number): Promise<void> { return report(s, '/Sessions/Playing', st, positionTicks, false); }
export function reportProgress (s: JellyfinServer, st: Stream, positionTicks: number, paused: boolean): Promise<void> { return report(s, '/Sessions/Playing/Progress', st, positionTicks, paused); }
export function reportStopped (s: JellyfinServer, st: Stream, positionTicks: number): Promise<void> { return report(s, '/Sessions/Playing/Stopped', st, positionTicks, false); }
