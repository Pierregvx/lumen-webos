// The player (docs/plans/player.md): a full-screen video over whatever screen started it, which stays mounted underneath so Back returns
// to the same tab, row and tile. The page goes transparent while it plays (html.playing): the picture is on the TV's video plane behind it.
// Nothing shows while it plays; a key brings up the bar (title, progress, Pause, Subtitles) for 4 s. Left/Right jump 10 s (held: 30 s),
// added up in a pill and applied a moment after the last press; OK pauses; Down reaches the buttons; Back leaves. Jellyfin hears about the
// playback (start, every 10 s, pauses, jumps, stop) so Resume and its own apps keep the place.
import {useCallback, useEffect, useRef, useState} from 'preact/hooks';
import {t as tr} from '../lib/i18n';
import {useKeys, clamp, type NavKey} from '../hooks/useKeys';
import {useOkPress} from '../hooks/useOkPress';
import {releaseVideo, setVideoPaused} from '../lib/wallpaperVideo';
import {imageUrl} from '../lib/jellyfin';
import {nextEpisodeAfter, openStream, reportProgress, reportStart, reportStopped, type Stream, type SubTrack} from '../lib/player';
import {countdownStart, cueAt, parseVtt, pickSubtitle, savedSubtitle, saveSubtitle, saveSubOffset, STILL_THERE_AFTER, subOffset, type Cue} from '../lib/playerLogic';
import {loggedFetch} from '../lib/log';
import {nextEpisode, type JellyfinServer, type MediaItem} from '../lib/jellyfin';

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
/** the remote's own play, pause, fast-forward and rewind keys */
const MEDIA_KEY = {play: 415, pause: 19, forward: 417, rewind: 412} as const;

type Button = 'pause' | 'subs' | 'next';

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
	const [button, setButton] = useState(0);
	const [jump, setJump] = useState(0);
	const [menu, setMenu] = useState<number | null>(null);
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

	// ----- the next episode, and the card before it -----
	const [nextEp, setNextEp] = useState<MediaItem | null>(null);
	useEffect(() => {
		setNextEp(null);
		if (!now) return undefined;
		let live = true;
		nextEpisodeAfter(server, now).then((n) => { if (live) setNextEp(n); });
		return () => { live = false; };
	}, [now && now.id]);
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
	useEffect(() => { setOffset(now ? subOffset(now.id) : 0); }, [now && now.id]);
	const shiftSubs = (by: number) => {
		const next = Math.round((offset + by) * 100) / 100;
		setOffset(next);
		if (now) saveSubOffset(now.id, next);
	};
	useEffect(() => {
		if (!stream || !now) return;
		setSub(pickSubtitle(stream.subtitles, stream.audioLang, savedSubtitle(now.seriesId || now.id)));
	}, [stream]);
	useEffect(() => {
		setCues([]); setLine('');
		if (!sub) return undefined;
		let live = true;
		loggedFetch(sub.vttUrl).then((r) => r.text()).then((text) => { if (live) setCues(parseVtt(text)); }, () => undefined);
		return () => { live = false; };
	}, [sub && sub.vttUrl]);
	const chooseSub = (choice: SubTrack | null) => {
		setSub(choice);
		if (now) saveSubtitle(now.seriesId || now.id, choice ? choice.index : 'off');
		setMenu(null);
	};

	// ----- the bar: shown on any key, hidden 4 s after the last one (kept while paused, on the buttons or in the menu) -----
	const [poke, setPoke] = useState(0);
	const wake = (keepChain = false) => { setBar(true); setPoke((n) => n + 1); if (!keepChain) chain.current = 0; if (video.current) setTime(video.current.currentTime); };
	useEffect(() => {
		if (!bar || paused || zone === 'buttons' || menu !== null) return undefined;
		const timer = window.setTimeout(() => setBar(false), BAR_MS);
		return () => window.clearTimeout(timer);
	}, [bar, poke, paused, zone, menu]);

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

	const buttons: Button[] = nextEp ? ['pause', 'subs', 'next'] : ['pause', 'subs'];
	const press = (b: Button) => {
		if (b === 'pause') togglePause();
		else if (b === 'subs') setMenu(Math.max(0, subChoices.findIndex((c) => (c ? !!sub && sub.index === c.index : !sub))));
		else if (b === 'next') goNext();
	};

	// the card: from the credits (or 15 s before the end) while there is a next episode and it was not put away
	const cd = countdownStart(duration, stream && stream.outroStartTicks ? stream.outroStartTicks / 1e7 : undefined);
	const card = !!nextEp && !cancelled && duration > 0 && time >= cd.cardAt;
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
	}, [menu, zone, subChoices.length, onClose, card, buttons.length, offset]);
	useKeys(handleKey, active);
	useOkPress({onPress: () => {
		if (menu !== null) { if (menu >= 0) chooseSub(subChoices[menu] || null); }
		else if (card) cardPress(cardButton);
		else if (zone === 'buttons') press(buttons[button]);
		else togglePause();
	}, onLongPress: () => undefined}, active);

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
		if (card && v.currentTime >= cd.nextAt) autoNext();
	};
	const onEnded = () => { if (!autoNext()) onClose(); };

	const shown = jump ? clamp(time + jump, 0, duration) : time;
	const subLabel = sub ? (sub.lang ? sub.lang.toUpperCase() : sub.title || '?') : tr('Off');
	return (
		<div class="player">
			{stream && <video ref={video} class="player__video" src={stream.url} autoPlay onLoadedMetadata={onMeta} onPlaying={onPlaying}
				onPause={onPause} onTimeUpdate={onTime} onEnded={onEnded} onWaiting={() => { if (startedRef.current) setStalled(true); }} onError={() => { if (now) fallBack(now); }} />}
			{!started && <div class="player__loading">{now ? now.title : ''}</div>}
			{stalled && <div class="player__loading">{tr('Waiting for Jellyfin…')}</div>}
			{line && <div class={`player__subs${bar ? ' player__subs--raised' : ''}`}>{line.split('\n').map((l, i) => <span key={i}>{l}</span>)}</div>}
			{jump !== 0 && <div class="player__jump">{(jump > 0 ? '+' : '−') + Math.abs(jump) + ' s'}</div>}
			<div class={`player__bar${bar || jump ? ' player__bar--shown' : ''}`}>
				{now && <div class="player__title">{now.title}</div>}
				{now && (now.subtitle || now.year) && <div class="player__sub">{now.subtitle || now.year}</div>}
				<div class="player__track"><span style={{transform: `scaleX(${duration ? shown / duration : 0})`}} /></div>
				<div class="player__times"><span>{clock(shown)}</span><span>−{clock(duration - shown)}</span></div>
				<div class="player__buttons">
					{buttons.map((b, i) => (
						<span key={b} class={`player__btn${zone === 'buttons' && i === button ? ' player__btn--focused' : ''}`} onClick={() => press(b)}>
							{b === 'pause' ? (paused ? '▶ ' + tr('Play') : '❚❚ ' + tr('Pause')) : b === 'next' ? tr('Next episode') + ' ›' : tr('Subtitles') + ' · ' + subLabel}
						</span>
					))}
				</div>
			</div>
			{card && nextEp && (
				<div class="player__next">
					<div class="player__next-when">{stillThere ? tr('Still there?') : `${tr('Next episode in')} ${Math.max(0, Math.ceil(cd.nextAt - time))} s`}</div>
					<div class="player__next-title">{nextEp.subtitle || nextEp.title}</div>
					{imageUrl(server, nextEp, 'Thumb', 640) && <img class="player__next-image" src={imageUrl(server, nextEp, 'Thumb', 640)} alt="" />}
					<div class="player__buttons">
						{[stillThere ? tr('Keep watching') : tr('Play now'), tr('Cancel')].map((label, i) => (
							<span key={i} class={`player__btn${i === cardButton ? ' player__btn--focused' : ''}`} onClick={() => cardPress(i)}>{label}</span>
						))}
					</div>
				</div>
			)}
			{menu !== null && (
				<div class="media-ask">
					<div class="media-ask__box">
						<h2 class="media-ask__title">{tr('Subtitles')}</h2>
						<div class={`media-ask__row${menu === -1 ? ' media-ask__row--focused' : ''}`}>
							<span>{tr('Timing')} ‹ ›</span>
							<span>{offset === 0 ? tr('In sync') : `${offset > 0 ? tr('Earlier') : tr('Later')} ${Math.abs(offset).toFixed(2)} s`}</span>
						</div>
						{subChoices.map((c, i) => (
							<div key={i} class={`media-ask__row${i === menu ? ' media-ask__row--focused' : ''}`} onClick={() => chooseSub(c)}>
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
