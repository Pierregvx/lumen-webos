#!/usr/bin/env python3
"""Thirty-first patch layer: Dark mode becomes Off / On / Auto (Auto = dark from 19:00 to 06:00). Replaces the on/off switch of apply_dark and apply_cc_dark."""
import os
APP = os.path.expanduser('~/Developer/webos-launcher-tvos/app')
def P(p): return os.path.join(APP, p)
def sub(p, pairs):
    s = open(P(p)).read()
    for a, b in pairs:
        assert a in s, (p, a[:80])
        s = s.replace(a, b, 1)
    open(P(p), 'w').write(s)

sub('src/lib/storage.ts', [
 ("	darkMode: boolean;", "	darkMode: string;"),
 ("	darkMode: false,\n", "	darkMode: 'off',\n"),
 ("			darkMode: parsed.darkMode === true,\n", "			darkMode: parsed.darkMode === 'auto' ? 'auto' : (parsed.darkMode as unknown) === true || parsed.darkMode === 'on' ? 'on' : 'off',\n"),
])
sub('src/lib/i18n.ts', [
 ("export function setClockMode", "const NEXT_DARK: Record<string, string> = {off: 'on', on: 'auto', auto: 'off'};\nexport function nextDark (mode: string): string { return NEXT_DARK[mode] || 'off'; }\nexport function isDark (mode: string, now = new Date()): boolean {\n	const h = now.getHours();\n	return mode === 'on' || (mode === 'auto' && (h >= 19 || h < 6));\n}\nexport function setClockMode"),
])
sub('src/app.tsx', [
 ("import {LANGS, setClockMode,", "import {isDark, LANGS, nextDark, setClockMode,"),
 ("	document.documentElement.classList.toggle('dark', config.darkMode);\n", ""),
 ("	useEffect(() => setVideoChoice(config.videoClip),", "	useEffect(() => {\n		const apply = () => document.documentElement.classList.toggle('dark', isDark(config.darkMode));\n		apply();\n		const id = window.setInterval(apply, 60000);\n		return () => window.clearInterval(id);\n	}, [config.darkMode]);\n	useEffect(() => setVideoChoice(config.videoClip),"),
 ("description: 'Darker panels and dock, and a dimmer wallpaper or video behind them. Easier on the eyes in a dark room.',\n			value: config.darkMode\n", "description: 'Darker panels and dock, and a dimmer wallpaper or video behind them. Auto is dark from 7 pm to 6 am.',\n			value: config.darkMode !== 'off',\n			valueText: config.darkMode === 'on' ? 'On' : config.darkMode === 'auto' ? 'Auto' : 'Off'\n"),
 ("updateConfig({...config, darkMode: !config.darkMode});", "updateConfig({...config, darkMode: nextDark(config.darkMode)});"),
 ("onDarkMode={() => updateConfig({...configRef.current, darkMode: !configRef.current.darkMode})}", "onDarkMode={() => updateConfig({...configRef.current, darkMode: nextDark(configRef.current.darkMode)})}"),
])
sub('src/components/ControlCenter.tsx', [
 ("	darkMode: boolean;", "	darkMode: string;"),
 ("darkMode ? tr('On') : tr('Off'), darkMode)}", "darkMode === 'on' ? tr('On') : darkMode === 'auto' ? tr('Auto') : tr('Off'), darkMode !== 'off')}"),
])
