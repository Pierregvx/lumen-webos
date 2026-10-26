// Cloud wallpapers kept on the TV (IndexedDB). webOS throws away the HTTP cache when an app ends, and the TV ends Lumen whenever another app
// opens, so without this every Home press downloads the picture again. The next launch's picture is fetched while Lumen is idle and stored
// here under its full-size URL, with its blurred copy. Any failure (no IndexedDB, quota, network) just means the network is used, as before.

export interface Pics {
	/** the picture, 1920 wide */
	full: Blob;
	/** the strong blur behind the lower rows, Settings and the Guide (--wp-bg) */
	strong: Blob;
}

const DB = 'lumen-wallpaper';
const STORE = 'pics';

let opening: Promise<IDBDatabase> | null = null;
function open (): Promise<IDBDatabase> {
	if (opening) return opening;
	opening = new Promise<IDBDatabase>((resolve, reject) => {
		if (typeof indexedDB === 'undefined') { reject(new Error('no IndexedDB')); return; }
		const req = indexedDB.open(DB, 1);
		req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
	opening.catch(() => { opening = null; });
	return opening;
}

function run<T> (mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
	return open().then((db) => new Promise<T | undefined>((resolve, reject) => {
		const tx = db.transaction(STORE, mode);
		const req = work(tx.objectStore(STORE));
		tx.oncomplete = () => resolve(req ? req.result : undefined);
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error);
	}));
}

export function getPics (key: string): Promise<Pics | null> {
	return run<Pics>('readonly', (s) => s.get(key)).then((v) => v || null, () => null);
}

export function putPics (key: string, pics: Pics): Promise<void> {
	return run('readwrite', (s) => { s.put(pics, key); }).then(() => undefined);
}

/** Deletes every stored picture except these. */
export function keepOnly (keys: string[]): Promise<void> {
	return run<IDBValidKey[]>('readonly', (s) => s.getAllKeys())
		.then((all) => run('readwrite', (s) => { (all || []).forEach((k) => { if (keys.indexOf(String(k)) === -1) s.delete(k); }); }))
		.then(() => undefined, () => undefined);
}

/** Fetches a URL as a Blob (the resizer answers with Access-Control-Allow-Origin: *). */
export function fetchBlob (url: string): Promise<Blob> {
	return fetch(url).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.blob(); });
}

export function blobToDataUrl (blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});
}
