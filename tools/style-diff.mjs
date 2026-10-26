// Compares two style-snapshot.mjs files and lists every element whose computed style or box changed. Class names are reported apart, since a rename changes them on purpose.
// Usage: node tools/style-diff.mjs <before.json[,more.json]> <after.json[,more.json]> [max lines]
import {readFileSync} from 'node:fs';

const [A, B, MAX = '400'] = process.argv.slice(2);
// each side may be several shard files, joined with commas
const load = (list) => Object.assign({}, ...list.split(',').map((f) => JSON.parse(readFileSync(f, 'utf8'))));
const a = load(A), b = load(B);
// Chrome writes a gradient's first and last stops with or without 0% and 100%, depending on whether it came through a custom property
// a shadow whose colours are all fully transparent is no shadow; 0px 0px is 0% 0%
const norm = (v) => {
	if (typeof v !== 'string') return v;
	if (/^rgba\([^)]*, 0\)( [-\d.]+px)+( inset)?(, rgba\([^)]*, 0\)( [-\d.]+px)+( inset)?)*$/.test(v)) return 'none';
	if (v === '0px 0px') return '0% 0%';
	return v.replace(/(\)|\d) 0%(?=, )/g, '$1').replace(/(\)|\d) 100%(?=\))/g, '$1');
};
// a box with no fill, image, border, shadow or clip paints nothing of its own
const invisible = (st) => /rgba\(0, 0, 0, 0\)|transparent/.test(st['background-color']) && st['background-image'] === 'none' && norm(st['box-shadow']) === 'none'
	&& ['top', 'right', 'bottom', 'left'].every((side) => st[`border-${side}-width`] === '0px' || st[`border-${side}-style`] === 'none') && st['overflow-x'] === 'visible' && st['overflow-y'] === 'visible';
let lines = 0, styleDiffs = 0, classDiffs = 0;
const say = (s) => { if (lines++ < Number(MAX)) console.log(s); };
for (const scene of Object.keys(a)) {
	if (!b[scene]) { say(`${scene}: missing in after`); continue; }
	const ea = a[scene].elements, eb = b[scene].elements;
	const full = (side, el) => { const o = Object.assign({}, side.common, el.style); for (const p in o) if (o[p] === null) delete o[p]; return o; };
	for (const path of new Set([...Object.keys(ea), ...Object.keys(eb)])) {
		const x = ea[path], y = eb[path];
		const sx = x && full(a[scene], x), sy = y && full(b[scene], y);
		// nothing is drawn for an element (or ::before, ::after) that is display: none, so it only counts if the other side draws it
		const hidden = (st) => !st || st.display === 'none';
		if (hidden(sx) && hidden(sy)) continue;
		if (!x || !y) { styleDiffs++; say(`${scene} ${path} (${(x || y).cls}): only in ${x ? 'before' : 'after'}`); continue; }
		if (x.cls !== y.cls) classDiffs++;
		if (x.box !== y.box) { styleDiffs++; say(`${scene} ${path} (${x.cls}): box ${x.box} -> ${y.box}`); }
		// offsets do nothing on a static element
		const offsets = sx.position === 'static' && sy.position === 'static' ? ['top', 'right', 'bottom', 'left', 'inset-block-start', 'inset-block-end', 'inset-inline-start', 'inset-inline-end'] : [];
		const unpainted = invisible(sx) && invisible(sy);
		const noImage = sx['background-image'] === 'none' && sy['background-image'] === 'none';
		for (const p of new Set([...Object.keys(sx), ...Object.keys(sy)])) {
			// a corner radius on a box that paints nothing, or how a background image would sit when there is none, draws nothing
			if (unpainted && /radius$/.test(p)) continue;
			if (noImage && /^background-(position|repeat|size|attachment|origin)/.test(p)) continue;
			// custom properties are the tokens themselves: renaming one is not a change anyone sees
			if (p.indexOf('--') === 0 || offsets.indexOf(p) >= 0) continue;
			if (norm(sx[p]) !== norm(sy[p])) { styleDiffs++; say(`${scene} ${path} (${x.cls}): ${p}: ${sx[p]} -> ${sy[p]}`); }
		}
	}
}
console.log(`\n${Object.keys(a).length} scenes, ${styleDiffs} style or box differences, ${classDiffs} elements with renamed classes`);
process.exit(styleDiffs ? 1 : 0);
