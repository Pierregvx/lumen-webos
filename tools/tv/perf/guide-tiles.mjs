// Raster tiles per layer per Guide step. Capture with LMAP=1 CATS=cc,disabled-by-default-cc.debug node guide.mjs. usage: node guide-tiles.mjs trace.json
import {readFileSync} from 'node:fs';
const {events, lmap} = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const map = lmap || {};
const st = events.filter((e) => e.name === 'TimeStamp' && e.args?.data?.message?.startsWith('k:')).map((e) => [e.args.data.message, e.ts]).sort((a, b) => a[1] - b[1]);
const ph = (ts) => { let p = 'pre'; for (const [n, t] of st) if (ts >= t) p = n.split(':').pop(); return p; };
const nk = {}; for (const [n] of st) { const d = n.split(':').pop(); nk[d] = (nk[d] || 0) + 1; }
const agg = {};
for (const e of events) { if (e.name !== 'RasterTask' || !e.args?.tileData) continue; const k = `${ph(e.ts)}|${e.args.tileData.layerId}`; agg[k] = agg[k] || {n: 0, ms: 0}; agg[k].n++; agg[k].ms += (e.dur || 0) / 1000; }
for (const d of [...Object.keys(nk), 'pre']) {
	const rows = Object.entries(agg).filter(([k]) => k.startsWith(d + '|')).sort((a, b) => b[1].n - a[1].n);
	if (!rows.length) continue;
	console.log(`\n${d}: tiles per move (${nk[d] || 1} moves), total ${(rows.reduce((x, [, v]) => x + v.n, 0) / (nk[d] || 1)).toFixed(0)}`);
	for (const [k, v] of rows.slice(0, +(process.env.TOP || 8))) { const id = k.split('|')[1]; console.log(`  ${(v.n / (nk[d] || 1)).toFixed(1).padStart(6)}  ${map[id] || 'layer ' + id}`); }
}
