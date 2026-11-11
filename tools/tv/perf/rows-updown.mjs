// Down and Up between two of the home screen's lower rows (from row FROM, default 2: Resume, to the one under it), many pairs after one
// relaunch, with a trace: updown.mjs's twin for the rows. usage: node rows-updown.mjs <out.json> [pairs] ; env LIVECSS, LIVEJS, CATS, GAPMS, FROM, LMAP
import {writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const PORT = 19998;
const PAIRS = +(process.argv[3] || 8);
const GAPMS = +(process.env.GAPMS || 1300);
const relaunch = () => execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'LogLevel=ERROR', process.env.LUMEN_TV_HOST || 'root@192.0.2.10', `luna-send -n 1 luna://com.webos.applicationManager/launch '{"id":"com.samrenfrew.lumen"}'`]);
const LIVECSS = process.env.LIVECSS || '';
const LIVEJS = process.env.LIVEJS || '';
const NORELAUNCH = !!process.env.NORELAUNCH;
if (!NORELAUNCH) { relaunch(); await new Promise((ok) => setTimeout(ok, 5000)); }
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
const KEYS = {up: [38, 'ArrowUp'], down: [40, 'ArrowDown']};
const key = async (k) => { const [code, name] = KEYS[k]; for (const type of ['rawKeyDown', 'keyUp']) await send('Input.dispatchKeyEvent', {type, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, key: name, code: name}); };
const stamp = (name) => ev(`(console.timeStamp(${JSON.stringify(name)}), 1)`);

if (LIVECSS) await ev(`(() => { let s = document.getElementById('live'); if (!s) { s = document.createElement('style'); s.id = 'live'; document.head.appendChild(s); } s.textContent = ${JSON.stringify(LIVECSS)}; return 1; })()`);
if (LIVEJS) console.log('livejs:', await ev(LIVEJS));
if ((await ev('document.visibilityState')) !== 'visible') { console.log('Lumen is not in front; stopping'); process.exit(1); }
await key('up'); // engage focus
await sleep(1000);
// start on the dock: a tile focused, not lower
for (let n = 0; n < 3 && !(await ev(`!!document.querySelector('.tile--focused') && !document.querySelector('.screen--lower')`)); n++) {
	await key(await ev(`!!document.querySelector('.screen--lower')`) ? 'up' : 'down');
	await sleep(1000);
}
if (!(await ev(`!!document.querySelector('.tile--focused') && !document.querySelector('.screen--lower')`))) { console.log('could not reach the dock; stopping'); process.exit(1); }
// down to the row the pairs start from (the dock's row is 0)
const FROM = +(process.env.FROM || 2);
for (let n = 0; n < FROM; n++) { await key('down'); await sleep(1200); }
const rowOf = `(() => { const r = document.querySelector('.row--focused'); return r ? [...r.parentElement.children].filter((x) => x.classList.contains('row')).indexOf(r) : -1; })()`;
const start = await ev(rowOf);
console.log('starting on row', start, await ev(`(document.querySelector('.row--focused .row__label')||{}).textContent`));
if (process.env.LMAP) { await send('DOM.getDocument', {depth: -1}); await send('LayerTree.enable'); }
const cats = ['devtools.timeline', 'viz', 'gpu', 'benchmark', 'toplevel', ...(process.env.CATS ? process.env.CATS.split(',') : [])];
await send('Tracing.start', {traceConfig: {includedCategories: cats, recordMode: 'recordAsMuchAsPossible'}, transferMode: 'ReportEvents'});
await sleep(600);
let ok = true;
for (let i = 0; i < PAIRS; i++) {
	for (const d of ['down', 'up']) {
		await stamp(`k:${i}:${d}`);
		await key(d);
		await sleep(GAPMS);
		const at = await ev(rowOf);
		if (at !== (d === 'down' ? start + 1 : start)) { ok = false; console.log(`state check failed at ${i} ${d}: row ${at}`); }
	}
}
await stamp('k:end');
await sleep(200);
const fin = new Promise((ok2) => { done = ok2; });
await send('Tracing.end');
await fin;
const lmap = {};
for (const [id, l] of seenLayers) {
	let s = '(no node)';
	if (l.backendNodeId) { const r = await send('DOM.describeNode', {backendNodeId: l.backendNodeId}); const n = r.result?.node; if (!n) s = `(node ${l.backendNodeId}: ${r.error?.message})`; if (n) { const a = n.attributes || []; s = n.pseudoType ? `::${n.pseudoType}` : `${n.localName}${a.includes('class') ? '.' + a[a.indexOf('class') + 1].split(' ').slice(0, 3).join('.') : ''}`; } }
	lmap[id] = `${s} ${Math.round(l.width)}x${Math.round(l.height)} @${Math.round(l.offsetX)},${Math.round(l.offsetY)}${l.drawsContent ? '' : ' (no content)'}`;
}
if (LIVECSS) await ev(`(document.getElementById('live').textContent = '', 1)`);
writeFileSync(process.argv[2], JSON.stringify({events, ok, LIVECSS, LIVEJS, lmap}));
console.log('events', events.length, ok ? 'state ok' : 'STATE MISMATCH');
ws.close();
