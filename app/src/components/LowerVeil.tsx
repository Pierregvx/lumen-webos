import {useEffect, useRef} from 'preact/hooks';

/** The backdrop behind the lower rows. global.css styles it with the strong blurred copy (--wp-bg); when that copy is a picture, it is drawn
 *  once into a canvas at its own size (480x270) and the GPU scales it up. As a CSS background the full-screen picture was rastered again two
 *  or three times on every Down and Up, as the TV's memory pressure made Chromium drop its tiles (docs/frame-rate.md). A canvas has no tiles. */
export function LowerVeil () {
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const veil = ref.current;
		if (!veil) return;
		let key = '';
		let token = 0;
		let seen = '';
		const html = document.documentElement;
		const paint = () => {
			// most html changes (settled, in-settings) leave the veil as it is: skip them before forcing a style read
			const now = `${html.style.getPropertyValue('--wp-bg')}|${['night', 'light', 'wp-video'].map((c) => html.classList.contains(c)).join()}`;
			if (now === seen) return;
			seen = now;
			// the wallpaper is released while Lumen is hidden (lib/wallpaper.ts): keep the canvas for its return
			if (!html.style.getPropertyValue('--wp-bg') && !html.classList.contains('wp-video')) return;
			// read the look global.css gives the veil (night dimming, video tint) with the canvas class off, so CSS stays the one record of it
			const had = veil.classList.contains('lowerveil--canvas');
			veil.classList.remove('lowerveil--canvas');
			const css = getComputedStyle(veil);
			const image = css.backgroundImage, colour = css.backgroundColor, blend = css.backgroundBlendMode;
			const url = /url\("?([^")]+)"?\)/.exec(image);
			if (had && url && `${image}|${colour}|${blend}` === key) { veil.classList.add('lowerveil--canvas'); return; }
			key = `${image}|${colour}|${blend}`;
			const mine = ++token;
			if (!url) { veil.textContent = ''; return; }   // the video wallpaper's tint has no picture: CSS draws it
			const img = new Image();
			img.onload = () => {
				if (mine !== token) return;
				const c = document.createElement('canvas');
				c.width = img.naturalWidth; c.height = img.naturalHeight;
				c.className = 'lowerveil__canvas';
				const g = c.getContext('2d');
				if (!g) return;
				// the picture over the background colour by its blend mode (multiply when night dimming), then the dark gradient over it
				if (/multiply/.test(blend)) { g.fillStyle = colour; g.fillRect(0, 0, c.width, c.height); g.globalCompositeOperation = 'multiply'; }
				g.drawImage(img, 0, 0, c.width, c.height);
				g.globalCompositeOperation = 'source-over';
				const tint = /linear-gradient\((rgba?\([^)]*\))/.exec(image);
				if (tint) { g.fillStyle = tint[1]; g.fillRect(0, 0, c.width, c.height); }
				veil.textContent = '';
				veil.appendChild(c);
				veil.classList.add('lowerveil--canvas');
			};
			img.src = url[1];
		};
		paint();
		// the picture changes with --wp-bg (inline on html), the look with html's classes
		const watch = new MutationObserver(paint);
		watch.observe(html, {attributes: true, attributeFilter: ['style', 'class']});
		return () => watch.disconnect();
	}, []);
	return <div ref={ref} class="lowerveil" />;
}
