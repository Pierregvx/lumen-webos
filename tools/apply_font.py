#!/usr/bin/env python3
"""Seventeenth patch layer: the app font is Geist (SIL OFL; from the `geist` npm package, tools/branding/geist-wght.woff2) instead of Inter."""
import os, shutil
ROOT = os.path.expanduser('~/Developer/webos-launcher-tvos')
APP = f'{ROOT}/app'
def P(p): return os.path.join(APP, p)
shutil.copy(f'{ROOT}/tools/branding/geist-wght.woff2', P('src/assets/geist-wght.woff2'))
css = open(P('src/theme/global.css')).read()
a = "font-family: 'Inter Variable';"; b = "src: url('../assets/inter-latin-wght.woff2') format('woff2');"
assert a in css and b in css
css = css.replace(a, "font-family: 'Geist Variable';").replace(b, "src: url('../assets/geist-wght.woff2') format('woff2');")
open(P('src/theme/global.css'), 'w').write(css)
t = open(P('src/theme/tokens.ts')).read()
assert '"Inter Variable"' in t
open(P('src/theme/tokens.ts'), 'w').write(t.replace('"Inter Variable"', '"Geist Variable"'))
print('font applied: Geist')
