#!/usr/bin/env python3
"""Third patch layer (after apply_features.py): wallpaper Favorites (hold OK in the picker), auto-change every N minutes, night dimming."""
import os
APP = os.path.expanduser('~/Developer/webos-launcher-tvos/app')
def P(p): return os.path.join(APP, p)
def sub(p, pairs):
    s = open(P(p)).read()
    for a, b in pairs:
        assert a in s, (p, a[:70])
        s = s.replace(a, b, 1)
    open(P(p), 'w').write(s)

sub('src/lib/storage.ts', [
 ("	idleMinutes: number;\n}", "	idleMinutes: number;\n	/** cloud wallpaper ids marked as favourites (hold OK in the picker) */\n	favoriteWallpapers: string[];\n	/** pick a new wallpaper every N minutes when a shuffle is chosen; 0 = never */\n	wpAutoMinutes: number;\n	/** dim the wallpaper between 19:00 and 06:00 */\n	nightDim: boolean;\n}"),
 ("	idleMinutes: 0\n};", "	idleMinutes: 0,\n	favoriteWallpapers: [],\n	wpAutoMinutes: 0,\n	nightDim: false\n};"),
 ("			idleMinutes: typeof parsed.idleMinutes === 'number' ? parsed.idleMinutes : 0\n", "			idleMinutes: typeof parsed.idleMinutes === 'number' ? parsed.idleMinutes : 0,\n			favoriteWallpapers: Array.isArray(parsed.favoriteWallpapers) ? parsed.favoriteWallpapers : [],\n			wpAutoMinutes: typeof parsed.wpAutoMinutes === 'number' ? parsed.wpAutoMinutes : 0,\n			nightDim: parsed.nightDim === true\n"),
])

sub('src/lib/wallpaper.ts', [
 ("function candidates (sel: string): string[] {", "let favorites: string[] = [];\n/** the favourite cloud ids, for the 'shuffle:Favorites' choice */\nexport function setFavorites (ids: string[]): void { favorites = ids; }\n\nfunction candidates (sel: string): string[] {"),
 ("const group = sel.indexOf('shuffle:') === 0 ? WALLPAPERS.filter((w) => w.category === sel.slice(8)) : WALLPAPERS;", "const group = sel === 'shuffle:Favorites' ? WALLPAPERS.filter((w) => favorites.indexOf(w.id) !== -1) : sel.indexOf('shuffle:') === 0 ? WALLPAPERS.filter((w) => w.category === sel.slice(8)) : WALLPAPERS;"),
])

sub('src/components/WallpaperPicker.tsx', [
 ("	thumb?: string;", "	fav?: boolean;\n	thumb?: string;"),
 ("								{e.key === current && <span class=\"wp__tick\">", "								{e.fav && <span class=\"wp__fav\">{'\\u2605'}</span>}\n								{e.key === current && <span class=\"wp__tick\">"),
])

sub('src/screens/Settings.tsx', [
 ("	onPick: (key: string) => void;\n}", "	onPick: (key: string) => void;\n	/** hold OK on a picture: add or remove it from Favorites */\n	onFavorite: (key: string) => void;\n}"),
 ("OK sets the wallpaper · Back returns home'", "OK sets the wallpaper · hold OK adds it to Favorites · Back returns home'"),
 ("	const onLongPress = () => { if (tab) setMode(!reordering); };", "	const onLongPress = () => {\n		if (onWallpaper) { if (zone === 'content' && wpList[wpIndex]) wallpaper.onFavorite(wpList[wpIndex].key); return; }\n		if (tab) setMode(!reordering);\n	};"),
])

sub('src/screens/Settings.tsx', [("(wpName === 'All' ? e.key.indexOf('shuffle:') !== 0 :", "(wpName === 'All' ? e.key.indexOf('shuffle:') !== 0 && e.category !== 'Favorites' :")])

sub('src/app.tsx', [
 ("import {resized, setWallpaper} from './lib/wallpaper';", "import {resized, setFavorites, setWallpaper} from './lib/wallpaper';"),
 ("show-ampm', idle: 'idle-screensaver'} as const;", "show-ampm', idle: 'idle-screensaver', wpAuto: 'wp-auto', nightDim: 'night-dim'} as const;\nconst WP_AUTO_CHOICES = [0, 15, 30, 60];"),
 ("	useEffect(() => setWallpaper(config.wallpaper), [config.wallpaper]);", """	useEffect(() => { setFavorites(config.favoriteWallpapers); setWallpaper(config.wallpaper); }, [config.wallpaper]);
	useEffect(() => setFavorites(config.favoriteWallpapers), [config.favoriteWallpapers]);

	// a new wallpaper every N minutes (only when a shuffle is chosen)
	useEffect(() => {
		if (!config.wpAutoMinutes || config.wallpaper.indexOf('shuffle') !== 0) return;
		const id = window.setInterval(() => { if (!document.hidden) setWallpaper(config.wallpaper); }, config.wpAutoMinutes * 60000);
		return () => window.clearInterval(id);
	}, [config.wpAutoMinutes, config.wallpaper]);

	// night: a dimmer wallpaper between 19:00 and 06:00
	useEffect(() => {
		const apply = () => { const h = new Date().getHours(); document.documentElement.classList.toggle('night', config.nightDim && (h >= 19 || h < 6)); };
		apply();
		const id = window.setInterval(apply, 60000);
		return () => { window.clearInterval(id); document.documentElement.classList.remove('night'); };
	}, [config.nightDim]);"""),
 ("		{\n			id: OPTION.showAmPm,", "		{\n			id: OPTION.wpAuto,\n			label: 'Change wallpaper automatically',\n			description: 'With a Shuffle wallpaper chosen, pick a new picture every 15, 30 or 60 minutes.',\n			value: config.wpAutoMinutes > 0,\n			valueText: config.wpAutoMinutes ? `${config.wpAutoMinutes} min` : 'Off'\n		},\n		{\n			id: OPTION.nightDim,\n			label: 'Dim the wallpaper at night',\n			description: 'Between 7 pm and 6 am the wallpaper is darker, easier on the eyes in a dark room.',\n			value: config.nightDim\n		},\n		{\n			id: OPTION.showAmPm,"),
 ("config.showAmPm, config.idleMinutes]);", "config.showAmPm, config.idleMinutes, config.wpAutoMinutes, config.nightDim]);"),
 ("		else if (optionId === OPTION.idle)", "		else if (optionId === OPTION.nightDim) updateConfig({...config, nightDim: !config.nightDim});\n		else if (optionId === OPTION.wpAuto) updateConfig({...config, wpAutoMinutes: WP_AUTO_CHOICES[(WP_AUTO_CHOICES.indexOf(config.wpAutoMinutes) + 1) % WP_AUTO_CHOICES.length]});\n		else if (optionId === OPTION.idle)"),
 ("		WALLPAPERS.forEach((w) => entries.push({key: `cloud:${w.id}`, title: w.title, category: w.category, thumb: resized(cloudUrl(w), 360)}));\n		return {\n			categories: ['Defaults'].concat(WALLPAPER_CATEGORIES, 'All'),",
  "		entries.push({key: 'shuffle:Favorites', title: 'Shuffle my favorites', category: 'Favorites'});\n		WALLPAPERS.forEach((w) => {\n			const fav = config.favoriteWallpapers.indexOf(w.id) !== -1;\n			const e = {key: `cloud:${w.id}`, title: w.title, category: w.category, thumb: resized(cloudUrl(w), 360), fav};\n			entries.push(e);\n			if (fav) entries.push({...e, category: 'Favorites'});\n		});\n		return {\n			categories: ['Defaults', 'Favorites'].concat(WALLPAPER_CATEGORIES, 'All'),"),
 ("			onPick: (key: string) => updateConfig({...config, wallpaper: key})", "			onPick: (key: string) => updateConfig({...config, wallpaper: key}),\n			onFavorite: (key: string) => {\n				if (key.indexOf('cloud:') !== 0) return;\n				const id = key.slice(6);\n				const has = config.favoriteWallpapers.indexOf(id) !== -1;\n				updateConfig({...config, favoriteWallpapers: has ? config.favoriteWallpapers.filter((x) => x !== id) : config.favoriteWallpapers.concat(id)});\n				showToast(has ? 'Removed from Favorites' : 'Added to Favorites');\n			}"),
])

css = open(P('src/theme/global.css')).read()
css += """
/* ---------- wallpaper favourites, night dimming ---------- */
.wp__fav { position: absolute; left: 12px; top: 12px; width: 38px; height: 38px; border-radius: 50%; background: rgba(0, 0, 0, 0.55); color: #ffd60a; text-align: center; line-height: 38px; font-size: 22px; }
html.night #wpimage { opacity: 0.55; }
"""
open(P('src/theme/global.css'), 'w').write(css)
print('wallpaper extras applied')
