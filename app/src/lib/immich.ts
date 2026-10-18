// Your own photos from an Immich server on the home network, as a wallpaper source. Set up by putting the server's address and a read-only
// API key in /var/lib/homehook/immich.json on the TV (see docs/immich.md); the key never has to be typed with the remote.
//
// Immich sends no CORS headers outside its dev mode, so every API call goes through curl on the TV (lib/root.ts). The picture itself is an
// ordinary <img>/background URL with the key as a query parameter, which needs no CORS. The blurred copies the glass and the lower rows show
// are made here, once per picture, from Immich's small thumbnail (fetched as base64, so the canvas is never tainted).

import {readFile, immichRequest} from './root';
import {readCache, writeCache} from './boot';

export interface ImmichServer { url: string; key: string }

/** The choices offered in Settings > Wallpaper > Choose wallpaper > Photos. */
export const IMMICH_SOURCES: {key: string; title: string}[] = [
	{key: 'immich:recent', title: 'Recent (last 90 days)'},
	{key: 'immich:recent-people', title: 'Recent, with people'},
	{key: 'immich:memories', title: 'On this day'},
	{key: 'immich:favorites', title: 'Favourites'},
	{key: 'immich:all', title: 'All my photos'}
];
const RECENT_DAYS = 90;

const SERVER_KEY = 'lumen-immich-server-v1';
const POOL_KEY = 'lumen-immich-pool-v1';
const SHOWN_MAX = 40;      // pictures remembered as recently shown, so a shuffle does not repeat them

/** The server as last read from the TV (kept in localStorage so a cold start needs no root call to build the picture URL). */
export function cachedServer (): ImmichServer | null { return readCache<ImmichServer>(SERVER_KEY); }

/** Reads /var/lib/homehook/immich.json ({"url": "http://192.168.1.10:2283", "key": "..."}). Resolves null when it is missing or wrong. */
export function loadServer (): Promise<ImmichServer | null> {
	return readFile('immich.json').then((text) => {
		if (!text.trim()) { writeCache(SERVER_KEY, null); return null; }
		const j = JSON.parse(text) as {url?: string; key?: string};
		const url = String(j.url || '').trim().replace(/\/+$/, '').replace(/\/api$/, '');
		const server = j.key ? {url, key: String(j.key).trim()} : null;
		writeCache(SERVER_KEY, server);
		return server;
	}).catch(() => cachedServer());
}

export function albums (server: ImmichServer): Promise<{id: string; title: string}[]> {
	return immichRequest(server.url, server.key, '/api/albums').then((text) => {
		const list = JSON.parse(text) as {id: string; albumName: string; assetCount?: number}[];
		return list.filter((a) => (a.assetCount || 0) > 0).map((a) => ({id: a.id, title: a.albumName}));
	});
}

interface Asset {
	id: string;
	type?: string;
	width?: number | null;
	height?: number | null;
	/** the people Immich found in the picture, named or not; present only when asked for with withPeople */
	people?: unknown[] | null;
	/** when it was taken, in the place it was taken */
	localDateTime?: string | null;
	fileCreatedAt?: string | null;
	exifInfo?: {exifImageWidth?: number | null; exifImageHeight?: number | null; orientation?: string | null; make?: string | null} | null;
}

/** Width over height as the picture is seen, or 0 when Immich does not know. */
function ratio (a: Asset): number {
	let w = a.width || (a.exifInfo && a.exifInfo.exifImageWidth) || 0;
	let h = a.height || (a.exifInfo && a.exifInfo.exifImageHeight) || 0;
	const o = a.exifInfo && a.exifInfo.orientation;
	if (!a.width && (o === '6' || o === '8' || o === '5' || o === '7')) { const t = w; w = h; h = t; }   // rotated by EXIF
	return w && h ? w / h : 0;
}

/** Joins the two portrait photos shown side by side as one picture ('<id>+<id>'). Immich ids are UUIDs, so never hold it. */
const PAIR = '+';

/** The Immich photos in a picture: one, or two for a portrait pair. */
export function pictureIds (pic: string): string[] { return pic.split(PAIR); }

function day (a: Asset): string { return (a.localDateTime || a.fileCreatedAt || '').slice(0, 10); }

/** Landscape photos as they are (unknown sizes too), portrait ones in pairs taken on different days so a pair is never two shots of one
 *  moment. Square-ish ones are left out: cropped to the screen or to half of it, they lose too much. */
function arrange (list: Asset[]): string[] {
	const out: string[] = [];
	const tall: Asset[] = [];
	list.forEach((a) => {
		const r = ratio(a);
		if (!r || r >= 1.2) out.push(a.id);
		else if (r <= 1 / 1.2) tall.push(a);
	});
	while (tall.length > 1) {
		const a = tall.shift() as Asset;
		const d = day(a);
		const i = tall.findIndex((b) => !d || day(b) !== d);
		if (i !== -1) out.push(a.id + PAIR + tall.splice(i, 1)[0].id);
	}
	for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = out[i]; out[i] = out[j]; out[j] = t; }
	return out;
}

/** Looks like a camera photo: screenshots and saved images carry no camera make. Only applied to the broad sources (Recent, All). */
function camera (a: Asset): boolean { return !!(a.exifInfo && a.exifInfo.make); }

function today (): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** A batch of candidate pictures for a source, already filtered. */
function search (server: ImmichServer, sel: string): Promise<string[]> {
	const keep = (list: Asset[], broad: boolean) => arrange(list.filter((a) => (!a.type || a.type === 'IMAGE') && (!broad || camera(a))));
	const random = (body: object, broad: boolean) =>
		immichRequest(server.url, server.key, '/api/search/random', {body: {type: 'IMAGE', withExif: true, size: 40, ...body}})
			.then((text) => keep(JSON.parse(text) as Asset[], broad));
	if (sel === 'immich:memories') {
		return immichRequest(server.url, server.key, `/api/memories?for=${today()}`).then((text) => {
			const memories = JSON.parse(text) as {assets?: Asset[]}[];
			const ids = keep(memories.reduce((all, m) => all.concat(m.assets || []), [] as Asset[]), false);
			return ids.length > 0 ? ids : random({takenAfter: new Date(Date.now() - RECENT_DAYS * 864e5).toISOString()}, true);   // no memories today
		});
	}
	if (sel === 'immich:favorites') return random({isFavorite: true}, false);
	if (sel === 'immich:recent') return random({takenAfter: new Date(Date.now() - RECENT_DAYS * 864e5).toISOString()}, true);
	if (sel === 'immich:recent-people') {
		// a bigger batch, since only some have people in them; if none do (or the server leaves people out) it falls back to plain Recent
		const body = {type: 'IMAGE', withExif: true, withPeople: true, size: 120, takenAfter: new Date(Date.now() - RECENT_DAYS * 864e5).toISOString()};
		return immichRequest(server.url, server.key, '/api/search/random', {body}).then((text) => {
			const list = (JSON.parse(text) as Asset[]).filter((a) => !!a.people && a.people.length > 0);
			const ids = keep(list, true);
			return ids.length > 0 ? ids : search(server, 'immich:recent');
		});
	}
	if (sel.indexOf('immich:album:') === 0) return random({albumIds: [sel.slice(13)]}, false);
	return random({}, true);
}

interface Pool { sel: string; ids: string[]; shown: string[] }

/** The next picture for a source: from the pool left by the last search, searching again when it runs dry. Skips recently shown ones. */
export function nextAsset (server: ImmichServer, sel: string, avoid: string): Promise<string | null> {
	const saved = readCache<Pool>(POOL_KEY);
	const pool: Pool = saved && saved.sel === sel ? saved : {sel, ids: [], shown: []};
	// shown and avoid are kept per photo, since the same portrait can turn up in a different pair after the next search
	const avoided = pictureIds(avoid);
	const fresh = (pic: string, seen: string[]) => !pictureIds(pic).some((x) => avoided.indexOf(x) !== -1 || seen.indexOf(x) !== -1);
	const take = (): string | null => {
		while (pool.ids.length > 0) {
			const id = pool.ids.shift() as string;
			if (fresh(id, pool.shown)) return id;
		}
		return null;
	};
	const done = (id: string | null) => {
		if (id) pool.shown = pictureIds(id).concat(pool.shown).slice(0, SHOWN_MAX);
		writeCache(POOL_KEY, pool);
		return id;
	};
	const first = take();
	if (first) return Promise.resolve(done(first));
	return search(server, sel).then((ids) => {
		pool.ids = ids.slice();
		let id = take();
		if (!id && ids.length > 0) { pool.shown = []; pool.ids = ids.filter((x) => fresh(x, [])); id = take(); }   // everything seen: start over
		return done(id);
	});
}

/** The picture itself, 1440 px on its long side by default in Immich: plenty for the TV, and quick to load on the home network. */
export function previewUrl (server: ImmichServer, id: string): string {
	return `${server.url}/api/assets/${id}/thumbnail?size=preview&apiKey=${encodeURIComponent(server.key)}`;
}

/** The pictures to show for a pick from nextAsset: one URL, or two for a portrait pair (left, then right). */
export function previewUrls (server: ImmichServer, pic: string): string[] { return pictureIds(pic).map((id) => previewUrl(server, id)); }

/** The two blurred copies (light for the glass, strong for the lower rows and the cold-start backdrop), as data: URLs, made from the small
 *  thumbnails: blurred once on a canvas here, never per frame. A portrait pair is blurred side by side, as it is shown. */
export function blurredCopies (server: ImmichServer, pic: string): Promise<{light: string; strong: string}> {
	return Promise.all(pictureIds(pic).map((id) => thumbnail(server, id))).then((imgs) => ({light: blur(imgs, 960, 540, 6, 0.8), strong: blur(imgs, 480, 270, 14, 0.7)}));
}

function thumbnail (server: ImmichServer, id: string): Promise<HTMLImageElement> {
	return immichRequest(server.url, server.key, `/api/assets/${id}/thumbnail?size=thumbnail`, {as: 'base64'}).then((b64) => {
		const data = b64.trim();
		if (!data) throw new Error('no thumbnail');
		const mime = data.indexOf('/9j/') === 0 ? 'image/jpeg' : data.indexOf('iVBOR') === 0 ? 'image/png' : 'image/webp';
		return new Promise<HTMLImageElement>((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve(img);
			img.onerror = () => reject(new Error('thumbnail did not decode'));
			img.src = `data:${mime};base64,${data}`;
		});
	});
}

function blur (imgs: HTMLImageElement[], w: number, h: number, radius: number, quality: number): string {
	const canvas = document.createElement('canvas');
	canvas.width = w; canvas.height = h;
	const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
	ctx.filter = `blur(${radius}px)`;
	const cw = w / imgs.length;
	imgs.forEach((img, i) => {
		// cover-crop each thumbnail to its column, drawn a little oversize so the blur does not pull in transparent edges
		const scale = Math.max(cw / img.naturalWidth, h / img.naturalHeight) * 1.08;
		const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
		ctx.save();
		ctx.beginPath();
		ctx.rect(i * cw, 0, cw, h);
		ctx.clip();
		ctx.drawImage(img, i * cw + (cw - dw) / 2, (h - dh) / 2, dw, dh);
		ctx.restore();
	});
	return canvas.toDataURL('image/jpeg', quality);
}
