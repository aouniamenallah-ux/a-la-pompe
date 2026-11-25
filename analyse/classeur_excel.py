"""
SAÉ 303 - Classeur Excel de l'analyse statistique (mêmes calculs que traitement.py, en formules Excel)
Reprend la démarche du TP « Statistiques descriptives sous Excel » : point moyen, écarts-types,
droite de Mayer, covariance, coefficient de corrélation, droites des moindres carrés.

Entrée  : site/data/propre/*.csv (produits par traitement.py)
Sortie  : analyse/analyse_statistique_carburants.xlsx
"""
import json
from pathlib import Path

import pandas as pd
from openpyxl import Workbook
from openpyxl.chart import LineChart, Reference, ScatterChart, Series
from openpyxl.chart.trendline import Trendline
from openpyxl.chart.shapes import GraphicalProperties
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

RACINE = Path(__file__).resolve().parent.parent
PROPRE = RACINE / "site" / "data" / "propre"
SORTIE = RACINE / "analyse" / "analyse_statistique_carburants.xlsx"
I = json.loads((RACINE / "analyse" / "indicateurs.json").read_text(encoding="utf-8"))
JJ = lambda s: pd.Timestamp(s).strftime("%d/%m/%Y")

POLICE = "Arial"
F = lambda **k: Font(name=POLICE, size=k.pop("size", 10), **k)
BLEU = "0000FF"          # données saisies (valeurs issues du traitement)
GRIS = PatternFill("solid", fgColor="EDEDED")
JAUNE = PatternFill("solid", fgColor="FFF2CC")
ENTETE = PatternFill("solid", fgColor="1B1F23")
fin = Side(style="thin", color="BFBFBF")
CADRE = Border(left=fin, right=fin, top=fin, bottom=fin)

wb = Workbook()

# ------------------------------------------------------------------ Lisez-moi
ws = wb.active
ws.title = "Lisez-moi"
lignes = [
    ("SAÉ 303 - Prix des carburants en Corse : classeur de l'analyse statistique", F(bold=True, size=14)),
    ("", None),
    ("Source des données", F(bold=True)),
    ("data.corsica (Collectivité de Corse) - « Prix des carburants - J-1 - avec historique en Corse », Licence Ouverte 2.0", F()),
    ("https://data.corsica/datasets/prix-des-carburants-j-1-avec-historique-en-corse", F(color="0563C1", underline="single")),
    (f"Fichier brut : {I['lignes_brutes']:,} lignes, {I['stations']} stations, du 20/02/2025 au {JJ(I['fin_corsica'])} (jeu gelé depuis).".replace(",", " "), F()),
    (f"Prolongement du {JJ(pd.Timestamp(I['fin_corsica']) + pd.Timedelta(days=1))} au {JJ(I['fin'])} : fichier annuel 2026 de prix-carburants.gouv.fr (Licence Ouverte 2.0), mêmes stations.", F()),
    ("https://donnees.roulez-eco.fr/opendata/annee/2026", F(color="0563C1", underline="single")),
    ("Comparaison avec le continent : fichiers annuels 2025 et 2026 de prix-carburants.gouv.fr (toute la France). Données de cadrage : Insee, SDES, CCFA (sources dans l'onglet Territoire).", F()),
    ("Traitement : scripts analyse/extraction_national.py puis analyse/traitement.py (Python, pandas).", F()),
    ("", None),
    ("Contenu des onglets", F(bold=True)),
    ("Territoire : densité des stations, budget carburant d'un conducteur moyen, écart avec le continent, estimation de la baisse de consommation (formules).", F()),
    ("Départements : prix moyen du gazole des 96 départements et rang de chacun (fonction RANG), Corse-du-Sud et Haute-Corse en jaune.", F()),
    ("Panel gazole / Panel SP95 : prix de chaque station (colonnes) pour chaque jour (lignes), dernier prix connu reporté au plus " + str(I["peremption_jours"]) + " jours.", F()),
    ("Prix journaliers : moyenne, nombre de stations, minimum et maximum de chaque jour, calculés par formules à partir des panels.", F()),
    ("Stats descriptives : moyenne, médiane, quartiles, écart-type, variance, minimum, maximum par période et par carburant.", F()),
    ("Série double P1 / Série double P2 : x = prix moyen du gazole, y = prix moyen du SP95 par station ; mêmes calculs que le TP", F()),
    ("   (point moyen G, écarts-types, droite de Mayer, covariance, corrélation, moindres carrés de y en x et de x en y).", F()),
    ("", None),
    ("Périodes", F(bold=True)),
    (f"P1 - avant la crise : du 01/04/2025 au 27/02/2026 ({I['periodes']['P1']['jours']} jours, lignes 2 à {1 + I['periodes']['P1']['jours']} des panels).", F()),
    (f"P2 - crise : du 28/02/2026 (début de la guerre au Moyen-Orient) au {JJ(I['fin'])} ({I['periodes']['P2']['jours']} jours, "
     f"lignes {2 + I['periodes']['P1']['jours']} à {1 + I['jours']}).", F()),
    ("", None),
    ("Code couleur", F(bold=True)),
    ("Texte bleu : données importées du traitement (valeurs saisies). Texte noir : formules. Fond jaune : résultats clés.", F()),
    ("", None),
    ("Réalisation : Amen Allah Aouni, BUT MMI 2, IUT de Corse - novembre 2026", F(italic=True)),
]
for i, (t, f) in enumerate(lignes, start=1):
    c = ws.cell(row=i, column=1, value=t)
    if f is not None:
        c.font = f
ws.column_dimensions["A"].width = 130
ws.cell(row=1 + [t for t, _ in lignes].index(next(t for t, _ in lignes if t.startswith("Texte bleu"))), column=1).fill = JAUNE


# ------------------------------------------------------------------ Panels
def feuille_panel(nom_fichier, titre):
    p = pd.read_csv(PROPRE / nom_fichier, sep=";", decimal=",", index_col="date")
    w = wb.create_sheet(titre)
    w.cell(row=1, column=1, value="date \\ station").font = F(bold=True)
    for j, sid in enumerate(p.columns, start=2):
        c = w.cell(row=1, column=j, value=int(sid))
        c.font = F(bold=True)
    for i, (d, row) in enumerate(p.iterrows(), start=2):
        c = w.cell(row=i, column=1, value=pd.Timestamp(d).to_pydatetime())
        c.number_format = "DD/MM/YYYY"
        c.font = F()
        for j, v in enumerate(row.values, start=2):
            if pd.notna(v):
                cc = w.cell(row=i, column=j, value=float(v))
                cc.font = F(color=BLEU)
                cc.number_format = "0.000"
    w.freeze_panes = "B2"
    w.column_dimensions["A"].width = 12
    return w, len(p), len(p.columns)


wpg, n_jours, n_st = feuille_panel("panel_journalier_gazole.csv", "Panel gazole")
wps, _, _ = feuille_panel("panel_journalier_sp95.csv", "Panel SP95")
derniere_col = get_column_letter(n_st + 1)        # DE pour 108 stations
L1, L2 = 2, n_jours + 1                           # lignes du panel
P1_FIN = 334                                      # 27/02/2026
P2_DEB = 335                                      # 28/02/2026

# ------------------------------------------------------------------ Prix journaliers (formules)
wj = wb.create_sheet("Prix journaliers")
ent = ["Date", "Gazole moyen", "Stations (gazole)", "Gazole min", "Gazole max", "SP95 moyen", "Stations (SP95)", "SP95 min", "SP95 max", "Écart gazole - SP95 (ct)"]
for j, t in enumerate(ent, start=1):
    c = wj.cell(row=1, column=j, value=t)
    c.font = F(bold=True, color="FFFFFF"); c.fill = ENTETE; c.alignment = Alignment(wrap_text=True, vertical="center")
for i in range(L1, L2 + 1):
    wj.cell(row=i, column=1, value=f"='Panel gazole'!A{i}").number_format = "DD/MM/YYYY"
    rg = f"'Panel gazole'!B{i}:{derniere_col}{i}"
    rs = f"'Panel SP95'!B{i}:{derniere_col}{i}"
    for col, f_ in [(2, f"=AVERAGE({rg})"), (3, f"=COUNT({rg})"), (4, f"=MIN({rg})"), (5, f"=MAX({rg})"),
                    (6, f"=AVERAGE({rs})"), (7, f"=COUNT({rs})"), (8, f"=MIN({rs})"), (9, f"=MAX({rs})"),
                    (10, f"=(B{i}-F{i})*100")]:
        c = wj.cell(row=i, column=col, value=f_)
        c.number_format = "0" if col in (3, 7) else ("0.0" if col == 10 else "0.000")
    for col in range(1, 11):
        wj.cell(row=i, column=col).font = F()
wj.freeze_panes = "B2"
for col, wd in zip("ABCDEFGHIJ", [12, 13, 11, 11, 11, 13, 11, 11, 11, 14]):
    wj.column_dimensions[col].width = wd
wj.row_dimensions[1].height = 30
ch = LineChart()
ch.title = "Prix moyen du litre en Corse (moyenne des stations)"
ch.y_axis.title = "€ / litre"; ch.x_axis.title = "Date"
ch.height, ch.width = 9, 22
ch.y_axis.scaling.min = 1.6; ch.y_axis.scaling.max = 2.3
ch.y_axis.number_format = "0.00"
ch.x_axis.number_format = "mm/yyyy"; ch.x_axis.majorTimeUnit = "months"
for col, coul in [(2, "D99A00"), (6, "1A8A4A")]:
    ref = Reference(wj, min_col=col, min_row=1, max_row=L2)
    ch.add_data(ref, titles_from_data=True)
    s = ch.series[-1]
    s.graphicalProperties.line.solidFill = coul
    s.graphicalProperties.line.width = 22000
    s.smooth = False
ch.set_categories(Reference(wj, min_col=1, min_row=2, max_row=L2))
wj.add_chart(ch, "L2")

# ------------------------------------------------------------------ Stats descriptives (formules sur les panels)
wd = wb.create_sheet("Stats descriptives")
wd["A1"] = "Statistiques descriptives des prix station × jour (€/L)"
wd["A1"].font = F(bold=True, size=12)
cols = [("Gazole - P1 (avant la crise)", "Panel gazole", L1, P1_FIN), ("Gazole - P2 (crise)", "Panel gazole", P2_DEB, L2),
        ("SP95 - P1 (avant la crise)", "Panel SP95", L1, P1_FIN), ("SP95 - P2 (crise)", "Panel SP95", P2_DEB, L2)]
ind = [("Nombre de prix", "COUNT({r})", "0"), ("Moyenne", "AVERAGE({r})", "0.000"), ("Médiane", "MEDIAN({r})", "0.000"),
       ("1er quartile Q1", "_xlfn.QUARTILE.INC({r},1)", "0.000"), ("3e quartile Q3", "_xlfn.QUARTILE.INC({r},3)", "0.000"),
       ("Écart interquartile Q3 - Q1", "{c}8-{c}7", "0.000"), ("Écart-type (ECARTYPE.PEARSON)", "_xlfn.STDEV.P({r})", "0.0000"),
       ("Variance (VAR.P)", "_xlfn.VAR.P({r})", "0.00000"), ("Coefficient de variation", "{c}10/{c}5", "0.0%"),
       ("Minimum", "MIN({r})", "0.000"), ("Maximum", "MAX({r})", "0.000"), ("Étendue", "{c}14-{c}13", "0.000")]
# lignes de la feuille : 4 = nombre, 5 = moyenne, 7 = Q1, 8 = Q3, 10 = écart-type, 13 = minimum, 14 = maximum
assert [lab for lab, _, _ in ind].index("3e quartile Q3") + 4 == 8 and [lab for lab, _, _ in ind].index("Maximum") + 4 == 14
wd["A3"] = "Indicateur"; wd["A3"].font = F(bold=True, color="FFFFFF"); wd["A3"].fill = ENTETE
for j, (titre, feuille, a, b) in enumerate(cols, start=2):
    c = wd.cell(row=3, column=j, value=titre)
    c.font = F(bold=True, color="FFFFFF"); c.fill = ENTETE; c.alignment = Alignment(wrap_text=True)
    lettre = get_column_letter(j)
    r = f"'{feuille}'!B{a}:{derniere_col}{b}"
    for i, (lab, f_, nf) in enumerate(ind, start=4):
        wd.cell(row=i, column=1, value=lab).font = F()
        cc = wd.cell(row=i, column=j, value="=" + f_.format(r=r, c=lettre))
        cc.number_format = nf; cc.font = F(); cc.border = CADRE
        if lab in ("Moyenne", "Écart-type (ECARTYPE.PEARSON)"):
            cc.fill = JAUNE
wd.column_dimensions["A"].width = 32
for col in "BCDE":
    wd.column_dimensions[col].width = 20
wd.row_dimensions[3].height = 30
wd["A17"] = "Quartiles : QUARTILE.INCLUS (interpolation linéaire), identique à numpy.percentile. Écart-type et variance de population, comme dans le TP."
wd["A17"].font = F(italic=True, size=9)


# ------------------------------------------------------------------ Séries doubles (démarche du TP)
def feuille_serie(nom, csv, titre_periode):
    s = pd.read_csv(PROPRE / csv, sep=";", decimal=",").sort_values("x").reset_index(drop=True)
    n = len(s); h = n // 2
    w = wb.create_sheet(nom)
    w["A1"] = f"Prix moyen du SP95 (y) en fonction du prix moyen du gazole (x) par station - {titre_periode}"
    w["A1"].font = F(bold=True, size=12)
    ent = ["Station (id)", "Nom", "Commune", "Enseigne", "Gazole xi (€/L)", "SP95 mesuré yi (€/L)",
           "y calculé avec la droite de Mayer", "y calculé : moindres carrés de y en x", "y calculé : moindres carrés de x en y"]
    for j, t in enumerate(ent, start=1):
        c = w.cell(row=3, column=j, value=t)
        c.font = F(bold=True, color="FFFFFF"); c.fill = ENTETE; c.alignment = Alignment(wrap_text=True, vertical="center")
    a, b = 4, 3 + n                                 # lignes de données (triées par x croissant)
    for i, r in s.iterrows():
        k = a + i
        for j, v in enumerate([int(r["id"]), r["nom"], r["commune"], r["marque"]], start=1):
            w.cell(row=k, column=j, value=v).font = F(color=BLEU)
        for j, v in [(5, r["x"]), (6, r["y"])]:
            c = w.cell(row=k, column=j, value=float(v)); c.font = F(color=BLEU); c.number_format = "0.0000"
        for j, f_ in [(7, f"=$N$12*E{k}+$N$13"), (8, f"=$N$17*E{k}+$N$18"), (9, f"=1/$N$19*E{k}-$N$20/$N$19")]:
            c = w.cell(row=k, column=j, value=f_); c.font = F(); c.number_format = "0.0000"
    X, Y = f"E{a}:E{b}", f"F{a}:F{b}"
    X1, Y1, X2, Y2 = f"E{a}:E{a + h - 1}", f"F{a}:F{a + h - 1}", f"E{a + h}:E{b}", f"F{a + h}:F{b}"
    # bloc « Calculs » aux mêmes emplacements que le corrigé du TP (colonnes L, M, N)
    calc = [(3, "Calculs", "", None), (4, "Point moyen G du nuage", "Moyenne de x", f"=AVERAGE({X})"),
            (5, "", "Moyenne de y", f"=AVERAGE({Y})"), (6, "Écart-type", "de la série x", f"=_xlfn.STDEV.P({X})"),
            (7, "", "de la série y", f"=_xlfn.STDEV.P({Y})"),
            (8, f"Point moyen G1 du nuage 1 ({h} stations)", "Moyenne des xi", f"=AVERAGE({X1})"), (9, "", "Moyenne des yi", f"=AVERAGE({Y1})"),
            (10, f"Point moyen G2 du nuage 2 ({n - h} stations)", "Moyenne des xi", f"=AVERAGE({X2})"), (11, "", "Moyenne des yi", f"=AVERAGE({Y2})"),
            (12, "Droite de Mayer", "Coefficient directeur", "=(N11-N9)/(N10-N8)"), (13, "y = ax + b", "Ordonnée à l'origine", "=N11-N12*N10"),
            (14, "Covariance", "", f"=_xlfn.COVARIANCE.P({X},{Y})"), (15, "Coefficient de corrélation r", "", f"=CORREL({X},{Y})"),
            (16, "Coefficient de détermination r*r", "", "=N15*N15"),
            (17, "Moindres carrés de y en x", "coefficient a", "=N14/(N6*N6)"), (18, "y = ax + b", "coefficient b", "=N5-N17*N4"),
            (19, "Moindres carrés de x en y", "coefficient a", "=N14/(N7*N7)"), (20, "x = ay + b", "coefficient b", "=N4-N19*N5"),
            (22, "Équations des droites", "Droite de Mayer", '="y = "&ROUND(N12,3)&"x "&IF(N13>=0,"+ ","- ")&ROUND(ABS(N13),3)'),
            (23, "", "Moindres carrés de y en x", '="y = "&ROUND(N17,3)&"x "&IF(N18>=0,"+ ","- ")&ROUND(ABS(N18),3)'),
            (24, "", "Moindres carrés de x en y", '="y = "&ROUND(1/N19,3)&"x "&IF(N20/N19<0,"+ ","- ")&ROUND(ABS(N20/N19),3)'),
            (26, "Vérification", "PENTE (Excel)", f"=SLOPE({Y},{X})"), (27, "", "ORDONNEE.ORIGINE (Excel)", f"=INTERCEPT({Y},{X})"),
            (28, "", "COEFFICIENT.DETERMINATION", f"=RSQ({Y},{X})")]
    for row, l, m, f_ in calc:
        w.cell(row=row, column=12, value=l).font = F(bold=bool(l))
        w.cell(row=row, column=13, value=m).font = F()
        if f_:
            c = w.cell(row=row, column=14, value=f_)
            c.font = F(); c.border = CADRE
            c.number_format = "0.000000" if row in (14,) else ("0.0000" if row < 22 or row > 25 else "@")
            if row in (15, 16, 17, 18):
                c.fill = JAUNE
    w["L3"].font = F(bold=True, color="FFFFFF"); w["L3"].fill = ENTETE
    w["N15"].comment = Comment("Un coefficient proche de 1 ou de -1 justifie un ajustement affine (cours R1.14).", "SAÉ 303")
    w.column_dimensions["A"].width = 11; w.column_dimensions["B"].width = 34; w.column_dimensions["C"].width = 18
    w.column_dimensions["D"].width = 14
    for col in "EFGHI":
        w.column_dimensions[col].width = 15
    w.column_dimensions["L"].width = 34; w.column_dimensions["M"].width = 26; w.column_dimensions["N"].width = 24
    w.row_dimensions[3].height = 42
    w.freeze_panes = "A4"
    # nuage de points + courbe de tendance (équation et R² affichés), axes « aérés »
    sc = ScatterChart()
    sc.title = f"SP95 en fonction du gazole ({titre_periode})"
    sc.style = 13; sc.height, sc.width = 11, 18
    sc.x_axis.title = "Prix moyen du gazole xi (€/L)"; sc.y_axis.title = "Prix moyen du SP95 yi (€/L)"
    xs = Reference(w, min_col=5, min_row=a, max_row=b)
    ys = Reference(w, min_col=6, min_row=a, max_row=b)
    se = Series(ys, xs, title="Stations")
    se.marker.symbol = "circle"; se.marker.size = 5
    se.graphicalProperties.line.noFill = True
    se.trendline = Trendline(trendlineType="linear", dispRSqr=True, dispEq=True)
    sc.series.append(se)
    for col, titre, coul in [(7, "Droite de Mayer", "2A78D6"), (9, "Moindres carrés de x en y", "EB6834")]:
        sy = Reference(w, min_col=col, min_row=a, max_row=b)
        s2 = Series(sy, xs, title=titre)
        s2.marker.symbol = "none"
        s2.graphicalProperties.line.solidFill = coul
        s2.graphicalProperties.line.dashStyle = "dash"
        sc.series.append(s2)
    xmin, xmax = s["x"].min(), s["x"].max(); ymin, ymax = s["y"].min(), s["y"].max()
    sc.x_axis.scaling.min = round(xmin - 0.01, 2); sc.x_axis.scaling.max = round(xmax + 0.01, 2)
    sc.y_axis.scaling.min = round(ymin - 0.01, 2); sc.y_axis.scaling.max = round(ymax + 0.01, 2)
    sc.x_axis.number_format = "0.00"; sc.y_axis.number_format = "0.00"
    sc.x_axis.delete = False; sc.y_axis.delete = False
    w.add_chart(sc, "P3")
    return n


n1 = feuille_serie("Série double P1", "serie_double_gazole_sp95_P1.csv", "avant la crise, avr. 2025 - févr. 2026")
n2 = feuille_serie("Série double P2", "serie_double_gazole_sp95_P2.csv", "crise, 28 févr. - " + pd.Timestamp(I["fin"]).strftime("%d/%m/%Y"))

# ordre des onglets : lisez-moi, séries doubles, stats, journaliers, panels
# ------------------------------------------------------------------ Territoire (croisement avec l'Insee et le continent)
TER = I["territoire"]
EXT = json.loads((RACINE / "analyse" / "donnees_externes.json").read_text(encoding="utf-8"))
wt = wb.create_sheet("Territoire")
wt["A1"] = "Croisements : stations, population, revenus, voiture et budget carburant"
wt["A1"].font = F(bold=True, size=12)
wt["A2"] = ("Texte bleu : valeurs recopiées des sources (colonne G) ou issues du traitement Python. Texte noir : formules. "
            "Fond jaune : hypothèses modifiables et résultats clés.")
wt["A2"].font = F(italic=True, size=9)


def entete(ligne, titres):
    for j, tt in enumerate(titres, start=1):
        c = wt.cell(row=ligne, column=j, value=tt)
        c.font = F(bold=True, color="FFFFFF"); c.fill = ENTETE; c.alignment = Alignment(wrap_text=True, vertical="center")
    wt.row_dimensions[ligne].height = 28


def ligne_t(r, libelle, valeurs, fmt_nb, source=None, jaune=False, formule=False):
    wt.cell(row=r, column=1, value=libelle).font = F()
    for j, v in enumerate(valeurs, start=2):
        if v is None:
            continue
        c = wt.cell(row=r, column=j, value=v)
        est_formule = isinstance(v, str) and v.startswith("=")
        c.font = F() if est_formule else F(color=BLEU)
        c.number_format = fmt_nb; c.border = CADRE
        if jaune:
            c.fill = JAUNE
    if source:
        c = wt.cell(row=r, column=7, value=source)
        c.font = F(size=9, color="595959")


pop, sup, nv, eq, dt = (EXT["population"]["valeurs"], EXT["superficie"]["valeurs"], EXT["niveau_de_vie"],
                        EXT["equipement_auto"], EXT["domicile_travail"])
entete(4, ["Données de cadrage", "Corse-du-Sud", "Haute-Corse", "Corse", "France métro.", "Unité", "Source"])
ligne_t(5, "Population de référence 2023", [pop["2A"], pop["2B"], pop["corse"], pop["france_metro"], "habitants"], "#,##0", "Insee, populations de référence 2023")
ligne_t(6, "Superficie", [sup["2A"], sup["2B"], sup["corse"], sup["france_metro"], "km²"], "#,##0", "IGN (La Corse en bref, Insee)")
ligne_t(7, "Niveau de vie médian 2023", [nv["mediane"]["2A"], nv["mediane"]["2B"], nv["mediane"]["corse"], nv["mediane"]["france_metro"], "€ par an"], "#,##0", "Insee, Filosofi 2023")
ligne_t(8, "Niveau de vie : 1er décile (10 % les plus modestes)", [nv["premier_decile"]["2A"], nv["premier_decile"]["2B"], nv["premier_decile"]["corse"], nv["premier_decile"]["france_metro"], "€ par an"], "#,##0", "Insee, Filosofi 2023")
ligne_t(9, "Ménages ayant au moins une voiture (2022)", [eq["au_moins_une"][z] / 100 for z in ["2A", "2B", "corse", "france_metro"]] + ["% des ménages"], "0.0%", "Insee, RP 2022")
ligne_t(10, "Ménages ayant deux voitures ou plus (2022)", [eq["deux_ou_plus"][z] / 100 for z in ["2A", "2B", "corse", "france_metro"]] + ["% des ménages"], "0.0%", "Insee, RP 2022")
ligne_t(11, "Actifs allant travailler en voiture (2017)", [None, None, dt["voiture"]["corse"] / 100, dt["voiture"]["france"] / 100, "% des actifs"], "0.0%", "Insee Flash Corse n° 58 ; Insee Première n° 1835 (France entière)")
ligne_t(12, "Actifs allant travailler en transports en commun", [None, None, dt["transports_en_commun"]["corse"] / 100, dt["transports_en_commun"]["france"] / 100, "% des actifs"], "0.0%", "ANFA, diagnostic régional Corse 2026")

D = TER["densite"]
entete(14, ["Densité des stations", "Corse-du-Sud", "Haute-Corse", "Corse", "Continent", "", "Source / calcul"])
ligne_t(15, "Stations actives en 2026 (au moins un prix)", [D["2A"]["stations"], D["2B"]["stations"], "=B15+C15", D["continent"]["stations"]], "#,##0", "Traitement Python du fichier national (prix-carburants.gouv.fr)")
ligne_t(16, "Population", ["=B5", "=C5", "=D5", "=E5-D5"], "#,##0", "Continent = France métropolitaine - Corse")
ligne_t(17, "Superficie (km²)", ["=B6", "=C6", "=D6", "=E6-D6"], "#,##0", "Continent = France métropolitaine - Corse")
ligne_t(18, "Stations pour 10 000 habitants", ["=B15/B16*10000", "=C15/C16*10000", "=D15/D16*10000", "=E15/E16*10000"], "0.00", None, jaune=True)
ligne_t(19, "Stations pour 100 km²", ["=B15/B17*100", "=C15/C17*100", "=D15/D17*100", "=E15/E17*100"], "0.00", None, jaune=True)
ligne_t(20, "Habitants par station", ["=B16/B15", "=C16/C15", "=D16/D15", "=E16/E15"], "#,##0")
ligne_t(21, "Densité corse rapportée à celle du continent (par habitant)", [None, None, "=D18/E18"], "0.0")

vt = EXT["voiture_type"]
entete(23, ["Conducteur moyen (hypothèses)", "Valeur", "", "", "", "Unité", "Source"])
ligne_t(24, "Kilomètres par an", [vt["km_par_an"], None, None, None, "km"], "#,##0", "SDES, kilométrage moyen 2025", jaune=True)
ligne_t(25, "Consommation d'une voiture diesel", [vt["litres_100km"]["g"], None, None, None, "L/100 km"], "0.0", "CCFA 2025", jaune=True)
ligne_t(26, "Consommation d'une voiture essence", [vt["litres_100km"]["s"], None, None, None, "L/100 km"], "0.0", "CCFA 2025", jaune=True)
ligne_t(27, "Gazole consommé par an", ["=B24*B25/100", None, None, None, "litres"], "#,##0")
ligne_t(28, "Essence consommée par an", ["=B24*B26/100", None, None, None, "litres"], "#,##0")

PD, CI = TER["prix_dep"], TER["continent"]
entete(30, ["Prix moyen du gazole (€/L)", "Corse-du-Sud", "Haute-Corse", "Corse", "Continent", "", "Source / calcul"])
ligne_t(31, "Avant la crise (1er avril 2025 - 27 février 2026)", [PD["g"]["2A"]["p1"], PD["g"]["2B"]["p1"], PD["g"]["corse"]["p1"], CI["moyennes_avant"]["cont_g"]], "0.000", "Moyenne des prix journaliers (traitement Python)")
ligne_t(32, f"Pendant la crise (28 février - {JJ(I['fin'])})", [PD["g"]["2A"]["p2"], PD["g"]["2B"]["p2"], PD["g"]["corse"]["p2"], CI["moyennes_crise"]["cont_g"]], "0.000", "Idem")
ligne_t(33, f"Dernier jour ({JJ(I['fin'])})", [PD["g"]["2A"]["dernier"], PD["g"]["2B"]["dernier"], PD["g"]["corse"]["dernier"], None], "0.000", "Idem")
entete(35, ["Budget gazole d'un conducteur moyen", "Corse-du-Sud", "Haute-Corse", "Corse", "Continent", "", "Calcul"])
ligne_t(36, "Budget annuel avant la crise (€)", ["=$B$27*B31", "=$B$27*C31", "=$B$27*D31", "=$B$27*E31"], "#,##0", "litres par an × prix moyen")
ligne_t(37, "Budget annuel pendant la crise (€)", ["=$B$27*B32", "=$B$27*C32", "=$B$27*D32", "=$B$27*E32"], "#,##0", "litres par an × prix moyen")
ligne_t(38, "Surcoût annuel de la crise (€)", ["=B37-B36", "=C37-C36", "=D37-D36", "=E37-E36"], "#,##0", None, jaune=True)
ligne_t(39, "Part du niveau de vie médian (crise)", ["=B37/B7", "=C37/C7", "=D37/D7", "=E37/E7"], "0.0%", "Continent : niveau de vie médian de la France métropolitaine", jaune=True)
ligne_t(40, "En mois de niveau de vie médian", ["=B37/(B7/12)", "=C37/(C7/12)", "=D37/(D7/12)", "=E37/(E7/12)"], "0.00")
ligne_t(41, "En mois de revenu pour le 1er décile (seuil Insee : 1 mois)", ["=B37/(B8/12)", "=C37/(C8/12)", "=D37/(D8/12)", "=E37/(E8/12)"], "0.00", None, jaune=True)
ligne_t(42, "Kilomètres parcourus avec 50 € avant la crise", ["=50/B31/$B$25*100", "=50/C31/$B$25*100", "=50/D31/$B$25*100", "=50/E31/$B$25*100"], "#,##0")
ligne_t(43, "Kilomètres parcourus avec 50 € le dernier jour", ["=50/B33/$B$25*100", "=50/C33/$B$25*100", "=50/D33/$B$25*100", None], "#,##0")

entete(45, ["Corse et continent (gazole)", "Valeur", "", "", "", "Unité", "Calcul"])
ligne_t(46, "Écart moyen avant la crise", ["=(D31-E31)*100", None, None, None, "ct/L"], "0.0", "Corse - continent", jaune=True)
ligne_t(47, "Écart moyen pendant la crise", ["=(D32-E32)*100", None, None, None, "ct/L"], "0.0", "Corse - continent", jaune=True)
ligne_t(48, "Surcoût insulaire annuel avant la crise", ["=B46/100*B27", None, None, None, "€ par an"], "#,##0", "écart × litres par an")
ligne_t(49, "Surcoût insulaire annuel pendant la crise", ["=B47/100*B27", None, None, None, "€ par an"], "#,##0", "écart × litres par an")

entete(51, ["Consommation : estimation par l'élasticité", "Valeur", "", "", "", "Unité", "Source / calcul"])
ligne_t(52, "Élasticité de la consommation au prix", [EXT["elasticite_prix"]["valeur"], None, None, None, ""], "0.0", "Conseil des prélèvements obligatoires, juin 2026")
ligne_t(53, "Hausse du prix moyen corse du gazole (crise / avant)", ["=D32/D31-1", None, None, None, "%"], "0.0%")
ligne_t(54, "Baisse estimée de la consommation de gazole en Corse", ["=B53*B52", None, None, None, "%"], "0.0%", "Comparer : -7,5 % de livraisons de gazole en France sur neuf mois (CPDP)", jaune=True)
wt["A56"] = "Sources détaillées : analyse/donnees_externes.json (adresse de chaque page) et page « Territoire » du site."
wt["A56"].font = F(italic=True, size=9)
wt.column_dimensions["A"].width = 56
for col in "BCDE":
    wt.column_dimensions[col].width = 15
wt.column_dimensions["F"].width = 13
wt.column_dimensions["G"].width = 60
wt.freeze_panes = "B5"

# ------------------------------------------------------------------ Départements (classement par formules RANG)
dd = pd.read_csv(RACINE / "site" / "data" / "brut" / "national-france-departements.csv", dtype={"dep": str})
from territoire import DEPARTEMENTS  # noqa: E402
dd = dd[dd["dep"].isin(DEPARTEMENTS) & (dd["carburant"] == "Gazole") & (dd["stations"] >= 5)]
tab = dd.pivot_table(index="dep", columns="periode", values="moyenne").reindex(columns=["avant_crise", "crise", "dernier_jour"])
tab = tab.sort_index()
wdp = wb.create_sheet("Départements")
wdp["A1"] = "Prix moyen du gazole par département (€/L) et rang, du plus cher (1) au moins cher"
wdp["A1"].font = F(bold=True, size=12)
wdp["A2"] = "Source : prix-carburants.gouv.fr, fichiers annuels 2025 et 2026 ; département déduit du code postal ; départements d'au moins 5 stations."
wdp["A2"].font = F(italic=True, size=9)
tetes = ["Code", "Département", "Avant la crise", "Pendant la crise", "Dernier jour", "Rang avant", "Rang crise", "Rang dernier jour"]
for j, tt in enumerate(tetes, start=1):
    c = wdp.cell(row=4, column=j, value=tt); c.font = F(bold=True, color="FFFFFF"); c.fill = ENTETE
n0, n1 = 5, 4 + len(tab)
for i, (dep, r) in enumerate(tab.iterrows(), start=n0):
    wdp.cell(row=i, column=1, value=dep).font = F()
    wdp.cell(row=i, column=2, value=DEPARTEMENTS[dep]).font = F()
    for j, per in enumerate(["avant_crise", "crise", "dernier_jour"], start=3):
        if pd.notna(r[per]):
            c = wdp.cell(row=i, column=j, value=round(float(r[per]), 5)); c.font = F(color=BLEU); c.number_format = "0.000"
        lettre = get_column_letter(j)
        c = wdp.cell(row=i, column=j + 3, value=f"=RANK({lettre}{i},${lettre}${n0}:${lettre}${n1},0)")
        c.font = F(); c.number_format = "0"
    if dep in ("2A", "2B"):
        for j in range(1, 9):
            wdp.cell(row=i, column=j).fill = JAUNE
wdp["J4"] = "Résultats"; wdp["J4"].font = F(bold=True)
for k, (lib, dep, col) in enumerate([("Rang de la Corse-du-Sud avant la crise", "2A", "F"), ("Rang de la Haute-Corse avant la crise", "2B", "F"),
                                     ("Rang de la Corse-du-Sud pendant la crise", "2A", "G"), ("Rang de la Haute-Corse pendant la crise", "2B", "G")], start=5):
    wdp.cell(row=k, column=10, value=lib).font = F()
    c = wdp.cell(row=k, column=11, value=f'=INDEX({col}{n0}:{col}{n1},MATCH("{dep}",A{n0}:A{n1},0))'); c.font = F(); c.fill = JAUNE
wdp.cell(row=9, column=10, value="Nombre de départements classés").font = F()
wdp.cell(row=9, column=11, value=f"=COUNT(D{n0}:D{n1})").font = F()
wdp.column_dimensions["B"].width = 26
for col in "CDEFGH":
    wdp.column_dimensions[col].width = 14
wdp.column_dimensions["J"].width = 40
wdp.freeze_panes = "C5"

ordre = ["Lisez-moi", "Territoire", "Départements", "Série double P1", "Série double P2", "Stats descriptives", "Prix journaliers", "Panel gazole", "Panel SP95"]
wb._sheets = [wb[n] for n in ordre]
wb.active = 0
wb.calculation.fullCalcOnLoad = True   # Excel et LibreOffice recalculent toutes les formules à l'ouverture
wb.save(SORTIE)
print("Classeur écrit :", SORTIE, "| séries doubles :", n1, n2, "stations")
