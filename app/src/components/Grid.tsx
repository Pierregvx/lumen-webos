import {useLayoutEffect, useRef, useState} from 'preact/hooks';
import {LAYOUT} from '../theme/tokens';
import {clamp} from '../hooks/useKeys';
import {Tile, type TileModel} from './Tile';

interface Props {
	items: TileModel[];
	/** select: tick badges on chosen items, others dimmed. reorder: plain tiles. */
	mode: 'select' | 'reorder';
	checkedKeys: string[];
	/** index of the tile picked up in re-order mode, or -1 */
	liftedIndex: number;
	focused: boolean;
	selected: number;
	onSelect: (index: number) => void;
	onActivate: (index: number) => void;
}

const VIEWPORT_HEIGHT = 720;          // matches .grid__viewport height in global.css
const LABEL_HEIGHT = 60;              // two-line tile label + its top margin (see .tile__label)
const GRID_ROW_GAP = 40;              // matches .grid__track grid-row-gap
const ROW_STEP = LAYOUT.tileHeight + LABEL_HEIGHT + GRID_ROW_GAP;
/** scrolled to the end, the last row's names clear the viewport's faded bottom edge (26px, global.css) */
const END_ROOM = 30;
/** a long list (Settings > Channels, about 188) draws only the rows near the focused one; the rest keep their place as empty tiles */
const LONG_LIST = 60;
const ROWS_DRAWN = 4;

/** Full grid of tiles; scrolls vertically to keep the focused row in view. */
export function Grid ({items, mode, checkedKeys, liftedIndex, focused, selected, onSelect, onActivate}: Props) {
	// a tile's real height (its label runs taller than LABEL_HEIGHT), so the scroll's end reaches the last row's names
	const track = useRef<HTMLDivElement>(null);
	const [step, setStep] = useState(ROW_STEP);
	useLayoutEffect(() => {
		const first = track.current && track.current.firstElementChild as HTMLElement | null;
		const measured = first && first.offsetHeight ? first.offsetHeight + GRID_ROW_GAP : 0;
		if (measured && Math.abs(measured - step) > 1) setStep(measured);
	});
	const rows = Math.ceil(items.length / LAYOUT.gridColumns);
	const total = rows * step - GRID_ROW_GAP;
	const rowIndex = Math.floor(selected / LAYOUT.gridColumns);
	const offset = total <= VIEWPORT_HEIGHT ? 0
		: clamp(rowIndex * step - (VIEWPORT_HEIGHT - step) / 2, 0, total - VIEWPORT_HEIGHT + END_ROOM);

	return (
		<div class="grid__viewport">
			<div ref={track} class="grid__track" style={{transform: `translateY(${-offset}px)`}}>
				{items.map((item, i) => {
					if (items.length > LONG_LIST && Math.abs(Math.floor(i / LAYOUT.gridColumns) - rowIndex) > ROWS_DRAWN) {
						return <div key={item.key} class="tile tile--ghost"><div class="tile__box" /><div class="tile__label" /></div>;
					}
					const checked = mode === 'select' && checkedKeys.indexOf(item.key) !== -1;
					return (
						<Tile
							key={item.key}
							model={item}
							focused={focused && i === selected}
							lifted={i === liftedIndex}
							checked={checked}
							dimmed={mode === 'select' && !checked}
							onHover={() => onSelect(i)}
							onActivate={() => onActivate(i)}
						/>
					);
				})}
			</div>
		</div>
	);
}
