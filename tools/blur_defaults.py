#!/usr/bin/env python3
"""A pre-blurred 960x540 copy of each bundled default wallpaper (default-N-blur.jpg). The launcher's glass shapes show this copy
instead of blurring the live wallpaper with backdrop-filter, which is too heavy for the TV's graphics chip.
Run: python3 tools/blur_defaults.py [folder]   (default: app/private/wallpapers, your own defaults; the bundled ones are in app/public/wallpapers)"""
import glob, os, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = sys.argv[1] if len(sys.argv) > 1 else f'{ROOT}/app/private/wallpapers'
FF = f'{ROOT}/tools/node_modules/ffmpeg-static/ffmpeg'
for src in sorted(glob.glob(f'{DIR}/default-?.jpg')):
    dst = src.replace('.jpg', '-blur.jpg')
    subprocess.run([FF, '-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-vf',
                    'scale=960:540:force_original_aspect_ratio=increase,crop=960:540,gblur=sigma=5,eq=brightness=0.04:saturation=1.35',
                    '-q:v', '2', dst], check=True)
    print(os.path.basename(dst), os.path.getsize(dst) // 1024, 'KB')

# strongly blurred 480x270 copies: the full-screen backdrop shown behind the lower rows (like tvOS blurring the wallpaper in the app grid)
for src in sorted(glob.glob(f'{DIR}/default-?.jpg')):
    dst = src.replace('.jpg', '-bg.jpg')
    subprocess.run([FF, '-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-vf',
                    'scale=480:270:force_original_aspect_ratio=increase,crop=480:270,gblur=sigma=9,eq=brightness=0.02:saturation=1.25',
                    '-q:v', '3', dst], check=True)
    print(os.path.basename(dst), os.path.getsize(dst) // 1024, 'KB')
