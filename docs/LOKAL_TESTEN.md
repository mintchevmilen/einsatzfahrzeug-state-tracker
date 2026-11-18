# Lokal testen (ohne Supabase, ohne Internet Konto)

Im **Testmodus** läuft die App komplett auf deinem Gerät. Die Daten liegen nur im Browser (localStorage). Es wird nichts hochgeladen. Ein Beispielfahrzeug ist schon angelegt.

## Variante A: Am Computer

Du brauchst Python 3 (auf Mac meist vorhanden, unter Windows von python.org mit Haken bei "Add to PATH").

1. Repository herunterladen (GitHub, grüner Knopf "Code", "Download ZIP") und entpacken.
2. Starten:
   - **Windows:** Doppelklick auf `start-lokal.bat`
   - **Mac:** Terminal öffnen, in den Ordner wechseln, `python3 start-lokal.py` eingeben. (`start-lokal.command` geht nur, wenn der Ordner per git geklont wurde. Eine ZIP Datei verliert das Ausführungsrecht.)
   - **Linux oder Terminal:** `python3 start-lokal.py`
3. Der Browser öffnet sich mit `http://localhost:8080/?demo=1`.
4. Beenden mit Strg+C im Fenster.

Zum Ausprobieren der Handy Ansicht in Chrome: F12, Geräte Symbol (Strg+Shift+M), "Pixel 7" oder "iPhone 14" wählen. Das ist nur eine Annäherung, kein echter Test.

## Variante B: Am Handy (iPhone oder Android) im selben WLAN

1. Wie oben starten. Im Fenster steht eine zweite Adresse, zum Beispiel `http://192.168.1.23:8080/?demo=1`.
2. Diese Adresse am Handy im Browser öffnen (Safari oder Chrome). Handy und Computer müssen im selben WLAN sein.
3. Kamera und Foto Auswahl funktionieren. Die Installation auf den Home Bildschirm geht so **nicht**, dafür braucht es https (siehe Variante C).
4. Klappt es nicht: Firewall des Computers fragt nach Zugriff, bitte erlauben. Manche Firmen und Gäste WLANs blockieren Geräte untereinander.

## Variante C: Veröffentlicht mit GitHub Pages (echter Test mit Installation)

Wenn GitHub Pages eingeschaltet ist (`EINRICHTUNG.md`, Schritt 5), geht der Testmodus auch dort:
`https://BENUTZER.github.io/einsatzfahrzeug-state-tracker/?demo=1`

Damit kannst du auf dem iPhone (Safari, Teilen, "Zum Home-Bildschirm") und auf Android (Chrome, Menü, "App installieren") die Installation testen, ohne dass eine Datenbank existiert. Solange `config.js` leer ist, bleibt die App im Testmodus.

## Zugangsdaten im Testmodus

| Rolle | Eingabe |
|---|---|
| Prüfer | Code `Test-1234`, Name frei |
| Admin | `admin@demo.de` und Passwort `demo1234` |

Diese Daten gelten nur im Testmodus. Sie stehen auch auf dem Anmeldebildschirm.

## Adress Zusätze

| Adresse endet auf | Wirkung |
|---|---|
| `?demo=1` | Testmodus an, Beispielfahrzeug |
| `?demo=empty` | Testmodus an, alles leer |
| `?demo=reset` | Testdaten löschen, Beispiel neu laden |
| `?demo=off` | Testmodus beenden |

## Was du testen solltest

1. Als Admin ein neues Fahrzeug anlegen, Foto aufnehmen (am Handy: Kamera), Fach markieren, Gegenstände markieren.
2. Abmelden, als Prüfer anmelden, Check durchführen, mit Mängel Foto abschließen.
3. Verlauf ansehen.
4. App schließen und neu öffnen: Ist der angefangene Check noch da?
5. Hochkant und quer, mit großer Schrift (Systemeinstellung), mit Handschuhen: Sind die Knöpfe groß genug?

## Automatische Tests (für Entwickler)

```
pip install playwright
python3 tests/ui_test.py android     # Pixel 7 Emulation in Chrome
python3 tests/ui_test.py iphone      # iPhone Fenstergröße, ebenfalls Chrome Engine
```

Die Datenbankrechte lassen sich mit `tests/db_stub.sql` und `tests/db_rls.sql` gegen ein lokales PostgreSQL prüfen.
Diese Tests ersetzen **keinen** Test auf einem echten Gerät, besonders nicht auf dem iPhone (Safari Engine).
