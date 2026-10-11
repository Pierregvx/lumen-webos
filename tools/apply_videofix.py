#!/usr/bin/env python3
"""Twenty-seventh patch layer: the video wallpaper was playing but hidden. The still-wallpaper layer (#wpimage) sits on top of the <video> (same
z-index, later in the page), so with any picture wallpaper chosen you kept seeing the picture. While a video plays, the picture is now hidden."""
import os
p = os.path.expanduser('~/Developer/webos-launcher-tvos/app/src/theme/global.css')
s = open(p).read()
s += "\n/* video wallpaper playing: hide the still picture that would otherwise cover it */\nhtml.wp-video #wpimage { display: none; }\n"
open(p, 'w').write(s)
