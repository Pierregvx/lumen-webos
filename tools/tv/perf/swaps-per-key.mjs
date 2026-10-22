// Per key press: GPU swaps in the 320 ms after it (a 60 fps move would give about 19), from the trace alone. usage: node swapkey.mjs file seg
import {readFileSync} from 'node:fs';
const [file, seg, win = '320'] = process.argv.slice(2);
const W = +win * 1000;
const {events} = JSON.parse(readFileSync(file, 'utf8'));
const st = {}; for (const e of events) if (e.name === 'TimeStamp' && e.args?.data?.message) st[e.args.data.message] = e.ts;
const a = st[`start:${seg}`], b = st[`end:${seg}`];
const swaps = events.filter((e) => e.name === 'Display::DrawAndSwap' && e.ph === 'X').map((e) => e.ts).sort((x, y) => x - y);
const keys = events.filter((e) => e.name === 'EventDispatch' && e.args?.data?.type === 'keydown' && e.ts >= a && e.ts <= b).sort((x, y) => x.ts - y.ts);
const out = keys.map((k) => { const s = swaps.filter((t) => t >= k.ts && t < k.ts + W); const g = s.slice(1).map((t, i) => (t - s[i]) / 1000); return {n: s.length, first: s.length ? ((s[0] - k.ts) / 1000).toFixed(0) : '-', gap: g.length ? (g.reduce((x, y) => x + y, 0) / g.length).toFixed(0) : '-'}; });
console.log(out.map((o) => `${o.n}/${o.first}/${o.gap}`).join('  '));
const moving = out.filter((o) => o.n > 2);
console.log(`moving keys ${moving.length}: mean swaps ${(moving.reduce((x, o) => x + o.n, 0) / moving.length).toFixed(1)} in ${win}ms, mean gap ${(moving.reduce((x, o) => x + +o.gap, 0) / moving.length).toFixed(1)}ms, first frame after key ${(moving.reduce((x, o) => x + +o.first, 0) / moving.length).toFixed(0)}ms`);
