#!/usr/bin/env python3
"""Thirty-third patch layer: the video wallpaper moves into Settings > Wallpaper, as a "Video" category: Shuffle all places, or one place.
Picking a video turns the video wallpaper on; picking any picture turns it off. The two rows are removed from Options."""
import os, re
APP = os.path.expanduser('~/Developer/webos-launcher-tvos/app')
def P(p): return os.path.join(APP, p)
def sub(p, pairs):
    s = open(P(p)).read()
    for a, b in pairs:
        assert a in s, (p, a[:80])
        s = s.replace(a, b, 1)
    open(P(p), 'w').write(s)

sub('src/components/WallpaperPicker.tsx', [
 ("	thumb?: string;         // picture;", "	tint?: string;          // video tiles: a gradient with a play mark\n	thumb?: string;         // picture;"),
 ("style={e.thumb ? {backgroundImage: `url(\"${e.thumb}\")`} : undefined}>", "style={e.thumb ? {backgroundImage: `url(\"${e.thumb}\")`} : e.tint ? {background: e.tint} : undefined}>"),
 ("{e.key === 'none' ? 'Plain' : 'Shuffle'}", "{e.tint ? '\\u25B6' : e.key === 'none' ? 'Plain' : 'Shuffle'}"),
])
sub('src/screens/Settings.tsx', [
 ("e.key.indexOf('shuffle:') !== 0 && e.category !== 'Favorites' :", "e.key.indexOf('shuffle:') !== 0 && e.category !== 'Favorites' && e.category !== 'Video' :"),
])
TINTS = ['#e9a15b,#6d3d4a', '#d8b46a,#3e5a78', '#9fc2d6,#2d4a6b', '#7fc79a,#1e4a52', '#e07f8a,#4a2d5e', '#c9a0dc,#2f2f6b', '#f0c16a,#8a4a2a', '#8ab0e0,#1d2f5a', '#d6a07a,#4a3430', '#86c5c0,#27495a']
sub('src/app.tsx', [
 ("		return {\n			categories: ['Defaults', 'Favorites'].concat(WALLPAPER_CATEGORIES, 'All'),", "		const tint = (i: number) => `linear-gradient(150deg, ${%s[i %% %d]})`;\n		entries.push({key: 'video:', title: 'Shuffle all places', category: 'Video', tint: tint(0)});\n		VIDEO_PLACES.forEach((p, i) => entries.push({key: `video:${p}`, title: p, category: 'Video', tint: tint(i + 1)}));\n		return {\n			categories: ['Defaults', 'Favorites', 'Video'].concat(WALLPAPER_CATEGORIES, 'All')," % (repr(TINTS).replace("'", '"'), len(TINTS))),
 ("			current: config.wallpaper,\n			onPick: (key: string) => updateConfig({...config, wallpaper: key}),", "			current: config.videoWallpaper ? `video:${config.videoClip}` : config.wallpaper,\n			onPick: (key: string) => updateConfig(key.indexOf('video:') === 0 ? {...config, videoWallpaper: true, videoClip: key.slice(6)} : {...config, wallpaper: key, videoWallpaper: false}),"),
])
# the two rows leave Options
s = open(P('src/app.tsx')).read()
for ident in ('OPTION.videoWallpaper', 'OPTION.videoClip'):
    m = re.search(r"\t\t\{\n\t\t\tid: " + re.escape(ident) + r",.*?\n\t\t\},\n", s, re.S)
    assert m, ident
    s = s[:m.start()] + s[m.end():]
open(P('src/app.tsx'), 'w').write(s)
