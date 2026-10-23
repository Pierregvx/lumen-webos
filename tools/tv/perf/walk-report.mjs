// Per-segment summary of a walk.mjs capture. usage: node walkana.mjs <a.json> [b.json] (b printed beside a)
import {readFileSync} from 'node:fs';
const summarise = (file) => {
	const {f, marks, events} = JSON.parse(readFileSync(file, 'utf8'));
	const threads = {};
	for (const e of events) if (e.ph === 'M' && e.name === 'thread_name') threads[`${e.pid}:${e.tid}`] = e.args.name;
	const th = (e) => threads[`${e.pid}:${e.tid}`] || '?';
	// trace time of each mark, from console.timeStamp
	const stamps = {};
	for (const e of events) if (e.name === 'TimeStamp' && e.args?.data?.message) stamps[e.args.data.message] = e.ts;
	const swaps = events.filter((e) => e.name === 'Display::DrawAndSwap' && e.ph === 'X').map((e) => e.ts + e.dur).sort((a, b) => a - b);
	const fp = events.filter((e) => e.name === 'SkiaOutputSurfaceImplOnGpu::FinishPaintCurrentFrame' && e.ph === 'X');
	const keys = events.filter((e) => e.name === 'EventDispatch' && e.args?.data?.type === 'keydown').sort((a, b) => a.ts - b.ts);
	const tasks = events.filter((e) => e.ph === 'X' && e.name === 'ThreadControllerImpl::RunTask' && th(e) === 'CrRendererMain');
	const gpuTasks = events.filter((e) => e.ph === 'X' && e.name === 'ThreadControllerImpl::RunTask' && th(e) === 'Chrome_InProcGpuThread');
	const byName = (n, t) => events.filter((e) => e.ph === 'X' && e.name === n && th(e) === t);
	const paint = byName('LocalFrameView::RunPaintLifecyclePhase', 'CrRendererMain'), style = byName('LocalFrameView::RunStyleAndLayoutLifecyclePhases', 'CrRendererMain'), layerize = byName('Layerize', 'CrRendererMain'), script = byName('EventDispatch', 'CrRendererMain'), raster = byName('RasterDecoderImpl::DoEndRasterCHROMIUM', 'Chrome_InProcGpuThread');
	const out = {};
	const names = marks.filter(([n]) => n.startsWith('start:')).map(([n]) => n.slice(6));
	for (const name of names) {
		const a = marks.find(([n]) => n === `start:${name}`)[1], b = marks.find(([n]) => n === `end:${name}`)[1];
		const fr = f.filter((t) => t >= a && t <= b);
		let dropped = 0, worst = 0;
		for (let i = 1; i < fr.length; i++) { const g = fr[i] - fr[i - 1]; worst = Math.max(worst, g); dropped += Math.max(0, Math.round(g / 16.67) - 1); }
		const ta = stamps[`start:${name}`], tb = stamps[`end:${name}`];
		const inT = (ts) => ts >= ta && ts <= tb;
		const lat = keys.filter((k) => inT(k.ts)).map((k) => { const s = swaps.find((x) => x > k.ts + k.dur); return s ? (s - k.ts) / 1000 : NaN; }).filter((x) => !isNaN(x) && x < 1000);
		const gp = fp.filter((e) => inT(e.ts)).map((e) => e.dur / 1000);
		const mt = tasks.filter((e) => inT(e.ts)).map((e) => e.dur / 1000);
		const sum = (es) => es.filter((e) => inT(e.ts)).reduce((x, e) => x + e.dur / 1000, 0);
		const mean = (xs) => (xs.length ? xs.reduce((x, y) => x + y, 0) / xs.length : 0);
		const p = (xs, q) => { const s = [...xs].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0; };
		out[name] = {
			'smooth %': (100 * fr.length / (fr.length + dropped)).toFixed(0),
			'dropped': dropped,
			'worst gap': worst.toFixed(0),
			'key→screen mean': mean(lat).toFixed(0),
			'key→screen p90': p(lat, 0.9).toFixed(0),
			'gpu draw mean': mean(gp).toFixed(1),
			'gpu draw p90': p(gp, 0.9).toFixed(1),
			'main busy %': (100 * mt.reduce((x, y) => x + y, 0) / ((tb - ta) / 1000)).toFixed(0),
			'main longest': Math.max(0, ...mt).toFixed(0),
			'  style+layout ms': sum(style).toFixed(0),
			'  paint ms': sum(paint).toFixed(0),
			'  layerize ms': sum(layerize).toFixed(0),
			'  key script ms': sum(script).toFixed(0),
			'gpu busy %': (100 * sum(gpuTasks) / ((tb - ta) / 1000)).toFixed(0),
			'  raster ms': sum(raster).toFixed(0),
			'  draw ms': gp.reduce((x, y) => x + y, 0).toFixed(0),
		};
	}
	return out;
};
const A = summarise(process.argv[2]);
const B = process.argv[3] ? summarise(process.argv[3]) : null;
for (const name of Object.keys(A)) {
	console.log(`\n${name}`);
	for (const k of Object.keys(A[name])) console.log(`  ${k.padEnd(18)} ${String(A[name][k]).padStart(7)}${B && B[name] ? '  →  ' + String(B[name][k]).padStart(7) : ''}`);
}
