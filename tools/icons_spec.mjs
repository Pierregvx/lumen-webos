// Brand glyph paths + colours from the Simple Icons package -> JSON for gen_iconpack.py
import * as si from 'simple-icons';
const want = {netflix:'siNetflix', youtube:'siYoutube', plex:'siPlex', spotify:'siSpotify', twitch:'siTwitch', appletv:'siAppletv', jellyfin:'siJellyfin', max:'siHbomax', tubi:'siTubi', paramount:'siParamountplus', homebrew:'siHomebrew', chrome:'siGooglechrome', kodi:'siKodi', crunchyroll:'siCrunchyroll'};
const out = {};
for (const [k, v] of Object.entries(want)) out[k] = {path: si[v].path, hex: '#' + si[v].hex, title: si[v].title};
console.log(JSON.stringify(out));
