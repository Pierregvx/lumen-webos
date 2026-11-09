// Home Assistant in Control Center: the living-room plugs, the speaker and the air. The picks server on the NAS (server/src/home.ts in cine-pierro) keeps
// the Home Assistant token and relays these few calls, so the TV only needs that server's address (Settings > Films & series > Picks
// server). With no server, or no Home Assistant set there, Control Center shows no Home part.
import {loggedFetch} from './log';
import {recoServer} from './recos';

export interface Home {
	/** the plugs the living-room remote drives; on counts those on */
	plugs: {count: number; on: number};
	speaker: {name: string; state: string; volume: number; title?: string; artist?: string} | null;
	air: {kind: string; value: string; unit: string}[];
}

const TIMEOUT_MS = 8000;

/** the last answer, so Control Center opens on it rather than growing a row when the read lands */
let last: Home | null = null;
export const lastHome = () => last;

function call (path: string, body?: unknown): Promise<Home> {
	const url = recoServer();
	if (!url) return Promise.reject(new Error('no picks server'));
	const abort = new AbortController();
	const timer = window.setTimeout(() => abort.abort(), TIMEOUT_MS);
	const init: RequestInit = body === undefined ? {signal: abort.signal}
		: {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body), signal: abort.signal};
	return loggedFetch(url + path, init).then((r) => {
		window.clearTimeout(timer);
		if (!r.ok) throw new Error(`the picks server answered ${r.status}`);
		return r.json() as Promise<Home>;
	}, (e: Error) => { window.clearTimeout(timer); throw e; }).then((h) => { last = h; return h; });
}

/** Home Assistant's state now. A server without Home Assistant clears the last answer, so the Home part goes. */
export function readHome (): Promise<Home> {
	return call('/home').catch((e: Error) => { if (/ 503$/.test(e.message)) last = null; throw e; });
}

export const setPlugs = (on: boolean) => call('/home/plugs', {on});
export const playSpeaker = (play: boolean) => call('/home/speaker', {play});
export const setSpeakerVolume = (volume: number) => call('/home/speaker', {volume});

/** The air as one line: "21.5° · 42 % · CO₂ 482 ppm · PM2.5 8". */
export function airLine (air: Home['air']): string {
	const n = (v: string, digits: number) => { const x = Number(v); return isNaN(x) ? v : String(Math.round(x * Math.pow(10, digits)) / Math.pow(10, digits)); };
	return air.map((a) =>
		a.kind === 'temperature' ? `${n(a.value, 1)}°`
			: a.kind === 'humidity' ? `${n(a.value, 0)} %`
				: a.kind === 'carbon_dioxide' ? `CO₂ ${n(a.value, 0)} ppm`
					: a.kind === 'pm25' ? `PM2.5 ${n(a.value, 0)}`
						: `${n(a.value, 1)} ${a.unit}`.trim()).join(' · ');
}
