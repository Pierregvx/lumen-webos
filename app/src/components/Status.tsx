import type {ComponentChildren} from 'preact';
import {useEffect, useState} from 'preact/hooks';
import {Clock} from './Clock';
import {langLocale, t as tr} from '../lib/i18n';
import {useFontsReady} from '../hooks/useFontsReady';
import {onMinute} from '../lib/minute';
import {WeatherIcon} from './WeatherIcon';
import type {Weather} from '../lib/weather';

const dateText = () => (() => { try { return new Date().toLocaleDateString(langLocale(), {weekday: 'long', month: 'long', day: 'numeric'}).replace(',', ''); } catch { return new Date().toDateString(); } })();

/** Top-left, plain with no glass: a large clock, then the date and the weather on one line under it. Not focusable.
 *  `middle` goes between the clock and the date: the screensaver's weather widget, centred between them. */
export function Status ({weather, showPeriod, middle}: {weather?: Weather | null; showPeriod?: boolean; middle?: ComponentChildren}) {
	const [, bump] = useState(0);
	const date = dateText();
	const fontsReady = useFontsReady();

	useEffect(() => onMinute(() => bump((n) => n + 1)), []);

	return (
		<div class="status">
			<Clock showPeriod={showPeriod} />
			{middle}
			<div class="status__row">
				<span class="status__date">{date}</span>
				{weather && fontsReady && (
					<span class="status__weather">
						<WeatherIcon kind={weather.kind} day={weather.day} class="status__icon" />
						<span>{weather.temp}°</span>
						{weather.label && <span class="status__cond">{tr(weather.label)}</span>}
					</span>
				)}
			</div>
		</div>
	);
}
