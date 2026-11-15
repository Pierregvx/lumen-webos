// French on a French TV: the visible texts of Films & series, the player, the panels and every message (toast) have a French line in
// src/lib/i18n.ts. Run: npm --prefix app test (Node 22.6 or later).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {setLang, t} from '../src/lib/i18n.ts';

const FILES = ['screens/Media.tsx', 'screens/Player.tsx', 'components/RequestPanel.tsx', 'components/RatePanel.tsx', 'components/Poster.tsx', 'components/ControlCenter.tsx', 'app.tsx'];
// the same word in French
const SAME = new Set(['Auto', 'Film', 'Films', 'Guide', 'Pause', 'Plugins', 'Settings']);
const unescape = (s) => s.replace(/\\'/g, "'").replace(/\\"/g, '"');

test('the texts of the screens and every toast have a French line', () => {
	setLang('fr');
	const missing = [];
	for (const f of FILES) {
		const src = fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');
		const calls = [...src.matchAll(/\b(?:tr|showToast|onToast|onError|toast)\(\s*(['"])((?:(?!\1)[^\\\n]|\\.)*)\1/g)].map((m) => unescape(m[2]));
		// a template with a name inside (`Couldn't open ${label}`): tried with a sample name
		const templates = [...src.matchAll(/\b(?:showToast|onToast|onError)\(\s*`([^`]*)`/g)].map((m) => m[1]).filter((x) => x.indexOf('${') >= 0 && x.indexOf('tr(') < 0)
			.map((x) => x.replace(/\$\{[^}]*\}/g, 'Sample'));
		for (const text of [...calls, ...templates]) {
			if (SAME.has(text) || !/[a-z]/i.test(text.replace(/Sample/g, ''))) continue;
			if (t(text) === text) missing.push(`${f}: ${text}`);
		}
	}
	assert.deepEqual(missing, []);
});

test('known visible texts', () => {
	setLang('fr');
	for (const [en, fr] of [['Trailer', 'Bande-annonce'], ['Cast', 'Distribution'], ['Available', 'Disponible'], ['All seasons', 'Toutes les saisons'], ['Season', 'Saison'],
		['Next episode', 'Épisode suivant'], ['Keep watching', 'Continuer'], ['Recently added', 'Ajoutés récemment'], ["Couldn't open Netflix", "Impossible d'ouvrir Netflix"],
		['Quick Connect code 123456: type it in Jellyfin, avatar > Quick Connect', 'Code Quick Connect 123456 : tape-le dans Jellyfin, avatar > Quick Connect']]) assert.equal(t(en), fr);
	setLang('en');
	assert.equal(t('Trailer'), 'Trailer');
});
