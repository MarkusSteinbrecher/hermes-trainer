#!/usr/bin/env python3
"""Ergänzt data/aufgaben.json um «ergebnisPhasen» und data/aufgaben.json wie
data/ergebnisse.json um «modulPhasen».

Quelle sind die Tabellen «Aufgaben und Ergebnisse Modul …» (Kap. 3.4) im
importierten Online-Text data/handbuch/elemente-modul.json: je Zeile Aufgabe,
Ergebnis und ein Kreuz je Phase (Initialisierung, Konzept, Realisierung,
Einführung, Umsetzung, Abschluss).

ergebnisPhasen (Aufgaben): je Ergebnis die Phasen, in denen die Aufgabe es
erzeugt. Die Phasen eines Paars sind manchmal weniger als der Schnitt der
Phasen von Aufgabe und Ergebnis — «Projekt steuern» erzeugt den QS- und
Risikobericht nicht im Abschluss, obwohl beide dort vorkommen. Steht eine
Aufgabe in mehreren Modultabellen, gelten ihre Kreuze zusammen.

modulPhasen (Aufgaben und Ergebnisse): je Modul die Phasen, in denen der
Eintrag in dessen Tabelle angekreuzt ist — nur, wo nicht jede seiner Phasen in
jedem seiner Module gilt. «Prototyping durchführen» steht in Projektgrundlagen
nur in der Initialisierung, in Produkt und IT-System in Konzept, Realisierung
und Umsetzung; «phasen» und «module» allein ergäben alle zwölf Paare.

Aufruf nach tools/handbuch-import.py:  python3 tools/ergebnis-phasen.py
"""
import json
import os
import sys

PHASEN = ['Initialisierung', 'Konzept', 'Realisierung', 'Einführung', 'Umsetzung', 'Abschluss']

projekt = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def lesen(*teile):
    return open(os.path.join(projekt, *teile), encoding='utf-8').read()


module = json.loads(lesen('data', 'handbuch', 'elemente-modul.json'))
modul_namen = {m['id']: m['begriff'] for m in json.loads(lesen('data', 'module.json'))}
roh_a = lesen('data', 'aufgaben.json')
aufgaben = json.loads(roh_a)
roh_e = lesen('data', 'ergebnisse.json')
ergebnisse_liste = json.loads(roh_e)
ergebnisse = {e['begriff']: e for e in ergebnisse_liste}


def tabellen(x):
    if isinstance(x, dict):
        if x.get('t') == 'tabelle':
            yield x
        for v in x.values():
            yield from tabellen(v)
    elif isinstance(x, list):
        for v in x:
            yield from tabellen(v)


def geordnet(kreuze):
    return [p for p in PHASEN if p in kreuze]


# Je Zeile: (Aufgabe, Ergebnis) → Phasen über alle Module, dazu je Modul für
# Aufgabe, Ergebnis und Paar. Eine leere Aufgabenzelle setzt die Aufgabe der Zeile davor fort.
paare, paar_im_modul, aufgabe_im_modul, ergebnis_im_modul = {}, {}, {}, {}
for mid, eintrag in module.items():
    modul = modul_namen.get(mid)
    if not modul:
        sys.exit('Modul ohne Eintrag in data/module.json: ' + mid)
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
            paar_im_modul.setdefault((aufgabe, texte[1], modul), set()).update(kreuze)
            aufgabe_im_modul.setdefault((modul, aufgabe), set()).update(kreuze)
            ergebnis_im_modul.setdefault((modul, texte[1]), set()).update(kreuze)

# Der Tabellenkopf nennt die Phasen nicht einzeln — die Spaltenfolge an einem eindeutigen Paar prüfen.
probe = paare.get(('Entscheid Releasefreigabe treffen', 'QS- und Risikobericht'))
if probe != {'Umsetzung'}:
    sys.exit('Spaltenfolge der Phasen unerwartet: ' + repr(probe))

warnungen = []


def modul_phasen(e, im_modul):
    """{ Modul: [Phasen] } laut Tabellen, None, wenn jede Phase in jedem Modul gilt."""
    if not e.get('phasen') or not e.get('module'):
        return None
    alle = geordnet(e['phasen'])
    werte, zusammen = {}, set()
    for m in e['module']:
        kreuze = im_modul.get((m, e['begriff']))
        if kreuze is None:
            warnungen.append('Ohne Tabellenzeile im Modul (alle Phasen gelten): %s · %s' % (e['begriff'], m))
            werte[m] = alle
            continue
        werte[m] = geordnet(kreuze)
        zusammen |= kreuze
    fremd = sorted({m for (m, name) in im_modul if name == e['begriff']} - set(e['module']))
    if fremd:
        warnungen.append('Tabelle nennt Modul, der Eintrag nicht: %s · %s' % (e['begriff'], ', '.join(fremd)))
    if zusammen and geordnet(zusammen) != alle:
        warnungen.append('Phasen weichen von den Tabellen ab: %s · Daten %s, Tabellen %s' % (e['begriff'], alle, geordnet(zusammen)))
    return werte if any(werte[m] != alle for m in werte) else None


def einsetzen(e, nach, schluessel, wert):
    """Kopie von e mit «schluessel» direkt hinter «nach»; ohne Wert fällt er weg."""
    kopie = {}
    for k, v in e.items():
        if k == schluessel:
            continue
        kopie[k] = v
        if k == nach and wert:
            kopie[schluessel] = wert
    return kopie


kanten = {(a['begriff'], e) for a in aufgaben for e in a.get('ergebnisse', [])}
fehlend, ausserhalb, weniger = [], [], []
gesetzt = 0
neu_a, mit_modul_a = [], []
for a in aufgaben:
    werte = {}
    for name in a.get('ergebnisse', []):
        kreuze = paare.get((a['begriff'], name))
        if kreuze is None:
            fehlend.append((a['begriff'], name))
            continue
        werte[name] = geordnet(kreuze)
        if any(p not in a['phasen'] for p in werte[name]):
            ausserhalb.append((a['begriff'], name, werte[name]))
        e = ergebnisse.get(name)
        if e:
            schnitt = [p for p in PHASEN if p in a['phasen'] and p in e.get('phasen', [])]
            if schnitt != werte[name]:
                weniger.append((a['begriff'], name, [p for p in schnitt if p not in werte[name]]))
    je_modul = modul_phasen(a, aufgabe_im_modul)
    if je_modul:
        mit_modul_a.append((a['begriff'], je_modul))
        # Das Frontend schneidet ergebnisPhasen mit den Phasen im Modul — das
        # trifft nur, wenn die Kreuze eines Paars im Modul genau diese sind.
        for (aufgabe, name, m), kreuze in paar_im_modul.items():
            if aufgabe == a['begriff'] and m in je_modul and name in werte:
                erwartet = [p for p in werte[name] if p in je_modul[m]]
                if geordnet(kreuze) != erwartet:
                    warnungen.append('Paar im Modul nicht ableitbar: %s → %s · %s %s statt %s' % (aufgabe, name, m, geordnet(kreuze), erwartet))
    kopie = einsetzen(a, 'ergebnisse', 'ergebnisPhasen', werte)
    kopie = einsetzen(kopie, 'module', 'modulPhasen', je_modul)
    gesetzt += len(werte)
    neu_a.append(kopie)

neu_e, mit_modul_e = [], []
for e in ergebnisse_liste:
    je_modul = modul_phasen(e, ergebnis_im_modul) if (any(name == e['begriff'] for (m, name) in ergebnis_im_modul)) else None
    if je_modul:
        mit_modul_e.append((e['begriff'], je_modul))
    neu_e.append(einsetzen(e, 'module', 'modulPhasen', je_modul))

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
print('Phasen je Modul (modulPhasen): %d Aufgaben, %d Ergebnisse' % (len(mit_modul_a), len(mit_modul_e)))
for name, je_modul in mit_modul_a + mit_modul_e:
    print('  ', name, '·', '; '.join('%s: %s' % (m, ', '.join(p) or '—') for m, p in je_modul.items()))
for w in warnungen:
    print(w, file=sys.stderr)

for pfad, roh, neu in (('aufgaben.json', roh_a, neu_a), ('ergebnisse.json', roh_e, neu_e)):
    with open(os.path.join(projekt, 'data', pfad), 'w', encoding='utf-8') as f:
        f.write(json.dumps(neu, ensure_ascii=False, indent=2) + ('\n' if roh.endswith('\n') else ''))
