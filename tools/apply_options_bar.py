#!/usr/bin/env python3
"""Fourteenth patch layer: the Options scroll container gets a slim scroll indicator beside the list (where you are, how much is left)."""
import os
APP = os.path.expanduser('~/Developer/webos-launcher-tvos/app')
def P(p): return os.path.join(APP, p)
def sub(p, pairs):
    s = open(P(p)).read()
    for a, b in pairs:
        assert a in s, (p, a[:80])
        s = s.replace(a, b, 1)
    open(P(p), 'w').write(s)

sub('src/components/OptionList.tsx', [
 ("	const track = useRef<HTMLDivElement>(null);\n", "	const track = useRef<HTMLDivElement>(null);\n	const bar = useRef<HTMLDivElement>(null);\n	const thumb = useRef<HTMLDivElement>(null);\n"),
 ("		t.style.transform = `translateY(${-offset}px)`;\n", """		t.style.transform = `translateY(${-offset}px)`;
		// scroll indicator: size and place the thumb from the visible share of the list
		const b = bar.current;
		const th = thumb.current;
		if (!b || !th) return;
		const max = t.scrollHeight - v.clientHeight;
		b.style.visibility = max > 4 ? 'visible' : 'hidden';
		const h = Math.max(48, (v.clientHeight / t.scrollHeight) * b.clientHeight);
		th.style.height = `${h}px`;
		th.style.transform = `translateY(${max > 0 ? (offset / max) * (b.clientHeight - h) : 0}px)`;
"""),
 ("	return (\n		<div class=\"options\" ref={view}>", "	return (\n		<div class=\"options-wrap\">\n			<div class=\"options__bar\" ref={bar}><div class=\"options__thumb\" ref={thumb} /></div>\n		<div class=\"options\" ref={view}>"),
 ("			</div>\n		</div>\n	);\n}", "			</div>\n		</div>\n		</div>\n	);\n}"),
])
css = open(P('src/theme/global.css')).read()
css += """
/* ---------- scroll indicator beside the options list ---------- */
.options-wrap { position: relative; width: 1100px; margin: 0 auto; }
.options__bar { position: absolute; right: -34px; top: 40px; bottom: 40px; width: 6px; border-radius: 3px; background: rgba(255, 255, 255, 0.18); }
.options__thumb { position: absolute; left: 0; right: 0; top: 0; border-radius: 3px; background: rgba(255, 255, 255, 0.75); transition: transform var(--motion-scroll-ms) cubic-bezier(0.2, 0.7, 0.2, 1); }
.options-wrap .options { height: 660px; }
.options__bar { height: 580px; bottom: auto; }
"""
css += """
/* ---------- options list: use the full height, shorter fades ---------- */
.options-wrap .options { height: 800px; -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 22px, #000 calc(100% - 22px), transparent 100%); mask-image: linear-gradient(to bottom, transparent 0, #000 22px, #000 calc(100% - 22px), transparent 100%); }
.options__track { padding: 22px 0 22px; }
.options__bar { top: 26px; height: 740px; }
"""
css += """
/* ---------- scroll windows: room at the sides so the focus ring and shadow are never clipped ---------- */
.options-wrap .options { width: 1128px; margin-left: -14px; padding: 0 14px; box-sizing: border-box; }
.grid__viewport { padding: 16px 24px; margin: 0 -24px; }
.wp__viewport { padding: 20px 16px 0; margin: -20px -16px 0; }
"""
css += """.wp__viewport, .grid__viewport { -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 18px, #000 calc(100% - 26px), transparent 100%); mask-image: linear-gradient(to bottom, transparent 0, #000 18px, #000 calc(100% - 26px), transparent 100%); }
"""
open(P('src/theme/global.css'), 'w').write(css)
print('options bar applied')
