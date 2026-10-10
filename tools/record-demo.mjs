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

// grab frames in the background while the keys are pressed
const frames = [];
let recording = true;
const grab = (async () => {
	let n = 0;
	while (recording) {
		const t = Date.now();
		const r = await send('Page.captureScreenshot', {format: 'jpeg', quality: 78});
		const name = `f${String(n++).padStart(5, '0')}.jpg`;
		writeFileSync(FRAMES + name, Buffer.from(r.data, 'base64'));
		frames.push({name, t});
	}
})();

const KEYS = {left: 37, up: 38, right: 39, down: 40, enter: 13};
const press = async (name, wait = 450) => {
	const c = KEYS[name];
	await evalJs(`window.dispatchEvent(new KeyboardEvent('keydown',{keyCode:${c},which:${c},bubbles:true})); window.dispatchEvent(new KeyboardEvent('keyup',{keyCode:${c},which:${c},bubbles:true}));`);
	await sleep(wait);
};

await sleep(1200);                                    // resting home screen
await press('right', 900);                            // the focus comes up
for (let i = 0; i < 3; i++) await press('right', 650);
await press('left', 900);
await press('down', 1400);                            // the second row appears
await press('right', 700); await press('right', 700);
await press('up', 1100);                              // back to the dock
await press('up', 800); await press('right', 800);    // top bar: Control Center
await press('enter', 1500);                           // Control Center opens
await press('down', 700); await press('right', 700); await press('down', 700); await press('down', 900);
await evalJs(`window.dispatchEvent(new KeyboardEvent('keydown',{keyCode:8,which:8,bubbles:true}))`);   // Back closes it
await sleep(1500);

recording = false;
await grab;
ws.close(); chrome.kill();

// frames have uneven timing: encode with their real durations
const lines = [];
frames.forEach((f, i) => { lines.push(`file '${FRAMES}${f.name}'`); lines.push(`duration ${((frames[i + 1] ? frames[i + 1].t - f.t : 400) / 1000).toFixed(3)}`); });
lines.push(`file '${FRAMES}${frames[frames.length - 1].name}'`);
writeFileSync(FRAMES + 'list.txt', lines.join('\n'));
const run = (args) => { const r = spawnSync(FF, ['-hide_banner', '-loglevel', 'error', '-y', ...args], {stdio: 'inherit'}); if (r.status !== 0) throw new Error('ffmpeg failed'); };
run(['-f', 'concat', '-safe', '0', '-i', FRAMES + 'list.txt', '-vf', 'fps=30,scale=1280:720:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-crf', '23', '-preset', 'medium', '-movflags', '+faststart', OUT + 'lumen-demo.mp4']);
run(['-f', 'concat', '-safe', '0', '-i', FRAMES + 'list.txt', '-vf', 'fps=12,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4', OUT + 'lumen-demo.gif']);
console.log(`${frames.length} frames recorded`);
