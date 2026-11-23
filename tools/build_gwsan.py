#!/usr/bin/env python3
"""Baut data/gwsan.json aus dem BBK Begleitheft GW San (PDF) und den Pin Positionen.
Aufruf: python3 tools/build_gwsan.py begleitheft.pdf pins.json
Positionen 1 bis 43 sind aus dem Beladeplan (Seiten 28 bis 35) abgeschrieben und geprueft.
Kisten (Seiten 21 bis 27) und Rucksaecke (Seiten 15 bis 20) werden aus dem PDF gelesen.
"""
import json, re, subprocess, sys

pdf, pins_file = sys.argv[1], sys.argv[2]
pins = {int(k): v for k, v in json.load(open(pins_file)).items()}


def text(a, b):
    return subprocess.run(['pdftotext', '-layout', '-f', str(a), '-l', str(b), pdf, '-'],
                          capture_output=True, text=True, check=True).stdout

# ---------------------------------------------------------------- Plaetze
K = lambda n, t: ('K', n, t)
FUG = {
    '8b': 'bestehend aus: S/E Gerät, Bediengerät, Kfz-Steckhalterung, Handapparat mit Auflage, Zusatz-Lautsprecher',
    'dig': 'bestehend aus: S/E Gerät, Bedienteil, Kfz-Steckhalterung, Handapparat mit Auflage, externes Fach für BSI Sicherheitskarte, Zusatz-Lautsprecher',
    '11b': 'bestehend aus: S/E Gerät, 2 Akku, Flex-Antenne, Gürtelclip, Handmonophon, Tragetasche (Leder) mit Gürtelschlaufe und Schulterriemen, Ladehalterung Kfz-Einbau 24 V',
}
P = {
 1: ('Fahrerhaus, Fahrertür', [(2, 'Warnweste, gelb'), (1, 'Betriebsanleitung und Wartungsunterlagen Fahrzeug (MAN), in Tasche')]),
 2: ('Fahrerhaus, Mittelkonsole vorn', [(1, 'Bedienteil Sondersignalanlage'),
     (1, 'Sprechfunkgerätesatz FuG 8b-1', FUG['8b']), (1, 'Sprechfunkgerätesatz Digital', FUG['dig']),
     (1, 'Sprechfunkgerätesatz FuG 11b', FUG['11b']), (1, 'Durchsagegerät mit Handmikrofon'),
     (1, 'Handlampe Adalit, mit Holster und Ladeschale')]),
 3: ('Fahrerhaus, Mittelkonsole hinten', [(2, 'Handlampe Adalit, mit Holster und Ladeschale'),
     (2, 'Sprechfunkgerätesatz FuG 11b', 'bestehend aus: S/E Gerät, 2 Akku, Flex-Antenne, Gürtelclip, Tragetasche (Leder) mit Gürtelschlaufe und Schulterriemen, Ladehalterung Kfz-Einbau 24 V')]),
 4: ('Sitzbank', [(1, 'Sicherheitsgurt-Durchtrenner'), (1, 'Ersatzglühlampen und -sicherungen'), (1, 'Bordwerkzeug, Satz'),
     (1, 'Unterlegkeil'), (1, 'Netzanschlussleitung, 230 V'), (1, 'Flaggensatz'), (1, 'Kfz-Verbandtasche'),
     (1, 'Klappspaten'), (1, 'Klauenbeil'), (1, 'Nageleisen'), (1, 'Radmutternschlüssel'),
     (1, 'Reifenfüllschlauch mit Manometer'), (2, 'Schutzhandschuhe'), (1, 'Starthilfekabel'),
     (1, 'Verbindungsleitung Druckluftbremse'), (1, 'Wagenheber'), (2, 'Warndreieck nach StVZO im Behälter'),
     (2, 'Warnleuchte nach StVZO')]),
 5: ('Fahrerhaus, Ablage Beifahrertür', [(1, 'Betriebsanleitung und Wartungsunterlagen WAS Ringordner')]),
 6: ('Hinter dem Beifahrersitz', [(1, 'Feuerlöscher PG 6 H, in Fahrzeughalterung')]),
 7: ('Unter dem Aufbau, Beifahrerseite', [(1, 'Ersatzrad, in Halterung')]),
 8: ('Geräteraum 1, Ebene 1 links', [K(13, 'K 13 Diagnose und Behandlung'), K(14, 'K 14 Infusionsgerät')]),
 9: ('Geräteraum 1, Ebene 1 rechts', [K(15, 'K 15 Medikamente'), K(16, 'K 16 Thermobox')]),
 10: ('Geräteraum 1, Ebene 2 links', [K(6, 'K 6 Transport und Behandlung'), K(7, 'K 7 Beatmung 2')]),
 11: ('Geräteraum 1, Ebene 2 rechts', [K(8, 'K 8 Verbrennung 1'), K(9, 'K 9 Verbrennung 2'), K(10, 'K 10 Verbrennung 3')]),
 12: ('Geräteraum 1, Ebene 3 links', [K(3, 'K 3 Verbandstoffe 1')]),
 13: ('Geräteraum 1, Ebene 3 rechts', [K(4, 'K 4 Spineboard Zubehör'), K(5, 'K 5 Verbandstoffe 2')]),
 14: ('Geräteraum 1, Ebene 4 links', [K(1, 'K 1 Beatmung 1')]),
 15: ('Geräteraum 1, Ebene 4 rechts', [K(2, 'K 2 Infusionsstative')]),
 16: ('Geräteraum 3, Ebene 1 links', [K(18, 'K 18 Sauerstoffversorgung')]),
 17: ('Geräteraum 3, Ebene 1 rechts', [(10, 'Absperrstab'), (5, 'Faltsignal mit Beschriftung', '2 x Unfallhilfsstelle, 2 x Patientenablage, 1 x Sichtung')]),
 18: ('Geräteraum 3, Ebene 2 links', [K(11, 'K 11 Beatmungsgerät 1'), K(12, 'K 12 Beatmungsgerät 2')]),
 19: ('Geräteraum 3, Ebene 2 rechts', [(3, 'Krankentragenlagerungsbock')]),
 20: ('Geräteraum 3, Ebene 3 links', [(5, 'Spineboard mit Kopfplatte')]),
 21: ('Geräteraum 3, Ebene 3 rechts', [(1, 'Vielzweckleiter')]),
 22: ('Geräteraum 3, Ebene 4', [(10, 'Krankentrage')]),
 23: ('Geräteraum Rückseite, Regal oben links', [K(19, 'K 19 Zubehör Zeltheizung A'), K(20, 'K 20 Zubehör Zeltheizung B'), (1, 'Trinkwasserkanister')]),
 24: ('Rollwagen 3', [(1, 'Zeltheizgerät mit Aufsatz'), (1, 'Abgaskamin'), (1, 'Kombinierter Warmluft- und Verteilschlauch'), (1, 'Thermostat')]),
 25: ('Geräteraum Rückseite, Regal oben rechts', [K(21, 'K 21 Zelt Zubehör'), (1, 'Bodenplane'), (1, 'Füllschlauch'), (1, 'Reparaturset'),
     (4, 'Hering 30 cm'), (6, 'Hering 50 cm'), (1, 'Füllarmatur für Druckluftflaschen'), K(22, 'K 22 Zeltgebläse'),
     (1, 'Magnettafel'), (2, 'Krankentragenfahrgestell')]),
 26: ('Rollwagen 2', [(1, 'Stromerzeuger 5 kVA mit Zubehör'), (1, 'Abgasschlauch'), (1, 'Kraftstoffkanister 20 Liter Diesel, mit Ausgusstülle'),
     (1, 'Kraftstoffkanister 20 Liter Otto, mit Ausgusstülle'), (1, 'Feuerlöscher, tragbar, PG 6 H'),
     (2, 'Leitungsroller H07RN-F3 G 2,5', 'mit Stecker und Kupplung DIN 49443/49442, Schutzart IP 68')]),
 27: ('Rollwagen 1', [(1, 'Schnelleinsatzzelt 40 m² in Transporttasche'), (1, 'Bodenplane'), (2, 'Ballasttank')]),
 28: ('Geräteraum 2, Ebene 1 links', [K(37, 'K 37 Hygiene und Pflege 1'), K(38, 'K 38 Hygiene und Pflege 2')]),
 29: ('Geräteraum 2, Ebene 1 rechts', [(1, 'Hygieneauszug mit Wasserkanister und abnehmbarer Hygieneplatte'), (1, 'Steckbecken')]),
 30: ('Geräteraum 2, Ebene 2 links', [K(32, 'K 32 Einwegkleidung'), K(33, 'K 33 Platzhalter')]),
 31: ('Geräteraum 2, Ebene 2 rechts', [K(34, 'K 34 AED')]),
 32: ('Geräteraum 2, Ebene 3 links', [K(25, 'K 25 Persönliche Schutzkleidung 1'), K(26, 'K 26 Persönliche Schutzkleidung 2'), K(27, 'K 27 Persönliche Schutzkleidung 3')]),
 33: ('Geräteraum 2, Ebene 3 rechts', [K(28, 'K 28 Verbandstoffe 3'), K(29, 'K 29 Platzhalter')]),
 34: ('Geräteraum 2, Ebene 4 links', [K(23, 'K 23 Tragegurte')]),
 35: ('Geräteraum 2, Ebene 4 rechts', [(1, 'Vakuummatratze mit Zubehör in Tasche')]),
 36: ('Geräteraum 4, Ebene 1 links', [(1, 'Klapptisch 2200 x 500'), (2, 'Klappbank 2200 x 250'), (1, 'Aluminium-Klapptisch'), (1, 'Abschleppstange')]),
 37: ('Geräteraum 4, Ebene 1 rechts', [K(35, 'K 35 Beleuchtung 1'), K(36, 'K 36 Beleuchtung 2')]),
 38: ('Geräteraum 4, Ebene 2 links', [(2, 'Notfallrucksack Erwachsene')]),
 39: ('Geräteraum 4, Ebene 2 rechts', [K(30, 'K 30 Einwegdecken'), K(31, 'K 31 Rettungstücher')]),
 40: ('Geräteraum 4, Ebene 3 links', [(1, 'Notfallrucksack Erwachsene'), (1, 'Notfallrucksack Kinder')]),
 41: ('Geräteraum 4, Ebene 3 rechts', [K(24, 'K 24 Werkzeug und Absicherung')]),
 42: ('Geräteraum 4, Ebene 4 links', [(3, 'Aluminium-Klappstuhl')]),
 43: ('Geräteraum 4, Ebene 4 rechts', [(1, 'Stativ für Flutlichtstrahler'), (5, 'Verkehrsleitkegel')]),
}
KNAME, KPOS = {}, {}
for n, (_, its) in P.items():
    for it in its:
        if it[0] == 'K':
            KNAME[it[1]] = it[2]
            KPOS[it[1]] = n

# ---------------------------------------------------------------- Kisten
def clean(s):
    s = re.sub(r'\s{3,}\d+\s*$', '', s.rstrip())
    return re.sub(r'\s+', ' ', s).strip()

kisten = {}
cur = None
setname = None
for line in text(21, 27).splitlines():
    if not line.strip() or re.match(r'^\s*-\s*\d+\s*-\s*$', line) or line.startswith('Kiste') or 'Inhaltsverzeichnis' in line:
        continue
    m = re.match(r'^\s*K(\d+)\s+(.*)$', line)
    if m:
        cur = int(m.group(1)); kisten.setdefault(cur, []); setname = None; continue
    if cur is None:
        continue
    m = re.match(r'^(\s+)(\d+)\s+(\S.*)$', line)
    if m and len(m.group(1)) + len(m.group(2)) <= 13:
        kisten[cur].append([int(m.group(2)), clean(m.group(3)), ''])
        setname = kisten[cur][-1][1].split(' ')[0] if 'bestehend aus' in kisten[cur][-1][1].lower() else None
    elif m and setname and len(m.group(1)) <= 14:
        # Bestandteile eines Sets, tiefer eingerueckt: eigener Eintrag mit Namen des Sets davor
        kisten[cur].append([int(m.group(2)), setname + ': ' + clean(m.group(3)), ''])
    elif kisten[cur]:
        t = clean(line)
        if t:
            kisten[cur][-1][2] = (kisten[cur][-1][2] + ' ' + t).strip()

# Sonderfaelle laut Heft
def fix(n, items):
    if n == 34:
        out = []
        for q, nm, nt in items:
            out.append([q, ('AED: ' + nm) if nm.startswith('Elektroden') else nm, '' if nm.startswith('Elektroden') else nt])
        return out
    return items
for n in list(kisten):
    kisten[n] = fix(n, kisten[n])
kisten[21] = [[1, 'Reparaturset', ''], [1, 'Hering 30 cm', 'Menge im Heft nicht angegeben'],
              [1, 'Hering 40 cm', 'Menge im Heft nicht angegeben'], [1, 'Füllarmatur für Druckluftflaschen', '']]
for placeholder in (17, 19, 20, 29, 33):
    kisten.pop(placeholder, None)
kisten[34] = [i for i in kisten[34]]
# K34: Zubehoer ohne Menge im Heft
kisten[34] += [[1, 'AED: Tasche', ''], [1, 'AED: Einwegrasierer', ''], [1, 'AED: Alkoholtücher', ''], [1, 'AED: Schutzhandschuhe', '']]

# ---------------------------------------------------------------- Rucksaecke
def rucksack(a, b):
    out, group = [], ''
    for line in text(a, b).splitlines():
        s = line.strip()
        if not s or re.match(r'^-\s*\d+\s*-$', s) or s.startswith('Artikelbezeichnung') or s.startswith('Inhaltsverzeichnis'):
            continue
        parts = re.split(r'\s{2,}', s)
        if len(parts) == 1:
            group = parts[0]; continue
        if len(parts) == 4:
            nm, art, q, lage = parts
        elif len(parts) == 3:
            nm, q, lage = parts; art = ''
        else:
            raise SystemExit('Rucksack Zeile nicht lesbar: %r' % line)
        out.append([int(q), nm, ' / '.join(x for x in (group, lage, ('Art.Nr. ' + art) if art else '') if x)])
    return out

adult = rucksack(15, 17)
kids = rucksack(18, 20)

areas = []
for n in range(1, 44):
    name, its = P[n]
    items = []
    for it in its:
        if it[0] == 'K':
            items.append({'name': it[2], 'qty': 1, 'note': 'Inhalt siehe Fach „%s“' % it[2]})
        else:
            items.append({'name': it[1], 'qty': it[0], 'note': it[2] if len(it) > 2 else ''})
    areas.append({'name': '%d %s' % (n, name), 'x': pins[n][0], 'y': pins[n][1], 'items': items})
for n in sorted(kisten):
    items = [{'name': nm.rstrip(',').strip(), 'qty': q, 'note': nt} for q, nm, nt in kisten[n]]
    areas.append({'name': '%s (Platz %d)' % (KNAME[n], KPOS[n]), 'x': None, 'y': None, 'items': items})
areas.append({'name': 'Notfallrucksack Erwachsene (je Rucksack, 3 Stück)', 'x': None, 'y': None,
              'items': [{'name': nm, 'qty': q, 'note': nt} for q, nm, nt in adult]})
areas.append({'name': 'Notfallrucksack Kinder (1 Stück)', 'x': None, 'y': None,
              'items': [{'name': nm, 'qty': q, 'note': nt} for q, nm, nt in kids]})

data = {
    'vehicle': {'name': 'GW San (BBK, MAN TGL 10.220)', 'type': 'Gerätewagen Sanität Bund',
                'notes': 'Beladung nach BBK Begleitheft GW San (8. Auflage, Stand April 2022). Die Punkte liegen auf den Nummern im Beladeplan.'},
    'photo': 'static:assets/gwsan/beladeplan.jpg',
    'areas': areas,
}
json.dump(data, open('data/gwsan.json', 'w'), ensure_ascii=False, indent=1)
print('Plaetze:', 43, 'Kisten:', len(kisten), 'Areas:', len(areas), 'Items:', sum(len(a['items']) for a in areas))
for n in sorted(kisten):
    print(n, KNAME[n], len(kisten[n]))
print('Rucksack Erw', len(adult), 'Kinder', len(kids))
