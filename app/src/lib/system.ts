// System actions the web app cannot do itself. They go through the Homebrew Channel's root service (lib/root.ts).

import {isWebOS} from './luna';
import * as root from './root';

// watch.sh's flags go in one root call. At launch it waits until the home screen is up, so it does not hold up the app list (three calls
// there took up to 2 s on a cold start, docs/research/startup-perf.md); watch.sh needs them only for the screensaver, minutes away. A
// change in Settings later is written at once.
const flags: root.HomehookFlags = {video: false, ambient: false, saverOff: false};
const FLAGS_AFTER_LAUNCH_MS = 5000;
let flagsTimer = 0;

function writeFlags (): void {
	if (!isWebOS()) return;
	window.clearTimeout(flagsTimer);
	flagsTimer = window.setTimeout(() => { root.setHomehookFlags({...flags}).catch(() => undefined); }, Math.max(0, FLAGS_AFTER_LAUNCH_MS - performance.now()));
}

/** Tells the TV-side watcher that the video wallpaper is on, so LG's screensaver is ended while Lumen is in front. */
export function setVideoFlag (on: boolean): void { flags.video = on; writeFlags(); }

/** Settings > Screensaver: watch.sh opens Lumen's ambient screen instead of LG's screensaver. */
export function setAmbientFlag (on: boolean): void { flags.ambient = on; writeFlags(); }

/** Settings > Screensaver > Off: watch.sh ends LG's screensaver as soon as it starts. */
export function setSaverOffFlag (on: boolean): void { flags.saverOff = on; writeFlags(); }

export function setAmbientShowing (on: boolean): void {
	if (!isWebOS()) return;
	root.setAmbientShowing(on).catch(() => undefined);
}

/** Starts the TV's screensaver now. */
export function startScreensaver (): Promise<void> {
	return root.startScreensaver();
}
