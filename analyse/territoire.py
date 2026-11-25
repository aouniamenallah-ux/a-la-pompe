"""
SAÉ 303 - Croisements territoriaux (page « Territoire » du site)

Appelé par traitement.py, une fois les prix corses calculés. Croise les prix avec :
  - le fichier national (moyennes du continent et de chaque département, stations actives),
    préparé par extraction_national.py ;
  - le fond de carte des communes (IGN ADMIN EXPRESS) pour mesurer l'accès aux stations ;
  - des données externes recopiées dans analyse/donnees_externes.json (Insee, SDES, CCFA...).

Tous les calculs restent simples et vérifiables : densités (stations rapportées à la population
ou à la superficie), distances à vol d'oiseau, moyennes de prix journaliers, budget annuel
d'un conducteur moyen (kilométrage × consommation × prix).
"""

import json
import math
from pathlib import Path

import numpy as np
import pandas as pd

RACINE = Path(__file__).resolve().parent.parent
BRUT = RACINE / "site" / "data" / "brut"
EXT = json.loads((RACINE / "analyse" / "donnees_externes.json").read_text(encoding="utf-8"))

DEPARTEMENTS = {
    "01": "Ain", "02": "Aisne", "03": "Allier", "04": "Alpes-de-Haute-Provence", "05": "Hautes-Alpes",
    "06": "Alpes-Maritimes", "07": "Ardèche", "08": "Ardennes", "09": "Ariège", "10": "Aube", "11": "Aude",
    "12": "Aveyron", "13": "Bouches-du-Rhône", "14": "Calvados", "15": "Cantal", "16": "Charente",
    "17": "Charente-Maritime", "18": "Cher", "19": "Corrèze", "2A": "Corse-du-Sud", "2B": "Haute-Corse",
    "21": "Côte-d'Or", "22": "Côtes-d'Armor", "23": "Creuse", "24": "Dordogne", "25": "Doubs", "26": "Drôme",
    "27": "Eure", "28": "Eure-et-Loir", "29": "Finistère", "30": "Gard", "31": "Haute-Garonne", "32": "Gers",
    "33": "Gironde", "34": "Hérault", "35": "Ille-et-Vilaine", "36": "Indre", "37": "Indre-et-Loire",
    "38": "Isère", "39": "Jura", "40": "Landes", "41": "Loir-et-Cher", "42": "Loire", "43": "Haute-Loire",
    "44": "Loire-Atlantique", "45": "Loiret", "46": "Lot", "47": "Lot-et-Garonne", "48": "Lozère",
    "49": "Maine-et-Loire", "50": "Manche", "51": "Marne", "52": "Haute-Marne", "53": "Mayenne",
    "54": "Meurthe-et-Moselle", "55": "Meuse", "56": "Morbihan", "57": "Moselle", "58": "Nièvre", "59": "Nord",
    "60": "Oise", "61": "Orne", "62": "Pas-de-Calais", "63": "Puy-de-Dôme", "64": "Pyrénées-Atlantiques",
    "65": "Hautes-Pyrénées", "66": "Pyrénées-Orientales", "67": "Bas-Rhin", "68": "Haut-Rhin", "69": "Rhône",
    "70": "Haute-Saône", "71": "Saône-et-Loire", "72": "Sarthe", "73": "Savoie", "74": "Haute-Savoie",
    "75": "Paris", "76": "Seine-Maritime", "77": "Seine-et-Marne", "78": "Yvelines", "79": "Deux-Sèvres",
    "80": "Somme", "81": "Tarn", "82": "Tarn-et-Garonne", "83": "Var", "84": "Vaucluse", "85": "Vendée",
    "86": "Vienne", "87": "Haute-Vienne", "88": "Vosges", "89": "Yonne", "90": "Territoire de Belfort",
    "91": "Essonne", "92": "Hauts-de-Seine", "93": "Seine-Saint-Denis", "94": "Val-de-Marne", "95": "Val-d'Oise",
}
SEUIL_KM = 10            # « loin d'une station » : centre de la commune à plus de 10 km à vol d'oiseau
NOM_CARB = {"g": "Gazole", "s": "SP95"}


# ------------------------------------------------------------------------------------
# outils géographiques (sans dépendance : projection locale équirectangulaire)
# ------------------------------------------------------------------------------------
LAT0 = 42.15
KX, KY = 111.32 * math.cos(math.radians(LAT0)), 110.57   # km par degré de longitude / latitude


def anneaux(geom):
    if geom["type"] == "Polygon":
        return [geom["coordinates"]]
    return geom["coordinates"]


def aire_et_centre(geom):
    """Superficie (km²) et centre de gravité (lon, lat) d'un polygone, trous compris."""
    a_tot = cx = cy = 0.0
    for poly in anneaux(geom):
        for k, ring in enumerate(poly):
            x = np.array([p[0] for p in ring]) * KX
            y = np.array([p[1] for p in ring]) * KY
            x1, y1 = np.roll(x, -1), np.roll(y, -1)
            croix = x * y1 - x1 * y
            a = croix.sum() / 2
            # anneau extérieur compté positivement, trous négativement, quel que soit le sens de saisie
            signe = 1 if k == 0 else -1
            a_abs = abs(a) * signe
            if a != 0:
                cx += a_abs * ((x + x1) * croix).sum() / (6 * a)
                cy += a_abs * ((y + y1) * croix).sum() / (6 * a)
            a_tot += a_abs
    return a_tot, (cx / a_tot / KX, cy / a_tot / KY)


def dans_polygone(lon, lat, geom, cadre=None):
    """Test du point dans le polygone (lancer de rayon), trous compris."""
    if cadre and not (cadre[0] <= lon <= cadre[2] and cadre[1] <= lat <= cadre[3]):
        return False
    dedans = False
    for poly in anneaux(geom):
        for ring in poly:
            n, c = len(ring), False
            for i in range(n):
                x1, y1 = ring[i]
                x2, y2 = ring[(i + 1) % n]
                if (y1 > lat) != (y2 > lat) and lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1:
                    c = not c
            if c:
                dedans = not dedans
    return dedans


def distance_km(lon1, lat1, lon2, lat2):
    """Distance à vol d'oiseau (formule de haversine), en km."""
    r = 6371.0
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dp, dl = p2 - p1, np.radians(lon2 - lon1)
    h = np.sin(dp / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dl / 2) ** 2
    return 2 * r * np.arcsin(np.sqrt(h))


def r(v, d=4):
    return None if v is None or (isinstance(v, float) and math.isnan(v)) else round(float(v), d)


# ------------------------------------------------------------------------------------
def calculer(quotidien, panel, stations, jours, debut_crise, fin, note):
    """Renvoie (indicateurs, données du site) pour la page Territoire."""
    pop, sup = EXT["population"]["valeurs"], EXT["superficie"]["valeurs"]
    pop["continent"] = pop["france_metro"] - pop["corse"]
    sup["continent"] = sup["france_metro"] - sup["corse"]

    # ---------- 1. stations actives (fichier national : au moins un prix daté de 2026) ----------
    cpt = pd.read_csv(BRUT / "national-france-stations.csv", dtype={"dep": str}).set_index("dep")
    nb = {"2A": int(cpt.loc["2A", "stations_actives"]), "2B": int(cpt.loc["2B", "stations_actives"])}
    nb["corse"] = nb["2A"] + nb["2B"]
    cont = cpt.drop(index=["2A", "2B"])
    nb["continent"] = int(cont["stations_actives"].sum())
    densite = {}
    for z in ["2A", "2B", "corse", "continent"]:
        densite[z] = dict(stations=nb[z], population=pop[z], superficie=sup[z],
                          par_10000_hab=nb[z] / pop[z] * 1e4, par_100_km2=nb[z] / sup[z] * 100,
                          hab_par_station=pop[z] / nb[z], km2_par_station=sup[z] / nb[z])
    densite["continent"]["autoroute"] = int(cont["dont_autoroute"].sum())
    note(f"Densité : {nb['corse']} stations actives en Corse ({nb['2A']} en Corse-du-Sud, {nb['2B']} en Haute-Corse), "
         f"{nb['continent']} sur le continent ; {densite['corse']['par_10000_hab']:.2f} stations pour 10 000 habitants "
         f"en Corse contre {densite['continent']['par_10000_hab']:.2f} sur le continent")

    # ---------- 2. carte : stations actives corses et accès depuis chaque commune ----------
    st_nat = pd.concat([pd.read_csv(f, dtype={"cp": str}) for f in sorted(BRUT.glob("national-*-corse-stations.csv"))])
    st_nat = st_nat.drop_duplicates("id", keep="last").set_index("id")
    px = pd.concat([pd.read_csv(f) for f in sorted(BRUT.glob("national-*-corse-prix.csv"))])
    px = px[px["maj"].fillna("").str.len() >= 16]
    actifs = sorted(set(px.loc[px["maj"] >= "2026-01-01", "id"]))
    st_act = st_nat.loc[actifs].copy()
    st_act["dep"] = st_act["cp"].str[:3].map(lambda p: "2A" if p in ("200", "201") else "2B")
    st_act["marque"] = stations["marque"].reindex(st_act.index)
    st_act["epci"] = stations["epci"].reindex(st_act.index)
    assert len(st_act) == nb["corse"], (len(st_act), nb["corse"])

    geo_txt = (RACINE / "site" / "data" / "corse-geo.js").read_text(encoding="utf-8")
    debut_js = geo_txt.index("window.CORSE_GEO")
    geo = json.loads(geo_txt[geo_txt.index("=", debut_js) + 1:].strip().rstrip(";"))
    communes = []
    slon, slat = st_act["longitude"].to_numpy(), st_act["latitude"].to_numpy()
    for f in geo["communes"]["features"]:
        aire, (lon, lat) = aire_et_centre(f["geometry"])
        d = distance_km(lon, lat, slon, slat)
        pts = [p for poly in anneaux(f["geometry"]) for p in poly[0]]
        cadre = (min(p[0] for p in pts), min(p[1] for p in pts), max(p[0] for p in pts), max(p[1] for p in pts))
        n_dans = int(sum(dans_polygone(x, y, f["geometry"], cadre) for x, y in zip(slon, slat)))
        communes.append(dict(code=f["properties"]["code"], nom=f["properties"]["nom"], dep=f["properties"]["dep"],
                             aire=aire, km=float(d.min()), n10=int((d <= SEUIL_KM).sum()), stations=n_dans))
    cm = pd.DataFrame(communes)
    cm["km"] = cm["km"].round(1)   # même arrondi que sur la carte du site
    acces = {}
    for z, sous in [("corse", cm), ("2A", cm[cm["dep"] == "2A"]), ("2B", cm[cm["dep"] == "2B"])]:
        loin = sous["km"] > SEUIL_KM
        acces[z] = dict(communes=len(sous), avec_station=int((sous["stations"] > 0).sum()),
                        loin=int(loin.sum()), part_loin=float(loin.mean() * 100),
                        aire=float(sous["aire"].sum()), part_aire_loin=float(sous.loc[loin, "aire"].sum() / sous["aire"].sum() * 100),
                        km_median=float(sous["km"].median()), km_max=float(sous["km"].max()),
                        commune_max=sous.loc[sous["km"].idxmax(), "nom"])
    note(f"Accès : {acces['corse']['avec_station']} communes sur {acces['corse']['communes']} ont une station ; "
         f"{acces['corse']['loin']} communes ({acces['corse']['part_loin']:.0f} %) ont leur centre à plus de {SEUIL_KM} km "
         f"d'une station (record : {acces['corse']['commune_max']}, {acces['corse']['km_max']:.1f} km) ; "
         f"superficie des communes recalculée : {acces['2A']['aire']:.0f} km² (2A) et {acces['2B']['aire']:.0f} km² (2B)")

    # ---------- 3. enseignes (stations décrites par data.corsica) ----------
    ens = st_act.assign(marque=st_act["marque"].fillna("Non renseignée"))
    par_dep = {z: ens[ens["dep"] == z]["marque"].value_counts().to_dict() for z in ["2A", "2B"]}
    par_dep["corse"] = ens["marque"].value_counts().to_dict()
    epci = []
    for nom, sous in st_act[st_act["epci"].notna()].groupby("epci"):
        v = sous["marque"].value_counts()
        epci.append(dict(epci=nom, dep=sous["dep"].mode().iloc[0], stations=len(sous), marques=v.to_dict(),
                         tete=v.index[0], part_tete=float(v.iloc[0] / len(sous) * 100), nb_marques=int(len(v))))
    epci.sort(key=lambda e: -e["stations"])
    seule = [e for e in epci if e["nb_marques"] == 1]
    note(f"Enseignes : {par_dep['corse']} ; {len(seule)} intercommunalités sur {len(epci)} n'ont qu'une enseigne")

    # ---------- 4. Corse et continent ----------
    q = pd.read_csv(BRUT / "national-france-quotidien.csv", parse_dates=["date"])
    serie = lambda z, c: q[(q["zone"] == z) & (q["carburant"] == c)].set_index("date")
    cg, cs, ce = serie("continent", "Gazole"), serie("continent", "SP95"), serie("continent", "E10")
    n_ref = cg["stations"].median()
    debut_cmp = cg.index[cg["stations"] >= 0.9 * n_ref][0]
    idx = pd.date_range(debut_cmp, fin, freq="D")
    corse_g, corse_s = quotidien["g"]["moy"].reindex(idx), quotidien["s"]["moy"].reindex(idx)
    comp = pd.DataFrame({"corse_g": corse_g, "cont_g": cg["moyenne"].reindex(idx),
                         "corse_s": corse_s, "cont_s": cs["moyenne"].reindex(idx), "cont_e10": ce["moyenne"].reindex(idx),
                         "n_cont_g": cg["stations"].reindex(idx)})
    comp["ecart_g"] = comp["corse_g"] - comp["cont_g"]
    comp["ecart_s"] = comp["corse_s"] - comp["cont_s"]
    # contrôle : la même moyenne corse recalculée sur le fichier national seul (stations data.corsica)
    dcn = serie("corse_data_corsica", "Gazole")
    ctrl = (dcn["moyenne"].reindex(idx) - comp["corse_g"])[dcn["stations"].reindex(idx) >= 0.9 * len(stations)]
    avant = comp.loc[:debut_crise - pd.Timedelta(days=1)]
    crise = comp.loc[debut_crise:]

    def jour_bascule(e):  # premier jour de la crise où la Corse passe sous le continent, s'il existe
        neg = e.loc[debut_crise:] < 0
        return str(neg.idxmax().date()) if neg.any() else None

    sept = comp.loc["2026-09-01":"2026-09-30"] if fin >= pd.Timestamp("2026-09-30") else None
    veille = pd.Timestamp("2026-10-31")
    destock = None
    if fin >= pd.Timestamp("2026-11-07"):
        destock = {c: dict(corse_cts=(comp.at[fin, f"corse_{c}"] - comp.at[veille, f"corse_{c}"]) * 100,
                           continent_cts=(comp.at[fin, f"cont_{c}"] - comp.at[veille, f"cont_{c}"]) * 100)
                   for c in ["g", "s"]}
    continent = dict(
        debut=str(debut_cmp.date()), stations_continent=int(n_ref),
        controle_ecart_max_cts=float(ctrl.abs().max() * 100) if len(ctrl) else None,
        ecart_avant={c: float(avant[f"ecart_{c}"].mean() * 100) for c in ["g", "s"]},
        ecart_crise={c: float(crise[f"ecart_{c}"].mean() * 100) for c in ["g", "s"]},
        ecart_dernier={c: float(comp[f"ecart_{c}"].iloc[-1] * 100) for c in ["g", "s"]},
        ecart_max={c: dict(cts=float(comp[f"ecart_{c}"].max() * 100), date=str(comp[f"ecart_{c}"].idxmax().date())) for c in ["g", "s"]},
        ecart_min={c: dict(cts=float(comp[f"ecart_{c}"].min() * 100), date=str(comp[f"ecart_{c}"].idxmin().date())) for c in ["g", "s"]},
        jours_corse_moins_chere={c: int((crise[f"ecart_{c}"] < 0).sum()) for c in ["g", "s"]},
        jours_crise=len(crise),
        bascule={c: jour_bascule(comp[f"ecart_{c}"]) for c in ["g", "s"]},
        septembre=None if sept is None else {c: dict(corse=float(sept[f"corse_{c}"].mean()), continent=float(sept[f"cont_{c}"].mean()),
                                                      ecart_cts=float(sept[f"ecart_{c}"].mean() * 100)) for c in ["g", "s"]},
        destockage=destock, veille_destockage=str(veille.date()),
        moyennes_crise=dict(corse_g=float(crise["corse_g"].mean()), cont_g=float(crise["cont_g"].mean()),
                            corse_s=float(crise["corse_s"].mean()), cont_s=float(crise["cont_s"].mean()),
                            cont_e10=float(crise["cont_e10"].mean())),
        moyennes_avant=dict(corse_g=float(avant["corse_g"].mean()), cont_g=float(avant["cont_g"].mean()),
                            corse_s=float(avant["corse_s"].mean()), cont_s=float(avant["cont_s"].mean()),
                            cont_e10=float(avant["cont_e10"].mean())),
    )
    note(f"Corse - continent (depuis le {debut_cmp.date()}, {int(n_ref)} stations continentales) : "
         f"gazole {continent['ecart_avant']['g']:+.1f} ct avant la crise, {continent['ecart_crise']['g']:+.1f} ct pendant ; "
         f"SP95 {continent['ecart_avant']['s']:+.1f} ct puis {continent['ecart_crise']['s']:+.1f} ct ; contrôle de la moyenne "
         f"corse recalculée sur le fichier national : {continent['controle_ecart_max_cts'] or 0:.2f} ct d'écart au plus")

    # ---------- 5. classement des départements ----------
    dd = pd.read_csv(BRUT / "national-france-departements.csv", dtype={"dep": str})
    dd = dd[dd["dep"].isin(DEPARTEMENTS)]
    classement = {}
    for c_nom, k in [("Gazole", "g"), ("SP95", "s")]:
        classement[k] = {}
        for per in ["avant_crise", "crise", "dernier_jour"]:
            t = dd[(dd["carburant"] == c_nom) & (dd["periode"] == per) & (dd["stations"] >= 5)].sort_values("moyenne", ascending=False)
            t = t.reset_index(drop=True)
            classement[k][per] = dict(
                rang_2A=int(t.index[t["dep"] == "2A"][0] + 1) if (t["dep"] == "2A").any() else None,
                rang_2B=int(t.index[t["dep"] == "2B"][0] + 1) if (t["dep"] == "2B").any() else None,
                departements=len(t),
                liste=[dict(dep=x.dep, nom=DEPARTEMENTS[x.dep], moy=round(x.moyenne, 4), n=int(x.stations)) for x in t.itertuples()])
    cr = classement["g"]["crise"]
    note(f"Classement des départements (gazole, crise) : Corse-du-Sud {cr['rang_2A']}e, Haute-Corse {cr['rang_2B']}e "
         f"sur {cr['departements']} (du plus cher au moins cher)")

    # ---------- 6. prix par département corse et budget d'un conducteur moyen ----------
    vt = EXT["voiture_type"]
    p1 = slice(jours[0], debut_crise - pd.Timedelta(days=1))
    p2 = slice(debut_crise, fin)
    prix_dep = {}
    for k in ["g", "s"]:
        prix_dep[k] = {}
        for z in ["2A", "2B"]:
            m = panel[k][stations.index[stations["dep"] == z]].mean(axis=1)
            prix_dep[k][z] = dict(p1=float(m.loc[p1].mean()), p2=float(m.loc[p2].mean()), dernier=float(m.iloc[-1]),
                                  pic=float(m.loc[p2].max()))
        m = quotidien[k]["moy"]
        prix_dep[k]["corse"] = dict(p1=float(m.loc[p1].mean()), p2=float(m.loc[p2].mean()), dernier=float(m.iloc[-1]),
                                    pic=float(m.loc[p2].max()))
    nv = EXT["niveau_de_vie"]
    budget = {}
    for k in ["g", "s"]:
        litres = vt["km_par_an"] * vt["litres_100km"][k] / 100
        cc = "g" if k == "g" else "s"
        b = dict(litres=litres, conso=vt["litres_100km"][k])
        pc = prix_dep[k]["corse"]
        b["corse"] = {per: litres * pc[per] for per in ["p1", "p2", "dernier", "pic"]}
        b["surcout_crise"] = litres * (pc["p2"] - pc["p1"])
        b["surcout_insulaire_crise"] = litres * continent["ecart_crise"][cc] / 100
        b["surcout_insulaire_avant"] = litres * continent["ecart_avant"][cc] / 100
        b["continent_crise"] = litres * continent["moyennes_crise"][f"cont_{cc}"]
        b["km_50e"] = {per: 50 / pc[per] / vt["litres_100km"][k] * 100 for per in ["p1", "pic", "dernier"]}
        b["hausse_prix_pct"] = (pc["p2"] / pc["p1"] - 1) * 100
        b["baisse_conso_estimee_pct"] = b["hausse_prix_pct"] * EXT["elasticite_prix"]["valeur"]
        b["par_dep"] = {}
        for z in ["2A", "2B"]:
            pz = prix_dep[k][z]
            bud = litres * pz["p2"]
            b["par_dep"][z] = dict(budget_p2=bud, surcout=litres * (pz["p2"] - pz["p1"]),
                                   part_mediane=bud / nv["mediane"][z] * 100, part_d1=bud / nv["premier_decile"][z] * 100,
                                   mois_mediane=bud / (nv["mediane"][z] / 12), mois_d1=bud / (nv["premier_decile"][z] / 12))
        budget[k] = b
    bg = budget["g"]
    note(f"Budget gazole d'un conducteur moyen ({vt['km_par_an']} km, {vt['litres_100km']['g']} L/100) : "
         f"{bg['corse']['p1']:.0f} € par an avant la crise, {bg['corse']['p2']:.0f} € au prix moyen de la crise "
         f"(+{bg['surcout_crise']:.0f} €) ; {bg['par_dep']['2B']['part_mediane']:.1f} % du niveau de vie médian en Haute-Corse, "
         f"{bg['par_dep']['2A']['part_mediane']:.1f} % en Corse-du-Sud")

    indic = dict(densite=densite, acces=acces, enseignes=dict(par_dep=par_dep, epci_une_seule=len(seule), epci=len(epci)),
                 continent=continent, classement={k: {p: {x: v for x, v in d.items() if x != "liste"} for p, d in c.items()}
                                                  for k, c in classement.items()},
                 prix_dep=prix_dep, budget=budget, seuil_km=SEUIL_KM)

    site = dict(
        densite=densite, acces=acces, seuil=SEUIL_KM,
        communes=[dict(c=x.code, n=x.nom, d=x.dep, km=round(x.km, 1), n10=x.n10, s=x.stations) for x in cm.itertuples()],
        stations=[dict(id=int(i), lat=round(x.latitude, 5), lon=round(x.longitude, 5), dep=x.dep,
                       m=x.marque if isinstance(x.marque, str) else None,
                       v=str(x.ville).title() if isinstance(x.ville, str) else "")
                  for i, x in st_act.iterrows()],
        enseignes=dict(par_dep=par_dep, epci=epci),
        continent=dict(ind=continent, jours=[str(d.date()) for d in idx],
                       corse_g=[r(v) for v in comp["corse_g"]], cont_g=[r(v) for v in comp["cont_g"]],
                       corse_s=[r(v) for v in comp["corse_s"]], cont_s=[r(v) for v in comp["cont_s"]],
                       cont_e10=[r(v) for v in comp["cont_e10"]]),
        classement=classement, prix_dep=prix_dep, budget=budget, externe=EXT,
    )
    return indic, site
