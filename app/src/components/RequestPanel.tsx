import {useCallback, useState} from 'preact/hooks';
import {t as tr} from '../lib/i18n';
import {useKeys, clamp, type NavKey} from '../hooks/useKeys';
import {useOkPress} from '../hooks/useOkPress';
import type {SeerrTitle} from '../lib/seerr';

interface Props {
	title: SeerrTitle;
	active: boolean;
	/** the seasons picked; none means all of them */
	onRequest: (seasons?: number[]) => void;
	onClose: () => void;
}

/** Requesting a series: All seasons first, then each season not in the library yet (ticked with OK), then Request. Back cancels. */
export function RequestPanel ({title, active, onRequest, onClose}: Props) {
	const open = (title.seasons || []).filter((x) => x.availability === 'none');
	const [picked, setPicked] = useState<number[]>([]);
	const [at, setAt] = useState(0);
	/** rows: 0 = All seasons, 1..n = a season, n + 1 = Request */
	const last = open.length + 1;

	const handleKey = useCallback((key: NavKey): boolean => {
		if (key === 'back') onClose();
		else if (key === 'up' || key === 'down') setAt((a) => clamp(a + (key === 'down' ? 1 : -1), 0, last));
		return true;
	}, [last, onClose]);
	useKeys(handleKey, active);
	useOkPress({onPress: () => {
		if (at === 0) onRequest(undefined);
		else if (at === last) onRequest(picked.length ? picked : undefined);
		else {
			const n = open[at - 1].number;
			setPicked((p) => (p.indexOf(n) >= 0 ? p.filter((x) => x !== n) : p.concat(n).sort((a, b) => a - b)));
		}
	}, onLongPress: () => undefined}, active);

	const row = (i: number, text: string, ticked?: boolean) => (
		<div key={i} class={`media-ask__row${i === at ? ' media-ask__row--focused' : ''}`} onMouseEnter={() => setAt(i)}>
			<span>{text}</span>
			{ticked !== undefined && <span class="media-ask__tick">{ticked ? '✓' : ''}</span>}
		</div>
	);
	return (
		<div class="media-ask">
			<div class="media-ask__box">
				<h2 class="media-ask__title">{title.title}</h2>
				{row(0, tr('All seasons'))}
				{open.map((x, k) => row(k + 1, `${tr('Season')} ${x.number}`, picked.indexOf(x.number) >= 0))}
				{row(last, picked.length ? `${tr('Request')} (${picked.length})` : tr('Request all'))}
			</div>
		</div>
	);
}
