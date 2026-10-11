#!/usr/bin/env python3
"""Forty-seventh patch layer: spread the launch work out. Measured on the TV (boot log, cold start): even with the icon colours cached the launcher stalled about
1 s twice while the app list and its pictures appeared, and 1.4 s more when the video started (5 s in). Now:
 - only the first row is drawn at launch; the other rows (hidden until you go down to them) are drawn 3.5 s later, or at the first key press
 - the video wallpaper starts once the launcher has settled (6 s after launch) and no key was pressed for 1.5 s, so its start-up hitch does not land on a key press"""
import os
APP = os.path.expanduser('~/Developer/webos-launcher-tvos/app')
def P(p): return os.path.join(APP, p)
def sub(p, pairs):
    s = open(P(p)).read()
    for a, b in pairs:
        assert a in s, (p, a[:80])
        s = s.replace(a, b)
    open(P(p), 'w').write(s)

sub('src/screens/Home.tsx', [
 ("	const [, redraw] = useState(0);", "	const [late, setLate] = useState(false);   // the rows below the first are drawn a moment after launch\n	useEffect(() => { const id = window.setTimeout(() => setLate(true), 3500); return () => window.clearTimeout(id); }, []);\n	const [, redraw] = useState(0);"),
 ("		const n = nav.current;\n		const {rows: allRows,", "		const n = nav.current;\n		setLate(true);\n		const {rows: allRows,"),
 ("						items={row.items}\n", "						items={i > 0 && !late ? [] : row.items}\n"),
])
sub('src/lib/wallpaperVideo.ts', [
 ("let failures = 0;\n", "let failures = 0;\nlet lastKey = 0;\nif (typeof document !== 'undefined') document.addEventListener('keydown', () => { lastKey = Date.now(); }, true);\n\n/** the video's start-up costs the TV a moment: begin when the launcher has settled and no key was pressed just now */\nfunction startWhenQuiet (): void {\n	const check = () => {\n		if (!enabled) return;\n		if (Date.now() - lastKey < 1500) { window.setTimeout(check, 700); return; }\n		playCurrent();\n	};\n	window.setTimeout(check, Math.max(0, 6000 - performance.now()));\n}\n"),
])
s = open(P('src/lib/wallpaperVideo.ts')).read()
a = "	enabled = true;\n	failures = 0;\n	ensureVideo();\n	playCurrent();"
assert a in s
s = s.replace(a, "	enabled = true;\n	failures = 0;\n	ensureVideo();\n	startWhenQuiet();")
open(P('src/lib/wallpaperVideo.ts'), 'w').write(s)
