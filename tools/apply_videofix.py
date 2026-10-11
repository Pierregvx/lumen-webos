#!/usr/bin/env python3
"""Twenty-seventh patch layer: the video wallpaper was playing but hidden. The still-wallpaper layer (#wpimage) sits on top of the <video> (same
z-index, later in the page), so with any picture wallpaper chosen you kept seeing the picture. While a video plays, the picture is now hidden."""
import os
p = os.path.expanduser('~/Developer/webos-launcher-tvos/app/src/theme/global.css')
s = open(p).read()
s += "\n/* video wallpaper playing: hide the still picture that would otherwise cover it, and give the glass a plain tinted fill (it is made from a blurred copy of the still picture, which would not match the video) */\nhtml.wp-video #wpimage { display: none; }\nhtml.wp-video { --wp-blur: linear-gradient(rgba(70, 76, 96, 0.90), rgba(44, 48, 66, 0.94)) !important; --wp-bg: linear-gradient(rgba(70, 76, 96, 0.90), rgba(44, 48, 66, 0.94)) !important; }\n"
open(p, 'w').write(s)
