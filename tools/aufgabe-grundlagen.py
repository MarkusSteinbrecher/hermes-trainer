#!/usr/bin/env python3
"""Ergänzt data/aufgaben.json um «grundlagen»: die Ergebnisse, auf denen eine
Aufgabe aufbaut.

Quelle ist der Abschnitt «Grundlagen» der Aufgabenseiten im importierten
Online-Text data/handbuch/elemente-aufgabe.json (eine Liste von
Ergebnisnamen). Der Graph ordnet damit die Aufgaben eines Felds, wo die
Abbildung 1 nichts sagt: «Ausschreibung durchführen» baut auf den
Ausschreibungsunterlagen und dem Meilenstein Ausschreibung auf, steht also
hinter «Ausschreibung erarbeiten» und «Entscheid Ausschreibung treffen».
Aufruf nach tools/handbuch-import.py:  python3 tools/aufgabe-grundlagen.py
"""
import json
import os
import sys

projekt = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
elemente = json.load(open(os.path.join(projekt, 'data', 'handbuch', 'elemente-aufgabe.json'), encoding='utf-8'))
ergebnisse = {e['begriff'] for e in json.load(open(os.path.join(projekt, 'data', 'ergebnisse.json'), encoding='utf-8'))}
aufgaben_pfad = os.path.join(projekt, 'data', 'aufgaben.json')
roh = open(aufgaben_pfad, encoding='utf-8').read()
aufgaben = json.loads(roh)


def grundlagen(eintrag):
    """Listeneinträge des Abschnitts «Grundlagen»; None, wenn es ihn nicht gibt."""
    for abschnitt in eintrag.get('abschnitte', []):
        if abschnitt.get('titel') != 'Grundlagen':
            continue
        return [it['text'].strip() for b in abschnitt.get('bloecke', []) for it in b.get('items', [])]
    return None


ohne, unbekannt = [], []
gesetzt = 0
neu = []
for a in aufgaben:
    werte = grundlagen(elemente.get(a['id'], {}))
    if werte is None:
        ohne.append(a['begriff'])
    else:
        unbekannt += [(a['begriff'], w) for w in werte if w not in ergebnisse]
    kopie = {}
    for k, v in a.items():
        if k == 'grundlagen':
            continue
        kopie[k] = v
        if k == ('ergebnisPhasen' if 'ergebnisPhasen' in a else 'ergebnisse') and werte:
            kopie['grundlagen'] = werte
    gesetzt += len(werte or [])
    neu.append(kopie)

print('Aufgaben:', len(aufgaben), '· Grundlagen gesetzt:', gesetzt)
for b in ohne:
    print('Ohne Abschnitt «Grundlagen»:', b, file=sys.stderr)
for x in unbekannt:
    print('Grundlage ist kein Ergebnis in data:', x, file=sys.stderr)

with open(aufgaben_pfad, 'w', encoding='utf-8') as f:
    f.write(json.dumps(neu, ensure_ascii=False, indent=2) + ('\n' if roh.endswith('\n') else ''))
