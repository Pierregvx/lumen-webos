// Per-step medians from guide.mjs captures. usage: node guide-report.mjs a.json [b.json ...] ; prints medians per step per file
import {readFileSync} from 'node:fs';
const WIN = +(process.env.WIN || 700) * 1e3; // µs after a key that belong to it
const med = (xs) => { const s = xs.filter((x) => !isNaN(x)).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
export const analyse = (file) => {
	const {events, ok} = JSON.parse(readFileSync(file, 'utf8'));
	const threads = {};
	for (const e of events) if (e.ph === 'M' && e.name === 'thread_name') threads[`${e.pid}:${e.tid}`] = e.args.name;
	const th = (e) => threads[`${e.pid}:${e.tid}`] || '?';
	const stamps = events.filter((e) => e.name === 'TimeStamp' && e.args?.data?.message?.startsWith('k:')).map((e) => [e.args.data.message, e.ts]).sort((a, b) => a[1] - b[1]);
	const keydowns = events.filter((e) => e.name === 'EventDispatch' && e.args?.data?.type === 'keydown').sort((a, b) => a.ts - b.ts);
	const swaps = events.filter((e) => e.name === 'Display::DrawAndSwap' && e.ph === 'X').map((e) => e.ts + e.dur).sort((a, b) => a - b);
	const X = (n, t) => events.filter((e) => e.ph === 'X' && e.name === n && (!t || th(e) === t));
	const raster = X('RasterDecoderImpl::DoEndRasterCHROMIUM', 'Chrome_InProcGpuThread');
	const draw = X('SkiaOutputSurfaceImplOnGpu::FinishPaintCurrentFrame');
	const swapb = X('NativeViewGLSurfaceEGL:RealSwapBuffers');
	const mainTasks = X('ThreadControllerImpl::RunTask', 'CrRendererMain');
	const style = X('LocalFrameView::RunStyleAndLayoutLifecyclePhases', 'CrRendererMain');
	const paint = X('LocalFrameView::RunPaintLifecyclePhase', 'CrRendererMain');
	const sumIn = (es, a, b) => es.filter((e) => e.ts >= a && e.ts < b).reduce((x, e) => x + e.dur / 1000, 0);
	const rows = [];
	for (let i = 0; i < stamps.length - 1; i++) {
		const [name, ts] = stamps[i];
		if (name === 'k:end') continue;
		const [, idx, dir] = name.split(':');
		const kd = keydowns.find((k) => k.ts >= ts && k.ts < stamps[i + 1][1]);
		if (!kd) continue;
		const t0 = kd.ts, t1 = Math.min(t0 + WIN, stamps[i + 1][1]);
		const sw = swaps.filter((s) => s > t0 && s < t1);
		const first = sw.length ? (sw[0] - t0) / 1000 : NaN;
		const last = sw.length ? (sw[sw.length - 1] - t0) / 1000 : NaN;
		const gaps = sw.slice(1).map((s, j) => (s - sw[j]) / 1000);
		// the move: first swap to first+320 ms
		const mv = sw.filter((s) => s <= sw[0] + 320e3);
		const mvg = mv.slice(1).map((s, j) => (s - mv[j]) / 1000);
		rows.push({
			grp: dir, idx: +idx,
			'key→first frame': first,
			'frames in move': mv.length,
			'worst gap in move': mvg.length ? Math.max(...mvg) : NaN,
			'mean gap in move': mvg.length ? mean(mvg) : NaN,
			'key→last frame': last,
			'frames total': sw.length,
			'raster ms': sumIn(raster, t0, t1),
			'raster before 1st': sumIn(raster, t0, sw[0] || t1),
			'swap block ms': mean(swapb.filter((e) => e.ts >= t0 && e.ts < t1).map((e) => e.dur / 1000)),
			'draw ms mean': mean(draw.filter((e) => e.ts >= t0 && e.ts < t1).map((e) => e.dur / 1000)),
			'main ms before 1st': sumIn(mainTasks, t0, sw[0] || t1),
			'main ms total': sumIn(mainTasks, t0, t1),
			'longest main task': Math.max(0, ...mainTasks.filter((e) => e.ts >= t0 && e.ts < t1).map((e) => e.dur / 1000)),
			'key handler ms': kd.dur / 1000,
			'style+layout ms': sumIn(style, t0, t1),
			'paint ms': sumIn(paint, t0, t1),
		});
	}
	return {rows, ok};
};
const files = process.argv.slice(2);
if (files.length) {
	const res = files.map((f) => analyse(f));
	const metrics = Object.keys(res[0].rows[0]).filter((k) => k !== 'grp' && k !== 'idx');
	for (const g of [...new Set(res[0].rows.map((r) => r.grp))]) {
		console.log(`\n${g}  (median)     ` + files.map((f) => f.split('/').pop().replace('.json', '').slice(0, 10).padStart(11)).join(''));
		for (const m of metrics) console.log(`  ${m.padEnd(20)}` + res.map((r) => { const v = med(r.rows.filter((x) => x.grp === g).map((x) => x[m])); return (isNaN(v) ? '-' : v.toFixed(m.includes('frames') ? 0 : 0)).padStart(11); }).join(''));
	}
	console.log('\nback at start: ' + res.map((r) => r.ok).join(' '));
}
