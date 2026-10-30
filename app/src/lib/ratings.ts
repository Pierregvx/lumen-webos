// Ratings out of 10 for what was just finished: a film, or a series once its last episode in the library is watched. Lumen asks when it
// comes back to the front; the ratings join the taste profile Claude reads for the For you row (lib/recos.ts). Kept in localStorage.
import {readCache, writeCache} from './boot';
import {item, justFinished, type JellyfinServer, type MediaItem} from './jellyfin';

export interface Rating { id: string; title: string; year?: number; type: 'Movie' | 'Series'; score: number | null; day: string }

const RATINGS_KEY = 'ratings-v1';
/** when finished titles were last looked for: only what is finished after it is asked about */
const SINCE_KEY = 'ratings-since';

export function ratings (): Rating[] { return readCache<Rating[]>(RATINGS_KEY) || []; }

/** titles found finished and not asked about yet: one is asked at a time, the rest wait their turn */
const QUEUE_KEY = 'ratings-queue';
const queue = (): MediaItem[] => readCache<MediaItem[]>(QUEUE_KEY) || [];

/** Keeps a rating (null: skipped, so it is not asked again) and takes the title off the queue. False when the TV did not keep it. */
export function rate (it: MediaItem, score: number | null): boolean {
	const type = it.type === 'Movie' ? 'Movie' : 'Series';
	const kept = ratings().filter((r) => r.id !== it.id).concat({id: it.id, title: it.title, year: it.year, type, score, day: new Date().toISOString().slice(0, 10)});
	writeCache(RATINGS_KEY, kept);
	writeCache(QUEUE_KEY, queue().filter((q) => q.id !== it.id));
	return ratings().some((r) => r.id === it.id);
}

/** The ratings as lines for Claude, the latest first. */
export function ratingsText (): string {
	return ratings().filter((r) => r.score !== null).reverse()
		.map((r) => `- ${r.title}${r.year ? ` (${r.year})` : ''}: ${r.score}/10 (${r.type === 'Movie' ? 'film' : 'series'}, rated ${r.day})`).join('\n');
}

/** The next title to ask a rating for. Each look adds to the queue every film finished, and every series now watched to the end, since the
 *  last look; the clock is the newest watch date the server reported, so the TV's clock and the server's need not agree. The first look only
 *  starts the clock. */
export function toRate (s: JellyfinServer): Promise<MediaItem | null> {
	const since = readCache<string>(SINCE_KEY);
	const done: Record<string, true> = {};
	ratings().forEach((r) => { done[r.id] = true; });
	queue().forEach((q) => { done[q.id] = true; });
	return justFinished(s).then((list) => {
		const at = (it: MediaItem) => Date.parse(it.lastPlayed || '') || 0;
		const newest = list.reduce((m, it) => Math.max(m, at(it)), 0);
		if (!since) { writeCache(SINCE_KEY, new Date(newest || Date.now()).toISOString()); return []; }
		const from = Date.parse(since) || 0;
		if (newest > from) writeCache(SINCE_KEY, new Date(newest).toISOString());
		const fresh = list.filter((it) => at(it) > from);
		const films = fresh.filter((it) => it.type === 'Movie' && !done[it.id]);
		const ids: string[] = [];
		fresh.forEach((it) => { if (it.type === 'Episode' && it.seriesId && !done[it.seriesId] && ids.indexOf(it.seriesId) === -1) ids.push(it.seriesId); });
		return Promise.all(ids.slice(0, 4).map((id) => item(s, id).catch(() => null)))
			.then((series) => films.concat(series.filter((x): x is MediaItem => !!x && x.unplayed === 0)));
	}, () => [] as MediaItem[]).then((found) => {
		if (found.length) writeCache(QUEUE_KEY, queue().concat(found));
		return queue()[0] || null;
	});
}
