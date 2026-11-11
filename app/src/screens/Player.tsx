// The player (docs/plans/player.md): a full-screen video over whatever screen started it, which stays mounted underneath so Back returns
// to the same tab, row and tile. The page goes transparent while it plays (html.playing): the picture is on the TV's video plane behind it.
// Nothing shows while it plays; a key brings up the bar (title, progress, Pause, Subtitles) for 4 s. Left/Right jump 10 s (held: 30 s),
// added up in a pill and applied a moment after the last press; OK pauses; Down reaches the buttons; Back leaves. Episodes (a series) opens
// the series' episodes over the picture, season by season, to play another one. Jellyfin hears about the playback (start, every 10 s,
// pauses, jumps, stop) so Resume and its own apps keep the place.
// The Magic Remote's pointer works too: moving it shows the bar, hovering moves the focus, a click does what OK does on it, a click on the
// progress line goes to that place, a click on the picture pauses, and the wheel scrolls the episode list.
import {useCallback, useEffect, useRef, useState} from 'preact/hooks';
import {t as tr} from '../lib/i18n';
import {useKeys, clamp, type NavKey} from '../hooks/useKeys';
import {useOkPress} from '../hooks/useOkPress';
import {useRealPointer} from '../hooks/useRealPointer';
import {releaseVideo, setVideoPaused} from '../lib/wallpaperVideo';
import {imageUrl} from '../lib/jellyfin';
import {episodeAfter, openStream, reportProgress, reportStart, reportStopped, type Stream, type SubTrack} from '../lib/player';
import {countdownStart, cueAt, parseVtt, pickSubtitle, savedSubtitle, saveSubtitle, saveSubOffset, STILL_THERE_AFTER, subOffset, type Cue} from '../lib/playerLogic';
import {loggedFetch} from '../lib/log';
import {episodesOf, nextEpisode, type JellyfinServer, type MediaItem} from '../lib/jellyfin';
import {prepLabel, prepOf, usePrepared} from '../lib/prepared';
import {choiceStore} from '../plugins';

interface Props {
	server: JellyfinServer;
	item: MediaItem;
	active: boolean;
	onClose: () => void;
	/** the file would not play here: hand it to the Jellyfin app */
	onFallback: (item: MediaItem) => void;
	onToast: (text: string, kind?: 'info' | 'error') => void;
}

const BAR_MS = 4000;
const JUMP_S = 10;
const HELD_JUMP_S = 30;
/** jumps are added up and applied this long after the last press */
const JUMP_AFTER_MS = 400;
const REPORT_EVERY_MS = 10000;
/** nothing playing this long after the stream was set: Jellyfin's app takes over */
const START_LIMIT_MS = 10000;
/** waiting for data this long once playing: Jellyfin's app takes over */
const STALL_LIMIT_MS = 15000;
/** a subtitle timing step (Left/Right on the timing row of the subtitle menu) */
const SUB_STEP_S = 0.25;
/** a click and an OK this close together are one press: with the pointer showing, the TV may send both for one press of OK */
const SAME_PRESS_MS = 400;
/** the wheel scrolls the episode list one card per notch, at most this often */
const WHEEL_MS = 120;
/** the remote's own play, pause, fast-forward and rewind keys */
const MEDIA_KEY = {play: 415, pause: 19, forward: 417, rewind: 412} as const;
/** an episode card's width and gap, and the cards the focused one may sit from the left before the row scrolls (keep in step with theme/player.css) */
const EP_STEP = 400 + 32;
const EP_COL = 1;
/** episode cards that fit across the screen */
const EP_SHOWN = 4;

type Button = 'pause' | 'subs' | 'episodes' | 'next';
/** the episode list: which row has the focus, the season shown, the episode focused in it and the first card shown (the keys and the wheel
 *  scroll the row; the pointer only moves the focus, so the card under it stays put) */
interface Picker { row: 'seasons' | 'episodes'; season: number; at: number; first: number }
/** the first card shown, so the focused one sits EP_COL cards from the left */
const firstFor = (at: number, count: number) => Math.max(0, Math.min(at - EP_COL, count - EP_SHOWN));

const clock = (s: number) => {
	const t = Math.max(0, Math.floor(s));
	const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
	return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(sec).padStart(2, '0');
};

export function Player ({server, item, active, onClose, onFallback, onToast}: Props) {
	const video = useRef<HTMLVideoElement>(null);
	const [stream, setStream] = useState<Stream | null>(null);
	/** what was asked for; the next episode replaces it */
	const [current, setCurrent] = useState<MediaItem>(item);
	/** what is playing: the item, or for a series its episode in progress or next */
	const [now, setNow] = useState<MediaItem | null>(null);
	const [time, setTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [paused, setPaused] = useState(false);
	const [bar, setBar] = useState(true);
	const [zone, setZone] = useState<'none' | 'buttons'>('none');
	/** the pointer is over the bar: it stays up */
	const [overBar, setOverBar] = useState(false);
	const [button, setButton] = useState(0);
	const [jump, setJump] = useState(0);
	const [menu, setMenu] = useState<number | null>(null);
	/** the episode list, while it is open */
	const [picker, setPicker] = useState<Picker | null>(null);
	const [started, setStarted] = useState(false);
	const failed = useRef(false);

	// the page goes transparent and the wallpaper video lets go while the player is up
	useEffect(() => {
		document.documentElement.classList.add('playing');
		setVideoPaused(true);
		releaseVideo();
		return () => { document.documentElement.classList.remove('playing'); setVideoPaused(false); };
	}, []);

	const fallBack = useCallback((it: MediaItem) => {
		if (failed.current) return;
		failed.current = true;
		onToast(tr('Couldn\'t play it here: opening Jellyfin'), 'error');
		// a file that stopped part-way goes on in Jellyfin from where it got to
		onFallback(lastTicks.current > 0 ? {...it, resumeTicks: lastTicks.current} : it);
	}, [onFallback, onToast]);

	useEffect(() => {
		let live = true;
		setStream(null);
		setStarted(false);
		setTime(0);
		setDuration(0);
		setLine('');
		const target = current.type === 'Series' ? nextEpisode(server, current.id) : Promise.resolve(current);
		target.then((it) => {
			if (!it) throw new Error('Nothing to play');
			if (live) setNow(it);
			return openStream(server, it);
		}).then((st) => { if (live) setStream(st); }, () => { if (live) fallBack(current); });
		return () => { live = false; };
	}, [current.id]);

	// ----- the series' episodes (read again for each episode, so what was watched shows), the next one, and the card before it -----
	const [episodes, setEpisodes] = useState<MediaItem[]>([]);
	useEffect(() => {
		if (!now || now.type !== 'Episode' || !now.seriesId) { setEpisodes([]); return undefined; }
		let live = true;
		episodesOf(server, now.seriesId).then((list) => { if (live) setEpisodes(list); }, () => { if (live) setEpisodes([]); });
		return () => { live = false; };
	}, [now && now.id]);
	const nextEp = now ? episodeAfter(episodes, now) : null;
	/** the card was put away (Cancel or Back): this episode plays out and the player closes */
	const [cancelled, setCancelled] = useState(false);
	/** episodes started one after another with no key pressed */
	const chain = useRef(0);
	const [cardButton, setCardButton] = useState(0);
	const goNext = () => {
		if (!nextEp) return;
		// the episode ending is reported as stopped now, at its position: once the stream changes the video is gone
		if (stream) stopReport(stream);
		setCancelled(false); setCardButton(0);
		setCurrent({...nextEp, resumeTicks: 0});
	};

	// a stream that never starts hands over to Jellyfin's app
	useEffect(() => {
		if (!stream || started) return undefined;
		const timer = window.setTimeout(() => { if (now) fallBack(now); }, START_LIMIT_MS);
		return () => window.clearTimeout(timer);
	}, [stream, started]);

	// ----- Jellyfin hears about it -----
	/** the last position seen while playing: when the player closes the video may already be emptied, so Stopped reports this */
	const lastTicks = useRef(0);
	const pos = () => {
		const v = video.current;
		if (v && v.currentTime > 0) lastTicks.current = v.currentTime * 1e7;
		return lastTicks.current;
	};
	const startedRef = useRef(false);
	startedRef.current = started;
	/** the stream Jellyfin was told started, and the one it was told stopped: Stopped goes out once, for a stream that started */
	const startedFor = useRef('');
	const stoppedFor = useRef('');
	function stopReport (st: Stream) {
		if (startedFor.current !== st.playSessionId || stoppedFor.current === st.playSessionId) return;
		stoppedFor.current = st.playSessionId;
		reportStopped(server, st, pos());
	}
	useEffect(() => {
		if (!stream) return undefined;
		const timer = window.setInterval(() => { if (startedRef.current && video.current) reportProgress(server, stream, pos(), video.current.paused); }, REPORT_EVERY_MS);
		return () => { window.clearInterval(timer); stopReport(stream); };
	}, [stream]);
	// the picture freezes after it started (server asleep, network gone): say so, then Jellyfin's app takes over from there
	const [stalled, setStalled] = useState(false);
	useEffect(() => {
		if (!stalled || !now) return undefined;
		const timer = window.setTimeout(() => fallBack(now), STALL_LIMIT_MS);
		return () => window.clearTimeout(timer);
	}, [stalled]);
	// the TV going to standby or another app in front: pause and say where it stopped
	useEffect(() => {
		const onVisibility = () => {
			const v = video.current;
			if (document.hidden && v && stream && startedRef.current) { v.pause(); reportProgress(server, stream, pos(), true); }
		};
		document.addEventListener('visibilitychange', onVisibility);
		return () => document.removeEventListener('visibilitychange', onVisibility);
	}, [stream]);

	// let go of the decoder when the player closes
	useEffect(() => () => { const v = video.current; if (v) { v.pause(); v.removeAttribute('src'); v.load(); } }, []);

	// ----- subtitles: the series' own choice, else English on anything not in French (lib/playerLogic.ts) -----
	const [sub, setSub] = useState<SubTrack | null>(null);
	const [cues, setCues] = useState<Cue[]>([]);
	const [line, setLine] = useState('');
	/** subtitle timing for this file: positive shows them earlier, negative later (kept per file) */
	const [offset, setOffset] = useState(0);
	// a plugin may keep the choice and the timing elsewhere (plugins/api.ts ChoiceStore): its answer replaces this TV's copy when it comes,
	// unless a subtitle was picked by hand meanwhile; this TV's copy is kept too, for when the plugin does not answer
	const [kept, setKept] = useState<{id: string; subtitle?: {index: number; lang?: string} | 'off'} | null>(null);
	const picked = useRef(false);
	useEffect(() => {
		setOffset(now ? subOffset(now.id) : 0);
		picked.current = false;
		const store = choiceStore();
		if (!now || !store) return undefined;
		let live = true;
		store.load(now.seriesId || now.id, now.id).then((c) => {
			if (!live || !c) return;
			if (typeof c.offset === 'number') { setOffset(c.offset); saveSubOffset(now.id, c.offset); }
			if (c.subtitle) setKept({id: now.id, subtitle: c.subtitle});
		}, () => undefined);
		return () => { live = false; store.flush(); };
	}, [now && now.id]);
	const shiftSubs = (by: number) => {
		const next = Math.round((offset + by) * 100) / 100;
		setOffset(next);
		if (now) { saveSubOffset(now.id, next); const store = choiceStore(); if (store) store.offset(now.id, next); }
	};
	useEffect(() => {
		if (!stream || !now) return;
		setSub(pickSubtitle(stream.subtitles, stream.audioLang, savedSubtitle(now.seriesId || now.id)));
	}, [stream]);
	useEffect(() => {
		if (!stream || !now || !kept || kept.id !== now.id || picked.current || !kept.subtitle) return;
		const c = kept.subtitle;
		if (c === 'off') { setSub(null); return; }
		// the same index when its language agrees, else a track in that language (another file may number its tracks differently)
		const same = stream.subtitles.filter((x) => x.index === c.index)[0];
		const lang = (c.lang || '').toLowerCase();
		const byLang = lang ? stream.subtitles.filter((x) => (x.lang || '').toLowerCase() === lang)[0] : undefined;
		const chosen = same && (!lang || !same.lang || same.lang.toLowerCase() === lang) ? same : byLang || same;
		if (chosen) setSub(chosen);
	}, [stream, kept]);
	useEffect(() => {
		setCues([]); setLine('');
		if (!sub) return undefined;
		let live = true;
		loggedFetch(sub.vttUrl).then((r) => r.text()).then((text) => { if (live) setCues(parseVtt(text)); }, () => undefined);
		return () => { live = false; };
	}, [sub && sub.vttUrl]);
	const chooseSub = (choice: SubTrack | null) => {
		setSub(choice);
		picked.current = true;
		if (now) {
			saveSubtitle(now.seriesId || now.id, choice ? choice.index : 'off');
			const store = choiceStore();
			if (store) store.subtitle(now.seriesId || now.id, choice ? {index: choice.index, lang: choice.lang} : null);
		}
		setMenu(null);
	};

	// ----- the bar: shown on any key, hidden 4 s after the last one (kept while paused, on the buttons or in the menu) -----
	const [poke, setPoke] = useState(0);
	const wake = (keepChain = false) => { setBar(true); setPoke((n) => n + 1); if (!keepChain) chain.current = 0; if (video.current) setTime(video.current.currentTime); };
	useEffect(() => {
		if (!bar || paused || zone === 'buttons' || overBar || menu !== null || picker) return undefined;
		const timer = window.setTimeout(() => setBar(false), BAR_MS);
		return () => window.clearTimeout(timer);
	}, [bar, poke, paused, zone, overBar, menu, picker]);

	// ----- the pointer: moving it is a key press for the bar; it hiding (an arrow pressed, or left still) lets go of the bar -----
	const realPointer = useRealPointer();
	/** what moved last, the pointer or a key: the pointer leaving the bar lets go of its buttons, but the pointer hiding as an arrow is
	 *  pressed (webOS hides it then) must not take the focus from the keys */
	const byPointer = useRef(false);
	/** the pointer is over the progress line: OK there is its click, not a press of the focused button */
	const overSeek = useRef(false);
	useEffect(() => {
		if (!active) return undefined;
		const move = () => { if (realPointer.current) { byPointer.current = true; wake(); } };
		// OK is pressed with the pointer too: only the other keys hand over to the keys
		const key = (e: KeyboardEvent) => { if (e.keyCode !== 13) byPointer.current = false; };
		const hidden = (e: Event) => {
			const d = (e as CustomEvent<{visibility?: boolean}>).detail;
			if (d && d.visibility === false) { setOverBar(false); overSeek.current = false; }
		};
		window.addEventListener('mousemove', move);
		window.addEventListener('keydown', key, true);
		document.addEventListener('cursorStateChange', hidden);
		return () => { window.removeEventListener('mousemove', move); window.removeEventListener('keydown', key, true); document.removeEventListener('cursorStateChange', hidden); };
	}, [active]);
	/** a hover handler: only a pointer that moved moves the focus, not one resting while the list slides under it */
	const hover = (fn: () => void) => () => { if (realPointer.current) fn(); };
	/** one press of OK, whether it came as a click or a key */
	const pressedAt = useRef(0);
	const once = (fn: () => void) => {
		const t = Date.now();
		if (t - pressedAt.current < SAME_PRESS_MS) return;
		pressedAt.current = t;
		fn();
	};
	const click = (fn: () => void) => (e: Event) => { e.stopPropagation(); wake(); once(fn); };

	// ----- jumps: added up, applied a moment after the last press, kept inside the video -----
	useEffect(() => {
		if (!jump) return undefined;
		const timer = window.setTimeout(() => {
			const v = video.current;
			if (v && stream) {
				v.currentTime = clamp(v.currentTime + jump, 0, Math.max(0, (v.duration || 0) - 1));
				if (v.currentTime < cd.cardAt) setCancelled(false);
				reportProgress(server, stream, pos(), v.paused);
			}
			setJump(0);
		}, JUMP_AFTER_MS);
		return () => window.clearTimeout(timer);
	}, [jump]);

	const togglePause = () => {
		const v = video.current;
		if (!v) return;
		if (v.paused) v.play().catch(() => undefined); else v.pause();
		wake();
	};

	// ----- the episode list: opened on the season and the episode playing -----
	usePrepared(!!picker);
	/** a season whose every episode is on the NAS's fast disk: its tab is marked */
	const quietSeason = (n: number) => { const eps = episodes.filter((e) => (e.season || 0) === n); return eps.length > 0 && eps.every((e) => { const p = prepOf(e.path); return !!p && p.state === 'ready'; }); };
	const seasons = episodes.reduce<number[]>((out, e) => (out.indexOf(e.season || 0) === -1 ? out.concat(e.season || 0) : out), []);
	const inSeason = picker ? episodes.filter((e) => (e.season || 0) === picker.season) : [];
	const openPicker = () => {
		const season = now && now.season || seasons[0] || 0;
		const at = episodes.filter((e) => (e.season || 0) === season).findIndex((e) => !!now && e.id === now.id);

		const list = episodes.filter((e) => (e.season || 0) === season);
		setPicker({row: 'episodes', season, at: Math.max(0, at), first: firstFor(Math.max(0, at), list.length)});
	};
	const pick = (ep: MediaItem) => {
		setPicker(null); setZone('none');
		if (now && ep.id === now.id) return;
		if (stream) stopReport(stream);
		chain.current = 0;
		setCancelled(false); setCardButton(0);
		// where it was left comes from the server as it opens (lib/player.ts openStream)
		setCurrent(ep);
	};

	const buttons: Button[] = (['pause', 'subs'] as Button[]).concat(seasons.length && episodes.length > 1 ? ['episodes'] : [], nextEp ? ['next'] : []);
	const press = (b: Button) => {
		if (b === 'pause') togglePause();
		else if (b === 'subs') setMenu(Math.max(0, subChoices.findIndex((c) => (c ? !!sub && sub.index === c.index : !sub))));
		else if (b === 'episodes') openPicker();
		else if (b === 'next') goNext();
	};

	// the card: from the credits (or 15 s before the end) while there is a next episode and it was not put away
	const cd = countdownStart(duration, stream && stream.outroStartTicks ? stream.outroStartTicks / 1e7 : undefined);
	// the card waits while the episode list is open: what is picked there wins
	const card = !!nextEp && !cancelled && !picker && duration > 0 && time >= cd.cardAt;
	const stillThere = chain.current >= STILL_THERE_AFTER;
	const advancing = useRef('');
	const autoNext = () => {
		if (nextEp && advancing.current === nextEp.id) return true;    // already on its way: the old video's 'ended' must not close the player
		if (!nextEp || cancelled || stillThere) return false;
		advancing.current = nextEp.id;
		chain.current += 1;
		goNext();
		return true;
	};
	const cardPress = (i: number) => {
		if (i === 0) { chain.current = 0; goNext(); } else setCancelled(true);
	};

	const subChoices: (SubTrack | null)[] = ([null] as (SubTrack | null)[]).concat(stream ? stream.subtitles : []);
	const handleKey = useCallback((key: NavKey, e: KeyboardEvent): boolean => {
		if (picker) {
			wake();
			if (key === 'back') setPicker(null);
			else if (key === 'up' || key === 'down') { if (seasons.length > 1) setPicker({...picker, row: key === 'up' ? 'seasons' : 'episodes'}); }
			else if (key !== 'left' && key !== 'right') return true;
			else if (picker.row === 'seasons') {
				// the season changes as the focus moves along the pills; its list opens on its first episode
				const i = clamp(seasons.indexOf(picker.season) + (key === 'right' ? 1 : -1), 0, seasons.length - 1);
				if (seasons[i] !== picker.season) setPicker({...picker, season: seasons[i], at: 0, first: 0});
			} else {
				const at = clamp(picker.at + (key === 'right' ? 1 : -1), 0, inSeason.length - 1);
				setPicker({...picker, at, first: firstFor(at, inSeason.length)});
			}
			return true;
		}
		if (menu !== null) {
			wake();
			if (key === 'back') setMenu(null);
			else if (key === 'up' || key === 'down') setMenu((m) => clamp((m || 0) + (key === 'down' ? 1 : -1), -1, subChoices.length - 1));
			else if ((key === 'left' || key === 'right') && menu === -1) shiftSubs(key === 'right' ? SUB_STEP_S : -SUB_STEP_S);
			return true;
		}
		if (card) {
			// keys on the card do not count as "still there": only its own Keep watching / Play now does
			wake(true);
			if (key === 'back') setCancelled(true);
			else if (key === 'left' || key === 'right') setCardButton((b) => clamp(b + (key === 'right' ? 1 : -1), 0, 1));
			return true;
		}
		wake();
		if (key === 'back') { if (zone === 'buttons') setZone('none'); else onClose(); return true; }
		if (zone === 'buttons') {
			if (key === 'up') setZone('none');
			else if (key === 'left' || key === 'right') setButton((b) => clamp(b + (key === 'right' ? 1 : -1), 0, buttons.length - 1));
			return true;
		}
		if (key === 'down') { setButton(0); setZone('buttons'); }
		else if (key === 'left' || key === 'right') setJump((j) => j + (key === 'right' ? 1 : -1) * (e.repeat ? HELD_JUMP_S : JUMP_S));
		return true;
	}, [menu, zone, subChoices.length, onClose, card, buttons.length, offset, picker, seasons.length, inSeason.length]);
	useKeys(handleKey, active);
	useOkPress({onPress: () => !(overSeek.current && byPointer.current) && once(() => {
		if (picker) { if (picker.row === 'seasons') setPicker({...picker, row: 'episodes'}); else if (inSeason[picker.at]) pick(inSeason[picker.at]); }
		else if (menu !== null) { if (menu >= 0) chooseSub(subChoices[menu] || null); }
		else if (card) cardPress(cardButton);
		else if (zone === 'buttons') press(buttons[button]);
		else togglePause();
	}), onLongPress: () => undefined}, active);

	// the remote's media keys
	useEffect(() => {
		if (!active) return undefined;
		const onKey = (e: KeyboardEvent) => {
			const v = video.current;
			if (!v) return;
			if (e.keyCode === MEDIA_KEY.play) { v.play().catch(() => undefined); wake(); }
			else if (e.keyCode === MEDIA_KEY.pause) { v.pause(); wake(); }
			else if (e.keyCode === MEDIA_KEY.forward) { setJump((j) => j + HELD_JUMP_S); wake(); }
			else if (e.keyCode === MEDIA_KEY.rewind) { setJump((j) => j - HELD_JUMP_S); wake(); }
			else return;
			e.preventDefault();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [active]);

	const onMeta = () => {
		const v = video.current;
		if (!v) return;
		setDuration(v.duration || 0);
		// a new video: the previous one's Stopped has gone out with its own position by now
		lastTicks.current = stream ? stream.startTicks : 0;
		if (stream && stream.startTicks) v.currentTime = stream.startTicks / 1e7;
	};
	const onPlaying = () => {
		setPaused(false);
		setStalled(false);
		if (!startedRef.current && stream) { startedRef.current = true; setStarted(true); startedFor.current = stream.playSessionId; reportStart(server, stream, pos()); }
	};
	const onPause = () => { setPaused(true); if (stream && startedRef.current) reportProgress(server, stream, pos(), true); };
	const onTime = () => {
		const v = video.current;
		if (!v) return;
		setStalled(false);
		// redraw for the time only while something shows it (the bar, the jump pill, the card): fewer redraws while a film just plays
		if (bar || jump !== 0 || v.currentTime >= cd.cardAt - 1) setTime(v.currentTime);
		if (v.currentTime > 0) lastTicks.current = v.currentTime * 1e7;
		const text = cueAt(cues, v.currentTime + offset);
		if (text !== line) setLine(text);
		if (card && !picker && v.currentTime >= cd.nextAt) autoNext();
	};
	const onEnded = () => { if (!autoNext()) onClose(); };

	// the wheel over the episode list scrolls it a card per notch, the focus coming along when it would go off screen
	const wheelAt = useRef(0);
	const onWheel = (e: WheelEvent) => {
		e.preventDefault();
		if (!picker || !e.deltaY || Date.now() - wheelAt.current < WHEEL_MS) return;
		wheelAt.current = Date.now();
		wake();
		const first = clamp(picker.first + (e.deltaY > 0 ? 1 : -1), 0, Math.max(0, inSeason.length - EP_SHOWN));
		setPicker({...picker, row: 'episodes', first, at: clamp(picker.at, first, first + EP_SHOWN - 1)});
	};
	// a click on the progress line goes to that place in the video
	const seekTo = (e: MouseEvent) => {
		const v = video.current, el = e.currentTarget as HTMLElement;
		if (!v || !stream || !duration) return;
		const box = el.getBoundingClientRect();
		v.currentTime = clamp((e.clientX - box.left) / box.width * duration, 0, Math.max(0, duration - 1));
		setTime(v.currentTime);
		setJump(0);
		if (v.currentTime < cd.cardAt) setCancelled(false);
		reportProgress(server, stream, pos(), v.paused);
	};

	const shown = jump ? clamp(time + jump, 0, duration) : time;
	const subLabel = sub ? (sub.lang ? sub.lang.toUpperCase() : sub.title || '?') : tr('Off');
	return (
		<div class="player" onClick={(e) => { if (e.target === e.currentTarget || e.target === video.current) { wake(); once(togglePause); } }}>
			{stream && <video ref={video} class="player__video" src={stream.url} autoPlay onLoadedMetadata={onMeta} onPlaying={onPlaying}
				onPause={onPause} onTimeUpdate={onTime} onEnded={onEnded} onWaiting={() => { if (startedRef.current) setStalled(true); }} onError={() => { if (now) fallBack(now); }} />}
			{!started && <div class="player__loading">{now ? now.title : ''}</div>}
			{stalled && <div class="player__loading">{tr('Waiting for Jellyfin…')}</div>}
			{line && !picker && <div class={`player__subs${bar ? ' player__subs--raised' : ''}${card ? ' player__subs--card' : ''}`}>{line.split('\n').map((l, i) => <span key={i}>{l}</span>)}</div>}
			{jump !== 0 && <div class="player__jump">{(jump > 0 ? '+' : '−') + Math.abs(jump) + ' s'}</div>}
			<div class={`player__bar${(bar || jump) && !picker ? ' player__bar--shown' : ''}`} onClick={(e) => e.stopPropagation()}
				onMouseEnter={hover(() => setOverBar(true))} onMouseLeave={() => { setOverBar(false); if (byPointer.current) setZone('none'); }}>
				{now && <div class="player__title">{now.title}</div>}
				{now && (now.subtitle || now.year) && <div class="player__sub">{now.subtitle || now.year}</div>}
				<div class="player__seek" onMouseEnter={() => { overSeek.current = true; }} onMouseLeave={() => { overSeek.current = false; }} onClick={(e) => { e.stopPropagation(); wake(); once(() => seekTo(e)); }}>
					<div class="player__track"><span style={{transform: `scaleX(${duration ? shown / duration : 0})`}} /></div>
				</div>
				<div class="player__times"><span>{clock(shown)}</span><span>−{clock(duration - shown)}</span></div>
				<div class="player__buttons">
					{buttons.map((b, i) => (
						<span key={b} class={`player__btn${zone === 'buttons' && i === button ? ' player__btn--focused' : ''}`}
							onMouseEnter={hover(() => { setZone('buttons'); setButton(i); })} onClick={click(() => { setZone('buttons'); setButton(i); press(b); })}>
							{b === 'pause' ? (paused ? '▶ ' + tr('Play') : '❚❚ ' + tr('Pause')) : b === 'next' ? tr('Next episode') + ' ›' : b === 'episodes' ? tr('Episodes')
								: tr('Subtitles') + ' · ' + subLabel}
						</span>
					))}
				</div>
			</div>
			{card && nextEp && (
				<div class="player__next" onClick={(e) => e.stopPropagation()}>
					<div class="player__next-when">{stillThere ? tr('Still there?') : `${tr('Next episode in')} ${Math.max(0, Math.ceil(cd.nextAt - time))} s`}</div>
					<div class="player__next-title">{nextEp.subtitle || nextEp.title}</div>
					{imageUrl(server, nextEp, 'Still', 504) && <img class="player__next-image" src={imageUrl(server, nextEp, 'Still', 504)} alt="" />}
					<div class="player__buttons">
						{[stillThere ? tr('Keep watching') : tr('Play now'), tr('Cancel')].map((label, i) => (
							<span key={i} class={`player__btn${i === cardButton ? ' player__btn--focused' : ''}`}
								onMouseEnter={hover(() => setCardButton(i))} onClick={click(() => cardPress(i))}>{label}</span>
						))}
					</div>
				</div>
			)}
			{picker && (
				<div class="player-eps" onClick={(e) => e.stopPropagation()} onWheel={onWheel}>
					<div class="player-eps__top">
						<h2 class="player-eps__title">{tr('Episodes')}</h2>
						{seasons.length > 1 && seasons.map((n) => (
							<span key={n} class={`player-eps__season${n === picker.season ? ' player-eps__season--on' : ''}${picker.row === 'seasons' && n === picker.season ? ' player-eps__season--focused' : ''}${quietSeason(n) ? ' player-eps__season--quiet' : ''}`}
								onMouseEnter={hover(() => setPicker({...picker, row: 'seasons'}))}
								onClick={click(() => setPicker({row: 'episodes', season: n, at: 0, first: 0}))}>
								{n === 0 ? tr('Specials') : tr('Season') + ' ' + n}
							</span>
						))}
					</div>
					<div class="player-eps__strip" style={{transform: `translateX(${-picker.first * EP_STEP}px)`}}>
						{inSeason.map((ep, i) => {
							const playing = !!now && ep.id === now.id;
							// the length and how far it was watched; "Playing" goes in front of them, with the separator only if there is something after it
							const facts = [ep.minutes ? ep.minutes + ' min' : '', ep.played ? tr('Watched') : ep.progress ? tr('In progress') : ''].filter(Boolean).join(' · ');
							const still = imageUrl(server, ep, 'Still', 400);
							const prep = prepOf(ep.path);
							const quiet = prepLabel(prep, tr);
							return (
								<div key={ep.id} class={`player-ep${picker.row === 'episodes' && i === picker.at ? ' player-ep--focused' : ''}`}
									onMouseEnter={hover(() => setPicker({...picker, row: 'episodes', at: i}))} onClick={click(() => pick(ep))}>
									<div class="player-ep__thumb">
										{still && <img src={still} alt="" decoding="async" />}
										{quiet && <span class={`player-ep__quiet${prep && prep.state !== 'ready' ? ' player-ep__quiet--busy' : ''}`}>{quiet}</span>}
										{ep.progress && !ep.played ? <span class="player-ep__bar" style={{transform: `scaleX(${ep.progress})`}} /> : null}
									</div>
									<div class="player-ep__name">{ep.episode ? ep.episode + '. ' : ''}{ep.name || ep.subtitle}</div>
									<div class="player-ep__meta">
										{playing && <span class="player-ep__now">{tr('Playing')}{facts ? ' · ' : ''}</span>}
										{facts}
									</div>
									{ep.overview && <div class="player-ep__overview">{ep.overview}</div>}
								</div>
							);
						})}
					</div>
				</div>
			)}
			{menu !== null && (
				<div class="media-ask" onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) setMenu(null); }}>
					<div class="media-ask__box">
						<h2 class="media-ask__title">{tr('Subtitles')}</h2>
						<div class={`media-ask__row${menu === -1 ? ' media-ask__row--focused' : ''}`} onMouseEnter={hover(() => setMenu(-1))}>
							<span>{tr('Timing')} <span class="player__nudge" onClick={click(() => shiftSubs(-SUB_STEP_S))}>‹</span> <span class="player__nudge" onClick={click(() => shiftSubs(SUB_STEP_S))}>›</span></span>
							<span>{offset === 0 ? tr('In sync') : `${offset > 0 ? tr('Earlier') : tr('Later')} ${Math.abs(offset).toFixed(2)} s`}</span>
						</div>
						{subChoices.map((c, i) => (
							<div key={i} class={`media-ask__row${i === menu ? ' media-ask__row--focused' : ''}`} onMouseEnter={hover(() => setMenu(i))} onClick={click(() => chooseSub(c))}>
								<span>{c ? (c.title || c.lang || '?') : tr('Off')}</span>
								<span class="media-ask__tick">{(c ? !!sub && sub.index === c.index : !sub) ? '✓' : ''}</span>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
