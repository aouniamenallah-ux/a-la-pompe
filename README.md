# À la pompe — les prix des carburants en Corse

**Site en ligne : https://aouniamenallah-ux.github.io/a-la-pompe/**

Site de visualisation des prix du gazole et du SP95 dans les 108 stations-service de Corse, jour par jour, depuis avril 2025. Les données sont **mises à jour automatiquement chaque matin**.

Projet réalisé pour la SAÉ 303 « Concevoir des visualisations de données pour le web et un support animé » — BUT MMI 2, IUT de Corse (Università di Corsica) — Amen Allah Aouni, 2026.

## Les pages

- **L'essentiel** : chiffres clés, totem de prix animé, courbe des prix moyens et écart gazole / SP95.
- **Stations & carte** : carte animée des 108 stations, histogramme du jour, prix par enseigne, par intercommunalité, calculateur de plein et annuaire.
- **Analyse statistique** : étapes du traitement, statistiques descriptives, boîtes à moustaches, série statistique double (corrélation, droites d'ajustement), calendrier des changements de prix, téléchargements.
- **Communication** : la campagne « Le plein, ça se compare » (affiche A3, carrousel Instagram, story animée, bannière) et la charte graphique. Ces visuels sont datés : ils utilisent les données du 24 novembre 2026.

## Les données

| Période | Source |
|---|---|
| jusqu'au 2 juin 2026 | data.corsica, « Prix des carburants – J-1 – avec historique en Corse » (Collectivité de Corse) |
| depuis le 3 juin 2026 | ministère de l'Économie, stock annuel de [prix-carburants.gouv.fr](https://www.prix-carburants.gouv.fr/rubrique/opendata/) (même source officielle, mêmes stations) |

Les deux fichiers ont été comparés sur leur période commune (janvier – juin 2026) : 3 863 relevés sur 3 882 sont identiques, à la seconde près et au même prix. Licence Ouverte 2.0 (Etalab) pour les deux sources.

## Mise à jour automatique

Le workflow [`.github/workflows/mise-a-jour.yml`](.github/workflows/mise-a-jour.yml) tourne chaque jour vers 6 h 30 (heure de Paris) :

1. téléchargement du fichier annuel officiel (`https://donnees.roulez-eco.fr/opendata/annee/AAAA`, environ 35 Mo) ;
2. extraction des stations corses : `analyse/extraction_national.py` ;
3. assemblage des deux sources, nettoyage et indicateurs : `analyse/traitement.py` (Python, pandas) ;
4. classeur Excel de l'analyse : `analyse/classeur_excel.py` ;
5. publication du dossier `site/` sur GitHub Pages.

On peut aussi lancer une mise à jour à la main : onglet **Actions** › **Mise à jour quotidienne** › **Run workflow**. Si le fichier officiel est indisponible un jour, le site garde simplement la version de la veille.

## Lancer le projet sur son ordinateur

Le site fonctionne sans serveur : double-cliquer sur `site/index.html` (données incluses dans le dépôt, arrêtées à la dernière mise à jour enregistrée).

Pour recalculer les données :

```bash
pip install -r requirements.txt
# télécharger https://donnees.roulez-eco.fr/opendata/annee/2026 (et les années suivantes)
python analyse/extraction_national.py PrixCarburants_annuel_2026.zip
python analyse/traitement.py
python analyse/classeur_excel.py
```

## Structure

| Dossier | Contenu |
|---|---|
| `site/` | le site : 4 pages HTML, `css/`, `js/` (D3.js 7.9.1 dans `js/vendor/`), `data/` (données brutes et nettoyées, `data.js`, contours de la Corse, classeur Excel), `communication/`, `fonts/`, `img/` |
| `analyse/` | scripts Python du traitement et indicateurs (`indicateurs.json`) |
| `sources-visuels/` | atelier de mise en page des visuels de communication (`atelier.html`, `atelier.js`), export SVG / PNG / PDF / MP4 (`exporter.js`) et polices TTF |

## Crédits

- Contours des communes : IGN ADMIN EXPRESS via [france-geojson](https://github.com/gregoiredavid/france-geojson) (G. David), simplifiés avec mapshaper.
- [D3.js](https://d3js.org) 7.9.1 (licence ISC). Polices Barlow, Barlow Condensed et DSEG7 (SIL Open Font License).
- Contexte : communiqué du Comité national routier (9 mars 2026), communiqués TotalEnergies (mars à octobre 2026), décret du 23 octobre 2026 sur le déblocage des stocks stratégiques de gazole.
