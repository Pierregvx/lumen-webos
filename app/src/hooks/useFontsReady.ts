import {useEffect, useState} from 'preact/hooks';

/** False until the fonts have loaded (or 2.5s), so icons that sit beside text can wait for it: font-display: block hides the text, not the icon */
export function useFontsReady (): boolean {
	const [ready, setReady] = useState(false);
	useEffect(() => {
		let on = true;
		const show = () => { if (on) setReady(true); };
		const fonts = document.fonts;
		if (!fonts || !fonts.ready) { show(); return; }
		const id = window.setTimeout(show, 2500);
		window.requestAnimationFrame(() => fonts.ready.then(show, show));
		return () => { on = false; window.clearTimeout(id); };
	}, []);
	return ready;
}
