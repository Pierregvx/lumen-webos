#!/usr/bin/env python3
"""Forty-ninth patch layer: the SF Pro typeface (as on tvOS) when the private font file exists. app/public/private/sf.woff2 is made by tools/make_sf_font.py on your
own Mac and is never committed or released; without it the font-face is simply not found and Geist is used as before."""
import os
APP = os.path.expanduser('~/Developer/webos-launcher-tvos/app')
def P(p): return os.path.join(APP, p)
t = open(P('src/theme/tokens.ts')).read()
a = "family: '\"Geist Variable\","
assert a in t
open(P('src/theme/tokens.ts'), 'w').write(t.replace(a, "family: '\"SF Private\", \"Geist Variable\",", 1))
m = open(P('src/main.tsx')).read()
b = "applyTokens();\n"
assert b in m
open(P('src/main.tsx'), 'w').write(m.replace(b, b + "// SF Pro, only when the private font file was added to this build (see tools/make_sf_font.py); otherwise nothing happens and Geist is used\nif ('FontFace' in window) {\n\tnew FontFace('SF Private', `url(${new URL('private/sf.woff2', location.href).href})`, {weight: '1 1000'}).load().then((face) => { document.fonts.add(face); }).catch(() => undefined);\n}\n", 1))
