#!/usr/bin/env python3
"""Eighth patch layer (after apply_status_topleft.py): the network icon moves from the home screen into Quick Controls (the control centre);
the top-left keeps only the date and weather."""
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

const dateText = () => new Date().toLocaleDateString(undefined, {weekday: 'long', day: 'numeric', month: 'long'});

/** Top-left, plain with no glass, like tvOS: the date, then the weather. Not focusable. */
export function Status ({weatherText}: {weatherText?: string}) {
	const [date, setDate] = useState(dateText);

	useEffect(() => {
		const tick = () => { if (!document.hidden) setDate(dateText()); };
		const id = window.setInterval(tick, 30000);
		document.addEventListener('visibilitychange', tick);
		return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', tick); };
	}, []);

	return (
		<div class="pill status">
			<div class="status__lines">
				<div class="status__date">{date}</div>
				{weatherText && <div class="status__weather">{weatherText}</div>}
			</div>
		</div>
	);
}
""")

sub('src/components/QuickControls.tsx', [
 ("import {useKeys, clamp, type NavKey} from '../hooks/useKeys';", "import {useKeys, clamp, type NavKey} from '../hooks/useKeys';\nimport {Glyph} from './Glyph';\nimport {readStatus, type TvStatus} from '../lib/status';"),
 ("	useEffect(() => { readControls().then(setValues); }, []);", "	const [net, setNet] = useState<TvStatus['network']>('unknown');\n	useEffect(() => { readControls().then(setValues); readStatus().then((s) => setNet(s.network)).catch(() => undefined); }, []);"),
 ("				<div class=\"panel__title\">Quick Controls</div>\n", "				<div class=\"panel__title\">Quick Controls</div>\n				{net !== 'unknown' && (\n					<div class=\"qc__net\">\n						{net === 'wifi' && <Glyph name=\"wifi\" />}\n						{net === 'ethernet' && <Glyph name=\"ethernet\" />}\n						<span>{net === 'wifi' ? 'Connected over Wi-Fi' : net === 'ethernet' ? 'Connected by cable' : 'Offline'}</span>\n					</div>\n				)}\n"),
])
css = open(P('src/theme/global.css')).read()
css += """
/* ---------- network line in Quick Controls ---------- */
.qc__net { display: flex; flex-direction: row; align-items: center; margin: -6px 0 12px 14px; font-size: 22px; opacity: 0.8; }
.qc__net svg { position: static; width: 26px; height: 26px; margin-right: 10px; flex: 0 0 auto; }
"""
open(P('src/theme/global.css'), 'w').write(css)
print('status cc applied')
