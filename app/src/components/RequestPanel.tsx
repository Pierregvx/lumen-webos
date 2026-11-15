import {useCallback, useEffect, useRef, useState} from 'preact/hooks';
import {t as tr} from '../lib/i18n';
import {useKeys, clamp, type NavKey} from '../hooks/useKeys';
import {useOkPress} from '../hooks/useOkPress';
import type {SeerrTitle} from '../lib/seerr';

interface Props {
	title: SeerrTitle;
	active: boolean;
	/** the seasons picked (at least one) */
	onRequest: (seasons: number[]) => void;
	onClose: () => void;
}

/** Requesting a series' seasons: each season not in the library yet (ticked with OK), then one Request (n) row. The focus starts on the first
 *  season, never on a row that sends: two OKs tick a season and untick it, they never ask for every season (South Park has 30). Above the
 *  seasons, « Every missing season » ticks them all (OK again unticks them). Request (n) with none ticked does nothing. Back cancels. A long
 *  list scrolls inside the box so the focused row stays in view. `onRequest` gets the seasons ticked. */
export function RequestPanel ({title, active, onRequest, onClose}: Props) {
	const open = (title.seasons || []).filter((x) => x.availability === 'none');
	const [picked, setPicked] = useState<number[]>([]);
	/** rows: 0 = every missing season, 1..n = a season, n + 1 = Request (n) */
	const last = open.length + 1;
	const [at, setAt] = useState(open.length ? 1 : 0);
	const list = useRef<HTMLDivElement>(null);
	// the focused row in view: the box clips the rest, so without this the focus went on below its edge
	useEffect(() => {
		const el = list.current && list.current.children[at] as HTMLElement | undefined;
		if (el) el.scrollIntoView({block: 'nearest'});
	}, [at]);

	const handleKey = useCallback((key: NavKey): boolean => {
		if (key === 'back') onClose();
		else if (key === 'up' || key === 'down') setAt((a) => clamp(a + (key === 'down' ? 1 : -1), 0, last));
		return true;
	}, [last, onClose]);
	useKeys(handleKey, active);
	const all = open.length > 0 && picked.length === open.length;
	const press = (i: number) => {
		if (i === 0) setPicked(all ? [] : open.map((x) => x.number));
		else if (i === last) { if (picked.length) onRequest(picked); }
		else {
			const n = open[i - 1].number;
			setPicked((p) => (p.indexOf(n) >= 0 ? p.filter((x) => x !== n) : p.concat(n).sort((a, b) => a - b)));
		}
	};
	useOkPress({onPress: () => press(at), onLongPress: () => undefined}, active);

	const row = (i: number, text: string, ticked?: boolean, faint?: boolean) => (
		<div key={i} class={`media-ask__row${i === at ? ' media-ask__row--focused' : ''}${faint ? ' media-ask__row--off' : ''}`} onMouseEnter={() => setAt(i)} onClick={() => press(i)}>
			<span>{text}</span>
			{ticked !== undefined && <span class="media-ask__tick">{ticked ? '✓' : ''}</span>}
		</div>
	);
	return (
		<div class="media-ask">
			<div class="media-ask__box">
				<h2 class="media-ask__title">{title.title}</h2>
				<div class="media-ask__list" ref={list}>
					{row(0, tr('Every missing season'), all)}
					{open.map((x, k) => row(k + 1, `${tr('Season')} ${x.number}`, picked.indexOf(x.number) >= 0))}
					{row(last, picked.length ? `${tr('Request')} (${picked.length})` : tr('Tick the seasons to request'), undefined, !picked.length)}
				</div>
			</div>
		</div>
	);
}
