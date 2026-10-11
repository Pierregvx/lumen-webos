#!/usr/bin/env python3
"""Forty-eighth patch layer: when the dock slides away, the screen turns into an "aerial" view like Apple TV's screensaver: the date, time and weather move to the bottom
left, and (with a video wallpaper playing) the place and a short description of the clip appear at the bottom right."""
import os
APP = os.path.expanduser('~/Developer/webos-launcher-tvos/app')
def P(p): return os.path.join(APP, p)
def sub(p, pairs):
    s = open(P(p)).read()
    for a, b in pairs:
        assert a in s, (p, a[:80])
        s = s.replace(a, b)
    open(P(p), 'w').write(s)

sub('src/lib/wallpaperVideo.ts', [
 ("let failures = 0;\n", "let failures = 0;\nlet current: WallpaperVideo | null = null;\n\n/** the clip on screen (null when no video plays), for the caption */\nexport function getCurrentClip (): WallpaperVideo | null { return current; }\nfunction announce (clip: WallpaperVideo | null): void { current = clip; window.dispatchEvent(new Event('lumen-clip')); }\n"),
 ("import {WALLPAPER_VIDEOS} from '../config/wallpaperVideos';", "import {WALLPAPER_VIDEOS, type WallpaperVideo} from '../config/wallpaperVideos';"),
 ("	video.addEventListener('playing', () => { failures = 0;", "	video.addEventListener('playing', () => { announce(WALLPAPER_VIDEOS[order[position % order.length]] || null); failures = 0;"),
 ("	enabled = false;\n	document.documentElement.classList.remove(HTML_CLASS);", "	enabled = false;\n	announce(null);\n	document.documentElement.classList.remove(HTML_CLASS);"),
])
open(P('src/components/VideoCaption.tsx'), 'w').write("""import {useEffect, useState} from 'preact/hooks';
import {getCurrentClip} from '../lib/wallpaperVideo';

/** bottom right while the dock is away: the place and what the clip shows, like Apple TV's aerial screensavers */
export function VideoCaption () {
	const [clip, setClip] = useState(getCurrentClip());
	useEffect(() => {
		const update = () => setClip(getCurrentClip());
		window.addEventListener('lumen-clip', update);
		return () => window.removeEventListener('lumen-clip', update);
	}, []);
	if (!clip) return null;
	return (
		<div class="videocap">
			<div class="videocap__place">{clip.name}</div>
			{clip.title && <div class="videocap__text">{clip.title}</div>}
		</div>
	);
}
""")
sub('src/screens/Home.tsx', [
 ("import {t as tr} from '../lib/i18n';", "import {t as tr} from '../lib/i18n';\nimport {VideoCaption} from '../components/VideoCaption';"),
 ('<div class="dockhint"', '<VideoCaption />\n			<div class="dockhint"'),
])
s = open(P('src/theme/global.css')).read()
s += """
/* aerial view while the dock is away: date, time and weather drop to the bottom left; the place and a description show at the bottom right */
.status { transition: transform 320ms cubic-bezier(0.2, 0.7, 0.2, 1); }
.screen--dockhidden .status { transform: translateY(830px); }
.videocap { position: absolute; right: var(--layout-edge-padding); top: calc(var(--layout-header-top) + 806px); max-width: 800px; text-align: right; opacity: 0; transition: opacity 420ms ease; pointer-events: none; }
.screen--dockhidden .videocap { opacity: 1; }
html:not(.wp-video) .videocap { display: none; }
.videocap__place { font-size: 36px; font-weight: 600; letter-spacing: 0.01em; color: #fff; text-shadow: 0 2px 14px rgba(0, 0, 0, 0.6); }
.videocap__text { margin-top: 6px; font-size: 22px; line-height: 1.3; color: rgba(255, 255, 255, 0.86); text-shadow: 0 2px 10px rgba(0, 0, 0, 0.6); }
"""
open(P('src/theme/global.css'), 'w').write(s)
