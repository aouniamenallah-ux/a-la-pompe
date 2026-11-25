"""
SAÉ 303 - Extraction du fichier national annuel des prix des carburants

Pourquoi : le jeu de données data.corsica « Prix des carburants - J-1 - avec historique en Corse »
n'est plus mis à jour depuis le 3 juin 2026. Pour prolonger l'analyse, on reprend le fichier
officiel dont il est lui-même issu : le stock annuel publié par le ministère de l'Économie.
Le même fichier couvre toute la France : on en tire aussi les prix moyens du continent et
de chaque département, pour situer la Corse (page « Territoire »).

Source   : https://donnees.roulez-eco.fr/opendata/annee/AAAA  (prix-carburants.gouv.fr)
           fichier PrixCarburants_annuel_AAAA.zip -> PrixCarburants_annuel_AAAA.xml (ISO-8859-1)
Licence  : Licence Ouverte / Open Licence 2.0 (Etalab)
Sorties  : pour chaque année AAAA (une par fichier passé en argument), stations corses
           (code postal commençant par « 20 ») :
             site/data/brut/national-AAAA-corse-prix.csv       un relevé par ligne (station, carburant, horodatage, prix)
             site/data/brut/national-AAAA-corse-stations.csv   attributs des points de vente
             site/data/brut/national-AAAA-corse-ruptures.csv   ruptures de stock déclarées
           toutes années confondues, France entière (agrégats seulement, quelques centaines de Ko) :
             site/data/brut/national-france-quotidien.csv      prix moyen et médian chaque jour : continent,
                                                               Corse, Corse-du-Sud, Haute-Corse
             site/data/brut/national-france-departements.csv   prix moyen de chaque département par période
             site/data/brut/national-france-stations.csv       nombre de stations actives par département

Méthode des moyennes (la même que pour la Corse dans traitement.py) : prix hors de 1-3,5 €/L
et pics isolés de plus de 15 % retirés ; chaque jour, dernier prix de la journée de chaque
station, sinon report du dernier prix connu pendant 120 jours au plus ; une rupture
définitive retire le prix jusqu'à la mise à jour suivante. « Continent » : France
métropolitaine hors Corse (codes postaux 01 à 95, hors 20).

Lancer   : python analyse/extraction_national.py PrixCarburants_annuel_2026.zip [PrixCarburants_annuel_2027.zip ...]
Dépend.  : numpy et pandas (déjà requis par traitement.py) ; lecture du XML en flux (près de 400 Mo par an)
"""

import csv
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from array import array
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd

RACINE = Path(__file__).resolve().parent.parent
SORTIE = RACINE / "site" / "data" / "brut"
DATA_CORSICA = SORTIE / "prix-des-carburants-j-1-avec-historique-en-corse.csv"

PRIX_MIN, PRIX_MAX = 1.0, 3.5      # bornes de vraisemblance (€/L), comme dans traitement.py
SEUIL_PIC = 0.15                    # pic isolé
PEREMPTION_JOURS = 120              # durée maximale de report d'un prix
DEBUT_CRISE = date(2026, 2, 28)     # début de la guerre au Moyen-Orient
CARBURANTS_FR = {"Gazole": 0, "SP95": 1, "E10": 2}
ORIGINE = date(2000, 1, 1)


def departement(cp):
    """Code du département d'après le code postal : 200xx-201xx -> 2A, 202xx et 206xx -> 2B."""
    if cp.startswith("20"):
        return "2A" if cp[:3] in ("200", "201") else "2B"
    if cp.startswith("97"):
        return cp[:3]
    return cp[:2]


class France:
    """Accumule, station par station, les relevés de gazole, SP95 et E10 de toute la France."""

    def __init__(self):
        self.index = {}                      # id de station -> rang
        self.dep, self.pop, self.dernier = [], [], []
        self.s, self.c, self.j, self.m, self.p = array("i"), array("b"), array("i"), array("h"), array("f")
        self.rs, self.rc, self.rj, self.rm = array("i"), array("b"), array("i"), array("h")
        self._jours = {}

    def jour(self, texte):
        j = self._jours.get(texte)
        if j is None:
            j = self._jours[texte] = (date.fromisoformat(texte) - ORIGINE).days
        return j

    def station(self, sid, cp, pop):
        k = self.index.get(sid)
        if k is None:
            k = self.index[sid] = len(self.dep)
            self.dep.append(departement(cp))
            self.pop.append(pop or "")
            self.dernier.append(-1)
        elif pop:
            self.pop[k] = pop          # attribut le plus récent (fichier de l'année la plus récente)
        return k

    def prix(self, k, nom, maj, valeur):
        if not maj or len(maj) < 16:
            return
        j = self.jour(maj[:10])
        if j > self.dernier[k]:
            self.dernier[k] = j
        c = CARBURANTS_FR.get(nom)
        if c is None or not valeur:
            return
        self.s.append(k); self.c.append(c); self.j.append(j)
        self.m.append(int(maj[11:13]) * 60 + int(maj[14:16])); self.p.append(float(valeur))

    def rupture(self, k, nom, debut, type_):
        c = CARBURANTS_FR.get(nom)
        if c is None or type_ != "definitive" or not debut or len(debut) < 16:
            return
        self.rs.append(k); self.rc.append(c); self.rj.append(self.jour(debut[:10]))
        self.rm.append(int(debut[11:13]) * 60 + int(debut[14:16]))


def extraire(chemin_zip, fr):
    z = zipfile.ZipFile(chemin_zip)
    membre = [n for n in z.namelist() if n.lower().endswith(".xml")][0]
    stations, prix, ruptures = [], [], []
    nb_pdv = 0
    with z.open(membre) as flux:
        for _, el in ET.iterparse(flux, events=("end",)):
            if el.tag != "pdv":
                continue
            nb_pdv += 1
            cp, sid = el.get("cp", ""), el.get("id")
            k = fr.station(sid, cp, el.get("pop"))
            for p in el.iter("prix"):
                fr.prix(k, p.get("nom"), p.get("maj"), p.get("valeur"))
            for r in el.iter("rupture"):
                fr.rupture(k, r.get("nom"), r.get("debut"), r.get("type", ""))
            if cp.startswith("20"):
                horaires = el.find("horaires")
                services = [s.text.strip() for s in el.iter("service") if s.text]
                lat, lon = el.get("latitude"), el.get("longitude")
                stations.append({
                    "id": sid, "cp": cp, "pop": el.get("pop"),
                    # coordonnées publiées en degrés × 100 000 (format PTV)
                    "latitude": round(float(lat) / 100000, 6) if lat else "",
                    "longitude": round(float(lon) / 100000, 6) if lon else "",
                    "adresse": (el.findtext("adresse") or "").strip(),
                    "ville": (el.findtext("ville") or "").strip(),
                    "automate_24_24": 1 if horaires is not None and horaires.get("automate-24-24") == "1" else 0,
                    "services": ",".join(services),
                })
                for p in el.findall("prix"):
                    prix.append({"id": sid, "carburant": p.get("nom"), "carburant_id": p.get("id"),
                                 "maj": p.get("maj"), "valeur": p.get("valeur")})
                for r in el.findall("rupture"):
                    ruptures.append({"id": sid, "carburant": r.get("nom"), "carburant_id": r.get("id"),
                                     "debut": r.get("debut"), "fin": r.get("fin"), "type": r.get("type", "")})
            el.clear()  # libère la mémoire au fil de la lecture
    return membre, nb_pdv, stations, prix, ruptures


def ecrire(nom, lignes, champs):
    with open(SORTIE / nom, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=champs)
        w.writeheader()
        w.writerows(lignes)


def panel(fr, c, j0, j1):
    """Matrice jours × stations du prix du carburant c (NaN si inconnu ou périmé)."""
    s, cc, j, m, p = (np.frombuffer(a, dtype=t) for a, t in
                      ((fr.s, np.int32), (fr.c, np.int8), (fr.j, np.int32), (fr.m, np.int16), (fr.p, np.float32)))
    garde = (cc == c) & (j <= j1)
    s, j, m, p = s[garde], j[garde], m[garde], p[garde].astype(np.float64)
    ok = (p >= PRIX_MIN) & (p <= PRIX_MAX)
    s, j, m, p = s[ok], j[ok], m[ok], p[ok]
    ordre = np.lexsort((m, j, s))
    s, j, m, p = s[ordre], j[ordre], m[ordre], p[ordre]
    # pic isolé : écart de plus de 15 % avec le relevé précédent ET le suivant de la même station,
    # alors que ces deux-là sont proches l'un de l'autre (faute de saisie)
    if len(p) > 2:
        a, b, d = p[:-2], p[1:-1], p[2:]
        meme = (s[:-2] == s[1:-1]) & (s[2:] == s[1:-1])
        pic = meme & (np.abs(b - a) / a > SEUIL_PIC) & (np.abs(b - d) / d > SEUIL_PIC) & (np.abs(a - d) / d < SEUIL_PIC)
        garde = np.r_[True, ~pic, True]
        s, j, m, p = s[garde], j[garde], m[garde], p[garde]
    # rupture définitive : marqueur -1 qui interrompt le report du prix
    rs, rc, rj, rm = (np.frombuffer(a, dtype=t) for a, t in
                      ((fr.rs, np.int32), (fr.rc, np.int8), (fr.rj, np.int32), (fr.rm, np.int16)))
    g = (rc == c) & (rj >= j0) & (rj <= j1)
    s = np.r_[s, rs[g]]; j = np.r_[j, rj[g]]; m = np.r_[m, rm[g]]; p = np.r_[p, np.full(g.sum(), -1.0)]
    ordre = np.lexsort((m, j, s))
    s, j, p = s[ordre], j[ordre], p[ordre]
    dernier = np.r_[(s[1:] != s[:-1]) | (j[1:] != j[:-1]), True]   # dernier relevé de la journée
    s, j, p = s[dernier], j[dernier], p[dernier]
    garde = j >= j0 - PEREMPTION_JOURS
    s, j, p = s[garde], j[garde], p[garde]
    debut = min(j0, int(j.min())) if len(j) else j0
    mat = np.full((j1 - debut + 1, len(fr.dep)), np.nan)
    mat[j - debut, s] = p
    mat = pd.DataFrame(mat).ffill(limit=PEREMPTION_JOURS).to_numpy(copy=True)[j0 - debut:]
    mat[mat < 0] = np.nan
    return mat


def agreger(fr, dc_ids):
    """Moyennes quotidiennes par zone et par département, nombre de stations par département."""
    hier = (datetime.now(ZoneInfo("Europe/Paris")).date() - timedelta(days=1) - ORIGINE).days
    j1 = min(max(fr.dernier), hier)
    # premier jour des moyennes : 1er avril 2025 (début de l'analyse) si le fichier 2025 est fourni,
    # sinon le premier jour disponible (1er janvier 2026)
    j0 = max((date(2025, 4, 1) - ORIGINE).days, int(np.frombuffer(fr.j, dtype=np.int32).min()))
    jours = [ORIGINE + timedelta(days=int(x)) for x in range(j0, j1 + 1)]
    dep = np.array(fr.dep)
    ids = np.array(list(fr.index.keys()))
    zones = {
        "continent": ~(np.char.startswith(dep, "97") | np.isin(dep, ["2A", "2B"])),
        "corse": np.isin(dep, ["2A", "2B"]),
        "2A": dep == "2A",
        "2B": dep == "2B",
        "corse_data_corsica": np.isin(ids, list(dc_ids)),
    }
    lignes, par_dep = [], []
    i_crise = (DEBUT_CRISE - jours[0]).days
    deps = sorted(set(d for d in fr.dep if not d.startswith("97")))
    for nom, c in CARBURANTS_FR.items():
        mat = panel(fr, c, j0, j1)
        for z, masque in zones.items():
            sous = mat[:, masque]
            n = np.sum(~np.isnan(sous), axis=1)
            with np.errstate(all="ignore"):
                moy, med = np.nanmean(sous, axis=1), np.nanmedian(sous, axis=1)
            for k, jour in enumerate(jours):
                if n[k]:
                    lignes.append({"date": jour.isoformat(), "zone": z, "carburant": nom, "stations": int(n[k]),
                                   "moyenne": round(float(moy[k]), 5), "mediane": round(float(med[k]), 5)})
        for d in deps:
            sous = mat[:, dep == d]
            with np.errstate(all="ignore"):
                moy = np.nanmean(sous, axis=1)
            n = np.sum(~np.isnan(sous), axis=1)
            for periode, tranche in (("avant_crise", slice(0, i_crise)), ("crise", slice(i_crise, None)),
                                     ("dernier_jour", slice(len(jours) - 1, None))):
                v = moy[tranche]
                if np.isfinite(v).any():
                    par_dep.append({"dep": d, "carburant": nom, "periode": periode,
                                    "moyenne": round(float(np.nanmean(v)), 5), "stations": int(n[tranche].max())})
    ecrire("national-france-quotidien.csv", lignes, ["date", "zone", "carburant", "stations", "moyenne", "mediane"])
    ecrire("national-france-departements.csv", par_dep, ["dep", "carburant", "periode", "moyenne", "stations"])
    # stations actives : au moins un prix affiché depuis le 1er janvier 2026, puis depuis 60 jours
    j2026 = (date(2026, 1, 1) - ORIGINE).days
    dernier = np.array(fr.dernier)
    pop = np.array(fr.pop)
    comptes = []
    for d in deps:
        x = dep == d
        comptes.append({"dep": d, "stations_actives": int(np.sum(x & (dernier >= j2026))),
                        "stations_60_jours": int(np.sum(x & (dernier >= j1 - 59))),
                        "dont_autoroute": int(np.sum(x & (dernier >= j2026) & (pop == "A")))})
    ecrire("national-france-stations.csv", comptes, ["dep", "stations_actives", "stations_60_jours", "dont_autoroute"])
    return jours[-1], len(lignes), len(par_dep), sum(c["stations_actives"] for c in comptes)


if __name__ == "__main__":
    fr = France()
    for chemin in sys.argv[1:]:
        membre, nb_pdv, stations, prix, ruptures = extraire(chemin, fr)
        annee = re.search(r"(\d{4})", Path(membre).name).group(1)
        ecrire(f"national-{annee}-corse-stations.csv", stations,
               ["id", "cp", "pop", "latitude", "longitude", "adresse", "ville", "automate_24_24", "services"])
        ecrire(f"national-{annee}-corse-prix.csv", prix, ["id", "carburant", "carburant_id", "maj", "valeur"])
        ecrire(f"national-{annee}-corse-ruptures.csv", ruptures, ["id", "carburant", "carburant_id", "debut", "fin", "type"])
        print(f"{membre} : {nb_pdv} points de vente en France, dont {len(stations)} en Corse ; "
              f"{len(prix)} relevés de prix et {len(ruptures)} ruptures conservés")
    dc = pd.read_csv(DATA_CORSICA, sep=None, engine="python", usecols=lambda c: c.strip('﻿"') == "id")
    fin, n1, n2, n3 = agreger(fr, set(dc.iloc[:, 0].astype(str)))
    print(f"France : {len(fr.p)} relevés de gazole, SP95 et E10 ; moyennes jusqu'au {fin} "
          f"({n1} lignes quotidiennes, {n2} lignes départementales) ; {n3} stations actives en 2026")
