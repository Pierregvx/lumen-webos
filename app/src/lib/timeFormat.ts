// The TV's 12/24-hour clock setting (Settings → General → Time).
// webOSSystem.timeFormat is empty on some firmware, so ask the system service instead.

import {LUNA} from '../config/constants';
import {isWebOS, lunaCall, type LunaResponse} from './luna';
import type {TimeFormat} from './clock';
import {readCache, writeCache} from './boot';

interface PreferencesResponse extends LunaResponse {
	timeFormat?: string;     // "HH12" | "HH24"
}

/** Used off-webOS and if the TV doesn't answer. */
export const DEFAULT_TIME_FORMAT: TimeFormat = '24h';

const CACHE_KEY = 'lumen-boot-timeformat-v1';

/** The format the TV gave last time, so a cold start does not draw a 24-hour clock and then switch. */
export function cachedTimeFormat (): TimeFormat {
	const saved = readCache<TimeFormat>(CACHE_KEY);
	return saved === '12h' || saved === '24h' ? saved : DEFAULT_TIME_FORMAT;
}

export function getTimeFormat (): Promise<TimeFormat> {
	if (!isWebOS()) return Promise.resolve(DEFAULT_TIME_FORMAT);
	return lunaCall<PreferencesResponse>(LUNA.preferences, {keys: ['timeFormat']})
		.then((r): TimeFormat => {
			if (r.timeFormat !== 'HH12' && r.timeFormat !== 'HH24') return DEFAULT_TIME_FORMAT;
			const format: TimeFormat = r.timeFormat === 'HH12' ? '12h' : '24h';
			writeCache(CACHE_KEY, format);
			return format;
		})
		.catch(() => DEFAULT_TIME_FORMAT);
}
