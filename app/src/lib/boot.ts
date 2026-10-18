// Cold start. The TV ends Lumen whenever another app opens (docs/spikes.md), so every Home press starts it from nothing. What the last launch
// showed (apps, inputs, the Recent row, weather, clock format, wallpaper) is kept in localStorage and drawn at once; the TV is asked again
// after the first frame is up, and the screen only changes if the answer differs.

/** The last value stored under `key`, or null. */
export function readCache<T> (key: string): T | null {
	try { return JSON.parse(localStorage.getItem(key) || 'null') as T | null; } catch { return null; }
}

export function writeCache (key: string, value: unknown): void {
	try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* full: the next cold start asks the TV first, as before */ }
}

/** How long after the first frame the start-up refreshes run, so they do not compete with drawing it and decoding the wallpaper. */
const AFTER_FIRST_FRAME_MS = 400;

/** Runs `cb` once the first frame has been drawn (and a short pause after it). Returns a cancel. */
export function afterFirstFrame (cb: () => void, delayMs = AFTER_FIRST_FRAME_MS): () => void {
	let timer = 0;
	let frame = window.requestAnimationFrame(() => {
		frame = 0;
		timer = window.setTimeout(cb, delayMs);
	});
	return () => { if (frame) window.cancelAnimationFrame(frame); window.clearTimeout(timer); };
}

/** The wallpaper the inline script in index.html paints before the app's script has loaded. Keep the key and fields in step with it. */
export const BOOT_WALLPAPER_KEY = 'lumen-boot-wallpaper-v1';

export interface BootWallpaper {
	/** the wallpaper choice this was written for */
	sel?: string;
	/** a bundled picture's URL (a local file), painted sharp at once */
	url?: string;
	/** the --wp-blur and --wp-bg values (the pre-blurred copies the glass shows). For a cloud choice, bg is a data: URL of the strong blur of
	 *  the picture the next launch opens on, painted full-screen until the sharp one fades in. */
	blur?: string;
	bg?: string;
	/** the picture the next launch shows: cloud:<id> (stored on the TV by lib/wpstore.ts) or local:N, or an Immich id */
	next?: string;
}
