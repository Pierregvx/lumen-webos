// Glass lab: a copy of the glass bar over a bundled wallpaper, with sliders, on this Mac. It can send the same settings to the TV live and measure the frame rate there.
//   node tools/tv/glass-lab.mjs     then open http://localhost:5202 in Chrome (Safari has no backdrop SVG filters)
// The TV parts need the DevTools tunnel (.claude/skills/tv/SKILL.md); nothing is saved on the TV, and a relaunch clears it. Node 22, no packages.
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';

const PORT = process.env.LUMEN_CDP_PORT || 19998;
const KEYS = {left: [37, 'ArrowLeft'], right: [39, 'ArrowRight']};

let ws = null, seq = 0;
const waiting = new Map();
async function connect () {
	if (ws && ws.readyState === 1) return;
	const pages = await fetch(`http://127.0.0.1:${PORT}/json`).then((r) => r.json());
	const page = pages.find((p) => /lumen/i.test(p.url)) || pages.find((p) => p.title === 'Launcher');
	if (!page) throw new Error('Lumen is not running on the TV');
	ws = new WebSocket(page.webSocketDebuggerUrl);
	await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; });
	ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); } };
	ws.onclose = () => { ws = null; };
}
const send = (method, params = {}) => new Promise((ok) => { const id = ++seq; waiting.set(id, ok); ws.send(JSON.stringify({id, method, params})); });
async function evaluate (expression) {
	await connect();
	const r = await send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
	if (r.result && r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
	return r.result?.result?.value;
}
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function press (k) {
	const [code, key] = KEYS[k];
	for (const type of ['rawKeyDown', 'keyUp']) await send('Input.dispatchKeyEvent', {type, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, key, code: key});
}

// runs in the TV page: builds the lens map and filter (same shape as app/src/lib/liquidGlass.ts, with depth and passes made adjustable) and the CSS
function applyInPage (s) {
	const NS = 'http://www.w3.org/2000/svg';
	const old = document.getElementById('lab'); if (old) old.remove();
	const oldSvg = document.getElementById('lab-svg'); if (oldSvg) oldSvg.remove();
	if (!s.on) return 'cleared';
	const row = document.querySelector('.rows > .row:first-child');
	if (!row) return 'no glass bar on screen';
	const g = getComputedStyle(row, '::before');
	const w = Math.round(row.offsetWidth - (parseFloat(g.left) || 0) - (parseFloat(g.right) || 0));
	const h = Math.round(parseFloat(g.height) || 0);
	const r = Math.min(Math.round(parseFloat(g.borderTopLeftRadius) || 0), Math.floor(h / 2));
	const d = s.depth;
	const map = 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg height="${h}" width="${w}" viewBox="0 0 ${w} ${h}" xmlns="${NS}"><style>.mix { mix-blend-mode: screen; }</style><defs>`
		+ `<linearGradient id="Y" x1="0" x2="0" y1="${Math.ceil((r / h) * 15)}%" y2="${Math.floor(100 - (r / h) * 15)}%"><stop offset="0%" stop-color="#0F0"/><stop offset="100%" stop-color="#000"/></linearGradient>`
		+ `<linearGradient id="X" x1="${Math.ceil((r / w) * 15)}%" x2="${Math.floor(100 - (r / w) * 15)}%" y1="0" y2="0"><stop offset="0%" stop-color="#F00"/><stop offset="100%" stop-color="#000"/></linearGradient></defs>`
		+ `<rect x="0" y="0" height="${h}" width="${w}" fill="#808080"/><g filter="blur(2px)"><rect x="0" y="0" height="${h}" width="${w}" fill="#000080"/>`
		+ `<rect x="0" y="0" height="${h}" width="${w}" fill="url(#Y)" class="mix"/><rect x="0" y="0" height="${h}" width="${w}" fill="url(#X)" class="mix"/>`
		+ `<rect x="${d}" y="${d}" height="${h - 2 * d}" width="${w - 2 * d}" fill="#808080" rx="${Math.max(r - d, 0)}" ry="${Math.max(r - d, 0)}" filter="blur(${d}px)"/></g></svg>`);
	const pass = (scale, m, res) => `<feDisplacementMap in="SourceGraphic" in2="map" scale="${scale}" xChannelSelector="R" yChannelSelector="G"/>`
		+ `<feColorMatrix type="matrix" values="${m}" result="${res}"/>`;
	const body = s.fringe
		? pass(s.refraction + 4, '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0', 'r') + pass(s.refraction + 2, '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0', 'g')
			+ pass(s.refraction, '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0', 'b') + '<feBlend in="r" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="b" mode="screen"/>'
		: `<feDisplacementMap in="SourceGraphic" in2="map" scale="${s.refraction}" xChannelSelector="R" yChannelSelector="G"/>`;
	const svg = document.createElementNS(NS, 'svg');
	svg.id = 'lab-svg'; svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.style.position = 'absolute';
	svg.innerHTML = `<filter id="lg-lab" x="0" y="0" width="${w}" height="${h}" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">`
		+ `<feImage href="${map}" x="0" y="0" width="${w}" height="${h}" result="map"/>${body}</filter>`;
	document.body.appendChild(svg);
	const parts = [];
	if (s.blur > 0) parts.push(`blur(${s.blur}px)`);
	if (s.refraction > 0) parts.push('url(#lg-lab)');
	if (s.refraction > 0 && s.blurAfter > 0) parts.push(`blur(${s.blurAfter}px)`);
	// the colour boost is its own choice, so turning refraction off does not also drop it; alone it still reads the backdrop, which costs frames
	if (s.boost !== false) parts.push(`saturate(${s.saturate}) brightness(${s.brightness})`);
	const bf = parts.length ? parts.join(' ') : 'none';
	const tint = s.tint || (s.frost >= 0 ? `rgba(255, 255, 255, ${s.frost})` : `rgba(0, 0, 0, ${-s.frost})`);
	const k = s.rim;
	const rims = `inset 0 0 0 1px rgba(255, 255, 255, ${0.15 * k}), inset 1.5px 1.5px 0 rgba(255, 255, 255, ${0.5 * k}), inset 0 0 12px rgba(255, 255, 255, ${0.2 * k}), 0 20px 44px rgba(0, 0, 0, 0.28)`;
	const sel = 'html .rows:not(.rows--lower) > .row:first-child::before';
	const style = document.createElement('style');
	style.id = 'lab';
	style.textContent = `${sel} { -webkit-backdrop-filter: ${bf} !important; backdrop-filter: ${bf} !important; background-color: ${tint} !important;`
		+ (s.sheen ? '' : ' background-image: none !important;')
		+ (s.lumenRims ? '' : ` box-shadow: ${rims} !important;`) + ' }'
		+ (s.slide === false || (s.slide === undefined && !s.lumenRims) ? ' html .rows:not(.rows--lower) > .row:first-child::after { display: none !important; }' : '');
	document.head.appendChild(style);
	return `${w}x${h} r${r} · ${bf}`;
}

// counts frames in the page for ms, while the server presses keys
const fpsStart = `(() => { const f = window.__labFps = {n: 0, slow: 0, worst: 0, t0: performance.now(), last: performance.now(), run: true};
	const tick = (now) => { if (!f.run) return; const dt = now - f.last; f.n++; if (dt > 25) f.slow++; if (dt > f.worst) f.worst = dt; f.last = now; requestAnimationFrame(tick); };
	requestAnimationFrame(tick); return 1; })()`;
const fpsStop = `(() => { const f = window.__labFps; f.run = false; const s = (performance.now() - f.t0) / 1000;
	return {fps: Math.round(f.n / s * 10) / 10, slow: f.slow, worst: Math.round(f.worst)}; })()`;
async function measure (moving) {
	await evaluate(fpsStart);
	if (moving) {
		await connect();
		for (const k of ['right', 'right', 'right', 'right', 'left', 'left', 'left', 'left']) { await press(k); await wait(375); }
	} else await wait(3000);
	return evaluate(fpsStop);
}

const ICONS = ['bbc.iplayer.3.0.png', 'youtube.leanback.v4.png', 'now.tv.png', 'com.fvp.ch4.png', 'com.apple.appletv.png', 'tv.twitch.tv.starshot.lg.png'];
const page = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Glass lab</title>
<style>
:root { color-scheme: light dark; --bg: #f4f4f6; --fg: #1a1a1f; --muted: #6a6a75; --card: #fff; --line: #ddd; --accent: #2a6df4; }
@media (prefers-color-scheme: dark) { :root { --bg: #16161a; --fg: #ececf1; --muted: #9a9aa6; --card: #202026; --line: #33333b; --accent: #6ea0ff; } }
body { margin: 0; padding: 16px; background: var(--bg); color: var(--fg); font: 14px/1.4 system-ui, sans-serif; }
.layout { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 16px; align-items: start; }
@media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }
h1 { font-size: 18px; margin: 0 0 4px; } p { color: var(--muted); margin: 0 0 12px; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; margin-bottom: 12px; }
.ctl { display: grid; grid-template-columns: 110px 1fr 46px; gap: 10px; align-items: center; padding: 4px 0; }
.ctl.tick { grid-template-columns: 1fr auto; }
.layer { display: grid; grid-template-columns: 18px 1fr auto; gap: 8px; align-items: center; padding: 8px 0 4px; border-top: 1px solid var(--line); }
.layer:first-child { border-top: 0; }
.ctl.sub { padding-left: 26px; grid-template-columns: 84px 1fr 40px; }
.cost { font-size: 12px; color: #c2410c; white-space: nowrap; } .cost.free { color: #15803d; }
@media (prefers-color-scheme: dark) { .cost { color: #fb923c; } .cost.free { color: #4ade80; } }
#estimate { margin: 10px 0 4px; padding: 8px 10px; border-radius: 8px; background: var(--bg); }
output { text-align: right; font-variant-numeric: tabular-nums; color: var(--muted); }
input[type=range] { width: 100%; accent-color: var(--accent); }
select, button { font: inherit; padding: 7px 11px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: var(--fg); cursor: pointer; }
button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.btns { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
#status { font-family: ui-monospace, monospace; font-size: 12px; color: var(--muted); margin-top: 8px; word-break: break-all; }
table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; font-size: 12px; }
td, th { text-align: left; padding: 4px; border-top: 1px solid var(--line); }
.frame { position: relative; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; border-radius: 10px; background: #000; margin-bottom: 10px; }
/* the stage is the TV's 1920x1080 page, scaled to fit; the dock's size and place are read from the TV */
.stage { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; transform-origin: 0 0; background: center / cover no-repeat; font-family: "Helvetica Neue", Arial, sans-serif; }
.rows { position: absolute; left: 125px; top: 806px; width: 1670px; }
.rows > .row { position: relative; width: 1670px; height: 224px; display: flex; gap: 46px; align-items: flex-start; --row-w: 1670px; }
.rows > .row::before { content: ""; position: absolute; left: -40px; right: -40px; top: 0; height: 224px; border-radius: 74px; z-index: 0;
	-webkit-backdrop-filter: blur(3px) saturate(1.5) brightness(1.1); backdrop-filter: blur(3px) saturate(1.5) brightness(1.1); background-color: rgba(0, 0, 0, 0.3);
	background-image: linear-gradient(135deg, rgba(255, 255, 255, 0.13) 0, rgba(255, 255, 255, 0.03) 200px, rgba(255, 255, 255, 0.03) calc(100% - 200px), rgba(255, 255, 255, 0.08) 100%);
	box-shadow: inset 2px 2px 1.5px -1px rgba(255, 255, 255, 0.55), inset 3px 3px 2px -2px rgba(110, 200, 255, 0.7), inset -3px -3px 2px -2px rgba(255, 120, 190, 0.28),
		inset -2px -2px 1.5px -1px rgba(255, 255, 255, 0.2), inset 0 0 14px rgba(255, 255, 255, 0.05), 0 20px 44px rgba(0, 0, 0, 0.28); }
.rows > .row::after { content: ""; position: absolute; left: 50%; top: 0; width: 260px; height: 28px; z-index: 0; pointer-events: none;
	background: linear-gradient(90deg, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.9) 50%, rgba(255, 255, 255, 0)) top / 100% 1.5px no-repeat,
		radial-gradient(50% 100% at 50% 0, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0)) top / 100% 28px no-repeat;
	--sel-edge: calc(var(--row-w) / 2 - 34px - 130px);
	transform: translateX(calc(clamp(-1 * var(--sel-edge), var(--sel-x, 0px), var(--sel-edge)) - 130px)); transition: transform 260ms cubic-bezier(0.2, 0.7, 0.2, 1); }
.tile { position: relative; z-index: 1; margin-top: 40px; width: 240px; }
.tile__box { width: 240px; height: 144px; border-radius: 34px; background: #fff center / cover no-repeat; box-shadow: 0 6px 14px rgba(0, 0, 0, 0.25); transition: transform 260ms cubic-bezier(0.2, 0.7, 0.2, 1); }
.tile--focused .tile__box { transform: scale(1.12); box-shadow: inset 2px 2px 1.5px -1px #fff, inset -2px -2px 1.5px -1px rgba(255, 255, 255, 0.6), 0 14px 24px rgba(0, 0, 0, 0.35); }
</style>
<div class="layout">
<div>
	<div class="frame" id="frame"><div class="stage" id="stage"><div class="rows"><div class="row" id="dock"></div></div></div></div>
	<div class="btns">
		<select id="wp"></select>
		<button id="left">◀</button><button id="right">▶</button>
		<label class="btns"><input type="checkbox" id="auto"> Move focus by itself</label>
		<label class="btns"><input type="checkbox" id="zoom"> Close-up</label>
	</div>
	<p style="margin-top:8px">Arrow keys move the focus too (click the picture first). Your Mac draws this, so it shows the look only, not the TV's speed.</p>
</div>
<div>
	<h1>Glass lab</h1>
	<div class="card" id="controls"></div>
	<div class="card">
		<label class="ctl tick"><span>Send each change to the TV too</span><input type="checkbox" id="tv"></label>
		<div class="btns"><button class="primary" id="send">Send to TV now</button><button id="off">TV back to Lumen's glass</button></div>
		<div class="btns" style="margin-top:8px"><button id="still">Measure TV still</button><button id="moving">Measure TV moving</button></div>
		<div id="status">Preview only. Nothing goes to the TV until you ask.</div>
	</div>
	<div class="card"><table><thead><tr><th>Setting</th><th>Test</th><th>fps</th><th>&gt;25 ms</th><th>worst</th></tr></thead><tbody id="log"></tbody></table></div>
</div>
</div>
<script>
const applyInPage = ${applyInPage};
const icons = ${JSON.stringify(ICONS)};
const dock = document.getElementById('dock'), stage = document.getElementById('stage'), frame = document.getElementById('frame');
icons.forEach((f) => { const t = document.createElement('div'); t.className = 'tile'; t.innerHTML = '<div class="tile__box" style="background-image:url(/icons/' + f + ')"></div>'; dock.appendChild(t); });
let focus = 1;
function setFocus (i) {
	focus = (i + icons.length) % icons.length;
	[...dock.children].forEach((t, n) => t.classList.toggle('tile--focused', n === focus));
	dock.style.setProperty('--sel-x', (focus * 286 + 120 - 835) + 'px');
}
setFocus(1);
// close-up: the left half of the dock fills the frame, so the bend at the rim is easy to see
const fit = () => { const k = frame.clientWidth / (zoom.checked ? 960 : 1920); stage.style.transform = zoom.checked ? 'scale(' + k + ') translate(-40px, -540px)' : 'scale(' + k + ')'; };
const zoom = document.getElementById('zoom'); zoom.onchange = fit;
new ResizeObserver(fit).observe(frame);
const wp = document.getElementById('wp');
for (let i = 0; i < 5; i++) wp.add(new Option('Wallpaper ' + (i + 1), i));
wp.onchange = () => { stage.style.backgroundImage = 'url(/wp/default-' + wp.value + '.jpg)'; };
wp.onchange();
document.getElementById('left').onclick = () => setFocus(focus - 1);
document.getElementById('right').onclick = () => setFocus(focus + 1);
frame.tabIndex = 0;
frame.onkeydown = (e) => { if (e.key === 'ArrowLeft') setFocus(focus - 1); else if (e.key === 'ArrowRight') setFocus(focus + 1); else return; e.preventDefault(); };
let timer = 0;
document.getElementById('auto').onchange = (e) => { clearInterval(timer); if (e.target.checked) timer = setInterval(() => setFocus(focus + 1), 700); };

// each layer that costs the TV frames can be turned off; the costs are fps on the TV while focus moves along the dock (2026-10-22, docs/research/RESEARCH.md section 5)
const u = {dark: true, frost: 0, sheen: true, lumenRims: true, slide: true, boost: true, blurOn: false, blur: 3, refOn: true, refraction: 100, depth: 14, fringe: false, on: true};
const layers = [
	{name: "Dark tint (Lumen's, 30% black)", key: 'dark', cost: 'free'},
	{name: 'Frost (white)', cost: 'free', sliders: [['frost', 'Amount', 0, 0.5, 0.01]]},
	{name: "Sheen (Lumen's light diagonal gradient)", key: 'sheen', cost: 'free'},
	{name: "Lumen's rim lighting (blue and pink edges). Off: the generator's white rim", key: 'lumenRims', cost: 'free'},
	{name: 'Highlight over the focused app', key: 'slide', cost: 'about −4 fps'},
	{name: 'Colour boost', key: 'boost', cost: 'about −8 fps alone'},
	{name: 'Blur', key: 'blurOn', cost: 'about −16 fps alone', sliders: [['blur', 'Amount', 0.25, 10, 0.25]]},
	{name: 'Refraction', key: 'refOn', cost: 'about −23 fps alone', sliders: [['refraction', 'Strength', 0, 200, 1], ['depth', 'Bezel depth', 2, 60, 1]]},
	{name: 'Colour fringe (with refraction)', key: 'fringe', cost: 'down to about 7 fps'},
];
const box = document.getElementById('controls');
const tag = (c) => '<span class="cost' + (c === 'free' ? ' free' : '') + '">' + c + '</span>';
for (const L of layers) {
	const head = document.createElement('label'); head.className = 'layer';
	head.innerHTML = (L.key ? '<input type="checkbox"' + (u[L.key] ? ' checked' : '') + '>' : '<span class="nobox"></span>') + '<span>' + L.name + '</span>' + tag(L.cost);
	if (L.key) { const i = head.querySelector('input'); i.onchange = () => { u[L.key] = i.checked; change(); }; }
	box.appendChild(head);
	for (const [k, name, a, b, step] of L.sliders || []) {
		const l = document.createElement('label'); l.className = 'ctl sub';
		l.innerHTML = '<span>' + name + '</span><input type="range" min="' + a + '" max="' + b + '" step="' + step + '" value="' + u[k] + '"><output>' + u[k] + '</output>';
		const i = l.querySelector('input'), o = l.querySelector('output');
		i.oninput = () => { u[k] = +i.value; o.textContent = i.value; change(); };
		box.appendChild(l);
	}
}
const est = document.createElement('div'); est.id = 'estimate'; box.appendChild(est);
const cmp = document.createElement('label'); cmp.className = 'layer'; cmp.innerHTML = '<input type="checkbox" checked><span>Untick to compare with Lumen&rsquo;s glass now</span>';
cmp.querySelector('input').onchange = (e) => { u.on = e.target.checked; change(); }; box.appendChild(cmp);
// what applyInPage takes
function out () {
	// white frost laid over the dark tint, as one colour
	const a = u.dark ? u.frost + 0.3 * (1 - u.frost) : u.frost, w = a ? Math.round(255 * u.frost / a) : 255;
	return {on: u.on, frost: u.frost, tint: 'rgba(' + w + ', ' + w + ', ' + w + ', ' + Math.round(a * 1000) / 1000 + ')', lumenRims: u.lumenRims, slide: u.slide, boost: u.boost, blur: u.blurOn ? u.blur : 0, blurAfter: 0,
		refraction: u.refOn ? u.refraction : 0, depth: u.depth, fringe: u.refOn && u.fringe, saturate: 1.5, brightness: 1.1, rim: 1, sheen: u.sheen};
}
// measured on the TV, moving: key = r(efraction) l (blur) b(oost) f(ringe); the missing mixes are estimates
const MEASURED = {'': 41, b: 33, l: 25, r: 18, rb: 19, rlb: 15, rf: 7};
const GUESS = {lb: 24, rl: 15, rbf: 7, rlf: 6, rlbf: 6};
function estimate () {
	const s = out();
	if (!s.on) { est.textContent = "Lumen's glass now: about 16-24 fps while moving."; return; }
	const k = (s.refraction ? 'r' : '') + (s.blur ? 'l' : '') + (s.boost ? 'b' : '') + (s.fringe ? 'f' : '');
	let fps = MEASURED[k] ?? GUESS[k], how = k in MEASURED ? 'measured' : 'estimate';
	if (!s.slide) { fps += k ? 2 : 4; if (k) how = 'estimate'; }
	est.innerHTML = 'On the TV while moving: about <b>' + fps + ' fps</b> (' + how + '). Standing still, every mix holds 60.';
}
const status = document.getElementById('status'), tv = document.getElementById('tv');
function change () { applyInPage(out()); estimate(); if (tv.checked) push(); }
let busy = false, again = false;
async function push (settings) {
	if (busy) { again = true; return; } busy = true;
	try { const r = await fetch('/apply', {method: 'POST', body: JSON.stringify(settings || out())}).then((r) => r.json()); status.textContent = 'TV: ' + (r.error || r.result); }
	catch (e) { status.textContent = String(e); }
	busy = false; if (again) { again = false; push(); }
}
function label () { const s = out(); return s.on ? [u.dark && 'dark tint', 'frost ' + s.frost, s.sheen && 'sheen', s.lumenRims ? 'Lumen rims' : 'white rim', s.slide && 'highlight', s.boost && 'boost', s.blur && 'blur ' + s.blur, s.refraction && 'refraction ' + s.refraction + '/' + s.depth, s.fringe && 'fringe'].filter(Boolean).join(', ') : "Lumen's own"; }
async function measure (moving) {
	status.textContent = moving ? 'measuring on the TV while focus moves along the dock…' : 'measuring on the TV for 3 s, standing still…';
	const r = await fetch('/measure?moving=' + (moving ? 1 : 0), {method: 'POST'}).then((r) => r.json());
	if (r.error) { status.textContent = r.error; return; }
	const tr = document.createElement('tr'); tr.innerHTML = '<td>' + label() + '</td><td>' + (moving ? 'moving' : 'still') + '</td><td>' + r.result.fps + '</td><td>' + r.result.slow + '</td><td>' + r.result.worst + ' ms</td>';
	document.getElementById('log').prepend(tr); status.textContent = 'done';
}
tv.onchange = () => { if (tv.checked) push(); };
document.getElementById('send').onclick = () => push();
document.getElementById('still').onclick = () => measure(false);
document.getElementById('moving').onclick = () => measure(true);
document.getElementById('off').onclick = () => push({on: false});
change();
</script>`;

const PUBLIC = new URL('../../app/public/', import.meta.url);
const TYPES = {jpg: 'image/jpeg', png: 'image/png'};
const body = (req) => new Promise((ok) => { let b = ''; req.on('data', (c) => b += c); req.on('end', () => ok(b)); });
createServer(async (req, res) => {
	const reply = (o) => { res.writeHead(200, {'content-type': 'application/json'}); res.end(JSON.stringify(o)); };
	try {
		if (req.url === '/apply') return reply({result: await evaluate(`(${applyInPage})(${await body(req)})`)});
		if (req.url.startsWith('/measure')) return reply({result: await measure(req.url.endsWith('=1'))});
		// only the bundled wallpapers and app icons, by plain file name
		const file = req.url.match(/^\/(wp|icons)\/([\w.-]+\.(jpg|png))$/);
		if (file) {
			const data = await readFile(new URL(`${file[1] === 'wp' ? 'wallpapers' : 'icons/apps'}/${file[2]}`, PUBLIC)).catch(() => null);
			res.writeHead(data ? 200 : 404, {'content-type': TYPES[file[3]]}); return res.end(data);
		}
		res.writeHead(200, {'content-type': 'text/html'}); res.end(page);
	} catch (e) { reply({error: e.message}); }
}).listen(5202, () => console.log('Glass lab on http://localhost:5202'));
