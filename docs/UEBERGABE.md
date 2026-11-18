# Übergabe an die Einheit

Ziel: Die Einheit besitzt später **ihr eigenes Supabase Projekt und ihr eigenes GitHub Konto**.
Der Entwickler hängt dann nicht mehr am Betrieb.

## Was die Einheit anlegt

1. GitHub Konto (kostenlos). Eine E-Mail Adresse der Einheit nutzen, nicht eine private.
2. Supabase Konto und Projekt in einer EU Region. Dazu `EINRICHTUNG.md` ab Schritt 1 durchgehen.
3. Passwortmanager für Admin Zugang und Datenbank Passwort. Mindestens zwei Personen sollten Admin Zugang haben.

## Repository übertragen

1. Im Repository "Settings", ganz unten "Transfer ownership", neuen Besitzer eintragen.
   Alternativ: neues Repository bei der Einheit anlegen und den Inhalt hineinkopieren.
2. Beim neuen Besitzer unter "Settings", "Pages" wieder `main` und `/ (root)` wählen.
3. `config.js` mit den Daten des **neuen** Supabase Projekts füllen.
4. Neuen Link an die Prüfer geben (die Adresse ändert sich mit dem Besitzer).

## Daten übernehmen

- Während der Testphase reichen wenige Fahrzeuge. Neu anlegen dauert pro Fahrzeug etwa 15 Minuten.
- Sollen die Daten übernommen werden, kann ein Export und Import Skript gebaut werden (Tabellen und Fotos).
  Das ist noch nicht vorhanden.

## Pflege im Betrieb

- Admin Passwort und Einheitscode bei Personalwechsel ändern.
- Fotos und Checks sammeln sich an. Alte Checks als Admin im Verlauf löschen.
  Ein Foto, das ersetzt oder gelöscht wird, wird auch aus dem Speicher entfernt.
  Fotos aus abgebrochenen Checks können übrig bleiben. Im Supabase Dashboard unter "Storage", Bucket `photos`, Ordner `checks`, kann man aufräumen.
- Sicherung: Im Supabase Dashboard Tabellen als CSV exportieren. Im bezahlten Tarif gibt es automatische Backups (Tarifdetails prüfen).
- Updates der App: neue Dateien in das Repository hochladen. Die Prüfer müssen nichts tun, die App aktualisiert sich beim nächsten Öffnen.

## Datenschutz (für die Einheit)

- Die Einheit ist die verantwortliche Stelle, nicht der Entwickler.
- Gespeichert werden: Vorname oder Kürzel der Prüfer, Zeitpunkt der Checks, Fotos von Fahrzeugen und Fächern.
- Keine Kennzeichen und keine Personen fotografieren.
- Die Datenbank liegt in der gewählten EU Region. Fotos sind nicht öffentlich, sie werden nur mit zeitlich begrenzten Links angezeigt.
- Prüfer sehen alle Checks, auch von anderen. Wenn das nicht gewollt ist, vorher Bescheid sagen.
- Fragt der Träger der Fahrzeuge (zum Beispiel Landkreis) nach, welche Daten wo liegen: Diese Datei und `sql/schema.sql` geben Auskunft.
