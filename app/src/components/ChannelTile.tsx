import {t as tr} from '../lib/i18n';
import {channelColor, clockText, progress, timeLeft, type NowNext} from '../lib/livetv';

/** What a Live TV tile shows (TileModel.live). */
export interface LiveTile extends NowNext {
	number: string;
	name: string;
	/** data: URI; without one the tile shows the channel's name */
	logo?: string;
	/** the current minute, ms */
	at: number;
}

interface Props {
	live: LiveTile;
	classes: string;
	onHover?: () => void;
	onActivate?: () => void;
}

/** A channel on the Live TV row: its logo on its brand colour (or a dark tile) and a capsule for how far through the programme is. Focused, the now/next block
 *  shows under it, where an app tile shows its name. */
export function ChannelTile ({live, classes, onHover, onActivate}: Props) {
	const {now, next, at} = live;
	const color = channelColor(live.name);
	return (
		<div class={`${classes} tile--channel`} onMouseEnter={onHover} onClick={onActivate}>
			<div class="tile__box" style={color ? {backgroundColor: color} : undefined}>
				{live.logo
					? <img class="chan__logo" src={live.logo} alt="" decoding="async" />
					: <div class="chan__name">{live.name}</div>}
				{/* empty with no programme on, so every tile keeps the same shape */}
				<div class="chan__bar"><span style={{transform: `scaleX(${now ? progress(now, at) : 0})`}} /></div>
			</div>
			<div class="chan__info">
				<div class="chan__line">{live.number} · {live.name}</div>
				{now ? (
					<>
						<div class="chan__title">{now.title}</div>
						<div class="chan__times">
							<span>{clockText(now.start)} – {clockText(now.end)}</span>
							<span class="chan__meter"><span style={{transform: `scaleX(${progress(now, at)})`}} /></span>
							<span>{timeLeft(now, at)}</span>
						</div>
					</>
				) : (
					<>
						<div class="chan__title">{tr(next ? 'Off air' : 'No guide data')}</div>
						{next && <div class="chan__times"><span>{tr('Starts at')} {clockText(next.start)}</span></div>}
					</>
				)}
				{now && next && <div class="chan__next">{tr('Next')} {clockText(next.start)} · {next.title}</div>}
			</div>
		</div>
	);
}
