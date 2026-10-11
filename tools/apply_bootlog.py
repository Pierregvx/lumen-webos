#!/usr/bin/env python3
"""Diagnostic layer (forty-fifth): records frames that took over 50 ms during the first 45 seconds after launch, in window.__boot as [ms since start, frame ms],
plus the moments the app list, icons and wallpaper became ready (window.__mark). Read it over the TV's inspector (ares-inspect). Costs one requestAnimationFrame
callback per frame for 45 s. Remove from the pipeline once the first-launch lag is understood."""
import os
p = os.path.expanduser('~/Developer/webos-launcher-tvos/app/src/main.tsx')
s = open(p).read()
a = "applyTokens();\n"
assert a in s
s = s.replace(a, """applyTokens();
// diagnostic: slow frames in the first 45 seconds (read over the inspector as window.__boot)
{
	const boot: number[][] = [];
	const w = window as unknown as {__boot: number[][]; __mark: (name: string) => void; __marks: (string | number)[][]};
	w.__boot = boot; w.__marks = []; w.__mark = (name: string) => { w.__marks.push([name, Math.round(performance.now())]); };
	let last = performance.now();
	const tick = (now: number) => { const d = now - last; last = now; if (d > 50 && boot.length < 200) boot.push([Math.round(now), Math.round(d)]); if (now < 45000) requestAnimationFrame(tick); };
	requestAnimationFrame(tick);
}
""", 1)
open(p, 'w').write(s)

a = os.path.expanduser('~/Developer/webos-launcher-tvos/app/src/app.tsx')
t = open(a).read()
mark = "(window as unknown as {__mark?: (n: string) => void}).__mark"
for old, new in (("				setApps(list);", "				setApps(list);\n				" + mark + "?.('apps');"), ("listInputs().then(setInputs)", "listInputs().then((l) => { setInputs(l); " + mark + "?.('inputs'); })")):
    assert old in t, old
    t = t.replace(old, new, 1)
open(a, 'w').write(t)
