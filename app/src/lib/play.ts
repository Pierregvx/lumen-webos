// Starting a title in the Jellyfin app. The app reads no launch parameters, so it is opened and then the server is asked to play the title on
// the app's own session. That part runs in Lumen's media service (app/service/media.js), not here: once Jellyfin is in front the TV stops
// this page's timers, and a command sent while Jellyfin is still loading is dropped, so it has to be sent again until it takes. If it never
// takes, the service says so inside Jellyfin. docs/research/films-series-spikes.md has the findings.
import {APP_ID, SYSTEM_APP} from '../config/constants';
import {launchApp} from './launch';
import {lunaCall} from './luna';
import {nextEpisode, type JellyfinServer, type MediaItem} from './jellyfin';
import {t} from './i18n';

/** 'handed' when the media service took the job; 'opened' when Jellyfin was opened without it (the caller says so before leaving) */
export type PlayResult = 'handed' | 'opened';

const SERVICE = `luna://${APP_ID}.media/play`;
/** the service answers at once, but may first have to start */
const SERVICE_WAIT_MS = 8000;

/** Plays a film or episode from where it was left; a series plays its episode in progress, else its next one. */
export function play (s: JellyfinServer, item: MediaItem): Promise<PlayResult> {
	const target = item.type === 'Series' ? nextEpisode(s, item.id).catch(() => null) : Promise.resolve(item);
	return target.then((it) => !it ? 'opened' as PlayResult
		: lunaCall(SERVICE, {url: s.url, token: s.token, deviceId: s.deviceId, itemId: it.id, ticks: it.resumeTicks || 0, failText: t('Lumen could not start it: pick it here')}, SERVICE_WAIT_MS)
			.then(() => 'handed' as PlayResult, () => 'opened' as PlayResult));
}

/** Hands the title over (play), then opens Jellyfin. `notOpened` is called first when the service could not take it, so the page can say so. */
export function playAndOpen (s: JellyfinServer, item: MediaItem, notOpened: () => Promise<void>): Promise<void> {
	return play(s, item).then((r) => r === 'opened' ? notOpened() : undefined).then(() => launchApp(SYSTEM_APP.jellyfin));
}

/** Opens the YouTube app on a video (seen working on webOS 24: contentTarget "v=<id>"). */
export function openTrailer (youtubeId: string): Promise<void> {
	return launchApp(SYSTEM_APP.youtube, {contentTarget: 'v=' + youtubeId});
}
