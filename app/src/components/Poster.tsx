import {useState} from 'preact/hooks';
import {t as tr} from '../lib/i18n';
import type {Availability} from '../lib/seerr';

/** What a poster on the Films & series screen shows. */
export interface PosterModel {
	key: string;
	title: string;
	/** a 2:3 picture; without one the poster shows the title on a colour */
	imageUrl?: string;
	/** a Seerr title's status: a badge in the corner (none for a title already in the library) */
	availability?: Availability;
	percent?: number;
	/** the picture is a platform's logo: drawn whole on the poster's colour, not cropped */
	logo?: boolean;
	/** 0..1, how far through a title in progress: a bar at its foot */
	progress?: number;
	/** on the NAS's fast disk (lib/prepared.ts): a banner at its foot */
	quiet?: string;
	/** the banner says a copy is under way, not ready */
	quietBusy?: boolean;
	/** a plugin's tile (a genre): a picture with its name over it */
	tile?: boolean;
	/** this person's score, 1..10: « ★ 8 » in the bottom right corner */
	mine?: number;
	/** a title not out yet: its date (« 18 Nov ») in the bottom left corner */
	date?: string;
}

interface Props {
	model: PosterModel;
	focused: boolean;
	/** draw the picture (only rows near the view load theirs) */
	load: boolean;
	onHover?: () => void;
	onActivate?: () => void;
}

/** A logo's width on the poster, from its shape: the same ink for each, so a square one is not big beside a long one (TMDB's logos run
 *  from 1.8:1 to 5.8:1). Its width grows with the square root of its ratio, up to 90 %. */
const LOGO_WIDTH = 37;
const sized = (e: Event) => {
	const img = e.currentTarget as HTMLImageElement;
	if (img.naturalWidth && img.naturalHeight) img.style.width = `${Math.min(90, Math.round(LOGO_WIDTH * Math.sqrt(img.naturalWidth / img.naturalHeight)))}%`;
};

const BADGE: Record<Availability, string> = {none: '', requested: 'Requested', downloading: '', available: 'Available'};

export function Poster ({model, focused, load, onHover, onActivate}: Props) {
	const [broken, setBroken] = useState('');
	const a = model.availability;
	const badge = !a ? '' : a === 'downloading' ? `${model.percent || 0} %` : tr(BADGE[a]);
	return (
		<div class={`poster${model.logo ? ' poster--logo' : ''}${model.tile ? ' poster--tile' : ''}${focused ? ' poster--focused' : ''}`} onMouseEnter={onHover} onClick={onActivate}
			aria-label={model.mine ? `${model.title}, ${tr('your rating')} ${model.mine} / 10` : undefined}>
			{model.imageUrl && load && broken !== model.imageUrl
				? <img class="poster__image" src={model.imageUrl} alt="" decoding="async" onLoad={model.logo ? sized : undefined} onError={() => setBroken(model.imageUrl || '')} />
				: <div class="poster__name">{model.title}</div>}
			{badge && <div class={`poster__badge poster__badge--${a}`}>{badge}</div>}
			{model.quiet && <div class={`poster__quiet${model.quietBusy ? ' poster__quiet--busy' : ''}`}>{model.quiet}</div>}
			{model.tile && model.imageUrl && load && broken !== model.imageUrl && <div class="poster__tile">{model.title}</div>}
			{model.date && <div class="poster__date">{model.date}</div>}
			{model.mine ? <div class="poster__mine">★ {model.mine}</div> : null}
			{model.progress ? <div class="poster__bar"><span style={{transform: `scaleX(${model.progress})`}} /></div> : null}
		</div>
	);
}
