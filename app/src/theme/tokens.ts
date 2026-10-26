// Layout numbers that both the code and the stylesheet need: `applyTokens()` writes them onto :root as --layout-* custom properties.
// Colours, glass, shapes and timings live in tokens.css, since only the stylesheet reads them.

export const LAYOUT = {
	screenWidth: 1920,
	screenHeight: 1080,
	edgePadding: 140,       // the screen's padding and the video caption; Settings uses rowsEdge, as home does
	rowsEdge: 125,          // home's rows, the Guide and the panels: tiles from 125px, the glass bar 40px beyond them
	headerTop: 84,
	rowsTop: 846,           // the glass bar sits low, so the first grid row peeks in under it
	tileSize: 236,          // app and input tiles are 5:3 landscape, as Apple TV's home-screen icons
	tileHeight: 142,
	tileGap: 28,
	tileRadius: 34,
	rowGap: 40,             // vertical space between rows
	gridColumns: 6          // Settings' picker grid
} as const;

/** Writes every layout number onto :root as --layout-*, in px (gridColumns as a plain number). */
export function applyTokens (root: HTMLElement = document.documentElement): void {
	for (const key in LAYOUT) {
		const value = LAYOUT[key as keyof typeof LAYOUT];
		root.style.setProperty(`--layout-${kebab(key)}`, key === 'gridColumns' ? String(value) : `${value}px`);
	}
}

function kebab (s: string): string {
	return s.replace(/([A-Z])/g, '-$1').toLowerCase();
}
