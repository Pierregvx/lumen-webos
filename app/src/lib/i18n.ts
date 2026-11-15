// Short UI labels in nine languages. Missing entries fall back to the English text, so anything not listed (folder names, app names,
// the long option descriptions) is shown as written.

export const LANGS = [
	{code: 'en', name: 'English', locale: 'en-US'},
	{code: 'de', name: 'Deutsch', locale: 'de-DE'},
	{code: 'es', name: 'Español', locale: 'es-ES'},
	{code: 'fr', name: 'Français', locale: 'fr-FR'},
	{code: 'it', name: 'Italiano', locale: 'it-IT'},
	{code: 'pt', name: 'Português', locale: 'pt-BR'},
	{code: 'nl', name: 'Nederlands', locale: 'nl-NL'},
	{code: 'tr', name: 'Türkçe', locale: 'tr-TR'},
	{code: 'hi', name: 'हिन्दी', locale: 'hi-IN'}
];
const ORDER = ["de", "es", "fr", "it", "pt", "nl", "tr", "hi"];
const TABLE: Record<string, string[]> = {
	"Home Screen": ["Startbildschirm", "Pantalla de inicio", "Écran d'accueil", "Schermata Home", "Ecrã principal", "Startscherm", "Ana ekran", "होम स्क्रीन"],
	"Weather": ["Wetter", "Tiempo", "Météo", "Meteo", "Tempo", "Weer", "Hava durumu", "मौसम"],
	"Language and Clock": ["Sprache und Uhr", "Idioma y reloj", "Langue et horloge", "Lingua e orologio", "Idioma e relógio", "Taal en klok", "Dil ve saat", "भाषा और घड़ी"],
	"Language and Region": ["Sprache und Region", "Idioma y región", "Langue et région", "Lingua e regione", "Idioma e região", "Taal en regio", "Dil ve bölge", "भाषा और क्षेत्र"],
	"Photos": ["Fotos", "Fotos", "Photos", "Foto", "Fotos", "Foto's", "Fotoğraflar", "फ़ोटो"],
	"System": ["System", "Sistema", "Système", "Sistema", "Sistema", "Systeem", "Sistem", "सिस्टम"],
	"Choose wallpaper": ["Hintergrund wählen", "Elegir fondo", "Choisir le fond d'écran", "Scegli sfondo", "Escolher fundo", "Achtergrond kiezen", "Duvar kağıdı seç", "वॉलपेपर चुनें"],
	"Hold OK to add a channel to the Live TV row, or take it off": ["OK gedrückt halten: Sender in die Live-TV-Reihe oder heraus", "Mantén OK para añadir un canal a la fila de TV en directo o quitarlo", "OK maintenu : ajouter la chaîne à la rangée TV en direct, ou l'en retirer", "Tieni premuto OK per aggiungere o togliere un canale dalla fila TV in diretta", "Mantenha OK para pôr ou tirar um canal da fila de TV em direto", "Houd OK ingedrukt om een zender aan de rij Live tv toe te voegen of eruit te halen", "Kanalı Canlı TV satırına eklemek veya çıkarmak için OK'a basılı tutun", "लाइव टीवी पंक्ति में चैनल जोड़ने या हटाने के लिए OK दबाए रखें"],
	"Added to the Live TV row": ["Zur Live-TV-Reihe hinzugefügt", "Añadido a la fila de TV en directo", "Ajoutée à la rangée TV en direct", "Aggiunto alla fila TV in diretta", "Adicionado à fila de TV em direto", "Toegevoegd aan de rij Live tv", "Canlı TV satırına eklendi", "लाइव टीवी पंक्ति में जोड़ा गया"],
	"Taken off the Live TV row": ["Aus der Live-TV-Reihe entfernt", "Quitado de la fila de TV en directo", "Retirée de la rangée TV en direct", "Tolto dalla fila TV in diretta", "Retirado da fila de TV em direto", "Uit de rij Live tv gehaald", "Canlı TV satırından çıkarıldı", "लाइव टीवी पंक्ति से हटाया गया"],
	"Downloading subtitles…": ["Untertitel werden geladen…", "Descargando subtítulos…", "Téléchargement des sous-titres…", "Download dei sottotitoli…", "A transferir legendas…", "Ondertitels downloaden…", "Altyazılar indiriliyor…", "उपशीर्षक डाउनलोड हो रहे हैं…"],
	"Ready up to %s": ["Bereit bis %s", "Listos hasta %s", "Prêts jusqu'à %s", "Pronti fino a %s", "Prontas até %s", "Klaar tot %s", "%s'e kadar hazır", "%s तक तैयार"],
	"Now": ["Jetzt", "Ahora", "Maintenant", "Ora", "Agora", "Nu", "Şimdi", "अभी"],
	"Next": ["Danach", "Después", "Ensuite", "Dopo", "Depois", "Hierna", "Sonra", "इसके बाद"],
	"Search": ["Suchen", "Buscar", "Rechercher", "Cerca", "Procurar", "Zoeken", "Ara", "खोजें"],
	"All categories": ["Alle Kategorien", "Todas las categorías", "Toutes les catégories", "Tutte le categorie", "Todas as categorias", "Alle categorieën", "Tüm kategoriler", "सभी श्रेणियाँ"],
	// Films & series and the player: a server that does not answer, the search, the opening of a film, the audio track
	"{name} is not answering": ["{name} antwortet nicht", "{name} no responde", "{name} ne répond pas", "{name} non risponde", "{name} não responde", "{name} reageert niet", "{name} yanıt vermiyor", "{name} जवाब नहीं दे रहा"],
	"{name} did not answer": ["{name} hat nicht geantwortet", "{name} no respondió", "{name} n'a pas répondu", "{name} non ha risposto", "{name} não respondeu", "{name} gaf geen antwoord", "{name} yanıt vermedi", "{name} ने जवाब नहीं दिया"],
	"No network: check the TV's connection": ["Kein Netzwerk: Verbindung des Fernsehers prüfen", "Sin red: revisa la conexión del televisor", "Pas de réseau : vérifie la connexion de la TV", "Nessuna rete: controlla la connessione della TV", "Sem rede: verifique a ligação da TV", "Geen netwerk: controleer de verbinding van de tv", "Ağ yok: TV'nin bağlantısını kontrol edin", "नेटवर्क नहीं: टीवी का कनेक्शन जांचें"],
	"Searching…": ["Suche…", "Buscando…", "Recherche…", "Ricerca…", "A procurar…", "Zoeken…", "Aranıyor…", "खोज रहे हैं…"],
	"Audio": ["Audio", "Audio", "Audio", "Audio", "Áudio", "Audio", "Ses", "ऑडियो"],
	"Opening…": ["Wird geöffnet…", "Abriendo…", "Ouverture…", "Apertura…", "A abrir…", "Openen…", "Açılıyor…", "खुल रहा है…"],
	"Couldn't play it here": ["Hier nicht abspielbar", "No se puede reproducir aquí", "Lecture impossible ici", "Impossibile riprodurlo qui", "Não é possível reproduzir aqui", "Kan hier niet afspelen", "Burada oynatılamıyor", "यहां नहीं चल सका"],
	"Open it in Jellyfin": ["In Jellyfin öffnen", "Abrir en Jellyfin", "L'ouvrir dans Jellyfin", "Aprilo in Jellyfin", "Abrir no Jellyfin", "Openen in Jellyfin", "Jellyfin'de aç", "Jellyfin में खोलें"],
	"Close": ["Schließen", "Cerrar", "Fermer", "Chiudi", "Fechar", "Sluiten", "Kapat", "बंद करें"],
	"Jellyfin signed this TV out: sign in again in Settings > Films & series": ["Jellyfin hat diesen Fernseher abgemeldet: in Einstellungen > Filme & Serien neu anmelden", "Jellyfin cerró la sesión de este televisor: vuelve a iniciarla en Ajustes > Películas y series", "Jellyfin a déconnecté la TV : reconnecte-la dans Réglages > Films et séries", "Jellyfin ha disconnesso questa TV: accedi di nuovo in Impostazioni > Film e serie", "O Jellyfin desligou esta TV: inicie sessão de novo em Definições > Filmes e séries", "Jellyfin heeft deze tv afgemeld: meld opnieuw aan in Instellingen > Films en series", "Jellyfin bu TV'nin oturumunu kapattı: Ayarlar > Filmler ve diziler'den yeniden giriş yapın", "Jellyfin ने इस टीवी को साइन आउट कर दिया: सेटिंग्स > फ़िल्में और सीरीज़ में फिर से साइन इन करें"],
	"Ready, quiet": ["Bereit, leise", "Listo, sin ruido", "Prêt, sans bruit", "Pronto, senza rumore", "Pronto, sem ruído", "Klaar, stil", "Hazır, sessiz", "तैयार, बिना शोर"],
	"Copying": ["Kopieren", "Copiando", "Copie", "Copia", "Copiando", "Kopiëren", "Kopyalanıyor", "कॉपी हो रहा है"],
	"Preparing…": ["Wird vorbereitet…", "Preparando…", "En préparation…", "In preparazione…", "Preparando…", "Wordt voorbereid…", "Hazırlanıyor…", "तैयार हो रहा है…"],
	"Search channels": ["Sender suchen", "Buscar canales", "Chercher une chaîne", "Cerca canali", "Procurar canais", "Zenders zoeken", "Kanal ara", "चैनल खोजें"],
	"No channel matches": ["Kein Sender passt", "Ningún canal coincide", "Aucune chaîne ne correspond", "Nessun canale corrisponde", "Nenhum canal corresponde", "Geen zender gevonden", "Eşleşen kanal yok", "कोई चैनल नहीं मिला"],
	"No channel": ["Kein Sender", "Ningún canal", "Pas de chaîne", "Nessun canale", "Nenhum canal", "Geen zender", "Kanal yok", "कोई चैनल नहीं"],
	"channels": ["Sender", "canales", "chaînes", "canali", "canais", "zenders", "kanal", "चैनल"],
	"OK to try again": ["OK zum erneuten Versuch", "OK para reintentar", "OK pour réessayer", "OK per riprovare", "OK para tentar de novo", "OK om opnieuw te proberen", "Tekrar denemek için OK", "फिर से कोशिश के लिए OK"],
	"This channel is not playing": ["Dieser Sender läuft nicht", "Este canal no se reproduce", "Cette chaîne ne passe pas", "Questo canale non si riproduce", "Este canal não está a reproduzir", "Deze zender speelt niet af", "Bu kanal oynatılamıyor", "यह चैनल नहीं चल रहा"],
	"Couldn't play": ["Wiedergabe nicht möglich:", "No se pudo reproducir", "Lecture impossible :", "Impossibile riprodurre", "Não foi possível reproduzir", "Kan niet afspelen:", "Oynatılamadı:", "चला नहीं सके"],
	"Channels": ["Sender", "Canales", "Chaînes", "Canali", "Canais", "Zenders", "Kanallar", "चैनल"],
	"Appearance": ["Darstellung", "Apariencia", "Apparence", "Aspetto", "Aspeto", "Weergave", "Görünüm", "दिखावट"],
	"Theme": ["Thema", "Tema", "Thème", "Tema", "Tema", "Thema", "Tema", "थीम"],
	"Light": ["Hell", "Claro", "Clair", "Chiaro", "Claro", "Licht", "Açık", "लाइट"],
	"Dark": ["Dunkel", "Oscuro", "Sombre", "Scuro", "Escuro", "Donker", "Koyu", "डार्क"],
	"Weather country": ["Wetter-Land", "País del tiempo", "Pays météo", "Paese meteo", "País do tempo", "Weerland", "Hava durumu ülkesi", "मौसम देश"],
	"Resume picture": ["Bild beim Weiterschauen", "Imagen de Seguir viendo", "Image de Reprendre", "Immagine di Riprendi", "Imagem de Continuar", "Afbeelding bij Verder kijken", "Devam et görseli", "जारी रखें की तस्वीर"],
	"Quick": ["Schnell", "Rápida", "Rapide", "Rapida", "Rápida", "Snel", "Hızlı", "तेज़"],
	"Normal": ["Normal", "Normal", "Normale", "Normale", "Normal", "Normaal", "Normal", "सामान्य"],
	"Hide the dock": ["Dock ausblenden", "Ocultar el dock", "Masquer le dock", "Nascondi il dock", "Ocultar o dock", "Dock verbergen", "Dock'u gizle", "डॉक छिपाएं"],
	"Video clip": ["Videoclip", "Clip de vídeo", "Clip vidéo", "Clip video", "Clip de vídeo", "Videoclip", "Video klibi", "वीडियो क्लिप"],
	"Shuffle": ["Zufall", "Aleatorio", "Aléatoire", "Casuale", "Aleatório", "Willekeurig", "Karışık", "शफल"],
	"On": ["Ein", "Activado", "Activé", "Attivo", "Ligado", "Aan", "Açık", "चालू"],
	"Dark mode": ["Dunkelmodus", "Modo oscuro", "Mode sombre", "Modalità scura", "Modo escuro", "Donkere modus", "Karanlık mod", "डार्क मोड"],
	"Apps": [
		"Apps",
		"Apps",
		"Applications",
		"App",
		"Apps",
		"Apps",
		"Uygulamalar",
		"ऐप्स"
	],
	"More apps": [
		"Weitere Apps",
		"Más apps",
		"Plus d'apps",
		"Altre app",
		"Mais apps",
		"Meer apps",
		"Daha fazla uygulama",
		"और ऐप्स"
	],
	"Recent": [
		"Zuletzt",
		"Recientes",
		"Récents",
		"Recenti",
		"Recentes",
		"Recent",
		"Son kullanılanlar",
		"हाल के"
	],
	"Sources": [
		"Quellen",
		"Fuentes",
		"Sources",
		"Sorgenti",
		"Fontes",
		"Bronnen",
		"Kaynaklar",
		"स्रोत"
	],
	"Inputs": [
		"Eingänge",
		"Entradas",
		"Entrées",
		"Ingressi",
		"Entradas",
		"Ingangen",
		"Girişler",
		"इनपुट"
	],
	"Control Center": [
		"Kontrollzentrum",
		"Centro de control",
		"Centre de contrôle",
		"Centro di controllo",
		"Central de Controle",
		"Bedieningscentrum",
		"Denetim Merkezi",
		"कंट्रोल सेंटर"
	],
	"Quick Controls": [
		"Schnellsteuerung",
		"Controles rápidos",
		"Commandes rapides",
		"Controlli rapidi",
		"Controles rápidos",
		"Snelbediening",
		"Hızlı Kontroller",
		"त्वरित नियंत्रण"
	],
	"Settings": [
		"Einstellungen",
		"Ajustes",
		"Réglages",
		"Impostazioni",
		"Configurações",
		"Instellingen",
		"Ayarlar",
		"सेटिंग्स"
	],
	"Start Screensaver": [
		"Bildschirmschoner starten",
		"Iniciar salvapantallas",
		"Lancer l'économiseur",
		"Avvia screensaver",
		"Iniciar protetor de ecrã",
		"Schermbeveiliging starten",
		"Ekran koruyucuyu başlat",
		"स्क्रीनसेवर शुरू करें"
	],
	"No apps selected — add some in Settings": [
		"Keine Apps ausgewählt – in den Einstellungen hinzufügen",
		"Sin apps: añade alguna en Ajustes",
		"Aucune app : ajoutez-en dans Réglages",
		"Nessuna app: aggiungine nelle Impostazioni",
		"Nenhuma app: adicione nas Definições",
		"Geen apps: voeg ze toe in Instellingen",
		"Uygulama yok — Ayarlar'dan ekleyin",
		"कोई ऐप नहीं — सेटिंग्स में जोड़ें"
	],
	"Wallpaper": [
		"Hintergrund",
		"Fondo de pantalla",
		"Fond d'écran",
		"Sfondo",
		"Papel de parede",
		"Achtergrond",
		"Duvar kâğıdı",
		"वॉलपेपर"
	],
	"Options": [
		"Optionen",
		"Opciones",
		"Options",
		"Opzioni",
		"Opções",
		"Opties",
		"Seçenekler",
		"विकल्प"
	],
	"Done": [
		"Fertig",
		"Listo",
		"Terminé",
		"Fatto",
		"Concluído",
		"Klaar",
		"Bitti",
		"हो गया"
	],
	"Re-order apps": [
		"Apps anordnen",
		"Reordenar apps",
		"Réorganiser les apps",
		"Riordina app",
		"Reordenar apps",
		"Apps herschikken",
		"Uygulamaları sırala",
		"ऐप्स क्रमबद्ध करें"
	],
	"Re-order sources": [
		"Quellen anordnen",
		"Reordenar fuentes",
		"Réorganiser les sources",
		"Riordina sorgenti",
		"Reordenar fontes",
		"Bronnen herschikken",
		"Kaynakları sırala",
		"स्रोत क्रमबद्ध करें"
	],
	"Nothing on the home screen yet.": [
		"Noch nichts auf dem Startbildschirm.",
		"Aún no hay nada en la pantalla de inicio.",
		"Rien sur l'écran d'accueil pour l'instant.",
		"Ancora niente nella schermata Home.",
		"Ainda nada no ecrã inicial.",
		"Nog niets op het startscherm.",
		"Ana ekranda henüz bir şey yok.",
		"होम स्क्रीन पर अभी कुछ नहीं है।"
	],
	"Move with the arrows · OK to drop · Hold OK for more": [
		"Mit Pfeilen verschieben · OK zum Ablegen · OK halten für mehr",
		"Mueve con las flechas · OK para soltar · Mantén OK para más",
		"Déplacez avec les flèches · OK pour déposer · Maintenez OK pour plus",
		"Sposta con le frecce · OK per rilasciare · Tieni premuto OK per altro",
		"Mova com as setas · OK para soltar · Mantenha OK para mais",
		"Verplaats met de pijlen · OK om neer te zetten · Houd OK vast voor meer",
		"Oklarla taşı · Bırakmak için OK · Daha fazlası için OK'a basılı tut",
		"तीरों से खिसकाएं · छोड़ने के लिए OK · और विकल्पों के लिए OK दबाए रखें"
	],
	"Uninstall App": ["App deinstallieren", "Desinstalar app", "Désinstaller l'app", "Disinstalla app", "Desinstalar app", "App verwijderen", "Uygulamayı kaldır", "ऐप अनइंस्टॉल करें"],
	"Press OK again to uninstall": ["Zum Deinstallieren erneut OK", "Pulsa OK otra vez para desinstalar", "Appuyez à nouveau sur OK pour désinstaller", "Premi di nuovo OK per disinstallare", "Prima OK de novo para desinstalar", "Druk nogmaals op OK om te verwijderen", "Kaldırmak için tekrar OK'a bas", "अनइंस्टॉल करने के लिए फिर OK दबाएं"],
	"Remove from Home Screen": ["Vom Startbildschirm entfernen", "Quitar de la pantalla de inicio", "Retirer de l'écran d'accueil", "Rimuovi dalla schermata Home", "Remover do ecrã inicial", "Van startscherm verwijderen", "Ana ekrandan kaldır", "होम स्क्रीन से हटाएं"],
	"Add to Folder": ["Zu Ordner hinzufügen", "Añadir a carpeta", "Ajouter à un dossier", "Aggiungi a cartella", "Adicionar a pasta", "Aan map toevoegen", "Klasöre ekle", "फ़ोल्डर में जोड़ें"],
	"Add to Games": [
		"Zu Spiele hinzufügen",
		"Añadir a Juegos",
		"Ajouter à Jeux",
		"Aggiungi a Giochi",
		"Adicionar a Jogos",
		"Toevoegen aan Games",
		"Oyunlar'a ekle",
		"गेम्स में जोड़ें"
	],
	"Add to Tools": [
		"Zu Tools hinzufügen",
		"Añadir a Herramientas",
		"Ajouter à Outils",
		"Aggiungi a Strumenti",
		"Adicionar a Ferramentas",
		"Toevoegen aan Tools",
		"Araçlar'a ekle",
		"टूल्स में जोड़ें"
	],
	"Add to Media": [
		"Zu Medien hinzufügen",
		"Añadir a Multimedia",
		"Ajouter à Médias",
		"Aggiungi a Media",
		"Adicionar a Multimédia",
		"Toevoegen aan Media",
		"Medya'ya ekle",
		"मीडिया में जोड़ें"
	],
	"Take out of Folder": [
		"Aus Ordner nehmen",
		"Sacar de la carpeta",
		"Sortir du dossier",
		"Togli dalla cartella",
		"Tirar da pasta",
		"Uit map halen",
		"Klasörden çıkar",
		"फ़ोल्डर से निकालें"
	],
	"Sound mode": [
		"Klangmodus",
		"Modo de sonido",
		"Mode son",
		"Modalità audio",
		"Modo de som",
		"Geluidsmodus",
		"Ses modu",
		"साउंड मोड"
	],
	"Picture": [
		"Bild",
		"Imagen",
		"Image",
		"Immagine",
		"Imagem",
		"Beeld",
		"Resim",
		"चित्र"
	],
	"Sleep timer": [
		"Sleep-Timer",
		"Temporizador",
		"Minuterie",
		"Timer di spegnimento",
		"Temporizador",
		"Slaaptimer",
		"Uyku zamanlayıcı",
		"स्लीप टाइमर"
	],
	"Screensaver": [
		"Bildschirmschoner",
		"Salvapantallas",
		"Économiseur d'écran",
		"Screensaver",
		"Protetor de ecrã",
		"Schermbeveiliging",
		"Ekran koruyucu",
		"स्क्रीनसेवर"
	],
	"Art mode": [
		"Kunstmodus",
		"Modo arte",
		"Mode art",
		"Modalità arte",
		"Modo arte",
		"Kunstmodus",
		"Sanat modu",
		"आर्ट मोड"
	],
	"Start now": [
		"Jetzt starten",
		"Iniciar ya",
		"Lancer",
		"Avvia ora",
		"Iniciar agora",
		"Nu starten",
		"Şimdi başlat",
		"अभी शुरू करें"
	],
	"Screen off": [
		"Bildschirm aus",
		"Pantalla off",
		"Écran éteint",
		"Schermo spento",
		"Ecrã desligado",
		"Scherm uit",
		"Ekranı kapat",
		"स्क्रीन बंद"
	],
	"Restart": [
		"Neustart",
		"Reiniciar",
		"Redémarrer",
		"Riavvia",
		"Reiniciar",
		"Herstarten",
		"Yeniden başlat",
		"रीस्टार्ट"
	],
	"Press OK again": [
		"OK erneut drücken",
		"Pulsa OK otra vez",
		"Appuyez encore sur OK",
		"Premi di nuovo OK",
		"Prima OK novamente",
		"Druk nogmaals OK",
		"Tekrar OK'a basın",
		"फिर OK दबाएं"
	],
	"Living room lights": ["Wohnzimmerlicht", "Luces del salón", "Lumières du salon", "Luci del soggiorno", "Luzes da sala", "Woonkamerlampen", "Salon ışıkları", "लिविंग रूम लाइट"],
	"Playing": ["Wiedergabe", "Reproduciendo", "Lecture", "In riproduzione", "Reproduzindo", "Speelt", "Çalıyor", "चल रहा है"],
	"Paused": ["Pausiert", "En pausa", "En pause", "In pausa", "Em pausa", "Gepauzeerd", "Duraklatıldı", "रुका हुआ"],
	"Backlight": ["Hintergrundbeleuchtung", "Luz de fondo", "Rétroéclairage", "Retroilluminazione", "Brilho OLED", "Achtergrondverlichting", "Arka ışık", "बैकलाइट"],
	"Eye Comfort": ["Augenkomfort", "Confort visual", "Confort visuel", "Comfort visivo", "Conforto visual", "Oogcomfort", "Göz konforu", "आई कम्फर्ट"],
	"Volume": [
		"Lautstärke",
		"Volumen",
		"Volume",
		"Volume",
		"Volume",
		"Volume",
		"Ses",
		"वॉल्यूम"
	],
	"Muted": [
		"Stumm",
		"Silenciado",
		"Muet",
		"Muto",
		"Sem som",
		"Gedempt",
		"Sessiz",
		"म्यूट"
	],
	"Off": [
		"Aus",
		"Apagado",
		"Désactivé",
		"Spento",
		"Desligado",
		"Uit",
		"Kapalı",
		"बंद"
	],
	"Offline": [
		"Offline",
		"Sin conexión",
		"Hors ligne",
		"Offline",
		"Offline",
		"Offline",
		"Çevrimdışı",
		"ऑफ़लाइन"
	],
	"After {n} min": [
		"Nach {n} Min.",
		"Tras {n} min",
		"Après {n} min",
		"Dopo {n} min",
		"Após {n} min",
		"Na {n} min",
		"{n} dk sonra",
		"{n} मिनट बाद"
	],
	"{n} min": [
		"{n} Min.",
		"{n} min",
		"{n} min",
		"{n} min",
		"{n} min",
		"{n} min",
		"{n} dk",
		"{n} मिनट"
	],
	"Live app list via Homebrew Channel": [
		"Live-App-Liste über Homebrew Channel",
		"Lista de apps en vivo (Homebrew Channel)",
		"Liste d'apps en direct (Homebrew Channel)",
		"Elenco app live (Homebrew Channel)",
		"Lista de apps em direto (Homebrew Channel)",
		"Live app-lijst via Homebrew Channel",
		"Homebrew Channel ile canlı uygulama listesi",
		"Homebrew Channel से लाइव ऐप सूची"
	],
	"Video wallpaper": [
		"Video-Hintergrund",
		"Fondo de vídeo",
		"Fond vidéo",
		"Sfondo video",
		"Papel de parede em vídeo",
		"Videoachtergrond",
		"Video duvar kâğıdı",
		"वीडियो वॉलपेपर"
	],
	"Show system apps": [
		"Systemapps anzeigen",
		"Mostrar apps del sistema",
		"Afficher les apps système",
		"Mostra app di sistema",
		"Mostrar apps do sistema",
		"Systeem-apps tonen",
		"Sistem uygulamalarını göster",
		"सिस्टम ऐप्स दिखाएं"
	],
	"Date and weather": [
		"Datum und Wetter",
		"Fecha y tiempo",
		"Date et météo",
		"Data e meteo",
		"Data e meteorologia",
		"Datum en weer",
		"Tarih ve hava durumu",
		"तारीख और मौसम"
	],
	"Weather city": [
		"Wetter-Ort",
		"Ciudad del tiempo",
		"Ville météo",
		"Città meteo",
		"Cidade do tempo",
		"Weerstad",
		"Hava durumu şehri",
		"मौसम शहर"
	],
	"Change wallpaper automatically": [
		"Hintergrund automatisch wechseln",
		"Cambiar fondo automáticamente",
		"Changer le fond automatiquement",
		"Cambia sfondo automaticamente",
		"Mudar papel de parede automaticamente",
		"Achtergrond automatisch wisselen",
		"Duvar kâğıdını otomatik değiştir",
		"वॉलपेपर अपने आप बदलें"
	],
	"Dim the wallpaper": [
		"Hintergrund abdunkeln",
		"Atenuar fondo",
		"Assombrir le fond",
		"Scurisci lo sfondo",
		"Escurecer papel de parede",
		"Achtergrond dimmen",
		"Duvar kâğıdını karart",
		"वॉलपेपर मंद करें"
	],
	"At night": ["Nachts", "De noche", "La nuit", "Di notte", "À noite", "'s Nachts", "Geceleri", "रात में"],
	"Wallpaper captions": ["Hintergrund-Beschriftungen", "Rótulos del fondo", "Légendes du fond d'écran", "Didascalie dello sfondo", "Legendas do fundo", "Achtergrondbijschriften", "Duvar kağıdı açıklamaları", "वॉलपेपर कैप्शन"],
	"Dim when the dock is hidden": [
		"Abdunkeln, wenn das Dock ausgeblendet ist",
		"Atenuar con el dock oculto",
		"Assombrir quand le dock est masqué",
		"Scurisci con il dock nascosto",
		"Escurecer com o dock oculto",
		"Dimmen als het dock verborgen is",
		"Dock gizliyken karart",
		"डॉक छिपने पर मंद करें"
	],
	"AM/PM on the clock": [
		"AM/PM an der Uhr",
		"AM/PM en el reloj",
		"AM/PM sur l'horloge",
		"AM/PM sull'orologio",
		"AM/PM no relógio",
		"AM/PM op de klok",
		"Saatte AM/PM",
		"घड़ी में AM/PM"
	],
	"Clock": [
		"Uhr",
		"Reloj",
		"Horloge",
		"Orologio",
		"Relógio",
		"Klok",
		"Saat",
		"घड़ी"
	],
	"Language": [
		"Sprache",
		"Idioma",
		"Langue",
		"Lingua",
		"Idioma",
		"Taal",
		"Dil",
		"भाषा"
	],
	"Auto": [
		"Automatisch",
		"Automático",
		"Auto",
		"Automatico",
		"Automático",
		"Automatisch",
		"Otomatik",
		"स्वचालित"
	],
	"12-hour": [
		"12 Stunden",
		"12 horas",
		"12 heures",
		"12 ore",
		"12 horas",
		"12 uur",
		"12 saat",
		"12 घंटे"
	],
	"24-hour": [
		"24 Stunden",
		"24 horas",
		"24 heures",
		"24 ore",
		"24 horas",
		"24 uur",
		"24 saat",
		"24 घंटे"
	],
	"Clear": [
		"Klar",
		"Despejado",
		"Dégagé",
		"Sereno",
		"Limpo",
		"Helder",
		"Açık",
		"साफ"
	],
	"Partly cloudy": [
		"Teils bewölkt",
		"Parcialmente nublado",
		"Partiellement nuageux",
		"Parzialmente nuvoloso",
		"Parcialmente nublado",
		"Half bewolkt",
		"Parçalı bulutlu",
		"आंशिक बादल"
	],
	"Cloudy": [
		"Bewölkt",
		"Nublado",
		"Nuageux",
		"Nuvoloso",
		"Nublado",
		"Bewolkt",
		"Bulutlu",
		"बादल"
	],
	"Fog": [
		"Nebel",
		"Niebla",
		"Brouillard",
		"Nebbia",
		"Nevoeiro",
		"Mist",
		"Sis",
		"कोहरा"
	],
	"Rain": [
		"Regen",
		"Lluvia",
		"Pluie",
		"Pioggia",
		"Chuva",
		"Regen",
		"Yağmur",
		"बारिश"
	],
	"Snow": [
		"Schnee",
		"Nieve",
		"Neige",
		"Neve",
		"Neve",
		"Sneeuw",
		"Kar",
		"बर्फ"
	],
	"High": ["Max.", "Máx.", "Max.", "Max", "Máx.", "Max.", "En yüksek", "अधिकतम"],
	"Low": ["Min.", "Mín.", "Min.", "Min", "Mín.", "Min.", "En düşük", "न्यूनतम"],
	"Rain from": ["Regen ab", "Lluvia desde las", "Pluie dès", "Pioggia dalle", "Chuva a partir das", "Regen vanaf", "Yağmur başlangıcı", "बारिश"],
	"Showers": [
		"Schauer",
		"Chubascos",
		"Averses",
		"Rovesci",
		"Aguaceiros",
		"Buien",
		"Sağanak",
		"बौछारें"
	],
	"Storm": [
		"Gewitter",
		"Tormenta",
		"Orage",
		"Temporale",
		"Tempestade",
		"Onweer",
		"Fırtına",
		"तूफ़ान"
	],
	"OK adds or removes an item · Hold OK to re-order · Back returns": [
		"OK fügt hinzu oder entfernt · OK halten zum Anordnen · Zurück zum Start",
		"OK añade o quita · Mantén OK para reordenar · Atrás vuelve al inicio",
		"OK ajoute ou retire · Maintenez OK pour réorganiser · Retour revient à l'accueil",
		"OK aggiunge o rimuove · Tieni OK per riordinare · Indietro torna alla Home",
		"OK adiciona ou remove · Mantenha OK para reordenar · Voltar regressa ao início",
		"OK voegt toe of verwijdert · Houd OK ingedrukt om te herschikken · Terug naar start",
		"OK ekler veya kaldırır · Sıralamak için OK'a basılı tutun · Geri ana ekrana döner",
		"OK से जोड़ें या हटाएं · क्रम बदलने के लिए OK दबाए रखें · वापस जाने के लिए Back"
	],
	"OK picks up an item · Hold OK or choose Done to finish": [
		"OK nimmt auf · OK halten oder Fertig zum Beenden",
		"OK coge un elemento · Mantén OK o elige Listo para terminar",
		"OK saisit un élément · Maintenez OK ou choisissez Terminé",
		"OK prende un elemento · Tieni OK o scegli Fatto per finire",
		"OK agarra um item · Mantenha OK ou escolha Concluído",
		"OK pakt een item op · Houd OK ingedrukt of kies Klaar",
		"OK öğeyi alır · Bitirmek için OK'a basılı tutun veya Bitti'yi seçin",
		"OK से आइटम उठाएं · खत्म करने के लिए OK दबाए रखें या हो गया चुनें"
	],
	"Arrows move it · OK puts it down · Back cancels": [
		"Pfeile bewegen · OK legt ab · Zurück bricht ab",
		"Flechas mueven · OK suelta · Atrás cancela",
		"Flèches pour déplacer · OK pour poser · Retour annule",
		"Frecce per spostare · OK per posare · Indietro annulla",
		"Setas movem · OK pousa · Voltar cancela",
		"Pijlen verplaatsen · OK zet neer · Terug annuleert",
		"Oklar taşır · OK bırakır · Geri iptal eder",
		"तीर खिसकाते हैं · OK छोड़ता है · Back रद्द करता है"
	],
	// ----- Films & séries (docs/films-series.md) -----
	"Resume": ["Weiterschauen", "Seguir viendo", "Reprendre", "Riprendi", "Continuar", "Verder kijken", "Devam et", "जारी रखें"],
	"Rate": ["Bewerten", "Valorar", "Noter", "Valuta", "Avaliar", "Beoordelen", "Puanla", "रेट करें"],
	"Your rating": ["Deine Bewertung", "Tu valoración", "Ta note", "Il tuo voto", "A tua avaliação", "Jouw beoordeling", "Puanın", "आपकी रेटिंग"],
	"OK keeps it for your picks · Back cancels": ["OK speichert sie für deine Empfehlungen · Zurück bricht ab", "OK la guarda para tus recomendaciones · Atrás cancela", "OK la garde pour tes suggestions · Retour annule", "OK lo salva per i tuoi consigli · Indietro annulla", "OK guarda-a para as tuas sugestões · Voltar cancela", "OK bewaart het voor je tips · Terug annuleert", "OK önerilerin için kaydeder · Geri iptal eder", "OK आपके सुझावों के लिए सहेजता है · वापस रद्द करता है"],
	"Requested": ["Angefragt", "Solicitado", "Demandé", "Richiesto", "Pedido", "Aangevraagd", "İstendi", "अनुरोधित"],
	// the requests from the TV (QualityPanel, RequestPanel, the badges): French only for now, the other languages show the English
	"Which picture?": ["", "", "Quelle qualité ?"],
	"Request it?": ["", "", "Le demander ?"],
	"Best available": ["", "", "Meilleure dispo"],
	"Fast download": ["", "", "Téléchargement rapide"],
	"Downloadable": ["", "", "Téléchargeable"],
	"Slow: few sources": ["", "", "Lent : peu de sources"],
	"Not found for now": ["", "", "Introuvable pour l'instant"],
	"Looking…": ["", "", "Recherche…"],
	"sources": ["", "", "sources"],
	"seasons": ["", "", "saisons"],
	"Right now": ["", "", "Tout de suite"],
	"Off-peak hours": ["", "", "Heures creuses"],
	"Request": ["", "", "Demander"],
	"Season": ["", "", "Saison"],
	"Every missing season": ["", "", "Toutes les saisons manquantes"],
	"Tick the seasons to request": ["", "", "Coche les saisons à demander"],
	"Missing seasons": ["", "", "Saisons manquantes"],
	"To approve": ["", "", "À approuver"],
	"Declined": ["", "", "Refusée"],
	"Your requests": ["", "", "Tes demandes"],
	"Films & series": ["Filme & Serien", "Películas y series", "Films & séries", "Film e serie", "Filmes e séries", "Films & series", "Filmler ve diziler", "फ़िल्में और सीरीज़"],
	"Plugged-in inputs": ["Angeschlossene Eingänge", "Entradas conectadas", "Entrées branchées", "Ingressi collegati", "Entradas ligadas", "Aangesloten ingangen", "Bağlı girişler", "जुड़े इनपुट"],
	"Jellyfin address": ["Jellyfin-Adresse", "Dirección de Jellyfin", "Adresse Jellyfin", "Indirizzo Jellyfin", "Endereço Jellyfin", "Jellyfin-adres", "Jellyfin adresi", "Jellyfin पता"],
	"Sign in with Quick Connect": ["Mit Quick Connect anmelden", "Entrar con Quick Connect", "Se connecter avec Quick Connect", "Accedi con Quick Connect", "Entrar com Quick Connect", "Inloggen met Quick Connect", "Quick Connect ile giriş", "Quick Connect से साइन इन"],
	"Sign out of Jellyfin": ["Von Jellyfin abmelden", "Cerrar sesión de Jellyfin", "Se déconnecter de Jellyfin", "Esci da Jellyfin", "Sair do Jellyfin", "Uitloggen bij Jellyfin", "Jellyfin'den çıkış", "Jellyfin से साइन आउट"],
	"Or: user name": ["Oder: Benutzername", "O: usuario", "Ou : nom d'utilisateur", "Oppure: nome utente", "Ou: utilizador", "Of: gebruikersnaam", "Ya da: kullanıcı adı", "या: यूज़र नाम"],
	"Address first": ["Erst die Adresse", "Primero la dirección", "Adresse d'abord", "Prima l'indirizzo", "Primeiro o endereço", "Eerst het adres", "Önce adres", "पहले पता"],
	"Password": ["Passwort", "Contraseña", "Mot de passe", "Password", "Palavra-passe", "Wachtwoord", "Şifre", "पासवर्ड"],
	"Sign in": ["Anmelden", "Entrar", "Se connecter", "Accedi", "Entrar", "Inloggen", "Giriş yap", "साइन इन"],
	"Seerr address": ["Seerr-Adresse", "Dirección de Seerr", "Adresse Seerr", "Indirizzo Seerr", "Endereço Seerr", "Seerr-adres", "Seerr adresi", "Seerr पता"],
	"Seerr API key": ["Seerr-API-Schlüssel", "Clave API de Seerr", "Clé API Seerr", "Chiave API Seerr", "Chave API Seerr", "Seerr API-sleutel", "Seerr API anahtarı", "Seerr API कुंजी"],
	"Test Seerr": ["Seerr testen", "Probar Seerr", "Tester Seerr", "Prova Seerr", "Testar Seerr", "Seerr testen", "Seerr'i test et", "Seerr जांचें"],
	"Signed in to Jellyfin": ["Bei Jellyfin angemeldet", "Sesión iniciada en Jellyfin", "Connecté à Jellyfin", "Accesso a Jellyfin eseguito", "Sessão iniciada no Jellyfin", "Ingelogd bij Jellyfin", "Jellyfin'e giriş yapıldı", "Jellyfin में साइन इन"],
	"Signed out of Jellyfin": ["Von Jellyfin abgemeldet", "Sesión de Jellyfin cerrada", "Déconnecté de Jellyfin", "Uscito da Jellyfin", "Sessão do Jellyfin terminada", "Uitgelogd bij Jellyfin", "Jellyfin'den çıkıldı", "Jellyfin से साइन आउट"],
	"Connected to Seerr": ["Mit Seerr verbunden", "Conectado a Seerr", "Connecté à Seerr", "Connesso a Seerr", "Ligado ao Seerr", "Verbonden met Seerr", "Seerr'e bağlandı", "Seerr से जुड़ा"],
	"Director": ["Regie", "Dirección", "Réalisateur", "Regia", "Realização", "Regisseur", "Yönetmen", "निर्देशक"],
	"Creator": ["Idee", "Creación", "Création", "Ideatore", "Criação", "Bedenker", "Yaratıcı", "निर्माता"],
	"No cast listed for this title": ["Keine Besetzung für diesen Titel", "No hay reparto para este título", "Aucun acteur listé pour ce titre", "Nessun cast indicato per questo titolo", "Nenhum elenco para este título", "Geen cast bekend voor deze titel", "Bu başlık için oyuncu listesi yok", "इस शीर्षक के लिए कलाकार सूची नहीं है"],
	"Opening Jellyfin: pick it there": ["Jellyfin wird geöffnet: dort auswählen", "Abriendo Jellyfin: elígelo allí", "Ouverture de Jellyfin : choisis-le là-bas", "Apertura di Jellyfin: sceglilo lì", "A abrir o Jellyfin: escolha-o lá", "Jellyfin wordt geopend: kies het daar", "Jellyfin açılıyor: oradan seçin", "Jellyfin खुल रहा है: वहां चुनें"],
	"Requested: it will be here once it is in your library": ["Angefragt: Es erscheint hier, sobald es in deiner Mediathek ist", "Solicitado: aparecerá aquí cuando esté en tu biblioteca", "Demandé : il sera là dès qu'il sera dans ta bibliothèque", "Richiesto: sarà qui quando sarà nella tua libreria", "Pedido: aparece aqui quando estiver na sua biblioteca", "Aangevraagd: het staat hier zodra het in je bibliotheek is", "İstendi: kitaplığınıza eklenince burada olacak", "अनुरोधित: लाइब्रेरी में आते ही यहां दिखेगा"],
	"Lumen could not find this title": ["Lumen hat diesen Titel nicht gefunden", "Lumen no encontró este título", "Lumen n'a pas trouvé ce titre", "Lumen non ha trovato questo titolo", "O Lumen não encontrou este título", "Lumen heeft deze titel niet gevonden", "Lumen bu başlığı bulamadı", "Lumen को यह शीर्षक नहीं मिला"],
	"The Quick Connect code ran out": ["Der Quick-Connect-Code ist abgelaufen", "El código de Quick Connect caducó", "Le code Quick Connect a expiré", "Il codice Quick Connect è scaduto", "O código Quick Connect expirou", "De Quick Connect-code is verlopen", "Quick Connect kodunun süresi doldu", "Quick Connect कोड समाप्त हो गया"],
	"Set the Jellyfin address first": ["Zuerst die Jellyfin-Adresse eingeben", "Primero la dirección de Jellyfin", "Indique d'abord l'adresse Jellyfin", "Prima imposta l'indirizzo Jellyfin", "Defina primeiro o endereço Jellyfin", "Stel eerst het Jellyfin-adres in", "Önce Jellyfin adresini girin", "पहले Jellyfin पता डालें"],
	"Lumen could not start it: pick it here": [
		"Lumen konnte es nicht starten: hier auswählen",
		"Lumen no pudo iniciarlo: elígelo aquí",
		"Lumen n'a pas pu le lancer : choisis-le ici",
		"Lumen non è riuscito ad avviarlo: sceglilo qui",
		"O Lumen não conseguiu iniciá-lo: escolha-o aqui",
		"Lumen kon het niet starten: kies het hier",
		"Lumen başlatamadı: buradan seçin",
		"Lumen इसे शुरू नहीं कर सका: यहां चुनें"
	],
};

/** French for the screens added after the nine-language table above (Films & series, the player, the messages). Used when the table has no row. */
const FR_MORE: Record<string, string> = {
	'Season': 'Saison', 'New season': 'Nouvelle saison', 'Starts at': 'Début à', 'Sound': 'Son', 'Send': 'Envoyer', 'No picture': 'Pas d\'image', 'Live': 'En direct',
	'your rating': 'ta note', 'All seasons': 'Toutes les saisons', 'Request': 'Demander', 'Request all': 'Tout demander', 'Full guide': 'Guide complet', 'Guide': 'Guide',
	'No channels yet. Open Live TV once, then come back.': 'Pas encore de chaîne. Ouvre la TV en direct une fois, puis reviens.', 'No guide data': 'Pas de guide',
	'Off air': 'Hors antenne', 'Only now and next in the guide data': 'Le guide ne donne que maintenant et ensuite', 'Now and Next': 'Maintenant et ensuite',
	'Downloading': 'Téléchargement', 'Available': 'Disponible', 'Out on': 'Sortie le', 'Already rated': 'Déjà noté', 'Trailer': 'Bande-annonce', 'Cast': 'Distribution',
	'Play': 'Lecture', 'Pause': 'Pause', 'Next episode': 'Épisode suivant', 'Next episode in': 'Épisode suivant dans', 'Episodes': 'Épisodes', 'Subtitles': 'Sous-titres',
	'Still there?': 'Tu es toujours là ?', 'Keep watching': 'Continuer', 'Play now': 'Lire maintenant', 'Skip intro': 'Passer l’intro', 'Cancel': 'Annuler', 'Specials': 'Épisodes spéciaux', 'Watched': 'Vu',
	'In progress': 'En cours', 'Timing': 'Décalage', 'In sync': 'Synchronisés', 'Earlier': 'Plus tôt', 'Later': 'Plus tard', 'Waiting for Jellyfin…': 'En attente de Jellyfin…',
	'Library': 'Bibliothèque', 'Discover': 'Découvrir', 'Platforms': 'Plateformes', 'Recently added': 'Ajoutés récemment', 'For you': 'Pour toi', 'Coming soon': 'Bientôt',
	'Trending': 'Tendances', 'Popular films': 'Films populaires', 'Results': 'Résultats', 'Films': 'Films', 'Series': 'Séries', 'Film': 'Film', 'All': 'Tout',
	'Loading…': 'Chargement…', 'Nothing found': 'Rien trouvé', 'Type a title': 'Tape un titre', 'Jellyfin is not answering': 'Jellyfin ne répond pas',
	'Seerr is not answering': 'Seerr ne répond pas', 'Sign in to Jellyfin in Settings > Films & series': 'Connecte-toi à Jellyfin dans Réglages > Films et séries',
	'Films and series, yours or to request': 'Films et séries, à toi ou à demander', 'You finished': 'Tu viens de finir',
	'OK rates it out of 10 for your picks · Back skips': 'OK pour noter sur 10 et affiner tes suggestions · Retour pour passer',
	'Seerr did not answer': 'Seerr n\'a pas répondu', 'The plugin did not answer': 'Le plugin n\'a pas répondu', 'Couldn\'t open YouTube': 'Impossible d\'ouvrir YouTube',
	'The TV could not keep the rating (storage full?)': 'La TV n\'a pas pu garder la note (mémoire pleine ?)', 'Couldn\'t play it here: opening Jellyfin': 'Lecture impossible ici : ouverture de Jellyfin',
	'The server answered, but it refused the API key': 'Le serveur a répondu mais a refusé la clé API', 'Seerr refused the API key': 'Seerr a refusé la clé API', 'The server did not answer': 'Le serveur ne répond pas', 'Seerr did not take the request': 'Seerr n\'a pas pris la demande',
	'Already requested': 'Déjà demandé', 'Wrong user name or password': 'Nom d\'utilisateur ou mot de passe incorrect',
	'Quick Connect is off on this server, or it did not answer': 'Quick Connect est coupé sur ce serveur, ou il ne répond pas', 'The picks server did not answer': 'Le serveur de suggestions ne répond pas',
	'Settings restored from the TV': 'Réglages retrouvés depuis la TV', 'Homebrew Channel not available, using the built-in app list': 'Homebrew Channel absent : liste d\'applications de base',
	'Could not read the app list': 'Impossible de lire la liste des applications', 'Could not read the inputs': 'Impossible de lire les entrées',
	'Couldn\'t start the screensaver (it needs the Homebrew Channel)': 'Impossible de lancer l\'écran de veille (il faut Homebrew Channel)',
	'Set up Immich first, in Settings > Immich': 'Règle d\'abord Immich, dans Réglages > Immich', 'Keep at least one source': 'Garde au moins une source',
	'Sign in to Jellyfin in Settings to watch IPTV channels': 'Connecte-toi à Jellyfin dans Réglages pour regarder les chaînes IPTV', 'Couldn\'t open LG Home': 'Impossible d\'ouvrir LG Home',
	'Connected to Immich': 'Connecté à Immich', 'Couldn\'t save the Immich settings on the TV': 'Impossible d\'enregistrer les réglages Immich sur la TV',
	'The address should look like http://192.0.2.20:8787, with no path': 'L\'adresse doit ressembler à http://192.0.2.20:8787, sans chemin',
	'No settings backup found on the TV': 'Aucune sauvegarde de réglages trouvée sur la TV',
	'Claude is picking again: Discover shows the new picks in a minute or two': 'Claude refait ses choix : Découvrir montrera les nouveaux dans une minute ou deux',
	'The picks server did not answer.': 'Le serveur de suggestions ne répond pas', 'Still checking the TV': 'Vérification de la TV en cours', 'Only on the TV': 'Seulement sur la TV',
	'This build has no TV scripts in it': 'Cette version n\'a pas les scripts de la TV', 'TV scripts installed': 'Scripts de la TV installés', 'Could not install the TV scripts': 'Impossible d\'installer les scripts de la TV',
	'Restarting the TV': 'Redémarrage de la TV', 'This TV has no such setting': 'Cette TV n\'a pas ce réglage', 'The TV script failed': 'Le script de la TV a échoué',
	'Couldn\'t change the backlight': 'Impossible de changer le rétroéclairage', 'Couldn\'t change the picture mode': 'Impossible de changer le mode image', 'Couldn\'t change Eye Comfort': 'Impossible de changer Eye Comfort',
	'Couldn\'t turn the screen off (it needs the Homebrew Channel)': 'Impossible d\'éteindre l\'écran (il faut Homebrew Channel)',
	'Couldn\'t restart the TV (it needs the Homebrew Channel)': 'Impossible de redémarrer la TV (il faut Homebrew Channel)', 'This TV didn\'t accept that sound mode': 'La TV n\'a pas accepté ce mode son',
	'Couldn\'t reach Home Assistant': 'Impossible de joindre Home Assistant', 'Already withdrawn. LG\'s own menus can give them again.': 'Déjà retiré. Les menus de LG peuvent le redonner.'
};
/** French for messages with a name or a number in them: [pattern, answer with $1, $2] */
const FR_PATTERNS: [RegExp, string][] = [
	[/^Couldn't open (.+)$/, 'Impossible d\'ouvrir $1'], [/^Couldn't change (.+)$/, 'Impossible de changer $1'], [/^Couldn't uninstall (.+)$/, 'Impossible de désinstaller $1'],
	[/^Uninstalling (.+)…$/, 'Désinstallation de $1…'], [/^(.+) uninstalled$/, '$1 désinstallé'], [/^(.+) is still installed$/, '$1 est toujours installé'],
	[/^Quick Connect code (\S+): type it in Jellyfin, avatar > Quick Connect$/, 'Code Quick Connect $1 : tape-le dans Jellyfin, avatar > Quick Connect'],
	[/^No answer from (.+)$/, 'Pas de réponse de $1']
];

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
export function isDark (mode: string, now = new Date()): boolean {
	const h = now.getHours();
	return mode === 'on' || (mode === 'auto' && (h >= 19 || h < 6));
}
export function setClockMode (mode: string): void { clockMode = mode; }
export function getClockMode (): string { return clockMode; }

/** Words the plugins bring (plugins/api.ts LumenPlugin.strings), by language: used when the table above has none. */
const EXTRA: Record<string, Record<string, string>> = {};
export function addStrings (table: Record<string, Record<string, string>>): void {
	Object.keys(table).forEach((lang) => { EXTRA[lang] = {...table[lang], ...EXTRA[lang]}; });
}

export function t (text: string, vars?: {n: number}): string {
	const row = TABLE[text];
	const at = ORDER.indexOf(current);
	let out = row && at >= 0 && row[at] ? row[at] : (EXTRA[current] && EXTRA[current][text]) || (current === 'fr' ? frMore(text) : text);
	if (vars) out = out.replace('{n}', String(vars.n));
	return out;
}

function frMore (text: string): string {
	if (FR_MORE[text]) return FR_MORE[text];
	for (const [re, to] of FR_PATTERNS) if (re.test(text)) return text.replace(re, to);
	return text;
}
