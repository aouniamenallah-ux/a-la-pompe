/* =====================================================================
   À la pompe — page « Territoire » : densité, enseignes, voiture,
   comparaison avec le continent, budget des ménages
   Données : window.DATA.territoire (analyse/territoire.py)
   ===================================================================== */
(function () {
  "use strict";
  const { D, fmt, parseJour, css, showTip, hideTip, equiperCarte, surRedimension, premiereVue, segmente, barreH, reduit, el } = window.AP;
  const T = D.territoire, E = T.externe, C = T.continent, I = C.ind;
  const G = window.CORSE_GEO;
  const nb = " ";
  const dec = (v, d = 1) => fmt.dec(v, d);
  const pct = (v, d = 1) => (Number.isInteger(v) && d === 1 ? String(v) : dec(v, d)) + nb + "%";
  const eur = v => fmt.n(Math.round(v)) + nb + "€";
  const signe = (v, d = 1) => (v > 0 ? "+" : v < 0 ? "−" : "") + dec(Math.abs(v), d);
  const kpi = (v, u) => `${v}<small>${nb}${u}</small>`;
  const rang = n => (n === 1 ? "1<sup>er</sup>" : n + "<sup>e</sup>");
  const rangTxt = n => (n === 1 ? "1er" : n + "e");
  const NOMS_DEP = { "2A": "Corse-du-Sud", "2B": "Haute-Corse" };
  const dens = T.densite, acc = T.acces, bud = T.budget, nv = E.niveau_de_vie;
  const SRC_PRIX = "Sources : data.corsica (jusqu'au 2 juin 2026), puis prix-carburants.gouv.fr";

  /* ---------- valeurs reprises dans le texte ---------- */
  const destock = I.destockage;
  const V = {
    "dens-corse": () => dec(dens.corse.par_10000_hab),
    "dens-cont": () => dec(dens.continent.par_10000_hab),
    "dens-2a": () => dec(dens["2A"].par_10000_hab),
    "ratio-dens": () => dec(dens.corse.par_10000_hab / dens.continent.par_10000_hab),
    "hab-st-corse": () => fmt.n(Math.round(dens.corse.hab_par_station)),
    "hab-st-cont": () => fmt.n(Math.round(dens.continent.hab_par_station)),
    "km2-corse": () => dec(dens.corse.par_100_km2),
    "km2-cont": () => dec(dens.continent.par_100_km2),
    "st-corse": () => String(dens.corse.stations),
    "st-2a": () => String(dens["2A"].stations),
    "st-2b": () => String(dens["2B"].stations),
    "st-cont-cmp": () => fmt.n(I.stations_continent),
    "autoroute": () => fmt.n(dens.continent.autoroute),
    "voiture-corse-kpi": () => kpi(dec(E.domicile_travail.voiture.corse), "%"),
    "voiture-corse": () => pct(E.domicile_travail.voiture.corse),
    "voiture-france": () => fmt.n(E.domicile_travail.voiture.france) + nb + "%",
    "tc-corse": () => pct(E.domicile_travail.transports_en_commun.corse),
    "tc-france": () => pct(E.domicile_travail.transports_en_commun.france),
    "epci-60": () => String(T.enseignes.epci.filter(e => meneur(e).ex === 1 && meneur(e).part >= 60).length),
    "epci-n": () => String(T.enseignes.epci.length),
    "surcout-g-kpi": () => kpi("+" + fmt.n(Math.round(bud.g.surcout_crise)), "€"),
    "surcout-g": () => eur(bud.g.surcout_crise),
    "budget-p1-g": () => eur(bud.g.corse.p1),
    "budget-p2-g": () => eur(bud.g.corse.p2),
    "ecart-dernier-g-kpi": () => kpi(signe(I.ecart_dernier.g), "ct"),
    "ecart-avant-g": () => signe(I.ecart_avant.g) + nb + "ct",
    "ecart-avant-g-abs": () => dec(I.ecart_avant.g),
    "ecart-crise-g": () => signe(I.ecart_crise.g) + nb + "ct",
    "jours-moins-chere-g": () => String(I.jours_corse_moins_chere.g),
    "jours-crise": () => String(I.jours_crise),
    "sept-ecart-g": () => I.septembre ? signe(I.septembre.g.ecart_cts) + nb + "ct" : "",
    "rang-avant": () => { const r = T.classement.g.avant_crise; return `${rang(Math.min(r.liste.findIndex(d => d.dep === "2A"), r.liste.findIndex(d => d.dep === "2B")) + 1)} et ${rang(Math.max(r.liste.findIndex(d => d.dep === "2A"), r.liste.findIndex(d => d.dep === "2B")) + 1)}`; },
    "destock-phrase": () => destock ? `Mais depuis le déblocage des stocks de gazole, le 1<sup>er</sup> novembre, le prix moyen a baissé de ${dec(-destock.g.continent_cts)}${nb}centimes sur le continent et de ${dec(-destock.g.corse_cts)} seulement en Corse&nbsp;: le ${fmt.jour(parseJour(C.jours[C.jours.length - 1])).trim()}, l'écart est revenu à ${signe(I.ecart_dernier.g)}${nb}centimes.` : "",
    "km": () => fmt.n(E.voiture_type.km_par_an),
    "conso-g": () => dec(E.voiture_type.litres_100km.g),
    "d1-2b": () => eur(nv.premier_decile["2B"]),
    "mois-d1-2b": () => dec(bud.g.par_dep["2B"].mois_d1) + nb + "mois",
    "hausse-g": () => fmt.n(Math.round(bud.g.hausse_prix_pct)) + nb + "%",
    "baisse-g-abs": () => dec(Math.abs(bud.g.baisse_conso_estimee_pct)) + nb + "%",
    "baisse-g-kpi": () => kpi(signe(bud.g.baisse_conso_estimee_pct), "%"),
    "baisse-s": () => signe(bud.s.baisse_conso_estimee_pct) + nb + "%"
  };
  function remplirTextes() {
    document.querySelectorAll("[data-ter]").forEach(e => { const f = V[e.dataset.ter]; if (f) { const v = f(); if (v !== "") e.innerHTML = v; } });
  }

  /* enseigne en tête d'une intercommunalité (ex : nombre d'enseignes à égalité) */
  function meneur(e) {
    const max = d3.max(Object.values(e.marques)), tete = Object.keys(e.marques).filter(m => e.marques[m] === max);
    return { tete, ex: tete.length, part: max / e.stations * 100 };
  }

  /* ---------- enseignes : ordre et couleurs fixes ---------- */
  const ORDRE = ["VITO", "TotalEnergies", "ENI", "Indépendant sans enseigne", "Non renseignée"];
  const COUL = { VITO: "var(--cat-1)", TotalEnergies: "var(--cat-2)", ENI: "var(--cat-3)", "Indépendant sans enseigne": "var(--cat-autre)" };
  const LIB = m => (m === "Indépendant sans enseigne" ? "Indépendante" : m);
  function cleLegende(m) {
    if (m === "Non renseignée") return `<span><i class="key key-ci" style="background:var(--surface);box-shadow:inset 0 0 0 2px var(--ink-2)"></i>Enseigne non renseignée</span>`;
    return `<span><i class="key key-ci" style="background:${COUL[m]}"></i>${LIB(m)}</span>`;
  }

  /* ---------- 1. densité ---------- */
  function densite() {
    const box = document.getElementById("densite"), carteEl = document.getElementById("carte-densite");
    const loc = { mode: "hab" };
    const zones = [["2A", "Corse-du-Sud"], ["2B", "Haute-Corse"], ["corse", "Corse"], ["continent", "Continent"]];
    const val = z => (loc.mode === "hab" ? dens[z].par_10000_hab : dens[z].par_100_km2);
    function construire() {
      box.replaceChildren();
      const W = box.clientWidth, lh = 46, m = { t: 8, r: 64, b: 8, l: W < 520 ? 104 : 140 };
      const H = m.t + m.b + zones.length * lh;
      const x = d3.scaleLinear().domain([0, d3.max(zones, ([z]) => val(z)) * 1.08]).range([m.l, W - m.r]);
      const svg = d3.select(box).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
      zones.forEach(([z, nom], i) => {
        const y0 = m.t + i * lh, h = 22, yb = y0 + (lh - h) / 2;
        if (i === 3) svg.append("line").attr("class", "grid-sep").attr("x1", 0).attr("x2", W).attr("y1", y0 + 0.5).attr("y2", y0 + 0.5).style("stroke", "var(--line)");
        svg.append("text").attr("class", i === 2 ? "label-strong" : "label").attr("x", m.l - 12).attr("y", yb + h / 2 + 4).attr("text-anchor", "end").text(nom);
        const p = svg.append("path").style("fill", z === "continent" ? "var(--axis)" : "var(--ink-2)")
          .attr("d", barreH(x(0), x(reduit() ? val(z) : 0) + 0.01, yb, h, 4));
        if (!reduit()) p.transition().duration(650).delay(i * 80).attrTween("d", () => t => barreH(x(0), x(val(z) * t) + 0.01, yb, h, 4));
        svg.append("text").attr("class", "label-strong").attr("x", x(val(z)) + 8).attr("y", yb + h / 2 + 5).text(dec(val(z)));
        svg.append("rect").attr("class", "hit").attr("x", 0).attr("y", y0).attr("width", W).attr("height", lh)
          .on("pointermove", e => showTip(e, nom, [
            { key: "Stations actives en 2026", val: fmt.n(dens[z].stations) },
            { key: "Pour 10 000 habitants", val: dec(dens[z].par_10000_hab, 2) },
            { key: "Pour 100 km²", val: dec(dens[z].par_100_km2, 2) },
            { key: "Habitants par station", val: fmt.n(Math.round(dens[z].hab_par_station)) },
            { key: "km² par station", val: dec(dens[z].km2_par_station, 0) }]))
          .on("pointerleave", hideTip);
      });
    }
    construire();
    segmente(document.getElementById("dens-mode"), v => { loc.mode = v; construire(); });
    surRedimension(box, construire);
    equiperCarte(carteEl, {
      titre: "Stations-service rapportées à la population et à la superficie",
      source: "Sources : prix-carburants.gouv.fr (stations actives en 2026) · Insee, populations de référence 2023 · IGN",
      colonnes: [{ t: "Territoire" }, { t: "Stations", n: 1 }, { t: "Population", n: 1 }, { t: "Superficie (km²)", n: 1 }, { t: "Pour 10 000 hab.", n: 1 }, { t: "Pour 100 km²", n: 1 }],
      lignes: () => zones.map(([z, nom]) => [nom, fmt.n(dens[z].stations), fmt.n(dens[z].population), fmt.n(dens[z].superficie), dec(dens[z].par_10000_hab, 2), dec(dens[z].par_100_km2, 2)])
    });
  }

  /* ---------- 2. carte de l'accès aux stations ---------- */
  const CLASSES = [{ max: 3, lib: "jusqu'à 3 km", v: "var(--d0)" }, { max: 6, lib: "de 3 à 6 km", v: "var(--d1)" },
    { max: 10, lib: "de 6 à 10 km", v: "var(--d2)" }, { max: Infinity, lib: "plus de 10 km", v: "var(--d3)" }];
  const classe = km => CLASSES.findIndex(c => km <= c.max);
  function acces() {
    const box = document.getElementById("acces"), carteEl = document.getElementById("carte-acces");
    const leg = document.getElementById("acces-legende"), stats = document.getElementById("acces-stats"), note = document.getElementById("acces-note");
    const loc = { mode: "distance" };
    const parCode = new Map(T.communes.map(c => [c.c, c]));
    let communes, points;
    function legende() {
      if (loc.mode === "distance") {
        leg.innerHTML = CLASSES.map(c => `<span><i class="key key-sq" style="background:${c.v}"></i>${c.lib}</span>`).join("")
          + `<span><i class="key key-ci" style="background:var(--surface);box-shadow:inset 0 0 0 2px var(--ink)"></i>station active en 2026</span>`;
      } else leg.innerHTML = ORDRE.filter(m => m !== "Indépendant sans enseigne").map(cleLegende).join("")
        .replace("Enseigne non renseignée", "Indépendante ou non renseignée");
    }
    function chiffres() {
      const bloc = (k, v, w) => `<div class="day-stat"><div class="k">${k}</div><div class="v">${v}</div>${w ? `<div class="w">${w}</div>` : ""}</div>`;
      if (loc.mode === "distance") {
        stats.innerHTML = bloc("Communes ayant au moins une station", `${acc.corse.avec_station}${nb}<small>sur ${acc.corse.communes}</small>`,
          `Corse-du-Sud ${acc["2A"].avec_station} sur ${acc["2A"].communes}, Haute-Corse ${acc["2B"].avec_station} sur ${acc["2B"].communes}`)
          + bloc(`Communes à plus de ${T.seuil}${nb}km d'une station`, `${acc.corse.loin}${nb}<small>(${pct(acc.corse.part_loin, 0)})</small>`,
            `${pct(acc["2A"].part_loin, 0)} en Corse-du-Sud, ${pct(acc["2B"].part_loin, 0)} en Haute-Corse`)
          + bloc(`Part du territoire à plus de ${T.seuil}${nb}km`, pct(acc.corse.part_aire_loin, 0),
            `${pct(acc["2A"].part_aire_loin, 0)} en Corse-du-Sud, ${pct(acc["2B"].part_aire_loin, 0)} en Haute-Corse`)
          + bloc("Commune la plus éloignée", `${acc.corse.commune_max}`, `${dec(acc.corse.km_max)}${nb}km à vol d'oiseau · distance médiane ${dec(acc.corse.km_median)}${nb}km`);
        note.textContent = `Seules ${acc.corse.avec_station} communes sur ${acc.corse.communes} ont une station : dans les ${acc.corse.communes - acc.corse.avec_station} autres, il faut prendre la route pour faire le plein. La Haute-Corse compte plus de villages de montagne éloignés d'une station.`;
      } else {
        const p = T.enseignes.par_dep.corse;
        stats.innerHTML = ORDRE.filter(m => p[m]).map(m => bloc(m === "Non renseignée" ? "Enseigne non renseignée" : LIB(m), String(p[m]),
          `Corse-du-Sud ${T.enseignes.par_dep["2A"][m] || 0} · Haute-Corse ${T.enseignes.par_dep["2B"][m] || 0}`)).join("");
        note.textContent = `Enseigne connue pour les ${dens.corse.stations - (p["Non renseignée"] || 0)} stations présentes dans le jeu data.corsica. Les ${p["Non renseignée"] || 0} autres n'apparaissent que dans le fichier national, qui ne donne pas l'enseigne.`;
      }
    }
    function construire() {
      box.replaceChildren();
      const W = box.clientWidth, H = Math.round(Math.min(660, Math.max(440, W * 1.3)));
      const proj = d3.geoMercator().fitExtent([[14, 14], [W - 14, H - 14]], G.contour);
      const path = d3.geoPath(proj);
      const svg = d3.select(box).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
      communes = svg.append("g").selectAll("path").data(G.communes.features).join("path").attr("class", "commune-d").attr("d", path)
        .on("pointermove", (e, f) => {
          const c = parCode.get(f.properties.code);
          if (!c) return;
          showTip(e, c.n, [{ key: "Station la plus proche", val: dec(c.km) + nb + "km" },
            { key: "Stations à moins de 10 km", val: String(c.n10) }, { key: "Stations dans la commune", val: String(c.s) }],
          NOMS_DEP[c.d] + " · à vol d'oiseau");
        })
        .on("pointerleave", hideTip);
      svg.append("g").selectAll("path").data(G.departements.features).join("path").attr("class", "dep-line").attr("d", path).attr("pointer-events", "none");
      svg.append("text").attr("class", "label-muted").attr("x", W < 500 ? 16 : W - 16).attr("y", 26).attr("text-anchor", W < 500 ? "start" : "end").text("Haute-Corse (2B)");
      svg.append("text").attr("class", "label-muted").attr("x", 16).attr("y", H - 18).text("Corse-du-Sud (2A)");
      points = svg.append("g").selectAll("circle").data(T.stations.map(s => ({ s, xy: proj([s.lon, s.lat]) }))).join("circle")
        .attr("cx", d => d.xy[0]).attr("cy", d => d.xy[1])
        .on("pointermove", (e, d) => showTip(e, d.s.v || "Station", [{ key: "Enseigne", val: d.s.m ? LIB(d.s.m) : "non renseignée" }], NOMS_DEP[d.s.dep]))
        .on("pointerleave", hideTip);
      maj();
    }
    function maj() {
      const dist = loc.mode === "distance";
      communes.style("fill", f => { const c = parCode.get(f.properties.code); return dist && c ? CLASSES[classe(c.km)].v : "var(--surface-2)"; });
      points.attr("r", dist ? 3.4 : 5.2).attr("class", d => (dist ? "st-acces" : COUL[d.s.m] && d.s.m !== "Indépendant sans enseigne" ? "st-point" : "st-vide"))
        .style("fill", d => (dist ? null : COUL[d.s.m] && d.s.m !== "Indépendant sans enseigne" ? COUL[d.s.m] : null));
      legende(); chiffres();
      box.setAttribute("aria-label", dist ? "Carte des 360 communes corses colorées selon la distance à la station la plus proche, avec les stations actives en 2026."
        : "Carte des stations actives en 2026 colorées selon leur enseigne : VITO, TotalEnergies, ENI, ou enseigne non renseignée.");
    }
    construire();
    segmente(document.getElementById("acces-mode"), v => { loc.mode = v; maj(); });
    surRedimension(box, construire);
    equiperCarte(carteEl, {
      titre: "Distance entre chaque commune corse et la station la plus proche",
      source: "Sources : prix-carburants.gouv.fr (stations actives en 2026) · data.corsica (enseignes) · IGN ADMIN EXPRESS · distance à vol d'oiseau",
      colonnes: [{ t: "Commune" }, { t: "Département" }, { t: "Station la plus proche (km)", n: 1 }, { t: "Stations à moins de 10 km", n: 1 }, { t: "Stations dans la commune", n: 1 }],
      lignes: () => [...T.communes].sort((a, b) => b.km - a.km).map(c => [c.n, NOMS_DEP[c.d], dec(c.km), String(c.n10), String(c.s)])
    });
  }

  /* ---------- 3. enseignes par département ---------- */
  function enseignesDep() {
    const box = document.getElementById("ens-dep"), carteEl = document.getElementById("carte-ens-dep");
    document.getElementById("ens-legende").innerHTML = ORDRE.map(m => (m === "Indépendant sans enseigne"
      ? `<span><i class="key key-ci" style="background:var(--cat-autre)"></i>Indépendante</span>` : cleLegende(m))).join("");
    const lignes = [["2A", "Corse-du-Sud"], ["2B", "Haute-Corse"]];
    function construire() {
      box.replaceChildren();
      const W = box.clientWidth, lh = 56, m = { t: 6, r: 44, b: 6, l: W < 520 ? 104 : 132 };
      const H = m.t + m.b + lh * lignes.length;
      const total = d3.max(lignes, ([z]) => d3.sum(Object.values(T.enseignes.par_dep[z])));
      const x = d3.scaleLinear().domain([0, total]).range([m.l, W - m.r]);
      const svg = d3.select(box).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
      lignes.forEach(([z, nom], i) => {
        const p = T.enseignes.par_dep[z], h = 28, y = m.t + i * lh + (lh - h) / 2;
        svg.append("text").attr("class", "label-strong").attr("x", m.l - 12).attr("y", y + h / 2 + 5).attr("text-anchor", "end").text(nom);
        let cum = 0;
        ORDRE.forEach(mq => {
          const n = p[mq] || 0;
          if (!n) return;
          const x0 = x(cum) + (cum ? 1 : 0), x1 = x(cum + n) - 1;
          const r = svg.append("rect").attr("x", x0).attr("y", y).attr("width", Math.max(0, x1 - x0)).attr("height", h).attr("rx", 3)
            .style("fill", mq === "Non renseignée" ? "var(--surface-2)" : COUL[mq])
            .style("stroke", mq === "Non renseignée" ? "var(--ink-2)" : null).style("stroke-dasharray", mq === "Non renseignée" ? "3 2" : null);
          r.on("pointermove", e => showTip(e, nom, [{ key: mq === "Non renseignée" ? "Enseigne non renseignée" : LIB(mq), val: `${n} station${n > 1 ? "s" : ""}` },
            { key: "Part des stations", val: pct(n / d3.sum(Object.values(p)) * 100, 0) }])).on("pointerleave", hideTip);
          if (x1 - x0 > 22) svg.append("text").attr("x", (x0 + x1) / 2).attr("y", y + h / 2 + 5).attr("text-anchor", "middle")
            .attr("class", "label-strong").style("fill", mq === "Non renseignée" || mq === "Indépendant sans enseigne" ? "var(--ink)" : "#fff").attr("pointer-events", "none").text(n);
          cum += n;
        });
        svg.append("text").attr("class", "label").attr("x", x(cum) + 8).attr("y", y + h / 2 + 5).text(cum);
      });
    }
    construire();
    surRedimension(box, construire);
    equiperCarte(carteEl, {
      titre: "Stations actives en 2026 par enseigne et par département",
      source: "Sources : data.corsica (enseignes) · prix-carburants.gouv.fr (stations actives en 2026)",
      colonnes: [{ t: "Enseigne" }, { t: "Corse-du-Sud", n: 1 }, { t: "Haute-Corse", n: 1 }, { t: "Corse", n: 1 }],
      lignes: () => ORDRE.map(mq => [mq === "Non renseignée" ? "Non renseignée" : LIB(mq), String(T.enseignes.par_dep["2A"][mq] || 0), String(T.enseignes.par_dep["2B"][mq] || 0), String(T.enseignes.par_dep.corse[mq] || 0)])
    });
  }

  /* ---------- 4. une case par station et par intercommunalité ---------- */
  const court = n => n.replace("Communauté d'agglomération", "CA").replace("Communauté de communes", "CC");
  function enseignesEpci() {
    const box = document.getElementById("ens-epci"), carteEl = document.getElementById("carte-ens-epci");
    const data = T.enseignes.epci;
    function construire() {
      box.replaceChildren();
      const W = box.clientWidth, etroit = W < 600;
      const c = etroit ? 13 : 16, g = 3, maxN = d3.max(data, d => d.stations);
      const lw = etroit ? 0 : Math.min(300, W * 0.4), rw = 66;
      const lh = etroit ? 46 : 26;
      const H = 8 + data.length * lh;
      const svg = d3.select(box).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
      data.forEach((d, i) => {
        const y0 = 4 + i * lh, ycase = etroit ? y0 + 22 : y0 + (lh - c) / 2;
        const ligne = svg.append("g");
        ligne.append("text").attr("class", "label").attr("x", etroit ? 0 : lw - 12).attr("y", etroit ? y0 + 14 : y0 + lh / 2 + 4)
          .attr("text-anchor", etroit ? "start" : "end").text(court(d.epci).length > 46 ? court(d.epci).slice(0, 45) + "…" : court(d.epci));
        const cases = ORDRE.flatMap(mq => d3.range(d.marques[mq] || 0).map(() => mq));
        cases.forEach((mq, j) => ligne.append("rect").attr("x", (etroit ? 0 : lw) + j * (c + g)).attr("y", ycase).attr("width", c).attr("height", c).attr("rx", 2.5)
          .style("fill", COUL[mq]));
        const xr = etroit ? cases.length * (c + g) + 8 : lw + maxN * (c + g) + 10;
        const mn = meneur(d), txt = mn.ex > 1 ? `à égalité (${pct(mn.part, 0)} chacune)` : `${LIB(mn.tete[0])} ${pct(mn.part, 0)}`;
        const tient = xr + txt.length * 6.6 < W;
        ligne.append("text").attr("class", "label-muted").attr("x", tient ? xr : W).attr("y", tient ? ycase + c - 3 : y0 + 14)
          .attr("text-anchor", tient ? "start" : "end").text(txt);
        ligne.append("rect").attr("class", "hit").attr("x", 0).attr("y", y0).attr("width", W).attr("height", lh)
          .on("pointermove", e => showTip(e, d.epci, ORDRE.filter(mq => d.marques[mq]).map(mq => ({ key: LIB(mq), val: String(d.marques[mq]), sw: "ligne " + COUL[mq] })),
            `${d.stations} station${d.stations > 1 ? "s" : ""} · ${NOMS_DEP[d.dep]}`))
          .on("pointerleave", hideTip);
      });
    }
    construire();
    surRedimension(box, construire);
    equiperCarte(carteEl, {
      titre: "Stations par enseigne dans chaque intercommunalité corse",
      source: "Source : data.corsica (enseignes et intercommunalités des stations actives en 2026)",
      colonnes: [{ t: "Intercommunalité" }, { t: "Stations", n: 1 }, { t: "VITO", n: 1 }, { t: "TotalEnergies", n: 1 }, { t: "ENI", n: 1 }, { t: "Indépendantes", n: 1 }, { t: "Part de l'enseigne en tête", n: 1 }],
      lignes: () => data.map(d => [d.epci, String(d.stations), String(d.marques.VITO || 0), String(d.marques.TotalEnergies || 0), String(d.marques.ENI || 0),
        String(d.marques["Indépendant sans enseigne"] || 0), pct(d.part_tete, 0)])
    });
  }

  /* ---------- 5. la voiture : Corse et France ---------- */
  function voiture() {
    const box = document.getElementById("voiture"), carteEl = document.getElementById("carte-voiture");
    const dt = E.domicile_travail, eq = E.equipement_auto;
    const rows = [
      { lib: "Actifs qui vont travailler en voiture", corse: dt.voiture.corse, fr: dt.voiture.france, det: `2017, actifs qui se déplacent · France de province : ${pct(dt.voiture.province)}` },
      { lib: "Actifs qui vont travailler en transports en commun", corse: dt.transports_en_commun.corse, fr: dt.transports_en_commun.france, det: "dernier recensement (diagnostic ANFA 2026)" },
      { lib: "Ménages ayant au moins une voiture", corse: eq.au_moins_une.corse, fr: eq.au_moins_une.france_metro, det: `2022 · Corse-du-Sud ${pct(eq.au_moins_une["2A"])}, Haute-Corse ${pct(eq.au_moins_une["2B"])}` },
      { lib: "Ménages ayant deux voitures ou plus", corse: eq.deux_ou_plus.corse, fr: eq.deux_ou_plus.france_metro, det: `2022 · Corse-du-Sud ${pct(eq.deux_ou_plus["2A"])}, Haute-Corse ${pct(eq.deux_ou_plus["2B"])}` }];
    function construire() {
      box.replaceChildren();
      const W = box.clientWidth, lh = 72, m = { t: 6, r: 24, b: 26, l: 16 };
      const H = m.t + m.b + rows.length * lh;
      const x = d3.scaleLinear().domain([0, 100]).range([m.l, W - m.r]);
      const svg = d3.select(box).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
      svg.append("g").attr("class", "grid").attr("transform", `translate(0,${m.t})`).call(d3.axisBottom(x).ticks(W < 520 ? 4 : 10).tickSize(H - m.t - m.b).tickFormat(""));
      svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(W < 520 ? 4 : 10).tickFormat(v => v + " %").tickSize(0).tickPadding(8)).call(g => g.select(".domain").remove());
      rows.forEach((r, i) => {
        const y0 = m.t + i * lh, yl = y0 + 42;
        svg.append("text").attr("class", "label-strong").attr("x", m.l).attr("y", y0 + 18).text(r.lib);
        svg.append("line").attr("x1", x(r.fr)).attr("x2", x(r.corse)).attr("y1", yl).attr("y2", yl).style("stroke", "var(--ink-2)").style("stroke-width", 2);
        svg.append("circle").attr("cx", x(r.fr)).attr("cy", yl).attr("r", 7).style("fill", "var(--surface)").style("stroke", "var(--muted)").style("stroke-width", 2.5);
        svg.append("circle").attr("cx", x(r.corse)).attr("cy", yl).attr("r", 7.5).attr("class", "dot-ring").style("fill", "var(--ink)");
        const corseDroite = r.corse >= r.fr, gauche = Math.min(x(r.corse), x(r.fr));
        // étiquette du point de gauche : à gauche s'il y a la place, sinon sous le point
        const place = gauche - m.l > 96;
        const etiq = (v, nom, cls, aDroite) => {
          const t = svg.append("text").attr("class", cls + " halo").text(`${nom} ${pct(v)}`);
          if (aDroite) t.attr("x", x(v) + 13).attr("y", yl + 5).attr("text-anchor", "start");
          else if (place) t.attr("x", x(v) - 13).attr("y", yl + 5).attr("text-anchor", "end");
          else t.attr("x", x(v)).attr("y", yl + 24).attr("text-anchor", "middle");
        };
        etiq(r.corse, "Corse", "label-strong", corseDroite);
        etiq(r.fr, "France", "label", !corseDroite);
        svg.append("rect").attr("class", "hit").attr("x", 0).attr("y", y0).attr("width", W).attr("height", lh)
          .on("pointermove", e => showTip(e, r.lib, [{ key: "Corse", val: pct(r.corse) }, { key: "France", val: pct(r.fr) },
            { key: "Écart", val: signe(r.corse - r.fr) + " points" }], r.det))
          .on("pointerleave", hideTip);
      });
    }
    construire();
    surRedimension(box, construire);
    equiperCarte(carteEl, {
      titre: "La place de la voiture en Corse et en France",
      source: "Sources : Insee Flash Corse n° 58, Insee Première n° 1835 (2017) · ANFA 2026 · Insee, RP 2022",
      colonnes: [{ t: "Indicateur" }, { t: "Corse (%)", n: 1 }, { t: "France (%)", n: 1 }, { t: "Précision" }],
      lignes: () => rows.map(r => [r.lib, dec(r.corse), dec(r.fr), r.det])
    });
  }

  /* ---------- 6. Corse et continent, jour par jour ---------- */
  function continent() {
    const box = document.getElementById("continent"), carteEl = document.getElementById("carte-continent"), leg = document.getElementById("ct-legende");
    const loc = { k: "g" };
    const jours = C.jours.map(parseJour);
    const bis = d3.bisector(d => d).center;
    const iCrise = C.jours.indexOf(D.meta.crise), iDest = C.jours.indexOf("2026-11-01");
    function serie(nom) { return C[nom].map(v => (v == null ? NaN : v)); }
    function construire() {
      box.replaceChildren();
      const k = loc.k, co = serie("corse_" + k), ct = serie("cont_" + k), e10 = serie("cont_e10");
      leg.innerHTML = `<span><i class="key key-line" style="background:var(--${k === "g" ? "gazole" : "sp95"});height:4px"></i>Corse</span>`
        + `<span><i class="key key-line" style="background:var(--ink-2)"></i>Continent</span>`
        + (k === "s" ? `<span><i class="key key-line" style="background:none;border-top:2px dashed var(--muted);height:0"></i>E10 sur le continent (l'essence la plus vendue)</span>` : "")
        + `<span><i class="key key-sq" style="background:var(--plus);opacity:.35"></i>Corse plus chère</span><span><i class="key key-sq" style="background:var(--moins);opacity:.35"></i>Corse moins chère</span>`;
      const W = box.clientWidth, H = Math.round(Math.max(300, Math.min(440, W * 0.48)));
      const m = { t: 30, r: W < 640 ? 14 : 96, b: 32, l: 52 };
      const x = d3.scaleTime().domain(d3.extent(jours)).range([m.l, W - m.r]);
      const vals = co.concat(ct, k === "s" ? e10 : []).filter(v => !isNaN(v));
      const y = d3.scaleLinear().domain(d3.extent(vals)).nice().range([H - m.b, m.t]);
      const svg = d3.select(box).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
      svg.append("g").attr("class", "grid").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(6).tickSize(-(W - m.l - m.r)).tickFormat(""));
      svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(6).tickFormat(v => fmt.dec(v, 2) + " €").tickSize(0).tickPadding(8)).call(g => g.select(".domain").remove());
      svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(W < 640 ? 4 : 9).tickFormat(W < 640 ? fmt.axeMoisCourt : fmt.axeMois).tickSizeOuter(0));
      // repères : début de la crise, déblocage des stocks
      [[iCrise, W < 640 ? "Guerre" : "Début de la guerre"], [iDest, W < 640 ? "Stocks" : "Déblocage des stocks"]].forEach(([i, t]) => {
        if (i < 0) return;
        svg.append("line").attr("class", "annot-line").attr("x1", x(jours[i])).attr("x2", x(jours[i])).attr("y1", m.t - 6).attr("y2", H - m.b).style("stroke-dasharray", "3 3");
        svg.append("text").attr("class", "label-muted").attr("x", x(jours[i]) + 4).attr("y", m.t - 10).text(t);
      });
      const ok = i => !isNaN(co[i]) && !isNaN(ct[i]);
      const aireP = d3.area().defined((v, i) => ok(i)).x((v, i) => x(jours[i])).y0((v, i) => y(ct[i])).y1((v, i) => y(Math.max(co[i], ct[i])));
      const aireM = d3.area().defined((v, i) => ok(i)).x((v, i) => x(jours[i])).y0((v, i) => y(Math.min(co[i], ct[i]))).y1((v, i) => y(ct[i]));
      svg.append("path").attr("d", aireP(co)).style("fill", "var(--plus)").style("fill-opacity", 0.22);
      svg.append("path").attr("d", aireM(co)).style("fill", "var(--moins)").style("fill-opacity", 0.22);
      const ligne = s => d3.line().defined(v => !isNaN(v)).x((v, i) => x(jours[i])).y(v => y(v))(s);
      if (k === "s") svg.append("path").attr("class", "line").attr("d", ligne(e10)).style("stroke", "var(--muted)").style("stroke-width", 1.5).style("stroke-dasharray", "4 3");
      svg.append("path").attr("class", "line").attr("d", ligne(ct)).style("stroke", "var(--ink-2)");
      const lc = svg.append("path").attr("class", "line").attr("d", ligne(co)).style("stroke", `var(--${k === "g" ? "gazole" : "sp95"})`).style("stroke-width", 2.5);
      if (!reduit()) {
        const L = lc.node().getTotalLength();
        lc.attr("stroke-dasharray", `${L} ${L}`).attr("stroke-dashoffset", L).transition().duration(1400).ease(d3.easeCubicOut).attr("stroke-dashoffset", 0)
          .on("end", () => lc.attr("stroke-dasharray", null));
      }
      if (W >= 640) { // étiquettes directes en fin de courbe
        const n = co.length - 1, yc = y(co[n]), yt = y(ct[n]);
        const ecartY = Math.abs(yc - yt) < 30 ? (yc < yt ? [-9, 9] : [9, -9]) : [0, 0];
        svg.append("text").attr("class", "label-strong").attr("x", W - m.r + 8).attr("y", yc + 4 + ecartY[0]).text("Corse " + fmt.prix(co[n]));
        svg.append("text").attr("class", "label").attr("x", W - m.r + 8).attr("y", yt + 4 + ecartY[1]).text("Continent " + fmt.prix(ct[n]));
      }
      const cross = svg.append("line").attr("class", "crosshair").attr("y1", m.t).attr("y2", H - m.b).style("display", "none");
      svg.append("rect").attr("class", "hit").attr("x", m.l).attr("y", m.t).attr("width", W - m.l - m.r).attr("height", H - m.t - m.b)
        .on("pointermove", e => {
          const i = bis(jours, x.invert(d3.pointer(e)[0]));
          cross.style("display", null).attr("x1", x(jours[i])).attr("x2", x(jours[i]));
          const r = [{ key: "Corse", val: fmt.prix(co[i]), sw: "ligne var(--" + (k === "g" ? "gazole" : "sp95") + ")" }, { key: "Continent", val: fmt.prix(ct[i]), sw: "ligne var(--ink-2)" }];
          if (k === "s") r.push({ key: "E10, continent", val: fmt.prix(e10[i]) });
          if (ok(i)) r.push({ key: "Écart Corse − continent", val: fmt.cts((co[i] - ct[i]) * 100) });
          showTip(e, fmt.jour(jours[i]).trim(), r, k === "g" ? "Gazole" : "SP95");
        })
        .on("pointerleave", () => { cross.style("display", "none"); hideTip(); });
    }
    construire();
    segmente(document.getElementById("ct-carb"), v => { loc.k = v; construire(); });
    surRedimension(box, construire);
    equiperCarte(carteEl, {
      titre: "Prix moyen du litre en Corse et sur le continent",
      source: SRC_PRIX + " · continent : fichiers annuels 2025 et 2026 (France métropolitaine hors Corse)",
      colonnes: [{ t: "Mois" }, { t: "Corse (€/L)", n: 1 }, { t: "Continent (€/L)", n: 1 }, { t: "Écart (ct/L)", n: 1 }],
      lignes: () => d3.groups(d3.range(C.jours.length), i => C.jours[i].slice(0, 7)).map(([mo, is]) => {
        const a = d3.mean(is, i => C["corse_" + loc.k][i]), b = d3.mean(is, i => C["cont_" + loc.k][i]);
        return [fmt.mois(parseJour(mo + "-01")), fmt.dec(a, 3), fmt.dec(b, 3), fmt.cts((a - b) * 100)];
      })
    });
  }

  /* ---------- 7. classement des départements ---------- */
  function classement() {
    const box = document.getElementById("classement"), carteEl = document.getElementById("carte-classement");
    const loc = { k: "g", per: "avant_crise" };
    const moyCont = () => (loc.per === "avant_crise" ? I.moyennes_avant["cont_" + loc.k] : loc.per === "crise" ? I.moyennes_crise["cont_" + loc.k] : C["cont_" + loc.k][C["cont_" + loc.k].length - 1]);
    function construire() {
      box.replaceChildren();
      const L = T.classement[loc.k][loc.per].liste, n = L.length;
      const W = box.clientWidth, H = 176, m = { t: 44, r: 18, b: 40, l: 18 };
      const x = d3.scaleLinear().domain(d3.extent(L, d => d.moy)).nice().range([m.l, W - m.r]);
      const svg = d3.select(box).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
      svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(W < 520 ? 4 : 8).tickFormat(v => fmt.dec(v, 2) + " €").tickSizeOuter(0));
      const yt = m.t + 18, ht = 46;
      svg.append("g").selectAll("line").data(L).join("line").attr("x1", d => x(d.moy)).attr("x2", d => x(d.moy)).attr("y1", yt).attr("y2", yt + ht)
        .style("stroke", d => (d.dep === "2A" || d.dep === "2B" ? "var(--ink)" : "var(--axis)")).style("stroke-width", d => (d.dep === "2A" || d.dep === "2B" ? 3 : 1.5));
      const mc = moyCont();
      svg.append("line").attr("class", "ref-line").attr("x1", x(mc)).attr("x2", x(mc)).attr("y1", yt - 6).attr("y2", yt + ht + 6);
      svg.append("text").attr("class", "label-muted").attr("x", x(mc)).attr("y", yt + ht + 20).attr("text-anchor", "middle").text("moyenne du continent");
      // étiquettes des deux départements corses : celui de gauche écrit vers la gauche, l'autre vers la droite ;
      // à défaut de place, on les empile au-dessus des traits
      const corse = ["2A", "2B"].map(z => ({ z, i: L.findIndex(d => d.dep === z) })).filter(c => c.i >= 0).sort((a, b) => L[a.i].moy - L[b.i].moy);
      const larg = s => s.length * 7.1;
      const niveaux = [yt - 10, yt - 30];
      corse.forEach((c, j) => {
        const d = L[c.i], xx = x(d.moy), txt = `${d.nom} · ${rangTxt(c.i + 1)} sur ${n}`;
        let versDroite = j === corse.length - 1 && corse.length > 1, y = niveaux[0];
        if (corse.length === 1) versDroite = xx + 8 + larg(txt) < W;
        if (versDroite && xx + 8 + larg(txt) > W) { versDroite = false; y = niveaux[1]; }
        if (!versDroite && xx - 8 - larg(txt) < 0) { versDroite = true; y = niveaux[1]; }
        if (y === niveaux[1]) svg.append("line").attr("class", "annot-line").attr("x1", xx).attr("x2", xx).attr("y1", y + 4).attr("y2", yt);
        svg.append("text").attr("class", "label-strong halo").attr("x", xx + (versDroite ? 6 : -6)).attr("y", y).attr("text-anchor", versDroite ? "start" : "end").text(txt);
      });
      const hot = svg.append("line").style("stroke", "var(--ink)").style("stroke-width", 2).style("display", "none").attr("y1", yt - 4).attr("y2", yt + ht + 4);
      const tri = L.map((d, i) => ({ ...d, rang: i + 1 })).sort((a, b) => a.moy - b.moy);
      const bis = d3.bisector(d => d.moy).center;
      svg.append("rect").attr("class", "hit").attr("x", m.l).attr("y", yt - 8).attr("width", W - m.l - m.r).attr("height", ht + 16)
        .on("pointermove", e => {
          const d = tri[bis(tri, x.invert(d3.pointer(e)[0]))];
          hot.style("display", null).attr("x1", x(d.moy)).attr("x2", x(d.moy));
          showTip(e, `${d.nom} (${d.dep})`, [{ key: "Prix moyen", val: fmt.prix(d.moy) }, { key: "Rang (du plus cher)", val: `${rangTxt(d.rang)} sur ${n}` },
            { key: "Écart au continent", val: fmt.cts((d.moy - mc) * 100) }, { key: "Stations", val: String(d.n) }]);
        })
        .on("pointerleave", () => { hot.style("display", "none"); hideTip(); });
      svg.append("text").attr("class", "label-muted").attr("x", m.l).attr("y", H - 4).text("moins cher");
      svg.append("text").attr("class", "label-muted").attr("x", W - m.r).attr("y", H - 4).attr("text-anchor", "end").text("plus cher");
    }
    construire();
    segmente(document.getElementById("cl-carb"), v => { loc.k = v; construire(); });
    segmente(document.getElementById("cl-per"), v => { loc.per = v; construire(); });
    surRedimension(box, construire);
    equiperCarte(carteEl, {
      titre: "Prix moyen du litre par département",
      source: "Source : prix-carburants.gouv.fr, fichiers annuels 2025 et 2026 · département déduit du code postal",
      colonnes: [{ t: "Rang (du plus cher)", n: 1 }, { t: "Département" }, { t: "Prix moyen (€/L)", n: 1 }, { t: "Stations", n: 1 }],
      lignes: () => T.classement[loc.k][loc.per].liste.map((d, i) => [String(i + 1), `${d.nom} (${d.dep})`, fmt.dec(d.moy, 3), String(d.n)])
    });
  }

  /* ---------- barres horizontales avec libellé et précision ; libellés au-dessus des barres sur écran étroit ---------- */
  function barresEtiquetees(conteneur, lignes, marge, anime) {
    const W = conteneur.clientWidth, etroit = W < 520;
    const lh = etroit ? 54 : 46, m = { t: 4, r: marge, b: 4, l: etroit ? 0 : 178 };
    const H = m.t + m.b + lh * lignes.length;
    const x = d3.scaleLinear().domain([0, d3.max(lignes, d => d.v) * 1.04]).range([m.l, W - m.r]);
    const svg = d3.select(conteneur).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
    lignes.forEach((d, i) => {
      const y0 = m.t + i * lh, h = 20, yb = etroit ? y0 + 24 : y0 + 8;
      if (etroit) {
        const t = svg.append("text").attr("x", 0).attr("y", y0 + 15);
        t.append("tspan").attr("class", "label-strong").text(d.lib + " ");
        t.append("tspan").attr("class", "label-muted").text(d.sub);
      } else {
        svg.append("text").attr("class", "label-strong").attr("x", m.l - 12).attr("y", y0 + 20).attr("text-anchor", "end").text(d.lib);
        svg.append("text").attr("class", "label-muted").attr("x", m.l - 12).attr("y", y0 + 36).attr("text-anchor", "end").text(d.sub);
      }
      const p = svg.append("path").style("fill", d.c).style("stroke", d.contour ? "var(--ink-2)" : null).style("stroke-dasharray", d.contour ? "3 2" : null)
        .attr("d", barreH(x(0), x(anime && !reduit() ? 0 : d.v) + 0.01, yb, h, 4));
      if (anime && !reduit()) p.transition().duration(700).delay(i * 120).attrTween("d", () => t => barreH(x(0), x(d.v * t) + 0.01, yb, h, 4));
      svg.append("text").attr("class", "label-strong").attr("x", x(d.v) + 8).attr("y", yb + 15).text(d.txt);
    });
    return svg;
  }

  /* ---------- 8. simulateur de budget ---------- */
  function simulateur() {
    const loc = { k: "g", dep: "2B", rev: "mediane" };
    const km = document.getElementById("sim-km"), conso = document.getElementById("sim-conso");
    const kmOut = document.getElementById("sim-km-out"), consoOut = document.getElementById("sim-conso-out");
    const barres = document.getElementById("sim-barres"), jauge = document.getElementById("sim-jauge");
    const bilan = document.getElementById("sim-bilan"), noteEl = document.getElementById("sim-note");
    const fin = fmt.jourCourt(parseJour(C.jours[C.jours.length - 1])).trim();
    function calcul() {
      const L = +km.value * +conso.value / 100, p = T.prix_dep[loc.k][loc.dep];
      const cont = I.moyennes_crise["cont_" + loc.k];
      const rev = loc.rev === "mediane" ? nv.mediane[loc.dep] : nv.premier_decile[loc.dep];
      return { L, rev, lignes: [
        { lib: "Avant la crise", sub: "avril 2025 – février 2026", v: L * p.p1, c: "var(--axis)" },
        { lib: "Pendant la crise", sub: "moyenne depuis le 28 février 2026", v: L * p.p2, c: "var(--plus)" },
        { lib: "Au prix d'aujourd'hui", sub: fin, v: L * p.dernier, c: "var(--ink-2)" },
        { lib: "Sur le continent", sub: "même voiture, prix moyen de la crise", v: L * cont, c: "var(--surface-2)", contour: true }] };
    }
    function maj() {
      kmOut.textContent = fmt.n(+km.value) + " km";
      consoOut.textContent = fmt.dec(+conso.value, 1) + " L/100 km";
      const r = calcul(), [av, cr, auj, ct] = r.lignes;
      // barres
      barres.replaceChildren();
      const svg = barresEtiquetees(barres, r.lignes.map(d => ({ ...d, txt: eur(d.v) })), 70);
      // bilan
      const surcout = cr.v - av.v, moisCr = cr.v / (r.rev / 12);
      bilan.innerHTML = `La crise vous coûte <strong>${surcout >= 0 ? "+" : "−"}${eur(Math.abs(surcout))}</strong> par an (${fmt.n(Math.round(r.L))}${nb}litres). `
        + `Au prix moyen de la crise, le carburant représente <strong>${pct(cr.v / r.rev * 100)}</strong> du revenu de référence, soit ${dec(moisCr)}${nb}mois de revenu. `
        + `Avec la même voiture sur le continent, vous auriez payé ${ct.v <= cr.v ? eur(cr.v - ct.v) + " de moins" : eur(ct.v - cr.v) + " de plus"} pendant la crise.`;
      // jauge en mois de revenu
      jauge.replaceChildren();
      const Wj = jauge.clientWidth, Hj = 84, mj = { t: 30, r: 18, b: 22, l: 12 };
      const moisAv = av.v / (r.rev / 12), maxM = Math.max(2, moisCr * 1.25);
      const xj = d3.scaleLinear().domain([0, maxM]).range([mj.l, Wj - mj.r]);
      const sj = d3.select(jauge).append("svg").attr("viewBox", `0 0 ${Wj} ${Hj}`).attr("width", Wj).attr("height", Hj);
      sj.append("text").attr("class", "label-strong").attr("x", mj.l).attr("y", 14).text("Budget carburant en mois de revenu");
      sj.append("rect").attr("x", xj(0)).attr("y", mj.t + 8).attr("width", xj(maxM) - xj(0)).attr("height", 8).attr("rx", 4).style("fill", "var(--surface-2)");
      sj.append("path").attr("d", barreH(xj(0), xj(moisCr), mj.t + 8, 8, 4)).style("fill", "var(--plus)");
      sj.append("circle").attr("cx", xj(moisAv)).attr("cy", mj.t + 12).attr("r", 6).style("fill", "var(--surface)").style("stroke", "var(--ink-2)").style("stroke-width", 2);
      sj.append("line").attr("class", "ref-line").attr("x1", xj(1)).attr("x2", xj(1)).attr("y1", mj.t - 2).attr("y2", mj.t + 26);
      sj.append("text").attr("class", "label-muted").attr("x", xj(1) + (xj(1) > Wj * 0.7 ? -4 : 4)).attr("y", mj.t - 4).attr("text-anchor", xj(1) > Wj * 0.7 ? "end" : "start").text("seuil de l'Insee : 1 mois");
      sj.append("g").attr("class", "axis").attr("transform", `translate(0,${mj.t + 22})`).call(d3.axisBottom(xj).ticks(Math.min(6, Math.ceil(maxM) * 2)).tickFormat(v => fmt.dec(v, v % 1 ? 1 : 0)).tickSize(0).tickPadding(6)).call(g => g.select(".domain").remove());
      jauge.setAttribute("aria-label", `Budget carburant pendant la crise : ${dec(moisCr)} mois de revenu (avant la crise : ${dec(moisAv)} mois). Seuil de l'Insee : un mois.`);
      noteEl.innerHTML = `Revenu de référence&nbsp;: ${loc.rev === "mediane" ? "niveau de vie médian" : "niveau de vie au-dessous duquel vivent les 10&nbsp;% les plus modestes"} en ${NOMS_DEP[loc.dep]} en 2023, ${eur(r.rev)} par an pour une personne seule (Insee, Filosofi). `
        + `Prix&nbsp;: moyenne des stations du département. Rond blanc de la jauge&nbsp;: avant la crise. Valeurs par défaut&nbsp;: ${fmt.n(E.voiture_type.km_par_an)}&nbsp;km par an (SDES, 2025) et ${dec(E.voiture_type.litres_100km[loc.k])}&nbsp;L aux 100 (CCFA, voiture ${loc.k === "g" ? "diesel" : "essence"}).`;
    }
    km.addEventListener("input", maj);
    conso.addEventListener("input", maj);
    segmente(document.getElementById("sim-carb"), v => { loc.k = v; conso.value = E.voiture_type.litres_100km[v]; maj(); });
    segmente(document.getElementById("sim-dep"), v => { loc.dep = v; maj(); });
    segmente(document.getElementById("sim-rev"), v => { loc.rev = v; maj(); });
    maj();
    surRedimension(barres, maj);
  }

  /* ---------- 9. avec 50 € ---------- */
  function km50() {
    const box = document.getElementById("km50"), carteEl = document.getElementById("carte-50e");
    const b = bud.g.km_50e;
    const datePic = fmt.jourCourt(parseJour(D.indicateurs.gazole_date_pic)).trim(), fin = fmt.jourCourt(parseJour(C.jours[C.jours.length - 1])).trim();
    const rows = [{ lib: "Avant la crise", sub: "avril 2025 – février 2026", v: b.p1 }, { lib: "Au pic de la crise", sub: datePic, v: b.pic }, { lib: "Aujourd'hui", sub: fin, v: b.dernier }];
    function construire() {
      box.replaceChildren();
      const svg = barresEtiquetees(box, rows.map(d => ({ ...d, c: "var(--gazole)", txt: fmt.n(Math.round(d.v)) + " km" })), 80, true);
      const perte = b.p1 - b.dernier, H = +svg.attr("height"), W = +svg.attr("width");
      svg.attr("height", H + 18).attr("viewBox", `0 0 ${W} ${H + 18}`);
      svg.append("text").attr("class", "label-muted").attr("x", W - 4).attr("y", H + 12).attr("text-anchor", "end").text(`${fmt.n(Math.round(perte))} km de moins qu'avant la crise`);
    }
    construire();
    surRedimension(box, construire);
    equiperCarte(carteEl, {
      titre: "Distance parcourue avec 50 € de gazole en Corse",
      source: SRC_PRIX + " · CCFA 2025 (5,9 L/100 km)",
      colonnes: [{ t: "Moment" }, { t: "Prix du gazole (€/L)", n: 1 }, { t: "Kilomètres pour 50 €", n: 1 }],
      lignes: () => rows.map(d => [`${d.lib} (${d.sub})`, fmt.dec(50 / (d.v * E.voiture_type.litres_100km.g / 100), 3), fmt.n(Math.round(d.v))])
    });
  }

  /* ---------- 10. Corse-du-Sud ou Haute-Corse ---------- */
  function duel() {
    const tb = document.querySelector("#duel tbody");
    const pd = T.prix_dep.g, bg = bud.g.par_dep, eq = E.equipement_auto;
    // sens : +1 si une valeur plus élevée expose davantage au prix du carburant, −1 sinon, 0 sans objet
    const rows = [
      ["Population (2023)", E.population.valeurs["2A"], E.population.valeurs["2B"], v => fmt.n(v), 0, "Insee"],
      ["Superficie", E.superficie.valeurs["2A"], E.superficie.valeurs["2B"], v => fmt.n(v) + nb + "km²", 0, "IGN"],
      ["Stations actives en 2026", dens["2A"].stations, dens["2B"].stations, v => fmt.n(v), 0, "prix-carburants.gouv.fr"],
      ["Stations pour 10 000 habitants", dens["2A"].par_10000_hab, dens["2B"].par_10000_hab, v => dec(v, 2), -1, "calcul"],
      ["Stations pour 100 km²", dens["2A"].par_100_km2, dens["2B"].par_100_km2, v => dec(v, 2), -1, "calcul"],
      [`Communes à plus de ${T.seuil} km d'une station`, acc["2A"].part_loin, acc["2B"].part_loin, v => pct(v, 0), 1, "calcul (vol d'oiseau)"],
      ["Ménages ayant au moins une voiture (2022)", eq.au_moins_une["2A"], eq.au_moins_une["2B"], v => pct(v), 1, "Insee, RP 2022"],
      ["Ménages ayant deux voitures ou plus (2022)", eq.deux_ou_plus["2A"], eq.deux_ou_plus["2B"], v => pct(v), 1, "Insee, RP 2022"],
      ["Niveau de vie médian (2023)", nv.mediane["2A"], nv.mediane["2B"], v => eur(v), -1, "Insee, Filosofi"],
      ["Niveau de vie des 10 % les plus modestes (au plus)", nv.premier_decile["2A"], nv.premier_decile["2B"], v => eur(v), -1, "Insee, Filosofi"],
      ["Prix moyen du gazole pendant la crise", pd["2A"].p2, pd["2B"].p2, v => fmt.prix(v), 1, "prix-carburants.gouv.fr"],
      ["Budget gazole annuel d'un conducteur moyen, crise", bg["2A"].budget_p2, bg["2B"].budget_p2, v => eur(v), 1, "calcul (SDES, CCFA)"],
      ["Part de ce budget dans le niveau de vie médian", bg["2A"].part_mediane, bg["2B"].part_mediane, v => pct(v), 1, "calcul"],
      ["En mois de revenu, pour les 10 % les plus modestes", bg["2A"].mois_d1, bg["2B"].mois_d1, v => dec(v, 2) + nb + "mois", 1, "calcul"]];
    tb.replaceChildren();
    rows.forEach(([lib, a, b, f, sens, src]) => {
      const tr = el("tr");
      tr.appendChild(el("td", null, lib));
      const max = Math.max(a, b);
      [a, b].forEach((v, j) => {
        const autre = j === 0 ? b : a;
        const expose = sens !== 0 && Math.abs(v - autre) / Math.max(v, autre) >= 0.02 && (sens > 0 ? v > autre : v < autre);
        const td = el("td", "n" + (expose ? " plus-expose" : ""));
        const box = el("div", "val");
        box.appendChild(el("span", null, f(v)));
        const bar = el("span", "bar"), i = el("i");
        i.style.width = (v / max * 100).toFixed(1) + "%";
        if (expose) i.style.background = "var(--ink)";
        bar.appendChild(i); box.appendChild(bar); td.appendChild(box); tr.appendChild(td);
      });
      tr.appendChild(el("td", "src", src));
      tb.appendChild(tr);
    });
    // phrase de conclusion, écrite d'après les valeurs
    const plus = bg["2B"].part_mediane >= bg["2A"].part_mediane ? "2B" : "2A", moins = plus === "2B" ? "2A" : "2B";
    const prixPlus = pd[plus].p2 > pd[moins].p2;
    const d = Math.abs(dens["2A"].par_10000_hab - dens["2B"].par_10000_hab) < 0.2;
    document.getElementById("duel-texte").innerHTML =
      `${d ? "Les deux départements ont presque autant de stations par habitant" : `La ${NOMS_DEP[dens["2A"].par_10000_hab < dens["2B"].par_10000_hab ? "2A" : "2B"]} a moins de stations par habitant`} (${dec(dens["2A"].par_10000_hab, 2)} et ${dec(dens["2B"].par_10000_hab, 2)} pour 10&nbsp;000)${d ? "&nbsp;: la Corse-du-Sud n'est pas moins bien équipée" : ""}. `
      + `La Corse-du-Sud a plus de ménages équipés de deux voitures (${pct(eq.deux_ou_plus["2A"])} contre ${pct(eq.deux_ou_plus["2B"])}). `
      + `La ${NOMS_DEP[plus]} ${plus === "2B" ? `cumule plus de communes éloignées d'une station (${pct(acc["2B"].part_loin, 0)} contre ${pct(acc["2A"].part_loin, 0)}), ` : ""}un niveau de vie plus bas (${eur(nv.mediane[plus])} contre ${eur(nv.mediane[moins])})`
      + `${prixPlus ? " et un gazole un peu plus cher pendant la crise" : ""}&nbsp;: c'est là que le carburant pèse le plus, <strong>${pct(bg[plus].part_mediane)}</strong> du niveau de vie médian contre ${pct(bg[moins].part_mediane)}.`;
  }

  /* ---------- 11. liste des sources ---------- */
  function sources() {
    const ul = document.getElementById("sources-liste"), vus = new Set();
    Object.values(E).forEach(b => (b && b.sources ? b.sources : []).forEach(s => {
      if (vus.has(s.url)) return;
      vus.add(s.url);
      const li = el("li"), a = el("a", null, s.titre);
      a.href = s.url; a.rel = "noopener"; li.appendChild(a); ul.appendChild(li);
    }));
  }

  document.addEventListener("DOMContentLoaded", () => {
    remplirTextes();
    densite(); acces(); enseignesDep(); enseignesEpci(); voiture(); continent(); classement(); simulateur(); km50(); duel(); sources();
  });
})();
