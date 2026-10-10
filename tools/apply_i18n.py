#!/usr/bin/env python3
"""Twenty-sixth patch layer: a clock-format option (Auto / 12-hour / 24-hour) and a language switcher.
Language covers the short labels (rows, tabs, menus, Control Center, hints, option names, weather words) and the date format.
The long option descriptions stay English. Anything missing from the table falls back to English."""
import json
import os
APP = os.path.expanduser('~/Developer/webos-launcher-tvos/app')
def P(p): return os.path.join(APP, p)
def sub(p, pairs):
    s = open(P(p)).read()
    for a, b in pairs:
        assert a in s, (p, a[:80])
        s = s.replace(a, b)
    open(P(p), 'w').write(s)

# en, de, es, fr, it, pt, nl, tr, hi
T = [
 ['Apps','Apps','Apps','Applications','App','Apps','Apps','Uygulamalar','ऐप्स'],
 ['More apps','Weitere Apps','Más apps',"Plus d'apps",'Altre app','Mais apps','Meer apps','Daha fazla uygulama','और ऐप्स'],
 ['Recent','Zuletzt','Recientes','Récents','Recenti','Recentes','Recent','Son kullanılanlar','हाल के'],
 ['Sources','Quellen','Fuentes','Sources','Sorgenti','Fontes','Bronnen','Kaynaklar','स्रोत'],
 ['Inputs','Eingänge','Entradas','Entrées','Ingressi','Entradas','Ingangen','Girişler','इनपुट'],
 ['Control Center','Kontrollzentrum','Centro de control','Centre de contrôle','Centro di controllo','Central de controlo','Bedieningscentrum','Denetim Merkezi','कंट्रोल सेंटर'],
 ['Quick Controls','Schnellsteuerung','Controles rápidos','Commandes rapides','Controlli rapidi','Controlos rápidos','Snelbediening','Hızlı Kontroller','त्वरित नियंत्रण'],
 ['Settings','Einstellungen','Ajustes','Réglages','Impostazioni','Definições','Instellingen','Ayarlar','सेटिंग्स'],
 ['Start Screensaver','Bildschirmschoner starten','Iniciar salvapantallas',"Lancer l'économiseur",'Avvia screensaver','Iniciar protetor de ecrã','Schermbeveiliging starten','Ekran koruyucuyu başlat','स्क्रीनसेवर शुरू करें'],
 ['No apps selected — add some in Settings','Keine Apps ausgewählt – in den Einstellungen hinzufügen','Sin apps: añade alguna en Ajustes','Aucune app : ajoutez-en dans Réglages','Nessuna app: aggiungine nelle Impostazioni','Nenhuma app: adicione nas Definições','Geen apps: voeg ze toe in Instellingen',"Uygulama yok — Ayarlar'dan ekleyin",'कोई ऐप नहीं — सेटिंग्स में जोड़ें'],
 ['Wallpaper','Hintergrund','Fondo de pantalla',"Fond d'écran",'Sfondo','Papel de parede','Achtergrond','Duvar kâğıdı','वॉलपेपर'],
 ['Options','Optionen','Opciones','Options','Opzioni','Opções','Opties','Seçenekler','विकल्प'],
 ['Done','Fertig','Listo','Terminé','Fatto','Concluído','Klaar','Bitti','हो गया'],
 ['Re-order apps','Apps anordnen','Reordenar apps',"Réorganiser les apps",'Riordina app','Reordenar apps','Apps herschikken','Uygulamaları sırala','ऐप्स क्रमबद्ध करें'],
 ['Re-order sources','Quellen anordnen','Reordenar fuentes','Réorganiser les sources','Riordina sorgenti','Reordenar fontes','Bronnen herschikken','Kaynakları sırala','स्रोत क्रमबद्ध करें'],
 ['Nothing on the home screen yet.','Noch nichts auf dem Startbildschirm.','Aún no hay nada en la pantalla de inicio.',"Rien sur l'écran d'accueil pour l'instant.",'Ancora niente nella schermata Home.','Ainda nada no ecrã inicial.','Nog niets op het startscherm.','Ana ekranda henüz bir şey yok.','होम स्क्रीन पर अभी कुछ नहीं है।'],
 ['Move with the arrows · OK to drop','Mit Pfeilen verschieben · OK zum Ablegen','Mueve con las flechas · OK para soltar','Déplacez avec les flèches · OK pour déposer','Sposta con le frecce · OK per rilasciare','Mova com as setas · OK para soltar','Verplaats met de pijlen · OK om neer te zetten','Oklarla taşı · Bırakmak için OK','तीरों से खिसकाएं · छोड़ने के लिए OK'],
 ['Move','Verschieben','Mover','Déplacer','Sposta','Mover','Verplaatsen','Taşı','खिसकाएं'],
 ['Remove from Home','Vom Start entfernen','Quitar del inicio',"Retirer de l'accueil",'Rimuovi dalla Home','Remover do início','Van start verwijderen','Ana ekrandan kaldır','होम से हटाएं'],
 ['Add to Games','Zu Spiele hinzufügen','Añadir a Juegos','Ajouter à Jeux','Aggiungi a Giochi','Adicionar a Jogos','Toevoegen aan Games',"Oyunlar'a ekle",'गेम्स में जोड़ें'],
 ['Add to Tools','Zu Tools hinzufügen','Añadir a Herramientas','Ajouter à Outils','Aggiungi a Strumenti','Adicionar a Ferramentas','Toevoegen aan Tools',"Araçlar'a ekle",'टूल्स में जोड़ें'],
 ['Add to Media','Zu Medien hinzufügen','Añadir a Multimedia','Ajouter à Médias','Aggiungi a Media','Adicionar a Multimédia','Toevoegen aan Media',"Medya'ya ekle",'मीडिया में जोड़ें'],
 ['Take out of Folder','Aus Ordner nehmen','Sacar de la carpeta','Sortir du dossier','Togli dalla cartella','Tirar da pasta','Uit map halen','Klasörden çıkar','फ़ोल्डर से निकालें'],
 ['Sound mode','Klangmodus','Modo de sonido','Mode son','Modalità audio','Modo de som','Geluidsmodus','Ses modu','साउंड मोड'],
 ['Picture','Bild','Imagen','Image','Immagine','Imagem','Beeld','Resim','चित्र'],
 ['Sleep timer','Sleep-Timer','Temporizador','Minuterie','Timer di spegnimento','Temporizador','Slaaptimer','Uyku zamanlayıcı','स्लीप टाइमर'],
 ['Screensaver','Bildschirmschoner','Salvapantallas',"Économiseur d'écran",'Screensaver','Protetor de ecrã','Schermbeveiliging','Ekran koruyucu','स्क्रीनसेवर'],
 ['Art mode','Kunstmodus','Modo arte','Mode art','Modalità arte','Modo arte','Kunstmodus','Sanat modu','आर्ट मोड'],
 ['Start now','Jetzt starten','Iniciar ya','Lancer','Avvia ora','Iniciar agora','Nu starten','Şimdi başlat','अभी शुरू करें'],
 ['Screen off','Bildschirm aus','Pantalla off','Écran éteint','Schermo spento','Ecrã desligado','Scherm uit','Ekranı kapat','स्क्रीन बंद'],
 ['Restart','Neustart','Reiniciar','Redémarrer','Riavvia','Reiniciar','Herstarten','Yeniden başlat','रीस्टार्ट'],
 ['Press OK again','OK erneut drücken','Pulsa OK otra vez','Appuyez encore sur OK','Premi di nuovo OK','Prima OK novamente','Druk nogmaals OK',"Tekrar OK'a basın",'फिर OK दबाएं'],
 ['Volume','Lautstärke','Volumen','Volume','Volume','Volume','Volume','Ses','वॉल्यूम'],
 ['Muted','Stumm','Silenciado','Muet','Muto','Sem som','Gedempt','Sessiz','म्यूट'],
 ['Off','Aus','Apagado','Désactivé','Spento','Desligado','Uit','Kapalı','बंद'],
 ['Offline','Offline','Sin conexión','Hors ligne','Offline','Offline','Offline','Çevrimdışı','ऑफ़लाइन'],
 ['After {n} min','Nach {n} Min.','Tras {n} min','Après {n} min','Dopo {n} min','Após {n} min','Na {n} min','{n} dk sonra','{n} मिनट बाद'],
 ['{n} min','{n} Min.','{n} min','{n} min','{n} min','{n} min','{n} min','{n} dk','{n} मिनट'],
 ['Live app list via Homebrew Channel','Live-App-Liste über Homebrew Channel','Lista de apps en vivo (Homebrew Channel)',"Liste d'apps en direct (Homebrew Channel)",'Elenco app live (Homebrew Channel)','Lista de apps em direto (Homebrew Channel)','Live app-lijst via Homebrew Channel','Homebrew Channel ile canlı uygulama listesi','Homebrew Channel से लाइव ऐप सूची'],
 ['Video wallpaper','Video-Hintergrund','Fondo de vídeo','Fond vidéo','Sfondo video','Papel de parede em vídeo','Videoachtergrond','Video duvar kâğıdı','वीडियो वॉलपेपर'],
 ['Show system apps','Systemapps anzeigen','Mostrar apps del sistema','Afficher les apps système','Mostra app di sistema','Mostrar apps do sistema','Systeem-apps tonen','Sistem uygulamalarını göster','सिस्टम ऐप्स दिखाएं'],
 ['Date and weather','Datum und Wetter','Fecha y tiempo','Date et météo','Data e meteo','Data e meteorologia','Datum en weer','Tarih ve hava durumu','तारीख और मौसम'],
 ['Weather city','Wetter-Ort','Ciudad del tiempo','Ville météo','Città meteo','Cidade do tempo','Weerstad','Hava durumu şehri','मौसम शहर'],
 ['Change wallpaper automatically','Hintergrund automatisch wechseln','Cambiar fondo automáticamente','Changer le fond automatiquement','Cambia sfondo automaticamente','Mudar papel de parede automaticamente','Achtergrond automatisch wisselen','Duvar kâğıdını otomatik değiştir','वॉलपेपर अपने आप बदलें'],
 ['Dim the wallpaper at night','Hintergrund nachts abdunkeln','Atenuar fondo de noche',"Assombrir le fond la nuit",'Scurisci lo sfondo di notte','Escurecer papel de parede à noite',"Achtergrond 's nachts dimmen",'Geceleri duvar kâğıdını karart','रात में वॉलपेपर मंद करें'],
 ['AM/PM on the clock','AM/PM an der Uhr','AM/PM en el reloj',"AM/PM sur l'horloge",'AM/PM sull\'orologio','AM/PM no relógio','AM/PM op de klok','Saatte AM/PM','घड़ी में AM/PM'],
 ['Clock','Uhr','Reloj','Horloge','Orologio','Relógio','Klok','Saat','घड़ी'],
 ['Language','Sprache','Idioma','Langue','Lingua','Idioma','Taal','Dil','भाषा'],
 ['Auto','Automatisch','Automático','Auto','Automatico','Automático','Automatisch','Otomatik','स्वचालित'],
 ['12-hour','12 Stunden','12 horas','12 heures','12 ore','12 horas','12 uur','12 saat','12 घंटे'],
 ['24-hour','24 Stunden','24 horas','24 heures','24 ore','24 horas','24 uur','24 saat','24 घंटे'],
 ['Clear','Klar','Despejado','Dégagé','Sereno','Limpo','Helder','Açık','साफ'],
 ['Partly cloudy','Teils bewölkt','Parcialmente nublado','Partiellement nuageux','Parzialmente nuvoloso','Parcialmente nublado','Half bewolkt','Parçalı bulutlu','आंशिक बादल'],
 ['Cloudy','Bewölkt','Nublado','Nuageux','Nuvoloso','Nublado','Bewolkt','Bulutlu','बादल'],
 ['Fog','Nebel','Niebla','Brouillard','Nebbia','Nevoeiro','Mist','Sis','कोहरा'],
 ['Rain','Regen','Lluvia','Pluie','Pioggia','Chuva','Regen','Yağmur','बारिश'],
 ['Snow','Schnee','Nieve','Neige','Neve','Neve','Sneeuw','Kar','बर्फ'],
 ['Showers','Schauer','Chubascos','Averses','Rovesci','Aguaceiros','Buien','Sağanak','बौछारें'],
 ['Storm','Gewitter','Tormenta','Orage','Temporale','Tempestade','Onweer','Fırtına','तूफ़ान'],
 ['OK adds or removes an item · Hold OK to re-order · Back returns home','OK fügt hinzu oder entfernt · OK halten zum Anordnen · Zurück zum Start','OK añade o quita · Mantén OK para reordenar · Atrás vuelve al inicio',"OK ajoute ou retire · Maintenez OK pour réorganiser · Retour revient à l'accueil",'OK aggiunge o rimuove · Tieni OK per riordinare · Indietro torna alla Home','OK adiciona ou remove · Mantenha OK para reordenar · Voltar regressa ao início','OK voegt toe of verwijdert · Houd OK ingedrukt om te herschikken · Terug naar start',"OK ekler veya kaldırır · Sıralamak için OK'a basılı tutun · Geri ana ekrana döner",'OK से जोड़ें या हटाएं · क्रम बदलने के लिए OK दबाए रखें · वापस जाने के लिए Back'],
 ['OK picks up an item · Hold OK or choose Done to finish','OK nimmt auf · OK halten oder Fertig zum Beenden','OK coge un elemento · Mantén OK o elige Listo para terminar','OK saisit un élément · Maintenez OK ou choisissez Terminé','OK prende un elemento · Tieni OK o scegli Fatto per finire','OK agarra um item · Mantenha OK ou escolha Concluído','OK pakt een item op · Houd OK ingedrukt of kies Klaar',"OK öğeyi alır · Bitirmek için OK'a basılı tutun veya Bitti'yi seçin",'OK से आइटम उठाएं · खत्म करने के लिए OK दबाए रखें या हो गया चुनें'],
 ['Arrows move it · OK puts it down · Back cancels','Pfeile bewegen · OK legt ab · Zurück bricht ab','Flechas mueven · OK suelta · Atrás cancela','Flèches pour déplacer · OK pour poser · Retour annule','Frecce per spostare · OK per posare · Indietro annulla','Setas movem · OK pousa · Voltar cancela','Pijlen verplaatsen · OK zet neer · Terug annuleert','Oklar taşır · OK bırakır · Geri iptal eder','तीर खिसकाते हैं · OK छोड़ता है · Back रद्द करता है'],
 ['OK turns an option on or off · Back returns home','OK schaltet eine Option ein oder aus · Zurück zum Start','OK activa o desactiva una opción · Atrás vuelve al inicio',"OK active ou désactive une option · Retour revient à l'accueil","OK attiva o disattiva un'opzione · Indietro torna alla Home",'OK liga ou desliga uma opção · Voltar regressa ao início','OK zet een optie aan of uit · Terug naar start','OK seçeneği açar veya kapatır · Geri ana ekrana döner','OK से विकल्प चालू या बंद करें · वापस जाने के लिए Back'],
 ['Left and right change category · OK sets the wallpaper · hold OK adds it to Favorites · Back returns home','Links/Rechts wechselt Kategorie · OK setzt Hintergrund · OK halten = Favorit · Zurück zum Start','Izquierda/derecha cambia categoría · OK fija el fondo · Mantén OK para favoritos · Atrás vuelve','Gauche/droite change de catégorie · OK applique · Maintenez OK pour favori · Retour','Sinistra/destra cambia categoria · OK imposta · Tieni OK per i preferiti · Indietro','Esquerda/direita muda categoria · OK define · Mantenha OK para favoritos · Voltar','Links/rechts wisselt categorie · OK stelt in · Houd OK voor favoriet · Terug',"Sol/sağ kategori değiştirir · OK ayarlar · Favori için OK'a basılı tutun · Geri",'बाएं/दाएं से श्रेणी बदलें · OK से सेट करें · पसंदीदा के लिए OK दबाए रखें · Back'],
]
ORDER = ['de', 'es', 'fr', 'it', 'pt', 'nl', 'tr', 'hi']
table = {r[0]: r[1:] for r in T}
for r in T: assert len(r) == 9, r[0]

open(P('src/lib/i18n.ts'), 'w').write("""// Short UI labels in nine languages. Missing entries fall back to the English text, so anything not listed (folder names, app names,
// the long option descriptions) is shown as written.

export const LANGS = [
	{code: 'en', name: 'English', locale: 'en-US'},
	{code: 'de', name: 'Deutsch', locale: 'de-DE'},
	{code: 'es', name: 'Español', locale: 'es-ES'},
	{code: 'fr', name: 'Français', locale: 'fr-FR'},
	{code: 'it', name: 'Italiano', locale: 'it-IT'},
	{code: 'pt', name: 'Português', locale: 'pt-PT'},
	{code: 'nl', name: 'Nederlands', locale: 'nl-NL'},
	{code: 'tr', name: 'Türkçe', locale: 'tr-TR'},
	{code: 'hi', name: 'हिन्दी', locale: 'hi-IN'}
];
const ORDER = %s;
const TABLE: Record<string, string[]> = %s;

let current = 'en';
let clockMode = 'auto';

/** 'auto' follows the TV (webOS sets navigator.language to its menu language) */
export function setLang (pref: string): void {
	const base = (pref === 'auto' ? (navigator.language || 'en') : pref).slice(0, 2).toLowerCase();
	current = LANGS.some((l) => l.code === base) ? base : 'en';
}
export function langLocale (): string {
	return LANGS.filter((l) => l.code === current)[0].locale;
}
export function setClockMode (mode: string): void { clockMode = mode; }
export function getClockMode (): string { return clockMode; }

export function t (text: string, vars?: {n: number}): string {
	const row = TABLE[text];
	const at = ORDER.indexOf(current);
	let out = row && at >= 0 && row[at] ? row[at] : text;
	if (vars) out = out.replace('{n}', String(vars.n));
	return out;
}
""" % (json.dumps(ORDER), json.dumps(table, ensure_ascii=False, indent='\t')))

# ---- config
sub('src/lib/storage.ts', [
 ("	/** the last apps opened, newest first */", "	/** menu language: 'auto' follows the TV, else a code from lib/i18n.ts */\n	language: string;\n	/** 'auto' follows the TV's 12/24-hour setting, else '12h' or '24h' */\n	clockFormat: string;\n	/** the last apps opened, newest first */"),
 ("	showAmPm: true,\n", "	showAmPm: true,\n	language: 'auto',\n	clockFormat: 'auto',\n"),
 ("			showAmPm: parsed.showAmPm !== false,\n", "			showAmPm: parsed.showAmPm !== false,\n			language: typeof parsed.language === 'string' ? parsed.language : 'auto',\n			clockFormat: parsed.clockFormat === '12h' || parsed.clockFormat === '24h' ? parsed.clockFormat : 'auto',\n"),
])

# ---- clock + date
sub('src/components/Clock.tsx', [
 ("import {useTimeFormat} from '../hooks/useTimeFormat';", "import {useTimeFormat} from '../hooks/useTimeFormat';\nimport {getClockMode} from '../lib/i18n';"),
 ("	const format = useTimeFormat();\n	const {time, period} = timeParts(now, format);", "	const tvFormat = useTimeFormat();\n	const mode = getClockMode();\n	const {time, period} = timeParts(now, mode === '12h' || mode === '24h' ? mode : tvFormat);"),
])
sub('src/components/Status.tsx', [
 ("import {Clock} from './Clock';", "import {Clock} from './Clock';\nimport {langLocale} from '../lib/i18n';"),
 ("new Date().toLocaleDateString('en-US', {weekday: 'short', month: 'short', day: 'numeric'}).replace(',', '')",
  "(() => { try { return new Date().toLocaleDateString(langLocale(), {weekday: 'short', month: 'short', day: 'numeric'}).replace(',', ''); } catch { return new Date().toDateString(); } })()"),
 ("	const [date, setDate] = useState(dateText);\n", "	const [, bump] = useState(0);\n	const date = dateText();\n"),
 ("if (!document.hidden) setDate(dateText());", "if (!document.hidden) bump((n) => n + 1);"),
])

# ---- Home
s = open(P('src/screens/Home.tsx')).read()
for a, b in [
 ('<span class="pill__label">{item.label}</span>', '<span class="pill__label">{tr(item.label)}</span>'),
 ('label={row.label}', 'label={tr(row.label)}'),
 ('emptyText={row.emptyText}', 'emptyText={row.emptyText && tr(row.emptyText)}'),
 ('<div class="panel__title">Inputs</div>', '<div class="panel__title">{tr(\'Inputs\')}</div>'),
 ('>Move with the arrows · OK to drop</div>', ">{tr('Move with the arrows · OK to drop')}</div>"),
 ('<span>{label}</span>', '<span>{tr(label)}</span>'),
 ('<span>{item.label}</span>', '<span>{tr(item.label)}</span>'),
]:
    assert a in s, a
    s = s.replace(a, b)
open(P('src/screens/Home.tsx'), 'w').write("import {t as tr} from '../lib/i18n';\n" + s)

# ---- Settings
s = open(P('src/screens/Settings.tsx')).read()
for a, b in [
 ('<h1 class="settings__title">Settings</h1>', '<h1 class="settings__title">{tr(\'Settings\')}</h1>'),
 ('<p class="settings__hint">{hint}</p>', '<p class="settings__hint">{tr(hint)}</p>'),
 ('\t\t\t\t\t\t\t{label}\n\t\t\t\t\t\t</div>', '\t\t\t\t\t\t\t{tr(label)}\n\t\t\t\t\t\t</div>'),
 ("{reordering ? 'Done' : `Re-order ${tab.noun}`}", "{reordering ? tr('Done') : tr(`Re-order ${tab.noun}`)}"),
 ('<p class="settings__hint">Nothing on the home screen yet.</p>', "<p class=\"settings__hint\">{tr('Nothing on the home screen yet.')}</p>"),
]:
    assert a in s, a
    s = s.replace(a, b)
open(P('src/screens/Settings.tsx'), 'w').write("import {t as tr} from '../lib/i18n';\n" + s)

# ---- Control Center
s = open(P('src/components/ControlCenter.tsx')).read()
for a, b in [
 ("cell === 'restart' && confirm ? 'Press OK again' : label", "tr(cell === 'restart' && confirm ? 'Press OK again' : label)"),
 ('<span class="cc__title">Control Center</span>', '<span class="cc__title">{tr(\'Control Center\')}</span>'),
 ("net === 'ethernet' ? 'Ethernet' : 'Offline'", "net === 'ethernet' ? 'Ethernet' : tr('Offline')"),
 ("'speaker', 'Sound mode',", "'speaker', tr('Sound mode'),"),
 ("'picture', 'Picture',", "'picture', tr('Picture'),"),
 ("'timer', 'Sleep timer', values.sleepMinutes ? `${values.sleepMinutes} min` : 'Off',", "'timer', tr('Sleep timer'), values.sleepMinutes ? tr('{n} min', {n: values.sleepMinutes}) : tr('Off'),"),
 ("'screensaver', 'Screensaver', `After ${values.screensaver} min`", "'screensaver', tr('Screensaver'), tr('After {n} min', {n: values.screensaver})"),
 ("round('home', 'house', 'LG Home')", "round('home', 'house', tr('LG Home'))"),
 ("round('settings', 'gear', 'Settings')", "round('settings', 'gear', tr('Settings'))"),
 ("round('art', 'picture', 'Art mode')", "round('art', 'picture', tr('Art mode'))"),
 ("round('startsaver', 'screensaver', 'Start now')", "round('startsaver', 'screensaver', tr('Start now'))"),
 ("round('screenoff', 'power', 'Screen off')", "round('screenoff', 'power', tr('Screen off'))"),
 ("round('restart', 'restart', 'Restart')", "round('restart', 'restart', tr('Restart'))"),
 ("<span>Volume</span><span class=\"cc__num\">{values.muted ? 'Muted' : values.volume}</span>", "<span>{tr('Volume')}</span><span class=\"cc__num\">{values.muted ? tr('Muted') : values.volume}</span>"),
]:
    assert a in s, a
    s = s.replace(a, b)
open(P('src/components/ControlCenter.tsx'), 'w').write("import {t as tr} from '../lib/i18n';\n" + s)

# ---- App: options, cycling, weather words
sub('src/app.tsx', [
 ("import {readWeather} from './lib/weather';", "import {readWeather} from './lib/weather';\nimport {LANGS, setClockMode, setLang, t as tr} from './lib/i18n';"),
 ("nightDim: 'night-dim'}", "nightDim: 'night-dim', language: 'language', clock: 'clock-format'}"),
 ("	const [config, setConfig] = useState<UserConfig>(loadConfig);\n", "	const [config, setConfig] = useState<UserConfig>(loadConfig);\n	// set before anything renders, so every label below reads the chosen language and clock\n	setLang(config.language);\n	setClockMode(config.clockFormat);\n"),
 ("`${w.place ? w.place + ' \\u00b7 ' : ''}${w.temp}\\u00b0 ${w.label}`", "`${w.place ? w.place + ' \\u00b7 ' : ''}${w.temp}\\u00b0 ${tr(w.label)}`"),
 ("}, [config.showWeather, config.weatherCity]);", "}, [config.showWeather, config.weatherCity, config.language]);"),
 ("label: 'Apps', items: homeTiles.slice(0, FIRST_ROW), emptyText: 'No apps selected — add some in Settings'}", "label: 'Apps', items: homeTiles.slice(0, FIRST_ROW), emptyText: 'No apps selected — add some in Settings'}"),
 ("], [homeTiles, shownInputs, recentApps]);", "], [homeTiles, shownInputs, recentApps, config.language]);"),
 ("], [apps, inputs, shownApps, shownInputs]);", "], [apps, inputs, shownApps, shownInputs, config.language]);"),
 ("], [config.useHomebrew, config.videoWallpaper, config.showAmPm, config.idleMinutes,", "], [config.language, config.clockFormat, config.useHomebrew, config.videoWallpaper, config.showAmPm, config.idleMinutes,"),
 ("		else if (optionId === OPTION.showAmPm)", "		else if (optionId === OPTION.language) {\n			const codes = ['auto'].concat(LANGS.map((l) => l.code));\n			updateConfig({...config, language: codes[(codes.indexOf(config.language) + 1) % codes.length]});\n		} else if (optionId === OPTION.clock) {\n			const modes = ['auto', '12h', '24h'];\n			updateConfig({...config, clockFormat: modes[(modes.indexOf(config.clockFormat) + 1) % modes.length]});\n		} else if (optionId === OPTION.showAmPm)"),
 ("		{\n			id: OPTION.showAmPm,", "		{\n			id: OPTION.language,\n			label: 'Language',\n			description: \"Language of the menus, dates and weather. Auto follows the TV. The long descriptions on this screen stay in English.\",\n			value: config.language !== 'auto',\n			valueText: config.language === 'auto' ? 'Auto' : (LANGS.filter((l) => l.code === config.language)[0] || LANGS[0]).name\n		},\n		{\n			id: OPTION.clock,\n			label: 'Clock',\n			description: \"Auto follows the TV's own 12/24-hour setting. Choose 12-hour or 24-hour to override it.\",\n			value: config.clockFormat !== 'auto',\n			valueText: config.clockFormat === '12h' ? '12-hour' : config.clockFormat === '24h' ? '24-hour' : 'Auto'\n		},\n		{\n			id: OPTION.showAmPm,"),
])
# option labels, rows and valueText go through the dictionary where they are drawn
sub('src/components/OptionList.tsx', [
 ('<div class="option__label">{o.label}</div>', '<div class="option__label">{tr(o.label)}</div>'),
 ('<div class="option__value">{o.valueText}</div>', '<div class="option__value">{tr(o.valueText)}</div>'),
])
s = open(P('src/components/OptionList.tsx')).read()
open(P('src/components/OptionList.tsx'), 'w').write("import {t as tr} from '../lib/i18n';\n" + s)

# the weather phrase is translated where it is built; the one-word labels live in the table
print('i18n layer applied')
