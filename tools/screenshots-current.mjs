// Screenshots of the build as it is now: home, home with the glass bar focused, Down once, Down twice. For checking the layout before a change.
// Needs the dev server (in app/: npx vite --port 5199). Usage: node tools/screenshots-current.mjs [outdir]
// CHROME defaults to the Chromium a cloud session has in /opt/pw-browsers; set it (or BASE) in the environment or the repo-root .env.
import {spawn} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {setTimeout as sleep} from 'node:timers/promises';
try { process.loadEnvFile(new URL('../.env', import.meta.url)); } catch { /* no .env */ }
const BASE = process.env.BASE || 'http://127.0.0.1:5199/';
const OUT = (process.argv[2] || '/tmp/lumen-current') + '/';
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 9337;
mkdirSync(OUT, {recursive: true});
// --no-sandbox: cloud sessions run as root, where Chromium refuses to start with its sandbox
const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${PORT}`, '--window-size=1920,1080', '--force-device-scale-factor=1', '--user-data-dir=/tmp/lumen-current-profile', 'about:blank'], {stdio: 'ignore'});
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
const press = async (name, wait = 400) => { const c = KEYS[name]; await evalJs(`window.dispatchEvent(new KeyboardEvent('keydown',{keyCode:${c},which:${c},bubbles:true})); window.dispatchEvent(new KeyboardEvent('keyup',{keyCode:${c},which:${c},bubbles:true}));`); await sleep(wait); };
const open = async (config, wait = 6000) => {
	await send('Page.navigate', {url: BASE}); await sleep(1200);
	await evalJs(`localStorage.clear(); localStorage.setItem('launcher-config-v2', ${JSON.stringify(JSON.stringify(config))});`);
	await send('Page.navigate', {url: BASE}); await sleep(wait);
};
const shot = async (name) => { const r = await send('Page.captureScreenshot', {format: 'jpeg', quality: 85}); writeFileSync(OUT + name + '.jpg', Buffer.from(r.data, 'base64')); console.log('saved', OUT + name + '.jpg'); };

await open({weatherCity: 'London', weatherCountry: 'GB', wallpaper: 'local:0'}); await shot('1-home');
await press('right', 700); await shot('2-dock-focus');
await press('down', 1500); await shot('3-down-once');
await press('down', 1500); await shot('4-down-twice');
ws.close(); chrome.kill();
