// Control Center and Inputs with a trace: a cold open (after a page reload), a second open, two lists, moves, then Inputs twice. usage: node cc.mjs <out.json> ; env LIVECSS, LIVEJS (run after the reload), WARM=1 skips the reload. Starts from home.
import {writeFileSync} from 'node:fs';
const PORT = 19998;
const LIVECSS = process.env.LIVECSS || '';
const LIVEJS = process.env.LIVEJS || '';
const page0 = async () => (await fetch(`http://127.0.0.1:${PORT}/json`).then((r) => r.json())).find((p) => /lumen/i.test(p.url));
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
let ws, seq = 0, done; const waiting = new Map(); const events = [];
const connect = async () => {
	ws = new WebSocket((await page0()).webSocketDebuggerUrl);
	await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; });
	ws.onmessage = (m) => {
		const msg = JSON.parse(m.data);
		if (msg.method === 'Tracing.dataCollected') events.push(...msg.params.value);
		else if (msg.method === 'Tracing.tracingComplete') done();
		else if (waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); }
	};
};
const send = (method, params = {}) => new Promise((ok) => { const id = ++seq; waiting.set(id, ok); ws.send(JSON.stringify({id, method, params})); });
const ev = async (expression) => (await send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true})).result?.result?.value;
const KEYS = {up: [38, 'ArrowUp'], down: [40, 'ArrowDown'], left: [37, 'ArrowLeft'], right: [39, 'ArrowRight'], enter: [13, 'Enter'], back: [461, 'GoBack']};
const key = async (k) => { const [code, name] = KEYS[k]; for (const type of ['rawKeyDown', 'keyUp']) await send('Input.dispatchKeyEvent', {type, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, key: name, code: name}); };
const stamp = (name) => ev(`(console.timeStamp(${JSON.stringify(name)}), 1)`);
const top = () => ev(`(document.querySelector('.topbar .pill--focused') || {dataset: {}}).dataset.top || ''`);

await connect();
if (!process.env.WARM) { await ev('location.reload()'); await sleep(8000); ws.close(); await connect(); }
if (LIVECSS) await ev(`(() => { let s = document.getElementById('live'); if (!s) { s = document.createElement('style'); s.id = 'live'; document.head.appendChild(s); } s.textContent = ${JSON.stringify(LIVECSS)}; return 1; })()`);
if (LIVEJS) console.log('livejs:', await ev(LIVEJS));
// to the Control Center button
for (let n = 0; n < 6 && !(await top()); n++) { await key('up'); await sleep(500); }
for (let n = 0; n < 4 && (await top()) !== 'controls'; n++) { await key('left'); await sleep(400); }
if ((await top()) !== 'controls') { console.log('could not reach the Control Center button; stopping'); process.exit(1); }

const plan = [
	['cc-open1', 'enter', 1500], ['cc-close', 'back', 1000], ['cc-open2', 'enter', 1500],
	['list-open', 'enter', 1200], ['list-move', 'down', 500], ['list-close', 'back', 1000],
	['cc-move', 'right', 600], ['list-open', 'enter', 1200], ['list-close', 'back', 1000],
	['cc-move', 'down', 600], ['cc-move', 'down', 600], ['cc-move', 'down', 600], ['cc-move', 'up', 600],
	['cc-close', 'back', 1000], ['top', 'right', 500], ['top', 'right', 500],
	['in-open1', 'enter', 1500], ['in-close', 'back', 1000], ['in-open2', 'enter', 1500], ['in-close', 'back', 1000],
	['top', 'left', 500], ['top', 'left', 500],
];
await send('Tracing.start', {traceConfig: {includedCategories: ['devtools.timeline', 'viz', 'gpu', 'benchmark', 'toplevel'], recordMode: 'recordAsMuchAsPossible'}, transferMode: 'ReportEvents'});
await sleep(600);
for (const [i, [grp, k, wait]] of plan.entries()) {
	await stamp(`k:${i}:${grp}`);
	await key(k);
	await sleep(wait);
}
await stamp('k:end');
await sleep(200);
const fin = new Promise((ok) => { done = ok; });
await send('Tracing.end');
await fin;
const ok = (await top()) === 'controls' && !(await ev(`!!document.querySelector('.panel--cc')`));
if (LIVECSS) await ev(`(document.getElementById('live').textContent = '', 1)`);
writeFileSync(process.argv[2], JSON.stringify({events, ok, LIVECSS, LIVEJS}));
console.log('events', events.length, ok ? 'back at start' : 'NOT BACK AT START');
ws.close();
