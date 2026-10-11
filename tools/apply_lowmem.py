#!/usr/bin/env python3
"""Thirty-second patch layer: less memory while Lumen is in the background. webOS keeps the launcher alive when another app is on screen, with the
wallpaper pictures decoded (a 1920x1080 picture is about 8 MB, plus the blurred copies) and the video decoder holding its buffers. After 5 seconds
out of sight the pictures and the video are released; they come back when the launcher is shown again."""
import os
APP = os.path.expanduser('~/Developer/webos-launcher-tvos/app')
def P(p): return os.path.join(APP, p)
def sub(p, pairs):
    s = open(P(p)).read()
    for a, b in pairs:
        assert a in s, (p, a[:80])
        s = s.replace(a, b, 1)
    open(P(p), 'w').write(s)

sub('src/lib/wallpaper.ts', [
 ("let element: HTMLElement | null = null;\n", "let element: HTMLElement | null = null;\nlet shown: string | null = null;      // the picture on screen, kept so it can be put back after it was released\nlet releaseTimer = 0;\nlet released = false;\n"),
 ("	document.body.insertBefore(element, document.body.firstChild);\n	return element;", "	document.body.insertBefore(element, document.body.firstChild);\n	document.addEventListener('visibilitychange', () => {\n		window.clearTimeout(releaseTimer);\n		if (document.hidden) {\n			releaseTimer = window.setTimeout(() => {\n				if (!element || !shown) return;\n				released = true;\n				element.style.backgroundImage = 'none';\n				document.documentElement.style.removeProperty('--wp-blur');\n				document.documentElement.style.removeProperty('--wp-bg');\n			}, 5000);\n		} else if (released && element && shown) {\n			released = false;\n			element.style.backgroundImage = `url(\"${shown}\")`;\n			setBlur(shown);\n		}\n	});\n	return element;"),
 ("			el.style.backgroundImage = `url(\"${list[i]}\")`;\n", "			shown = list[i];\n			released = false;\n			el.style.backgroundImage = `url(\"${list[i]}\")`;\n"),
])
sub('src/lib/wallpaperVideo.ts', [
 ("let failures = 0;\n", "let failures = 0;\nlet releaseTimer = 0;\nlet released = false;       // the clip was dropped while the launcher was out of sight\n"),
 ("	video.src = useHttp ?", "	released = false;\n	video.src = useHttp ?"),
 ("		if (!video || !enabled) return;\n		if (document.hidden) video.pause(); else video.play().catch(() => {});",
  "		window.clearTimeout(releaseTimer);\n		if (!video || !enabled) return;\n		if (document.hidden) {\n			video.pause();\n			// out of sight for a while: let go of the decoder and its buffers\n			releaseTimer = window.setTimeout(() => { if (video && enabled) { released = true; video.removeAttribute('src'); video.load(); } }, 5000);\n		} else if (released) playCurrent();\n		else video.play().catch(() => {});"),
])
