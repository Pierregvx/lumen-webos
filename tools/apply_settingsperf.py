#!/usr/bin/env python3
"""Forty-third patch layer: Settings tab switches were hitching (100-500 ms per switch on the TV with the video wallpaper on). Two causes removed:
 - the video kept decoding and compositing behind the solid Settings screen: it is paused while Settings is open
 - the scrolling lists were faded at their edges with mask-image, which makes Chromium draw each list into an off-screen surface every frame: the fade is dropped"""
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
 ("let releaseTimer = 0;\n", "let releaseTimer = 0;\nlet paused = false;          // held while Settings is open (the video is hidden behind it, so it need not decode)\n"),
 ("	video.play().catch(() => { /* onerror moves on */ });", "	if (!paused) video.play().catch(() => { /* onerror moves on */ });"),
 ("		else video.play().catch(() => {});", "		else if (!paused) video.play().catch(() => {});"),
])
s = open(P('src/lib/wallpaperVideo.ts')).read()
s += """
export function setVideoPaused (hold: boolean): void {
	if (hold === paused) return;
	paused = hold;
	if (!video || !enabled || document.hidden) return;
	if (hold) video.pause();
	else if (released || !video.getAttribute('src')) playCurrent();
	else video.play().catch(() => { /* onerror moves on */ });
}
"""
open(P('src/lib/wallpaperVideo.ts'), 'w').write(s)
sub('src/app.tsx', [
 ("import {setVideoChoice, setVideoWallpaper, VIDEO_PLACES}", "import {setVideoChoice, setVideoPaused, setVideoWallpaper, VIDEO_PLACES}"),
 ("	useEffect(() => setVideoWallpaper(config.videoWallpaper), [config.videoWallpaper]);", "	useEffect(() => setVideoWallpaper(config.videoWallpaper), [config.videoWallpaper]);\n	useEffect(() => { setVideoPaused(screen === 'settings'); }, [screen]);"),
])
s = open(P('src/theme/global.css')).read()
s += "\n/* Settings lists: no mask-image fade (it costs an off-screen draw per frame) */\n.options, .options-wrap .options, .wp__viewport, .grid__viewport { -webkit-mask-image: none; mask-image: none; }\n"
open(P('src/theme/global.css'), 'w').write(s)
