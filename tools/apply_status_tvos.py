#!/usr/bin/env python3
"""Sixth patch layer (after apply_home_extras.py): tvOS-style status (icons only on the home screen), date + weather as a header in the
time-pill menu, and a Weather city option (Auto = from the internet connection, or a preset city)."""
import os
APP = os.path.expanduser('~/Developer/webos-launcher-tvos/app')
def P(p): return os.path.join(APP, p)
def sub(p, pairs):
    s = open(P(p)).read()
    for a, b in pairs:
        assert a in s, (p, a[:80])
        s = s.replace(a, b, 1)
    open(P(p), 'w').write(s)
def write(p, s):
    os.makedirs(os.path.dirname(P(p)), exist_ok=True); open(P(p), 'w').write(s)

write('src/config/cities.ts', """// Preset cities for the Weather city option (the TV has no keyboard, so the option steps through this list). Auto = from the internet connection.
export interface City { name: string; lat: number; lon: number; }

export const CITIES: City[] = [
	{name: 'Mumbai', lat: 19.08, lon: 72.88}, {name: 'Delhi', lat: 28.61, lon: 77.21}, {name: 'Bengaluru', lat: 12.97, lon: 77.59},
	{name: 'Hyderabad', lat: 17.39, lon: 78.49}, {name: 'Chennai', lat: 13.08, lon: 80.27}, {name: 'Kolkata', lat: 22.57, lon: 88.36},
	{name: 'Ahmedabad', lat: 23.02, lon: 72.57}, {name: 'Surat', lat: 21.17, lon: 72.83}, {name: 'Pune', lat: 18.52, lon: 73.86},
	{name: 'Jaipur', lat: 26.91, lon: 75.79}, {name: 'Dubai', lat: 25.2, lon: 55.27}, {name: 'Singapore', lat: 1.35, lon: 103.82},
	{name: 'London', lat: 51.51, lon: -0.13}, {name: 'Zurich', lat: 47.38, lon: 8.54}, {name: 'Berlin', lat: 52.52, lon: 13.4},
	{name: 'New York', lat: 40.71, lon: -74.01}, {name: 'San Francisco', lat: 37.77, lon: -122.42}, {name: 'Sydney', lat: -33.87, lon: 151.21}
];
""")

write('src/lib/weather.ts', """// Temperature for the time-pill menu. The place is the chosen city, or (Auto) found from the internet connection with ipwho.is
// (no key); the weather comes from open-meteo.com (no key). Cached 30 minutes per place; any failure just shows nothing.

import type {City} from '../config/cities';

export interface Weather {
	temp: number;
	label: string;
	place: string;
}

const MAX_AGE_MS = 30 * 60 * 1000;

function describe (code: number): string {
	if (code === 0) return 'Clear';
	if (code <= 2) return 'Partly cloudy';
	if (code === 3) return 'Cloudy';
	if (code === 45 || code === 48) return 'Fog';
	if (code >= 51 && code <= 67) return 'Rain';
	if (code >= 71 && code <= 77) return 'Snow';
	if (code >= 80 && code <= 82) return 'Showers';
	if (code >= 95) return 'Storm';
	return '';
}

export function readWeather (city: City | null): Promise<Weather> {
	const key = 'launcher-weather-v2-' + (city ? city.name : 'auto');
	try {
		const cached = JSON.parse(localStorage.getItem(key) || 'null') as {t: number; w: Weather} | null;
		if (cached && Date.now() - cached.t < MAX_AGE_MS) return Promise.resolve(cached.w);
	} catch { /* fetch fresh */ }
	const where: Promise<{lat: number; lon: number; place: string}> = city
		? Promise.resolve({lat: city.lat, lon: city.lon, place: city.name})
		: fetch('https://ipwho.is/')
			.then((r) => r.json() as Promise<{success?: boolean; latitude?: number; longitude?: number; city?: string}>)
			.then((p) => {
				if (!p.success || typeof p.latitude !== 'number' || typeof p.longitude !== 'number') throw new Error('no location');
				return {lat: p.latitude, lon: p.longitude, place: p.city || ''};
			});
	return where
		.then((p) => fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&current=temperature_2m,weather_code&timezone=auto`)
			.then((r) => r.json() as Promise<{current?: {temperature_2m?: number; weather_code?: number}}>)
			.then((d) => {
				const c = d.current;
				if (!c || typeof c.temperature_2m !== 'number') throw new Error('no weather');
				const w: Weather = {temp: Math.round(c.temperature_2m), label: describe(c.weather_code || 0), place: p.place};
				try { localStorage.setItem(key, JSON.stringify({t: Date.now(), w})); } catch { /* ignore */ }
				return w;
			}));
}
""")

# tvOS: the home screen shows only small status icons; no text
write('src/components/Status.tsx', """import {useEffect, useState} from 'preact/hooks';
import {Glyph} from './Glyph';
import {readStatus, type TvStatus} from '../lib/status';

/** Small status icons left of the top buttons (network, mute, sleep timer), plain with no glass, like tvOS. Not focusable. */
export function Status () {
	const [status, setStatus] = useState<TvStatus>({network: 'unknown', muted: false, sleep: false});

	useEffect(() => {
		const load = () => { readStatus().then(setStatus).catch(() => undefined); };
		const tick = () => { if (!document.hidden) load(); };
		load();
		const id = window.setInterval(tick, 30000);
		document.addEventListener('visibilitychange', tick);
		return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', tick); };
	}, []);

	return (
		<div class="pill status">
			{status.network === 'wifi' && <Glyph name="wifi" />}
			{status.network === 'ethernet' && <Glyph name="ethernet" />}
			{status.network === 'offline' && <span class="status__off">Offline</span>}
			{status.muted && <Glyph name="muted" />}
			{status.sleep && <Glyph name="timer" />}
		</div>
	);
}
""")

sub('src/lib/storage.ts', [
 ("	showWeather: boolean;\n", "	showWeather: boolean;\n	/** weather place: '' = from the internet connection, else a name from config/cities.ts */\n	weatherCity: string;\n"),
 ("	showWeather: true,\n", "	showWeather: true,\n	weatherCity: '',\n"),
 ("			showWeather: parsed.showWeather !== false,\n", "			showWeather: parsed.showWeather !== false,\n			weatherCity: typeof parsed.weatherCity === 'string' ? parsed.weatherCity : '',\n"),
])

sub('src/screens/Home.tsx', [
 ("	/** date and weather in the status pill */\n	showWeather?: boolean;\n}", "	/** the weather line shown under the date at the top of the time-pill menu */\n	weatherText?: string;\n}\n\nconst dateText = () => new Date().toLocaleDateString(undefined, {weekday: 'long', day: 'numeric', month: 'long'});"),
 ("onEdit, folders, showWeather}: Props)", "onEdit, folders, weatherText}: Props)"),
 ("			<div class=\"topbar\">\n				<Status showWeather={showWeather} />\n", "			<Status />\n			<div class=\"topbar\">\n"),
 ("					<div class=\"panel panel--menu\">\n", "					<div class=\"panel panel--menu\">\n						<div class=\"menu__head\">{dateText()}{weatherText && <span>{weatherText}</span>}</div>\n"),
])

sub('src/app.tsx', [
 ("import {QuickControls} from './components/QuickControls';", "import {QuickControls} from './components/QuickControls';\nimport {CITIES} from './config/cities';\nimport {readWeather} from './lib/weather';"),
 ("weather: 'show-weather',", "weather: 'show-weather', city: 'weather-city',"),
 ("	// a new wallpaper every N minutes", """	// the weather line in the time-pill menu
	const [weatherText, setWeatherText] = useState('');
	useEffect(() => {
		if (!config.showWeather) { setWeatherText(''); return; }
		const city = CITIES.filter((c) => c.name === config.weatherCity)[0] || null;
		const load = () => readWeather(city)
			.then((w) => setWeatherText(`${w.place ? w.place + ' \\u00b7 ' : ''}${w.temp}\\u00b0 ${w.label}`.trim()))
			.catch(() => setWeatherText(''));
		load();
		const id = window.setInterval(load, 30 * 60000);
		return () => window.clearInterval(id);
	}, [config.showWeather, config.weatherCity]);

	// a new wallpaper every N minutes"""),
 ("			label: 'Date and weather',\n			description: 'Show today\\'s date and the local temperature beside the clock. Your area is found from your internet connection (ipwho.is) and the weather comes from open-meteo.com.',",
  "			label: 'Date and weather',\n			description: 'Show today\\'s date and the temperature at the top of the time-pill menu. The weather comes from open-meteo.com.',"),
 ("		{\n			id: OPTION.idle,", "		{\n			id: OPTION.city,\n			label: 'Weather city',\n			description: 'Auto finds your area from your internet connection (ipwho.is). OK steps through a list of cities if Auto guesses wrong.',\n			value: config.weatherCity !== '',\n			valueText: config.weatherCity || 'Auto'\n		},\n		{\n			id: OPTION.idle,"),
 ("config.showAllApps, config.showWeather]);", "config.showAllApps, config.showWeather, config.weatherCity]);"),
 ("		else if (optionId === OPTION.nightDim)", "		else if (optionId === OPTION.city) {\n			const names = [''].concat(CITIES.map((c) => c.name));\n			updateConfig({...config, weatherCity: names[(names.indexOf(config.weatherCity) + 1) % names.length]});\n		}\n		else if (optionId === OPTION.nightDim)"),
 ("folders={folderMap} showWeather={config.showWeather} />", "folders={folderMap} weatherText={weatherText} />"),
])

css = open(P('src/theme/global.css')).read()
css += """
/* ---------- tvOS status: bare icons; date and weather as the menu header ---------- */
.menu__head { padding: 6px 24px 14px; margin-bottom: 8px; font-size: 24px; color: var(--color-text-primary); opacity: 0.9; display: flex; flex-direction: column; border-bottom: 1px solid rgba(255, 255, 255, 0.18); }
.menu__head span { margin-top: 4px; font-size: 21px; opacity: 0.8; }
.pill.status { padding: 0 8px 0 0; }
.screen > .pill.status { position: absolute; top: 64px; left: var(--layout-edge-padding); height: 58px; margin: 0; z-index: 5; }
.screen > .pill.status svg { margin: 0 14px 0 0; }
"""
open(P('src/theme/global.css'), 'w').write(css)
print('status tvos applied')
