#!/usr/bin/env python3
"""Ergänzt data/aufgaben.json um «ergebnisPhasen»: je Ergebnis einer Aufgabe
die Phasen, in denen die Aufgabe es erzeugt.

Quelle sind die Tabellen «Aufgaben und Ergebnisse Modul …» (Kap. 3.4) im
importierten Online-Text data/handbuch/elemente-modul.json: je Zeile Aufgabe,
Ergebnis und ein Kreuz je Phase (Initialisierung, Konzept, Realisierung,
Einführung, Umsetzung, Abschluss). Die Phasen eines Paars sind manchmal
weniger als der Schnitt der Phasen von Aufgabe und Ergebnis — «Projekt
steuern» erzeugt den QS- und Risikobericht nicht im Abschluss, obwohl beide
dort vorkommen. Steht eine Aufgabe in mehreren Modultabellen, gelten ihre
Kreuze zusammen.
Aufruf nach tools/handbuch-import.py:  python3 tools/ergebnis-phasen.py
"""
import json
import os
import sys

PHASEN = ['Initialisierung', 'Konzept', 'Realisierung', 'Einführung', 'Umsetzung', 'Abschluss']

projekt = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
module = json.load(open(os.path.join(projekt, 'data', 'handbuch', 'elemente-modul.json'), encoding='utf-8'))
ergebnisse = {e['begriff']: e for e in json.load(open(os.path.join(projekt, 'data', 'ergebnisse.json'), encoding='utf-8'))}
aufgaben_pfad = os.path.join(projekt, 'data', 'aufgaben.json')
roh = open(aufgaben_pfad, encoding='utf-8').read()
aufgaben = json.loads(roh)


def tabellen(x):
    if isinstance(x, dict):
        if x.get('t') == 'tabelle':
            yield x
        for v in x.values():
            yield from tabellen(v)
    elif isinstance(x, list):
        for v in x:
            yield from tabellen(v)


# (Aufgabe, Ergebnis) → angekreuzte Phasen; eine leere Aufgabenzelle setzt die Aufgabe der Zeile davor fort.
paare = {}
for eintrag in module.values():
    for t in tabellen(eintrag):
        if 'Aufgaben und Ergebnisse' not in (t.get('titel') or ''):
            continue
        aufgabe = ''
        for zeile in t['zeilen']:
            texte = [z.get('text', '').strip() for z in zeile]
            if len(texte) != 2 + len(PHASEN) or (zeile and zeile[0].get('kopf')):
                continue
            aufgabe = texte[0] or aufgabe
            if not aufgabe or not texte[1]:
                continue
            kreuze = {PHASEN[i] for i in range(len(PHASEN)) if texte[2 + i]}
            paare.setdefault((aufgabe, texte[1]), set()).update(kreuze)

# Der Tabellenkopf nennt die Phasen nicht einzeln — die Spaltenfolge an einem eindeutigen Paar prüfen.
probe = paare.get(('Entscheid Releasefreigabe treffen', 'QS- und Risikobericht'))
if probe != {'Umsetzung'}:
    sys.exit('Spaltenfolge der Phasen unerwartet: ' + repr(probe))

kanten = {(a['begriff'], e) for a in aufgaben for e in a.get('ergebnisse', [])}
fehlend, ausserhalb, weniger = [], [], []
gesetzt = 0
neu = []
for a in aufgaben:
    werte = {}
    for name in a.get('ergebnisse', []):
        kreuze = paare.get((a['begriff'], name))
        if kreuze is None:
            fehlend.append((a['begriff'], name))
            continue
        werte[name] = [p for p in PHASEN if p in kreuze]
        if any(p not in a['phasen'] for p in werte[name]):
            ausserhalb.append((a['begriff'], name, werte[name]))
        e = ergebnisse.get(name)
        if e:
            schnitt = [p for p in PHASEN if p in a['phasen'] and p in e.get('phasen', [])]
            if schnitt != werte[name]:
                weniger.append((a['begriff'], name, [p for p in schnitt if p not in werte[name]]))
    kopie = {}
    for k, v in a.items():
        if k == 'ergebnisPhasen':
            continue
        kopie[k] = v
        if k == 'ergebnisse' and werte:
            kopie['ergebnisPhasen'] = werte
    gesetzt += len(werte)
    neu.append(kopie)

print('Paare in den Modultabellen:', len(paare), '· Ergebnisse von Aufgaben in data:', len(kanten), '· gesetzt:', gesetzt)
for f in fehlend:
    print('Ohne Tabellenzeile (Schnitt der Phasen gilt weiter):', f, file=sys.stderr)
for p in sorted(set(paare) - kanten):
    print('Nur in den Tabellen:', p, file=sys.stderr)
for x in ausserhalb:
    print('Kreuz ausserhalb der Phasen der Aufgabe:', x, file=sys.stderr)
print('Paare mit weniger Phasen als der Schnitt:', len(weniger))
for x in weniger:
    print('  ', x[0], '→', x[1], '· nicht in', ', '.join(x[2]))

with open(aufgaben_pfad, 'w', encoding='utf-8') as f:
    f.write(json.dumps(neu, ensure_ascii=False, indent=2) + ('\n' if roh.endswith('\n') else ''))
