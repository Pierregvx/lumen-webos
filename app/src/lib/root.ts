// Every command Lumen runs as root, through the Homebrew Channel's exec service. Nothing else in the app builds a shell command: each export
// below is one fixed command, and any value that goes into one is checked against a list or a pattern first, then shell-quoted.

import {LUNA} from '../config/constants';
import {isWebOS, lunaCall} from './luna';

/** The TV-side folder shared with tools/tv/watch.sh (flag files, the log, the settings backup). */
export const HOMEHOOK = '/var/lib/homehook';

/** Quote a value for a POSIX shell. */
export function shellQuote (value: string): string {
	return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Plain absolute paths only: quotes, spaces, control characters and shell syntax are refused rather than passed on. */
const SAFE_PATH = /^\/[A-Za-z0-9._\/+@-]+$/;
const BASE64 = /^[A-Za-z0-9+\/]*={0,2}$/;

/** The settings Lumen reads or changes, and the values it may set. A key not listed here never reaches the shell. */
const SETTINGS: Record<string, {category: string; values?: string[]}> = {
	pictureMode: {category: 'picture', values: ['vivid', 'normal', 'eco', 'cinema', 'sports', 'game', 'filmMaker']},
	soundMode: {category: 'sound', values: ['standard', 'news', 'movie', 'music', 'sports', 'game', 'aiSound']},
	/** for the picture mode in use (the TV keeps one per mode and input) */
	backlight: {category: 'picture', values: Array.from({length: 101}, (_, i) => String(i))},
	eyeComfortMode: {category: 'picture', values: ['on', 'off']}
};

/** Files under HOMEHOOK that Lumen may write or read. */
const FILES = ['lumen-config.json', 'recent'] as const;
export type HomehookFile = typeof FILES[number];
const LOG = `${HOMEHOOK}/lumen.log`;
const LOG_MAX_BYTES = 64 * 1024;

/** The one place a command is sent. Not exported: callers use the fixed commands below. */
function run (command: string, timeoutMs = 6000): Promise<string> {
	if (!isWebOS()) return Promise.reject(new Error('not on a TV'));
	return lunaCall<{stdoutString?: string}>(LUNA.homebrewExec, {command}, timeoutMs).then((r) => r.stdoutString || '');
}

function luna (uri: string, params: object): string {
	return `luna-send -n 1 ${shellQuote(uri)} ${shellQuote(JSON.stringify(params))}`;
}

export function listLaunchPoints (): Promise<string> {
	return run(luna('luna://com.webos.applicationManager/listLaunchPoints', {}), 8000);
}

/** Icons as "<index> <base64>" lines, one per path; paths that are not plain absolute paths are skipped (their line is missing). */
export function readIcons (paths: string[]): Promise<string> {
	const script = paths
		.map((p, i) => SAFE_PATH.test(p) ? `printf '%d ' ${i}; base64 ${shellQuote(p)} 2>/dev/null | tr -d '\\n'; echo` : '')
		.filter(Boolean)
		.join('; ');
	return script ? run(script, 15000) : Promise.resolve('');
}

/** The value of one known setting, or '' when the TV has none. */
export function getSetting (key: string): Promise<string> {
	const s = SETTINGS[key];
	if (!s) return Promise.reject(new Error('unknown setting ' + key));
	return run(luna('luna://com.webos.settingsservice/getSystemSettings', {category: s.category, keys: [key]})).then((text) => {
		const m = JSON.parse(text) as {settings?: Record<string, unknown>};
		const v = m.settings && m.settings[key];
		return v === undefined || v === null ? '' : String(v);
	});
}

/** Rejects for a key or value not in SETTINGS, and when the TV answers returnValue:false. */
export function setSetting (key: string, value: string): Promise<void> {
	const s = SETTINGS[key];
	if (!s || (s.values && s.values.indexOf(value) === -1)) return Promise.reject(new Error(`refused: ${key}=${value}`));
	return run(luna('luna://com.webos.settingsservice/setSystemSettings', {category: s.category, settings: {[key]: value}})).then((text) => {
		if (text.indexOf('"returnValue":false') !== -1) throw new Error(`the TV refused ${key}=${value}`);
	});
}

export function screenOff (): Promise<void> {
	return run(luna('luna://com.webos.service.tvpower/power/turnOffScreen', {})).then(() => undefined);
}

export function reboot (): Promise<void> {
	return run(luna('luna://com.webos.service.tvpower/power/reboot', {reason: 'restart'})).then(() => undefined);
}

/** Seconds left on the sleep timer, 0 when none. webOS 25 denies tvReservationAgent to apps ("Denied method call"), hence root. */
export function sleepRemainSeconds (): Promise<number> {
	return run(luna('luna://com.webos.service.tvReservationAgent/timer/sleep/getRemainTime', {})).then((text) => {
		const m = JSON.parse(text) as {sleepTimeSecond?: number};
		return Number(m.sleepTimeSecond) || 0;
	});
}

/** tvpower/turnOnScreenSaver is a system-only call, hence root. */
export function startScreensaver (): Promise<void> {
	return run(luna('luna://com.webos.service.tvpower/power/turnOnScreenSaver', {})).then(() => undefined);
}

/** Tells watch.sh the video wallpaper is on, so LG's screensaver is ended while Lumen is in front. */
export function setVideoFlag (on: boolean): Promise<void> {
	return run(on ? `mkdir -p ${HOMEHOOK} && touch ${HOMEHOOK}/video-wallpaper` : `rm -f ${HOMEHOOK}/video-wallpaper`).then(() => undefined);
}

/** With the Home watcher running, LG Home would bounce straight back to Lumen: this flag lets it open once. */
export function allowLgHome (): Promise<void> {
	return run('touch /tmp/allow_lg_home', 4000).then(() => undefined);
}

/** Writes text to one of FILES. The text travels as base64, so nothing in it is ever read by the shell. */
export function writeFile (name: HomehookFile, text: string): Promise<void> {
	if (FILES.indexOf(name) === -1) return Promise.reject(new Error('unknown file ' + name));
	const b64 = toBase64(text);
	return run(`mkdir -p ${HOMEHOOK} && echo ${b64} | base64 -d > ${HOMEHOOK}/${name}.tmp && mv ${HOMEHOOK}/${name}.tmp ${HOMEHOOK}/${name}`).then(() => undefined);
}

/** The contents of one of FILES, or '' when it does not exist. */
export function readFile (name: HomehookFile): Promise<string> {
	if (FILES.indexOf(name) === -1) return Promise.reject(new Error('unknown file ' + name));
	return run(`[ -f ${HOMEHOOK}/${name} ] && base64 ${HOMEHOOK}/${name} | tr -d '\\n'; true`).then((out) => fromBase64(out.trim()));
}

/** Appends lines to the log and keeps only its last LOG_MAX_BYTES. Calls the bridge directly, without the error hook, so a failing
 *  root service cannot loop by logging its own failure to write the log. */
export function appendLog (text: string): Promise<void> {
	if (!isWebOS()) return Promise.reject(new Error('not on a TV'));
	const b64 = toBase64(text);
	const command = `mkdir -p ${HOMEHOOK} && echo ${b64} | base64 -d >> ${LOG} && if [ $(wc -c < ${LOG}) -gt ${LOG_MAX_BYTES} ]; then tail -c ${LOG_MAX_BYTES / 2} ${LOG} > ${LOG}.tmp && mv ${LOG}.tmp ${LOG}; fi`;
	return lunaCall(LUNA.homebrewExec, {command}, 6000, true).then(() => undefined);
}

function toBase64 (text: string): string {
	const b64 = btoa(unescape(encodeURIComponent(text)));
	if (!BASE64.test(b64)) throw new Error('bad base64');   // cannot happen; the check is what keeps the command safe if btoa ever changes
	return b64;
}

function fromBase64 (b64: string): string {
	if (!b64) return '';
	if (!BASE64.test(b64)) throw new Error('bad base64 from the TV');
	return decodeURIComponent(escape(atob(b64)));
}
