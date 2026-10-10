#!/usr/bin/env python3
"""Twenty-fourth patch layer: a Sound mode tile in Control Center (Standard, Clear Voice, Cinema, Music, Sports, Game Optimizer, AI Sound; settings category `sound`,
key `soundMode`, read and set through the Homebrew root service like the picture mode). The mute tile goes: OK on the volume bar mutes instead."""
import os
APP = os.path.expanduser('~/Developer/webos-launcher-tvos/app')
def P(p): return os.path.join(APP, p)
def sub(p, pairs):
    s = open(P(p)).read()
    for a, b in pairs:
        assert a in s, (p, a[:80])
        s = s.replace(a, b, 1)
    open(P(p), 'w').write(s)

sub('src/lib/tvcontrols.ts', [
 ("export const SLEEP_MINUTES =", "/** the TV's own names for the sound modes (Settings > Sound > Sound Mode) that every model offers */\nexport const SOUND_MODES = ['standard', 'news', 'movie', 'music', 'sports', 'game', 'aiSound'];\nexport const SOUND_LABEL: Record<string, string> = {standard: 'Standard', news: 'Clear Voice', movie: 'Cinema', music: 'Music', sports: 'Sports', game: 'Game Optimizer', aiSound: 'AI Sound', aiSoundPlus: 'AI Sound Pro', custom: 'Custom'};\nexport const SLEEP_MINUTES ="),
 ("	picture: string;\n	sleepMinutes: number;", "	picture: string;\n	sound: string;\n	sleepMinutes: number;"),
 ("const mock: Controls = {volume: 18, muted: false, picture: 'normal', sleepMinutes: 0, screensaver: 10};", "const mock: Controls = {volume: 18, muted: false, picture: 'normal', sound: 'standard', sleepMinutes: 0, screensaver: 10};"),
 ("	const out: Controls = {volume: 0, muted: false, picture: 'normal', sleepMinutes: 0, screensaver: 10};", "	const out: Controls = {volume: 0, muted: false, picture: 'normal', sound: 'standard', sleepMinutes: 0, screensaver: 10};"),
 ("	return Promise.all([audio, picture, sleep, saver]).then(() => out);", """	const sound = root("luna-send -n 1 luna://com.webos.settingsservice/getSystemSettings '{\\"category\\":\\"sound\\",\\"keys\\":[\\"soundMode\\"]}'").then((text) => {
		const m = JSON.parse(text) as {settings?: {soundMode?: string}};
		if (m.settings && m.settings.soundMode) out.sound = m.settings.soundMode;
	}).catch(() => undefined);
	return Promise.all([audio, picture, sleep, saver, sound]).then(() => out);"""),
 ("/** The TV's own screensaver start time.", """/** Only the TV's known sound mode names are ever put into the root command. */
export function setSoundMode (mode: string): Promise<void> {
	mock.sound = mode;
	if (!isWebOS()) return Promise.resolve();
	if (SOUND_MODES.indexOf(mode) === -1) return Promise.reject(new Error('unknown sound mode'));
	return root(`luna-send -n 1 luna://com.webos.settingsservice/setSystemSettings '{"category":"sound","settings":{"soundMode":"${mode}"}}'`).then((text) => { if (text.indexOf('"returnValue":false') !== -1) throw new Error('refused'); });
}

/** The TV's own screensaver start time."""),
])
sub('src/components/ControlCenter.tsx', [
 ("import {PICTURE_LABEL, PICTURE_MODES, SCREENSAVER_MINUTES,", "import {PICTURE_LABEL, PICTURE_MODES, SCREENSAVER_MINUTES, SOUND_LABEL, SOUND_MODES, setSoundMode,"),
 ("type CellId = 'mute' |", "type CellId = 'sound' |"),
 ("const GRID: CellId[][] = [['mute', 'picture'],", "const GRID: CellId[][] = [['sound', 'picture'],"),
 ("picture: 'normal', sleepMinutes: 0, screensaver: 10});", "picture: 'normal', sound: 'standard', sleepMinutes: 0, screensaver: 10});"),
 ("		if (cell === 'mute') { patch({muted: !v.muted}); setMuted(!v.muted).catch(fail('mute')); }", """		if (cell === 'volume') { patch({muted: !v.muted}); setMuted(!v.muted).catch(fail('mute')); }
		else if (cell === 'sound') {
			const next = SOUND_MODES[(Math.max(0, SOUND_MODES.indexOf(v.sound)) + 1) % SOUND_MODES.length];
			const before = v.sound;
			patch({sound: next}); setSoundMode(next).catch(() => { patch({sound: before}); onError("This TV didn't accept that sound mode"); });
		}"""),
 ("{wide('mute', values.muted ? 'muted' : 'speaker', 'Sound', values.muted ? 'Muted' : 'On', values.muted)}", "{wide('sound', 'speaker', 'Sound mode', SOUND_LABEL[values.sound] || values.sound)}"),
])
print('sound mode applied')
