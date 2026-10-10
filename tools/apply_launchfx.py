#!/usr/bin/env python3
"""Nineteenth patch layer: tvOS-style launch. The opened tile's colour grows from its place to fill the whole screen with the app's logo staying in the
centre (the art fades softly into the fill), then the app starts. Replaces the plain zoom of the focused tile."""
import os
APP = os.path.expanduser('~/Developer/webos-launcher-tvos/app')
def P(p): return os.path.join(APP, p)
def sub(p, pairs):
    s = open(P(p)).read()
    for a, b in pairs:
        assert a in s, (p, a[:80])
        s = s.replace(a, b, 1)
    open(P(p), 'w').write(s)

open(P('src/components/LaunchFx.tsx'), 'w').write("""import {useEffect, useState} from 'preact/hooks';

export interface LaunchFxModel {
	/** where the tile is on screen (viewport pixels) */
	left: number; top: number; width: number; height: number;
	/** the tile's artwork (omitted for tiles drawn from a colour or a glyph) */
	src?: string;
	/** the fill that grows to cover the screen: the artwork's top and bottom background colours (a vertical gradient) */
	color: string;
	colorBottom: string;
	/** the artwork's height when it is shown at the end of the animation (px), so the gradient lines up with it */
	artHeight: number;
	radius: number;
}

/** Reads what the launch animation needs from the focused tile: its place, its artwork and the colour of the artwork's background. */
export function measureLaunch (box: HTMLElement): LaunchFxModel {
	const r = box.getBoundingClientRect();
	const img = box.querySelector('img.tile__image:not(.tile__image--glyph)') as HTMLImageElement | null;
	let color = '#1c2030';
	let colorBottom = color;
	let artHeight = 456;
	let src: string | undefined;
	if (img && img.complete && img.naturalWidth > 0) {
		src = img.src;
		try {
			const c = document.createElement('canvas');
			c.width = img.naturalWidth; c.height = img.naturalHeight;
			const g = c.getContext('2d');
			if (g) {
				g.drawImage(img, 0, 0);
				// the artwork's background at its left edge, top and bottom: the fill is the same gradient, so the art blends in with no seam
				const x = Math.min(6, c.width - 1);
				const t = g.getImageData(x, Math.floor(c.height * 0.04), 1, 1).data;
				const b = g.getImageData(x, Math.floor(c.height * 0.96), 1, 1).data;
				color = `rgb(${t[0]}, ${t[1]}, ${t[2]})`;
				colorBottom = `rgb(${b[0]}, ${b[1]}, ${b[2]})`;
				artHeight = 760 * c.height / c.width;
			}
		} catch { /* keep the default colour */ }
	} else {
		const bg = getComputedStyle(box).backgroundColor;
		if (bg && bg !== 'rgba(0, 0, 0, 0)') color = bg;
		colorBottom = color;
	}
	return {left: r.left, top: r.top, width: r.width, height: r.height, src, color, colorBottom, artHeight, radius: parseFloat(getComputedStyle(box).borderTopLeftRadius) || 30};
}

/** The tile's colour grows from its place to the whole screen while its artwork stays centred and fades into the fill. Opacity-free, one element. */
export function LaunchFx ({fx}: {fx: LaunchFxModel}) {
	const [grown, setGrown] = useState(false);
	useEffect(() => { const id = window.requestAnimationFrame(() => window.requestAnimationFrame(() => setGrown(true))); return () => window.cancelAnimationFrame(id); }, []);
	const style = grown
		? `left:0;top:0;width:100%;height:100%;border-radius:0;background:linear-gradient(to bottom, ${fx.color} calc(50% - ${fx.artHeight / 2}px), ${fx.colorBottom} calc(50% + ${fx.artHeight / 2}px))`
		: `left:${fx.left}px;top:${fx.top}px;width:${fx.width}px;height:${fx.height}px;border-radius:${fx.radius}px;background:linear-gradient(to bottom, ${fx.color}, ${fx.colorBottom})`;
	return (
		<div class={`launchfx${grown ? ' launchfx--grown' : ''}`} style={style}>
			{fx.src && <img class="launchfx__art" src={fx.src} alt="" style={grown ? 'width:760px' : `width:${fx.width}px`} />}
		</div>
	);
}
""")
sub('src/app.tsx', [
 ("import {QuickControls}", "import {QuickControls}") if False else ("import {CITIES} from './config/cities';", "import {CITIES} from './config/cities';\nimport {LaunchFx, measureLaunch, type LaunchFxModel} from './components/LaunchFx';"),
 ("	const [launching, setLaunching] = useState(false);", "	const [launching, setLaunching] = useState(false);\n	const [fx, setFx] = useState<LaunchFxModel | null>(null);"),
 ("	const open = (id: string, label: string) => {\n		setLaunching(true);\n		window.setTimeout(() => {\n			launchApp(id).catch(() => { setLaunching(false); showToast(`Couldn't open ${label}`, 'error'); });\n		}, 240);\n		window.setTimeout(() => setLaunching(false), 3500);\n	};",
  "	const open = (id: string, label: string) => {\n		const box = document.querySelector('.tile--focused .tile__box') as HTMLElement | null;\n		if (box) setFx(measureLaunch(box));\n		setLaunching(true);\n		window.setTimeout(() => {\n			launchApp(id).catch(() => { setLaunching(false); setFx(null); showToast(`Couldn't open ${label}`, 'error'); });\n		}, 380);\n		window.setTimeout(() => { setLaunching(false); setFx(null); }, 3500);\n	};"),
 ("		const reset = () => { if (!document.hidden) setLaunching(false); };", "		const reset = () => { if (!document.hidden) { setLaunching(false); setFx(null); } };"),
 ("			<Toast message={toast} />", "			{fx && <LaunchFx fx={fx} />}\n			<Toast message={toast} />"),
])
css = open(P('src/theme/global.css')).read()
css += """
/* ---------- tvOS-style launch: the tile's colour fills the screen, the logo stays centred ---------- */
.screen--launching .tile--focused .tile__box { transform: none !important; transition: none !important; }
.launchfx { position: fixed; z-index: 60; overflow: hidden; display: flex; align-items: center; justify-content: center; transition: left 360ms cubic-bezier(0.3, 0, 0.1, 1), top 360ms cubic-bezier(0.3, 0, 0.1, 1), width 360ms cubic-bezier(0.3, 0, 0.1, 1), height 360ms cubic-bezier(0.3, 0, 0.1, 1), border-radius 360ms ease-out; }
.launchfx__art { display: block; flex: 0 0 auto; height: auto; transition: width 360ms cubic-bezier(0.3, 0, 0.1, 1);
	-webkit-mask-image: radial-gradient(closest-side, #000 82%, transparent 100%); -webkit-mask-size: 420% 420%; -webkit-mask-position: center; -webkit-mask-repeat: no-repeat; }
.launchfx--grown .launchfx__art { -webkit-mask-size: 100% 100%; transition: width 360ms cubic-bezier(0.3, 0, 0.1, 1), -webkit-mask-size 360ms ease-out; }
"""
open(P('src/theme/global.css'), 'w').write(css)
print('launchfx applied')
