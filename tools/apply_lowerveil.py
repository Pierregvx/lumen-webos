#!/usr/bin/env python3
"""Fifty-second patch layer: found while taking screenshots. Going down to the second row puts an OPAQUE dark backdrop (the strongly blurred wallpaper copy) over the whole
screen, which hid the video wallpaper completely, and it stayed when the dock slid away, so the aerial view showed a flat dark screen. Over a video the backdrop is now only a
translucent dark veil, and it is gone while the dock is away."""
import os
p = os.path.expanduser('~/Developer/webos-launcher-tvos/app/src/theme/global.css')
s = open(p).read()
s += """
/* video wallpaper: the lower-rows backdrop is a see-through veil, not an opaque panel; none at all while the dock is away */
html.wp-video .screen--lower::before { background-color: transparent; background-image: linear-gradient(rgba(0, 0, 0, 0.42), rgba(0, 0, 0, 0.42)); }
.screen--dockhidden::before { display: none; }
/* Settings labels read as secondary text, not muted grey, on the frosted background */
.wp__title { color: var(--color-text-secondary); }
.wp__item--focused .wp__title { color: var(--color-text-primary); }
"""
open(p, 'w').write(s)
