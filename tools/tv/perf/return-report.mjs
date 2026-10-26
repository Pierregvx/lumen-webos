// Summary of return.mjs traces, one line per return, times in ms from the visibilitychange. usage: node return-report.mjs a.json [b.json ...]
import {readFileSync} from 'node:fs';
const f0 = (x) => Math.round(x);
for (const file of process.argv.slice(2)) {
	const d = JSON.parse(readFileSync(file, 'utf8'));
	console.log(`\n${file.split('/').pop()}: ${d.scenario}, away ${d.away / 1000}s${d.livejs ? ', LIVEJS' : ''}`);
	console.log('  frames shown (ms)                  | done | raster n/ms | decode n/ms | gpu busy | checker last | script 1s | longest page gap');
	for (const r of d.runs) {
		const vis = r.events.find((e) => e.name === 'TimeStamp' && e.args?.data?.message === 'ret:visible');
		if (!vis) { console.log('  no ret:visible mark'); continue; }
		const at = (e) => (e.ts - vis.ts) / 1000;
		const end = (e) => at(e) + (e.dur || 0) / 1000;
		const named = (n) => r.events.filter((e) => e.name === n && e.ph === 'X' && at(e) > -200);
		const swaps = named('Display::DrawAndSwap').map(end).sort((a, b) => a - b);
		const raster = named('RasterTask');
		const dec = named('GpuImageDecodeCache::DecodeImage');
		const gpu = named('gpu::GpuChannel::ExecuteDeferredRequest(gpu::mojom::DeferredRequestParamsPtr)::<lambda()>::<lambda(uint32_t)>');
		const checker = r.events.filter((e) => e.name === 'PictureLayerImpl::AppendQuads checkerboard').map(at);
		const script = named('FunctionCall').filter((e) => at(e) < 1000).reduce((a, e) => a + e.dur / 1000, 0);
		const sum = (xs) => f0(xs.reduce((a, e) => a + e.dur / 1000, 0));
		const lastWork = Math.max(...[...raster, ...dec, ...gpu].map(end));
		const fr = r.page.f; let gap = [0, 0];
		for (let i = 1; i < fr.length; i++) if (fr[i] - fr[i - 1] > gap[1]) gap = [fr[i - 1], fr[i] - fr[i - 1]];
		console.log(`  ${swaps.map(f0).join(' ').padEnd(35)}| ${String(f0(lastWork)).padStart(4)} | ${String(raster.length).padStart(4)}/${String(sum(raster)).padEnd(5)}| ${String(dec.length).padStart(3)}/${String(sum(dec)).padEnd(6)}| ${String(sum(gpu)).padStart(8)} | ${checker.length ? `${checker.length}x to ${f0(Math.max(...checker))}` : '-'} | ${String(f0(script)).padStart(9)} | ${f0(gap[1])} at ${f0(gap[0])}`);
		if (process.env.SIG) for (const [t, s] of r.page.sig) console.log(`      ${f0(t)}: ${s}`);
	}
}
