#!/usr/bin/env python3
"""Twenty-fourth patch layer: fixes from Reddit feedback (LG C2).
 1. Every installed app is listed (the whitelist that kept only my own apps is gone); a new install starts with the installed apps on the home screen.
 2. App icons that are small squares (130 px) are no longer stretched over the wide tile: they sit at a sharp size on a tile coloured like the icon.
 3. Control Center, Inputs and the other panels open without an animation over the glass, the glass is positioned instead of 'fixed' (no repaint
    of the whole screen while it changes), and the Control Center reads the TV's values a moment after it is on screen."""
import os
APP = os.path.expanduser('~/Developer/webos-launcher-tvos/app')
def P(p): return os.path.join(APP, p)
def sub(p, pairs):
    s = open(P(p)).read()
    for a, b in pairs:
        assert a in s, (p, a[:80])
        s = s.replace(a, b, 1)
    open(P(p), 'w').write(s)

# ---- 1 + 2: the app list
sub('src/lib/apps.ts', [
 ("	iconUrl?: string;\n	color?: string;\n}", "	iconUrl?: string;\n	color?: string;\n	/** a small square icon (not full tile artwork): drawn at a sharp size on a tile coloured like it */\n	plain?: boolean;\n}"),
 ("		iconUrl: packIcon(a.id, a.title) || (a.icon ? ICON_DIR + a.icon : undefined),\n		color: a.color\n	}));", """		iconUrl: (DEV_PLAIN ? undefined : packIcon(a.id, a.title)) || (a.icon ? ICON_DIR + a.icon : undefined),\n		color: a.color,\n		plain: DEV_PLAIN ? !!a.icon : (!packIcon(a.id, a.title) && !!a.icon)\n	}));"""),
 ("function catalogEntries (", "/** dev preview only: ?plain shows the catalogue's small icons the way unknown apps are drawn */\nconst DEV_PLAIN = import.meta.env.DEV && /[?&]plain/.test(location.search);\n\nfunction catalogEntries ("),
 ("			const wanted = APP_CATALOG.map((c) => c.id);\n			const points = (parsed.launchPoints || []).filter((p) => p.id && p.title && HIDDEN_IDS.indexOf(p.id) === -1 && wanted.indexOf(p.id) !== -1);",
  "			const points = (parsed.launchPoints || []).filter((p) => p.id && p.title && HIDDEN_IDS.indexOf(p.id) === -1);"),
 ("			return loadIcons(points).then((icons) => points.map((p) => {", "			return loadIcons(points).then((icons) => Promise.all(points.map((p) => {"),
 ("					color: known && known.color\n				};\n			}));", """					color: known && known.color,
					plain: !packIcon(p.id, known ? known.title : p.title) && !!(icons[p.id] || (known && known.icon))
				} as AppEntry;
			}).map(withIconColor)));"""),
])
s = open(P('src/lib/apps.ts')).read()
s += """
/** The colour of an icon's own background (a pixel at its left edge, or its top), so a small icon can sit on a tile of the same colour. Icons read from the TV
 *  are data: URIs, so the canvas can be read; a file the app ships may not allow it, then the catalogue colour (or a dark default) is used. */
function sampleColor (url: string): Promise<string | undefined> {
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () => {
			try {
				const c = document.createElement('canvas');
				c.width = img.naturalWidth; c.height = img.naturalHeight;
				const g = c.getContext('2d');
				if (!g) { resolve(undefined); return; }
				g.drawImage(img, 0, 0);
				const spots = [[3, Math.floor(c.height / 2)], [Math.floor(c.width / 2), 3], [c.width - 4, Math.floor(c.height / 2)]];
				for (const [x, y] of spots) {
					const d = g.getImageData(x, y, 1, 1).data;
					if (d[3] > 200) { resolve(`rgb(${d[0]}, ${d[1]}, ${d[2]})`); return; }
				}
				resolve(undefined);
			} catch { resolve(undefined); }
		};
		img.onerror = () => resolve(undefined);
		img.src = url;
	});
}

function withIconColor (entry: AppEntry): Promise<AppEntry> {
	if (!entry.plain || !entry.iconUrl) return Promise.resolve(entry);
	return sampleColor(entry.iconUrl).then((color) => ({...entry, color: color || entry.color}));
}

/** What a fresh install shows on the home screen: the catalogue's favourites first, then the other installed apps, without the TV's own system apps. */
export function seedAppIds (apps: AppEntry[], preferred: string[]): string[] {
	const system = /^(com\\.webos\\.|com\\.palm\\.|com\\.lge\\.|airplay$|google\\.assistant|amazon\\.alexa|yandex\\.alice)/;
	const rest = apps.filter((a) => preferred.indexOf(a.id) === -1 && !system.test(a.id)).map((a) => a.id);
	const first = preferred.filter((id) => apps.some((a) => a.id === id));
	return first.concat(rest).slice(0, 24);
}
"""
open(P('src/lib/apps.ts'), 'w').write(s)
# the catalogue/homebrew paths now return promises in one place: listViaHomebrew's result type is unchanged (Promise<AppEntry[]>)

sub('src/lib/apps.ts', [
 ("	if (!isWebOS()) return Promise.resolve({apps: catalogEntries(APP_CATALOG), source: 'catalog'});", "	if (!isWebOS()) return Promise.all(catalogEntries(APP_CATALOG).map(withIconColor)).then((apps): AppList => ({apps, source: 'catalog'}));"),
 ("		.then((present) => catalogEntries(APP_CATALOG.filter((_, i) => present[i])));", "		.then((present) => Promise.all(catalogEntries(APP_CATALOG.filter((_, i) => present[i])).map(withIconColor)));"),
])
sub('src/components/Tile.tsx', [
 ("	/** monogram background when there is no artwork */\n	color?: string;", "	/** monogram background when there is no artwork */\n	color?: string;\n	/** imageUrl is a small square icon: drawn sharp and centred on the colour instead of stretched over the tile */\n	plain?: boolean;"),
 ("<div class=\"tile__box\" style={model.color && !model.imageUrl ? {background: model.color} : undefined}>", "<div class=\"tile__box\" style={model.color && (!model.imageUrl || model.plain) ? {background: model.color} : undefined}>"),
 ("					: model.imageUrl\n					? <img class=\"tile__image\" src={model.imageUrl} alt=\"\" />", "					: model.imageUrl\n					? <img class={model.plain ? 'tile__image tile__image--icon' : 'tile__image'} src={model.imageUrl} alt=\"\" />"),
])
sub('src/lib/tiles.ts', [("return {key: app.id, label: app.title, imageUrl: app.iconUrl, color: app.color};", "return {key: app.id, label: app.title, imageUrl: app.iconUrl, color: app.color, plain: app.plain};")])

# a new install starts with the installed apps on the home screen
sub('src/lib/storage.ts', [
 ("	folders: {name: string; appIds: string[]}[];\n}", "	folders: {name: string; appIds: string[]}[];\n	/** false on a fresh install until the installed apps have been put on the home screen once */\n	seeded: boolean;\n}"),
 ("	folders: []\n};", "	folders: [],\n	seeded: false\n};"),
 ("			folders: Array.isArray(parsed.folders) ? parsed.folders : []\n", "			folders: Array.isArray(parsed.folders) ? parsed.folders : [],\n			seeded: parsed.seeded !== false\n"),
])
sub('src/app.tsx', [
 ("import {listApps, type AppEntry} from './lib/apps';", "import {listApps, seedAppIds, type AppEntry} from './lib/apps';"),
 ("import {loadConfig, saveConfig, toggleId, type UserConfig} from './lib/storage';", "import {DEFAULT_CONFIG, loadConfig, saveConfig, toggleId, type UserConfig} from './lib/storage';"),
 ("	// idle screensaver: after the chosen minutes", """	// first run: put the installed apps on the home screen (the catalogue's favourites first)
	useEffect(() => {
		const c = configRef.current;
		if (c.seeded || apps.length === 0) return;
		updateConfig({...c, seeded: true, appIds: seedAppIds(apps, DEFAULT_CONFIG.appIds)});
	}, [apps]);

	// idle screensaver: after the chosen minutes"""),
])

# ---- 3: lighter panels
sub('src/components/ControlCenter.tsx', [
 ("	useEffect(() => { readControls().then(setValues); readStatus().then((s) => setNet(s.network)).catch(() => undefined); }, []);",
  "	// read the TV's values a moment after the panel is on screen, so opening it is never held up by the TV answering\n	useEffect(() => {\n		const id = window.setTimeout(() => { readControls().then(setValues); readStatus().then((s) => setNet(s.network)).catch(() => undefined); }, 250);\n		return () => window.clearTimeout(id);\n	}, []);"),
])
css = open(P('src/theme/global.css')).read()
css += """
/* ---------- icons: small square icons stay sharp on a tile of their own colour ---------- */
.tile__image--icon { left: 50%; top: 50%; width: auto; height: 66%; max-width: 70%; transform: translate(-50%, -50%); object-fit: contain; border-radius: 16%; }

/* ---------- panels: no entry animation, glass placed with a fixed offset instead of background-attachment: fixed ---------- */
.panel { animation: none; box-shadow: inset 2px 2px 1.5px -1px rgba(255, 255, 255, 0.5), 0 10px 24px rgba(0, 0, 0, 0.3); }
.panel { --pw: 760px; --pt: 190px; background-attachment: scroll, scroll; background-position: 0 0, calc(var(--pw) + var(--layout-edge-padding) - 1920px) calc(-1 * var(--pt)); }
.panel--cc { --pw: 700px; --pt: 150px; }
.panel--ctx { background-position: 0 0, -740px -300px; }
.panel--folder { background-position: 0 0, -580px -250px; }
"""
open(P('src/theme/global.css'), 'w').write(css)
print('feedback applied')
