import {useEffect, useRef, useState} from 'preact/hooks';
import {Status} from './Status';
import {cachedServer, loadServer, nextAsset, previewUrls, type ImmichServer} from '../lib/immich';
import {setAmbientShowing} from '../lib/system';
import {dimForScreensaver, restoreBacklight} from '../lib/tvcontrols';
import type {Weather} from '../lib/weather';

/** Screensaver with your own photos (Immich). Opened by watch.sh with {"view":"ambient"} when the TV's screensaver starts, instead of LG's.
 *  Two full-screen layers: the next photo is loaded and decoded on the hidden one, then they swap with a crossfade (opacity only) every `seconds` (Settings > Screensaver > Time on each photo, 30 by default); each photo
 *  zooms in very slowly (transform only). The clock, date and weather sit bottom left. Any key or a click goes back to the home screen. */
export function Ambient ({source, seconds = 30, backlight, weather, showPeriod, onExit}: {source: string; seconds?: number; backlight?: number; weather?: Weather | null; showPeriod?: boolean; onExit: () => void}) {
	// each layer holds one photo's URL, or two for a portrait pair shown side by side
	const [layers, setLayers] = useState<[string[], string[]]>([[], []]);
	const [front, setFront] = useState(0);
	const state = useRef({front: 0, shown: '', alive: true, timer: 0});

	// the TV's backlight goes down while the screensaver shows (Settings > Screensaver > Brightness) and back up when it ends
	useEffect(() => {
		if (backlight === undefined) return;
		let on = true;
		dimForScreensaver(backlight, () => on);
		return () => { on = false; restoreBacklight(); };
	}, [backlight]);

	useEffect(() => {
		const s = state.current;
		s.alive = true;
		setAmbientShowing(true);
		let server: ImmichServer | null = cachedServer();
		const advance = () => {
			if (!s.alive) return;
			const ready = server ? Promise.resolve(server) : loadServer();
			ready
				.then((srv) => { server = srv; return srv ? nextAsset(srv, source, s.shown) : null; })
				.then((id) => {
					if (!id || !server || !s.alive) return null;
					const urls = previewUrls(server, id);
					return Promise.all(urls.map((url) => {
						const img = new Image();
						img.src = url;
						return typeof img.decode === 'function' ? img.decode() : Promise.resolve();
					})).then(() => ({id, urls}));
				})
				.then((pic) => {
					if (!pic || !s.alive) return;
					s.shown = pic.id;
					const back = 1 - s.front;
					setLayers((l) => { const n: [string[], string[]] = [l[0], l[1]]; n[back] = pic.urls; return n; });
					// two frames so the hidden layer has its picture before it becomes the visible one
					window.requestAnimationFrame(() => window.requestAnimationFrame(() => { s.front = back; setFront(back); }));
				})
				.catch(() => undefined)
				.then(() => { if (s.alive) s.timer = window.setTimeout(advance, seconds * 1000); });
		};
		advance();
		const exit = (e: Event) => { e.preventDefault(); onExit(); };
		window.addEventListener('keydown', exit, true);
		window.addEventListener('mousedown', exit, true);
		return () => {
			s.alive = false;
			window.clearTimeout(s.timer);
			window.removeEventListener('keydown', exit, true);
			window.removeEventListener('mousedown', exit, true);
			setAmbientShowing(false);
		};
	}, [source, seconds]);

	return (
		<div class="ambient">
			{layers.map((urls, i) => (
				// keyed by URL, so a new photo restarts the slow zoom
				<div key={i + urls.join(' ')} class={`ambient__photo${i === front ? ' ambient__photo--on' : ''}${i === 1 ? ' ambient__photo--alt' : ''}${urls.length > 1 ? ' ambient__photo--pair' : ''}`} style={urls.length > 0 ? {backgroundImage: urls.map((u) => `url("${u}")`).join(', '), animationDuration: `${seconds + 6}s`} : undefined} />
			))}
			<div class="ambient__night" />
			<div class="ambient__shade" />
			<div class="screen ambient__status"><Status weather={weather} showPeriod={showPeriod} /></div>
		</div>
	);
}
