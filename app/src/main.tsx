import {render} from 'preact';
import {App} from './app';
import {applyTokens} from './theme/tokens';
import {bootMark, startLog} from './lib/log';
import {HOMEHOOK} from './lib/root';
import './theme/global.css';

bootMark('script');
applyTokens();
startLog();
// SF Pro from this build's private folder, else the copy tools/push_sf_font.sh put on the TV (survives Channel updates); neither means Geist
if ('FontFace' in window) {
	const sf = (url: string) => new FontFace('SF Private', `url(${url})`, {weight: '1 1000'}).load();
	sf(new URL('fonts/sf.woff2', location.href).href).catch(() => sf(`file://${HOMEHOOK}/fonts/sf.woff2`)).then((face) => { document.fonts.add(face); }).catch(() => undefined);
}
render(<App />, document.getElementById('root')!);
window.requestAnimationFrame(() => bootMark('frame'));

// Dev preview only (import.meta.env.DEV is false in the real build): the layout is a fixed 1920x1080 "TV screen". Scale it to fit the
// window, centre it, and keep the wallpaper layers inside it, with black bars where the window is bigger than a 16:9 screen.
if (import.meta.env.DEV) {
	const style = document.createElement('style');
	style.textContent = 'html{background:#000;overflow:hidden}#wpimage,#bgvideo{left:var(--dev-left,0px)!important;top:var(--dev-top,0px)!important;width:1920px!important;height:1080px!important}';
	document.head.appendChild(style);
	const fit = () => {
		const z = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
		const root = document.documentElement;
		root.style.zoom = String(z);
		const left = Math.max(0, (window.innerWidth / z - 1920) / 2);
		const top = Math.max(0, (window.innerHeight / z - 1080) / 2);
		root.style.setProperty('--dev-left', left + 'px');
		root.style.setProperty('--dev-top', top + 'px');
		document.body.style.marginLeft = left + 'px';
		document.body.style.marginTop = top + 'px';
	};
	fit();
	window.addEventListener('resize', fit);
}
