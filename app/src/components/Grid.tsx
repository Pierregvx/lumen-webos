import {useLayoutEffect, useRef, useState} from 'preact/hooks';
import {LAYOUT} from '../theme/tokens';
import {gridWindow} from '../lib/windowedList';
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

const VIEWPORT_HEIGHT = 720;          // matches .grid__viewport height in theme/tiles.css
const LABEL_HEIGHT = 60;              // two-line tile label + its top margin (see .tile__label)
const GRID_ROW_GAP = 40;              // matches .grid__track grid-row-gap
const ROW_STEP = LAYOUT.tileHeight + LABEL_HEIGHT + GRID_ROW_GAP;
/** scrolled to the end, the last row's names and shadow clear the viewport's bottom edge */
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
	const {offset, from, to} = gridWindow({count: items.length, columns: LAYOUT.gridColumns, selected, step, gap: GRID_ROW_GAP, viewport: VIEWPORT_HEIGHT, endRoom: END_ROOM, before: ROWS_DRAWN, after: ROWS_DRAWN});

	return (
		<div class="grid__viewport">
			<div ref={track} class="grid__track" style={{transform: `translateY(${-offset}px)`}}>
				{items.map((item, i) => {
					if (items.length > LONG_LIST && (i < from || i >= to)) {
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
