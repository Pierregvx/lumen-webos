import {t as tr} from '../lib/i18n';
import {useCallback, useState} from 'preact/hooks';
import {Grid} from '../components/Grid';
import {OptionList, type OptionItem} from '../components/OptionList';
import {ChoicePicker} from '../components/ChoicePicker';
import type {TileModel} from '../components/Tile';
import {useKeys, clamp, type NavKey} from '../hooks/useKeys';
import {useOkPress} from '../hooks/useOkPress';
import {moveItem} from '../lib/order';
import {LAYOUT} from '../theme/tokens';
import {WallpaperPicker, WALLPAPER_COLUMNS, type WallpaperEntry} from '../components/WallpaperPicker';

export interface SettingsTab {
	id: string;
	label: string;
	/** noun for the re-order button, e.g. "apps" → "Re-order apps" */
	noun: string;
	/** everything available */
	items: TileModel[];
	/** what's on the home screen, in home-screen order */
	shown: TileModel[];
}

export interface WallpaperTab {
	categories: string[];
	entries: WallpaperEntry[];
	current: string;
	onPick: (key: string) => void;
	/** hold OK on a picture: add or remove it from Favorites */
	onFavorite: (key: string) => void;
}

interface Props {
	tabs: SettingsTab[];
	wallpaper: WallpaperTab;
	options: OptionItem[];
	active: boolean;
	onToggle: (tabId: string, key: string) => void;
	onReorder: (tabId: string, keys: string[]) => void;
	onOption: (optionId: string) => void;
	/** a value picked from an option's pop-up list */
	onChoose: (optionId: string, index: number) => void;
	onClose: () => void;
}

/** Focus is on the tabs row (a tab, or the re-order button) or in the tab's content. */
type Zone = 'tabs' | 'button' | 'content' | 'chips';

/** A tile that has been picked up in re-order mode, and the order to restore on Back. */
interface Held {
	index: number;
	original: string[];
}

const OPTIONS_LABEL = 'Options';
const WALLPAPER_LABEL = 'Wallpaper';

const HINT = {
	select: 'OK adds or removes an item · Hold OK to re-order · Back returns home',
	reorder: 'OK picks up an item · Hold OK or choose Done to finish',
	holding: 'Arrows move it · OK puts it down · Back cancels',
	options: 'OK turns an option on or off · Back returns home',
	picker: 'Up and down move · OK sets it · Back cancels',
	wallpaper: 'Left and right change category · OK sets the wallpaper · hold OK adds it to Favorites · Back returns home'
} as const;

/** Settings: pick which apps and sources appear on the home rows and their order, plus options.
 *
 *  Tabs: one grid tab per row (Apps, Sources), then Options.
 *  Grid tabs, select mode: everything available; OK adds/removes an item.
 *  Grid tabs, re-order mode (hold OK, or the button): only what's on the home screen, in order;
 *  OK picks an item up, arrows move it, OK puts it down. Hold OK or press Done to leave. */
export function Settings ({tabs, wallpaper, options, active, onToggle, onReorder, onOption, onChoose, onClose}: Props) {
	const [tabIndex, setTabIndex] = useState(import.meta.env.DEV ? Number((/[?&]tab=(\d)/.exec(location.search) || [])[1] || 0) : 0);
	const [zone, setZone] = useState<Zone>('tabs');
	const [gridIndex, setGridIndex] = useState(0);
	const [optionIndex, setOptionIndex] = useState(0);
	const [reordering, setReordering] = useState(false);
	const [held, setHeld] = useState<Held | null>(null);
	const [wpCat, setWpCat] = useState(0);
	const [wpIndex, setWpIndex] = useState(0);
	/** the focused row of the open pop-up list (for options[optionIndex]), or null when none is open */
	const [picker, setPicker] = useState<number | null>(null);

	const tabCount = tabs.length + 2;                  // grid tabs + Wallpaper + Options
	const onWallpaper = tabIndex === tabs.length;
	const onOptions = tabIndex === tabs.length + 1;
	const tab: SettingsTab | undefined = (onOptions || onWallpaper) ? undefined : tabs[tabIndex];
	const wpName = wallpaper.categories[wpCat];
	const wpList = wallpaper.entries.filter((e) => (wpName === 'All' ? e.key.indexOf('shuffle:') !== 0 && e.category !== 'Favorites' && e.category !== 'Video' : e.category === wpName));
	const items = tab ? (reordering ? tab.shown : tab.items) : [];
	const count = onOptions ? options.length : onWallpaper ? wpList.length : items.length;
	const cols = LAYOUT.gridColumns;
	const keysOf = (list: TileModel[]) => list.map((t) => t.key);

	const selectTab = (i: number) => {
		if (reordering) return;          // tab is locked while re-ordering
		setTabIndex(i);
		setGridIndex(0);
		setOptionIndex(0);
		setWpIndex(0);
	};

	const changeCategory = (i: number) => { setWpCat(clamp(i, 0, wallpaper.categories.length - 1)); setWpIndex(0); };

	/** Switch re-order mode, keeping focus on the same item where it exists in both lists. */
	const setMode = (next: boolean) => {
		if (!tab || next === reordering) return;
		const focusedKey = items[gridIndex] && items[gridIndex].key;
		const target = next ? tab.shown : tab.items;
		const i = focusedKey ? keysOf(target).indexOf(focusedKey) : -1;
		setGridIndex(Math.max(0, i));
		setHeld(null);
		setReordering(next);
		if (next && (zone === 'tabs' || target.length === 0)) setZone('button');
	};

	/** Move the held tile to `to`, updating the home screen as it goes. */
	const moveHeld = (to: number) => {
		if (!tab || !held) return;
		const dest = clamp(to, 0, count - 1);
		if (dest === held.index) return;
		onReorder(tab.id, moveItem(keysOf(tab.shown), held.index, dest));
		setHeld({...held, index: dest});
		setGridIndex(dest);
	};

	const activateGridItem = (i: number) => {
		if (!tab || !items[i]) return;
		if (!reordering) { onToggle(tab.id, items[i].key); return; }
		if (held) {                                                   // put down (pointer: at the clicked tile)
			if (i !== held.index) moveHeld(i);
			setHeld(null);
			return;
		}
		setHeld({index: i, original: keysOf(tab.shown)});             // pick up
		setGridIndex(i);
	};

	/** OK on an option: a list option opens its pop-up list (OK there sets the value), anything else is handed on */
	const activateOption = (i: number) => {
		const o = options[i];
		if (!o) return;
		if (picker !== null) { if (o.choices) onChoose(o.id, picker); setPicker(null); return; }
		if (o.choices && o.choices.length > 0) { setPicker(Math.max(0, o.choice || 0)); return; }
		onOption(o.id);
	};

	const onPress = () => {
		if (zone === 'button') { setMode(!reordering); return; }
		if (zone === 'chips') { if (count > 0) setZone('content'); return; }
		if (zone === 'tabs') { if (onWallpaper) setZone('chips'); else if (count > 0) setZone('content'); return; }
		if (onWallpaper) { if (wpList[wpIndex]) wallpaper.onPick(wpList[wpIndex].key); return; }
		if (onOptions) { activateOption(optionIndex); return; }
		activateGridItem(gridIndex);
	};

	const onLongPress = () => {
		if (onWallpaper) { if (zone === 'content' && wpList[wpIndex]) wallpaper.onFavorite(wpList[wpIndex].key); return; }
		if (tab) setMode(!reordering);
	};

	useOkPress({onPress, onLongPress}, active);

	const handleKey = useCallback((key: NavKey): boolean => {
		if (key === 'enter') return true;           // handled by useOkPress (press vs hold)

		if (picker !== null) {
			const n = ((options[optionIndex] || {choices: []}).choices || []).length;
			if (key === 'up') setPicker(clamp(picker - 1, 0, n - 1));
			else if (key === 'down') setPicker(clamp(picker + 1, 0, n - 1));
			else if (key === 'back') setPicker(null);
			return true;
		}

		if (key === 'back') {
			if (held && tab) { onReorder(tab.id, held.original); setGridIndex(held.index); setHeld(null); }
			else if (reordering) setMode(false);
			else onClose();
			return true;
		}

		if (held) {
			if (key === 'left') moveHeld(held.index - 1);
			else if (key === 'right') moveHeld(held.index + 1);
			else if (key === 'up') moveHeld(held.index - cols);
			else if (key === 'down') moveHeld(held.index + cols);
			return true;
		}

		if (zone === 'tabs') {
			if (key === 'left') selectTab(clamp(tabIndex - 1, 0, tabCount - 1));
			else if (key === 'right') selectTab(clamp(tabIndex + 1, 0, tabCount - 1));
			else if (key === 'down') { if (onWallpaper) setZone('chips'); else if (count > 0) setZone('content'); }
			return true;
		}
		if (zone === 'chips') {
			if (key === 'left') changeCategory(wpCat - 1);
			else if (key === 'right') changeCategory(wpCat + 1);
			else if (key === 'up') setZone('tabs');
			else if (key === 'down' && count > 0) setZone('content');
			return true;
		}
		if (zone === 'button') {
			if (key === 'left' && !reordering) setZone('tabs');
			else if (key === 'down' && count > 0) setZone('content');
			return true;
		}

		if (onWallpaper) {
			const last = count - 1;
			if (key === 'left') setWpIndex((i) => clamp(i - 1, 0, last));
			else if (key === 'right') setWpIndex((i) => clamp(i + 1, 0, last));
			else if (key === 'up') { if (wpIndex < WALLPAPER_COLUMNS) setZone('chips'); else setWpIndex((i) => i - WALLPAPER_COLUMNS); }
			else if (key === 'down') setWpIndex((i) => (i + WALLPAPER_COLUMNS <= last ? i + WALLPAPER_COLUMNS : i));
			return true;
		}

		if (onOptions) {
			if (key === 'up') { if (optionIndex === 0) setZone('tabs'); else setOptionIndex(optionIndex - 1); }
			else if (key === 'down') setOptionIndex(clamp(optionIndex + 1, 0, count - 1));
			return true;
		}

		switch (key) {
			case 'left': setGridIndex((i) => clamp(i - 1, 0, count - 1)); break;
			case 'right': setGridIndex((i) => clamp(i + 1, 0, count - 1)); break;
			case 'up':
				if (gridIndex >= cols) setGridIndex((i) => i - cols);
				// Spatial: the button sits top-right, so leave the grid towards whichever is above.
				else setZone(reordering || gridIndex % cols >= cols / 2 ? 'button' : 'tabs');
				break;
			case 'down': setGridIndex((i) => (i + cols < count ? i + cols : i)); break;
		}
		return true;
	}, [picker, zone, tabIndex, tabCount, gridIndex, optionIndex, wpIndex, wpCat, wpList, wallpaper, onWallpaper, count, tab, onOptions, options, reordering, held, items, onReorder, onClose]);

	useKeys(handleKey, active);

	const hint = picker !== null ? HINT.picker : onWallpaper ? HINT.wallpaper : onOptions ? HINT.options : held ? HINT.holding : reordering ? HINT.reorder : HINT.select;
	const labels = tabs.map((t) => t.label).concat(WALLPAPER_LABEL, OPTIONS_LABEL);
	const buttonClass = ['settings__button', reordering && 'settings__button--active', zone === 'button' && 'settings__button--focused'].filter(Boolean).join(' ');

	return (
		<div class="screen screen--settings">
			<div class="settings">
				<h1 class="settings__title">{tr('Settings')}</h1>
				<p class="settings__hint">{tr(hint)}</p>
				<div class="settings__tabs">
					<div class="tabbar">
					{labels.map((label, i) => (
						<div
							key={label}
							class={['tab', i === tabIndex && 'tab--active', reordering && i !== tabIndex && 'tab--locked', zone === 'tabs' && i === tabIndex && 'tab--focused'].filter(Boolean).join(' ')}
							onMouseEnter={() => { if (!reordering) { setZone('tabs'); selectTab(i); } }}
						>
							{tr(label)}
						</div>
					))}
					</div>
					{tab && (
						<div
							class={buttonClass}
							onMouseEnter={() => setZone('button')}
							onClick={() => setMode(!reordering)}
						>
							{reordering ? tr('Done') : tr(`Re-order ${tab.noun}`)}
						</div>
					)}
				</div>
				{tab && (
					<Grid
						items={items}
						mode={reordering ? 'reorder' : 'select'}
						checkedKeys={keysOf(tab.shown)}
						liftedIndex={held ? held.index : -1}
						focused={zone === 'content'}
						selected={gridIndex}
						onSelect={(i) => { if (!held) { setZone('content'); setGridIndex(i); } }}
						onActivate={(i) => { setZone('content'); activateGridItem(i); }}
					/>
				)}
				{onWallpaper && (
					<WallpaperPicker
						categories={wallpaper.categories}
						categoryIndex={wpCat}
						entries={wpList}
						current={wallpaper.current}
						chipsFocused={zone === 'chips'}
						gridFocused={zone === 'content'}
						selected={wpIndex}
						onCategory={(i) => { setZone('chips'); changeCategory(i); }}
						onSelect={(i) => { setZone('content'); setWpIndex(i); }}
						onActivate={(i) => { setZone('content'); if (wpList[i]) wallpaper.onPick(wpList[i].key); }}
						onHold={(i) => { if (wpList[i]) wallpaper.onFavorite(wpList[i].key); }}
						note={wpName === 'Video' ? tr('Pick one or more places and the video wallpaper plays them in random order. Shuffle all places plays everything: aerial videos and free stock videos of European countries. Videos stream from the internet (up to about 3 GB an hour) and take a few seconds to start. Settings > Options > Video wallpaper hours limits when they play.') : undefined}
					/>
				)}
				{onOptions && (
					<OptionList
						options={options}
						focused={zone === 'content'}
						selected={optionIndex}
						onSelect={(i) => { setZone('content'); setOptionIndex(i); }}
						onActivate={(i) => { if (picker !== null) return; setZone('content'); setOptionIndex(i); activateOption(i); }}
					/>
				)}
				{onOptions && picker !== null && options[optionIndex] && options[optionIndex].choices && (
					<ChoicePicker
						title={options[optionIndex].label}
						choices={options[optionIndex].choices || []}
						selected={picker}
						current={options[optionIndex].choice || 0}
						onSelect={setPicker}
						onChoose={(i) => { onChoose(options[optionIndex].id, i); setPicker(null); }}
						onClose={() => setPicker(null)}
					/>
				)}
				{reordering && count === 0 && <p class="settings__hint">{tr('Nothing on the home screen yet.')}</p>}
			</div>
		</div>
	);
}
