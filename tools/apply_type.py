#!/usr/bin/env python3
"""Sixteenth patch layer: tvOS-like type. Bigger, semibold focus labels under the tiles; smooth, slightly tighter text across the app (Inter, the closest open
font to Apple's SF Pro: SF itself is licensed for Apple platforms only and cannot be bundled on a TV)."""
import os
APP = os.path.expanduser('~/Developer/webos-launcher-tvos/app')
def P(p): return os.path.join(APP, p)
css = open(P('src/theme/global.css')).read()
a = "--font-tile-label: 20px;"
assert a in css
css = css.replace(a, "--font-tile-label: 28px;")
css = css.replace("--font-tile-label: 22px;", "--font-tile-label: 24px;")
css += """
/* ---------- tvOS-like type ---------- */
html, body { -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; font-optical-sizing: auto; letter-spacing: -0.011em; }
.tile__label { font-weight: 600; letter-spacing: -0.015em; line-height: 1.15; text-shadow: 0 2px 14px rgba(0, 0, 0, 0.55), 0 0 2px rgba(0, 0, 0, 0.25); text-align: center; }
.panel .tile__label { font-weight: 600; }
.settings__title, .panel__title, .cc__title { font-weight: 600; letter-spacing: -0.02em; }
.option__label { font-weight: 600; letter-spacing: -0.014em; }
.tab, .wp__chip, .settings__button { font-weight: 600; }
"""
open(P('src/theme/global.css'), 'w').write(css)
print('type applied')
