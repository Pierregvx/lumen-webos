import {useState} from 'preact/hooks';
import {t as tr} from '../lib/i18n';

/** What a tile on the Resume row shows (TileModel.resume). */
export interface ResumeInfo {
	title: string;
	/** an episode's "S2 E4 · Its title", or the year */
	subtitle?: string;
	/** a 16:9 picture; without one the tile shows the title on a colour */
	imageUrl?: string;
	/** 0..1, for a title in progress */
	progress?: number;
	/** a title asked for in Seerr and not in the library yet */
	requested?: boolean;
	/** how far its download is, 0..100 */
	percent?: number;
	/** a large picture for the home screen's background while this tile is focused */
	backdrop?: string;
	/** a badge of its own (New season) */
	badge?: string;
}

interface Props {
	info: ResumeInfo;
	classes: string;
	onHover?: () => void;
	onActivate?: () => void;
}

/** A film or episode on the Resume row: its picture and how far through it is. Focused, its title and episode show under it, as on a channel
 *  tile. A requested title shows a badge instead of the bar. */
export function ResumeTile ({info, classes, onHover, onActivate}: Props) {
	const [broken, setBroken] = useState('');
	const badge = info.badge ? info.badge : info.percent !== undefined ? `${info.percent} %` : info.requested ? tr('Requested') : '';
	return (
		<div class={`${classes} tile--resume`} onMouseEnter={onHover} onClick={onActivate}>
			<div class="tile__box">
				{info.imageUrl && broken !== info.imageUrl
					? <img class="resume__image" src={info.imageUrl} alt="" decoding="async" loading="lazy" onError={() => setBroken(info.imageUrl || '')} />
					: <div class="resume__name">{info.title}</div>}
				{badge
					? <div class="resume__badge">{badge}</div>
					: <div class="chan__bar"><span style={{transform: `scaleX(${info.progress || 0})`}} /></div>}
			</div>
			<div class="chan__info">
				<div class="chan__title">{info.title}</div>
				{info.subtitle && <div class="chan__next">{info.subtitle}</div>}
			</div>
		</div>
	);
}
