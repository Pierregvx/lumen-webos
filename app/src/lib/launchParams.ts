// Launch parameters: {"view":"recent"} opens Lumen on its Recent row, {"view":"guide"} on the Guide and {"view":"controls"} with Control Center open (buttons
// rebound with LG Input Hook); {"play":{"id":"<32 hex>","ticks":<int>}} plays a Jellyfin item from that position (Ciné Pierro's "Sur la TV", through
// lumen-play.sh on the TV). watch.sh opens the screensaver with {"view":"ambient","from":"<app id>"}, the app it came up over. webOS hands them over
// in webOSSystem.launchParams (PalmSystem on older firmware) on a cold start and in a webOSRelaunch event when Lumen is already running. Untested on webOS 25 (PLAN Phase 2).

const system = () => window.webOSSystem || window.PalmSystem;

export interface LaunchParams { view?: string; from?: string; play?: {id: string; ticks: number}; }

const APP_ID = /^[A-Za-z0-9._-]{1,128}$/;

function clean (p: unknown): LaunchParams {
	const o = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
	const out: LaunchParams = typeof o.view === 'string' ? {view: o.view} : {};
	if (typeof o.from === 'string' && APP_ID.test(o.from)) out.from = o.from;
	const play = (o.play && typeof o.play === 'object' ? o.play : {}) as Record<string, unknown>;
	if (typeof play.id === 'string' && /^[0-9a-f]{32}$/.test(play.id) && typeof play.ticks === 'number' && Number.isInteger(play.ticks) && play.ticks >= 0) out.play = {id: play.id, ticks: play.ticks};
	return out;
}

/** The parameters Lumen was started with. Dev preview: ?view=recent. */
export function startParams (): LaunchParams {
	if (import.meta.env.DEV) { const m = /[?&]view=(\w+)/.exec(location.search); if (m) return {view: m[1]}; }
	try {
		const raw = system() && system()!.launchParams;
		return clean(raw ? JSON.parse(raw) : {});
	} catch { return {}; }
}

/** Calls back with the parameters of each relaunch while Lumen is running. Returns the unsubscribe. */
export function onRelaunch (cb: (p: LaunchParams) => void): () => void {
	const handler = (e: Event) => {
		const detail = (e as CustomEvent).detail;
		let p: unknown = detail;
		const sys = system();
		if (!p && sys && sys.launchParams) { try { p = JSON.parse(sys.launchParams); } catch { p = {}; } }
		cb(clean(p));
	};
	document.addEventListener('webOSRelaunch', handler);
	return () => document.removeEventListener('webOSRelaunch', handler);
}
