"""
SAÉ 303 - Concevoir des visualisations de données pour le web et un support animé
Traitement et analyse du jeu de données « Prix des carburants - J-1 - avec historique en Corse »

Sources  : data.corsica (Collectivité de Corse), d'après le flux officiel prix-carburants.gouv.fr,
           jusqu'au 2 juin 2026 (le jeu n'est plus mis à jour ensuite) ;
           puis le fichier annuel 2026 de prix-carburants.gouv.fr (mêmes stations), jusqu'au 24 novembre 2026
Licence  : Licence Ouverte / Open Licence 2.0 (Etalab)
Entrées  : site/data/brut/prix-des-carburants-j-1-avec-historique-en-corse.csv (6 760 lignes, 27 colonnes)
           site/data/brut/national-2026-corse-prix.csv et -ruptures.csv (extraits par extraction_national.py)
Sorties  : site/data/propre/*.csv      -> données nettoyées (téléchargeables depuis le site)
           site/data/data.js           -> données préparées pour les visualisations D3.js
           analyse/indicateurs.json    -> indicateurs repris dans le rapport et le classeur Excel

Lancer   : python analyse/traitement.py   (depuis la racine du projet)
Dépend.  : pandas, numpy
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd

RACINE = Path(__file__).resolve().parent.parent
BRUT = RACINE / "site" / "data" / "brut" / "prix-des-carburants-j-1-avec-historique-en-corse.csv"
NAT_PRIX = sorted((RACINE / "site" / "data" / "brut").glob("national-*-corse-prix.csv"))       # un fichier par année
NAT_RUPT = sorted((RACINE / "site" / "data" / "brut").glob("national-*-corse-ruptures.csv"))
PROPRE = RACINE / "site" / "data" / "propre"
PROPRE.mkdir(parents=True, exist_ok=True)

# --- Paramètres d'analyse (justifiés dans le rapport) ---------------------------------
DEBUT = pd.Timestamp("2025-04-01")      # avant cette date, moins de 90 % des stations sont présentes
FIN_CORSICA = pd.Timestamp("2026-06-02")  # dernier jour du fichier data.corsica (gelé depuis)
FIN = None                              # dernier jour complet du fichier national : calculé après lecture (2 bis)
DEBUT_CRISE = pd.Timestamp("2026-02-28")  # début de la guerre au Moyen-Orient (CNR, 09/03/2026)
PEREMPTION_JOURS = 120                  # un prix non confirmé depuis plus de 120 jours est jugé périmé :
                                        # le plafonnement TotalEnergies a figé les prix de 26 stations
                                        # près de 4 mois (fin juillet - mi-novembre 2026), alors que
                                        # les fermetures saisonnières durent plus de 5 mois
SEUIL_PIC = 0.15                        # écart relatif pour repérer une saisie aberrante isolée
PRIX_MIN, PRIX_MAX = 1.0, 3.5           # bornes de plausibilité (€/L)
CARBURANTS = {"g": ("price_gazole", "Gazole"), "s": ("price_sp95", "SP95")}
PLEIN_L = 50                            # volume de référence d'un plein (litres)

journal = []  # trace des opérations de nettoyage, reprise dans le rapport


def note(msg):
    journal.append(msg)
    print("-", msg)


# =====================================================================================
# 1. Chargement et typage
# =====================================================================================
df = pd.read_csv(BRUT, dtype={"cp": "string", "com_arm_code": "string", "epci_code": "string",
                              "dep_code": "string", "reg_code": "string"})
note(f"Fichier brut : {len(df)} lignes, {df.shape[1]} colonnes, {df['id'].nunique()} stations")

# les dates sont en UTC dans le fichier : conversion à l'heure de Corse
df["ts"] = pd.to_datetime(df["update"], utc=True).dt.tz_convert("Europe/Paris")
df["jour"] = df["ts"].dt.tz_localize(None).dt.normalize()

# =====================================================================================
# 2. Fusion des enregistrements partiels (même station, même horodatage)
# =====================================================================================
# Une même mise à jour peut être éclatée en plusieurs lignes (une par groupe de carburants) :
# les prix y sont identiques quand ils sont renseignés, les autres cellules sont vides.
nb_doublons = int(df.duplicated(["id", "ts"]).sum())


def premier(s):
    s = s.dropna()
    return s.iloc[0] if len(s) else np.nan


def union(s):
    vals = set()
    for v in s.dropna():
        vals.update(x.strip() for x in str(v).split(",") if x.strip())
    return ",".join(sorted(vals))


ev = (df.groupby(["id", "ts"], as_index=False)
        .agg(jour=("jour", "first"), price_gazole=("price_gazole", premier), price_sp95=("price_sp95", premier),
             price_gplc=("price_gplc", premier), price_e10=("price_e10", premier),
             price_e85=("price_e85", premier), price_sp98=("price_sp98", premier),
             fuel=("fuel", union), shortage=("shortage", union)))
note(f"{nb_doublons} lignes en double (même station, même horodatage) fusionnées : "
     f"{len(ev)} mises à jour distinctes")
nb_maj_corsica = len(ev)


# =====================================================================================
# 2 bis. Prolongement après le 2 juin 2026 par le fichier national annuel
# =====================================================================================
# data.corsica n'est plus alimenté après le 2 juin 2026. Le fichier national dont il est issu
# donne un relevé par carburant et par mise à jour, en heure locale. On le remet au format
# data.corsica (une ligne par mise à jour, avec le prix courant de chaque carburant), pour
# les mêmes stations : la population suivie reste identique avant et après la jonction.
COLS_PRIX = {"Gazole": "price_gazole", "SP95": "price_sp95", "SP98": "price_sp98", "GPLc": "price_gplc",
             "E10": "price_e10", "E85": "price_e85"}


def heure_locale(s):
    t = pd.to_datetime(s)
    return t.dt.tz_localize("Europe/Paris", ambiguous=np.zeros(len(t), dtype=bool), nonexistent="shift_forward")


nat_brut = pd.concat([pd.read_csv(f) for f in NAT_PRIX], ignore_index=True).dropna(subset=["maj"])
nat_brut["ts"] = heure_locale(nat_brut["maj"])
rup_brut = pd.concat([pd.read_csv(f) for f in NAT_RUPT], ignore_index=True).dropna(subset=["carburant", "debut"])
rup_brut = rup_brut.drop_duplicates(["id", "carburant", "debut"], keep="last")  # une rupture peut figurer dans deux années
# dernier jour complet : jour de la mise à jour la plus récente, sans dépasser la veille (heure de Paris)
FIN = min(nat_brut["ts"].max().tz_localize(None).normalize(),
          pd.Timestamp.now(tz="Europe/Paris").tz_localize(None).normalize() - pd.Timedelta(days=1))
rup_brut["debut"], rup_brut["fin"] = heure_locale(rup_brut["debut"]), heure_locale(rup_brut["fin"])


def lignes_nationales(etat_initial, apres):
    """Mises à jour du fichier national à partir du jour `apres`, au format data.corsica.
    `etat_initial` : dernier état connu de chaque station (index = id, colonnes price_*)."""
    ids = etat_initial.index
    nat = nat_brut[nat_brut["id"].isin(ids) & nat_brut["carburant"].isin(COLS_PRIX)
                   & (nat_brut["ts"].dt.tz_localize(None) >= apres)]
    larg = (nat.pivot_table(index=["id", "ts"], columns="carburant", values="valeur", aggfunc="last")
               .reindex(columns=list(COLS_PRIX)).rename(columns=COLS_PRIX))
    maj = nat.groupby(["id", "ts"])["carburant"].agg(lambda s: ",".join(sorted(set(s))))
    # on part de l'état de chaque station juste avant, puis report en avant carburant par carburant
    graine = etat_initial[list(COLS_PRIX.values())].copy()
    graine["ts"] = pd.Timestamp("1900-01-01", tz="Europe/Paris")
    graine = graine.reset_index().set_index(["id", "ts"])
    courant = pd.concat([graine, larg]).sort_index().groupby(level=0).ffill()
    out = courant.loc[larg.index].reset_index()
    out["fuel"] = maj.reindex(larg.index).values
    # ruptures déclarées actives à l'instant de la mise à jour ; une rupture définitive retire le prix
    manque = [set() for _ in range(len(out))]
    carb_maj = out["fuel"].str.split(",")
    for r in rup_brut[rup_brut["id"].isin(ids)].itertuples():
        m = (out["id"] == r.id) & (out["ts"] >= r.debut)
        if pd.notna(r.fin):
            m &= out["ts"] < r.fin
        for i in np.flatnonzero(m.values):
            manque[i].add(r.carburant)
        if r.type == "definitive" and r.carburant in COLS_PRIX:
            out.loc[m & ~carb_maj.map(lambda l: r.carburant in l), COLS_PRIX[r.carburant]] = np.nan
    out["shortage"] = [",".join(sorted(s)) for s in manque]  # même convention que data.corsica
    out["jour"] = out["ts"].dt.tz_localize(None).dt.normalize()
    return out


def panel_journalier(evts, col, deb, fin):
    """Prix de chaque station chaque jour : dernier prix de la journée, sinon report du dernier
    prix connu, jugé périmé au-delà de PEREMPTION_JOURS jours sans nouvelle observation."""
    obs = evts.dropna(subset=[col])
    der = obs.sort_values("ts").groupby(["id", "jour"])[col].last().unstack(0)
    der = der.reindex(pd.date_range(min(der.index.min(), deb), fin, freq="D"))
    dernier_jour = pd.DataFrame(np.where(der.notna(), np.arange(len(der))[:, None], np.nan),
                                index=der.index, columns=der.columns).ffill()
    rempli = der.ffill()
    age = np.arange(len(der))[:, None] - dernier_jour.values
    return rempli.where(age <= PEREMPTION_JOURS).loc[deb:fin]


ids_corsica = pd.Index(sorted(ev["id"].unique()), name="id")
note(f"Fichier national 2026 : {nat_brut['id'].nunique()} points de vente corses avec au moins un prix "
     f"({int((~nat_brut['id'].isin(ids_corsica)).groupby(nat_brut['id']).any().sum())} absents de data.corsica, écartés "
     f"pour garder la même population de stations)")

# --- contrôle de cohérence sur la période commune (1er janvier - 2 juin 2026) ----------
d26 = df[(df["jour"] >= "2026-01-01") & (df["jour"] <= FIN_CORSICA)]
evt_dc = set()
for r in d26.itertuples():
    for f in str(r.fuel).split(","):
        f = f.strip()
        p = r.price_gazole if f == "Gazole" else r.price_sp95 if f == "SP95" else np.nan
        if pd.notna(p):
            evt_dc.add((r.id, f, r.ts, round(float(p), 3)))
evt_nat = set(zip(nat_brut["id"], nat_brut["carburant"], nat_brut["ts"], nat_brut["valeur"].round(3)))
retrouves = len(evt_dc & evt_nat)
debut_test = pd.Timestamp("2026-01-01")
etat_31dec = ev[ev["jour"] < debut_test].sort_values("ts").groupby("id").tail(1).set_index("id").reindex(ids_corsica)
rejoue = pd.concat([ev[ev["jour"] < debut_test],
                    lignes_nationales(etat_31dec, debut_test).query("jour <= @FIN_CORSICA")], ignore_index=True)
validation = {"releves_corsica": len(evt_dc), "releves_retrouves": retrouves}
for k, (col, lib) in CARBURANTS.items():
    a = panel_journalier(ev, col, debut_test, FIN_CORSICA).mean(axis=1)
    b = panel_journalier(rejoue, col, debut_test, FIN_CORSICA).mean(axis=1)
    validation[f"ecart_max_moyenne_{k}_cts"] = float((a - b).abs().max() * 100)
note(f"Contrôle sur la période commune (1er janvier - 2 juin 2026) : {retrouves} relevés gazole/SP95 de data.corsica "
     f"sur {len(evt_dc)} retrouvés dans le fichier national à la seconde près et au même prix ; "
     f"moyennes journalières reconstituées à {validation['ecart_max_moyenne_g_cts']:.2f} ct (gazole) et "
     f"{validation['ecart_max_moyenne_s_cts']:.2f} ct (SP95) près au plus")

# --- jonction : état au 2 juin au soir, puis mises à jour nationales à partir du 3 juin ----
etat_2juin = ev.sort_values("ts").groupby("id").tail(1).set_index("id").reindex(ids_corsica)
ev_nat = lignes_nationales(etat_2juin, FIN_CORSICA + pd.Timedelta(days=1)).query("jour <= @FIN")
ev = pd.concat([ev.assign(source="data.corsica"), ev_nat.assign(source="prix-carburants.gouv.fr")],
               ignore_index=True)
note(f"Prolongement du {(FIN_CORSICA + pd.Timedelta(days=1)).date()} au {FIN.date()} : {len(ev_nat)} mises à jour "
     f"de {ev_nat['id'].nunique()} stations ajoutées, soit {len(ev)} mises à jour au total")

# =====================================================================================
# 3. Contrôle de validité des prix
# =====================================================================================
ev = ev.sort_values(["id", "ts"]).reset_index(drop=True)
anomalies = []
for k, (col, lib) in CARBURANTS.items():
    hors_bornes = ev[col].notna() & ~ev[col].between(PRIX_MIN, PRIX_MAX)
    for i in ev.index[hors_bornes]:
        anomalies.append({"id": int(ev.at[i, "id"]), "date": str(ev.at[i, "ts"]), "carburant": lib,
                          "prix": float(ev.at[i, col]), "regle": "hors bornes"})
    ev.loc[hors_bornes, col] = np.nan
    # pic isolé : la valeur s'écarte de plus de 15 % de la précédente ET de la suivante,
    # alors que la précédente et la suivante sont proches entre elles (faute de saisie)
    for sid, sub in ev.groupby("id"):
        v = sub[col].dropna()
        for j in range(1, len(v) - 1):
            a, b, c = v.iloc[j - 1], v.iloc[j], v.iloc[j + 1]
            if abs(b - a) / a > SEUIL_PIC and abs(b - c) / c > SEUIL_PIC and abs(a - c) / c < SEUIL_PIC:
                i = v.index[j]
                anomalies.append({"id": int(sid), "date": str(ev.at[i, "ts"]), "carburant": lib,
                                  "prix": float(b), "precedent": float(a), "suivant": float(c),
                                  "regle": "pic isole"})
                ev.at[i, col] = np.nan
note(f"{len(anomalies)} prix aberrant(s) retiré(s) : " +
     "; ".join(f"{a['carburant']} {a['prix']} €/L ({a['regle']})" for a in anomalies))

# =====================================================================================
# 4. Table des stations (attributs constants par station)
# =====================================================================================
def mode(s):
    s = s.dropna()
    return s.mode().iloc[0] if len(s) else np.nan


stations = (df.sort_values("ts").groupby("id")
              .agg(nom=("name", "last"), adresse=("address", "last"), cp=("cp", "last"),
                   commune=("com_arm_name", "last"), insee=("com_arm_code", "last"),
                   epci=("epci_name", "last"), dep=("dep_code", "last"), marque=("brand", "last"),
                   auto24=("automate_24_24", mode), geo=("geo_point", "last"),
                   services=("services", "last")))
stations[["lat", "lon"]] = stations["geo"].str.split(",", expand=True).astype(float)
stations["nb_services"] = stations["services"].fillna("").map(lambda s: len([x for x in s.split(",") if x]))
stations["commune"] = stations["commune"].str.title().str.replace("-Di-", "-di-").str.replace("-De-", "-de-")
stations["auto24"] = stations["auto24"].fillna(0).astype(bool)
stations["gplc"] = ev.groupby("id")["price_gplc"].count().reindex(stations.index).fillna(0) > 0
stations["e10"] = ev.groupby("id")["price_e10"].count().reindex(stations.index).fillna(0) > 0
stations["premiere_maj"] = ev.groupby("id")["ts"].min().dt.date.astype(str)
stations["derniere_maj"] = ev.groupby("id")["ts"].max().dt.date.astype(str)
stations["nb_maj"] = ev.groupby("id").size()
note(f"Table des stations : {len(stations)} stations, {stations['commune'].nunique()} communes, "
     f"marques : {stations['marque'].value_counts().to_dict()}")

# =====================================================================================
# 5. Panel journalier : dernier prix connu de chaque station, chaque jour (report en avant)
# =====================================================================================
jours = pd.date_range(DEBUT, FIN, freq="D")
panel = {k: panel_journalier(ev, col, DEBUT, FIN).reindex(columns=stations.index)
         for k, (col, lib) in CARBURANTS.items()}

nb_cellules = {k: int(p.notna().sum().sum()) for k, p in panel.items()}
note(f"Panel journalier du {DEBUT.date()} au {FIN.date()} ({len(jours)} jours) : "
     f"{nb_cellules['g']} prix gazole et {nb_cellules['s']} prix SP95 station×jour "
     f"(report du dernier prix connu, périmé après {PEREMPTION_JOURS} jours)")


# =====================================================================================
# 6. Statistiques descriptives journalières (entre stations)
# =====================================================================================
def stats_ligne(x):
    x = x.dropna().values
    if len(x) == 0:
        return dict(n=0)
    q1, med, q3 = np.percentile(x, [25, 50, 75])  # méthode linéaire = QUARTILE.INCLUS d'Excel
    return dict(n=len(x), moy=x.mean(), med=med, q1=q1, q3=q3, min=x.min(), max=x.max(),
                et=x.std(ddof=0))  # écart-type de population = ECARTYPE.PEARSON


quotidien = {}
for k in CARBURANTS:
    quotidien[k] = pd.DataFrame([stats_ligne(panel[k].loc[d]) for d in jours], index=jours)
qj = pd.concat({CARBURANTS[k][1]: quotidien[k] for k in CARBURANTS}, axis=1)
qj.columns = [f"{a}_{b}" for a, b in qj.columns]
qj.index.name = "date"
qj.round(4).to_csv(PROPRE / "prix_journaliers_statistiques.csv", sep=";", decimal=",")

# périodes
P1 = (DEBUT, DEBUT_CRISE - pd.Timedelta(days=1))
P2 = (DEBUT_CRISE, FIN)


def resume_periode(k, deb, fin):
    s = quotidien[k].loc[deb:fin, "moy"]
    return dict(moy=s.mean(), min=s.min(), date_min=str(s.idxmin().date()), max=s.max(),
                date_max=str(s.idxmax().date()), debut=s.iloc[0], fin=s.iloc[-1])


periodes = {}
for nom, (deb, fin) in {"P1": P1, "P2": P2}.items():
    periodes[nom] = {"debut": str(deb.date()), "fin": str(fin.date()), "jours": int((fin - deb).days + 1),
                     **{CARBURANTS[k][1]: resume_periode(k, deb, fin) for k in CARBURANTS}}

# mois
mensuel = qj[["Gazole_moy", "SP95_moy"]].groupby(qj.index.to_period("M")).mean()
mensuel.index = mensuel.index.astype(str)

# écart gazole - SP95 (moyennes journalières)
ecart = quotidien["g"]["moy"] - quotidien["s"]["moy"]
bascule = ecart[(ecart > 0) & (ecart.index >= DEBUT_CRISE)]
date_bascule = str(bascule.index[0].date()) if len(bascule) else None
jours_gazole_plus_cher = int((ecart > 0).sum())

# =====================================================================================
# 7. Comparaisons : marques, départements, intercommunalités, automates 24/24
# =====================================================================================
def moyenne_groupe(k, groupe, deb, fin):
    p = panel[k].loc[deb:fin]
    res = {}
    for val, ids in stations.groupby(groupe).groups.items():
        sous = p[list(ids)]
        res[val] = dict(n=len(ids), moy=float(sous.mean(axis=1).mean()))
    return res


comparaisons = {}
for groupe in ["marque", "dep", "epci", "auto24"]:
    comparaisons[groupe] = {}
    for nom, (deb, fin) in {"P1": P1, "P2": P2}.items():
        comparaisons[groupe][nom] = {CARBURANTS[k][1]: moyenne_groupe(k, groupe, deb, fin) for k in CARBURANTS}

# =====================================================================================
# 8. Moyennes par station et série statistique double (x = gazole, y = SP95)
# =====================================================================================
for k, (col, lib) in CARBURANTS.items():
    for nom, (deb, fin) in {"P1": P1, "P2": P2}.items():
        p = panel[k].loc[deb:fin]
        stations[f"moy_{nom}_{k}"] = p.mean()
        stations[f"couv_{nom}_{k}"] = p.notna().mean()
    stations[f"dernier_{k}"] = panel[k].ffill().iloc[-1]

def serie_double(nom):
    """Série statistique double (x = prix moyen du gazole, y = prix moyen du SP95) pour une période.
    On garde les stations couvertes au moins 80 % du temps pour les deux carburants."""
    sel = stations[(stations[f"couv_{nom}_g"] >= 0.8) & (stations[f"couv_{nom}_s"] >= 0.8)]
    sd = sel[["nom", "commune", "marque", f"moy_{nom}_g", f"moy_{nom}_s"]]
    sd = sd.rename(columns={f"moy_{nom}_g": "x", f"moy_{nom}_s": "y"}).sort_values("x")  # tri croissant (Mayer)
    x, y = sd["x"].values, sd["y"].values
    n = len(x)
    mx, my = x.mean(), y.mean()
    sx, sy = x.std(ddof=0), y.std(ddof=0)                 # ECARTYPE.PEARSON
    cov = ((x - mx) * (y - my)).mean()                    # COVARIANCE.PEARSON
    r = cov / (sx * sy)                                   # COEFFICIENT.CORRELATION
    a_yx = cov / sx ** 2; b_yx = my - a_yx * mx           # moindres carrés de y en x : y = ax + b
    a_xy = cov / sy ** 2; b_xy = mx - a_xy * my           # moindres carrés de x en y : x = a'y + b'
    h = n // 2                                            # Mayer : deux nuages de même effectif
    g1x, g1y = x[:h].mean(), y[:h].mean()
    g2x, g2y = x[h:].mean(), y[h:].mean()
    a_m = (g2y - g1y) / (g2x - g1x); b_m = g2y - a_m * g2x
    reg = dict(n=n, moy_x=mx, moy_y=my, et_x=sx, et_y=sy, cov=cov, r=r, r2=r * r,
               yx=dict(a=a_yx, b=b_yx), xy=dict(a=a_xy, b=b_xy, a_en_y=1 / a_xy, b_en_y=-b_xy / a_xy),
               mayer=dict(g1=[g1x, g1y], g2=[g2x, g2y], a=a_m, b=b_m, n1=h, n2=n - h))
    sd.round(8).to_csv(PROPRE / f"serie_double_gazole_sp95_{nom}.csv", sep=";", decimal=",", index_label="id")
    note(f"Série double ({nom}) : {n} stations ; r = {r:.3f} ; r² = {r*r:.3f} ; "
         f"y = {a_yx:.3f}x + {b_yx:.3f} (moindres carrés de y en x)")
    return sd, reg


serie, regression = serie_double("P1")
serie2, regression2 = serie_double("P2")

# =====================================================================================
# 9. Dispersion entre stations et économies possibles sur un plein
# =====================================================================================
etendue = {CARBURANTS[k][1]: quotidien[k]["max"] - quotidien[k]["min"] for k in CARBURANTS}
eiq = {CARBURANTS[k][1]: quotidien[k]["q3"] - quotidien[k]["q1"] for k in CARBURANTS}
dispersion = {}
for lib in ["Gazole", "SP95"]:
    dispersion[lib] = {nom: dict(etendue_moy=float(etendue[lib].loc[deb:fin].mean()),
                                 eiq_moy=float(eiq[lib].loc[deb:fin].mean()),
                                 etendue_max=float(etendue[lib].loc[deb:fin].max()),
                                 date_etendue_max=str(etendue[lib].loc[deb:fin].idxmax().date()))
                       for nom, (deb, fin) in {"P1": P1, "P2": P2}.items()}
    kk = {"Gazole": "g", "SP95": "s"}[lib]
    dispersion[lib]["dernier_jour"] = dict(etendue=float(etendue[lib].iloc[-1]),
                                           plein=float(etendue[lib].iloc[-1] * PLEIN_L),
                                           min=float(quotidien[kk]["min"].iloc[-1]), max=float(quotidien[kk]["max"].iloc[-1]))

# =====================================================================================
# 10. Fréquence des changements de prix et « jours de bascule »
# =====================================================================================
chg = {}
for k, (col, lib) in CARBURANTS.items():
    # un changement = un jour où le dernier prix de la journée diffère du dernier prix connu avant :
    # même définition pour les deux sources, quel que soit le nombre de mises à jour dans la journée
    o = (ev.dropna(subset=[col]).sort_values(["id", "ts"])
           .groupby(["id", "jour"], as_index=False)[col].last())
    o["change"] = o.groupby("id")[col].diff().fillna(0) != 0
    o = o[o["change"] & (o["jour"] >= DEBUT)]
    chg[k] = o
    stations[f"nb_chg_{k}"] = o.groupby("id").size().reindex(stations.index).fillna(0).astype(int)
chg_jour = pd.DataFrame({CARBURANTS[k][1]: chg[k].groupby("jour")["id"].nunique().reindex(jours).fillna(0).astype(int)
                         for k in CARBURANTS})
top_jours = chg_jour["Gazole"].sort_values(ascending=False).head(8)
note("Jours où le plus de stations ont changé leur prix du gazole : " +
     ", ".join(f"{d.date()} ({v})" for d, v in top_jours.items()))

# ruptures de stock signalées (champ « shortage » au moment d'une mise à jour)
rupt = ev[ev["jour"] >= DEBUT].copy()
for k, (col, lib) in CARBURANTS.items():
    rupt[lib] = rupt["shortage"].str.split(",").map(lambda l: lib in l)
ruptures_mois = rupt.groupby(rupt["jour"].dt.to_period("M"))[["Gazole", "SP95"]].sum()
ruptures_mois.index = ruptures_mois.index.astype(str)

# distribution mensuelle des prix station×jour (boîtes à moustaches)
def boites_mensuelles(k):
    p = panel[k]
    res = []
    for mois, sous in p.groupby(p.index.to_period("M")):
        v = sous.values.ravel()
        v = v[~np.isnan(v)]
        q1, med, q3 = np.percentile(v, [25, 50, 75])
        iqr = q3 - q1
        bas = v[v >= q1 - 1.5 * iqr].min(); haut = v[v <= q3 + 1.5 * iqr].max()  # moustaches de Tukey
        res.append(dict(mois=str(mois), n=int(len(v)), moy=v.mean(), q1=q1, med=med, q3=q3, min=v.min(), max=v.max(),
                        bas=bas, haut=haut, et=v.std(ddof=0),
                        atypiques=int(((v < q1 - 1.5 * iqr) | (v > q3 + 1.5 * iqr)).sum())))
    return res


boites = {k: boites_mensuelles(k) for k in CARBURANTS}

# statistiques descriptives de tous les prix station×jour d'une période
def descriptives(k, deb, fin):
    v = panel[k].loc[deb:fin].values.ravel()
    v = v[~np.isnan(v)]
    q1, med, q3 = np.percentile(v, [25, 50, 75])
    return dict(n=int(len(v)), moy=v.mean(), med=med, q1=q1, q3=q3, eiq=q3 - q1, et=v.std(ddof=0),
                var=v.var(ddof=0), min=v.min(), max=v.max(), etendue=v.max() - v.min(),
                cv=v.std(ddof=0) / v.mean() * 100)


desc = {nom: {CARBURANTS[k][1]: descriptives(k, deb, fin) for k in CARBURANTS}
        for nom, (deb, fin) in {"P1": P1, "P2": P2}.items()}

# =====================================================================================
# 11. Indicateurs clés
# =====================================================================================
qg, qs = quotidien["g"], quotidien["s"]
# repères de la crise : premier pic (printemps), creux de l'été, effet du déblocage des stocks de gazole (1er novembre)
mg = qg["moy"]
printemps = mg.loc[DEBUT_CRISE:"2026-06-30"]
ete = mg.loc["2026-05-01":"2026-08-31"]
reperes = {
    "pic_printemps": dict(date=str(printemps.idxmax().date()), gazole=printemps.max()),
    "creux_ete": dict(date=str(ete.idxmin().date()), gazole=ete.min()),
    "veille_destockage": dict(date="2026-10-30", gazole=mg.loc["2026-10-30"], sp95=qs["moy"].loc["2026-10-30"]),
    "semaine_destockage": dict(date="2026-11-06", gazole=mg.loc["2026-11-06"], sp95=qs["moy"].loc["2026-11-06"]),
    "dernier": dict(date=str(FIN.date()), gazole=mg.iloc[-1], sp95=qs["moy"].iloc[-1]),
} if FIN >= pd.Timestamp("2026-11-06") else {}
k_avant_g = periodes["P1"]["Gazole"]["fin"]
k_pic_g = qg["moy"].loc[P2[0]:].max()
indicateurs = {
    "lignes_brutes": len(df), "mises_a_jour": len(ev), "stations": len(stations),
    "mises_a_jour_corsica": nb_maj_corsica, "mises_a_jour_nationales": len(ev_nat),
    "releves_nationaux": int((nat_brut["id"].isin(ids_corsica) & nat_brut["carburant"].isin(COLS_PRIX)
                              & nat_brut["ts"].dt.tz_localize(None).dt.normalize()
                                .between(FIN_CORSICA + pd.Timedelta(days=1), FIN)).sum()),
    "stations_nationales_corse": int(nat_brut["id"].nunique()), "validation": validation,
    "communes": int(stations["commune"].nunique()), "doublons_fusionnes": nb_doublons,
    "anomalies": anomalies, "debut": str(DEBUT.date()), "fin": str(FIN.date()), "jours": len(jours),
    "fin_corsica": str(FIN_CORSICA.date()),
    "debut_crise": str(DEBUT_CRISE.date()),
    "gazole_veille_crise": k_avant_g, "gazole_pic": k_pic_g, "gazole_date_pic": str(qg["moy"].loc[P2[0]:].idxmax().date()),
    "gazole_hausse_pic_cts": (k_pic_g - k_avant_g) * 100, "gazole_hausse_pic_pct": (k_pic_g / k_avant_g - 1) * 100,
    "sp95_veille_crise": periodes["P1"]["SP95"]["fin"], "sp95_pic": qs["moy"].loc[P2[0]:].max(),
    "sp95_date_pic": str(qs["moy"].loc[P2[0]:].idxmax().date()),
    "gazole_dernier": qg["moy"].iloc[-1], "sp95_dernier": qs["moy"].iloc[-1],
    "prix_max_observe_g": float(panel["g"].max().max()), "prix_max_observe_s": float(panel["s"].max().max()),
    "plein_veille_crise_g": k_avant_g * PLEIN_L, "plein_pic_g": k_pic_g * PLEIN_L,
    "surcout_plein_pic_g": (k_pic_g - k_avant_g) * PLEIN_L,
    "date_bascule_gazole_plus_cher": date_bascule, "jours_gazole_plus_cher": jours_gazole_plus_cher,
    "ecart_max_gazole_sp95_cts": float(ecart.max() * 100), "date_ecart_max": str(ecart.idxmax().date()),
    "nb_chg_gazole": int(len(chg["g"])), "nb_chg_sp95": int(len(chg["s"])),
    "top_jours_changements": {str(d.date()): int(v) for d, v in top_jours.items()},
    "periodes": periodes, "descriptives": desc, "dispersion": dispersion, "regression": regression, "regression_P2": regression2,
    "comparaisons": comparaisons, "plein_litres": PLEIN_L, "peremption_jours": PEREMPTION_JOURS, "reperes": reperes,
    "ruptures_mois": ruptures_mois.astype(int).to_dict(orient="index"),
    "journal": journal,
}


def propre(o):
    if isinstance(o, dict):
        return {str(k): propre(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [propre(v) for v in o]
    if isinstance(o, (np.floating, float)):
        return None if np.isnan(o) else round(float(o), 5)
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.bool_,)):
        return bool(o)
    return o


(RACINE / "analyse" / "indicateurs.json").write_text(json.dumps(propre(indicateurs), ensure_ascii=False, indent=1),
                                                     encoding="utf-8")

# =====================================================================================
# 12. Exports CSV nettoyés
# =====================================================================================
ev_out = ev.copy()
ev_out["ts"] = ev_out["ts"].dt.strftime("%Y-%m-%d %H:%M:%S")
ev_out.rename(columns={"ts": "horodatage_local", "price_gazole": "prix_gazole", "price_sp95": "prix_sp95",
                       "price_gplc": "prix_gplc", "price_e10": "prix_e10", "price_e85": "prix_e85",
                       "price_sp98": "prix_sp98", "fuel": "carburants_mis_a_jour", "shortage": "ruptures"}) \
      .drop(columns=["jour"]).to_csv(PROPRE / "releves_nettoyes.csv", sep=";", decimal=",", index=False)
st_out = stations.drop(columns=["geo", "services"]).copy()
st_out.round(4).to_csv(PROPRE / "stations.csv", sep=";", decimal=",", index_label="id")
for k, (col, lib) in CARBURANTS.items():
    pp = panel[k].copy(); pp.index.name = "date"
    pp.round(3).to_csv(PROPRE / f"panel_journalier_{lib.lower()}.csv", sep=";", decimal=",")

# =====================================================================================
# 13. Données du site (window.DATA)
# =====================================================================================
ordre = list(stations.index)
SIGLES = {"SA", "SARL", "SAS", "SASU", "EURL", "SNC", "SCI", "RN", "ENI", "VITO", "TOTAL", "BP", "AVIA", "CD", "II", "III"}


def joli_nom(nom):
    """Met en forme les noms de stations saisis en majuscules, en gardant les sigles juridiques."""
    if not nom.isupper():
        return nom
    petits = {"de", "du", "des", "la", "le", "les", "et"}
    mots = []
    for i, mot in enumerate(nom.split()):
        nu = mot.strip(".,-()")
        if nu in SIGLES:
            mots.append(mot)
        elif i > 0 and mot.lower() in petits:
            mots.append(mot.lower())
        else:
            mots.append("-".join(m.capitalize() for m in mot.split("-")))
    return " ".join(mots).replace(" D ", " d'").replace(" L ", " l'")


def points_de_changement(p):
    """Encode la série journalière d'une station par ses seuls changements : [indice du jour, prix en millièmes]."""
    out = {}
    for sid in ordre:
        v = p[sid].values
        pts, prec = [], "debut"
        for i, val in enumerate(v):
            cur = None if np.isnan(val) else int(round(val * 1000))
            if cur != prec:
                pts.append([i, cur if cur is not None else 0])
                prec = cur
        out[str(sid)] = pts
    return out


def arr(s, d=4):
    return [None if pd.isna(v) else round(float(v), d) for v in s]


data_site = {
    "meta": {
        "titre": "Prix des carburants - J-1 - avec historique en Corse",
        "source": "data.corsica (Collectivité de Corse) jusqu'au 2 juin 2026, puis prix-carburants.gouv.fr",
        "url": "https://data.corsica/datasets/prix-des-carburants-j-1-avec-historique-en-corse",
        "url2": "https://donnees.roulez-eco.fr/opendata/annee/2026",
        "licence": "Licence Ouverte 2.0", "lignes": len(df), "maj": len(ev), "stations": len(stations),
        "majCorsica": nb_maj_corsica, "majNationales": len(ev_nat), "finCorsica": str(FIN_CORSICA.date()),
        "debut": str(DEBUT.date()), "fin": str(FIN.date()), "crise": str(DEBUT_CRISE.date()),
        "genere": pd.Timestamp.now(tz="Europe/Paris").strftime("%Y-%m-%d %H:%M"),
        "plein": PLEIN_L, "peremption": PEREMPTION_JOURS,
    },
    "jours": [str(d.date()) for d in jours],
    "quotidien": {k: {c: arr(quotidien[k][c], 5) for c in ["n", "moy", "med", "q1", "q3", "min", "max", "et"]}
                  for k in CARBURANTS},
    "changements": {k: chg_jour[CARBURANTS[k][1]].tolist() for k in CARBURANTS},
    "stations": [dict(id=int(sid), nom=joli_nom(r.nom), commune=r.commune, insee=r.insee,
                      dep=r.dep, epci=r.epci, marque=r.marque, lat=round(r.lat, 5), lon=round(r.lon, 5),
                      auto24=bool(r.auto24), gplc=bool(r.gplc), nbMaj=int(r.nb_maj),
                      chgG=int(r.nb_chg_g), chgS=int(r.nb_chg_s),
                      p1g=None if pd.isna(r.moy_P1_g) else round(r.moy_P1_g, 4),
                      p1s=None if pd.isna(r.moy_P1_s) else round(r.moy_P1_s, 4),
                      p2g=None if pd.isna(r.moy_P2_g) else round(r.moy_P2_g, 4),
                      p2s=None if pd.isna(r.moy_P2_s) else round(r.moy_P2_s, 4),
                      derMaj=r.derniere_maj)
                 for sid, r in stations.iterrows()],
    "series": {k: points_de_changement(panel[k]) for k in CARBURANTS},
    "mensuel": [dict(mois=m, g=round(r.Gazole_moy, 4), s=round(r.SP95_moy, 4)) for m, r in mensuel.iterrows()],
    "serie_double": {"P1": [dict(id=int(sid), x=round(r.x, 4), y=round(r.y, 4)) for sid, r in serie.iterrows()],
                     "P2": [dict(id=int(sid), x=round(r.x, 4), y=round(r.y, 4)) for sid, r in serie2.iterrows()]},
    "boites": propre(boites),
    "indicateurs": propre({k: v for k, v in indicateurs.items() if k not in ("journal", "anomalies")}),
}
js = ("/* Données préparées par analyse/traitement.py - sources : data.corsica puis prix-carburants.gouv.fr, "
      "Licence Ouverte 2.0 */\n"
      "window.DATA = " + json.dumps(propre(data_site), ensure_ascii=False, separators=(",", ":")) + ";\n")
(RACINE / "site" / "data" / "data.js").write_text(js, encoding="utf-8")
note(f"data.js écrit ({len(js) / 1024:.0f} Ko)")
