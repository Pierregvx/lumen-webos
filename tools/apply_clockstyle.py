#!/usr/bin/env python3
"""Fifty-first patch layer: the time like Apple's. The colon was a wide gap between the hour and the minutes and sat low; now the digits are fixed-width (so the time
does not jiggle each minute), the colon is a narrow, centred, slightly softer mark raised to the middle of the digits (the font's `case` feature), no letter gaps."""
import os
APP = os.path.expanduser('~/Developer/webos-launcher-tvos/app')
def P(p): return os.path.join(APP, p)
c = open(P('src/components/Clock.tsx')).read()
a = "				{time}\n"
assert a in c
c = c.replace(a, "				<span>{time.split(':')[0]}</span><span class=\"clock__colon\">:</span><span>{time.split(':')[1]}</span>\n", 1)
open(P('src/components/Clock.tsx'), 'w').write(c)
s = open(P('src/theme/global.css')).read()
s += """
/* the time: fixed-width digits, a narrow centred colon raised to the middle of the figures */
.clock__time { display: inline-flex; align-items: center; letter-spacing: 0 !important; font-variant-numeric: tabular-nums; font-feature-settings: 'tnum' 1, 'case' 1; }
.clock__colon { display: inline-block; width: 0.34em; text-align: center; opacity: 0.78; margin: 0; padding: 0; position: relative; top: -0.04em; }
.clock__period { align-self: center; }
"""
open(P('src/theme/global.css'), 'w').write(s)
