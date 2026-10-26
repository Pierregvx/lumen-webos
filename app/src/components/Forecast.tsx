import {useEffect, useState} from 'preact/hooks';
import {WeatherIcon} from './WeatherIcon';
import {timeParts} from '../lib/clock';
import {useFontsReady} from '../hooks/useFontsReady';
import {useTimeFormat} from '../hooks/useTimeFormat';
import {onMinute} from '../lib/minute';
import {getClockMode, t as tr} from '../lib/i18n';
import {hoursAhead, type Hour, type Weather} from '../lib/weather';

/** a chance of rain at or above this counts as "rain" in the large widget's note */
const RAIN_LIKELY = 50;

/** "15:00", or "3 PM" on a 12-hour clock */
function hourText (h: Hour, format: '12h' | '24h'): string {
	const d = new Date(2000, 0, 1, Number(h.t.slice(11, 13)), 0);
	const {time, period} = timeParts(d, format);
	return period ? `${time.split(':')[0]} ${period}` : time;
}

/** The weather widget: plain text over the picture, no glass, so it does not compete with the dock.
 *  small: the next 6 hours, each an icon, the temperature, the time and a slim bar filled by the chance of rain.
 *  large: now on the left (icon, temperature, conditions, today's high and low, when rain starts), the next 7 hours on the right (8 put its left edge on the middle of a side-by-side photo pair) with a bar for the chance of rain.
 *  Not focusable. Draws nothing until there is a forecast. */
export function Forecast ({weather, size}: {weather: Weather; size: 'small' | 'large'}) {
	const [, bump] = useState(0);
	const shown = useFontsReady();
	const tvFormat = useTimeFormat();
	const mode = getClockMode();
	const format = mode === '12h' || mode === '24h' ? mode : tvFormat;

	// a new hour drops off the front as the time passes, between readings
	useEffect(() => onMinute(() => bump((n) => n + 1)), []);

	const hours = hoursAhead(weather, size === 'small' ? 6 : 7);
	if (!hours.length) return null;

	if (size === 'small') {
		return (
			<div class={`forecast forecast--small${shown ? '' : ' forecast--wait'}`}>
				{hours.map((h) => (
					<div key={h.t} class="forecast__hour">
						<WeatherIcon kind={h.kind} day={h.day} class="forecast__icon" />
						<span class="forecast__temp">{h.temp}°</span>
						<span class="forecast__time">{hourText(h, format)}</span>
						<span class={`forecast__pill${h.rain >= RAIN_LIKELY ? ' forecast__pill--wet' : ''}`}><i style={{width: h.rain + '%'}} /></span>
					</div>
				))}
			</div>
		);
	}

	const wet = hours.filter((h) => h.rain >= RAIN_LIKELY)[0];
	return (
		<div class={`forecast forecast--large${shown ? '' : ' forecast--wait'}`}>
			<div class="forecast__now">
				<div class="forecast__big">
					<WeatherIcon kind={weather.kind} day={weather.day} class="forecast__bigicon" />
					<span>{weather.temp}°</span>
				</div>
				{weather.label && <div class="forecast__cond">{tr(weather.label)}</div>}
				{weather.high !== undefined && weather.low !== undefined && <div class="forecast__meta">{tr('High')} {weather.high}°&ensp;{tr('Low')} {weather.low}°</div>}
				{wet && <div class="forecast__note">{tr('Rain from')} {hourText(wet, format)}</div>}
			</div>
			<div class="forecast__hours">
				<div class="forecast__row">
					{hours.map((h) => (
						<div key={h.t} class="forecast__hour">
							<span class="forecast__time">{hourText(h, format)}</span>
							<WeatherIcon kind={h.kind} day={h.day} class="forecast__icon" />
							<span class="forecast__temp">{h.temp}°</span>
						</div>
					))}
				</div>
				<div class="forecast__bars">
					{hours.map((h) => (
						<div key={h.t} class={`forecast__bar${h.rain >= RAIN_LIKELY ? ' forecast__bar--wet' : ''}${h.rain < 30 ? ' forecast__bar--dry' : ''}`}>
							{h.rain >= 20 && <span>{h.rain}%</span>}
							<i style={{height: Math.max(3, Math.round(h.rain * 0.26)) + 'px'}} />
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
