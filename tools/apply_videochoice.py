#!/usr/bin/env python3
"""Thirtieth patch layer: choose which place the video wallpaper plays (Settings > Options > Video clip): Shuffle, or one of the ten places."""
import os
APP = os.path.expanduser('~/Developer/webos-launcher-tvos/app')
def P(p): return os.path.join(APP, p)
def sub(p, pairs):
    s = open(P(p)).read()
    for a, b in pairs:
        assert a in s, (p, a[:80])
        s = s.replace(a, b, 1)
    open(P(p), 'w').write(s)

sub('src/lib/wallpaperVideo.ts', [
 ("let failures = 0;\n", "let failures = 0;\nlet choice = '';           // '' = all places in a random order, else only the clips of that place\n\nexport const VIDEO_PLACES: string[] = WALLPAPER_VIDEOS.map((v) => v.name).filter((n, i, all) => all.indexOf(n) === i);\n"),
 ("const list = WALLPAPER_VIDEOS.map((_, i) => i);", "const list = WALLPAPER_VIDEOS.map((_, i) => i).filter((i) => !choice || WALLPAPER_VIDEOS[i].name === choice);"),
])
s = open(P('src/lib/wallpaperVideo.ts')).read()
s += """
export function setVideoChoice (place: string): void {
	const next = VIDEO_PLACES.indexOf(place) >= 0 ? place : '';
	if (next === choice) return;
	choice = next;
	order = []; position = 0;
	if (enabled) playCurrent();
}
"""
open(P('src/lib/wallpaperVideo.ts'), 'w').write(s)
sub('src/lib/storage.ts', [
 ("	/** dark glass and a dimmer wallpaper */", "	/** place the video wallpaper plays ('' = shuffle all) */\n	videoClip: string;\n	/** dark glass and a dimmer wallpaper */"),
 ("	darkMode: false,\n", "	darkMode: false,\n	videoClip: '',\n"),
 ("			darkMode: parsed.darkMode === true,\n", "			darkMode: parsed.darkMode === true,\n			videoClip: typeof parsed.videoClip === 'string' ? parsed.videoClip : '',\n"),
])
sub('src/lib/i18n.ts', [
 ("const TABLE: Record<string, string[]> = {", "const TABLE: Record<string, string[]> = {\n\t\"Video clip\": [\"Videoclip\", \"Clip de vídeo\", \"Clip vidéo\", \"Clip video\", \"Clip de vídeo\", \"Videoclip\", \"Video klibi\", \"वीडियो क्लिप\"],\n\t\"Shuffle\": [\"Zufall\", \"Aleatorio\", \"Aléatoire\", \"Casuale\", \"Aleatório\", \"Willekeurig\", \"Karışık\", \"शफल\"],"),
])
sub('src/app.tsx', [
 ("import {setVideoWallpaper} from './lib/wallpaperVideo';", "import {setVideoChoice, setVideoWallpaper, VIDEO_PLACES} from './lib/wallpaperVideo';"),
 ("	useEffect(() => setVideoWallpaper(config.videoWallpaper), [config.videoWallpaper]);", "	useEffect(() => setVideoChoice(config.videoClip), [config.videoClip]);\n	useEffect(() => setVideoWallpaper(config.videoWallpaper), [config.videoWallpaper]);"),
 ("videoWallpaper: 'video-wallpaper',", "videoWallpaper: 'video-wallpaper', videoClip: 'video-clip',"),
 ("], [config.darkMode,", "], [config.videoClip, config.darkMode,"),
 ("		{\n			id: OPTION.showAll,", "		{\n			id: OPTION.videoClip,\n			label: 'Video clip',\n			description: 'Which place the video wallpaper plays: Shuffle mixes them all, or pick one (OK steps through the list).',\n			value: config.videoClip !== '',\n			valueText: config.videoClip || 'Shuffle'\n		},\n		{\n			id: OPTION.showAll,"),
 ("		else if (optionId === OPTION.darkMode)", "		else if (optionId === OPTION.videoClip) {\n			const names = [''].concat(VIDEO_PLACES);\n			updateConfig({...config, videoClip: names[(names.indexOf(config.videoClip) + 1) % names.length]});\n		} else if (optionId === OPTION.darkMode)"),
])
