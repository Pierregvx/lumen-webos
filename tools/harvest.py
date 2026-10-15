#!/usr/bin/env python3
"""Build tools/catalog.json from Reddit RSS (top of the year per subreddit): direct i.redd.it image links only.
Each candidate is checked: link answers 200 and the first bytes give a width/height (landscape, >= 1920 wide)."""
import time, re, json, struct, subprocess, html, concurrent.futures as cf, urllib.parse, sys, os
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
SUBS = [  # (subreddit, category shown in the picker)
 ('EarthPorn','Landscapes'), ('wallpaper','Featured'), ('wallpapers','Featured'), ('CityPorn','Cities'),
 ('spaceporn','Space'), ('SeaPorn','Ocean'), ('SkyPorn','Sky'), ('Mountainporn','Mountains'), ('ForestPorn','Forest'), ('DesertPorn','Desert'),
 ('Amoledbackgrounds','Dark'), ('MinimalWallpaper','Minimal'), ('WaterPorn','Water'), ('AutumnPorn','Autumn')]
PER_SUB = 100
ONLY = sys.argv[1:]            # e.g. harvest.py CityPorn SeaPorn: only these, merged into the existing catalog
CATALOG = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'catalog.json')

def sh(cmd, **kw): return subprocess.run(cmd, capture_output=True, **kw)

def feed(sub):
    import time
    for attempt in range(8):
        r = sh(['curl','-s','-A',UA,'--max-time','25',f'https://www.reddit.com/r/{sub}/top/.rss?t=year&limit={PER_SUB}'], text=True)
        if '<entry>' in r.stdout: break
        time.sleep(20)
    print(f'r/{sub}: {len(r.stdout)} bytes', file=sys.stderr)
    out = []
    for e in re.findall(r'<entry>(.*?)</entry>', r.stdout, re.S):
        t = re.search(r'<title>(.*?)</title>', e, re.S); l = re.search(r'<link href="([^"]+)"', e)
        links = re.findall(r'href="(https://i\.redd\.it/[A-Za-z0-9]+\.(?:jpe?g|png))"', html.unescape(e))
        if t and links: out.append({'title': html.unescape(t.group(1)).strip(), 'post': l.group(1) if l else '', 'url': links[0]})
    return out

def dims(buf):
    if buf[:8] == b'\x89PNG\r\n\x1a\n': return struct.unpack('>II', buf[16:24])
    if buf[:2] == b'\xff\xd8':
        i = 2
        while i + 9 < len(buf):
            if buf[i] != 0xFF: i += 1; continue
            m = buf[i+1]
            if m in (0xD8, 0x01) or 0xD0 <= m <= 0xD7: i += 2; continue
            n = struct.unpack('>H', buf[i+2:i+4])[0]
            if 0xC0 <= m <= 0xCF and m not in (0xC4, 0xC8, 0xCC):
                h, w = struct.unpack('>HH', buf[i+5:i+9]); return w, h
            i += 2 + n
    return None

def check(c):
    r = sh(['curl','-s','-A',UA,'--max-time','20','-r','0-65535','-D','-',c['url']])
    head, _, body = r.stdout.partition(b'\r\n\r\n')
    if b' 200' not in head and b' 206' not in head: return None
    d = dims(body)
    if not d: return None
    w, h = d; tot = re.search(rb'(?i)content-range:[^\n]*/(\d+)', head); size = int(tot.group(1)) if tot else 0
    if w < 1920 or w / h < 1.5 or w / h > 2.4: return None
    return dict(c, w=w, h=h, bytes=size)

cands = []
for sub, cat in [x for x in SUBS if not ONLY or x[0] in ONLY]:
    time.sleep(15); f = feed(sub); print(f'r/{sub}: {len(f)} image posts', file=sys.stderr)
    for c in f: cands.append(dict(c, sub=sub, category=cat))
seen = set(); uniq = []
for c in cands:
    if c['url'] in seen: continue
    seen.add(c['url']); uniq.append(c)
with cf.ThreadPoolExecutor(6) as ex: ok = [r for r in ex.map(check, uniq) if r]
for i, c in enumerate(ok): c['id'] = c['url'].rsplit('/',1)[1].split('.')[0]
if ONLY and os.path.exists(CATALOG):
    have = {c['id']: c for c in json.load(open(CATALOG))}
    for c in ok: have[c['id']] = c
    ok = list(have.values())
json.dump(ok, open(CATALOG, 'w'), indent=1, ensure_ascii=False)
import collections
print(len(ok), 'usable of', len(uniq), dict(collections.Counter(c['category'] for c in ok)))
