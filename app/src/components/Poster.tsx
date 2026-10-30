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
}

interface Props {
	model: PosterModel;
	focused: boolean;
	/** draw the picture (only rows near the view load theirs) */
	load: boolean;
	onHover?: () => void;
	onActivate?: () => void;
}

const BADGE: Record<Availability, string> = {none: '', requested: 'Requested', downloading: '', available: 'Available'};

export function Poster ({model, focused, load, onHover, onActivate}: Props) {
	const [broken, setBroken] = useState('');
	const a = model.availability;
	const badge = !a ? '' : a === 'downloading' ? `${model.percent || 0} %` : tr(BADGE[a]);
	return (
		<div class={`poster${focused ? ' poster--focused' : ''}`} onMouseEnter={onHover} onClick={onActivate}>
			{model.imageUrl && load && broken !== model.imageUrl
				? <img class="poster__image" src={model.imageUrl} alt="" decoding="async" onError={() => setBroken(model.imageUrl || '')} />
				: <div class="poster__name">{model.title}</div>}
			{badge && <div class={`poster__badge poster__badge--${a}`}>{badge}</div>}
		</div>
	);
}
