#!/usr/bin/env python3
"""Twenty-third patch layer: an "Art mode" round button in Control Center that opens the Frame app (works.partridge.frame, built in ~/Developer/webos-frame)."""
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
 ("export type CenterAction = 'lg-home' | 'settings' | 'screensaver';", "export type CenterAction = 'lg-home' | 'settings' | 'screensaver' | 'art';"),
 ("'sleep' | 'saver' | 'startsaver' | 'home'", "'sleep' | 'saver' | 'startsaver' | 'art' | 'home'"),
 ("['home', 'settings', 'startsaver', 'screenoff', 'restart']", "['home', 'settings', 'art', 'startsaver', 'screenoff', 'restart']"),
 ("		else if (cell === 'startsaver') onAction('screensaver');", "		else if (cell === 'art') onAction('art');\n		else if (cell === 'startsaver') onAction('screensaver');"),
 ("					{round('startsaver', 'screensaver', 'Start now')}", "					{round('art', 'picture', 'Art mode')}\n					{round('startsaver', 'screensaver', 'Start now')}"),
])
sub('src/app.tsx', [
 ("a === 'lg-home' ? {key: MISC.lgHome, label: 'LG Home'} : {key: 'screensaver', label: 'Screensaver'}", "a === 'lg-home' ? {key: MISC.lgHome, label: 'LG Home'} : a === 'art' ? {key: 'works.partridge.frame', label: 'Frame'} : {key: 'screensaver', label: 'Screensaver'}"),
])
css = open(P('src/theme/global.css')).read()
css += "\n/* six round buttons in Control Center */\n.cc__round { width: 100px; }\n.cc__label { font-size: 19px; }\n"
open(P('src/theme/global.css'), 'w').write(css)
print('art button applied')
