#!/usr/bin/env python3
"""Twenty-second patch layer: the TV's own screensaver start time ("Screen Saver Standby Time": 3, 10, 20 or 30 minutes; settings category `option`, key
`screenSaverTimer`) can be changed from Control Center. Start-now moves to the round buttons. The launcher's own idle option is removed (the TV's timer works everywhere)."""
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
 ("export const SLEEP_MINUTES = [0, 15, 30, 60, 90, 120];", "export const SLEEP_MINUTES = [0, 15, 30, 60, 90, 120];\n/** the choices LG's own Settings offers for \"Screen Saver Standby Time\" */\nexport const SCREENSAVER_MINUTES = [3, 10, 20, 30];"),
 ("	sleepMinutes: number;\n}", "	sleepMinutes: number;\n	/** minutes of inactivity before the TV starts its screensaver */\n	screensaver: number;\n}"),
 ("picture: 'normal', sleepMinutes: 0};\n\nconst root", "picture: 'normal', sleepMinutes: 0, screensaver: 10};\n\nconst root"),
 ("	const out: Controls = {volume: 0, muted: false, picture: 'normal', sleepMinutes: 0};", "	const out: Controls = {volume: 0, muted: false, picture: 'normal', sleepMinutes: 0, screensaver: 10};"),
 ("	return Promise.all([audio, picture, sleep]).then(() => out);", """	const saver = root("luna-send -n 1 luna://com.webos.settingsservice/getSystemSettings '{\\"category\\":\\"option\\",\\"keys\\":[\\"screenSaverTimer\\"]}'").then((text) => {
		const m = JSON.parse(text) as {settings?: {screenSaverTimer?: string}};
		const minutes = Number(m.settings && m.settings.screenSaverTimer);
		if (SCREENSAVER_MINUTES.indexOf(minutes) !== -1) out.screensaver = minutes;
	}).catch(() => undefined);
	return Promise.all([audio, picture, sleep, saver]).then(() => out);"""),
 ("/** 0 cancels the timer. */", """/** The TV's own screensaver start time. Only the TV's known choices are ever put into the root command. */
export function setScreensaverTime (minutes: number): Promise<void> {
	mock.screensaver = minutes;
	if (!isWebOS()) return Promise.resolve();
	if (SCREENSAVER_MINUTES.indexOf(minutes) === -1) return Promise.reject(new Error('unknown screensaver time'));
	return root(`luna-send -n 1 luna://com.webos.settingsservice/setSystemSettings '{"category":"option","settings":{"screenSaverTimer":"${minutes}"}}'`).then(() => undefined);
}

/** 0 cancels the timer. */"""),
])
sub('src/components/ControlCenter.tsx', [
 ("import {PICTURE_LABEL, PICTURE_MODES, SLEEP_MINUTES, readControls,", "import {PICTURE_LABEL, PICTURE_MODES, SCREENSAVER_MINUTES, SLEEP_MINUTES, readControls,"),
 ("restartTv, screenOff, setMuted,", "restartTv, screenOff, setMuted, setScreensaverTime,"),
 ("'sleep' | 'screensaver' | 'home'", "'sleep' | 'saver' | 'startsaver' | 'home'"),
 ("['sleep', 'screensaver'], ['home', 'settings', 'screenoff', 'restart']", "['sleep', 'saver'], ['home', 'settings', 'startsaver', 'screenoff', 'restart']"),
 ("picture: 'normal', sleepMinutes: 0});", "picture: 'normal', sleepMinutes: 0, screensaver: 10});"),
 ("		else if (cell === 'screensaver') onAction('screensaver');", """		else if (cell === 'saver') {
			const next = SCREENSAVER_MINUTES[(Math.max(0, SCREENSAVER_MINUTES.indexOf(v.screensaver)) + 1) % SCREENSAVER_MINUTES.length];
			patch({screensaver: next}); setScreensaverTime(next).catch(fail('the screensaver time'));
		}
		else if (cell === 'startsaver') onAction('screensaver');"""),
 ("{wide('screensaver', 'screensaver', 'Screensaver', 'Start now')}", "{wide('saver', 'screensaver', 'Screensaver', `After ${values.screensaver} min`)}"),
 ("					{round('screenoff', 'power', 'Screen off')}", "					{round('startsaver', 'screensaver', 'Start now')}\n					{round('screenoff', 'power', 'Screen off')}"),
])
# the launcher's own idle option goes: the TV's timer (above) works in every app
s = open(P('src/app.tsx')).read()
i = s.index("		{\n			id: OPTION.idle,")
j = s.index("		},\n", i) + len("		},\n")
open(P('src/app.tsx'), 'w').write(s[:i] + s[j:])
css = open(P('src/theme/global.css')).read()
css += "\n/* five round buttons in Control Center */\n.cc__round { width: 112px; }\n.cc__row--round { padding: 4px 4px 0; }\n"
open(P('src/theme/global.css'), 'w').write(css)
# the old Quick Controls panel (replaced by Control Center) is no longer used
if os.path.exists(P('src/components/QuickControls.tsx')): os.remove(P('src/components/QuickControls.tsx'))
print('screensaver time applied')
