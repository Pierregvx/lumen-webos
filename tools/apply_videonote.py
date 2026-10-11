#!/usr/bin/env python3
"""Fortieth patch layer: a short description under the Video chip in Settings > Wallpaper."""
import os
APP = os.path.expanduser('~/Developer/webos-launcher-tvos/app')
def P(p): return os.path.join(APP, p)
def sub(p, pairs):
    s = open(P(p)).read()
    for a, b in pairs:
        assert a in s, (p, a[:80])
        s = s.replace(a, b)
    open(P(p), 'w').write(s)

sub('src/components/WallpaperPicker.tsx', [
 ("	/** press and hold with the pointer */", "	/** a line of explanation under the chips (the Video category) */\n	note?: string;\n	/** press and hold with the pointer */"),
 ("onSelect, onActivate, onHold}: Props) {", "onSelect, onActivate, onHold, note}: Props) {\n	const viewport = note ? VIEWPORT_HEIGHT - 70 : VIEWPORT_HEIGHT;"),
 ("const offset = total <= VIEWPORT_HEIGHT ? 0 : clamp(row * ROW_STEP - (VIEWPORT_HEIGHT - ROW_STEP) / 2, 0, total - VIEWPORT_HEIGHT);", "const offset = total <= viewport ? 0 : clamp(row * ROW_STEP - (viewport - ROW_STEP) / 2, 0, total - viewport);"),
 ("			<div class=\"wp__viewport\">", "			{note && <p class=\"wp__note\">{note}</p>}\n			<div class=\"wp__viewport\" style={note ? {height: `${viewport}px`} : undefined}>"),
])
sub('src/screens/Settings.tsx', [
 ("						onHold={(i) => { if (wpList[i]) wallpaper.onFavorite(wpList[i].key); }}", "						onHold={(i) => { if (wpList[i]) wallpaper.onFavorite(wpList[i].key); }}\n						note={wpName === 'Video' ? tr('Pick one or more places and the video wallpaper plays them in random order. Shuffle all places plays everything: aerial videos and free stock videos of European countries. Videos stream from the internet (about 2-3 GB an hour) and take a few seconds to start.') : undefined}"),
])
s = open(P('src/theme/global.css')).read()
s += "\n.wp__note { margin: -8px 6px 16px; font-size: 22px; line-height: 1.35; color: var(--color-text-secondary); max-width: 1500px; }\n"
open(P('src/theme/global.css'), 'w').write(s)
