// Walk the Guide with a trace: Now and Next down and up, up to the switch, into the Full guide, down and up, then back to Now and Next. usage: node guide.mjs <out.json> [rows] ; env LIVECSS, LIVEJS, GAPMS. The Guide must be open.
import {writeFileSync} from 'node:fs';
const PORT = 19998;
const ROWS = +(process.argv[3] || 6);
const GAPMS = +(process.env.GAPMS || 900);
const LIVECSS = process.env.LIVECSS || '';
const LIVEJS = process.env.LIVEJS || '';
const pages = await fetch(`http://127.0.0.1:${PORT}/json`).then((r) => r.json());
const page = pages.find((p) => /lumen/i.test(p.url));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; });
let seq = 0; const waiting = new Map(); const events = []; let done; const seenLayers = new Map();
ws.onmessage = (m) => {
	const msg = JSON.parse(m.data);
	if (msg.method === 'LayerTree.layerTreeDidChange' && msg.params.layers) { for (const l of msg.params.layers) if (!seenLayers.has(l.layerId)) seenLayers.set(l.layerId, l); }
	else if (msg.method === 'Tracing.dataCollected') events.push(...msg.params.value);
	else if (msg.method === 'Tracing.tracingComplete') done();
	else if (waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); }
};
const send = (method, params = {}) => new Promise((ok) => { const id = ++seq; waiting.set(id, ok); ws.send(JSON.stringify({id, method, params})); });
const ev = async (expression) => (await send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true})).result?.result?.value;
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
const KEYS = {up: [38, 'ArrowUp'], down: [40, 'ArrowDown'], left: [37, 'ArrowLeft'], right: [39, 'ArrowRight']};
const key = async (k) => { const [code, name] = KEYS[k]; for (const type of ['rawKeyDown', 'keyUp']) await send('Input.dispatchKeyEvent', {type, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, key: name, code: name}); };
const stamp = (name) => ev(`(console.timeStamp(${JSON.stringify(name)}), 1)`);
const state = () => ev(`JSON.stringify({open: !!document.querySelector('.screen--guide'), full: !!document.querySelector('.screen--guide-full'), sw: !!document.querySelector('.guide__switch--focused')})`).then(JSON.parse);

if (LIVECSS) await ev(`(() => { let s = document.getElementById('live'); if (!s) { s = document.createElement('style'); s.id = 'live'; document.head.appendChild(s); } s.textContent = ${JSON.stringify(LIVECSS)}; return 1; })()`);
if (LIVEJS) console.log('livejs:', await ev(LIVEJS));
let s = await state();
if (!s.open) { console.log('the Guide is not open; stopping'); process.exit(1); }
// start on Now and Next, first row: up to the switch, left, down
for (let n = 0; n < 12 && !s.sw; n++) { await key('up'); await sleep(250); s = await state(); }
if (s.full) { await key('left'); await sleep(800); }
await key('down'); await sleep(1000);
s = await state();
if (s.full || s.sw) { console.log('could not reach Now and Next; stopping', s); process.exit(1); }

const plan = [
	...Array(ROWS).fill(['nn', 'down']), ...Array(ROWS).fill(['nn', 'up']),
	['sw', 'up'], ['mode', 'right'], ['sw', 'down'],
	...Array(ROWS).fill(['fg', 'down']), ...Array(ROWS).fill(['fg', 'up']),
	['sw', 'up'], ['mode', 'left'], ['sw', 'down'],
];
if (process.env.LMAP) { await send('DOM.getDocument', {depth: -1}); await send('LayerTree.enable'); }
await send('Tracing.start', {traceConfig: {includedCategories: ['devtools.timeline', 'viz', 'gpu', 'benchmark', 'toplevel', ...(process.env.CATS ? process.env.CATS.split(',') : [])], recordMode: 'recordAsMuchAsPossible'}, transferMode: 'ReportEvents'});
await sleep(600);
for (const [i, [grp, d]] of plan.entries()) {
	await stamp(`k:${i}:${grp}-${d}`);
	await key(d);
	await sleep(grp === 'mode' ? 1500 : GAPMS);
}
await stamp('k:end');
await sleep(200);
const fin = new Promise((ok) => { done = ok; });
await send('Tracing.end');
await fin;
const lmap = {};
for (const [id, l] of seenLayers) {
	let s = '(no node)';
	if (l.backendNodeId) { const r = await send('DOM.describeNode', {backendNodeId: l.backendNodeId}); const n = r.result?.node; if (!n) s = `(node ${l.backendNodeId}: ${r.error?.message})`; if (n) { const a = n.attributes || []; s = n.pseudoType ? `::${n.pseudoType}` : `${n.localName}${a.includes('class') ? '.' + a[a.indexOf('class') + 1].split(' ').slice(0, 3).join('.') : ''}`; } }
	lmap[id] = `${s} ${Math.round(l.width)}x${Math.round(l.height)} @${Math.round(l.offsetX)},${Math.round(l.offsetY)}${l.drawsContent ? '' : ' (no content)'}`;
}
s = await state();
const ok = !s.full && !s.sw;
if (LIVECSS) await ev(`(document.getElementById('live').textContent = '', 1)`);
writeFileSync(process.argv[2], JSON.stringify({events, ok, LIVECSS, LIVEJS, lmap}));
console.log('events', events.length, ok ? 'back at start' : 'NOT BACK AT START');
ws.close();
