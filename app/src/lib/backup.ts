// The settings backup on the TV, /var/lib/homehook/lumen-config.json. Settings live in localStorage, which is per app id, so the dev build,
// the stable build and every reinstall start empty. The backup is written after each change and read on a fresh install, so they all share it.

import {isWebOS} from './luna';
import {readFile, writeFile} from './root';
import {parseConfig, type UserConfig} from './storage';

const FILE = 'lumen-config.json';
const DELAY_MS = 3000;
let timer = 0;

/** Write the backup a few seconds after the last change (changes come in bursts while re-ordering). */
export function scheduleBackup (config: UserConfig): void {
	if (!isWebOS()) return;
	window.clearTimeout(timer);
	timer = window.setTimeout(() => { writeFile(FILE, JSON.stringify({version: 1, config}, null, 1)).catch(() => undefined); }, DELAY_MS);
}

/** The backed-up settings, or null when there is no backup (or it cannot be read). */
export function readBackup (): Promise<UserConfig | null> {
	if (!isWebOS()) return Promise.resolve(null);
	return readFile(FILE).then((text) => {
		if (!text) return null;
		const data = JSON.parse(text) as {config?: unknown};
		return data && data.config ? parseConfig(JSON.stringify(data.config)) : null;
	}).catch(() => null);
}
