// Settings > Frame-rate counter (dev builds only): a small readout in the top-left corner with the frames drawn in the last second and the
// longest frame in that second. A rough check on the TV until DevTools traces work (PLAN.md, Phase 4); it costs one requestAnimationFrame
// callback per frame and one text update per second, and nothing at all while it is off.

let box: HTMLDivElement | null = null;
let raf = 0;
let on = false;

export function setFpsCounter (enable: boolean): void {
	if (enable === on) return;
	on = enable;
	if (!enable) {
		window.cancelAnimationFrame(raf);
		if (box) { box.remove(); box = null; }
		return;
	}
	box = document.createElement('div');
	box.className = 'fps';
	document.body.appendChild(box);
	let frames = 0;
	let worst = 0;
	let last = performance.now();
	let since = last;
	const tick = (now: number) => {
		frames += 1;
		worst = Math.max(worst, now - last);
		last = now;
		if (now - since >= 1000) {
			if (box) box.textContent = `${Math.round(frames * 1000 / (now - since))} fps · ${Math.round(worst)} ms`;
			frames = 0; worst = 0; since = now;
		}
		raf = window.requestAnimationFrame(tick);
	};
	raf = window.requestAnimationFrame(tick);
}
