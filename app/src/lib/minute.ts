// One timer for everything that changes on the minute (the clock, the date, night dimming, the video hours, the forecast), set to the next
// minute boundary rather than polling each second. It also fires when Lumen comes back to the front, since timers are held back while hidden.

type Listener = () => void;

const listeners: Listener[] = [];
let timer = 0;

function fire (): void {
	listeners.slice().forEach((fn) => fn());
}

function tick (): void {
	if (!document.hidden) fire();
	schedule();
}

// a few ms past the boundary, so the new minute has begun when the clock reads it
function schedule (): void {
	window.clearTimeout(timer);
	timer = window.setTimeout(tick, 60000 - (Date.now() % 60000) + 20);
}

function onVisibility (): void {
	if (document.hidden) return;
	fire();
	schedule();
}

/** Calls `fn` at the start of each minute and on each return to the front. Returns the stop function. */
export function onMinute (fn: Listener): () => void {
	listeners.push(fn);
	if (listeners.length === 1) {
		document.addEventListener('visibilitychange', onVisibility);
		schedule();
	}
	return () => {
		const i = listeners.indexOf(fn);
		if (i >= 0) listeners.splice(i, 1);
		if (!listeners.length) {
			window.clearTimeout(timer);
			document.removeEventListener('visibilitychange', onVisibility);
		}
	};
}
