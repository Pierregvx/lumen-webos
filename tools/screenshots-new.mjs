// Screenshots of the newer features for the README / posts (aerial view, dark dock over video, Light look, Video picker, Control Center Appearance).
// Needs the dev server (port 5199). For the pictures with a still wallpaper, put a public-domain picture in app/public/wallpapers/default-0.jpg first.
// Usage: node tools/screenshots-new.mjs [outdir]
import {spawn} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {setTimeout as sleep} from 'node:timers/promises';
// CHROME (and BASE, OUT) can be set in the environment or in the repo-root .env
try { process.loadEnvFile(new URL('../.env', import.meta.url)); } catch { /* no .env */ }
const BASE = process.env.BASE || 'http://localhost:5199/';
const OUT = process.argv[2] || new URL('../docs/screenshots/', import.meta.url).pathname;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9336;
mkdirSync(OUT, {recursive: true});
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required', `--remote-debugging-port=${PORT}`, '--window-size=1920,1080', '--force-device-scale-factor=1', '--user-data-dir=/tmp/lumen-shots2-profile', 'about:blank'], {stdio: 'ignore'});
await sleep(2500);
const target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result || {}); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({id: i, method, params})); });
const evalJs = (expression) => send('Runtime.evaluate', {expression, awaitPromise: true});
await send('Emulation.setDeviceMetricsOverride', {width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false});
const KEYS = {left: 37, up: 38, right: 39, down: 40, enter: 13};
const press = async (name, wait = 250) => { const c = KEYS[name]; await evalJs(`window.dispatchEvent(new KeyboardEvent('keydown',{keyCode:${c},which:${c},bubbles:true})); window.dispatchEvent(new KeyboardEvent('keyup',{keyCode:${c},which:${c},bubbles:true}));`); await sleep(wait); };
const open = async (path, config, wait = 7000) => {
	await send('Page.navigate', {url: BASE}); await sleep(1200);
	await evalJs(`localStorage.clear(); localStorage.setItem('launcher-config-v2', ${JSON.stringify(JSON.stringify(config))});`);
	await send('Page.navigate', {url: BASE + path}); await sleep(wait);
};
const shot = async (name) => { const r = await send('Page.captureScreenshot', {format: 'jpeg', quality: 90}); writeFileSync(OUT + name + '.jpg', Buffer.from(r.data, 'base64')); console.log('saved', name); };
const video = {weatherCity: 'Zurich', weatherCountry: 'CH', videoWallpaper: true, videoPlaces: ['Switzerland'], darkMode: 'on'};
const still = {weatherCity: 'London', weatherCountry: 'GB', wallpaper: 'local:0'};

await open('', video, 14000); await press('right', 500); await shot('dock-over-video');
await press('down', 500); await press('down', 3000); await shot('aerial-view');
await open('', {...still, darkMode: 'off'}); await press('right'); await press('right', 700); await shot('light-home');
await open('', {...still, darkMode: 'on'}); await press('right'); await press('right', 700); await shot('dark-home');
await open('?settings&tab=2', {...still, darkMode: 'on'}); await press('down', 500); await press('right', 300); await press('right', 900); await shot('video-picker');
await open('', {...still, darkMode: 'off'}); await press('up'); await press('up'); await press('right'); await press('enter', 900); await press('down', 500); await shot('control-center-light');
ws.close(); chrome.kill();
