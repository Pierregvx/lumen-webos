#!/usr/bin/env python3
"""Thirty-ninth patch layer: pick several video places at once. In Settings > Wallpaper > Video, OK on a place ticks or unticks it; the video wallpaper then
shuffles through the ticked places. "Shuffle all places" clears the ticks (every place)."""
import os
APP = os.path.expanduser('~/Developer/webos-launcher-tvos/app')
def P(p): return os.path.join(APP, p)
def sub(p, pairs):
    s = open(P(p)).read()
    for a, b in pairs:
        assert a in s, (p, a[:80])
        s = s.replace(a, b)
    open(P(p), 'w').write(s)

sub('src/lib/storage.ts', [
 ("	/** place the video wallpaper plays ('' = shuffle all) */\n	videoClip: string;", "	/** place the video wallpaper plays ('' = shuffle all) (the older single choice, now videoPlaces) */\n	videoClip: string;\n	/** the places the video wallpaper shuffles through; empty = every place */\n	videoPlaces: string[];"),
 ("	videoClip: '',\n", "	videoClip: '',\n	videoPlaces: [],\n"),
 ("			videoClip: typeof parsed.videoClip === 'string' ? parsed.videoClip : '',\n", "			videoClip: typeof parsed.videoClip === 'string' ? parsed.videoClip : '',\n			videoPlaces: Array.isArray(parsed.videoPlaces) ? parsed.videoPlaces : typeof parsed.videoClip === 'string' && parsed.videoClip ? [parsed.videoClip] : [],\n"),
])
sub('src/lib/wallpaperVideo.ts', [
 ("let choice = '';           // '' = all places in a random order, else only the clips of that place", "let choice: string[] = [];   // [] = all places in a random order, else only the clips of those places"),
 ("filter((i) => !choice || WALLPAPER_VIDEOS[i].name === choice);", "filter((i) => choice.length === 0 || choice.indexOf(WALLPAPER_VIDEOS[i].name) >= 0);"),
 ("export function setVideoChoice (place: string): void {\n	const next = VIDEO_PLACES.indexOf(place) >= 0 ? place : '';\n	if (next === choice) return;", "export function setVideoChoice (places: string[]): void {\n	const next = places.filter((p) => VIDEO_PLACES.indexOf(p) >= 0);\n	if (next.join('|') === choice.join('|')) return;"),
])
sub('src/components/WallpaperPicker.tsx', [
 ("	tint?: string; ", "	on?: boolean;           // ticked in a multiple choice (video places)\n	tint?: string; "),
 ("e.key === current && 'wp__item--current'", "(e.key === current || e.on) && 'wp__item--current'"),
 ("{e.key === current && <span class=\"wp__tick\">", "{(e.key === current || e.on) && <span class=\"wp__tick\">"),
])
sub('src/app.tsx', [
 ("useEffect(() => setVideoChoice(config.videoClip), [config.videoClip]);", "useEffect(() => setVideoChoice(config.videoPlaces), [config.videoPlaces]);"),
 ("config.videoClip, config.darkMode", "config.videoPlaces, config.videoClip, config.darkMode"),
 ("		entries.push({key: 'video:', title: 'Shuffle all places', category: 'Video', tint: tint(0)});\n		VIDEO_PLACES.forEach((p, i) => entries.push({key: `video:${p}`, title: p, category: 'Video', tint: tint(i + 1)}));",
  "		entries.push({key: 'video:', title: 'Shuffle all places', category: 'Video', tint: tint(0), on: config.videoWallpaper && config.videoPlaces.length === 0});\n		VIDEO_PLACES.forEach((p, i) => entries.push({key: `video:${p}`, title: p, category: 'Video', tint: tint(i + 1), on: config.videoWallpaper && config.videoPlaces.indexOf(p) >= 0}));"),
 ("current: config.videoWallpaper ? `video:${config.videoClip}` : config.wallpaper,", "current: config.videoWallpaper ? 'video' : config.wallpaper,"),
 ("updateConfig(key.indexOf('video:') === 0 ? {...config, videoWallpaper: true, videoClip: key.slice(6)} :", "updateConfig(key.indexOf('video:') === 0 ? {...config, videoWallpaper: true, videoPlaces: key === 'video:' ? [] : config.videoPlaces.indexOf(key.slice(6)) >= 0 ? config.videoPlaces.filter((x) => x !== key.slice(6)) : config.videoPlaces.concat(key.slice(6))} :"),
])
