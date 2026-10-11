#!/usr/bin/env python3
"""Twenty-eighth patch layer: a Dark mode option (Settings > Options). Dark glass for the dock and panels, a dimmer wallpaper or video behind them."""
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
 ("	/** the last apps opened, newest first */", "	/** dark glass and a dimmer wallpaper */\n	darkMode: boolean;\n	/** the last apps opened, newest first */"),
 ("	language: 'auto',\n", "	language: 'auto',\n	darkMode: false,\n"),
 ("			language: typeof parsed.language", "			darkMode: parsed.darkMode === true,\n			language: typeof parsed.language"),
])
sub('src/lib/i18n.ts', [
 ("const TABLE: Record<string, string[]> = {", "const TABLE: Record<string, string[]> = {\n\t\"Dark mode\": [\"Dunkelmodus\", \"Modo oscuro\", \"Mode sombre\", \"Modalità scura\", \"Modo escuro\", \"Donkere modus\", \"Karanlık mod\", \"डार्क मोड\"],"),
])
sub('src/app.tsx', [
 ("nightDim: 'night-dim',", "nightDim: 'night-dim', darkMode: 'dark-mode',"),
 ("	setClockMode(config.clockFormat);\n", "	setClockMode(config.clockFormat);\n	document.documentElement.classList.toggle('dark', config.darkMode);\n"),
 ("], [config.language, config.clockFormat,", "], [config.darkMode, config.language, config.clockFormat,"),
 ("		{\n			id: OPTION.language,", "		{\n			id: OPTION.darkMode,\n			label: 'Dark mode',\n			description: 'Darker panels and dock, and a dimmer wallpaper or video behind them. Easier on the eyes in a dark room.',\n			value: config.darkMode\n		},\n		{\n			id: OPTION.language,"),
 ("		else if (optionId === OPTION.language) {", "		else if (optionId === OPTION.darkMode) updateConfig({...config, darkMode: !config.darkMode});\n		else if (optionId === OPTION.language) {"),
])
p = P('src/theme/global.css')
s = open(p).read()
s += """
/* dark mode: the original blurred-wallpaper glass (the picture or video is not dimmed) */
"""
open(p, 'w').write(s)
