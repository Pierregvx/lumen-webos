#!/usr/bin/env python3
"""Twentieth patch layer: Home-button support. The launcher's own "LG Home" button tells the TV-side watcher (tools/tv/watch.sh) to let LG Home open this once."""
import os
APP = os.path.expanduser('~/Developer/webos-launcher-tvos/app')
def P(p): return os.path.join(APP, p)
s = open(P('src/lib/launch.ts')).read()
a = "export function launchLgHome (): Promise<void> {\n	return launchApp(SYSTEM_APP.lgHome);\n}"
assert a in s
b = """export function launchLgHome (): Promise<void> {
	// with the Home-button watcher installed, LG Home would bounce straight back here: the flag file lets it open (see tools/tv/watch.sh)
	return lunaCall(LUNA.homebrewExec, {command: 'touch /tmp/allow_lg_home'}, 4000)
		.catch(() => undefined)
		.then(() => launchApp(SYSTEM_APP.lgHome));
}"""
open(P('src/lib/launch.ts'), 'w').write(s.replace(a, b))
print('homekey applied')
