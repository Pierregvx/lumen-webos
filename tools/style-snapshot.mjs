// Records the computed style and box of every element (and its ::before and ::after) on each screen, so a CSS cleanup can be proven to change nothing.
// Build a dev-mode dist first (mock Live TV data needs DEV): in app/, npx vite build --mode development --outDir <dir>
// Usage: node tools/style-snapshot.mjs <dist dir> <out.json>    then: node tools/style-diff.mjs <before.json> <after.json>
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {readFileSync, writeFileSync, existsSync, statSync} from 'node:fs';
import {extname, join, normalize} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';

const [DIST, OUT] = process.argv.slice(2);
if (!DIST || !OUT) { console.error('usage: style-snapshot.mjs <dist> <out.json>'); process.exit(1); }
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9338), HTTP = PORT - 4041;
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;

const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2'};
const server = createServer((req, res) => {
	const path = decodeURIComponent((req.url || '/').split('?')[0]);
	const file = normalize(join(DIST, path === '/' ? 'index.html' : path));
	// anything off this machine (weather, wallpapers, logos) gets a 404, so both builds see the same network
	if (!file.startsWith(normalize(DIST)) || !existsSync(file) || !statSync(file).isFile()) { res.statusCode = 404; res.end(); return; }
	res.setHeader('content-type', TYPES[extname(file)] || 'application/octet-stream');
	res.end(readFileSync(file));
}).listen(HTTP);
const BASE = `http://127.0.0.1:${HTTP}/`;

const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${PORT}`, '--window-size=1920,1080', '--force-device-scale-factor=1', `--user-data-dir=${OUT}.profile`, 'about:blank'], {stdio: 'ignore'});
let target;
for (let i = 0; i < 40 && !target; i++) { await sleep(250); try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page'); } catch { /* not up yet */ } }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map();
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({id: i, method, params})); });
ws.addEventListener('message', (e) => {
	const m = JSON.parse(e.data);
	if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
	// only this machine: the outside world (weather, cloud wallpapers) differs from run to run
	if (m.method === 'Fetch.requestPaused') {
		const local = m.params.request.url.indexOf(BASE) === 0 || m.params.request.url.indexOf('data:') === 0;
		send(local ? 'Fetch.continueRequest' : 'Fetch.failRequest', local ? {requestId: m.params.requestId} : {requestId: m.params.requestId, errorReason: 'BlockedByClient'});
	}
});
const evalJs = async (expression) => { const m = await send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true}); if (m.result && m.result.exceptionDetails) throw new Error(JSON.stringify(m.result.exceptionDetails)); return m.result && m.result.result && m.result.result.value; };
await send('Page.enable');
await send('Fetch.enable', {patterns: [{urlPattern: '*'}]});
await send('Emulation.setDeviceMetricsOverride', {width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false});

// fixed clock and fixed random numbers, so both builds draw the same frame
const freeze = (iso) => `(() => {
	const fixed = new Date(${JSON.stringify(iso)}).getTime(); const RealDate = Date;
	class FixedDate extends RealDate { constructor (...a) { if (a.length) super(...a); else super(fixed); } static now () { return fixed; } }
	window.Date = FixedDate;
	let s = 12345; Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
})();`;

const NOW = '2026-10-26T15:20:00';
// a fixed weather reading for London (lib/weather.ts reads it as fresh), so the status line and the weather widget always draw
const hours = Array.from({length: 24}, (_, i) => ({t: `2026-10-26T${String((15 + i) % 24).padStart(2, '0')}:00`, temp: 11 + (i % 5) - 2, kind: ['clear', 'partly', 'rain', 'cloudy'][i % 4], day: i < 3, rain: [0, 10, 70, 35][i % 4]}));
const WEATHER = {t: new Date(NOW).getTime(), w: {temp: 11, label: 'Partly cloudy', place: 'London', kind: 'partly', day: true, high: 13, low: 7, hours, offset: 0}};
// a photo server that is never reached: enough for the screensaver to open
const STORAGE = {'launcher-weather-v4-London': WEATHER, 'lumen-immich-server-v1': {url: 'http://127.0.0.1:9', key: 'x'}};
let freezeId = null;
const open = async (config, {at = NOW, search = ''} = {}) => {
	if (freezeId) await send('Page.removeScriptToEvaluateOnNewDocument', {identifier: freezeId});
	freezeId = (await send('Page.addScriptToEvaluateOnNewDocument', {source: freeze(at)})).result.identifier;
	await send('Page.navigate', {url: BASE}); await sleep(800);
	await evalJs(`localStorage.clear(); localStorage.setItem('launcher-config-v2', ${JSON.stringify(JSON.stringify({seeded: true, builtinTiles: true, ...config}))}); ${Object.entries(STORAGE).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(JSON.stringify(v))});`).join(' ')} true`);
	await send('Page.navigate', {url: BASE + search}); await sleep(3500);
	await evalJs('document.fonts.ready.then(() => true)');
	await sleep(800);
};
const KEYS = {left: 37, up: 38, right: 39, down: 40, enter: 13, back: 461};
const press = async (...names) => {
	for (const name of names) {
		if (typeof name === 'number') { await sleep(name); continue; }
		if (name.indexOf('js:') === 0) { await evalJs(name.slice(3) + '; true'); await sleep(1500); continue; }
		const c = KEYS[name];
		await evalJs(`window.dispatchEvent(new KeyboardEvent('keydown',{keyCode:${c},which:${c},bubbles:true})); window.dispatchEvent(new KeyboardEvent('keyup',{keyCode:${c},which:${c},bubbles:true})); true`);
		await sleep(450);
	}
	await sleep(1200);
};

// runs in the page: every element's full computed style, keyed by its place in the tree (not its classes, which a rename changes)
const SNAP = `(() => {
	document.getAnimations().forEach((a) => { try { const t = a.effect && a.effect.getTiming(); if (t && t.iterations === Infinity) { a.pause(); a.currentTime = 0; } else a.finish(); } catch (e) {} });
	const out = {}; const seen = new Set();
	const props = (cs) => { const o = {}; for (let i = 0; i < cs.length; i++) { const p = cs[i]; o[p] = cs.getPropertyValue(p); } return o; };
	const walk = (el, path) => {
		const cs = getComputedStyle(el);
		const r = el.getBoundingClientRect();
		const box = [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 2) / 2).join(',');
		const cls = typeof el.className === 'string' ? el.className : (el.getAttribute('class') || '');
		cls.split(/\\s+/).forEach((c) => c && seen.add(c));
		out[path] = {cls, box, style: props(cs)};
		for (const pseudo of ['::before', '::after']) {
			const ps = getComputedStyle(el, pseudo);
			if (ps.content && ps.content !== 'none' && ps.content !== 'normal') out[path + pseudo] = {cls, box: '', style: props(ps)};
		}
		Array.from(el.children).forEach((c, i) => walk(c, path + '>' + c.tagName.toLowerCase() + i));
	};
	walk(document.documentElement, 'html');
	// most elements share most values: keep each property's commonest value once, and on an element only what differs from it
	const counts = {};
	for (const k in out) for (const p in out[k].style) { const c = counts[p] || (counts[p] = {}); const v = out[k].style[p]; c[v] = (c[v] || 0) + 1; }
	const common = {};
	for (const p in counts) common[p] = Object.keys(counts[p]).reduce((a, b) => (counts[p][a] >= counts[p][b] ? a : b));
	for (const k in out) { const st = out[k].style; const slim = {}; for (const p in common) if (st[p] !== common[p]) slim[p] = st[p] === undefined ? null : st[p]; out[k].style = slim; }
	return {common, elements: out, classes: Array.from(seen)};
})()`;

const GUIDE = `js:document.dispatchEvent(new CustomEvent('webOSRelaunch', {detail: {view: 'guide'}}))`;
const SETTINGS = ['right', 'up', 'right', 'enter', 1000];
const AMBIENT = `js:document.dispatchEvent(new CustomEvent('webOSRelaunch', {detail: {view: 'ambient'}}))`;
const SCENES = [];
const scene = (name, config, steps = [], opts = {}) => SCENES.push({name, config, steps, opts});

const base = {weatherCity: 'London', weatherCountry: 'GB', wallpaper: 'local:0', wallpaperType: 'pictures', videoWallpaper: false, liveTvRow: true, showWeather: true, dockHide: 'off'};
const light = {...base, darkMode: 'off'};
for (const [theme, cfg] of [['dark', base], ['light', light]]) {
	scene(`${theme}/home`, cfg);
	scene(`${theme}/home-bar-focus`, cfg, ['right']);
	scene(`${theme}/home-bar-moved`, cfg, ['right', 'right', 'right']);
	scene(`${theme}/home-down1`, cfg, ['right', 'down', 1000]);
	scene(`${theme}/home-down2`, cfg, ['right', 'down', 'down', 1000]);
	scene(`${theme}/home-down3`, cfg, ['right', 'down', 'down', 'down', 1000]);
	scene(`${theme}/home-top`, cfg, ['right', 'up']);
	scene(`${theme}/home-top-2`, cfg, ['right', 'up', 'right']);
	scene(`${theme}/home-top-3`, cfg, ['right', 'up', 'right', 'right']);
	scene(`${theme}/home-top-open`, cfg, ['right', 'up', 'enter']);
	scene(`${theme}/home-top-open-down`, cfg, ['right', 'up', 'enter', 'down']);
	scene(`${theme}/home-top-2-open`, cfg, ['right', 'up', 'right', 'enter']);
	scene(`${theme}/home-top-3-open`, cfg, ['right', 'up', 'right', 'right', 'enter', 'down']);
	scene(`${theme}/home-hold`, cfg, ['right', 'right'], {hold: true});
	scene(`${theme}/home-hold-menu`, cfg, ['right', 'right'], {hold: 2});
	scene(`${theme}/settings`, cfg, [...SETTINGS]);
	scene(`${theme}/settings-down`, cfg, [...SETTINGS, 'down', 'down']);
	for (let n = 0; n < 11; n++) scene(`${theme}/settings-page${n}`, cfg, [...SETTINGS, ...Array(n).fill('down'), 'enter', 'down']);
	scene(`${theme}/settings-wallpaper-deep`, cfg, [...SETTINGS, 'down', 'down', 'down', 'down', 'enter', 'down', 'enter', 'down', 'right']);
	scene(`${theme}/settings-apps-deep`, cfg, [...SETTINGS, 'enter', 'enter', 'down']);
	scene(`${theme}/guide`, cfg, [GUIDE]);
	scene(`${theme}/guide-down`, cfg, [GUIDE, 'down', 'down']);
	scene(`${theme}/guide-switch`, cfg, [GUIDE, 'up', 'up', 'right']);
	scene(`${theme}/fullguide`, {...cfg, guideFull: true}, [GUIDE]);
	scene(`${theme}/fullguide-move`, {...cfg, guideFull: true}, [GUIDE, 'down', 'right', 'right']);
	scene(`${theme}/fullguide-switch`, {...cfg, guideFull: true}, [GUIDE, 'up', 'up', 'up', 'right']);
	scene(`${theme}/night`, cfg, ['right'], {at: '2026-10-26T21:30:00'});
	scene(`${theme}/cc-list`, cfg, ['right', 'up', 'enter', 1500, 'enter', 1500]);
	scene(`${theme}/cc-list-down`, cfg, ['right', 'up', 'enter', 1500, 'enter', 1500, 'down']);
	scene(`${theme}/cc-slider`, cfg, ['right', 'up', 'enter', 1500, 'down', 'down', 'down']);
	scene(`${theme}/folder`, {...cfg, folders: [{name: 'Films', appIds: ['netflix', 'amazon']}]}, ['right', 'right']);
	scene(`${theme}/folder-open`, {...cfg, folders: [{name: 'Films', appIds: ['netflix', 'amazon']}]}, ['right', 'right', 'right', 'enter', 1000]);
	scene(`${theme}/folder-open-2`, {...cfg, folders: [{name: 'Films', appIds: ['netflix', 'amazon']}]}, ['right', 'right', 'right', 'enter', 1000, 'right']);
	for (const size of ['', 'small', 'large']) {
		const saver = {...cfg, ambientOn: true, ambient: 'immich:recent', saverForecast: !!size, saverForecastSize: size || 'small'};
		scene(`${theme}/saver${size ? '-' + size : ''}`, saver, [AMBIENT, 2500]);
		scene(`${theme}/saver${size ? '-' + size : ''}-12h`, {...saver, clockFormat: '12h'}, [AMBIENT, 2500]);
	}
}
for (const s of ['subtle', 'strong']) { scene(`focus-${s}/bar`, {...base, focusStrength: s}, ['right']); scene(`focus-${s}/rows`, {...base, focusStrength: s}, ['right', 'down', 1000]); scene(`focus-${s}/settings`, {...base, focusStrength: s}, [...SETTINGS, 'enter', 'down']); }
for (const n of [5, 7]) scene(`first-row-${n}`, {...base, firstRow: n}, ['right']);
scene('hide-names', {...base, hideNames: true}, ['right', 'down', 1000]);
scene('reduce-motion', {...base, reduceMotion: true}, ['right', 'down', 1000]);
scene('dock-hide-down', {...base, dockHide: 'down'}, ['right', 'down', 'down', 1000]);
scene('dock-dim', {...base, dockDim: true, dockHide: 'both'}, ['right', 'down', 'down', 1000]);
scene('dockblur-off', {...base, dockBlur: false}, ['right']);
scene('liquid-dock', {...base, liquidDock: true}, ['right']);
scene('dim-always', {...base, wallpaperDim: 'always'}, ['right']);
scene('dim-always-light', {...light, wallpaperDim: 'always'}, ['right']);
scene('plain-wallpaper', {...base, wallpaperType: 'plain', wallpaper: 'none'}, ['right']);
scene('no-weather', {...base, showWeather: false, weatherCity: ''}, ['right']);
scene('clock-24h', {...base, clockFormat: '24h'});
for (const size of ['small', 'large']) {
	scene(`forecast-home-${size}`, {...base, homeForecast: true, homeForecastSize: size});
	scene(`forecast-home-${size}-light`, {...light, homeForecast: true, homeForecastSize: size});
}
scene('no-live-tv', {...base, liveTvRow: false}, ['right', 'down', 'down', 1000]);

// SHARD=k/n runs every n-th scene from k, so several copies can run side by side (each needs its own CDP_PORT)
const [SK, SN] = (process.env.SHARD || '0/1').split('/').map(Number);
const result = {};
for (const [n, s] of SCENES.entries()) {
	if ((ONLY && !ONLY.test(s.name)) || n % SN !== SK) continue;
	await open(s.config, s.opts);
	for (let h = 0; h < (s.opts.hold || 0); h++) {
		await evalJs(`window.dispatchEvent(new KeyboardEvent('keydown',{keyCode:13,which:13,bubbles:true})); true`);
		for (let i = 0; i < 8; i++) { await sleep(120); await evalJs(`window.dispatchEvent(new KeyboardEvent('keydown',{keyCode:13,which:13,repeat:true,bubbles:true})); true`); }
		await sleep(1200);
	}
	await press(...s.steps);
	result[s.name] = await evalJs(SNAP);
	if (process.env.SHOTS) { const r = await send('Page.captureScreenshot', {format: 'jpeg', quality: 60}); writeFileSync(`${process.env.SHOTS}/${s.name.replace(/\//g, '_')}.jpg`, Buffer.from(r.result.data, 'base64')); }
	process.stdout.write('.');
}
writeFileSync(OUT, JSON.stringify(result));
console.log('\nsaved', OUT, Object.keys(result).length, 'scenes');
ws.close(); chrome.kill(); server.close();
process.exit(0);
