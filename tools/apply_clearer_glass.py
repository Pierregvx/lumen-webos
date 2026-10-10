#!/usr/bin/env python3
"""Tenth patch layer (last): clearer, less frosted glass. Lighter tints on every glass shape and a less blurred wallpaper copy."""
import os, re
APP = os.path.expanduser('~/Developer/webos-launcher-tvos/app')
def P(p): return os.path.join(APP, p)

css = open(P('src/theme/global.css')).read()
def swap(a, b):
    global css
    assert a in css, a
    css = css.replace(a, b)
swap('rgba(255, 255, 255, 0.26) 0%, rgba(255, 255, 255, 0.07) 42%, rgba(255, 255, 255, 0.16) 100%', 'rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.03) 42%, rgba(255, 255, 255, 0.09) 100%')
swap('background-color: rgba(30, 36, 50, 0.30);', 'background-color: rgba(30, 36, 50, 0.10);')
css = css.replace('rgba(255, 255, 255, 0.50), rgba(255, 255, 255, 0.20) 55%, rgba(255, 255, 255, 0.34)', 'rgba(255, 255, 255, 0.40), rgba(255, 255, 255, 0.14) 55%, rgba(255, 255, 255, 0.26)')
css = css.replace('rgba(255, 255, 255, 0.44), rgba(255, 255, 255, 0.16) 55%, rgba(255, 255, 255, 0.30)', 'rgba(255, 255, 255, 0.36), rgba(255, 255, 255, 0.12) 55%, rgba(255, 255, 255, 0.24)')
css = css.replace('rgba(28, 34, 48, 0.34)', 'rgba(28, 34, 48, 0.20)')
open(P('src/theme/global.css'), 'w').write(css)

s = open(P('src/lib/wallpaper.ts')).read()
assert "'&blur=5'" in s
open(P('src/lib/wallpaper.ts'), 'w').write(s.replace("'&blur=5'", "'&blur=3'"))
print('clearer glass applied')
