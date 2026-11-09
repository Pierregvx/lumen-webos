import {useEffect, useRef} from 'preact/hooks';

/** Whether the last mouse event came from the pointer moving. The browser also reports a mouse-enter when a list slides under a pointer
 *  resting on screen (a row scrolled in, a screen opened under it), which must not move the focus: a hover handler checks .current first.
 *  Seen on webOS 25: Down bounced back to the home screen's bar, and Discover opened on its second row. */
export function useRealPointer () {
	const real = useRef(true);
	useEffect(() => {
		let lastX = -1, lastY = -1;
		const track = (e: MouseEvent) => { real.current = e.clientX !== lastX || e.clientY !== lastY; lastX = e.clientX; lastY = e.clientY; };
		window.addEventListener('mouseover', track, true);
		window.addEventListener('mousemove', track, true);
		return () => { window.removeEventListener('mouseover', track, true); window.removeEventListener('mousemove', track, true); };
	}, []);
	return real;
}
