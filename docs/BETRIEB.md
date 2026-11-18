# Betrieb: Wachhalten und Sicherung

## 1. Keep Alive (gegen die Pausierung)
- `tools/keepalive.py` ruft alle 2 Tage eine harmlose Datenbankfunktion auf.
- Gestartet durch `.github/workflows/keepalive.yml`. Keine Geheimnisse noetig.
- Hinweis: GitHub schaltet geplante Laeufe in oeffentlichen Repositories nach 60 Tagen
  ohne Aenderung ab. Darum laeuft derselbe Aufruf zusaetzlich im privaten Sicherungs Repository.

## 2. Sicherung (Tabellen als JSON, Fotos als Dateien)
- `tools/backup.py` meldet sich als Admin an und liest alles, was dieser Admin sehen darf.
- Zugangsdaten stehen NIE im Repository, nur als GitHub Secrets BACKUP_EMAIL und BACKUP_PASSWORD.
- Die Sicherung enthaelt Personendaten. Darum laeuft sie in einem PRIVATEN Repository:
  1. Privates Repository anlegen (z. B. `fahrzeug-sicherung`).
  2. Datei `tools/backup-repo/.github/workflows/sicherung.yml` dorthin kopieren
     nach `.github/workflows/sicherung.yml`.
  3. Unter Settings > Secrets and variables > Actions die zwei Secrets anlegen.
  4. Unter Actions "Sicherung" einmal von Hand starten und das Ergebnis pruefen.
- Ergebnis: Artefakt `sicherung-<Nummer>` im privaten Repository, 90 Tage aufbewahrt, montags neu.
- Fuer eine Wiederherstellung die JSON Dateien in ein neues Projekt einspielen. Einmal ueben.
