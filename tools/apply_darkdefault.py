#!/usr/bin/env python3
"""Fiftieth patch layer: Dark is the default Appearance (a fresh install, or a saved config without an Appearance value, starts Dark); Light and Auto stay opt-in.
Dark no longer dims the wallpaper or the video (that was only the css lines removed from apply_dark.py)."""
import os
p = os.path.expanduser('~/Developer/webos-launcher-tvos/app/src/lib/storage.ts')
s = open(p).read()
s = s.replace("darkMode: 'off',\n", "darkMode: 'on',\n", 1)
a = "parsed.darkMode === 'auto' ? 'auto' : (parsed.darkMode as unknown) === true || parsed.darkMode === 'on' ? 'on' : 'off'"
assert a in s or "parsed.darkMode === 'off' ? 'off' : 'on'" in s
s = s.replace(a, "parsed.darkMode === 'auto' ? 'auto' : parsed.darkMode === 'off' ? 'off' : 'on'")
open(p, 'w').write(s)
