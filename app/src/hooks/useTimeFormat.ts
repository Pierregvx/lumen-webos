import {useEffect, useState} from 'preact/hooks';
import type {TimeFormat} from '../lib/clock';
import {cachedTimeFormat, getTimeFormat} from '../lib/timeFormat';
import {afterFirstFrame} from '../lib/boot';

/** The TV's 12/24-hour setting: the last one seen at once, then read again after the first frame and whenever the app comes to the
 *  foreground (the user may have changed it in LG's settings meanwhile). */
export function useTimeFormat (): TimeFormat {
	const [format, setFormat] = useState<TimeFormat>(cachedTimeFormat);
	useEffect(() => {
		const refresh = () => { if (!document.hidden) getTimeFormat().then(setFormat); };
		const cancel = afterFirstFrame(refresh);
		document.addEventListener('visibilitychange', refresh);
		return () => { cancel(); document.removeEventListener('visibilitychange', refresh); };
	}, []);
	return format;
}
