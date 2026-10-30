// AI picks for Films & series > Discover (docs/plans/films-series.md, step 2). Claude reads the taste profile typed in Settings, what was
// watched in Jellyfin, and a list of candidates from Seerr (trending, popular, and titles like the ones watched lately), and picks about ten
// of the candidates with one line on why. It only ever picks from the list, so every pick exists and can be requested. Asked at most once a
// day; the answer is kept in localStorage. The API key is the user's own, called straight from the TV (dangerouslyAllowBrowser).
import Anthropic from '@anthropic-ai/sdk';
import {zodOutputFormat} from '@anthropic-ai/sdk/helpers/zod';
import {z} from 'zod';
import {readCache, writeCache} from './boot';
import {watched, type JellyfinServer} from './jellyfin';
import {discover, similar, type SeerrServer, type SeerrTitle} from './seerr';
import {ratingsText} from './ratings';

export interface RecoSettings { key: string; profile: string }
export interface AiPick { title: SeerrTitle; reason: string }

const SETTINGS_KEY = 'recos-settings';
const CACHE_KEY = 'recos-v1';
const MODEL = 'claude-opus-5-5';
/** titles watched lately whose look-alikes join the candidates */
const SEEDS = 6;
const CANDIDATES_MAX = 160;
const PICKS = 10;
/** one request at a time: a second ask while it runs gets the same answer */
let pending: Promise<AiPick[]> | null = null;
/** after a failure, Claude is not asked again for this long (each ask costs a request on the user's key) */
const RETRY_AFTER_MS = 10 * 60000;
let failed: {at: number; message: string} | null = null;

export function recoSettings (): RecoSettings { return readCache<RecoSettings>(SETTINGS_KEY) || {key: '', profile: ''}; }
export function saveRecoSettings (r: RecoSettings): void { writeCache(SETTINGS_KEY, r); writeCache(CACHE_KEY, null); failed = null; }

const today = () => new Date().toISOString().slice(0, 10);
const keyOf = (t: Pick<SeerrTitle, 'type' | 'tmdbId'>) => t.type + ':' + t.tmdbId;

/** Today's picks if they were already worked out. */
export function cachedPicks (): AiPick[] | null {
	const c = readCache<{day: string; picks: AiPick[]}>(CACHE_KEY);
	return c && c.day === today() ? c.picks : null;
}

const Answer = z.object({
	picks: z.array(z.object({
		id: z.string().describe('a candidate id exactly as listed, such as tv:1399 or movie:603'),
		reason: z.string().describe('one short sentence on why this person would like it, citing titles they rated or watched')
	}))
});

const SYSTEM = `You pick films and series for one person to watch next on their TV.
You get their own taste profile (ratings, favourites, what they dropped, genres they like and dislike), what they watched lately, and a list of candidates.
Pick ${PICKS} candidates, best first. Only pick from the candidate list, using its ids exactly. Skip anything they already watched or rated.
Mix series and films when the profile allows. Favour what matches their highest ratings and liked genres; avoid genres they rate low and shows like the ones they dropped.
Each reason is one short sentence in the language the profile is written in, naming one or two titles from their profile it connects to.`;

/** The candidates: Seerr's trending, popular films and series, and titles like the ones watched lately, minus what is in the library or requested. */
function candidates (sr: SeerrServer, seeds: SeerrTitle[]): Promise<SeerrTitle[]> {
	const lists = [discover(sr, 'trending'), discover(sr, 'trending', 2), discover(sr, 'popular'), discover(sr, 'series'), discover(sr, 'series', 2)]
		.concat(seeds.map((t) => similar(sr, t)));
	return Promise.all(lists.map((p) => p.catch(() => [] as SeerrTitle[]))).then((all) => {
		const seen: Record<string, true> = {};
		const out: SeerrTitle[] = [];
		all.forEach((list) => list.forEach((t) => {
			const k = keyOf(t);
			if (seen[k] || t.availability !== 'none' || !t.title) return;
			seen[k] = true;
			out.push(t);
		}));
		return out.slice(0, CANDIDATES_MAX);
	});
}

/** A pick was requested: today's cache says so too, so a reopen does not offer Request again. */
export function markPickRequested (type: 'movie' | 'tv', tmdbId: string): void {
	const c = readCache<{day: string; picks: AiPick[]}>(CACHE_KEY);
	if (!c) return;
	writeCache(CACHE_KEY, {...c, picks: c.picks.map((p) => (p.title.type === type && p.title.tmdbId === tmdbId ? {...p, title: {...p.title, availability: 'requested'}} : p))});
}

/** Works out today's picks (or returns them from the cache). Rejects with a message to show when it cannot. */
export function picks (s: JellyfinServer, sr: SeerrServer, force = false): Promise<AiPick[]> {
	const cached = cachedPicks();
	if (cached && !force) return Promise.resolve(cached);
	if (pending) return pending;
	if (failed && !force && Date.now() - failed.at < RETRY_AFTER_MS) return Promise.reject(new Error(failed.message));
	pending = ask(s, sr).then((p) => { pending = null; failed = null; return p; }, (e: Error) => {
		pending = null;
		failed = {at: Date.now(), message: e.message};
		throw e;
	});
	return pending;
}

function ask (s: JellyfinServer, sr: SeerrServer): Promise<AiPick[]> {
	const set = recoSettings();
	if (!set.key) return Promise.reject(new Error('Add your Claude API key in Settings > Films & series'));

	return watched(s).catch(() => []).then((seen) => {
		const seeds: SeerrTitle[] = seen.filter((it) => it.tmdbId).slice(0, SEEDS)
			.map((it) => ({tmdbId: it.tmdbId as string, type: it.type === 'Movie' ? 'movie' : 'tv', title: it.title, availability: 'available'}));
		return candidates(sr, seeds).then((list) => {
			if (!list.length) throw new Error('Seerr is not answering');
			const byKey: Record<string, SeerrTitle> = {};
			list.forEach((t) => { byKey[keyOf(t)] = t; });
			const lines = list.map((t) => `${keyOf(t)} | ${t.title}${t.year ? ` (${t.year})` : ''} | ${(t.overview || '').slice(0, 140)}`);
			const history = seen.map((it) => `${it.title}${it.year ? ` (${it.year})` : ''}`).join(', ');
			// one try more at most, a minute each: a stalled network must not leave Discover waiting for half an hour
			const client = new Anthropic({apiKey: set.key, dangerouslyAllowBrowser: true, timeout: 60000, maxRetries: 1});
			return client.beta.messages.parse({
				model: MODEL,
				max_tokens: 16000,
				betas: ['server-side-fallback-2026-07-01'],
				fallbacks: 'default',
				output_config: {effort: 'medium', format: zodOutputFormat(Answer)},
				system: SYSTEM,
				messages: [{
					role: 'user',
					content: `Taste profile:\n${set.profile || '(none given)'}\n\nRated on the TV after watching (newest first, these count more than the profile):\n${ratingsText() || '(none yet)'}\n\nWatched lately in their library:\n${history || '(nothing yet)'}\n\nCandidates (id | title | summary):\n${lines.join('\n')}`
				}]
			}).then((r) => {
				if (r.stop_reason === 'refusal' || !r.parsed_output) throw new Error('Claude gave no picks today');
				const once: Record<string, true> = {};
				const out: AiPick[] = r.parsed_output.picks.filter((p) => { if (!byKey[p.id] || once[p.id]) return false; once[p.id] = true; return true; })
					.slice(0, PICKS).map((p) => ({title: byKey[p.id], reason: p.reason}));
				if (!out.length) throw new Error('Claude gave no picks today');
				writeCache(CACHE_KEY, {day: today(), picks: out});
				return out;
			}, (e: unknown) => {
				// no credit left or a feature not on the account comes back as a 400 / 403: its own message says which
				if (e instanceof Anthropic.AuthenticationError) throw new Error('Claude refused the API key');
				if (e instanceof Anthropic.RateLimitError) throw new Error('Claude is busy, try again later');
				if (e instanceof Anthropic.BadRequestError || e instanceof Anthropic.PermissionDeniedError) throw new Error('Claude: ' + String(e.message).slice(0, 140));
				throw new Error('Claude did not answer');
			});
		});
	});
}
