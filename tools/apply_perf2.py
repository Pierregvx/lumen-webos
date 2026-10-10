#!/usr/bin/env python3
"""Twenty-fifth patch layer: smoother dock, from what the research says about low-end TV Chromium:
 - A scaled (focus) tile with border-radius + overflow:hidden makes Chromium build a mask layer / render surface for it every frame (Chromium issue tracker:
   rounded corners drawn by mask layers are a common source of animation jank on weak GPUs). The radius now sits on the picture itself, so the tile needs no clip.
 - Held remote keys repeat 15-30 times a second: repeats closer than 90 ms are dropped, so the screen does not queue up work.
 - Tile pictures decode off the main thread (decoding="async")."""
import os
APP = os.path.expanduser('~/Developer/webos-launcher-tvos/app')
def P(p): return os.path.join(APP, p)
def sub(p, pairs):
    s = open(P(p)).read()
    for a, b in pairs:
        assert a in s, (p, a[:80])
        s = s.replace(a, b, 1)
    open(P(p), 'w').write(s)

sub('src/hooks/useKeys.ts', [
 ("		const onKeyDown = (e: KeyboardEvent) => {\n			const key = CODE_TO_KEY[e.keyCode];\n			if (!key) return;",
  "		let lastAt = 0;\n		const onKeyDown = (e: KeyboardEvent) => {\n			const key = CODE_TO_KEY[e.keyCode];\n			if (!key) return;\n			// a held key repeats 15-30 times a second: skip repeats that come faster than the screen can use\n			const now = Date.now();\n			if (e.repeat && now - lastAt < 90) { e.preventDefault(); return; }\n			lastAt = now;"),
])
s = open(P('src/components/Tile.tsx')).read()
s = s.replace('<img class="tile__image tile__image--glyph" src={model.glyphImageUrl} alt="" />', '<img class="tile__image tile__image--glyph" src={model.glyphImageUrl} alt="" decoding="async" />')
s = s.replace("<img class={model.plain ? 'tile__image tile__image--icon' : 'tile__image'} src={model.imageUrl} alt=\"\" />", "<img class={model.plain ? 'tile__image tile__image--icon' : 'tile__image'} src={model.imageUrl} alt=\"\" decoding=\"async\" />")
assert 'decoding="async"' in s
open(P('src/components/Tile.tsx'), 'w').write(s)

css = open(P('src/theme/global.css')).read()
css += """
/* ---------- smoother dock: no clip on the tile that scales; the rounded corners are on what is drawn ---------- */
.tile__box { overflow: visible; }
.tile__image { border-radius: inherit; }
.tile__image--icon { border-radius: 16%; }
.tile__monogram { border-radius: inherit; }
.row:not(.row--dock) .tile--focused .tile__box::after { border-radius: inherit; }
.tile__folder { border-radius: inherit; }
"""
open(P('src/theme/global.css'), 'w').write(css)
print('perf2 applied')
