import {useEffect, useState} from 'preact/hooks';
import {onMinute} from '../lib/minute';

/** Current time, re-rendered at the start of each minute (lib/minute.ts), which is all the UI shows. */
export function useClock (): Date {
	const [now, setNow] = useState(() => new Date());
	useEffect(() => onMinute(() => setNow(new Date())), []);
	return now;
}
