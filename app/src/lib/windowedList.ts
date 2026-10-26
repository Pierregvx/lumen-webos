// The scroll maths shared by the long lists (Grid, WallpaperPicker, SettingsList, Guide, FullGuide). Each keeps its own markup and numbers.

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/** A list that scrolls by whole rows. The focused row sits `focusAt` rows from the top until the list's end.
 *  Returns the first row in view (`top`; the track moves up `top` times the row step) and the rows to draw, `from` up to but not
 *  including `to`: `spare` rows either side of the view. `fill` keeps the full count drawn near the start of the list. */
export function rowWindow (count: number, focus: number, inView: number, focusAt: number, spare: number, fill = false): {top: number; from: number; to: number} {
	const top = clamp(focus - focusAt, 0, Math.max(0, count - inView));
	const from = Math.max(0, top - spare);
	const to = Math.min(count, (fill ? from + spare : top) + inView + spare);
	return {top, from, to};
}

/** A grid that scrolls by pixels. It centres the focused row in the viewport, stops at both ends, and stays still when it all fits.
 *  `gap` is the space under each row, less under the last; `endRoom` is extra scroll past the last row.
 *  Returns the track's height and offset in px, the focused row, and the items to draw, `from` up to but not including `to`:
 *  `before` rows above the focused row and `after` rows below it. */
export function gridWindow (o: {count: number; columns: number; selected: number; step: number; gap: number; viewport: number; endRoom: number; before: number; after: number}): {total: number; offset: number; row: number; from: number; to: number} {
	const total = Math.ceil(o.count / o.columns) * o.step - o.gap;
	const row = Math.floor(o.selected / o.columns);
	const offset = total <= o.viewport ? 0 : clamp(row * o.step - (o.viewport - o.step) / 2, 0, total - o.viewport + o.endRoom);
	const from = Math.max(0, row - o.before) * o.columns;
	const to = Math.min(o.count, (row + o.after + 1) * o.columns);
	return {total, offset, row, from, to};
}
