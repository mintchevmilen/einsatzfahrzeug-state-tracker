# Einrichtung (einmalig, ca. 30 Minuten)

Du brauchst: ein Supabase Konto, dieses GitHub Repository und einen Browser.
Alles kostenlos starten. Kosten und Grenzen stehen am Ende.

## 1. Supabase Projekt anlegen

1. Auf supabase.com einloggen, "New project".
2. Name: `fahrzeug-check`. Region: **Frankfurt (eu-central-1)** oder eine andere EU Region.
3. Starkes Datenbank Passwort wählen und im Passwortmanager speichern. Es wird in der App nicht gebraucht.
4. Warten, bis das Projekt bereit ist.

## 2. Datenbank einrichten

1. Im Projekt links "SQL Editor" öffnen, "New query".
2. Den ganzen Inhalt von `sql/schema.sql` einfügen und "Run" drücken.
   Es muss "Success" erscheinen. Man kann es gefahrlos mehrfach ausführen.

## 3. Anmeldung vorbereiten

1. Links "Authentication", dann "Sign In / Providers" (die Bezeichnung kann leicht abweichen).
   **"Allow anonymous sign-ins" einschalten.** Prüfer melden sich damit ohne E-Mail mit Code und Namen an.
2. "Authentication", "Users", "Add user", "Create new user":
   E-Mail und Passwort für den Admin eintragen, **"Auto Confirm User"** anhaken.
3. Zurück im SQL Editor diese zwei Zeilen ausführen (E-Mail und Code anpassen):

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'DEINE@EMAIL.DE';

update public.settings set team_code = 'MINDESTENS-6-ZEICHEN' where id = 1;
```

Der Code ist das gemeinsame Passwort für Prüfer. Man kann ihn später in der App ändern.

## 4. App mit Supabase verbinden

1. In Supabase "Project Settings", "API" (oder "API Keys").
2. Kopieren: **Project URL** und **Publishable key** (beginnt mit `sb_publishable_`, älter: "anon public").
3. In dieser Repository Datei `config.js` eintragen und speichern (commit):

```js
window.APP_CONFIG = {
  SUPABASE_URL: 'https://DEINPROJEKT.supabase.co',
  SUPABASE_KEY: 'sb_publishable_...',
};
```

**Nie** den "secret" oder "service_role" Key eintragen. Das Repository ist öffentlich.
Der Publishable Key ist dafür gedacht. Geschützt sind die Daten durch die Rechte aus `schema.sql`.

## 5. App veröffentlichen (GitHub Pages)

1. Im Repository "Settings", "Pages".
2. Source: "Deploy from a branch", Branch `main`, Ordner `/ (root)`, Speichern.
3. Nach 1 bis 2 Minuten steht der Link oben auf der Seite, etwa
   `https://BENUTZER.github.io/einsatzfahrzeug-state-tracker/`.

## 6. Auf dem iPhone installieren

1. Link in **Safari** öffnen.
2. Teilen Symbol, "Zum Home-Bildschirm".
3. Die App öffnet sich dann wie eine normale App, ohne App Store und ohne Apple Entwicklerkonto.
   Android: Chrome, Menü, "App installieren".

## 7. Erster Test

1. In der App oben "Admin" wählen, mit der E-Mail anmelden.
2. Fahrzeug anlegen, Foto machen, Fächer und Gegenstände markieren (siehe `BEDIENUNG.md`).
3. Abmelden, als Prüfer mit Code und Namen anmelden, Check durchführen.

## Kosten und Grenzen (Stand meines Wissens, vor dem Echtbetrieb prüfen)

- GitHub Pages: kostenlos.
- Supabase Free: begrenzter Speicher und Datenmenge. Inaktive Free Projekte werden nach einiger Zeit pausiert.
  Für den Dauerbetrieb einer Einheit ist der bezahlte Tarif sicherer. Preise auf supabase.com/pricing prüfen.
- Fotos werden vor dem Hochladen auf höchstens 1600 Pixel verkleinert (meist unter 500 KB).

## Wenn etwas nicht geht

- Rote Meldung "Der Code ist falsch": Code in den Einstellungen prüfen (Admin).
- "Anonymous sign-ins are disabled": Schritt 3.1 nachholen.
- "Kein Admin": Schritt 3.3 mit der richtigen E-Mail wiederholen.
- Seite zeigt "Noch nicht eingerichtet": `config.js` ist leer oder fehlerhaft.
- Nach einer Änderung am Code lädt das iPhone manchmal die alte Version: App komplett schließen und neu öffnen.
