#!/usr/bin/env python3
"""Eighteenth patch layer: motion. (1) Opening intro: the top bar, date/time and the dock fade in when the launcher opens or comes back to the front.
(2) Launch zoom: opening an app scales the focused tile up while everything else fades, then launches it. Opacity and transform only (cheap on this TV)."""
import os
APP = os.path.expanduser('~/Developer/webos-launcher-tvos/app')
def P(p): return os.path.join(APP, p)
def sub(p, pairs):
    s = open(P(p)).read()
    for a, b in pairs:
        assert a in s, (p, a[:80])
        s = s.replace(a, b, 1)
    open(P(p), 'w').write(s)

sub('src/screens/Home.tsx', [
 ("	weatherText?: string;\n}", "	weatherText?: string;\n	/** an app is being opened: the focused tile zooms and the rest fades */\n	launching?: boolean;\n}"),
 ("onEdit, folders, weatherText}: Props)", "onEdit, folders, weatherText, launching}: Props)"),
 ("	// coming back to the launcher from another app: rest again", """	// opening intro: fade the screen in when the launcher starts and every time it comes back to the front
	const [intro, setIntro] = useState(true);
	useEffect(() => {
		let timer = window.setTimeout(() => setIntro(false), 900);
		const again = () => {
			if (document.hidden) return;
			setIntro(true);
			window.clearTimeout(timer);
			timer = window.setTimeout(() => setIntro(false), 900);
		};
		document.addEventListener('visibilitychange', again);
		return () => { window.clearTimeout(timer); document.removeEventListener('visibilitychange', again); };
	}, []);

	// coming back to the launcher from another app: rest again"""),
 ("${n.moving ? ' screen--moving' : ''}`}>", "${n.moving ? ' screen--moving' : ''}${intro ? ' screen--intro' : ''}${launching ? ' screen--launching' : ''}`}>"),
])
sub('src/app.tsx', [
 ("	const [controls, setControls] = useState(false);", "	const [controls, setControls] = useState(false);\n	const [launching, setLaunching] = useState(false);"),
 ("	const open = (id: string, label: string) => {\n		launchApp(id).catch(() => showToast(`Couldn't open ${label}`, 'error'));\n	};", """	// the launch zoom plays first (about a quarter of a second), then the app is started; it resets when the launcher is back in front
	const open = (id: string, label: string) => {
		setLaunching(true);
		window.setTimeout(() => {
			launchApp(id).catch(() => { setLaunching(false); showToast(`Couldn't open ${label}`, 'error'); });
		}, 240);
		window.setTimeout(() => setLaunching(false), 3500);
	};
	useEffect(() => {
		const reset = () => { if (!document.hidden) setLaunching(false); };
		document.addEventListener('visibilitychange', reset);
		return () => document.removeEventListener('visibilitychange', reset);
	}, []);"""),
 ("weatherText={weatherText} />", "weatherText={weatherText} launching={launching} />"),
])
css = open(P('src/theme/global.css')).read()
css += """
/* ---------- motion: opening intro and launch zoom (opacity and transform only) ---------- */
@keyframes intro-fade { from { opacity: 0; } to { opacity: 1; } }
.screen--intro .status, .screen--intro .topbar { animation: intro-fade 600ms ease-out both; }
.screen--intro .rows { animation: intro-fade 700ms ease-out 120ms both; }
.screen--launching .tile:not(.tile--focused) { opacity: 0; transition: opacity 180ms ease-out; }
.screen--launching .topbar, .screen--launching .status { opacity: 0; transition: opacity 180ms ease-out; }
.screen--launching .tile--focused .tile__label { opacity: 0; }
.screen--launching .tile--focused .tile__box { transform: scale(1.7) !important; transition: transform 260ms cubic-bezier(0.3, 0, 0.2, 1) !important; }
"""
open(P('src/theme/global.css'), 'w').write(css)
print('motion applied')
