#!/usr/bin/env python3
"""Haelt die Supabase Datenbank wach (gegen die Pausierung im Free Plan).

Ruft die oeffentliche Datenbankfunktion check_code mit einem Zufallscode auf.
Das ist eine echte Datenbankabfrage. Es werden keine Daten geaendert.
Braucht keine Geheimnisse: URL und Publishable Key stehen in config.js
oder in den Umgebungsvariablen SUPABASE_URL und SUPABASE_KEY.
Endet mit Fehlercode 1, wenn die Abfrage nicht klappt (dann meldet GitHub einen Fehler).
"""
import json, os, re, secrets, sys, urllib.request, urllib.error
from pathlib import Path


def lese_config():
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_KEY")
    if url and key:
        return url, key
    text = (Path(__file__).resolve().parent.parent / "config.js").read_text(encoding="utf-8")
    u = re.search(r"SUPABASE_URL:\s*'([^']+)'", text)
    k = re.search(r"SUPABASE_KEY:\s*'([^']+)'", text)
    if not (u and k):
        sys.exit("config.js nicht lesbar")
    return u.group(1), k.group(1)


def main():
    url, key = lese_config()
    req = urllib.request.Request(
        url.rstrip("/") + "/rest/v1/rpc/check_code",
        data=json.dumps({"p_code": "keepalive-" + secrets.token_hex(4)}).encode(),
        headers={"apikey": key, "Authorization": "Bearer " + key, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            body = r.read().decode()
            print("Keep Alive ok, Antwort:", r.status, body)
    except urllib.error.HTTPError as e:
        print("Keep Alive FEHLER:", e.code, e.read().decode()[:300])
        sys.exit(1)
    except Exception as e:
        print("Keep Alive FEHLER:", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
