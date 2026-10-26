import {LAYOUT} from '../theme/tokens';
import {clamp} from '../hooks/useKeys';
import {Tile, type TileModel} from './Tile';

interface Props {
	label: string;
	items: TileModel[];
	focused: boolean;
	selected: number;
	emptyText?: string;
	/** show the label above the row */
	titled?: boolean;
	/** extra class on the row (the Live TV row's is row--live) */
	className?: string;
	/** the furthest along (in tiles) the focused tile may sit: past it the row scrolls on, even when it fits. The last tile does not scroll it
	 *  further. The Live TV row uses it so the focused channel's now/next block always has room on its right. */
	slot?: number;
	/** tile width and gap, when not the default (they must match --layout-tile-size and --layout-tile-gap) */
	tileSize?: number;
	tileGap?: number;
	/** a row revealed only when the remote navigates down to it (tvOS-style) */
	hidden?: boolean;
	/** resting: no tile is focused (nothing lifted or named) until the remote is used */
	rest?: boolean;
	/** the pointer left this row */
	onLeave?: () => void;
	onSelect: (index: number) => void;
	onActivate: (index: number) => void;
}

const VIEWPORT_WIDTH = LAYOUT.screenWidth - 2 * LAYOUT.rowsEdge;

/** Horizontal strip of tiles. Centred when it fits; otherwise a carousel that keeps
 *  the selected tile in the middle (clamped at the ends). */
export function Row ({label, items, focused, selected, emptyText, titled, className, slot, tileSize, tileGap, hidden, rest, onLeave, onSelect, onActivate}: Props) {
	const size = tileSize || LAYOUT.tileSize;
	const gap = tileGap || LAYOUT.tileGap;
	const STEP = size + gap;
	const total = items.length * STEP - gap;
	const fits = total <= VIEWPORT_WIDTH;
	const offset = slot !== undefined ? Math.max(0, Math.min(selected, items.length - 2) - slot) * STEP
		: fits ? 0 : clamp(selected * STEP + size / 2 - VIEWPORT_WIDTH / 2, 0, total - VIEWPORT_WIDTH);
	// the selected tile's centre from the row's centre, for the glass bar's sliding highlight (home.css)
	const selX = selected * STEP + size / 2 - offset - (fits ? total : VIEWPORT_WIDTH) / 2;

	return (
		<section class={`row${focused || rest ? ' row--focused' : ''}${titled ? ' row--titled' : ''}${hidden ? ' row--hidden' : ''}${className ? ' ' + className : ''}`} style={`--row-w:${total}px`} onMouseLeave={onLeave}>
			<h2 class="row__label">{label}</h2>
			{/* --sel-x lives here, not on the row: a style change on the row restyles the bar's glass, and its sheen then repaints in full on every move */}
			<div class="row__shine" style={`--sel-x:${selX}px`} />
			<div class="row__viewport">
				{items.length === 0
					? <div class="row__empty">{emptyText || 'Nothing here yet'}</div>
					: <div class={`row__track${fits ? ' row__track--centered' : ''}`} style={{transform: `translateX(${-offset}px)`}}>
						{items.map((item, i) => (
							<Tile
								key={item.key}
								model={item}
								focused={focused && !rest && i === selected}
								onHover={() => onSelect(i)}
								onActivate={() => onActivate(i)}
							/>
						))}
					</div>}
			</div>
		</section>
	);
}
