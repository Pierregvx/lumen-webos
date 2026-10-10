#!/usr/bin/env python3
"""Eleventh patch layer: top-left date and time on one row like the macOS menu bar ("Sun Oct 4  9:06 PM"), the weather as a small line below."""
import os
APP = os.path.expanduser('~/Developer/webos-launcher-tvos/app')
def P(p): return os.path.join(APP, p)
open(P('src/components/Status.tsx'), 'w').write("""import {useEffect, useState} from 'preact/hooks';
import {Clock} from './Clock';

const dateText = () => new Date().toLocaleDateString('en-US', {weekday: 'short', month: 'short', day: 'numeric'}).replace(',', '');

/** Top-left, plain with no glass: one row "Sun Oct 4  9:06 PM" like the macOS menu bar, the weather in a small line below. Not focusable. */
export function Status ({weatherText}: {weatherText?: string; showPeriod?: boolean}) {
	const [date, setDate] = useState(dateText);

	useEffect(() => {
		const tick = () => { if (!document.hidden) setDate(dateText()); };
		const id = window.setInterval(tick, 30000);
		document.addEventListener('visibilitychange', tick);
		return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', tick); };
	}, []);

	return (
		<div class="pill status">
			<div class="status__row">
				<span class="status__date">{date}</span>
				<Clock showPeriod />
			</div>
			{weatherText && <div class="status__weather">{weatherText}</div>}
		</div>
	);
}
""")
css = open(P('src/theme/global.css')).read()
css += """
/* ---------- date and time on one row ---------- */
.screen > .pill.status { flex-direction: column; align-items: flex-start; justify-content: center; }
.status__row { display: flex; flex-direction: row; align-items: baseline; }
.status__row .status__date { font-size: 30px; font-weight: 500; margin-right: 16px; opacity: 1; }
.screen > .pill.status .clock { margin: 0; }
.screen > .pill.status .clock__time { font-size: 30px; font-weight: 500; }
.screen > .pill.status .clock__period { font-size: 30px; font-weight: 500; margin-left: 8px; letter-spacing: 0; }
.status__weather { margin-top: 4px; }
"""
open(P('src/theme/global.css'), 'w').write(css)
print('stamp applied')
