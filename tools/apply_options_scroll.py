#!/usr/bin/env python3
"""Thirteenth patch layer: the Options list scrolls (it was longer than the screen, so the options below the fold, such as AM/PM, were out of reach);
the AM/PM option works again with the one-row date and time, and is on by default."""
import os
APP = os.path.expanduser('~/Developer/webos-launcher-tvos/app')
def P(p): return os.path.join(APP, p)
def sub(p, pairs):
    s = open(P(p)).read()
    for a, b in pairs:
        assert a in s, (p, a[:80])
        s = s.replace(a, b, 1)
    open(P(p), 'w').write(s)

open(P('src/components/OptionList.tsx'), 'w').write("""import {useEffect, useRef} from 'preact/hooks';

export interface OptionItem {
	id: string;
	label: string;
	description: string;
	value: boolean;
	/** shown instead of the switch (options that pick from a list) */
	valueText?: string;
}

interface Props {
	options: OptionItem[];
	focused: boolean;
	selected: number;
	onSelect: (index: number) => void;
	onActivate: (index: number) => void;
}

/** Vertical list of options in a fixed-height window that scrolls to keep the selected one in view (the list is longer than the screen). */
export function OptionList ({options, focused, selected, onSelect, onActivate}: Props) {
	const view = useRef<HTMLDivElement>(null);
	const track = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const v = view.current;
		const t = track.current;
		if (!v || !t) return;
		const el = t.children[selected] as HTMLElement | undefined;
		if (!el) return;
		const offset = Math.max(0, Math.min(el.offsetTop - (v.clientHeight - el.offsetHeight) / 2, t.scrollHeight - v.clientHeight));
		t.style.transform = `translateY(${-offset}px)`;
	}, [selected, options.length]);

	return (
		<div class="options" ref={view}>
			<div class="options__track" ref={track}>
				{options.map((o, i) => (
					<div
						key={o.id}
						class={`option${focused && i === selected ? ' option--focused' : ''}`}
						onMouseEnter={() => onSelect(i)}
						onClick={() => onActivate(i)}
					>
						<div class="option__text">
							<div class="option__label">{o.label}</div>
							<div class="option__description">{o.description}</div>
						</div>
						{o.valueText !== undefined
							? <div class="option__value">{o.valueText}</div>
							: <div class={`switch${o.value ? ' switch--on' : ''}`} role="switch" aria-checked={o.value}>
								<div class="switch__knob" />
							</div>}
					</div>
				))}
			</div>
		</div>
	);
}
""")
sub('src/components/Status.tsx', [
 ("export function Status ({weatherText}: {weatherText?: string; showPeriod?: boolean}) {", "export function Status ({weatherText, showPeriod}: {weatherText?: string; showPeriod?: boolean}) {"),
 ("<Clock showPeriod />", "<Clock showPeriod={showPeriod} />"),
])
sub('src/lib/storage.ts', [
 ("	showAmPm: false,\n", "	showAmPm: true,\n"),
 ("showAmPm: parsed.showAmPm === true", "showAmPm: parsed.showAmPm !== false"),
])
a = open(P('src/app.tsx')).read()
a = a.replace('the temperature at the top of the time-pill menu.', 'the temperature at the top left of the home screen.')
open(P('src/app.tsx'), 'w').write(a.replace("12-hour clock. Off by default.'", "12-hour clock.'"))
css = open(P('src/theme/global.css')).read()
css += """
/* ---------- scrolling options list ---------- */
.options { height: 660px; overflow: hidden; position: relative; padding-top: 0; }
.options__track { transition: transform var(--motion-scroll-ms) cubic-bezier(0.2, 0.7, 0.2, 1); will-change: transform; padding-top: 8px; }
"""
css += """
.options { -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 36px, #000 calc(100% - 36px), transparent 100%); mask-image: linear-gradient(to bottom, transparent 0, #000 36px, #000 calc(100% - 36px), transparent 100%); }
.options__track { padding: 36px 0 36px; }
"""
open(P('src/theme/global.css'), 'w').write(css)
print('options scroll applied')
