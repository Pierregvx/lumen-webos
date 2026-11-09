// The live player for IPTV channels (lib/iptv.ts, docs/plans/live-tv-build.md > IPTV): a channel from Jellyfin's Live TV, full screen,
// over whatever screen started it (the Home row or the Guide, which stays mounted underneath). The page goes transparent while it plays
// (html.playing, theme/player.css), as for a film.
// A banner (channel, now and next) shows on opening, on each zap and on OK, for 5 s. Up/Down and the remote's CH+/CH- go to the IPTV
// channel above or below; the stream opens a moment after the last press, so a run of presses opens only the channel it lands on.
// Left opens the channel list down the left (components/ChannelPanel.tsx: every channel with what is on, and a search by name). The
// number keys type a channel number: the digits show, and 1.5 s after the last one the player goes to the channel with that number.
// Back leaves. The stream is closed in Jellyfin before the next one opens and when the player goes, so a subscription that allows one
// connection is never left holding it.
import {useCallback, useEffect, useRef, useState} from 'preact/hooks';
import {t as tr} from '../lib/i18n';
import {useKeys, type NavKey} from '../hooks/useKeys';
import {useOkPress} from '../hooks/useOkPress';
import {releaseVideo, setVideoPaused} from '../lib/wallpaperVideo';
import {closeLeftover, closeLive, openLive, reportLiveStart, type LiveStream} from '../lib/iptv';
import {channelColor, channelLogo, clockText, nowNextAt, progress, timeLeft, type Channel, type Listings} from '../lib/livetv';
import {ChannelPanel} from '../components/ChannelPanel';
import {logError} from '../lib/log';
import {type JellyfinServer} from '../lib/jellyfin';

interface Props {
	server: JellyfinServer;
	/** the IPTV channels, in the Guide's order: Up/Down move through them */
	channels: Channel[];
	/** the IPTV list's categories, the one picked ('' for all): Up/Down stay in it */
	groups: string[];
	category: string;
	onCategory: (group: string) => void;
	start: Channel;
	listings: Listings;
	logos: Record<string, string>;
	/** the current minute, ms */
	now: number;
	/** channels whose guide is still being read */
	pending: Record<string, true>;
	/** the channels on screen in the channel list (useLiveTv browse: their guide is read) */
	browse: (shown: Channel[]) => void;
	active: boolean;
	onClose: () => void;
	onToast: (text: string, kind?: 'info' | 'error') => void;
}

const BANNER_MS = 5000;
/** a zap opens its channel this long after the last Up/Down */
const ZAP_AFTER_MS = 700;
/** nothing playing this long after the stream was set: the channel is given up on, the player stays for the next zap */
const START_LIMIT_MS = 20000;
/** the remote's channel keys (webOS: CH+ is PageUp, CH- is PageDown) */
const CH_KEY = {up: 33, down: 34} as const;
/** a typed number: the player goes to it this long after the last digit (at once at TYPED_MAX digits) */
const TYPED_MS = 1500;
const TYPED_MAX = 4;
/** a remote's number key (0-9, either row of a keyboard), or -1 */
const digitOf = (e: KeyboardEvent) => (e.keyCode >= 48 && e.keyCode <= 57 ? e.keyCode - 48 : e.keyCode >= 96 && e.keyCode <= 105 ? e.keyCode - 96 : -1);

export function LivePlayer ({server, channels, groups, category, onCategory, start, listings, logos, now, pending, browse, active, onClose, onToast}: Props) {
	const video = useRef<HTMLVideoElement>(null);
	/** the channel shown in the banner (moves at once on a zap) and the one playing (follows after ZAP_AFTER_MS) */
	const [shown, setShown] = useState(() => Math.max(0, channels.findIndex((c) => c.id === start.id)));
	const [tuned, setTuned] = useState(shown);
	const [stream, setStream] = useState<LiveStream | null>(null);
	const [state, setState] = useState<'opening' | 'playing' | 'failed'>('opening');
	const [banner, setBanner] = useState(true);
	/** the channel list is open over the picture: it has the keys */
	const [panel, setPanel] = useState(false);
	const [typed, setTyped] = useState('');
	const keysOn = active && !panel;
	const bannerTimer = useRef(0);
	/** the stream open in Jellyfin, closed before another opens; a promise, so the next open waits for the close */
	const openNow = useRef<LiveStream | null>(null);
	// a stream a last player left open (the TV switched off mid-channel) is closed before the first one opens
	const closing = useRef<Promise<void>>(null as unknown as Promise<void>);
	if (!closing.current) closing.current = closeLeftover(server).catch(() => undefined);
	/** asked to play the tuned channel again (OK, or picking it in the list, once it failed) */
	const [retry, setRetry] = useState(0);

	const channel = channels[shown] || start;

	// the page goes transparent and the wallpaper video lets go while the player is up
	useEffect(() => {
		document.documentElement.classList.add('playing');
		setVideoPaused(true);
		releaseVideo();
		return () => { document.documentElement.classList.remove('playing'); setVideoPaused(false); };
	}, []);

	const wake = useCallback(() => {
		setBanner(true);
		window.clearTimeout(bannerTimer.current);
		bannerTimer.current = window.setTimeout(() => setBanner(false), BANNER_MS);
	}, []);
	useEffect(() => { wake(); return () => window.clearTimeout(bannerTimer.current); }, []);

	const release = () => {
		const st = openNow.current;
		openNow.current = null;
		if (st) closing.current = closing.current.then(() => closeLive(server, st));
		return closing.current;
	};

	// open the tuned channel, once the last one is closed
	useEffect(() => {
		const c = channels[tuned];
		if (!c) return undefined;
		let live = true;
		setStream(null);
		setState('opening');
		release().then(() => (live ? openLive(server, c) : null)).then((st) => {
			if (!st) return;
			if (!live) { closing.current = closing.current.then(() => closeLive(server, st)); return; }
			openNow.current = st;
			setStream(st);
		}, (e: Error) => {
			if (!live) return;
			logError('iptv', `${c.name}: ${e.message}`);
			setState('failed');
			wake();
		});
		return () => { live = false; };
	}, [tuned, retry]);

	// the player goes, or Lumen leaves the screen: the stream is closed
	useEffect(() => {
		const onVisibility = () => { if (document.hidden) onClose(); };
		document.addEventListener('visibilitychange', onVisibility);
		return () => { document.removeEventListener('visibilitychange', onVisibility); release(); };
	}, []);

	// a stream that never starts
	useEffect(() => {
		if (!stream || state !== 'opening') return undefined;
		const timer = window.setTimeout(() => { setState('failed'); wake(); logError('iptv', `${channel.name}: no picture after ${START_LIMIT_MS / 1000} s`); }, START_LIMIT_MS);
		return () => window.clearTimeout(timer);
	}, [stream, state]);

	// zapping: the banner moves at once, the stream follows when the presses stop
	const zapTimer = useRef(0);
	const zap = (step: number) => {
		if (channels.length < 2) { wake(); return; }
		setShown((i) => {
			// within the category picked, when this channel is in it
			const within = category && channels[i] && channels[i].group === category;
			let next = i;
			for (let n = 0; n < channels.length; n++) {
				next = (next + step + channels.length) % channels.length;
				if (!within || channels[next].group === category) break;
			}
			window.clearTimeout(zapTimer.current);
			zapTimer.current = window.setTimeout(() => setTuned(next), ZAP_AFTER_MS);
			return next;
		});
		wake();
	};
	useEffect(() => () => window.clearTimeout(zapTimer.current), []);
	/** straight to a channel (the list, a typed number): no wait, it was picked */
	const tuneTo = (i: number) => {
		window.clearTimeout(zapTimer.current);
		setShown(i);
		setTuned(i);
		wake();
	};

	const handleKey = useCallback((key: NavKey): boolean => {
		if (key === 'back') { onClose(); return true; }
		if (key === 'up') zap(-1);
		else if (key === 'down') zap(1);
		else if (key === 'left') { setPanel(true); window.clearTimeout(bannerTimer.current); setBanner(false); }
		else wake();
		return true;
	}, [channels.length, category, onClose]);
	useKeys(handleKey, keysOn);
	useOkPress({onPress: () => {
		if (state === 'failed' && shown === tuned) { setRetry((n) => n + 1); wake(); }
		else if (banner) { window.clearTimeout(bannerTimer.current); setBanner(false); }
		else wake();
	}, onLongPress: () => undefined}, keysOn);

	// a typed number: the digits show, then the player goes to the channel with that number (the first, favourites coming first)
	const typedRef = useRef('');
	useEffect(() => {
		if (!keysOn) return undefined;
		let timer = 0;
		const go = () => {
			const n = typedRef.current;
			typedRef.current = '';
			setTyped('');
			if (!n) return;
			const i = channels.findIndex((c) => c.number === n);
			if (i >= 0) tuneTo(i);
			else onToast(`${tr('No channel')} ${n}`, 'error');
		};
		const onKey = (e: KeyboardEvent) => {
			const d = digitOf(e);
			if (d < 0) return;
			e.preventDefault();
			typedRef.current += String(d);
			setTyped(typedRef.current);
			window.clearTimeout(timer);
			if (typedRef.current.length >= TYPED_MAX) go();
			else timer = window.setTimeout(go, TYPED_MS);
		};
		window.addEventListener('keydown', onKey);
		return () => { window.clearTimeout(timer); window.removeEventListener('keydown', onKey); };
	}, [keysOn, channels]);

	useEffect(() => {
		if (!keysOn) return undefined;
		const onKey = (e: KeyboardEvent) => {
			if (e.keyCode === CH_KEY.up) zap(-1);
			else if (e.keyCode === CH_KEY.down) zap(1);
			else return;
			e.preventDefault();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [keysOn, channels.length]);

	const onPlaying = () => {
		if (state === 'playing' || !stream) return;
		setState('playing');
		reportLiveStart(server, stream);
	};
	const onError = () => {
		setState('failed');
		wake();
		logError('iptv', `${channel.name}: the TV could not play the stream`);
		onToast(`${tr('Couldn\'t play')} ${channel.name}`, 'error');
	};

	const {now: on, next} = nowNextAt(listings[channel.signal], now);
	const logo = channelLogo(channel, logos);
	const color = channelColor(channel.name);
	const zapping = shown !== tuned;
	return (
		<div class="player live live--focused">
			{stream && !zapping && <video ref={video} class="player__video" src={stream.url} autoPlay onPlaying={onPlaying} onError={onError} />}
			{(state !== 'playing' || zapping) && (
				<div class="player__loading">
					{state === 'failed' && !zapping ? tr('This channel is not playing') : channel.name}
					{state === 'failed' && !zapping && <div class="live__retry">{tr('OK to try again')}</div>}
				</div>
			)}
			{/* under the channel list it would show through the panel's foot */}
			<div class={`live__banner${!panel && (banner || state !== 'playing' || zapping) ? ' live__banner--shown' : ''}`}>
				<div class="live__logo" style={color ? {backgroundColor: color} : undefined}>
					{logo ? <img src={logo} alt="" decoding="async" /> : <span>{channel.name}</span>}
				</div>
				<div class="live__info">
					<div class="live__chan">{channel.number} · {channel.name}</div>
					{on ? (
						<>
							<div class="live__title">{on.title}</div>
							<div class="live__times">
								<span>{clockText(on.start)} – {clockText(on.end)}</span>
								<span class="live__meter"><span style={{transform: `scaleX(${progress(on, now)})`}} /></span>
								<span>{timeLeft(on, now)}</span>
							</div>
						</>
					) : (
						<div class="live__title">{tr(next ? 'Off air' : 'No guide data')}</div>
					)}
					{next && <div class="live__next">{tr('Next')} {clockText(next.start)} · {next.title}</div>}
				</div>
				{channels.length > 1 && <div class="live__hint">◀ {tr('Channels')} · ▲ ▼</div>}
			</div>
			{typed && <div class="guide__typed live__typed">{typed}</div>}
			{panel && <ChannelPanel channels={channels} groups={groups} category={category} onCategory={onCategory} current={channel} listings={listings} logos={logos} now={now} pending={pending} active={active}
				browse={browse} onClose={() => setPanel(false)}
				onPick={(c) => {
					const i = channels.findIndex((x) => x.id === c.id);
					setPanel(false);
					if (i >= 0 && i !== tuned) tuneTo(i);
					else if (state === 'failed') { setRetry((n) => n + 1); wake(); }
					else wake();
				}} />}
		</div>
	);
}
