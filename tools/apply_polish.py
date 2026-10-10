#!/usr/bin/env python3
"""Fourth patch layer (after apply_wallpaper_extras.py): performance clean-up (no animated shadows/backgrounds) and Magic Remote pointer
behaviour (scroll wheel moves, press-and-hold on a tile, clickable Quick Controls)."""
import os, re
APP = os.path.expanduser('~/Developer/webos-launcher-tvos/app')
def P(p): return os.path.join(APP, p)
def sub(p, pairs):
    s = open(P(p)).read()
    for a, b in pairs:
        assert a in s, (p, a[:70])
        s = s.replace(a, b, 1)
    open(P(p), 'w').write(s)

# ---- performance: only transform/opacity animate (shadows, backgrounds and colours change instantly)
css = open(P('src/theme/global.css')).read()
css = re.sub(r',\s*(box-shadow|background|color) var\(--motion-focus-ms\) ease-out', '', css)
css = re.sub(r'\n\s*transition: (box-shadow|background) var\(--motion-focus-ms\) ease-out;', '', css)
css += """
/* ---------- pointer ---------- */
.qc__bar, .qc__value { cursor: pointer; }
"""
open(P('src/theme/global.css'), 'w').write(css)

# ---- pointer: the Magic Remote's scroll wheel moves up/down like the arrow keys (throttled)
sub('src/app.tsx', [
 ("	// Start in remote (5-way) mode", """	// Magic Remote scroll wheel = Up/Down (rows on the home screen, lists and grids elsewhere)
	useEffect(() => {
		let last = 0;
		const onWheel = (e: WheelEvent) => {
			const now = Date.now();
			if (now - last < 220 || Math.abs(e.deltaY) < 4) return;
			last = now;
			const code = e.deltaY > 0 ? 40 : 38;
			window.dispatchEvent(new KeyboardEvent('keydown', {keyCode: code, which: code, bubbles: true}));
		};
		window.addEventListener('wheel', onWheel, {passive: true});
		return () => window.removeEventListener('wheel', onWheel);
	}, []);

	// Start in remote (5-way) mode"""),
])

# ---- pointer: press and hold on an app tile opens its menu (Move / Remove), like holding OK
sub('src/screens/Home.tsx', [
 ("	/** the OK that brought the focus up must not also open the app on release */\n	swallowOk: boolean;", "	/** the OK that brought the focus up must not also open the app on release */\n	swallowOk: boolean;\n	/** a press-and-hold with the pointer just opened the menu: ignore the click that follows */\n	suppressClick: boolean;"),
 ("swallowOk: false, mode: 'key'});", "swallowOk: false, suppressClick: false, mode: 'key'});"),
 ("	const pointerLeft = () => {", """	const holdTimer = useRef(0);
	const holdStart = () => {
		window.clearTimeout(holdTimer.current);
		holdTimer.current = window.setTimeout(() => { const n = nav.current; n.suppressClick = true; longPress(); }, 600);
	};
	const holdCancel = () => window.clearTimeout(holdTimer.current);

	const pointerLeft = () => {
		holdCancel();"""),
 ("			<div class={`rows${n.zone === 'rows' && rowIndex >= 1 ? ' rows--lower' : ''}`}>", "			<div class={`rows${n.zone === 'rows' && rowIndex >= 1 ? ' rows--lower' : ''}`} onMouseDown={() => { n.mode = 'pointer'; holdStart(); }} onMouseUp={holdCancel}>"),
 ("						onActivate={(col) => latest.current.onActivate(row.id, row.items[col])}", "						onActivate={(col) => { holdCancel(); if (n.suppressClick) { n.suppressClick = false; return; } latest.current.onActivate(row.id, row.items[col]); }}"),
])

# ---- pointer: press and hold a wallpaper to favourite it
sub('src/components/WallpaperPicker.tsx', [
 ("	onActivate: (index: number) => void;\n}", "	onActivate: (index: number) => void;\n	/** press and hold with the pointer */\n	onHold?: (index: number) => void;\n}"),
 ("chipsFocused, gridFocused, selected, onCategory, onSelect, onActivate}: Props) {", "chipsFocused, gridFocused, selected, onCategory, onSelect, onActivate, onHold}: Props) {\n	let holdTimer = 0;\n	let held = false;"),
 ("							onClick={() => onActivate(i)}", "							onMouseDown={() => { held = false; window.clearTimeout(holdTimer); holdTimer = window.setTimeout(() => { held = true; if (onHold) onHold(i); }, 600); }}\n							onMouseUp={() => window.clearTimeout(holdTimer)}\n							onClick={() => { if (held) { held = false; return; } onActivate(i); }}"),
])
sub('src/screens/Settings.tsx', [
 ("						onActivate={(i) => { setZone('content'); if (wpList[i]) wallpaper.onPick(wpList[i].key); }}", "						onActivate={(i) => { setZone('content'); if (wpList[i]) wallpaper.onPick(wpList[i].key); }}\n						onHold={(i) => { if (wpList[i]) wallpaper.onFavorite(wpList[i].key); }}"),
])

# ---- pointer: Quick Controls rows react to clicks (left half = less / previous, right half = more / next)
sub('src/components/QuickControls.tsx', [
 ("						onClick={() => press(r.id)}", "						onClick={(e: MouseEvent) => {\n							if (r.id === 'volume' || r.id === 'picture' || r.id === 'sleep') {\n								const box = (e.currentTarget as HTMLElement).getBoundingClientRect();\n								change(r.id, e.clientX < box.left + box.width / 2 ? -1 : 1);\n							} else press(r.id);\n						}}"),
])
print('polish applied')
