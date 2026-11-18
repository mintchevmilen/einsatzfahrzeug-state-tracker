# Einsatzfahrzeug State Tracker

Kleine App (PWA) für eine Einheit im Katastrophenschutz: Fahrzeuge erfassen, Fächer und Gegenstände auf Fotos markieren, Beladung per Check prüfen und den Verlauf einsehen. Läuft im Browser, auf dem iPhone als Home Bildschirm App, ohne App Store.

**Stand:** Prototyp. Per Skript geprüft (Datenbankrechte und Bedienung mit einer Test Attrappe). **Noch nicht auf einem echten iPhone und noch nicht mit einer echten Supabase Datenbank getestet.**

## Funktionen

- Admin legt Fahrzeuge an, macht Fotos, tippt auf das Foto und markiert Fächer und Gegenstände (Namen per Tastatur diktierbar).
- Prüfer melden sich mit Einheitscode und Namen an (kein Konto, keine E-Mail), wählen ein Fahrzeug und haken Gegenstände ab: OK, Fehlt, Defekt, mit Notiz und Foto.
- Verlauf aller Checks mit Mängelliste.
- Prüftermin je Fahrzeug, farbig bei fälliger Prüfung.
- Daten und Fotos in einer eigenen Supabase Datenbank der Einheit (EU Region).

## Dateien

| Pfad | Inhalt |
|---|---|
| `index.html`, `css/`, `js/` | Die App (reines HTML, CSS, JavaScript, kein Build nötig) |
| `config.js` | Supabase URL und Publishable Key eintragen |
| `sql/schema.sql` | Tabellen, Rechte (RLS), Foto Speicher |
| `docs/EINRICHTUNG.md` | Schritt für Schritt Einrichtung |
| `docs/BEDIENUNG.md` | Anleitung für Admin und Prüfer |
| `docs/UEBERGABE.md` | Übergabe an die Einheit, Pflege, Datenschutz |
| `vendor/supabase.js` | Supabase Bibliothek (MIT Lizenz, Version 2.119.1) |

## Sicherheit in Kürze

- Alle Tabellen sind durch Row Level Security geschützt. Ohne Anmeldung als Prüfer oder Admin sind keine Daten lesbar.
- Prüfer dürfen nur lesen und eigene Checks schreiben. Nur Admins ändern Fahrzeuge, Fächer und Gegenstände.
- Fotos liegen in einem privaten Speicher.
- Das Repository ist öffentlich. Hier gehören nur die URL und der **Publishable** Key hinein, nie ein Secret Key.
- Der Einheitscode ist ein gemeinsames Passwort für Prüfer, kein hoher Schutz. Bei Verdacht im Admin Bereich ändern.
