#!/usr/bin/env python3
"""Forty-first patch layer: smoother move to the second row while the video wallpaper plays. Measured on the TV: row changes ran at about 19 fps with the video on
(37 of 81 frames over 40 ms), against nearly all frames on time with it off. The rows slid by animating `top`, which re-lays-out and repaints the glass over the
video every frame. With the video on the glass is a flat tint (no wallpaper copy to keep aligned), so the slide can use transform, which the compositor does alone."""
import os
p = os.path.expanduser('~/Developer/webos-launcher-tvos/app/src/theme/global.css')
s = open(p).read()
s += """
/* video wallpaper: slide the rows with transform (compositor only), not top (layout + repaint every frame) */
html.wp-video .rows { transition: transform 240ms cubic-bezier(0.2, 0.7, 0.2, 1), opacity 220ms ease; will-change: transform; }
html.wp-video .rows--lower { top: var(--layout-rows-top); transform: translateY(-300px); }
"""
open(p, 'w').write(s)
