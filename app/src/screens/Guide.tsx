import {t as tr} from '../lib/i18n';
import {useCallback, useState} from 'preact/hooks';
import {useKeys, clamp, type NavKey} from '../hooks/useKeys';
import {useOkPress} from '../hooks/useOkPress';
import {clockText, nowNextAt, progress, timeLeft, type Channel, type Listings} from '../lib/livetv';

interface Props {
	channels: Channel[];
	listings: Listings;
	logos: Record<string, string>;
	/** the current minute, ms */
	now: number;
	active: boolean;
	onOpen: (channel: Channel) => void;
	onClose: () => void;
}

/** a row's height and the space under it (keep in step with .guide__row in global.css) */
const ROW_STEP = 132;
/** rows in view at once */
const IN_VIEW = 6;
/** the focused row stays this many rows from the top while the list scrolls */
const FOCUS_AT = 2;
/** rows drawn beyond the view either side, so a scroll never shows a gap */
const SPARE = 2;

/** The Guide, Now and Next: one row per channel (number, logo, now with its times and progress, next with its start time).
 *  Up/Down move, OK opens Live TV on the channel, Back returns home. Only the rows near the view are drawn.
 *  Phase 2 adds a Now and Next / Full guide switcher at the top right (.guide__switch); nothing else moves for it. */
export function Guide ({channels, listings, logos, now, active, onOpen, onClose}: Props) {
	const [focus, setFocus] = useState(0);
	const last = channels.length - 1;
	const at = clamp(focus, 0, Math.max(0, last));

	const handleKey = useCallback((key: NavKey): boolean => {
		if (key === 'up') setFocus((f) => clamp(f - 1, 0, Math.max(0, last)));
		else if (key === 'down') setFocus((f) => clamp(f + 1, 0, Math.max(0, last)));
		else if (key === 'back') onClose();
		return true;
	}, [last, onClose]);
	useKeys(handleKey, active);
	useOkPress({onPress: () => { if (channels[at]) onOpen(channels[at]); }, onLongPress: () => undefined}, active);

	const top = clamp(at - FOCUS_AT, 0, Math.max(0, channels.length - IN_VIEW));
	const from = Math.max(0, top - SPARE);
	const to = Math.min(channels.length, top + IN_VIEW + SPARE);
	const t = Date.now();

	return (
		<div class="screen screen--settings screen--guide">
			<div class="guide__head">
				<h1 class="guide__title">{tr('Guide')}</h1>
				<div class="guide__switch" />
			</div>
			<div class="guide__cols">
				<span class="guide__col guide__col--now">{tr('Now')} · {clockText(now)}</span>
				<span class="guide__col guide__col--next">{tr('Next')}</span>
			</div>
			<div class="guide__view">
				{channels.length === 0 && <div class="guide__empty">{tr('No channels yet. Open Live TV once, then come back.')}</div>}
				<div class="guide__track" style={{transform: `translateY(${-top * ROW_STEP}px)`}}>
					{channels.slice(from, to).map((c, k) => {
						const i = from + k;
						const {now: on, next} = nowNextAt(listings[c.signal], t);
						const logo = c.logoPath && logos[c.logoPath];
						return (
							<div
								key={c.id}
								class={`guide__row${i === at ? ' guide__row--focused' : ''}${on ? '' : ' guide__row--off'}`}
								style={{top: `${i * ROW_STEP}px`}}
								onMouseEnter={() => setFocus(i)}
								onClick={() => onOpen(c)}
							>
								<div class="guide__num">{c.number}</div>
								<div class="guide__logo">{logo ? <img src={logo} alt="" decoding="async" /> : <span>{c.name}</span>}</div>
								<div class="guide__now">
									<div class="guide__prog">{on ? on.title : tr(next ? 'Off air' : 'No guide data')}</div>
									<div class="guide__meta">
										{on
											? <><span>{clockText(on.start)} – {clockText(on.end)}</span><span class="guide__meter"><span style={{transform: `scaleX(${progress(on, t)})`}} /></span>{i === at && <span>{timeLeft(on, t)}</span>}</>
											: next && <span>{tr('Starts at')} {clockText(next.start)}</span>}
									</div>
								</div>
								<div class="guide__next">
									{next && <><div class="guide__prog guide__prog--next">{next.title}</div><div class="guide__meta"><span>{clockText(next.start)}</span></div></>}
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
