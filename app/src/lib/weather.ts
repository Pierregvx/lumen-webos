// Temperature and an icon under the clock at the top left. The place is the chosen city, or (Auto, only when picked in Settings) found from the internet
// connection with ipwho.is (no key); the weather comes from open-meteo.com (no key). Cached 30 minutes per place; any failure just shows nothing.

import {loggedFetch} from './log';

import type {City} from '../config/cities';

export type WeatherKind = 'clear' | 'partly' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm';

export interface Weather {
	temp: number;
	label: string;
	place: string;
	kind: WeatherKind;
	/** false between sunset and sunrise at the place: the clear and partly icons show a moon */
	day: boolean;
}

/** weatherCity for "find the place from the internet connection" ('' = no place chosen, no weather) */
export const AUTO_PLACE = '@auto';

const MAX_AGE_MS = 30 * 60 * 1000;

function kindOf (code: number): WeatherKind {
	if (code === 0) return 'clear';
	if (code <= 2) return 'partly';
	if (code === 45 || code === 48) return 'fog';
	if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
	if (code >= 95) return 'storm';
	if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
	return 'cloudy';
}

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

const keyFor = (city: City | null) => 'launcher-weather-v3-' + (city ? city.name : 'auto');

/** The last weather read for this place, however old: drawn on a cold start while readWeather asks again. */
export function peekWeather (city: City | null): Weather | null {
	try {
		const cached = JSON.parse(localStorage.getItem(keyFor(city)) || 'null') as {t: number; w: Weather} | null;
		return cached ? cached.w : null;
	} catch { return null; }
}

export function readWeather (city: City | null): Promise<Weather> {
	const key = keyFor(city);
	try {
		const cached = JSON.parse(localStorage.getItem(key) || 'null') as {t: number; w: Weather} | null;
		if (cached && Date.now() - cached.t < MAX_AGE_MS) return Promise.resolve(cached.w);
	} catch { /* fetch fresh */ }
	const where: Promise<{lat: number; lon: number; place: string}> = city
		? Promise.resolve({lat: city.lat, lon: city.lon, place: city.name})
		: loggedFetch('https://ipwho.is/')
			.then((r) => r.json() as Promise<{success?: boolean; latitude?: number; longitude?: number; city?: string}>)
			.then((p) => {
				if (!p.success || typeof p.latitude !== 'number' || typeof p.longitude !== 'number') throw new Error('no location');
				return {lat: p.latitude, lon: p.longitude, place: p.city || ''};
			});
	return where
		.then((p) => loggedFetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&current=temperature_2m,weather_code,is_day&timezone=auto`)
			.then((r) => r.json() as Promise<{current?: {temperature_2m?: number; weather_code?: number; is_day?: number}}>)
			.then((d) => {
				const c = d.current;
				if (!c || typeof c.temperature_2m !== 'number') throw new Error('no weather');
				const code = c.weather_code || 0;
				const w: Weather = {temp: Math.round(c.temperature_2m), label: describe(code), place: p.place, kind: kindOf(code), day: c.is_day !== 0};
				try { localStorage.setItem(key, JSON.stringify({t: Date.now(), w})); } catch { /* ignore */ }
				return w;
			}));
}
