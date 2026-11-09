// The player's rules that need no screen (docs/plans/player.md), checked by a node script: which subtitles show by themselves, reading a
// WebVTT file, and when the next-episode card and the next episode come.
import {readCache, writeCache} from './boot';
import type {SubTrack} from './player';

const FRENCH = ['fre', 'fra', 'fr'];
const ENGLISH = ['eng', 'en'];
const SAVED_KEY = 'player-subs';

/** The subtitles to show: a choice made for the series wins (a track index, or 'off'); otherwise English on anything not in French
 *  (an unknown language counts as not French), and none on French. */
export function pickSubtitle (tracks: SubTrack[], audioLang: string | undefined, saved: number | 'off' | undefined): SubTrack | null {
	if (saved === 'off') return null;
	if (saved !== undefined) {
		const chosen = tracks.filter((x) => x.index === saved)[0];
		if (chosen) return chosen;
	}
	if (audioLang && FRENCH.indexOf(audioLang.toLowerCase()) >= 0) return null;
	const english = tracks.filter((x) => ENGLISH.indexOf((x.lang || '').toLowerCase()) >= 0);
	return english.filter((x) => x.isDefault)[0] || english[0] || null;
}

export function savedSubtitle (seriesId: string): number | 'off' | undefined {
	const all = readCache<Record<string, number | 'off'>>(SAVED_KEY) || {};
	return all[seriesId];
}

export function saveSubtitle (seriesId: string, choice: number | 'off'): void {
	const all = readCache<Record<string, number | 'off'>>(SAVED_KEY) || {};
	all[seriesId] = choice;
	writeCache(SAVED_KEY, all);
}

export interface Cue { start: number; end: number; text: string }

/** "01:02:03.500" or "02:03.500" in seconds. */
function seconds (stamp: string): number {
	const parts = stamp.trim().split(':').map(Number);
	return parts.reduce((total, p) => total * 60 + p, 0);
}

/** The cues of a WebVTT file, tags (<i>, <b>…) removed. */
export function parseVtt (text: string): Cue[] {
	const cues: Cue[] = [];
	text.replace(/\r/g, '').split(/\n\n+/).forEach((block) => {
		const lines = block.split('\n');
		const at = lines.findIndex((l) => l.indexOf('-->') >= 0);
		if (at < 0) return;
		const [from, rest] = lines[at].split('-->');
		const to = rest.trim().split(/\s+/)[0];
		const body = lines.slice(at + 1).join('\n').replace(/<[^>]+>/g, '').trim();
		if (body) cues.push({start: seconds(from), end: seconds(to), text: body});
	});
	return cues;
}

/** The cue showing at `t` seconds, or ''. */
export function cueAt (cues: Cue[], t: number): string {
	for (const c of cues) if (t >= c.start && t < c.end) return c.text;
	return '';
}

/** a run of episodes played one after another with no key pressed stops here and asks "Still there?" */
export const STILL_THERE_AFTER = 3;
/** with no credits marker, the card shows this long before the end and the next episode starts at the end */
const CARD_BEFORE_END_S = 15;
/** with one, the next episode starts this long after the credits begin */
const AFTER_CREDITS_S = 8;

/** When the next-episode card shows and when the next episode starts, in seconds into this one. */
export function countdownStart (durationS: number, outroStartS: number | undefined): {cardAt: number; nextAt: number} {
	if (outroStartS !== undefined && outroStartS > 0 && outroStartS < durationS) return {cardAt: outroStartS, nextAt: Math.min(durationS, outroStartS + AFTER_CREDITS_S)};
	return {cardAt: Math.max(0, durationS - CARD_BEFORE_END_S), nextAt: durationS};
}

const OFFSET_KEY = 'player-sub-offset';
/** A file's subtitle timing in seconds (positive: earlier), 0 when never set. */
export function subOffset (itemId: string): number {
	const all = readCache<Record<string, number>>(OFFSET_KEY) || {};
	return all[itemId] || 0;
}
export function saveSubOffset (itemId: string, seconds: number): void {
	const all = readCache<Record<string, number>>(OFFSET_KEY) || {};
	if (seconds) all[itemId] = seconds; else delete all[itemId];
	writeCache(OFFSET_KEY, all);
}
