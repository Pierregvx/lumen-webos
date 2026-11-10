import {useCallback, useState} from 'preact/hooks';
import {t as tr} from '../lib/i18n';
import {useKeys, clamp, type NavKey} from '../hooks/useKeys';
import {useOkPress} from '../hooks/useOkPress';

interface Props {
	title: string;
	active: boolean;
	/** a score 1..10, or null for Back (a skip after a finished title; a cancel from the Rate button) */
	onDone: (score: number | null) => void;
	/** from a title's Rate button (Films & series), as Ciné Pierro's sheet: "Your rating", starting at the score already given; Back cancels */
	change?: boolean;
	/** the score already given */
	start?: number;
}

/** "Your rating for X?": Left/Right pick 1 to 10 (starting at 7, or the score already given), OK keeps it, Back skips (or cancels). */
export function RatePanel ({title, active, onDone, change, start}: Props) {
	const [score, setScore] = useState(start || 7);
	const handleKey = useCallback((key: NavKey): boolean => {
		if (key === 'back') onDone(null);
		else if (key === 'left' || key === 'right') setScore((n) => clamp(n + (key === 'right' ? 1 : -1), 1, 10));
		return true;
	}, [onDone]);
	useKeys(handleKey, active);
	useOkPress({onPress: () => onDone(score), onLongPress: () => undefined}, active);
	return (
		<div class="media-ask media-rate">
			<div class="media-ask__box">
				<p class="media-rate__ask">{tr(change ? 'Your rating' : 'You finished')}</p>
				<h2 class="media-ask__title">{title}</h2>
				<div class="media-rate__scale">
					{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
						<span key={n} class={`media-rate__n${n === score ? ' media-rate__n--focused' : ''}`} onMouseEnter={() => setScore(n)} onClick={() => onDone(n)}>{n}</span>
					))}
				</div>
				<p class="media-rate__hint">{tr(change ? 'OK keeps it for your picks · Back cancels' : 'OK rates it out of 10 for your picks · Back skips')}</p>
			</div>
		</div>
	);
}
