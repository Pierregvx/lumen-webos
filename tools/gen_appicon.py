#!/usr/bin/env python3
"""App icon (80x80, 130x130) and launch screen (1920x1080) for the launcher: four glass tiles on a deep gradient. Output goes to app/public/.
Run: python3 tools/gen_appicon.py  (needs Google Chrome for the headless render)"""
import os, subprocess, tempfile
ROOT = os.path.expanduser('~/Developer/webos-launcher-tvos')
OUT = f'{ROOT}/app/public'
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
FONT = f'{ROOT}/app/src/assets/inter-latin-wght.woff2'
NAME = os.environ.get('APP_NAME', 'Lumen')

def tiles(size_css):
    # four rounded tiles in a 2x2 grid; the top-left one is solid white (the focused tile), the others are translucent
    return f'''<div class="g" style="{size_css}"><i class="a"></i><i></i><i></i><i></i></div>'''

PAGE = '''<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Inter;font-weight:100 900;src:url("file://%(font)s") format("woff2")}
*{box-sizing:border-box;margin:0}html,body{width:%(w)dpx;height:%(h)dpx;overflow:hidden;background:#000;font-family:Inter,sans-serif}
.bg{width:%(w)dpx;height:%(h)dpx;display:flex;flex-direction:column;align-items:center;justify-content:center;
 background:radial-gradient(120%% 90%% at 18%% 12%%,#6a49d8 0%%,#2c2a8f 42%%,#0b0f33 100%%)}
.g{display:grid;grid-template-columns:1fr 1fr;gap:%(gap)dpx}
.g i{display:block;border-radius:%(rad)dpx;background:rgba(255,255,255,.34);box-shadow:inset 0 %(hl)dpx 0 rgba(255,255,255,.55)}
.g i.a{background:#fff;box-shadow:0 %(sh)dpx %(shb)dpx rgba(0,0,0,.35)}
.t{color:#fff;font-weight:300;letter-spacing:.04em;margin-top:%(tm)dpx;font-size:%(fs)dpx;text-shadow:0 4px 24px rgba(0,0,0,.35)}
</style><div class="bg">%(body)s</div>'''

def render(name, w, h, body, **k):
    with tempfile.NamedTemporaryFile('w', suffix='.html', delete=False) as f:
        f.write(PAGE % dict(font=FONT, w=w, h=h, body=body, tm=0, fs=0, **k)); src = f.name
    dst = f'{OUT}/{name}'
    subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', f'--window-size={w},{h}', '--force-device-scale-factor=1',
                    '--virtual-time-budget=1500', f'--screenshot={dst}', f'file://{src}'], capture_output=True)
    os.unlink(src); print(name, os.path.getsize(dst) // 1024, 'KB')

render('icon.png', 80, 80, tiles('width:44px;height:44px'), gap=4, rad=9, hl=1, sh=2, shb=4)
render('largeIcon.png', 130, 130, tiles('width:72px;height:72px'), gap=6, rad=14, hl=1, sh=3, shb=6)
splash = tiles('width:230px;height:230px') + f'<div class="t">{NAME}</div>'
with tempfile.NamedTemporaryFile('w', suffix='.html', delete=False) as f:
    f.write((PAGE % dict(font=FONT, w=1920, h=1080, body=splash, tm=0, fs=0, gap=22, rad=44, hl=3, sh=14, shb=30)).replace('margin-top:0px;font-size:0px', 'margin-top:56px;font-size:64px')); src = f.name
subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--window-size=1920,1080', '--force-device-scale-factor=1',
                '--virtual-time-budget=1500', f'--screenshot={OUT}/splash.png', f'file://{src}'], capture_output=True)
os.unlink(src); print('splash.png', os.path.getsize(f'{OUT}/splash.png') // 1024, 'KB')
