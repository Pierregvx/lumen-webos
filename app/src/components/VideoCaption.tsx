import {useEffect, useState} from 'preact/hooks';
import {getCurrentClip} from '../lib/wallpaperVideo';
import {getPictureCaption} from '../lib/wallpaper';

/** bottom right while the dock is away: the place and what the clip shows, like Apple TV's aerial screensavers */
export function VideoCaption () {
	const [clip, setClip] = useState(getCurrentClip());
	const [pic, setPic] = useState(getPictureCaption());
	useEffect(() => {
		const update = () => setClip(getCurrentClip());
		const updatePic = () => setPic(getPictureCaption());
		window.addEventListener('lumen-clip', update);
		window.addEventListener('lumen-wpcaption', updatePic);
		return () => { window.removeEventListener('lumen-clip', update); window.removeEventListener('lumen-wpcaption', updatePic); };
	}, []);
	// a still picture's title and credit use the same spot and look; CSS shows one or the other by wallpaper kind
	return (
		<div>
			{clip && (
				<div class="videocap">
					<div class="videocap__place">{clip.name}</div>
					{clip.title && <div class="videocap__text">{clip.title}</div>}
				</div>
			)}
			{pic && (
				<div class="videocap videocap--pic">
					<div class="videocap__place">{pic.title}</div>
					{pic.credit && <div class="videocap__text">{pic.credit}</div>}
				</div>
			)}
		</div>
	);
}
