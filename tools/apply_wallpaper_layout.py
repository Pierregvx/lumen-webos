#!/usr/bin/env python3
"""Fifteenth patch layer: the Wallpaper picker uses more of the screen (a taller window, more rows at once)."""
import os
APP = os.path.expanduser('~/Developer/webos-launcher-tvos/app')
def P(p): return os.path.join(APP, p)
s = open(P('src/components/WallpaperPicker.tsx')).read()
a = "const VIEWPORT_HEIGHT = 640;"
assert a in s
open(P('src/components/WallpaperPicker.tsx'), 'w').write(s.replace(a, "const VIEWPORT_HEIGHT = 700;").replace("const ROWS_AFTER = 3;", "const ROWS_AFTER = 4;"))
css = open(P('src/theme/global.css')).read()
css += "\n/* ---------- taller wallpaper window ---------- */\n.wp__viewport { height: 700px; }\n"
open(P('src/theme/global.css'), 'w').write(css)
print('wallpaper layout applied')
