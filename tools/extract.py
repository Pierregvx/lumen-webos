#!/usr/bin/env python3
"""Pull one still frame (1920 wide) + a thumbnail from every wallpaper video in /tmp/wp-ok.json (the checked list).
Writes app/public/wallpapers/{full,thumb}/<id>.jpg and tools/wallpapers.json (id, name, source, category)."""
import json, re, subprocess, sys, os, concurrent.futures as cf, unicodedata
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FF = f'{ROOT}/tools/node_modules/ffmpeg-static/ffmpeg'
OUT = f'{ROOT}/app/public/wallpapers'
es = json.load(open('/tmp/wp-ok.json'))

def slug(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

RULES = [  # first match wins
 ('Underwater', r'jell|kelp|palau|sea stars?|seal pod|whale|rays|sharks?|dolphin|barracuda|bumphead|jack school|coral|fish|sardine|mackerel|anemone|sponge|jacks'),
 ('Wildlife',   r'baboon|elephant|lion|zebra|savannah|big 5|african wildlife|okavango|family|flamingo'),
 ('Calm',       r'motion|elastic|light leaks|gradient|fireplace|fire\b|sparks|geometric|gentle|swaying|skymelt|calm'),
 ('Cities',     r'dubai|hong kong|london|los angeles|new york|san francisco|night$|europe night|east asia|china night|neon|oculus|sydney|florence|bridge|skyline|ferry|airport|overpass|harbou?r|creek'),
 ('Sky & Space',r'aurora|southern lights|galaxy|star|night sky|planet|earth meets|cloud|time-lapse|polar|sunrise|sunset|dawn|vibrant|blue sky'),
 ('Coast',      r'coast|beach|caribbean|hawaii|tahiti|goa|ocean|sea\b|bay\b|island|fjord|cliff|turquoise|mangrove|cabo|lofoten|faroe|waves|reservoir|rocky sea|water'),
]
def category(name):
    n = name.lower()
    for cat, rx in RULES:
        if re.search(rx, n): return cat
    return 'Landscapes'

def grab(e):
    i = slug(e['s'] + '-' + e['n']); full = f'{OUT}/full/{i}.jpg'; th = f'{OUT}/thumb/{i}.jpg'
    if not (os.path.exists(full) and os.path.exists(th)):
        for ss in ('20', '8', '2'):
            r = subprocess.run([FF,'-hide_banner','-loglevel','error','-y','-ss',ss,'-i',e['u'],'-frames:v','1','-vf','scale=1920:-2','-q:v','4',full],capture_output=True,text=True)
            if os.path.exists(full) and os.path.getsize(full) > 20000: break
        else:
            return None
        subprocess.run([FF,'-hide_banner','-loglevel','error','-y','-i',full,'-vf','scale=360:-2','-q:v','5',th],capture_output=True)
    return {'id': i, 'name': e['n'], 'source': e['s'], 'category': category(e['n'])}

with cf.ThreadPoolExecutor(8) as ex:
    res = [r for r in ex.map(grab, es) if r]
seen = {}; out = []
for r in res:           # a few names repeat (e.g. "Oregon"): keep unique ids only
    if r['id'] in seen: continue
    seen[r['id']] = 1; out.append(r)
json.dump(out, open(f'{ROOT}/tools/wallpapers.json', 'w'), indent=1, ensure_ascii=False)
print(len(out), 'wallpapers of', len(es))
import collections; print(collections.Counter(r['category'] for r in out))
