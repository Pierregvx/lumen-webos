import {useEffect} from 'preact/hooks';
import {isDark} from '../lib/i18n';
import {onMinute} from '../lib/minute';
import type {UserConfig} from '../lib/storage';

/** The classes on <html> that follow a setting, for the stylesheet (theme/themes.css and the rest) to read. Night dimming and dark mode
 *  depend on the time too, so they are checked again each minute. */
export function useHtmlClasses (config: UserConfig): void {
	const root = document.documentElement.classList;

	// night: a dimmer wallpaper, always or between 19:00 and 06:00
	useEffect(() => {
		const apply = () => { const h = new Date().getHours(); root.toggle('night', config.wallpaperDim === 'always' || (config.wallpaperDim === 'night' && (h >= 19 || h < 6))); };
		apply();
		const stop = onMinute(apply);
		return () => { stop(); root.remove('night'); };
	}, [config.wallpaperDim]);
	useEffect(() => {
		const apply = () => { const dark = isDark(config.darkMode); root.toggle('dark', dark); root.toggle('light', !dark); };
		apply();
		return onMinute(apply);
	}, [config.darkMode]);
	useEffect(() => { root.toggle('reduce-motion', config.reduceMotion); }, [config.reduceMotion]);
	useEffect(() => { root.toggle('hide-names', config.hideNames); }, [config.hideNames]);
	useEffect(() => { root.toggle('hide-recents', !config.showRecents); }, [config.showRecents]);
	// the glass is always live blur (index.html sets the class first)
	useEffect(() => { root.toggle('dockblur', config.dockBlur); }, [config.dockBlur]);
	useEffect(() => {
		root.toggle('focus-subtle', config.focusStrength === 'subtle');
		root.toggle('focus-strong', config.focusStrength === 'strong');
	}, [config.focusStrength]);
}
