// Records a short demo of the launcher from the dev server (port 5199): drives the remote keys, grabs frames with headless Chrome over the DevTools
// protocol, and encodes docs/demo/lumen-demo.mp4 and lumen-demo.gif with ffmpeg-static.   Usage: node tools/record-demo.mjs   (Node 22+)
import {spawn, spawnSync} from 'node:child_process';
import {mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {setTimeout as sleep} from 'node:timers/promises';

const BASE = process.env.BASE || 'http://localhost:5199/';
const OUT = new URL('../docs/demo/', import.meta.url).pathname;
const FF = new URL('./node_modules/ffmpeg-static/ffmpeg', import.meta.url).pathname;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FRAMES = '/tmp/lumen-demo-frames/';
const PORT = 9335;
rmSync(FRAMES, {recursive: true, force: true}); mkdirSync(FRAMES, {recursive: true}); mkdirSync(OUT, {recursive: true});

const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${PORT}`, '--window-size=1280,720', '--force-device-scale-factor=1', '--user-data-dir=/tmp/lumen-demo-profile', 'about:blank'], {stdio: 'ignore'});
await sleep(2500);
const target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result || {}); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({id: i, method, params})); });
const evalJs = (expression) => send('Runtime.evaluate', {expression, awaitPromise: true});
await send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 720, deviceScaleFactor: 1, mobile: false});

// load the launcher with a clean config
await send('Page.navigate', {url: BASE}); await sleep(1200);
await evalJs(`localStorage.clear(); localStorage.setItem('launcher-config-v2', ${JSON.stringify(JSON.stringify({weatherCity: 'London', wallpaper: 'local:0'}))});`);
await send('Page.navigate', {url: BASE}); await sleep(3500);

// Smooth capture: the page's clock is paused and advanced one frame (1/30 s) at a time, a screenshot is taken after each step, and the key presses
// happen at exact times. So the animations play at a true 30 fps, whatever the speed of this computer.
const FPS = 30;
const STEP = 1000 / FPS;
const KEYS = {left: 37, up: 38, right: 39, down: 40, enter: 13, back: 8};
// the script: [seconds, key]
const SCRIPT = [[1.2, 'right'], [2.1, 'right'], [2.75, 'right'], [3.4, 'right'], [4.3, 'left'], [5.2, 'down'], [6.6, 'right'], [7.3, 'right'], [8.4, 'up'], [9.2, 'up'], [10.0, 'right'], [10.8, 'enter'],
	[12.3, 'down'], [13.0, 'right'], [13.7, 'down'], [14.4, 'down'], [15.3, 'back']];
const END = 16.8;
await send('Emulation.setVirtualTimePolicy', {policy: 'pause'});
const expiries = [];
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.method === 'Emulation.virtualTimeBudgetExpired') { const r = expiries.shift(); if (r) r(); } });
const advance = () => new Promise((res) => { expiries.push(res); send('Emulation.setVirtualTimePolicy', {policy: 'advance', budget: STEP}); });
const frames = [];
let next = 0;
for (let n = 0; n * STEP <= END * 1000; n++) {
	const t = n * STEP / 1000;
	while (next < SCRIPT.length && SCRIPT[next][0] <= t) {
		const c = KEYS[SCRIPT[next][1]];
		await evalJs(`window.dispatchEvent(new KeyboardEvent('keydown',{keyCode:${c},which:${c},bubbles:true})); window.dispatchEvent(new KeyboardEvent('keyup',{keyCode:${c},which:${c},bubbles:true}));`);
		next++;
	}
	await advance();
	const r = await send('Page.captureScreenshot', {format: 'jpeg', quality: 82});
	const name = `f${String(n).padStart(5, '0')}.jpg`;
	writeFileSync(FRAMES + name, Buffer.from(r.data, 'base64'));
	frames.push({name, t: n * STEP});
}
ws.close(); chrome.kill();

// frames have uneven timing: encode with their real durations
const lines = [];
frames.forEach((f) => { lines.push(`file '${FRAMES}${f.name}'`); lines.push(`duration ${(STEP / 1000).toFixed(5)}`); });
lines.push(`file '${FRAMES}${frames[frames.length - 1].name}'`);
writeFileSync(FRAMES + 'list.txt', lines.join('\n'));
const run = (args) => { const r = spawnSync(FF, ['-hide_banner', '-loglevel', 'error', '-y', ...args], {stdio: 'inherit'}); if (r.status !== 0) throw new Error('ffmpeg failed'); };
run(['-f', 'concat', '-safe', '0', '-i', FRAMES + 'list.txt', '-vf', 'scale=1280:720:flags=lanczos,format=yuv420p', '-r', '30', '-c:v', 'libx264', '-crf', '23', '-preset', 'medium', '-movflags', '+faststart', OUT + 'lumen-demo.mp4']);
run(['-f', 'concat', '-safe', '0', '-i', FRAMES + 'list.txt', '-vf', 'fps=12,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4', OUT + 'lumen-demo.gif']);
console.log(`${frames.length} frames recorded`);
