#!/usr/bin/env python3
"""Forty-sixth patch layer: the first-launch freeze. Measured on the TV with the boot log: the app froze for about 2.4 s right before the app list appeared
(frames of 2400 ms at 4.3 s after start), then hitched for another second. Cause: for every app with a plain icon, the whole icon was drawn into a canvas and read back
(getImageData) to find its background colour, one after another, on every launch. Now the icon is drawn into a 16 x 16 canvas (the readback is tiny) and the colour is
remembered in localStorage, so only an icon seen for the first time costs anything."""
import os
p = os.path.expanduser('~/Developer/webos-launcher-tvos/app/src/lib/apps.ts')
s = open(p).read()
a = s.index("function sampleColor (url: string)")
b = s.index("/** What a fresh install shows")
new = '''const COLOR_CACHE_KEY = 'launcher-icon-colors-v1';

function readColorCache (): Record<string, string> {
	try { return JSON.parse(localStorage.getItem(COLOR_CACHE_KEY) || '{}') as Record<string, string>; } catch { return {}; }
}

function sampleColor (url: string): Promise<string | undefined> {
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () => {
			try {
				// a 16 x 16 copy: reading back a handful of pixels from a small canvas is cheap, from a full-size icon it freezes the TV
				const c = document.createElement('canvas');
				c.width = 16; c.height = 16;
				const g = c.getContext('2d');
				if (!g) { resolve(undefined); return; }
				g.drawImage(img, 0, 0, 16, 16);
				const spots = [[1, 8], [8, 1], [14, 8]];
				for (const [x, y] of spots) {
					const d = g.getImageData(x, y, 1, 1).data;
					if (d[3] > 200) { resolve(`rgb(${d[0]}, ${d[1]}, ${d[2]})`); return; }
				}
				resolve(undefined);
			} catch { resolve(undefined); }
		};
		img.onerror = () => resolve(undefined);
		img.src = url;
	});
}

/** colours already found are kept by app id and icon size, so launching again does no image work at all */
function withIconColor (entry: AppEntry): Promise<AppEntry> {
	if (!entry.plain || !entry.iconUrl) return Promise.resolve(entry);
	const key = `${entry.id}:${entry.iconUrl.length}`;
	const cache = readColorCache();
	if (cache[key]) return Promise.resolve({...entry, color: cache[key]});
	return sampleColor(entry.iconUrl).then((color) => {
		if (color) {
			const next = readColorCache();
			next[key] = color;
			try { localStorage.setItem(COLOR_CACHE_KEY, JSON.stringify(next)); } catch { /* full: sampled again next time */ }
		}
		return {...entry, color: color || entry.color};
	});
}

'''
s = s[:a] + new + s[b:]
open(p, 'w').write(s)
