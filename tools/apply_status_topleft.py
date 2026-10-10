#!/usr/bin/env python3
"""Seventh patch layer (after apply_status_tvos.py): the date and the weather sit top-left as two plain lines beside the status icons
(not in the time-pill menu any more)."""
import os
APP = os.path.expanduser('~/Developer/webos-launcher-tvos/app')
def P(p): return os.path.join(APP, p)
def sub(p, pairs):
    s = open(P(p)).read()
    for a, b in pairs:
        assert a in s, (p, a[:80])
        s = s.replace(a, b, 1)
    open(P(p), 'w').write(s)

open(P('src/components/Status.tsx'), 'w').write("""import {useEffect, useState} from 'preact/hooks';
import {Glyph} from './Glyph';
import {readStatus, type TvStatus} from '../lib/status';

const dateText = () => new Date().toLocaleDateString(undefined, {weekday: 'long', day: 'numeric', month: 'long'});

/** Top-left, plain with no glass, like tvOS: small status icons (network, mute, sleep timer) and two lines of text: the date, then the weather. Not focusable. */
export function Status ({weatherText}: {weatherText?: string}) {
	const [status, setStatus] = useState<TvStatus>({network: 'unknown', muted: false, sleep: false});
	const [date, setDate] = useState(dateText);

	useEffect(() => {
		const load = () => { setDate(dateText()); readStatus().then(setStatus).catch(() => undefined); };
		const tick = () => { if (!document.hidden) load(); };
		load();
		const id = window.setInterval(tick, 30000);
		document.addEventListener('visibilitychange', tick);
		return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', tick); };
	}, []);

	return (
		<div class="pill status">
			<div class="status__icons">
				{status.network === 'wifi' && <Glyph name="wifi" />}
				{status.network === 'ethernet' && <Glyph name="ethernet" />}
				{status.network === 'offline' && <span class="status__off">Offline</span>}
				{status.muted && <Glyph name="muted" />}
				{status.sleep && <Glyph name="timer" />}
			</div>
			<div class="status__lines">
				<div class="status__date">{date}</div>
				{weatherText && <div class="status__weather">{weatherText}</div>}
			</div>
		</div>
	);
}
""")

sub('src/screens/Home.tsx', [
 ("			<Status />\n", "			<Status weatherText={weatherText} />\n"),
 ("						<div class=\"menu__head\">{dateText()}{weatherText && <span>{weatherText}</span>}</div>\n", ""),
 ("\nconst dateText = () => new Date().toLocaleDateString(undefined, {weekday: 'long', day: 'numeric', month: 'long'});", ""),
])

css = open(P('src/theme/global.css')).read()
css += """
/* ---------- top-left status: icons, then date over weather ---------- */
.screen > .pill.status { height: auto; min-height: 58px; align-items: center; }
.status__icons { display: flex; flex-direction: row; align-items: center; }
.status__lines { display: flex; flex-direction: column; justify-content: center; margin-left: 4px; }
.status__date { font-size: 26px; font-weight: 600; line-height: 1.2; opacity: 0.95; white-space: nowrap; }
.status__weather { font-size: 21px; line-height: 1.25; opacity: 0.78; white-space: nowrap; }
.status__icons:empty { display: none; }
"""
open(P('src/theme/global.css'), 'w').write(css)
print('status top-left applied')
