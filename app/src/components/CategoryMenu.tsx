// The Live TV categories (the IPTV list's groups, lib/iptv.ts): a list over the Guide or the live player's channel list, with how many
// channels each has. Up/Down move, OK picks, Back closes. Only the rows near the view are drawn.
import {useCallback, useState} from 'preact/hooks';
import {t as tr} from '../lib/i18n';
import {useKeys, clamp, type NavKey} from '../hooks/useKeys';
import {useOkPress} from '../hooks/useOkPress';
import {rowWindow} from '../lib/windowedList';
import {categoryCounts, categoryLabel} from '../lib/iptv';
import type {Channel} from '../lib/livetv';

interface Props {
	/** every channel the list could show, to count them */
	channels: Channel[];
	groups: string[];
	/** the group picked, '' for every channel */
	value: string;
	active: boolean;
	onPick: (group: string) => void;
	onClose: () => void;
}

/** a row's height and the space under it (keep in step with .catmenu__row in theme/guide.css) */
const ROW_STEP = 72;
const IN_VIEW = 12;
const FOCUS_AT = 4;
const SPARE = 2;

export function CategoryMenu ({channels, groups, value, active, onPick, onClose}: Props) {
	const rows = [''].concat(groups);
	const [focus, setFocus] = useState(() => Math.max(0, rows.indexOf(value)));
	const last = rows.length - 1;
	const at = clamp(focus, 0, last);
	const counts = categoryCounts(channels);
	const handleKey = useCallback((key: NavKey): boolean => {
		if (key === 'back' || key === 'left' || key === 'right') onClose();
		else if (key === 'up') setFocus((f) => clamp(f - 1, 0, last));
		else if (key === 'down') setFocus((f) => clamp(f + 1, 0, last));
		return true;
	}, [last, onClose]);
	useKeys(handleKey, active);
	useOkPress({onPress: () => onPick(rows[at]), onLongPress: () => undefined}, active);
	const {top, from, to} = rowWindow(rows.length, at, IN_VIEW, FOCUS_AT, SPARE);
	return (
		<div class="catmenu">
			<div class="catmenu__view">
				<div class="catmenu__track" style={{transform: `translateY(${-top * ROW_STEP}px)`}}>
					{rows.slice(from, to).map((g, k) => {
						const i = from + k;
						return (
							<div key={g || 'all'} class={`catmenu__row${i === at ? ' catmenu__row--focused' : ''}${g === value ? ' catmenu__row--on' : ''}`}
								style={{top: `${i * ROW_STEP}px`}} onMouseEnter={() => setFocus(i)} onClick={() => onPick(g)}>
								<span class="catmenu__name">{g ? categoryLabel(g) : tr('All categories')}</span>
								<span class="catmenu__count">{g ? counts[g] || 0 : channels.length}</span>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
