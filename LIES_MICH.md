# DienstPlan Pro – überarbeitete Testversion (11/2026)

## Schnellstart
**Einfachste Variante:** `DienstPlanPro-Einzeldatei.html` (liegt im ZIP neben diesem Ordner) per Doppelklick im Browser öffnen. Alles steckt in einer Datei.

**Mit VS Code Live Server (wie bisher):**
1. ZIP vollständig entpacken und den Ordner `DienstPlanPro` in VS Code öffnen.
2. `index.html` öffnen und unten rechts **Go Live** klicken.

Beim ersten Start erscheint die Demo-Anmeldung. Benutzer wählen; die Rolle wird automatisch vorausgewählt und kann geändert werden.
Der erste Benutzer, **Alex Gruber**, ist Admin und Teamleiter von Team Nord. Mit ihm sind alle Funktionen sichtbar.

> Hinweis: Diese Version erzeugt die Demo-Daten **einmalig neu** (10 Teams, 50 Personen mit unterschiedlichen Namen, 5 Wochen Dienste und Bereitschaften). Vorhandene Testdaten im Browser werden dabei ersetzt.
> Unter **Einstellungen → Daten & Sicherung** kannst du jederzeit eine Sicherung als JSON herunterladen und wieder einspielen.

## Behobene Fehler
| # | Problem | Lösung |
|---|---------|--------|
| 1 | In der Monatsansicht standen Daten unter dem falschen Wochentag. | Der Versatz wird pro Wochentag richtig berechnet; Desktop und Handy nutzen dieselbe Logik. |
| 2 | Woche (Mo–Fr) und Monat (Mo–Sa) passten nicht zusammen. | Neue Einstellung **Arbeitstage im Dienstplan** (Mo–Fr / Mo–Sa / Mo–So) gilt für alle Ansichten. |
| 3 | Die Rolle „Lohnverrechnung“ sah alle Verwaltungsseiten. | Sie sieht jetzt nur Dashboard, Dienstplan und Bereitschaft (beide nur lesend), Kontakte, Berichte und Einstellungen. Die Verwaltungsseiten sind gesperrt. Selbst angelegte Rollen bekommen nie automatisch Adminrechte. |
| 4 | Im hellen Modus waren Monatsansicht und Filter-Popup dunkel. | Stylesheet komplett neu aufgebaut; Hell und Dunkel laufen über dieselben Variablen. |
| 5 | Die Zahlen am Dashboard waren fest eingetragen. | Alle Kennzahlen kommen jetzt aus den echten Daten. |
| 6 | Audit Log und Export Audit zeigten nur Beispielzeilen. | Änderungen und Exporte werden jetzt automatisch protokolliert, mit Suche und Filter. |
| 7 | Beim Login wurde die gewählte Rolle ignoriert; das Fenster ließ sich ohne Anmeldung schließen. | Die gewählte Rolle gilt. Schließen geht erst nach der ersten Anmeldung. Neu ist eine Suche nach Benutzern. |
| 8 | Man konnte keinen Gesamtexport machen. | „Alle Einträge exportieren (CSV)“ und „Stunden je Mitarbeiter (CSV)“, jeweils mit Zeitraumfilter. |
| 9 | „Sprache“ und „Datumsformat“ hatten keine Funktion. | Beides funktioniert jetzt (siehe unten). Neu sind außerdem Arbeitstage und Datensicherung (Export, Import, Demo zurücksetzen). |
| 10 | Rechtsklick war überall gesperrt; der Listener wurde bei jedem Seitenaufbau neu angelegt. | Rechtsklick ist nur noch im Kalender gesperrt und der Listener wird einmal angelegt. |
| 11 | Die Demo-Daten passten nicht zum README; alle Personen hießen „Gruber“. | Neue Demo-Daten mit unterschiedlichen Namen. |
| 12 | Löschen und Umbenennen nutzten die einfachen Browser-Fenster. | Eigene Bestätigungsdialoge, die auch in der eingebetteten Vorschau funktionieren. |

Weitere Korrekturen: Beim Umbenennen eines Mitarbeiters werden seine Dienste mit umbenannt. Beim Einteilen kommt eine Warnung, wenn die Person ganztägig abwesend ist. Teamleiter und Deputy müssen verschiedene Personen sein. Benachrichtigungen führen zur richtigen Seite (Dienstplan oder Bereitschaft).

## Neue Funktionen
- **Team-Ansicht im Dienstplan:** Mitarbeiter in Zeilen, Tage in Spalten, gruppiert nach Team, mit Besetzung pro Tag. Mit „+“ in einer leeren Zelle legst du direkt einen Dienst für diese Person und diesen Tag an.
- **Team-Ansicht am Handy:** Oben steht eine kompakte Wochenübersicht mit allen Tagen auf einen Blick. Jede Person hat pro Tag ein Kürzel, z. B. „Ta“ = Tagdienst; dazu kommen ein Punkt für Bereitschaft, ein Haus für Homeoffice und eine Schraffur für Abwesenheit, darüber die Besetzung pro Tag. Tippst du ein Feld an, siehst du darunter die Details des Tages, und die Person ist markiert. Mit „＋ Dienst“ teilst du direkt ein.
- **Dashboard:** Heute im Dienst, Bereitschaft heute (mit Anruf-Button), Wochenauslastung sowie automatisch erkannte offene Punkte (fehlender Deputy, Tage ohne Bereitschaft, Überschneidungen).
- **Mitarbeiter-Startseite:** der heutige Dienst, Stunden diese Woche, die nächsten Dienste und Bereitschaften.
- **Dienstzeiten:** Suche, Zeitleiste über 24 Stunden, Duplizieren, Dauer und Live-Vorschau beim Bearbeiten; Dienste über Mitternacht werden erkannt.
- **Bereitschaft verwalten:** Zeitfenster auf einer 24-Stunden-Skala; einzelne Zeitfenster lassen sich löschen.
- **Kontakte:** Filter nach Rolle, Links zum Anrufen und Mailen, CSV-Export; Teams per Häkchen statt Mehrfachauswahl mit Strg.
- **Teamverwaltung:** Mitglieder per Häkchen mit Suche; bis 20 Teams, beliebig viele Personen pro Team.
- **Rollen:** Rollen neu anlegen, umbenennen (wird bei den Personen mitgeführt) und löschen; Admin ist geschützt.
- **Neues Design:** Linien-Icons, größere Schrift, Dunkelmodus-Schalter oben rechts, Datum und Kalenderwoche in der Kopfzeile, Kalenderwoche im Kalender.

## Sprache & Datumsformat (Einstellungen)
- **Sprache:** Deutsch oder English. Die ganze Oberfläche wechselt, auch Meldungen, Dialoge, Tooltips und Wochentage. Die Seite lädt dabei kurz neu.
  Eigene Daten wie Namen, Teamnamen und Dienstbezeichnungen (z. B. „Tagdienst“) bleiben so, wie sie eingegeben wurden.
- **Datumsformat:** TT.MM.JJJJ (31.12.2026), JJJJ-MM-TT (2026-12-31), MM/TT/JJJJ (12/31/2026) oder ausgeschrieben (31. Dezember 2026). Das Format gilt in der ganzen App und in den CSV-Exporten.
  Die Datumsfelder in Formularen (Kalender-Auswahl) zeigt der Browser in seinem eigenen Format an.
- Technisch: Die Übersetzungen stehen in `i18n.js`. Neue Texte trägst du dort im Wörterbuch `EN` ein.

## Neues Design nach Mockups (Umbau 11/2026)
Alle Seiten wurden nach den freigegebenen Mockups neu aufgebaut. Keine bestehende Funktion ist weggefallen.

**Anmeldung:** Zweigeteilter Startbildschirm. Der Benutzer wird aus einer durchsuchbaren Liste gewählt (Doppelklick meldet direkt an), die Rolle über Chips.

**Überall:** Globale Suche oben (Strg/Cmd + K) über Seiten, Mitarbeiter, Teams und Dienstzeiten. Zähler in der Navigation.

**Dienstplan:**
- Team-Chips statt Auswahlliste; standardmäßig wird das eigene Team gezeigt.
- Filter „Nur Konflikte“: Dienst oder Bereitschaft trifft auf eine Abwesenheit, oder ein Dienst über Mitternacht überschneidet sich mit dem Dienst am Folgetag.
- Einträge per Drag & Drop verschieben, auch in der Team-Ansicht auf andere Personen.
- „Auf nächsten Tag kopieren“.
- Strg + Z bzw. der Button „Rückgängig“ macht die letzte Änderung rückgängig.
- Wochenstunden je Person in der Team-Ansicht.
- **„Rotation automatisch planen“** (neu, wie bei der Bereitschaft): Teams, Zeitraum und die Dienste im Wechsel wählen (z. B. Früh/Spät), Wechsel wöchentlich oder täglich. Jedes Teammitglied bekommt an jedem Arbeitstag einen Dienst, die Dienste wechseln der Reihe nach. Die Reihenfolge hängt an der Kalenderwoche bzw. am Tag, deshalb schließen aufeinanderfolgende Monate nahtlos an. Bei **Urlaub, Gleittag, Sonderurlaub, Berufsschule und „Abwesend“** bekommt die Person an diesem Tag keinen Dienst, und die Dienste des Tages werden unter den Anwesenden neu verteilt, sodass jede Schicht möglichst gleich stark besetzt bleibt (z. B. 4/4 statt 3/5). Wer wechselt, ändert sich von Tag zu Tag. Beim wöchentlichen Wechsel wird am Folgetag getauscht, falls durch die Umverteilung weniger als 11 Stunden Ruhezeit entstünden. Halbe Urlaubstage, „Abwesend untertägig“ und Arztbesuche ändern nichts. Schon belegte Tage und Überschneidungen mit Nachtdiensten werden ausgelassen; bei weniger als 11 Stunden Ruhezeit zum Vortag gibt es einen Hinweis. Die Teams wählst du über ein Dropdown, das nur die Teams zeigt, für die du Berechtigungen hast (mehrere wählbar, mit „Alle meine Teams“); die Liste der Dienste passt sich der Auswahl an. Im Dialog sind alle Dienste des Teams vorausgewählt. Jeder gewählte Dienst wird pro Tag mindestens einmal besetzt; ist bei einer Dienstzeit „Mehrfach am Tag besetzbar“ ausgeschaltet, genau einmal (wer ihn bekommt, wechselt mit der Rotation). Wer keinen freien Dienst mehr bekommt, hat an diesem Tag frei; reichen die Personen nicht für alle Dienste, weist die Meldung darauf hin. Wahlweise nur Lücken füllen oder bestehende Dienste im Zeitraum ersetzen (mit Rückfrage, Strg Z macht es rückgängig).

**Bereitschaft:**
- Block „Jetzt in Bereitschaft“ mit Anruf-Button und Hinweis auf Lücken.
- Ansicht „Zeitleiste“: aufgebaut wie die Team-Ansicht im Dienstplan (Woche, Zeilen = Mitarbeiter je Team). Kopfzeile je Team zeigt, wer Bereitschaft hat, oder eine rote „Lücke“ (anklicken = besetzen). Bereitschaft auf eine andere Person ziehen = Tausch/Vertretung, „+“ = einteilen.
- „Rotation automatisch planen“: wöchentlich oder täglich, füllt nur Lücken und überspringt Abwesende; Teamauswahl über ein Dropdown mit den eigenen Teams.

**Dienstzeiten:**
- Neue Einstellung **„Mehrfach am Tag besetzbar“** je Dienstzeit (Standard: an). Ausgeschaltet wird der Dienst pro Tag und Team nur einer Person zugeteilt; in der Liste steht dann „1× pro Tag“. Beim manuellen Einteilen kommt eine Rückfrage, wenn der Dienst an dem Tag schon besetzt ist.
- Tabelle mit Editor daneben.
- Pause und Netto-Dauer werden direkt angezeigt.
- Farbfelder und Vorschau.
- Jede Dienstzeit zeigt ihre Nutzung, kann dupliziert werden, und beim Umbenennen werden bestehende Einträge mitgezogen.

**Berichte / Export:**
- Filter nach Zeitraum, Team, Mitarbeiter und Art.
- Kennzahlen-Kacheln.
- Einträge lassen sich anhaken und als Auswahl exportieren; die Liste ist in Seiten aufgeteilt.
- Echte **Excel- (.xlsx)** und **PDF-Exporte**.
- Berichtsvorlagen: Lohnverrechnung (XLSX), Bereitschaftsabrechnung (PDF), Abwesenheiten (CSV), Stunden je Mitarbeiter (CSV).

**Administration:**
- Team-Karten mit Status-Filter.
- Editor daneben: Teams umbenennen (wirkt auf alle Einträge), Teamfarbe, Mitglieder anhaken, TL/DP direkt setzen.

**Team Berechtigungen:**
- Matrix aus Rollen × Bereichen mit den Stufen Kein Zugriff / Lesen / Bearbeiten.
- Rollen lassen sich anlegen, duplizieren, umbenennen und löschen.
- Die Matrix steuert Navigation und Schreibrechte.
- Export ohne Recht wird verweigert und als „Verweigert“ protokolliert.

**Audit Log:** Zeitleiste mit Vorher/Nachher-Werten, Filter nach Zeitraum, Aktion, Benutzer und Bereich, dazu eine Statistik.

**Export Audit:** Kennzahlen, Format- und Statusfilter, Dateigröße und Zeitraum je Export.

**Mein Konto (Profilbild oben rechts):** Klick auf den Kreis mit Profilbild/Initialen öffnet „Mein Konto“: Profilbild hochladen/entfernen, E-Mail & Bereitschaftsnummer, Benachrichtigungen, Benutzer wechseln und der Einstieg in die **Einstellungen**. Die Einstellungen sind eine eigene Seite ohne linke Menüleiste, mit „Zurück zum Dashboard“ oben links.

**Einstellungen:**
- Kalender: Standardansichten, Wochenende, Darstellung der Einträge (Kompakt = Monatsansicht mit „+X weitere“, Erweitert = alle Einträge).
- Darstellung: Hell/Dunkel/System, Akzentfarbe Türkis (#14A1A9) oder Blau (#0068A8), Schriftgröße.
- Standardansichten.
- Sicherung.

## Korrekturen nach dem Stabilitätstest (11/2026)
| # | Problem | Lösung |
|---|---------|--------|
| 1 | Ein Dienst mit gleichem Beginn und Ende (z. B. 08:00–08:00) wurde angelegt und mit 24 Stunden gezählt. | Beim Dienst wird das abgelehnt („Beginn und Ende dürfen nicht gleich sein“). Eine 24-Stunden-Bereitschaft (z. B. 07:00–07:00) bleibt möglich. |
| 2 | Bereitschaft an einem Urlaubstag und Nachtdienste, die in den Folgetag hineinreichen, galten nicht als Konflikt. | Beides wird jetzt erkannt: im Kalender (⚠ Konflikt, Filter „Nur Konflikte“) und am Dashboard. Beim Einteilen kommt eine Warnung, wenn sich ein Dienst mit dem Vortag oder Folgetag überschneidet. |
| 3 | Im Dienst-Formular blieb „Bis“ auf dem alten Datum, wenn man „Von“ änderte. | „Bis“ folgt „Von“, solange nur ein Tag gewählt ist oder „Bis“ sonst davor läge. |
| 4 | Bei vollem Browserspeicher blieben nicht gespeicherte Änderungen bis zum Neuladen sichtbar. | Zuerst werden die Protokolle gekürzt. Reicht das nicht, lädt die App den zuletzt gespeicherten Stand und meldet „Browserspeicher voll“. Ab 80 % Belegung erscheint ein Hinweis am Dashboard und in den Einstellungen. Neu: **Einstellungen → Daten & Sicherung → Alte Einträge archivieren** speichert Einträge älter als 12 Monate als CSV-Datei und entfernt sie danach aus dem Browser. |
| 5 | Im CSV-Export konnten Inhalte wie `=HYPERLINK(…)` in Excel als Formel laufen. | Solche Zellen bekommen ein `'` vorangestellt. Telefonnummern wie `+43 …` bleiben unverändert. |
| 6 | Mehrtägige Dienste wurden auch an freien Tagen (z. B. Sonntag) angelegt. | Bei einem Zeitraum werden nur die eingestellten Arbeitstage belegt; die Meldung nennt die ausgelassenen Tage. Ein einzelner gewählter Tag wird immer angelegt. Bereitschaft gilt weiterhin Mo–So. |
| 7 | Unsinnige Datumswerte (z. B. Jahr 0001) wurden angenommen. | Datumsfelder sind auf 2000–2099 begrenzt und werden beim Speichern geprüft. Arbeitsort-Zeiträume sind wie Abwesenheiten auf 366 Tage begrenzt. |
| 8 | Im englischen Modus waren einige Texte noch deutsch („Eintrag erstellen“, „Nur Konflikte“, „Strg K“, „Abw.“ u. a.). | Übersetzungen in `i18n.js` ergänzt, auch für die neuen Meldungen. |

## Weitere Anpassungen (11/2026)
- **Teamgröße:** Die Grenze von 12 Personen pro Team ist entfernt. Teams können beliebig viele Mitglieder haben (Kontakte und Administration).
- **Neues Team „Team Donau“:** 10 Personen – Teamleiter Bernhard Pfeiffer, Deputy Sandra Kofler und 8 Mitarbeiter (Lukas Gartner, Verena Zauner, Moritz Reisinger, Carina Pölzl, Niklas Hackl, Sabine Kraus, Elias Danninger, Jana Fellner), mit den Dienstzeiten Tag-, Früh- und Spätdienst. Es wird beim nächsten Öffnen einmalig zu den vorhandenen Daten hinzugefügt; bestehende Einträge bleiben erhalten. Name, Farbe und Mitglieder lassen sich unter Administration ändern.
- **Dashboard neu als Baukasten:**
  - **Dashboard anpassen** (Button oben rechts): Ansichten per Häkchen ein-/ausblenden, „Standard wiederherstellen“ und – nur hier – der Button „Ansicht bearbeiten“.
  - **Ansicht bearbeiten** (Button im Dialog „Dashboard anpassen“): Bearbeitungsmodus mit gestrichelten Rahmen und Griff an jeder Kachel. Kacheln und Bereiche lassen sich **frei an jede Stelle** des Rasters ziehen (12 Spalten ab ca. 720 px Breite, darunter 6, am Handy 2); kleine Kacheln bleiben dabei immer klein, sodass sich auch mehrere untereinander neben einen großen Bereich setzen lassen – z. B. eine kleine Kachel neben „Meine Dienste“ oder ganz nach oben rechts; die übrigen Ansichten rücken automatisch nach. Am Handy: kurz gedrückt halten oder am Griff ziehen. Beim Auswählen bleibt die Seite an der aktuellen Stelle (kein Sprung nach oben). „Speichern“ übernimmt, „Abbrechen“ verwirft, „Standard wiederherstellen“ setzt die Anordnung zurück. Außerhalb des Bearbeitungsmodus wird nichts versehentlich verschoben. Das Layout wird pro Benutzer gespeichert; eine Anordnung am Computer gilt auch für Tablet und Handy, solange dort keine eigene gespeichert wurde.
  - **Mitarbeiter** sehen: Heute, Kommende Dienste, Kommende Bereitschaften, Aktuelle Abwesenheiten, Stunden diese Woche, Meine Dienste, Meine Bereitschaften. **Admin, Abteilungsleiter, Teamleiter, Deputy** (und Lohnverrechnung) haben zusätzlich Offene Punkte, Heute im Dienst, Bereitschaft heute, Wochenauslastung sowie die optionalen Kacheln „Heute im Dienst“ und „Bereitschaft heute“.
  - **Kommende Dienste** / **Kommende Bereitschaften**: Klick öffnet Dienstplan bzw. Bereitschaft immer in der Wochenansicht; bei Bereitschaften mit allen Teams, damit man sofort sieht, wer Bereitschaft hat.
  - **Büro & Homeoffice** (Bereich unter „Meine Bereitschaften“, gleich breit, für alle Rollen nur die eigenen Tage): Anzahl der im Dienstplan eingetragenen Büro- und Homeoffice-Tage im laufenden Monat. Klick öffnet den Dienstplan (Woche), gefiltert auf dich.
  - **Aktuelle Abwesenheiten**: Klick öffnet ein Pop-up mit allen heute Abwesenden, der Art (Urlaub, Berufsschule, Sonderurlaub, Gleittag, Abwesend, Arztbesuch …) und bis wann.
  - **Offene Punkte**: nur noch als Kachel; Klick öffnet ein Pop-up, jeder Punkt ist ein Button, der direkt zur betroffenen Stelle führt (z. B. Teamverwaltung des Teams, Bereitschaftswoche mit der Lücke, Dienstplan mit „Nur Konflikte“).
  - **Meine Dienste**: immer 5 Zeilen Montag–Freitag ab heute (nach Freitag folgt wieder Montag), auch freie Tage und Abwesenheiten.
  - **Meine Bereitschaften** (weißer Hintergrund): nur „Du hast Bereitschaft“ (wenn gerade aktiv) und die nächste Bereitschaft.
  - **Farben**: Ist „Heute“ eingeblendet, erscheint dieses Banner in der Akzentfarbe aus den Einstellungen; ist es ausgeblendet, erscheinen stattdessen die kleinen Kacheln in der Akzentfarbe.
  - **Erweitern**: Neue Ansichten werden in `app.js` in der Liste `DASH_WIDGETS` ergänzt (Kommentar dort) und erscheinen automatisch im Dialog „Dashboard anpassen“.
- **Benachrichtigungen (Glocke oben rechts)** lassen sich jetzt auch löschen: einzeln über das Papierkorb-Symbol oder gesammelt über „Alle löschen“ (mit Rückfrage). Gelöscht werden nur die eigenen Benachrichtigungen.
- **Meldungen unten rechts** bleiben je nach Länge 5–15 Sekunden sichtbar, pausieren, solange die Maus darauf liegt, und lassen sich per Klick schließen.
- **Anmeldemaske responsiv:** Auf Desktop zweigeteilt; auf Tablets und Handys hochkant ein schmaler Kopfbereich mit dem Anmeldefeld darunter, „Anmelden“ bleibt beim Scrollen am unteren Rand erreichbar. Auf dem Handy quer stehen Benutzerliste links und Rolle/Anmelden rechts. Die Benutzerliste passt ihre Höhe dem Fenster an, das Suchfeld löst auf dem iPhone kein Zoomen mehr aus. Getestet von 320 px bis 2560 px Breite, hoch und quer, hell und dunkel, Deutsch und Englisch.

## Absicherung nach dem Gesamttest (11/2026)
- **Sicherung einspielen ist jetzt sicher:** Die Datei wird vollständig geprüft, *bevor* etwas gelöscht wird (gültiges JSON, aus DienstPlan Pro, Mitarbeitende/Teams/Einträge vorhanden und lesbar). Ungültige Dateien werden mit Begründung abgelehnt – deine Daten bleiben unverändert.
- Vor dem Einspielen zeigt die Rückfrage Stand und Umfang der Sicherung (Mitarbeitende, Teams, Einträge). Schlägt das Einspielen fehl (z. B. Speicher voll), werden die bisherigen Daten automatisch wiederhergestellt.
- Beschädigte Inhalte (Dienstzeiten, Bereitschaftsgruppen/-zeiten, Audit-/Export-Protokoll, Teams, Dashboard-Anordnung) werden beim Laden bereinigt – keine Seite stürzt mehr ab.
- Dienstzeiten und Datumsangaben von Einträgen werden beim Laden geprüft (Schutz vor eingeschleustem Code über eine manipulierte Sicherung).
- Profilbilder werden nur noch als echte Bilder (JPG, PNG, GIF, WebP) angenommen; Abwesenheitsarten in der Dashboard-Kachel werden sicher dargestellt (Schutz vor eingeschleustem Code).
- Englische Oberfläche: „Bereitschaft 07:00–19:00“ im Heute-Banner und der Tooltip „Eintrag als CSV“ im Audit Log werden übersetzt.

- **Team-Filter als Dropdown (Dienstplan & Bereitschaft):** Statt der Chips „Alle Teams“ / „+ Team“ gibt es einen Button mit Dropdown. Oben im Dropdown ist eine Suchleiste (filtert beim Tippen, Enter wählt den ersten Treffer). Mehrere Teams lassen sich per Häkchen auswählen, „Alle Teams“ bzw. „Auswahl aufheben“ setzt zurück. Das Dropdown bleibt beim Auswählen offen und schließt mit Klick daneben oder Esc.

## Arbeitsort & Diensttausch (11/2026)
- **Arbeitsort als Hinweis:** Homeoffice/Büro erscheint nicht mehr als eigener Eintrag, sondern als kleines Etikett (⌂ Homeoffice / Büro) direkt beim Dienst desselben Tages – in Tag-, Woche-, Monat- und Teamansicht, am Handy und unter „Meine Dienste“ am Dashboard. Nur an Tagen ohne Dienst bleibt ein schmaler, gestrichelter Arbeitsort-Eintrag sichtbar. Über „⋯“ beim Dienst lässt sich der Arbeitsort ändern oder entfernen.
- **Eingabemaske Arbeitsort:** Mitarbeiterauswahl mit Foto/Initialen, Team und Suchfeld (Name oder Team), Homeoffice/Büro als Karten, Zeitraum mit Schnellwahl (Heute, Nächster Werktag, Diese Woche, Nächste Woche), Live-Zusammenfassung und „Im Zeitraum entfernen“. Arbeitsorte werden nur Montag bis Freitag eingetragen – Samstag und Sonntag werden automatisch ausgelassen.
- **Diensttausch (Mitarbeiter, Deputy, Admin):** Im Dienstplan oben auf „Diensttausch“ klicken (oder bei einem eigenen Dienst „⋯ → Dienst tauschen“), Kollegin/Kollegen auswählen (nur aus den eigenen Teams, mit Suche) und im **Mini-Kalender** einen oder mehrere Tage antippen – fertig. Der Kalender zeigt deine Dienste (Kürzel in Dienstfarbe), Tage an denen die Kollegin/der Kollege Dienst hat (Punkt) und die ausgewählten Tage. Die Vorschau zeigt sofort „Du gibst ab“ / „Du übernimmst“ (hat die Person an dem Tag frei, übernimmt sie nur deinen Dienst). Unmögliche Tausche (Doppeldienst, Abwesenheit, schon angefragt) werden mit Grund angezeigt.
  - Die angefragte Person bestätigt oder lehnt über die Benachrichtigung, die Dashboard-Kachel „Diensttausch“ oder den Link „Anfragen & Verlauf“ im Fenster „Diensttausch anfragen“ ab. **Getauscht wird erst nach der Bestätigung** – bis dahin tragen die Dienste das Etikett „Tausch angefragt“. Danach werden Anfragende sowie Teamleitung/Deputy benachrichtigt; alles steht im Audit Log. Eigene Anfragen können zurückgezogen werden.
- **Administration (neu gestaltet):** Teams erscheinen als Karten, **3 pro Reihe** (Tablet 2, Handy 1) – mit Teamfarbe, Teamleitung, Deputy, Mitgliedern und den aktiven Teamregeln. Oben Kennzahlen, Suche und Filter (Alle / Vollständig / Offen). Ein Klick auf ein Team öffnet ein **Popup** mit drei Reitern:
  - **Allgemein:** Teamname, Teamfarbe (Farbpalette oder eigene Farbe), Teamleitung und Deputy (Auswahl mit Suche aus den Mitgliedern).
  - **Mitglieder:** alle Mitarbeiter mit Suche zum An-/Abhaken; Teamleitung und Deputy sind markiert.
  - **Teamregeln:** Diensttausch an/aus; **Dienste selbst eintragen** und **Bereitschaft selbst eintragen** jeweils „Niemand“, „Alle im Team“ oder „Ausgewählte“. Berechtigte Mitarbeiter sehen „Eintrag erstellen“ bzw. „Bereitschaft einteilen“, können aber nur **ihre eigenen** Einträge anlegen, ändern, verschieben, kopieren und löschen. Rotation planen bleibt Teamleitung/Deputy vorbehalten.
- **Wer sieht die Administration:** Admin und Abteilungsleiter sehen alle Teams, **Teamleiter und Deputy nur ihre eigenen Teams** (Menüpunkt „Administration“). Rechte im Popup: Admin alles (inkl. Team anlegen/löschen); Abteilungsleiter alles außer anlegen/löschen; Teamleiter/Deputy Teamfarbe und Teamregeln – Name, Verantwortliche und **Teammitglieder können sie nicht bearbeiten** (der Reiter „Mitglieder“ zeigt ihnen nur die Liste ihres Teams, ohne Häkchen). Demo-Daten zurücksetzen und Archivieren bleiben Admins vorbehalten.

- **Abteilungen (Admin):** In der Administration über „Abteilung anlegen“ eine Abteilung mit Name, Farbe, **Abteilungsleitung** (Auswahl mit Suche) und den zugehörigen **Teams** erstellen. Ein Team gehört zu höchstens einer Abteilung (wird beim Zuordnen automatisch verschoben). Die Teamkarten werden dann nach Abteilungen gruppiert, Teams ohne Zuordnung stehen unter „Ohne Abteilung“. Als Abteilungsleitung stehen nur Personen mit der Rolle „Abteilungsleiter“ zur Auswahl (Rolle unter „Kontakte“ vergeben). Eine Abteilungsleitung sieht in der Administration nur die Teams ihrer Abteilung(en); ist ein Abteilungsleiter keiner Abteilung zugeordnet, sieht er wie bisher alle Teams. Beim Löschen einer Abteilung bleiben die Teams erhalten.
- **Diensttausch-Verlauf:** steht jetzt in einem eigenen Reiter „Verlauf“ als kompakte Liste (Person, Anzahl Dienste, Zeitraum, Status, Datum); ein Klick klappt die Details auf. Der Reiter „Offene Anfragen“ zeigt nur noch offene Anfragen.

## Automatische Bildschirmanpassung (alle Geräte)
Alle Seiten passen sich automatisch an jedes Gerät an – getestet mit 15 Größen von 320 px (kleines Handy) über Tablets hoch/quer (768–1180 px) und Laptops bis 2560 px, jeweils ohne seitliches Überlaufen. Auf Tablets wird die Seitenleiste automatisch auf Symbole verkleinert, die Team-Ansicht/Zeitleiste zeigt die ganze Woche, hochkant erscheint die kompakte Wochenübersicht. Tabellen werden auf dem Handy als Karten dargestellt, die Berechtigungsmatrix zeigt nur die gewählte Rolle, und nichts muss seitlich gescrollt werden.

## Datenspeicherung
Alle Daten liegen im `localStorage` des Browsers (Schlüssel beginnen mit `dienstplan…`). Für denselben Datenbestand immer denselben Browser und dieselbe Adresse verwenden. Sichere regelmäßig über **Einstellungen → Daten & Sicherung**.

## Wichtiger Hinweis zur Anmeldung
Die Anmeldung ist eine lokale Demo-Benutzerumschaltung ohne Passwort. Die Rollenprüfung läuft nur im Browser und ist nicht für den produktiven Mehrbenutzerbetrieb mit vertraulichen Daten geeignet. Dafür müssen Anmeldung und Rechteprüfung auf einem Server umgesetzt werden.
