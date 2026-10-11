#!/usr/bin/env python3
"""Twenty-ninth patch layer: Dark mode and Clock format tiles in the Control Center (a new row between the sleep/screensaver row and the round buttons)."""
import os
APP = os.path.expanduser('~/Developer/webos-launcher-tvos/app')
def P(p): return os.path.join(APP, p)
def sub(p, pairs):
    s = open(P(p)).read()
    for a, b in pairs:
        assert a in s, (p, a[:80])
        s = s.replace(a, b, 1)
    open(P(p), 'w').write(s)

sub('src/components/ControlCenter.tsx', [
 ("	onAction: (action: CenterAction) => void;\n}", "	onAction: (action: CenterAction) => void;\n	darkMode: boolean;\n	clockFormat: string;\n	onDarkMode: () => void;\n	onClockFormat: () => void;\n}"),
 ("'volume';\n\n/** The layout", "'volume' | 'dark' | 'clock';\n\n/** The layout"),
 ("['sleep', 'saver'], [", "['sleep', 'saver'], ['dark', 'clock'], ["),
 ("({onClose, onError, onAction}: Props) {", "({onClose, onError, onAction, darkMode, clockFormat, onDarkMode, onClockFormat}: Props) {\n	const outer = useRef({darkMode, clockFormat, onDarkMode, onClockFormat});\n	outer.current = {darkMode, clockFormat, onDarkMode, onClockFormat};"),
 ("		else if (cell === 'art') onAction('art');", "		else if (cell === 'dark') outer.current.onDarkMode();\n		else if (cell === 'clock') outer.current.onClockFormat();\n		else if (cell === 'art') onAction('art');"),
 ("				<div class=\"cc__row cc__row--round\">", "				<div class=\"cc__row\">\n					{wide('dark', 'screensaver', tr('Dark mode'), darkMode ? tr('On') : tr('Off'), darkMode)}\n					{wide('clock', 'timer', tr('Clock'), clockFormat === '12h' ? tr('12-hour') : clockFormat === '24h' ? tr('24-hour') : tr('Auto'), clockFormat !== 'auto')}\n				</div>\n				<div class=\"cc__row cc__row--round\">"),
])
sub('src/lib/i18n.ts', [
 ("const TABLE: Record<string, string[]> = {", "const TABLE: Record<string, string[]> = {\n\t\"On\": [\"Ein\", \"Activado\", \"Activé\", \"Attivo\", \"Ligado\", \"Aan\", \"Açık\", \"चालू\"],"),
])
sub('src/app.tsx', [
 ("			{controls && <ControlCenter\n", "			{controls && <ControlCenter\n				darkMode={config.darkMode}\n				clockFormat={config.clockFormat}\n				onDarkMode={() => updateConfig({...configRef.current, darkMode: !configRef.current.darkMode})}\n				onClockFormat={() => { const modes = ['auto', '12h', '24h']; const c = configRef.current; updateConfig({...c, clockFormat: modes[(modes.indexOf(c.clockFormat) + 1) % modes.length]}); }}\n"),
])
