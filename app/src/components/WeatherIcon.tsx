import type {WeatherKind} from '../lib/weather';

/** Line icons in the same style as Glyph: 24-unit box, stroked, no fill. */
const SUN = 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4';
const MOON = 'M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z';
const CLOUD = 'M7 18.5h10.5a3.5 3.5 0 0 0 .4-7 5.5 5.5 0 0 0-10.6-1.2A4.2 4.2 0 0 0 7 18.5z';
const ICONS: Record<WeatherKind, string> = {
	clear: SUN,
	partly: 'M9 3v1.4M3.6 8.8H5M4.9 4.7l1 1M13.1 4.7l-1 1M6.4 10.4a3 3 0 0 1 5.3-3.2M9 19h8.5a3 3 0 0 0 .3-6 4.6 4.6 0 0 0-8.9-1A3.5 3.5 0 0 0 9 19z',
	cloudy: CLOUD,
	fog: 'M4 8.5h16M3 12.5h18M5 16.5h14M8 20.5h8',
	rain: 'M7 14.5h10.5a3.5 3.5 0 0 0 .4-7 5.5 5.5 0 0 0-10.6-1.2A4.2 4.2 0 0 0 7 14.5zM8.5 17.5l-1 2.5M12.5 17.5l-1 2.5M16.5 17.5l-1 2.5',
	snow: 'M7 14.5h10.5a3.5 3.5 0 0 0 .4-7 5.5 5.5 0 0 0-10.6-1.2A4.2 4.2 0 0 0 7 14.5zM8 18.5h.01M12 18.5h.01M16 18.5h.01M10 21h.01M14 21h.01',
	storm: 'M7 14.5h10.5a3.5 3.5 0 0 0 .4-7 5.5 5.5 0 0 0-10.6-1.2A4.2 4.2 0 0 0 7 14.5zM12.5 15.5l-2 3.5h3l-2 3.5'
};
const PARTLY_NIGHT = 'M11.2 4.6a3.8 3.8 0 0 0 4.4 5.2 3.8 3.8 0 0 1-5.3 1.9M9 19h8.5a3 3 0 0 0 .3-6 4.6 4.6 0 0 0-8.9-1A3.5 3.5 0 0 0 9 19z';

/** the moon for clear and partly cloudy hours after dark */
export function WeatherIcon ({kind, day, class: cls}: {kind: WeatherKind; day: boolean; class: string}) {
	const d = day ? ICONS[kind] : kind === 'clear' ? MOON : kind === 'partly' ? PARTLY_NIGHT : ICONS[kind];
	return <svg class={cls} viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;
}
