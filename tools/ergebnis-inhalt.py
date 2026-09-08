#!/usr/bin/env python3
"""Erzeugt den Abschnitt «Inhalt gemäss Dokumentvorlage» in data/ergebnisse.json
neu aus der importierten Quelle data/handbuch/elemente-ergebnis.json.

Anlass: Beim erstmaligen Kuratieren wurde die dritte Gliederungsebene der
Inhaltslisten fallengelassen — beim Systemkonzept endete der Punkt etwa mit
«Systemvarianten für jede Systemvariante:» und die drei Unterpunkte fehlten.
Das Skript schreibt den Block wieder vollständig und in der bestehenden Form:

    Inhalt gemäss Dokumentvorlage:
    – <Punkt der 1. Ebene>: <2. Ebene>; <2. Ebene mit Unterpunkten (a; b; c)>

Alle übrigen Absätze von «details» bleiben unangetastet.
Aufruf nach tools/handbuch-import.py:  python3 tools/ergebnis-inhalt.py
"""
import json
import os
import re
import sys

projekt = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ergebnisse_pfad = os.path.join(projekt, 'data', 'ergebnisse.json')
quelle_pfad = os.path.join(projekt, 'data', 'handbuch', 'elemente-ergebnis.json')

ergebnisse = json.load(open(ergebnisse_pfad, encoding='utf-8'))
quelle = json.load(open(quelle_pfad, encoding='utf-8'))

BLOCK = re.compile(r'Inhalt gemäss Dokumentvorlage:\n.*?(?=\n\n|$)', re.S)


def abschnitt(eintrag, titel):
    for a in eintrag['abschnitte']:
        if a['titel'].strip().lower() == titel.lower():
            return a
    return None


def punkttext(item):
    """Beschriftung eines Listenpunkts, wie sie in «details» steht."""
    t = (item.get('titel', '') + ' ' + item.get('text', '')).strip() if item.get('titel') else item.get('text', '')
    t = re.sub(r'\s*/\s*', '/', t)          # «Datum / Zeit» → «Datum/Zeit»
    return re.sub(r'\s+', ' ', t).strip()


def zweig(item, tiefe):
    """Ein Listenpunkt samt aller Unterpunkte als eine Zeile.
    1. Ebene trennt mit «: », tiefere Ebenen klammern ein."""
    t = punkttext(item)
    kinder = item.get('items') or []
    if not kinder:
        return t
    innen = '; '.join(zweig(k, tiefe + 1) for k in kinder)
    if tiefe == 0:
        return t + ('' if t.endswith(':') else ':') + ' ' + innen
    return t.rstrip(':').rstrip() + ' (' + innen + ')'


def block(eintrag):
    a = abschnitt(eintrag, 'Inhalt')
    if not a:
        return None
    liste = next((b for b in a['bloecke'] if b['t'] in ('ul', 'ol')), None)
    if not liste:
        return None
    return 'Inhalt gemäss Dokumentvorlage:\n' + '\n'.join('– ' + zweig(i, 0) for i in liste['items'])


gleich, geaendert, fehlend = 0, [], []
for e in ergebnisse:
    hb = quelle.get(e['id'])
    treffer = BLOCK.search(e.get('details') or '')
    neu = block(hb) if hb else None
    if not treffer and not neu:
        continue
    if not treffer or not neu:
        fehlend.append((e['begriff'], bool(treffer), bool(neu)))
        continue
    if treffer.group(0) == neu:
        gleich += 1
        continue
    e['details'] = e['details'][:treffer.start()] + neu + e['details'][treffer.end():]
    geaendert.append(e['begriff'])

for begriff, hat_json, hat_quelle in fehlend:
    print('Inhaltsliste nur auf einer Seite:', begriff,
          '· in ergebnisse.json:', hat_json, '· in der Quelle:', hat_quelle, file=sys.stderr)

print('unverändert:', gleich, '· neu geschrieben:', len(geaendert))
for b in geaendert:
    print('  ·', b)

if geaendert:
    with open(ergebnisse_pfad, 'w', encoding='utf-8') as f:
        json.dump(ergebnisse, f, ensure_ascii=False, indent=2)
        f.write('\n')
