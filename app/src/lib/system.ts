// System actions the web app cannot do itself. They go through the Homebrew Channel's root service (lib/root.ts).

import {isWebOS} from './luna';
import * as root from './root';

/** Tells the TV-side watcher that the video wallpaper is on, so LG's screensaver is ended while Lumen is in front. */
export function setVideoFlag (on: boolean): void {
	if (!isWebOS()) return;
	root.setVideoFlag(on).catch(() => undefined);
}

/** Settings > Screensaver: watch.sh opens Lumen's ambient screen instead of LG's screensaver. */
export function setAmbientFlag (on: boolean): void {
	if (!isWebOS()) return;
	root.setAmbientFlag(on).catch(() => undefined);
}

/** Settings > Screensaver > Off: watch.sh ends LG's screensaver as soon as it starts. */
export function setSaverOffFlag (on: boolean): void {
	if (!isWebOS()) return;
	root.setSaverOffFlag(on).catch(() => undefined);
}

export function setAmbientShowing (on: boolean): void {
	if (!isWebOS()) return;
	root.setAmbientShowing(on).catch(() => undefined);
}

/** Starts the TV's screensaver now. */
export function startScreensaver (): Promise<void> {
	return root.startScreensaver();
}
