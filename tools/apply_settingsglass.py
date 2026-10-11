#!/usr/bin/env python3
"""Forty-fourth patch layer: the Settings screen is frosted and see-through like the dock, not a solid dark panel. The blurred wallpaper copy moves to a faded
pseudo-element behind the content (the same trick as the dock bar), tinted dark for Dark and light for Light."""
import os
p = os.path.expanduser('~/Developer/webos-launcher-tvos/app/src/theme/global.css')
s = open(p).read()
s += """
/* Settings: frosted and see-through like the dock (the blurred wallpaper copy on a faded layer behind the content) */
.screen.screen--settings, .wp-image .screen.screen--settings, .wp-video .screen.screen--settings { background: transparent !important; background-image: none !important; isolation: isolate; }
.screen--settings::before {
	content: ''; position: absolute; left: 0; top: 0; right: 0; bottom: 0; z-index: -1; pointer-events: none; opacity: 0.84; animation: none;
	background-image: linear-gradient(rgba(10, 12, 22, 0.30), rgba(10, 12, 22, 0.42)), var(--wp-blur, none);
	background-size: cover; background-position: center; background-repeat: no-repeat; background-color: rgb(24, 28, 40);
}
html.light .screen--settings::before {
	background-image: linear-gradient(rgba(255, 255, 255, 0.10), rgba(255, 255, 255, 0.10)), var(--wp-blur, none);
	background-color: rgb(120, 128, 148); background-blend-mode: normal, screen;
}
html.light.wp-video .screen--settings::before { background-color: transparent; background-blend-mode: normal; }
html.in-settings .screen:not(.screen--settings) { visibility: hidden; }
/* over the video the glass is clear, so Settings gets a stronger fill: the text must stay readable */
html.wp-video .screen--settings::before { background-image: linear-gradient(rgba(10, 12, 22, 0.76), rgba(10, 12, 22, 0.84)); opacity: 1; }
html.light.wp-video .screen--settings::before { background-image: linear-gradient(rgba(246, 247, 251, 0.84), rgba(240, 242, 248, 0.90)); }
"""
open(p, 'w').write(s)

app = os.path.expanduser('~/Developer/webos-launcher-tvos/app/src/app.tsx')
a = open(app).read()
m = "useEffect(() => { setVideoPaused(screen === 'settings'); }, [screen]);"
assert m in a
open(app, 'w').write(a.replace(m, "useEffect(() => { setVideoPaused(screen === 'settings'); document.documentElement.classList.toggle('in-settings', screen === 'settings'); }, [screen]);"))
