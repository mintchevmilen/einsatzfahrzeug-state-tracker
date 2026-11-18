# Bedienung

## Admin: Fahrzeug aufbauen

1. **Fahrzeuge**, "Fahrzeug anlegen": Name oder Funkrufname, Typ, Standort, nächste Prüfung (HU, UVV).
2. **Foto vom Fahrzeug** aufnehmen ("Foto aufnehmen").
3. Auf das Foto **tippen**, wo ein Fach oder Staukasten ist. Namen eingeben, zum Beispiel "Heck links".
   Es erscheint eine nummerierte Markierung. Tippen auf die Nummer: umbenennen, öffnen, verschieben, löschen.
4. Fach öffnen, **Foto vom Fach** aufnehmen, dann auf das Foto tippen, wo ein Gegenstand liegt.
   Name und Soll Menge eingeben ("Verbandkasten", 2). Die Markierung bekommt eine Nummer.
5. Fertig. Schalter "Bearbeiten" ausschalten, dann sieht der Admin dieselbe Ansicht wie die Prüfer.

Tipps:
- Namen diktieren: Auf dem iPhone in jedem Textfeld das Mikrofon der Tastatur nutzen.
- Ein Fach oder Gegenstand ohne Foto geht auch: "Fach ohne Markierung" oder "Gegenstand ohne Markierung".
- Wird ein Foto später ersetzt, bleiben die Markierungen an derselben Stelle. Bei anderem Bildausschnitt neu setzen.
- Fotos ohne Kennzeichen und ohne Personen machen.

## Prüfer: Check durchführen

1. Link öffnen, **Code** und **Namen** eingeben (einmal, das Gerät merkt es sich).
2. Fahrzeug wählen, "Check starten".
3. Fach antippen (Nummer auf dem Foto oder Liste). Beim Gegenstand:
   **OK** (vorhanden), **Fehlt** oder **Defekt**. Bei Mängeln "Notiz / Foto" nutzen.
4. Zurück zum Fahrzeug, "Abschließen". Optional eine Bemerkung.
5. Der Check steht im **Verlauf** mit Name, Datum und Mängeln.

Der angefangene Check wird auf dem Gerät gespeichert, auch wenn die App geschlossen wird. Fotos zu Mängeln und das Abschließen brauchen Netz:
Check später abschließen, sobald wieder Netz da ist. Nicht geprüfte Gegenstände werden nicht gespeichert.

## Admin: Einstellungen

- Name der Einheit und Einheitscode ändern (Code mindestens 6 Zeichen). Alte Anmeldungen bleiben gültig.
- Link für Prüfer kopieren.
- Prüfer entfernen (dann muss er sich neu mit dem Code anmelden).
- Im Verlauf kann der Admin Checks löschen.

## Was noch nicht drin ist

- Reservierung und Ausleihe von Fahrzeugen.
- Automatische Erinnerung an Prüftermine (die Fälligkeit wird auf der Fahrzeugliste farbig angezeigt).
- Mehrere Checklisten pro Fahrzeug (zum Beispiel monatlich und jährlich).
- Offline Warteschlange für fertige Checks.
- Export als PDF oder Excel.

## Fotos und Diktat (neu)

- Bei jedem Foto gibt es zwei Wege: "Kamera" öffnet direkt die Handykamera. "Aus Dateien" öffnet die Galerie oder den Dateiauswahl Dialog.
- An Textfeldern gibt es einen runden Mikrofon Knopf. Antippen, sprechen, nochmal tippen zum Stoppen. Der Text wird hinten angehängt.
- Auf Android mit Chrome klappt das in der Regel gut. Auf dem iPhone ist die Browser Spracherkennung eingeschränkt. Dort fehlt der Knopf oder meldet einen Fehler. Dann das Mikrofon der iPhone Tastatur nutzen. Das geht in jedem Feld.
- Code und Namensfelder haben bewusst keinen Mikrofon Knopf.

## Übersicht und Mängel (neu)

- Startseite: drei Kacheln (offene Mängel, Prüfung fällig, nie geprüft) und eine Ampel an jedem Fahrzeug. Rot: offener Mangel oder Prüfung überfällig. Gelb: Mangel in Arbeit, Prüfung in 30 Tagen fällig oder noch nie geprüft. Grün: in Ordnung.
- Reiter "Mängel": alle offenen Mängel nach Fahrzeug, mit Foto, Notiz und Finder. Der Admin setzt "In Arbeit" oder "Behoben" (mit Kommentar) und kann wieder öffnen. Prüfer sehen die Liste nur.
- Ein Mangel gilt auch als erledigt, wenn der Gegenstand bei einem späteren Check wieder mit OK abgehakt wird. Gezeigt wird immer das neueste Ergebnis je Gegenstand.
- Für bestehende Datenbanken: `sql/schema.sql` nochmal ausführen (mehrfach möglich) oder nur den Block "Mängelverfolgung".

## Prüffristen, PDF und Datensicherung (neu)

- Fahrzeugdaten: optional "Prüfintervall in Monaten". Mit Intervall erscheint am Fahrzeug der Knopf "Prüfung erledigt". Er setzt die nächste Prüfung auf heute plus Intervall. Vorher kommt eine Rückfrage.
- Verlauf: Knopf "Als PDF" je Check. Es öffnet sich der Druckdialog des Handys oder Browsers. Dort "Als PDF speichern" wählen. Die Seite enthält Fahrzeug, Datum, Prüfer, alle Positionen mit Status, Notizen und Fotos.
- Einstellungen: "Daten herunterladen (JSON)" sichert Fahrzeuge, Fächer, Gegenstände und Checks. Fotos sind nicht enthalten, nur ihre Pfade. Das ist eine Sicherung, noch kein Import für die Übergabe.
- Für bestehende Datenbanken: `sql/schema.sql` nochmal ausführen oder nur den Block "Prüfintervall".
- Erinnerungen per E Mail gibt es nicht. Die Ampel und die Kachel "Prüfung fällig" zeigen Fristen in der App.

## Checklisten und Intervalle (neu)
- Im Fahrzeug als Admin: Bearbeiten einschalten, dann "Checklisten". Vorlagen Wöchentlich (7 Tage), Monatlich (30), Jährlich (365) oder eigene mit freier Tageszahl.
- Jeden Gegenstand kannst du einer Checkliste zuordnen. Ohne Zuordnung gehört er zu jedem Check.
- Beim Start eines Checks wählt man die Checkliste oder "Alle Gegenstände". Ein voller Check zählt für alle Checklisten.
- Die Fälligkeit ist der letzte passende Check plus Intervall. Das Fahrzeug zeigt die Ampel dazu.

## Offline und Warteschlange (neu)
- Ohne Netz kann man einen Check abschließen. Er wird auf dem Gerät gespeichert, im Verlauf als "Wartet" gezeigt und beim nächsten Netz automatisch gesendet. Der Knopf "Jetzt senden" geht auch von Hand.
- Doppelt gesendete Checks gibt es nicht, jeder Check hat eine feste Nummer.
- Wichtig: Die App muss einmal mit Netz geöffnet worden sein, damit Fahrzeuge und Gegenstände zwischengespeichert sind. Fahrzeuge bearbeiten geht nur mit Netz.

## Statistik, QR Codes, Fahrzeugblatt, Excel (neu)
- Statistik (nur Admin): Zeitraum 30, 90 oder 365 Tage, Kacheln, Checks pro Monat, Fristen, häufigste Mängel.
- QR Codes: im Fahrzeug unter Werkzeuge, für das Fahrzeug und optional jedes Fach. Der Druckdialog bietet "Als PDF speichern".
- Fahrzeugblatt: ein PDF mit Fahrzeug, Fächern und Gegenständen.
- Excel: je Fahrzeug im Fahrzeug, alles zusammen in den Einstellungen, Verlauf und Mängel haben eigene Knöpfe.

## Fahrzeugnutzung und Buchungen (neu)
- Im Fahrzeug gibt es die Box "Nutzung". Wer das Fahrzeug nimmt, tippt "Fahrzeug nutzen" und wählt den Zweck: Einsatz, Übung, Wartung, Reinigung, Fahrt oder Sonstiges. Der QR Code am Fahrzeug führt direkt dorthin.
- "Zurückgeben" beendet die Zeit. Danach kann man direkt einen Check starten: eine Checkliste oder den vollen Check. Der Admin legt die Checklisten fest, zum Beispiel Kurz Check und Lang Check.
- Ein Fahrzeug kann nur von einer Person gleichzeitig genutzt werden. Zurückgeben kann nur die Person selbst oder der Admin.
- Tab "Nutzung": Protokoll mit Person, Zweck, Zeit und Dauer, dazu Excel Export für den Admin.
- Kalender: Mitglieder fragen eine Buchung an, der Admin bestätigt oder lehnt ab. Der Admin kann auch direkt buchen. Überschneidungen mit bestätigten Buchungen werden abgewiesen. Stornieren kann die Person selbst oder der Admin.
- Grenzen: Ein und Auschecken und Buchen brauchen Netz. Es gibt noch keine Erinnerung und keine Wochenansicht, der Kalender ist eine Liste nach Tagen.

## Scanner, Fach QR, Hinweiszahl (neu)
- Oben rechts gibt es den Knopf "Scannen". Er öffnet die Kamera und liest QR Codes von Fahrzeugen und Fächern. Der Code öffnet direkt die richtige Seite. Fremde QR Codes werden abgelehnt. Die Kamera muss im Browser erlaubt sein.
- Im Fach (als Admin, Bearbeiten aus) gibt es "QR Code drucken" und "Fachblatt (PDF)" mit Foto und Beladung.
- Der Tab "Nutzung" zeigt eine Zahl: beim Admin die offenen Buchungsanfragen, beim Mitglied neue Antworten (bestätigt oder abgelehnt). Die Zahl verschwindet, sobald man den Kalender angesehen hat.
- Hinweis: Meldet sich ein Mitglied ab und wieder neu an, bekommt es technisch ein neues Konto. Die Antworten findet es über seinen Namen. Stornieren kann es nur Buchungen aus seinem aktuellen Konto.

## Barcode, Kilometer, Tankstand, Wochenansicht, Mitglieder (neu)
- Barcode je Gegenstand: Im Bearbeiten Modus beim Gegenstand das Feld "Barcode" ausfüllen oder mit "Barcode scannen" von der Kamera lesen. Im Check gibt es im Fach den Knopf "Barcode scannen". Jeder Scan hakt den passenden Gegenstand als vorhanden ab, auch wenn er in einem anderen Fach liegt. Gelesen werden QR, Code 128, Code 39, EAN, UPC, ITF und Data Matrix.
- Kilometer und Tankstand: Beim Nutzen und Zurückgeben optional eintragen. Der letzte Kilometerstand wird vorgeschlagen. Ein Endstand unter dem Startstand wird abgelehnt. Im Protokoll und im Excel stehen gefahrene Kilometer und Tank.
- Kalender: Umschalten zwischen Liste und Woche. In der Woche stehen sieben Tage mit den Buchungen, "Vorige", "Diese Woche" und "Nächste".
- Einstellungen, Mitglieder: Name, Beitritt, letzte Aktivität und Zahl der Checks und Nutzungen. "Entfernen" löscht den Eintrag. Wer den Teamcode kennt, kann wieder beitreten. Für einen dauerhaften Ausschluss den Teamcode ändern.

## Passwort ändern (neu)
Als Admin unter Einstellungen, "Passwort ändern". Du gibst das aktuelle und zweimal das neue Passwort ein (mindestens 8 Zeichen). Mitglieder haben kein Passwort, sie nutzen den Teamcode.
