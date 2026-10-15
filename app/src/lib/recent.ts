// The Recent row. Lumen only sees the apps opened from Lumen; tools/tv/watch.sh sees every app that comes to the front and keeps the last eight
// in /var/lib/homehook/recent. Its list goes first, then Lumen's own for anything the TV list does not have (or all of it when watch.sh is not running).

import {isWebOS} from './luna';
import {readFile} from './root';

const ID = /^[A-Za-z0-9._-]+$/;

/** The app ids watch.sh recorded, newest first; [] when there is no file or no root. */
export function readTvRecent (): Promise<string[]> {
	if (!isWebOS()) return Promise.resolve([]);
	return readFile('recent').then((text) => text.split('\n').map((l) => l.trim()).filter((l) => ID.test(l))).catch(() => []);
}

export function mergeRecent (tv: string[], own: string[], max: number): string[] {
	const out: string[] = [];
	tv.concat(own).forEach((id) => { if (out.indexOf(id) === -1) out.push(id); });
	return out.slice(0, max);
}
