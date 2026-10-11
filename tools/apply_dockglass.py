#!/usr/bin/env python3
"""Forty-second patch layer: a more see-through dock bar. The bar (the glass behind the first row) is the blurred wallpaper copy; fading that pseudo-element a little lets
the sharp wallpaper behind show through, without a live blur (the pseudo-element has no children, so the icons stay fully opaque)."""
import os
p = os.path.expanduser('~/Developer/webos-launcher-tvos/app/src/theme/global.css')
s = open(p).read()
s += "\n/* dock bar: a bit more see-through */\n.row:not(.row--dock)::before { opacity: 0.74; }\n"
open(p, 'w').write(s)
