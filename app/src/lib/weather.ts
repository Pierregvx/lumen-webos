// Temperature and an icon under the clock at the top left, and the hours ahead for the weather widget (components/Forecast.tsx). The place is the chosen city, or (Auto, only when picked in Settings) found from the internet
// connection with ipwho.is (no key); the weather comes from open-meteo.com (no key). Cached 30 minutes per place; any failure just shows nothing.

import {readCache, writeCache} from './boot';
import {loggedFetch} from './log';

import type {City} from '../config/cities';

export type WeatherKind = 'clear' | 'partly' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm';

export interface Hour {
	/** the hour at the place, as open-meteo gives it: "2026-10-24T15:00" */
	t: string;
	temp: number;
	kind: WeatherKind;
	day: boolean;
	/** chance of rain, 0 to 100 */
	rain: number;
}

export interface Weather {
	temp: number;
	label: string;
	place: string;
	kind: WeatherKind;
	/** false between sunset and sunrise at the place: the clear and partly icons show a moon */
	day: boolean;
	/** today's high and low at the place */
	high?: number;
	low?: number;
	/** the next 24 hours or so, from the hour the reading was taken */
	hours?: Hour[];
	/** the place's offset from UTC in seconds, so the hours still ahead can be picked out later, in the place's own time */
	offset?: number;
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

const keyFor = (city: City | null) => 'launcher-weather-v4-' + (city ? city.name : 'auto');

/** The last weather read for this place, however old: drawn on a cold start while readWeather asks again. */
export function peekWeather (city: City | null): Weather | null {
	const cached = readCache<{t: number; w: Weather}>(keyFor(city));
	return cached ? cached.w : null;
}

export function readWeather (city: City | null): Promise<Weather> {
	const key = keyFor(city);
	const cached = readCache<{t: number; w: Weather}>(key);
	if (cached && Date.now() - cached.t < MAX_AGE_MS) return Promise.resolve(cached.w);
	const where: Promise<{lat: number; lon: number; place: string}> = city
		? Promise.resolve({lat: city.lat, lon: city.lon, place: city.name})
		: loggedFetch('https://ipwho.is/')
			.then((r) => r.json() as Promise<{success?: boolean; latitude?: number; longitude?: number; city?: string}>)
			.then((p) => {
				if (!p.success || typeof p.latitude !== 'number' || typeof p.longitude !== 'number') throw new Error('no location');
				return {lat: p.latitude, lon: p.longitude, place: p.city || ''};
			});
	return where
		.then((p) => loggedFetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&current=temperature_2m,weather_code,is_day&hourly=temperature_2m,weather_code,is_day,precipitation_probability&daily=temperature_2m_max,temperature_2m_min&forecast_days=2&timezone=auto`)
			.then((r) => r.json() as Promise<Forecast>)
			.then((d) => {
				const c = d.current;
				if (!c || typeof c.temperature_2m !== 'number') throw new Error('no weather');
				const code = c.weather_code || 0;
				const w: Weather = {temp: Math.round(c.temperature_2m), label: describe(code), place: p.place, kind: kindOf(code), day: c.is_day !== 0, offset: d.utc_offset_seconds || 0};
				const h = d.hourly, day = d.daily;
				if (h && h.time && h.temperature_2m) {
					const from = (c.time || '').slice(0, 13);
					w.hours = h.time.map((t, i) => ({t, temp: Math.round(h.temperature_2m![i]), kind: kindOf((h.weather_code && h.weather_code[i]) || 0), day: !h.is_day || h.is_day[i] !== 0, rain: (h.precipitation_probability && h.precipitation_probability[i]) || 0}))
						.filter((x) => x.t.slice(0, 13) >= from && typeof x.temp === 'number' && !isNaN(x.temp)).slice(0, 26);
				}
				if (day && day.temperature_2m_max && day.temperature_2m_min) { w.high = Math.round(day.temperature_2m_max[0]); w.low = Math.round(day.temperature_2m_min[0]); }
				writeCache(key, {t: Date.now(), w});
				return w;
			}));
}

interface Forecast {
	utc_offset_seconds?: number;
	current?: {time?: string; temperature_2m?: number; weather_code?: number; is_day?: number};
	hourly?: {time?: string[]; temperature_2m?: number[]; weather_code?: number[]; is_day?: number[]; precipitation_probability?: number[]};
	daily?: {temperature_2m_max?: number[]; temperature_2m_min?: number[]};
}

/** the hours after the current one, in the place's own time, however old the reading: empty once it has run out */
export function hoursAhead (w: Weather, count: number): Hour[] {
	if (!w.hours) return [];
	const now = new Date(Date.now() + (w.offset || 0) * 1000).toISOString().slice(0, 13);
	return w.hours.filter((h) => h.t.slice(0, 13) > now).slice(0, count);
}
