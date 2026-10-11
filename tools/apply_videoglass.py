#!/usr/bin/env python3
"""Thirty-fourth patch layer: glass over the video wallpaper. A flat grey fill looked heavy and dull; the dock and panels are now see-through with a light
tint, so the moving picture shows through (no live blur: too heavy for the TV's GPU). Dark mode over video is the same, tinted darker."""
import os
p = os.path.expanduser('~/Developer/webos-launcher-tvos/app/src/theme/global.css')
s = open(p).read()
s += """
/* glass over the video: see-through with a light tint (later and more specific than the plain fills above) */
html.wp-video { --wp-blur: linear-gradient(rgba(20, 24, 38, 0.30), rgba(20, 24, 38, 0.30)) !important; --wp-bg: linear-gradient(rgba(20, 24, 38, 0.46), rgba(20, 24, 38, 0.46)) !important; }
html.dark.wp-video { --wp-blur: linear-gradient(rgba(8, 10, 18, 0.50), rgba(8, 10, 18, 0.50)) !important; --wp-bg: linear-gradient(rgba(8, 10, 18, 0.62), rgba(8, 10, 18, 0.62)) !important; }
"""
open(p, 'w').write(s)
