#!/usr/bin/env python3
"""Twenty-first patch layer: the TV calls, corrected against the real TV. Volume is read with com.webos.audio/getVolume (there is no getStatus), the picture mode
is read and set through the Homebrew root service (the public settings bus is denied) with the TV's own mode names, the sleep timer takes `sleepTimeMinute`
and reports `sleepTimeSecond`."""
import os
APP = os.path.expanduser('~/Developer/webos-launcher-tvos/app')
def P(p): return os.path.join(APP, p)
def sub(p, pairs):
    s = open(P(p)).read()
    for a, b in pairs:
        assert a in s, (p, a[:80])
        s = s.replace(a, b, 1)
    open(P(p), 'w').write(s)

open(P('src/lib/tvcontrols.ts'), 'w').write("""// Control Center: what the TV lets a normal web app do (volume, mute, sleep timer) and what needs the Homebrew Channel's root service
// (picture mode, screen off, restart). Fixed commands only. Off the TV (the dev preview) the values are kept in memory.

import {LUNA} from '../config/constants';
import {isWebOS, lunaCall} from './luna';

const AUDIO = 'luna://com.webos.audio/';
const SLEEP = 'luna://com.webos.service.tvReservationAgent/timer/sleep/';

/** the TV's own names for the picture modes it offers on an SDR picture */
export const PICTURE_MODES = ['vivid', 'normal', 'eco', 'cinema', 'sports', 'game', 'filmMaker'];
export const PICTURE_LABEL: Record<string, string> = {vivid: 'Vivid', normal: 'Standard', eco: 'Eco', cinema: 'Cinema', sports: 'Sports', game: 'Game', filmMaker: 'FILMMAKER', expert1: 'Expert (bright room)', expert2: 'Expert (dark room)', hdrEffect: 'HDR Effect', hdrStandard: 'HDR Standard', hdrCinema: 'HDR Cinema', hdrGame: 'HDR Game'};
export const SLEEP_MINUTES = [0, 15, 30, 60, 90, 120];

export interface Controls {
	volume: number;
	muted: boolean;
	picture: string;
	sleepMinutes: number;
}

const mock: Controls = {volume: 18, muted: false, picture: 'normal', sleepMinutes: 0};

const root = (command: string) => lunaCall<{stdoutString?: string}>(LUNA.homebrewExec, {command}, 6000).then((r) => r.stdoutString || '');

export function readControls (): Promise<Controls> {
	if (!isWebOS()) return Promise.resolve({...mock});
	const out: Controls = {volume: 0, muted: false, picture: 'normal', sleepMinutes: 0};
	const audio = lunaCall<{volume?: number; muteStatus?: boolean}>(AUDIO + 'getVolume', {}).then((r) => {
		out.volume = Number(r.volume) || 0;
		out.muted = r.muteStatus === true;
	}).catch(() => undefined);
	const picture = root(\"luna-send -n 1 luna://com.webos.settingsservice/getSystemSettings '{\\\\\\"category\\\\\\":\\\\\\"picture\\\\\\",\\\\\\"keys\\\\\\":[\\\\\\"pictureMode\\\\\\"]}'\").then((text) => {
		const m = JSON.parse(text) as {settings?: {pictureMode?: string}};
		if (m.settings && m.settings.pictureMode) out.picture = m.settings.pictureMode;
	}).catch(() => undefined);
	const sleep = lunaCall<{sleepTimeSecond?: number}>(SLEEP + 'getRemainTime', {}).then((r) => {
		const minutes = Math.ceil((Number(r.sleepTimeSecond) || 0) / 60);
		out.sleepMinutes = minutes <= 0 ? 0 : SLEEP_MINUTES.filter((m) => m >= minutes)[0] || SLEEP_MINUTES[SLEEP_MINUTES.length - 1];
	}).catch(() => undefined);
	return Promise.all([audio, picture, sleep]).then(() => out);
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
	return root(`luna-send -n 1 luna://com.webos.settingsservice/setSystemSettings '{\\"category\\":\\"picture\\",\\"settings\\":{\\"pictureMode\\":\\"${mode}\\"}}'`).then(() => undefined);
}

/** 0 cancels the timer. */
export function setSleepTimer (minutes: number): Promise<void> {
	mock.sleepMinutes = minutes;
	if (!isWebOS()) return Promise.resolve();
	return lunaCall(SLEEP + 'add', {sleepTimeMinute: minutes}).then(() => undefined);
}

/** Screen off, the TV keeps running (a press on the remote wakes it). */
export function screenOff (): Promise<void> {
	if (!isWebOS()) return Promise.reject(new Error('not on a TV'));
	return root(\"luna-send -n 1 luna://com.webos.service.tvpower/power/turnOffScreen '{}'\").then(() => undefined);
}

export function restartTv (): Promise<void> {
	if (!isWebOS()) return Promise.reject(new Error('not on a TV'));
	return root(\"luna-send -n 1 luna://com.webos.service.tvpower/power/reboot '{\\\\\\"reason\\\\\\":\\\\\\"restart\\\\\\"}'\").then(() => undefined);
}
""")

sub('src/lib/status.ts', [
 ("	const audio = lunaCall<{muted?: boolean; mute?: boolean; volumeStatus?: {muteStatus?: boolean}}>('luna://com.webos.audio/getStatus', {}).then((r) => {\n		out.muted = !!((r.volumeStatus && r.volumeStatus.muteStatus) || r.muted || r.mute);\n	}).catch(() => undefined);",
  "	const audio = lunaCall<{muteStatus?: boolean}>('luna://com.webos.audio/getVolume', {}).then((r) => {\n		out.muted = r.muteStatus === true;\n	}).catch(() => undefined);"),
 ("		out.sleep = Object.keys(r).some((k) => /remain/i.test(k) && Number(r[k]) > 0);", "		out.sleep = Number(r.sleepTimeSecond) > 0;"),
])
sub('src/components/ControlCenter.tsx', [("picture: 'standard', sleepMinutes: 0});", "picture: 'normal', sleepMinutes: 0});")])
# the shell commands above need plain quotes inside their single-quoted JSON
f = P('src/lib/tvcontrols.ts')
text = open(f).read().replace('\\\\\\"', '\\"')
open(f, 'w').write(text)
print('tvfix applied')
