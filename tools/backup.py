#!/usr/bin/env python3
"""Sicherung aller Daten und Fotos in einen Ordner (und optional als ZIP).

Meldet sich als Admin der App an (Umgebungsvariablen BACKUP_EMAIL und BACKUP_PASSWORD)
und liest alle Tabellen als JSON sowie alle Fotos aus dem Bucket "photos".
URL und Publishable Key kommen aus config.js oder SUPABASE_URL und SUPABASE_KEY.
Die Zugangsdaten gehoeren NIE ins Repository, nur in GitHub Secrets.

Aufruf: python3 tools/backup.py ausgabeordner
Bricht mit Fehlercode 1 ab, wenn etwas fehlt, damit GitHub den Lauf rot zeigt.
"""
import json, os, re, sys, urllib.parse, urllib.request, urllib.error
from datetime import datetime, timezone
from pathlib import Path

TABELLEN = ["settings", "admins", "members", "vehicles", "areas", "items", "checks",
            "check_results", "checklists", "usages", "bookings"]
BUCKET = "photos"
SEITE = 1000


def lese_config():
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_KEY")
    if url and key:
        return url.rstrip("/"), key
    text = (Path(__file__).resolve().parent.parent / "config.js").read_text(encoding="utf-8")
    u = re.search(r"SUPABASE_URL:\s*'([^']+)'", text)
    k = re.search(r"SUPABASE_KEY:\s*'([^']+)'", text)
    if not (u and k):
        sys.exit("config.js nicht lesbar")
    return u.group(1).rstrip("/"), k.group(1)


def anfrage(url, key, token=None, daten=None, methode=None, roh=False):
    kopf = {"apikey": key, "Authorization": "Bearer " + (token or key)}
    if daten is not None:
        kopf["Content-Type"] = "application/json"
        daten = json.dumps(daten).encode()
    req = urllib.request.Request(url, data=daten, headers=kopf, method=methode)
    with urllib.request.urlopen(req, timeout=120) as r:
        inhalt = r.read()
    return inhalt if roh else json.loads(inhalt or b"null")


def main():
    if len(sys.argv) != 2:
        sys.exit("Aufruf: backup.py ausgabeordner")
    email, pw = os.environ.get("BACKUP_EMAIL"), os.environ.get("BACKUP_PASSWORD")
    if not (email and pw):
        sys.exit("BACKUP_EMAIL und BACKUP_PASSWORD fehlen")
    url, key = lese_config()
    out = Path(sys.argv[1])
    (out / "tabellen").mkdir(parents=True, exist_ok=True)
    (out / "fotos").mkdir(exist_ok=True)

    try:
        login = anfrage(url + "/auth/v1/token?grant_type=password", key,
                        daten={"email": email, "password": pw}, methode="POST")
    except urllib.error.HTTPError as e:
        sys.exit("Anmeldung fehlgeschlagen: %s" % e.code)
    token = login["access_token"]

    zaehler = {}
    for t in TABELLEN:
        zeilen, start = [], 0
        while True:
            req = urllib.request.Request(
                url + "/rest/v1/" + t + "?select=*",
                headers={"apikey": key, "Authorization": "Bearer " + token,
                         "Range-Unit": "items", "Range": "%d-%d" % (start, start + SEITE - 1)})
            with urllib.request.urlopen(req, timeout=120) as r:
                block = json.loads(r.read())
            zeilen += block
            if len(block) < SEITE:
                break
            start += SEITE
        (out / "tabellen" / (t + ".json")).write_text(json.dumps(zeilen, ensure_ascii=False, indent=1), encoding="utf-8")
        zaehler[t] = len(zeilen)

    # Fotos: Liste ueber alle Ordner, dann einzeln laden
    dateien = []

    def liste(prefix):
        offset = 0
        while True:
            eintraege = anfrage(url + "/storage/v1/object/list/" + BUCKET, key, token,
                                daten={"prefix": prefix, "limit": 100, "offset": offset}, methode="POST")
            for e in eintraege:
                pfad = prefix + e["name"]
                if e.get("id") is None:
                    liste(pfad + "/")
                else:
                    dateien.append(pfad)
            if len(eintraege) < 100:
                return
            offset += 100

    liste("")
    for pfad in dateien:
        ziel = out / "fotos" / pfad
        ziel.parent.mkdir(parents=True, exist_ok=True)
        ziel.write_bytes(anfrage(url + "/storage/v1/object/" + BUCKET + "/" + urllib.parse.quote(pfad),
                                 key, token, roh=True))

    info = {"erstellt_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "zeilen": zaehler, "fotos": len(dateien)}
    (out / "INFO.json").write_text(json.dumps(info, indent=1), encoding="utf-8")
    print("Sicherung ok:", json.dumps(info))


if __name__ == "__main__":
    main()
