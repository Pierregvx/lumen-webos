import {useLayoutEffect, useRef} from 'preact/hooks';
import {gridWindow} from '../lib/windowedList';
import {TIMING} from '../config/constants';

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
const VIEWPORT_HEIGHT = 700;          // .wp__viewport in theme/settings.css
const ROW_STEP = 203 + 70;             // thumbnail height + title + gap (see .wp__item)
const COL_STEP = 360 + 66.67;         // thumbnail width + gap
const ROWS_BEFORE = 1;                // rows kept drawn above and below the visible ones
const ROWS_AFTER = 4;
const PILL_MIDDLE = 100;              // .wp__pill's middle part, scaled to the picked category's width

/** Wallpaper tab of Settings: a bar of categories on top, a grid of thumbnails below, each ticked when it is picked. */
export function WallpaperPicker ({categories, categoryIndex, entries, current, chipsFocused, gridFocused, selected, onCategory, onSelect, onActivate, onHold, note}: Props) {
	const viewport = note ? VIEWPORT_HEIGHT - 70 : VIEWPORT_HEIGHT;
	let holdTimer = 0;
	let held = false;
	const {total, offset, from, to} = gridWindow({count: entries.length, columns: WALLPAPER_COLUMNS, selected, step: ROW_STEP, gap: 0, viewport, endRoom: 0, before: ROWS_BEFORE, after: ROWS_AFTER - 1});
	const bar = useRef<HTMLDivElement>(null);
	const pill = useRef<HTMLDivElement>(null);
	// the pill is two round ends and a middle that only move and stretch, so its slide stays on the compositor
	useLayoutEffect(() => {
		const chip = bar.current && bar.current.children[categoryIndex + 1] as HTMLElement | undefined;
		const p = pill.current;
		if (!chip || !p) return;
		const x = chip.offsetLeft, w = chip.offsetWidth, h = chip.offsetHeight;
		const [left, middle, right] = Array.prototype.slice.call(p.children) as HTMLElement[];
		left.style.width = right.style.width = `${h}px`;
		left.style.transform = `translateX(${x}px)`;
		right.style.transform = `translateX(${x + w - h}px)`;
		middle.style.transform = `translateX(${x + h / 2}px) scaleX(${(w - h) / PILL_MIDDLE})`;
		if (!p.classList.contains('wp__pill--placed')) { void p.offsetWidth; p.classList.add('wp__pill--placed'); }
	}, [categoryIndex, categories.length]);
	return (
		<div class="wp">
			<div class={`wp__chips${chipsFocused ? ' wp__chips--focused' : ''}`} ref={bar}>
				<div class="wp__pill" ref={pill}><i /><i /><i /></div>
				{categories.map((c, i) => (
					<div
						key={c}
						class={`wp__chip${i === categoryIndex ? ' wp__chip--on' : ''}`}
						data-label={c}
						onMouseEnter={() => onCategory(i)}
					>{c}</div>
				))}
			</div>
			{note && <p class="wp__note">{note}</p>}
			<div class="wp__viewport" style={note ? {height: `${viewport}px`} : undefined}>
				<div class="wp__track" style={{transform: `translateY(${-offset}px)`, height: `${total}px`}}>
					{entries.map((e, i) => ({e, i})).slice(from, to).map(({e, i}) => (
						<div
							key={e.key}
							style={{left: `${(i % WALLPAPER_COLUMNS) * COL_STEP}px`, top: `${Math.floor(i / WALLPAPER_COLUMNS) * ROW_STEP}px`}}
							class={['wp__item', gridFocused && i === selected && 'wp__item--focused', (e.key === current || e.on) && 'wp__item--current'].filter(Boolean).join(' ')}
							onMouseEnter={() => onSelect(i)}
							onMouseDown={() => { held = false; window.clearTimeout(holdTimer); holdTimer = window.setTimeout(() => { held = true; if (onHold) onHold(i); }, TIMING.longPressMs); }}
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
