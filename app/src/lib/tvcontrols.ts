// Control Center: what the TV lets a normal web app do (volume, mute) and what needs the Homebrew Channel's root service
// (picture mode, sleep timer, screen off, restart), through lib/root.ts. Off the TV (the dev preview) the values are kept in memory.

import {isWebOS, lunaCall} from './luna';
import * as root from './root';

const AUDIO = 'luna://com.webos.audio/';

/** the TV's own names for the picture modes it offers on an SDR picture */
export const PICTURE_MODES = ['vivid', 'normal', 'eco', 'cinema', 'sports', 'game', 'filmMaker'];
export const PICTURE_LABEL: Record<string, string> = {vivid: 'Vivid', normal: 'Standard', eco: 'Eco', cinema: 'Cinema', sports: 'Sports', game: 'Game', filmMaker: 'FILMMAKER', expert1: 'Expert (bright room)', expert2: 'Expert (dark room)', hdrEffect: 'HDR Effect', hdrStandard: 'HDR Standard', hdrCinema: 'HDR Cinema', hdrGame: 'HDR Game'};
/** the TV's own names for the sound modes (Settings > Sound > Sound Mode) that every model offers */
export const SOUND_MODES = ['standard', 'news', 'movie', 'music', 'sports', 'game', 'aiSound'];
export const SOUND_LABEL: Record<string, string> = {standard: 'Standard', news: 'Clear Voice', movie: 'Cinema', music: 'Music', sports: 'Sports', game: 'Game Optimizer', aiSound: 'AI Sound', aiSoundPlus: 'AI Sound Pro', custom: 'Custom'};
export const SLEEP_MINUTES = [0, 15, 30, 60, 90, 120];
/** the choices LG's own Settings offers for "Screen Saver Standby Time" */
export const SCREENSAVER_MINUTES = [3, 10, 20, 30];

export interface Controls {
	volume: number;
	muted: boolean;
	picture: string;
	sound: string;
	sleepMinutes: number;
	/** minutes of inactivity before the TV starts its screensaver */
	screensaver: number;
}

const mock: Controls = {volume: 18, muted: false, picture: 'normal', sound: 'standard', sleepMinutes: 0, screensaver: 10};

export function readControls (): Promise<Controls> {
	if (!isWebOS()) return Promise.resolve({...mock});
	const out: Controls = {volume: 0, muted: false, picture: 'normal', sound: 'standard', sleepMinutes: 0, screensaver: 10};
	const audio = lunaCall<{volume?: number; muteStatus?: boolean}>(AUDIO + 'getVolume', {}).then((r) => {
		out.volume = Number(r.volume) || 0;
		out.muted = r.muteStatus === true;
	}).catch(() => undefined);
	const picture = root.getSetting('pictureMode').then((v) => { if (v) out.picture = v; }).catch(() => undefined);
	const sleep = root.sleepRemainSeconds().then((seconds) => {
		const minutes = Math.ceil(seconds / 60);
		out.sleepMinutes = minutes <= 0 ? 0 : SLEEP_MINUTES.filter((m) => m >= minutes)[0] || SLEEP_MINUTES[SLEEP_MINUTES.length - 1];
	}).catch(() => undefined);
	const saver = root.getSetting('screenSaverTimer').then((v) => {
		const minutes = Number(v);
		if (SCREENSAVER_MINUTES.indexOf(minutes) !== -1) out.screensaver = minutes;
	}).catch(() => undefined);
	const sound = root.getSetting('soundMode').then((v) => { if (v) out.sound = v; }).catch(() => undefined);
	return Promise.all([audio, picture, sleep, saver, sound]).then(() => out);
}

export function setVolume (volume: number): Promise<void> {
	mock.volume = volume;
	if (!isWebOS()) return Promise.resolve();
	return lunaCall(AUDIO + 'setVolume', {volume}).then(() => undefined);
}

export function setMuted (muted: boolean): Promise<void> {
	mock.muted = muted;
	if (!isWebOS()) return Promise.resolve();
	return lunaCall(AUDIO + 'setMuted', {muted}).then(() => undefined);
}

/** Only the TV's known mode names are ever put into the root command. */
export function setPictureMode (mode: string): Promise<void> {
	mock.picture = mode;
	if (!isWebOS()) return Promise.resolve();
	if (PICTURE_MODES.indexOf(mode) === -1) return Promise.reject(new Error('unknown picture mode'));
	return root.setSetting('pictureMode', mode);
}

/** Only the TV's known sound mode names are ever put into the root command. */
export function setSoundMode (mode: string): Promise<void> {
	mock.sound = mode;
	if (!isWebOS()) return Promise.resolve();
	if (SOUND_MODES.indexOf(mode) === -1) return Promise.reject(new Error('unknown sound mode'));
	return root.setSetting('soundMode', mode);
}

/** The TV's own screensaver start time. Only the TV's known choices are ever put into the root command. */
export function setScreensaverTime (minutes: number): Promise<void> {
	mock.screensaver = minutes;
	if (!isWebOS()) return Promise.resolve();
	if (SCREENSAVER_MINUTES.indexOf(minutes) === -1) return Promise.reject(new Error('unknown screensaver time'));
	return root.setSetting('screenSaverTimer', String(minutes));
}

/** 0 cancels the timer. */
export function setSleepTimer (minutes: number): Promise<void> {
	mock.sleepMinutes = minutes;
	if (!isWebOS()) return Promise.resolve();
	return root.setSleepTimer(minutes);
}

/** Screen off, the TV keeps running (a press on the remote wakes it). */
export function screenOff (): Promise<void> {
	if (!isWebOS()) return Promise.reject(new Error('not on a TV'));
	return root.screenOff();
}

export function restartTv (): Promise<void> {
	if (!isWebOS()) return Promise.reject(new Error('not on a TV'));
	return root.reboot();
}
