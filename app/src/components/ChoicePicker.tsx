import {t as tr} from '../lib/i18n';

interface Props {
	title: string;
	choices: string[];
	/** the choice in focus */
	selected: number;
	/** the choice that is set now (ticked) */
	current: number;
	onSelect: (index: number) => void;
	onChoose: (index: number) => void;
	onClose: () => void;
}

const ROW_H = 72;          // .picker__row height + margin (global.css)
const VISIBLE = 8;          // rows in the window
const SPARE = 6;            // rows drawn above and below the window, so a quick scroll never shows a gap

/** A pop-up list for options with many values (country, city, language ...): Up/Down move, OK sets, Back closes without changing anything.
 *  The list scrolls inside a fixed window to keep the focused row in the middle, and only the rows near the window are drawn (the
 *  city list with no country chosen has every city). */
export function ChoicePicker ({title, choices, selected, current, onSelect, onChoose, onClose}: Props) {
	const n = choices.length;
	const offset = Math.max(0, Math.min(selected - Math.floor((VISIBLE - 1) / 2), n - VISIBLE)) * ROW_H;
	const first = Math.max(0, Math.floor(offset / ROW_H) - SPARE);
	const last = Math.min(n, first + VISIBLE + 2 * SPARE);

	return (
		<>
			<div class="picker-backdrop" onClick={onClose} />
			<div class="picker">
				<div class="picker__title">{tr(title)}</div>
				<div class={`picker__view${n > VISIBLE ? ' picker__view--long' : ''}`} style={`height:${Math.min(n, VISIBLE) * ROW_H}px`}>
					<div class="picker__track" style={`height:${n * ROW_H}px;transform:translateY(${-offset}px)`}>
						{choices.slice(first, last).map((label, k) => { const i = first + k; return (
							<div
								key={i}
								style={`top:${i * ROW_H}px`}
								class={`picker__row${i === selected ? ' picker__row--focused' : ''}`}
								onMouseEnter={() => onSelect(i)}
								onClick={() => onChoose(i)}
							>
								<span>{tr(label)}</span>
								{i === current && <svg class="picker__tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
							</div>
						); })}
					</div>
				</div>
			</div>
		</>
	);
}
