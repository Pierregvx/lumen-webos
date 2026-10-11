#!/usr/bin/env python3
"""Adds Mixkit's free stock videos of beautiful European places to tools/wallpaperVideos.ts (Apple's aerial videos stay). Mixkit's licence allows free use, with no
attribution needed. The pictures are streamed from Mixkit's server, never bundled. Picks 1080p when it exists, else 720p.
Run: python3 tools/harvest_mixkit.py   (then rebuild; apply_tvos.py copies the file into the app)"""
import json, os, re, subprocess
ROOT = os.path.expanduser('~/Developer/webos-launcher-tvos')
P = f'{ROOT}/tools/wallpaperVideos.ts'
PLACES = {  # place -> Mixkit video ids (checked by hand: scenic, no flags or people)
 'Switzerland': [31939, 4396, 4283, 4435],
 'Norway': [8657, 4036, 8665, 8661, 8655, 11042],
 'Iceland': [26939, 48407, 8031, 8025, 8016, 8049, 8017, 8015, 8053, 8086, 48402],
 'Italy': [8175, 8173, 25189, 8203, 46296, 46295, 8675, 4402, 4101, 15102],
 'Greece (Athens)': [31651, 30379, 30369, 30527, 30376, 30348, 30347, 31649, 44912],
 'Germany (Berlin)': [31719, 30511, 26941, 27092, 30427, 27102, 26937, 30405, 27282],
 'Czechia (Prague)': [11167, 44880, 27963, 27452, 27380, 27427, 27863],
 'Spain (Madrid)': [27292, 26469, 25405, 4146, 22633],
 'Netherlands': [25131, 27732, 27308, 10985, 4015, 27939],
 'Portugal': [48399, 17100, 21750],
 'Scotland (Edinburgh)': [11295, 11407],
 'Austria': [8607],
 'Denmark': [22059],
 'Sweden': [30978],
}
def head(u):
    r = subprocess.run(['curl', '-sI', '-m', '15', u], capture_output=True, text=True).stdout
    return r.split('\n')[0].strip().endswith('200') or ' 200' in r.split('\n')[0]
TITLES = json.load(open(f'{ROOT}/tools/mixkit_titles.json'))
TITLES = json.load(open(f'{ROOT}/tools/mixkit_titles.json'))
out = {}
for place, ids in PLACES.items():
    for i in ids:
        for q in ('1080', '720'):
            u = f'https://assets.mixkit.co/videos/{i}/{i}-{q}.mp4'
            if head(u): out.setdefault(place, []).append((u, TITLES.get(str(i), ''))); break
        else: print('no file for', i)
s = open(P).read()
s = re.sub(r"\t\{name: \"[^\"]+\", (?:title: \"[^\"]*\", )?url: \"https://assets\.mixkit\.co[^\"]+\"\},\n", '', s)
new = ''.join(f'\t{{name: {json.dumps(p)}, title: {json.dumps(ti, ensure_ascii=False)}, url: {json.dumps(u)}}},\n' for p, urls in out.items() for u, ti in urls)
s = s.replace('WALLPAPER_VIDEOS: WallpaperVideo[] = [\n', 'WALLPAPER_VIDEOS: WallpaperVideo[] = [\n' + new, 1)
s = s.replace("// Apple's tvOS aerial screensaver videos (1080p H.264, ~6 Mbps), from Apple's own server. Streamed, not bundled.", "// Mixkit's free stock videos of European places (mixkit.co licence: free use, no attribution needed) and Apple's tvOS aerial screensaver videos (1080p H.264, ~6 Mbps), each from its own server. Streamed, not bundled.")
open(P, 'w').write(s)
s = s.replace('export interface WallpaperVideo { name: string; url: string }', 'export interface WallpaperVideo { name: string; title?: string; url: string }')
open(P, 'w').write(s)
print({k: len(v) for k, v in out.items()})
