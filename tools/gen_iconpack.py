#!/usr/bin/env python3
"""Generates the tvOS-style icon pack: 800x480 (5:3) tiles, flat brand colour + centred logo, into app/private/iconpack/ (gitignored: these are other people's logos).
Plain rectangles with hard corners, like Apple's spec - the launcher rounds the corners and adds the focus effects.
 - Logos that Simple Icons has (Netflix, YouTube, Plex, ...): its official glyph path + brand colours (tools/glyphs.json,
   made by `node icons_spec.mjs`).
 - Apps installed on this TV whose own icon is a logo on a flat colour (JioHotstar, Prime Video, Homebrew ...): the colour is
   read from the icon's corner, extended over the tile, and the icon sits in the middle - no visible square.
Run: python3 tools/gen_iconpack.py   (the build picks the tiles up from there; CHROME in .env or the environment if not on macOS)"""
import json, os, struct, subprocess, tempfile, zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = f'{ROOT}/app/private/iconpack'
ICON_DIRS = [f'{ROOT}/app/private/icons/apps', f'{ROOT}/app/public/icons/apps']   # icons of apps on your TV first, then the upstream ones
CHROME = os.environ.get('CHROME', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
GLYPHS = json.load(open(f'{ROOT}/tools/glyphs.json'))
os.makedirs(OUT, exist_ok=True)

def corner_color(path):
    """RGB of the pixel near the top-left corner of an 8-bit PNG (RGB/RGBA, non-interlaced), else None."""
    d = open(path, 'rb').read()
    w, h, bd, ct, _, _, il = struct.unpack('>IIBBBBB', d[16:29])
    if bd != 8 or ct not in (2, 6) or il: return None
    bpp = 3 if ct == 2 else 4
    raw = zlib.decompress(b''.join(d[i + 8:i + 8 + n] for i, n in chunks(d) if d[i + 4:i + 8] == b'IDAT'))
    stride = w * bpp
    prev = bytearray(stride); rows = []
    p = 0
    for _ in range(min(h, 8)):
        f = raw[p]; line = bytearray(raw[p + 1:p + 1 + stride]); p += 1 + stride
        for x in range(stride):
            a = line[x - bpp] if x >= bpp else 0; b = prev[x]; c = prev[x - bpp] if x >= bpp else 0
            if f == 1: line[x] = (line[x] + a) & 255
            elif f == 2: line[x] = (line[x] + b) & 255
            elif f == 3: line[x] = (line[x] + (a + b) // 2) & 255
            elif f == 4:
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append(line); prev = line
    px = rows[min(6, len(rows) - 1)][6 * bpp:6 * bpp + bpp]
    return '#%02x%02x%02x' % (px[0], px[1], px[2])

def chunks(d):
    i = 8
    while i < len(d):
        n = struct.unpack('>I', d[i:i + 4])[0]
        yield i, n
        i += 12 + n

def lighten(hexc, amt):
    r, g, b = (int(hexc[i:i + 2], 16) for i in (1, 3, 5))
    f = lambda v: max(0, min(255, int(v + (255 - v) * amt if amt > 0 else v * (1 + amt))))
    return '#%02x%02x%02x' % (f(r), f(g), f(b))

# --- glyph tiles: (file title, glyph key, bg top, bg bottom, glyph colour, glyph height %)
GLYPH_TILES = [
    ('Plex', 'plex', '#2a2d31', '#0b0c0d', '#EBAF00', 58),
]
# --- own-icon tiles: (file title, icon file, mode, logo height %, bg override)
#   flat: the logo sits on the colour read from its corner;  dark: transparent glyph icon on a gradient given as bg
OWN_TILES = [
    ('Homebrew', 'org.webosbrew.hbchannel.png', 'flat', 76, None),
    ('Glasshouse', 'com.tvweb.dashboard.png', 'flat', 70, '#000000'),
    ('Media Player', 'com.webos.app.mediadiscovery.png', 'dark', 68, ('#2a1d52', '#0d0a1f')),
    ('Browser', 'com.webos.app.browser.png', 'dark', 68, ('#0f3a66', '#06182b')),
    ('Fruit Ninja', 'com.halfbrick.fruitninja.png', 'art', 100, None),
    ('Live TV', 'livetv.png', 'flat', 70, '#5d7b74'),
    ('LG Channels', 'lgchannels.png', 'flat', 76, '#f0402f'),
    ('AirPlay', 'airplay.png', 'flat', 70, '#000000'),
    ('Screen Share', 'miracast.png', 'flat', 76, '#ffffff'),
    ('Game Optimizer', 'gameoptimizer.png', 'flat', 70, '#4d4e6c'),
    ('TV Settings', 'lgsettings.png', 'flat', 70, '#4d4e6c'),
]

# --- logo tiles (transparent PNG logos from homarr-labs/dashboard-icons, in tools/logos/): (title, file, bg top, bg bottom, logo height %, make white)
LOGO_TILES = [
    ('Netflix', 'netflix.png', '#26262a', '#000000', 62, False),
    ('YouTube', 'youtube-full.png', '#ffffff', '#cfd2d8', 0, False),
    ('JioHotstar', 'jiohotstar.png', '#2b1d78', '#090c33', 64, False),
    ('Prime Video', 'prime-video.png', '#13b0f0', '#04407f', 64, False),
]

PAGE = '''<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Inter;font-weight:100 900;src:url("file://%(font)s") format("woff2")}
*{box-sizing:border-box;margin:0}html,body{width:800px;height:480px;overflow:hidden;background:#000}
.t{position:relative;width:800px;height:480px;overflow:hidden;display:flex;align-items:center;justify-content:center;%(bg)s}
.t::after{content:'';position:absolute;inset:0;z-index:3;pointer-events:none;background:linear-gradient(to bottom,rgba(255,255,255,.16),rgba(255,255,255,0) 42%%)}
.t svg{width:auto;position:relative;z-index:1;filter:drop-shadow(0 10px 16px rgba(0,0,0,.35))}
.t img{position:relative;z-index:1;display:block}
.t .bd{position:absolute;left:-12%%;top:-30%%;width:124%%;height:160%%;object-fit:cover;filter:blur(30px) saturate(1.2)}
</style><div class="t">%(body)s</div>'''

def render(title, bg, body):
    slug = ''.join(c for c in title.lower() if c.isalnum())
    with tempfile.NamedTemporaryFile('w', suffix='.html', delete=False) as f:
        f.write(PAGE % {'bg': bg, 'body': body, 'font': f'{ROOT}/app/src/assets/inter-latin-wght.woff2'}); src = f.name
    dst = f'{OUT}/{slug}.png'
    subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--window-size=800,480',
                    '--force-device-scale-factor=1', '--virtual-time-budget=1500', f'--screenshot={dst}', f'file://{src}'], capture_output=True)
    os.unlink(src)
    return os.path.getsize(dst) if os.path.exists(dst) else 0

if __name__ == '__main__':
    for old in os.listdir(OUT):          # start clean so no stale file from an earlier version survives
        if old.endswith('.png'): os.unlink(f'{OUT}/{old}')
    for title, key, top, bot, col, h in GLYPH_TILES:
        body = f'<svg viewBox="0 0 24 24" style="height:{h}%;fill:{col}"><path d="{GLYPHS[key]["path"]}"/></svg>'
        n = render(title, f'background:linear-gradient(to bottom,{top},{bot});', body)
        print(f'{title:13s} {n // 1024} KB (glyph)')
    for title, file, top, bot, h, white in LOGO_TILES:
        flt = 'filter:brightness(0) invert(1) drop-shadow(0 8px 14px rgba(0,0,0,.30));' if white else 'filter:drop-shadow(0 10px 18px rgba(0,0,0,.45));'
        if file == 'youtube-full.png':   # logo + wordmark (transparent PNG): same shadow as the other tiles, on a light grey gradient
            img = f'<img src="file://{ROOT}/tools/logos/{file}" style="width:640px;filter:drop-shadow(0 10px 16px rgba(0,0,0,.30))">'
        else:
            img = f'<img src="file://{ROOT}/tools/logos/{file}" style="height:{h}%;{flt}">'
        n = render(title, f'background:linear-gradient(to bottom,{top},{bot});', img)
        print(f'{title:13s} {n // 1024} KB (logo)')
    for title, icon, mode, h, extra in OWN_TILES:
        p = next((f'{d}/{icon}' for d in ICON_DIRS if os.path.exists(f'{d}/{icon}')), f'{ICON_DIRS[-1]}/{icon}')
        if mode == 'flat':
            c = extra or corner_color(p) or '#222'
            bg = f'background:{c};'   # solid, so the icon's own square can't show
            body = f'<img src="file://{p}" style="height:{h}%">'
        elif mode == 'dark':
            bg = f'background:linear-gradient(to bottom,{extra[0]},{extra[1]});'
            body = f'<img src="file://{p}" style="height:{h}%;filter:drop-shadow(0 8px 14px rgba(0,0,0,.4))">'
        else:  # art: a photo-like icon, blurred copy fills the tile
            bg = 'background:#111;'
            body = f'<img class="bd" src="file://{p}"><img src="file://{p}" style="height:84%;border-radius:20px;box-shadow:0 12px 26px rgba(0,0,0,.45)">'
        n = render(title, bg, body)
        print(f'{title:13s} {n // 1024} KB ({mode}{", " + (extra if isinstance(extra, str) else "") if mode == "flat" else ""})')
