"""
SAÉ 303 - Extraction des stations corses du fichier national annuel des prix des carburants

Pourquoi : le jeu de données data.corsica « Prix des carburants - J-1 - avec historique en Corse »
n'est plus mis à jour depuis le 3 juin 2026. Pour prolonger l'analyse, on reprend le fichier
officiel dont il est lui-même issu : le stock annuel publié par le ministère de l'Économie.

Source   : https://donnees.roulez-eco.fr/opendata/annee/AAAA  (prix-carburants.gouv.fr)
           fichier PrixCarburants_annuel_AAAA.zip -> PrixCarburants_annuel_AAAA.xml (ISO-8859-1)
Licence  : Licence Ouverte / Open Licence 2.0 (Etalab)
Sélection: points de vente dont le code postal commence par « 20 » (Corse-du-Sud et Haute-Corse)
Sorties  : pour chaque année AAAA (une par fichier passé en argument) :
           site/data/brut/national-AAAA-corse-prix.csv       un relevé par ligne (station, carburant, horodatage, prix)
           site/data/brut/national-AAAA-corse-stations.csv   attributs des points de vente
           site/data/brut/national-AAAA-corse-ruptures.csv   ruptures de stock déclarées

Lancer   : python analyse/extraction_national.py PrixCarburants_annuel_2026.zip [PrixCarburants_annuel_2027.zip ...]
Dépend.  : bibliothèque standard uniquement (lecture en flux : le XML fait près de 400 Mo)
"""

import csv
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
SORTIE = RACINE / "site" / "data" / "brut"


def extraire(chemin_zip):
    z = zipfile.ZipFile(chemin_zip)
    membre = [n for n in z.namelist() if n.lower().endswith(".xml")][0]
    stations, prix, ruptures = [], [], []
    nb_pdv = 0
    with z.open(membre) as flux:
        for _, el in ET.iterparse(flux, events=("end",)):
            if el.tag != "pdv":
                continue
            nb_pdv += 1
            cp = el.get("cp", "")
            if cp.startswith("20"):
                sid = el.get("id")
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


if __name__ == "__main__":
    for chemin in sys.argv[1:]:
        membre, nb_pdv, stations, prix, ruptures = extraire(chemin)
        annee = re.search(r"(\d{4})", Path(membre).name).group(1)
        ecrire(f"national-{annee}-corse-stations.csv", stations,
               ["id", "cp", "pop", "latitude", "longitude", "adresse", "ville", "automate_24_24", "services"])
        ecrire(f"national-{annee}-corse-prix.csv", prix, ["id", "carburant", "carburant_id", "maj", "valeur"])
        ecrire(f"national-{annee}-corse-ruptures.csv", ruptures, ["id", "carburant", "carburant_id", "debut", "fin", "type"])
        print(f"{membre} : {nb_pdv} points de vente en France, dont {len(stations)} en Corse ; "
              f"{len(prix)} relevés de prix et {len(ruptures)} ruptures conservés")
