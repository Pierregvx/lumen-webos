import {clamp} from '../hooks/useKeys';

export interface WallpaperEntry {
	key: string;            // local:N | cloud:<id> | all:<category> | video:<place> | immich:<source>
	title: string;
	category: string;
	fav?: boolean;
	on?: boolean;           // ticked in a multiple choice (video places)
	tint?: string;          // video tiles: a gradient with a play mark
	thumb?: string;         // picture; anything else is drawn as a plain tile
	label?: string;         // the text on a plain tile
}

interface Props {
	categories: string[];
	categoryIndex: number;
	entries: WallpaperEntry[];            // already filtered to the category
	current?: string;                     // the chosen key, for a single choice
	chipsFocused: boolean;
	gridFocused: boolean;
	selected: number;
	onCategory: (index: number) => void;
	onSelect: (index: number) => void;
	onActivate: (index: number) => void;
	/** a line of explanation under the chips (the Video category) */
	note?: string;
	/** press and hold with the pointer */
	onHold?: (index: number) => void;
}

export const WALLPAPER_COLUMNS = 4;
const VIEWPORT_HEIGHT = 700;          // .wp__viewport in global.css
const ROW_STEP = 203 + 70;             // thumbnail height + title + gap (see .wp__item)
const COL_STEP = 360 + 66.67;         // thumbnail width + gap
const ROWS_BEFORE = 1;                // rows kept drawn above and below the visible ones
const ROWS_AFTER = 4;

/** Wallpaper tab of Settings: category chips on top, a grid of thumbnails below, each ticked when it is picked. */
export function WallpaperPicker ({categories, categoryIndex, entries, current, chipsFocused, gridFocused, selected, onCategory, onSelect, onActivate, onHold, note}: Props) {
	const viewport = note ? VIEWPORT_HEIGHT - 70 : VIEWPORT_HEIGHT;
	let holdTimer = 0;
	let held = false;
	const rows = Math.ceil(entries.length / WALLPAPER_COLUMNS);
	const total = rows * ROW_STEP;
	const row = Math.floor(selected / WALLPAPER_COLUMNS);
	const offset = total <= viewport ? 0 : clamp(row * ROW_STEP - (viewport - ROW_STEP) / 2, 0, total - viewport);
	return (
		<div class="wp">
			<div class="wp__chips">
				{categories.map((c, i) => (
					<div
						key={c}
						class={['wp__chip', i === categoryIndex && 'wp__chip--on', chipsFocused && i === categoryIndex && 'wp__chip--focused'].filter(Boolean).join(' ')}
						onMouseEnter={() => onCategory(i)}
					>{c}</div>
				))}
			</div>
			{note && <p class="wp__note">{note}</p>}
			<div class="wp__viewport" style={note ? {height: `${viewport}px`} : undefined}>
				<div class="wp__track" style={{transform: `translateY(${-offset}px)`, height: `${total}px`}}>
					{entries.map((e, i) => ({e, i})).slice(Math.max(0, row - ROWS_BEFORE) * WALLPAPER_COLUMNS, (row + ROWS_AFTER) * WALLPAPER_COLUMNS).map(({e, i}) => (
						<div
							key={e.key}
							style={{left: `${(i % WALLPAPER_COLUMNS) * COL_STEP}px`, top: `${Math.floor(i / WALLPAPER_COLUMNS) * ROW_STEP}px`}}
							class={['wp__item', gridFocused && i === selected && 'wp__item--focused', (e.key === current || e.on) && 'wp__item--current'].filter(Boolean).join(' ')}
							onMouseEnter={() => onSelect(i)}
							onMouseDown={() => { held = false; window.clearTimeout(holdTimer); holdTimer = window.setTimeout(() => { held = true; if (onHold) onHold(i); }, 600); }}
							onMouseUp={() => window.clearTimeout(holdTimer)}
							onClick={() => { if (held) { held = false; return; } onActivate(i); }}
						>
							<div class="wp__thumb" style={e.thumb ? {backgroundImage: `url("${e.thumb}")`} : e.tint ? {background: e.tint} : undefined}>
								{!e.thumb && <span class="wp__thumbtext">{e.tint ? '\u25B6' : e.label || e.title}</span>}
								{e.fav && <span class="wp__fav">{'\u2605'}</span>}
								{(e.key === current || e.on) && <span class="wp__tick">{'\u2713'}</span>}
							</div>
							<div class="wp__title">{e.title}</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
