#!/usr/bin/env python3
"""Thirty-eighth patch layer: a real light look. Appearance (was "Dark mode") is Light / Dark / Auto: Light = bright frosted glass with dark text, Dark = the dark glass.
Auto = dark from 7 pm to 6 am."""
import os
APP = os.path.expanduser('~/Developer/webos-launcher-tvos/app')
def P(p): return os.path.join(APP, p)
def sub(p, pairs):
    s = open(P(p)).read()
    for a, b in pairs:
        assert a in s, (p, a[:80])
        s = s.replace(a, b)
    open(P(p), 'w').write(s)

sub('src/app.tsx', [
 ("const apply = () => document.documentElement.classList.toggle('dark', isDark(config.darkMode));", "const apply = () => { const dark = isDark(config.darkMode); document.documentElement.classList.toggle('dark', dark); document.documentElement.classList.toggle('light', !dark); };"),
 ("label: 'Dark mode',", "label: 'Appearance',"),
 ("description: 'Darker panels and dock, and a dimmer wallpaper or video behind them. Auto is dark from 7 pm to 6 am.',", "description: 'Light: bright glass with dark text. Dark: dark glass and a dimmer wallpaper or video. Auto is dark from 7 pm to 6 am.',"),
 ("valueText: config.darkMode === 'on' ? 'On' : config.darkMode === 'auto' ? 'Auto' : 'Off'", "valueText: config.darkMode === 'on' ? 'Dark' : config.darkMode === 'auto' ? 'Auto' : 'Light'"),
 ("value: config.darkMode !== 'off',", "value: config.darkMode !== 'off',"),
])
sub('src/components/ControlCenter.tsx', [
 ("tr('Dark mode'), darkMode === 'on' ? tr('On') : darkMode === 'auto' ? tr('Auto') : tr('Off'), darkMode !== 'off')", "tr('Appearance'), darkMode === 'on' ? tr('Dark') : darkMode === 'auto' ? tr('Auto') : tr('Light'), darkMode === 'on')"),
])
sub('src/lib/i18n.ts', [
 ("const TABLE: Record<string, string[]> = {", "const TABLE: Record<string, string[]> = {\n\t\"Appearance\": [\"Darstellung\", \"Apariencia\", \"Apparence\", \"Aspetto\", \"Aspeto\", \"Weergave\", \"Görünüm\", \"दिखावट\"],\n\t\"Light\": [\"Hell\", \"Claro\", \"Clair\", \"Chiaro\", \"Claro\", \"Licht\", \"Açık\", \"लाइट\"],\n\t\"Dark\": [\"Dunkel\", \"Oscuro\", \"Sombre\", \"Scuro\", \"Escuro\", \"Donker\", \"Koyu\", \"डार्क\"],"),
])
s = open(P('src/theme/global.css')).read()
s += """
/* ---------- light look (Appearance: Light): bright frosted glass, dark text ---------- */
html.light {
	--color-text-primary: #14151b !important;
	--color-text-secondary: #43465a !important;
	--color-text-muted: #5d6072 !important;
}
/* light glass: the blurred wallpaper copy, lifted with a light colour (screen blend), so it reads as frosted glass with the picture showing through */
html.light .row:not(.row--dock)::before, html.light .clock, html.light .row--dock .tile__box, html.light .wp__chip, html.light .option, html.light .settings__button,
html.light .pill, html.light .panel, html.light .tabbar, html.light .topcap {
	background-color: rgb(120, 128, 148);
	background-blend-mode: normal, screen;
}
html.light.wp-video {
	--wp-blur: linear-gradient(rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0.42)) !important;
	--wp-bg: linear-gradient(rgba(255, 255, 255, 0.58), rgba(255, 255, 255, 0.58)) !important;
}
html.light .row:not(.row--dock)::before { box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.85), 0 18px 40px rgba(20, 24, 40, 0.20); }
html.light .row:not(.row--dock)::after { display: none; }
html.light .clock, html.light .row--dock .tile__box { box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.85), 0 8px 18px rgba(20, 24, 40, 0.18); }
html.light .wp__chip, html.light .option, html.light .settings__button { box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.8), 0 4px 12px rgba(20, 24, 40, 0.12); }
html.light .status { background-image: none !important; background-color: transparent !important; box-shadow: none !important; }
html.light .status, html.light .status * { color: #fff !important; text-shadow: 0 1px 8px rgba(0, 0, 0, 0.45); }
html.light .screen.screen--settings, html.light .wp-image .screen.screen--settings, html.light .wp-video .screen.screen--settings { background: rgba(243, 244, 249, 0.97); }
html.light .tab--active { background-color: rgba(20, 24, 40, 0.10); color: #14151b; }
html.light .settings__hint, html.light .option__description { color: rgba(20, 22, 32, 0.62); }
html.light .tab { color: rgba(20, 22, 32, 0.72); }
html.light .tab--focused, html.light .wp__chip--focused, html.light .settings__button--focused, html.light .menu__row--focused, html.light .cc__tile--focused, html.light .cc__circle--focused, html.light .pill--focused, html.light .topcap--focused { background-color: #14151b !important; color: #fff !important; box-shadow: 0 8px 18px rgba(20, 24, 40, 0.30); }
html.light .panel { background-image: linear-gradient(rgba(255, 255, 255, 0.10), rgba(255, 255, 255, 0.10)), var(--wp-blur) !important; box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.85), 0 24px 60px rgba(20, 24, 40, 0.28); }
html.light .cc__tile { background: rgba(255, 255, 255, 0.36); box-shadow: 0 2px 8px rgba(20, 24, 40, 0.10); }
html.light .cc__badge { background: rgba(20, 24, 40, 0.10); }
html.light .cc__badge svg, html.light .cc__circle svg, html.light .menu__row svg, html.light .pill svg, html.light .topcap svg { stroke: rgba(20, 22, 32, 0.72); }
html.light .cc__tile--on .cc__badge { background: #14151b; }
html.light .cc__tile--on .cc__badge svg { stroke: #fff; }
html.light .cc__circle { background: rgba(255, 255, 255, 0.42); box-shadow: 0 2px 8px rgba(20, 24, 40, 0.10); }
html.light .cc__slider { background: rgba(255, 255, 255, 0.40); box-shadow: 0 2px 8px rgba(20, 24, 40, 0.10); }
html.light .cc__fill { background: rgba(20, 24, 40, 0.20); }
html.light .cc__slidertext, html.light .cc__slidertext svg { color: #14151b; stroke: #14151b; }
html.light .cc__tile--focused .cc__badge { background: rgba(255, 255, 255, 0.18); }
html.light .cc__tile--focused .cc__badge svg, html.light .cc__circle--focused svg, html.light .menu__row--focused svg, html.light .pill--focused svg, html.light .topcap--focused svg { stroke: #fff; }
html.light .cc__slider--focused { box-shadow: 0 0 0 4px #14151b; }
"""
open(P('src/theme/global.css'), 'w').write(s)
