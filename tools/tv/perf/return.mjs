// Traces Lumen's return from another app: from rest (dock) or from row 2, then Home (applicationManager/launch, as the Home remap does).
// usage: node return.mjs <out.json> <dock|row2> [runs]   env: TARGET (app id, default Moonlight), AWAY (ms in the app, default 8000), LIVEJS, SHOTS=1 (screencast frames to <out>-shots/)
// It opens an app on screen, so ask Sam first. Report: node return-report.mjs <out.json> [...]
import {writeFileSync, mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const [OUT, SCENARIO = 'row2', RUNS = '3'] = process.argv.slice(2);
const TARGET = process.env.TARGET || 'com.limelight.webos';
const AWAY = +(process.env.AWAY || 8000);
const ssh = (cmd) => execFileSync('ssh', ['-tt', '-o', 'BatchMode=yes', '-o', 'LogLevel=ERROR', 'root@192.168.0.20', cmd]).toString();
const launch = (id) => ssh(`luna-send -n 1 luna://com.webos.applicationManager/launch '{"id":"${id}"}'`);
const front = () => (ssh(`luna-send -n 1 luna://com.webos.applicationManager/getForegroundAppInfo '{}'`).match(/"appId":"([^"]*)"/) || [])[1];
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

const page = (await fetch('http://127.0.0.1:19998/json').then((r) => r.json())).find((p) => /lumen/i.test(p.url));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((ok) => { ws.onopen = ok; });
let seq = 0; const waiting = new Map(); let events = []; let done; let shots = [];
ws.onmessage = (m) => {
	const msg = JSON.parse(m.data);
	if (msg.method === 'Tracing.dataCollected') events.push(...msg.params.value);
	else if (msg.method === 'Tracing.tracingComplete') done();
	else if (msg.method === 'Page.screencastFrame') { shots.push({t: msg.params.metadata.timestamp, data: msg.params.data}); send('Page.screencastFrameAck', {sessionId: msg.params.sessionId}); }
	else if (waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); }
};
const send = (method, params = {}) => new Promise((ok) => { const id = ++seq; waiting.set(id, ok); ws.send(JSON.stringify({id, method, params})); });
const ev = async (expression) => (await send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true})).result?.result?.value;
const KEYS = {left: [37, 'ArrowLeft'], up: [38, 'ArrowUp'], down: [40, 'ArrowDown'], enter: [13, 'Enter']};
const key = async (k) => { const [code, name] = KEYS[k]; for (const type of ['rawKeyDown', 'keyUp']) await send('Input.dispatchKeyEvent', {type, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, key: name, code: name}); await sleep(600); };

// per frame for 7 s after the return: its time and what changed on screen (html classes, screen classes, the focused tile)
const INSTRUMENT = `(() => {
	window.__ret = {vis: [], f: [], sig: []};
	if (!window.__retOn) {
		window.__retOn = true;
		document.addEventListener('visibilitychange', () => {
			const r = window.__ret; const t0 = performance.now(); r.vis.push([document.visibilityState, t0]);
			if (document.hidden) return;
			console.timeStamp('ret:visible');
			let last = '';
			const tick = (t) => {
				const sc = document.querySelector('.screen'); const ft = document.querySelector('.tile--focused');
				const s = document.documentElement.className + ' | ' + (sc ? sc.className : '') + ' | ' + (ft ? ft.textContent : '-');
				r.f.push(t - t0); if (s !== last) { r.sig.push([t - t0, s]); last = s; }
				if (t - t0 < 7000) requestAnimationFrame(tick);
			};
			requestAnimationFrame(tick);
		}, true);
	}
	return 1;
})()`;

const runs = [];
for (let n = 0; n < +RUNS; n++) {
	launch('com.samrenfrew.lumen'); await sleep(5000);
	if (process.env.LIVEJS) await ev(process.env.LIVEJS);
	await ev(INSTRUMENT);
	if (SCENARIO === 'row2') {
		// a launch while Lumen is in front keeps its focus, so first walk back to the first row's tiles
		for (let i = 0; i < 6; i++) {
			const s = await ev(`document.querySelector('.screen').className.includes('screen--lower') ? 'lower' : document.querySelector('.rows > .row:first-child .tile--focused') ? 'row1' : document.querySelector('.pill--focused') ? 'top' : 'rest'`);
			if (s === 'row1') break;
			await key(s === 'top' ? 'down' : 'up');
		}
		await key('down');
		for (let i = 0; i < 8 && (await ev(`(document.querySelector('.tile--focused')||{}).textContent`)) !== 'Moonlight'; i++) await key('left');
		const at = await ev(`JSON.stringify([document.querySelector('.screen').className, (document.querySelector('.tile--focused')||{}).textContent])`);
		if (!/screen--lower/.test(at) || !/Moonlight/.test(at)) { console.log('focus not on Moonlight in row 2:', at); break; }
		await key('enter');
	} else launch(TARGET);
	for (let i = 0; i < 40 && front() !== TARGET; i++) await sleep(250);
	await sleep(AWAY);
	const hidden = await ev(`JSON.stringify({vis: document.visibilityState, html: document.documentElement.className, screen: document.querySelector('.screen').className})`);
	events = []; shots = [];
	await send('Tracing.start', {traceConfig: {includedCategories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'viz', 'gpu', 'cc', 'toplevel', 'blink'], recordMode: 'recordAsMuchAsPossible'}, transferMode: 'ReportEvents'});
	if (process.env.SHOTS) await send('Page.startScreencast', {format: 'jpeg', quality: 50, maxWidth: 640, maxHeight: 360, everyNthFrame: 1});
	await sleep(400);
	const tHome = Date.now() / 1000;
	launch('com.samrenfrew.lumen');
	await sleep(7500);
	if (process.env.SHOTS) await send('Page.stopScreencast');
	const fin = new Promise((ok) => { done = ok; }); await send('Tracing.end'); await fin;
	const page = JSON.parse(await ev('JSON.stringify(window.__ret)'));
	if (process.env.SHOTS) {
		const dir = `${OUT.replace(/\.json$/, '')}-shots/run${n}`; mkdirSync(dir, {recursive: true});
		for (const s of shots) writeFileSync(`${dir}/${String(Math.round((s.t - tHome) * 1000)).padStart(5, '0')}.jpg`, Buffer.from(s.data, 'base64'));
	}
	runs.push({hidden: JSON.parse(hidden), page, events});
	console.log(`run ${n}: hidden as ${JSON.parse(hidden).screen}; ${page.f.length} frames, ${events.length} trace events${process.env.SHOTS ? `, ${shots.length} shots` : ''}`);
}
writeFileSync(OUT, JSON.stringify({scenario: SCENARIO, target: TARGET, away: AWAY, livejs: process.env.LIVEJS || '', runs}));
ws.close();
