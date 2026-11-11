import {useCallback, useState} from 'preact/hooks';
import {useKeys, clamp, type NavKey} from '../hooks/useKeys';
import {useOkPress} from '../hooks/useOkPress';

interface Props {
	title: string;
	/** a line under the title (what the choice does, the state now) */
	note?: string;
	rows: string[];
	active: boolean;
	onPick: (row: number) => void;
	onClose: () => void;
}

/** A short list over the screen, in the request panel's box (Films & series > ⚡ Prepare: Now or Tonight). Up/Down move, OK picks, Back closes. */
export function ChoicePanel ({title, note, rows, active, onPick, onClose}: Props) {
	const [at, setAt] = useState(0);
	const handleKey = useCallback((key: NavKey): boolean => {
		if (key === 'back') onClose();
		else if (key === 'up' || key === 'down') setAt((a) => clamp(a + (key === 'down' ? 1 : -1), 0, rows.length - 1));
		return true;
	}, [rows.length, onClose]);
	useKeys(handleKey, active);
	useOkPress({onPress: () => onPick(at), onLongPress: () => undefined}, active);
	return (
		<div class="media-ask">
			<div class="media-ask__box">
				<h2 class="media-ask__title">{title}</h2>
				{note && <p class="media-rate__ask media-ask__note">{note}</p>}
				<div class="media-ask__list">
					{rows.map((r, i) => (
						<div key={r} class={`media-ask__row${i === at ? ' media-ask__row--focused' : ''}`} onMouseEnter={() => setAt(i)} onClick={() => onPick(i)}>
							<span>{r}</span>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
