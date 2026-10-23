// One key press in an updown.mjs capture: frame swaps and the long tasks on the main and GPU threads. usage: node key-timeline.mjs file.json k:3:down
import {readFileSync} from 'node:fs';
const {events} = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const threads = {}; for (const e of events) if (e.ph === 'M' && e.name === 'thread_name') threads[`${e.pid}:${e.tid}`] = e.args.name;
const th = (e) => threads[`${e.pid}:${e.tid}`] || '?';
const st = events.find((e) => e.name === 'TimeStamp' && e.args?.data?.message === process.argv[3]).ts;
const kd = events.filter((e) => e.name === 'EventDispatch' && e.args?.data?.type === 'keydown' && e.ts >= st).sort((a, b) => a.ts - b.ts)[0];
const t0 = kd.ts, t1 = t0 + 650e3;
const rel = (t) => ((t - t0) / 1000).toFixed(0).padStart(4);
const want = new Set(['Display::DrawAndSwap', 'ThreadControllerImpl::RunTask', 'EventDispatch', 'LocalFrameView::RunStyleAndLayoutLifecyclePhases', 'LocalFrameView::RunPaintLifecyclePhase', 'Layerize', 'RasterDecoderImpl::DoEndRasterCHROMIUM', 'SkiaOutputSurfaceImplOnGpu::FinishPaintCurrentFrame', 'ProxyMain::BeginMainFrame::commit', 'LayerTreeHostImpl::ActivateSyncTree()', 'Commit', 'FunctionCall', 'UpdateLayoutTree', 'Layout', 'Paint', 'PrePaint']);
const rows = events.filter((e) => e.ph === 'X' && e.ts >= t0 && e.ts < t1 && want.has(e.name) && (e.dur >= 3000 || e.name === 'Display::DrawAndSwap')).sort((a, b) => a.ts - b.ts);
for (const e of rows) { if (e.name === 'ThreadControllerImpl::RunTask' && th(e) !== 'CrRendererMain' && th(e) !== 'Chrome_InProcGpuThread') continue; console.log(`${rel(e.ts)}-${rel(e.ts + e.dur)}  ${th(e).slice(0, 22).padEnd(22)} ${e.name}${e.name === 'FunctionCall' ? ' ' + (e.args?.data?.functionName || '') : ''}`); }
