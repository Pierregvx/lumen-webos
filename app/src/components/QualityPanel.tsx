import {useCallback, useEffect, useRef, useState} from 'preact/hooks';
import {t as tr} from '../lib/i18n';
import {useKeys, clamp, type NavKey} from '../hooks/useKeys';
import {useOkPress} from '../hooks/useOkPress';
import type {SeerrTitle} from '../lib/seerr';
import type {RequestFacts, RequestOffer, RequestOptions, RequestQuality, SourceLevel} from '../plugins/api';

interface Props {
	title: SeerrTitle;
	/** a series' seasons being asked (none: a film) */
	seasons?: number[];
	/** what the catalog offers (the pictures, « Right now »); null: the panel only confirms the request */
	offer: RequestOffer | null;
	/** each picture's sources, as they come (a few seconds); null or a failure: drawn without them */
	facts?: Promise<RequestFacts | null>;
	active: boolean;
	onRequest: (options: RequestOptions) => void;
	onClose: () => void;
}

const LABEL: Record<RequestQuality, string> = {best: 'Best available', '2160p': '4K', '1080p': '1080p', '720p': '720p'};
const LEVEL: Record<SourceLevel, string> = {fast: 'Fast download', ok: 'Downloadable', slow: 'Slow: few sources', none: 'Not found for now'};

const sizeText = (bytes: number) => (bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.round(bytes / 1e6)} MB`);

/** The last step of a request from the TV, as the page's « Quelle qualité ? » (Ciné Pierro's QualityDialog): one row per picture with what
 *  it can expect (its level, sources, size, once the catalog has looked), OK on one asks in that picture; « Right now » is a row ticked with
 *  OK. The focus starts on the picture the catalog picks (the sharpest that comes), so the request is always one more OK, never the
 *  second OK on a poster. Without an offer (Lumen's own Seerr calls) it is one row, Request: a confirmation. Back cancels. */
export function QualityPanel ({title, seasons, offer, facts, active, onRequest, onClose}: Props) {
	const pictures: RequestQuality[] = offer && offer.qualities.length ? offer.qualities : [];
	const withNow = !!offer && offer.now;
	const [known, setKnown] = useState<RequestFacts | null | undefined>(facts ? undefined : null);
	const [now, setNow] = useState(false);
	/** rows: each picture (or one Request row), then « Right now » */
	const count = Math.max(1, pictures.length) + (withNow ? 1 : 0);
	const [at, setAt] = useState(() => Math.max(0, pictures.indexOf('best')));
	const moved = useRef(false);
	useEffect(() => {
		if (!facts) return undefined;
		let gone = false;
		facts.then((f) => {
			if (gone) return;
			setKnown(f || null);
			// the catalog's pick, unless the person has already moved
			const i = f && f.pick ? pictures.indexOf(f.pick) : -1;
			if (i >= 0 && !moved.current) setAt(i);
		}, () => { if (!gone) setKnown(null); });
		return () => { gone = true; };
	}, [facts]);

	const handleKey = useCallback((key: NavKey): boolean => {
		if (key === 'back') onClose();
		else if (key === 'up' || key === 'down') { moved.current = true; setAt((a) => clamp(a + (key === 'down' ? 1 : -1), 0, count - 1)); }
		return true;
	}, [count, onClose]);
	useKeys(handleKey, active);
	const pick = (i: number) => {
		if (withNow && i === count - 1) { setNow((x) => !x); return; }
		onRequest(pictures.length ? {quality: pictures[i], now: withNow && now} : {});
	};
	useOkPress({onPress: () => pick(at), onLongPress: () => undefined}, active);

	const facts1 = (q: RequestQuality): string => {
		if (known === undefined) return tr('Looking…');
		const f = known && known.levels[q];
		if (!f) return '';
		return [tr(LEVEL[f.level]), f.seeders ? `${f.seeders} ${tr('sources')}` : '', f.size ? sizeText(f.size) : ''].filter(Boolean).join(' · ');
	};
	const what = seasons && seasons.length ? ` · ${seasons.length === 1 ? `${tr('Season')} ${seasons[0]}` : `${seasons.length} ${tr('seasons')}`}` : '';
	const row = (i: number, text: string, side: string, tone?: string) => (
		<div key={i} class={`media-ask__row${i === at ? ' media-ask__row--focused' : ''}`} onMouseEnter={() => setAt(i)} onClick={() => pick(i)}>
			<span>{text}</span>
			{side && <span class={`media-ask__facts${tone ? ' media-ask__facts--' + tone : ''}`}>{side}</span>}
		</div>
	);
	return (
		<div class="media-ask">
			<div class="media-ask__box">
				<h2 class="media-ask__title">{tr(pictures.length ? 'Which picture?' : 'Request it?')}</h2>
				<p class="media-rate__ask media-ask__note">{title.title}{what}</p>
				<div class="media-ask__list">
					{pictures.length
						? pictures.map((q, i) => row(i, tr(LABEL[q]), facts1(q), known && known.levels[q] ? known.levels[q]!.level : undefined))
						: row(0, '+ ' + tr('Request'), '')}
					{withNow && row(count - 1, tr('Right now'), now ? '✓' : tr('Off-peak hours'))}
				</div>
				{known && known.note && <p class="media-rate__ask">{known.note}</p>}
			</div>
		</div>
	);
}
