#!/usr/bin/env python3
"""Thirty-seventh patch layer: while the dock is hidden, the top-right buttons fade out too and a small chevron at the bottom (like Apple's) shows how to get the dock back."""
import os
APP = os.path.expanduser('~/Developer/webos-launcher-tvos/app')
def P(p): return os.path.join(APP, p)
p = P('src/screens/Home.tsx')
s = open(p).read()
a = "<div class={`screen${n.zone === 'rows' && rowIndex >= 1 ? ' screen--lower' : ''}${n.moving ? ' screen--moving' : ''}`}>"
assert a in s
s = s.replace(a, "<div class={`screen${n.zone === 'rows' && rowIndex >= 1 ? ' screen--lower' : ''}${n.moving ? ' screen--moving' : ''}${n.dockHidden ? ' screen--dockhidden' : ''}`}>")
b = "			<Status weatherText={weatherText} showPeriod={showPeriod} />"
assert b in s
s = s.replace(b, b + "\n			<div class=\"dockhint\" onClick={() => { n.dockHidden = false; render(); }}><svg viewBox=\"0 0 48 28\" aria-hidden=\"true\"><path d=\"M6 22 24 6l18 16\" /></svg></div>")
open(p, 'w').write(s)
c = P('src/theme/global.css')
t = open(c).read()
t += """
/* dock hidden: the top-right buttons go too, and a small chevron at the bottom shows the way back */
.topbar { transition: opacity 220ms ease; }
.screen--dockhidden .topbar { opacity: 0; pointer-events: none; }
.dockhint { position: absolute; left: 50%; bottom: 34px; margin-left: -26px; width: 52px; height: 30px; opacity: 0; transition: opacity 260ms ease; pointer-events: none; }
.dockhint svg { width: 52px; height: 30px; fill: none; stroke: rgba(255, 255, 255, 0.62); stroke-width: 3.2; stroke-linecap: round; stroke-linejoin: round; filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.25)); }
.screen--dockhidden .dockhint { opacity: 1; pointer-events: auto; }
"""
open(c, 'w').write(t)
