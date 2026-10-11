#!/usr/bin/env python3
"""Thirty-fifth patch layer:
 - Hide the dock (Settings > Options): Down on the last row slides the dock away, and/or it hides itself after 8 s without a key press; any key (or moving the
   pointer) brings it back. Off / Down arrow / After idle / Both.
 - No screensaver while the video wallpaper is on: Lumen's own idle screensaver is skipped, and a flag file tells the TV-side watcher (tools/tv/watch.sh)
   to end LG's screensaver while Lumen is in front."""
import os
APP = os.path.expanduser('~/Developer/webos-launcher-tvos/app')
ROOT = os.path.expanduser('~/Developer/webos-launcher-tvos')
def P(p): return os.path.join(APP, p)
def sub(p, pairs, full=None):
    s = open(full or P(p)).read()
    for a, b in pairs:
        assert a in s, (p, a[:80])
        s = s.replace(a, b)
    open(full or P(p), 'w').write(s)

sub('src/screens/Home.tsx', [
 ("	weatherText?: string;\n}", "	weatherText?: string;\n	/** off | down | idle | both: when the dock slides away */\n	dockHide?: string;\n}"),
 ("	mode: 'key' | 'pointer';\n}", "	mode: 'key' | 'pointer';\n	/** the dock is slid away; any key brings it back */\n	dockHidden: boolean;\n}"),
 ("ctxFrom: 'rows', mode: 'key'}", "ctxFrom: 'rows', mode: 'key', dockHidden: false}"),
 ("folders, weatherText}: Props)", "folders, weatherText, dockHide}: Props)"),
 ("{rows, topItems, menuItems, inputs, onActivate, onEdit, folders}", "{rows, topItems, menuItems, inputs, onActivate, onEdit, folders, dockHide}"),
 ("	const handleKey = useCallback((key: NavKey): boolean => {\n		const n = nav.current;", "	const idleTimer = useRef(0);\n	const armIdle = () => {\n		window.clearTimeout(idleTimer.current);\n		const mode = latest.current.dockHide;\n		if (mode !== 'idle' && mode !== 'both') return;\n		idleTimer.current = window.setTimeout(() => {\n			const m = nav.current;\n			if (m.zone === 'rows' && !m.moving && !document.hidden) { m.dockHidden = true; render(); }\n		}, 8000);\n	};\n\n	const handleKey = useCallback((key: NavKey): boolean => {\n		const n = nav.current;"),
 ("		n.mode = 'key';\n		if (!n.engaged)", "		n.mode = 'key';\n		const hideMode = latest.current.dockHide;\n		if (n.dockHidden) { n.dockHidden = false; armIdle(); render(); return true; }   // the key that brings the dock back does nothing else\n		armIdle();\n		if (!n.engaged)"),
 ("			case 'down': moveRow(Math.min(allRows.length - 1, rowIndex + 1)); break;", "			case 'down':\n				if (rowIndex >= allRows.length - 1 && (hideMode === 'down' || hideMode === 'both')) n.dockHidden = true;\n				else moveRow(Math.min(allRows.length - 1, rowIndex + 1));\n				break;"),
 ("			n.engaged = false; n.zone = 'rows'; n.rowIndex = 0;\n", "			n.engaged = false; n.zone = 'rows'; n.rowIndex = 0; n.dockHidden = false;\n"),
 ("	// while an app is being moved,", "	// the idle timer follows the option; moving the pointer brings a hidden dock back\n	useEffect(() => {\n		const m = nav.current;\n		if (dockHide === 'off' || dockHide === 'idle' || !dockHide) { if (dockHide !== 'idle' && m.dockHidden) { m.dockHidden = false; render(); } }\n		armIdle();\n		const show = () => { const k = nav.current; if (k.dockHidden) { k.dockHidden = false; armIdle(); render(); } };\n		window.addEventListener('mousemove', show);\n		return () => { window.removeEventListener('mousemove', show); window.clearTimeout(idleTimer.current); };\n	}, [dockHide]);\n\n	// while an app is being moved,"),
 ("`rows${n.zone === 'rows' && rowIndex >= 1 ? ' rows--lower' : ''}`", "`rows${n.zone === 'rows' && rowIndex >= 1 ? ' rows--lower' : ''}${n.dockHidden ? ' rows--hidden' : ''}`"),
])
sub('src/lib/storage.ts', [
 ("	/** dark glass and a dimmer wallpaper */", "	/** when the dock slides away: off | down | idle | both */\n	dockHide: string;\n	/** dark glass and a dimmer wallpaper */"),
 ("	darkMode: 'off',\n", "	darkMode: 'off',\n	dockHide: 'down',\n"),
 ("			darkMode: parsed.darkMode ===", "			dockHide: parsed.dockHide === 'off' || parsed.dockHide === 'idle' || parsed.dockHide === 'both' ? parsed.dockHide : 'down',\n			darkMode: parsed.darkMode ==="),
])
sub('src/lib/i18n.ts', [
 ("const TABLE: Record<string, string[]> = {", "const TABLE: Record<string, string[]> = {\n\t\"Hide the dock\": [\"Dock ausblenden\", \"Ocultar el dock\", \"Masquer le dock\", \"Nascondi il dock\", \"Ocultar o dock\", \"Dock verbergen\", \"Dock'u gizle\", \"डॉक छिपाएं\"],"),
])
sub('src/lib/system.ts', [
 ("/** Starts the TV's screensaver now", "/** Tells the TV-side watcher that the video wallpaper is on, so LG's screensaver is ended while Lumen is in front (a flag file, root via the Homebrew Channel). */\nexport function setVideoFlag (on: boolean): void {\n	if (!isWebOS()) return;\n	const command = on ? 'mkdir -p /var/lib/homehook && touch /var/lib/homehook/video-wallpaper' : 'rm -f /var/lib/homehook/video-wallpaper';\n	lunaCall(LUNA.homebrewExec, {command}, 6000).catch(() => undefined);\n}\n\n/** Starts the TV's screensaver now"),
])
sub('src/app.tsx', [
 ("import {startScreensaver} from './lib/system';", "import {setVideoFlag, startScreensaver} from './lib/system';"),
 ("		if (!config.idleMinutes) return;", "		if (!config.idleMinutes || config.videoWallpaper) return;   // no screensaver of our own while the video plays"),
 ("	}, [config.idleMinutes]);", "	}, [config.idleMinutes, config.videoWallpaper]);\n	useEffect(() => { setVideoFlag(config.videoWallpaper); }, [config.videoWallpaper]);"),
 ("weatherText={weatherText} />", "weatherText={weatherText} dockHide={config.dockHide} />"),
 ("videoClip: 'video-clip',", "videoClip: 'video-clip', dockHide: 'dock-hide',"),
 ("], [config.videoClip,", "], [config.dockHide, config.videoClip,"),
 ("		{\n			id: OPTION.darkMode,", "		{\n			id: OPTION.dockHide,\n			label: 'Hide the dock',\n			description: 'Down arrow: Down on the last row slides the dock away. After idle: it hides itself after 8 seconds without a key press. Any key brings it back.',\n			value: config.dockHide !== 'off',\n			valueText: config.dockHide === 'down' ? 'Down arrow' : config.dockHide === 'idle' ? 'After idle' : config.dockHide === 'both' ? 'Both' : 'Off'\n		},\n		{\n			id: OPTION.darkMode,"),
 ("		} else if (optionId === OPTION.darkMode)", "		} else if (optionId === OPTION.dockHide) {\n			const modes = ['off', 'down', 'idle', 'both'];\n			updateConfig({...config, dockHide: modes[(modes.indexOf(config.dockHide) + 1) % modes.length]});\n		} else if (optionId === OPTION.darkMode)"),
])
s = open(P('src/theme/global.css')).read()
s += "\n/* the dock slides away (Hide the dock) */\n.rows { transition: top 240ms cubic-bezier(0.2, 0.7, 0.2, 1), transform 260ms cubic-bezier(0.2, 0.7, 0.2, 1), opacity 220ms ease; }\n.rows--hidden { transform: translateY(1300px) !important; opacity: 0; pointer-events: none; }\n"
open(P('src/theme/global.css'), 'w').write(s)

sub('tools/tv/watch.sh', [
 ("SAVER_FLAG=/var/lib/homehook/frame-screensaver\n", "SAVER_FLAG=/var/lib/homehook/frame-screensaver\nVIDEO_FLAG=/var/lib/homehook/video-wallpaper\n"),
 ("  if [ -f \"$SAVER_FLAG\" ] && [ -d \"$APPS/$FRAME\" ]; then", "  # video wallpaper on and the launcher in front: no screensaver, LG's is ended as soon as it starts\n  vid=0\n  if [ -f \"$VIDEO_FLAG\" ]; then case \"$out\" in *'\"appId\":\"'$ME'\"'*) vid=1 ;; esac; fi\n  if [ \"$vid\" -eq 1 ]; then\n    pw=$(luna-send -n 1 luna://com.webos.service.tvpower/power/getPowerState '{}' </dev/null 2>/dev/null)\n    case \"$pw\" in\n      *'\"Screen Saver\"'*) luna-send -n 1 luna://com.webos.service.tvpower/power/turnOnScreen '{}' </dev/null >/dev/null 2>&1; echo \"$(date +%T) ended screensaver (video wallpaper)\" >> /tmp/homehook.log ;;\n    esac\n  elif [ -f \"$SAVER_FLAG\" ] && [ -d \"$APPS/$FRAME\" ]; then"),
], full=os.path.join(ROOT, 'tools/tv/watch.sh'))
