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
 'Italy (Tuscany)': [8175, 8173, 25189, 8203, 46296, 46295],
 'Portugal': [48399, 17100, 21750],
 'Austria': [8607],
 'Netherlands': [27939],
}
def head(u):
    r = subprocess.run(['curl', '-sI', '-m', '15', u], capture_output=True, text=True).stdout
    return r.split('\n')[0].strip().endswith('200') or ' 200' in r.split('\n')[0]
out = {}
for place, ids in PLACES.items():
    for i in ids:
        for q in ('1080', '720'):
            u = f'https://assets.mixkit.co/videos/{i}/{i}-{q}.mp4'
            if head(u): out.setdefault(place, []).append(u); break
        else: print('no file for', i)
s = open(P).read()
s = re.sub(r"\t\{name: \"[^\"]+\", url: \"https://assets\.mixkit\.co[^\"]+\"\},\n", '', s)
new = ''.join(f'\t{{name: {json.dumps(p)}, url: {json.dumps(u)}}},\n' for p, urls in out.items() for u in urls)
s = s.replace('WALLPAPER_VIDEOS: WallpaperVideo[] = [\n', 'WALLPAPER_VIDEOS: WallpaperVideo[] = [\n' + new, 1)
s = s.replace("// Apple's tvOS aerial screensaver videos (1080p H.264, ~6 Mbps), from Apple's own server. Streamed, not bundled.", "// Mixkit's free stock videos of European places (mixkit.co licence: free use, no attribution needed) and Apple's tvOS aerial screensaver videos (1080p H.264, ~6 Mbps), each from its own server. Streamed, not bundled.")
open(P, 'w').write(s)
print({k: len(v) for k, v in out.items()})
