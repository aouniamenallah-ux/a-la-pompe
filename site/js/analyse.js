/* =====================================================================
   À la pompe — page « Analyse statistique »
   Étapes du traitement, statistiques descriptives, boîtes à moustaches,
   série double (régressions, Mayer, corrélation), calendrier des changements
   ===================================================================== */
(function () {
  "use strict";
  const { D, fmt, parseJour, jours, N, libMois, carb, stationsById, showTip, hideTip, equiperCarte, surRedimension, premiereVue, segmente, marqueur, css, reduit, nomMarque } = AP;
  const I = D.indicateurs;
  const dec = (v, d = 3) => fmt.dec(v, d);

  /* ---------- étapes du traitement ---------- */
  function etapes() {
    const a = I.anomalies_detail;
    const V = I.validation, P2 = I.periodes.P2, P1 = I.periodes.P1;
    const jourTxt = s => fmt.jour(parseJour(s)).trim();
    const items = [
      ["Récupérer le fichier", `Export CSV de l'API data.corsica : ${fmt.n(I.lignes_brutes)} lignes et 27 colonnes, ${I.stations} stations, du 20 février 2025 au ${jourTxt(I.fin_corsica)}. Chaque ligne donne les prix d'une station au moment d'une mise à jour.`],
      ["Fusionner les doublons", `${fmt.n(I.doublons_fusionnes)} lignes partagent la même station et la même heure : une même mise à jour est éclatée en plusieurs lignes partielles. Après fusion, il reste ${fmt.n(I.mises_a_jour_corsica)} mises à jour distinctes.`],
      ["Prolonger avec le fichier national", `data.corsica n'est plus mis à jour après le ${jourTxt(I.fin_corsica)}. On reprend le fichier annuel 2026 de prix-carburants.gouv.fr, dont il est issu, pour les ${I.stations} mêmes stations. Contrôle sur la période commune : ${fmt.n(V.releves_retrouves)} relevés sur ${fmt.n(V.releves_corsica)} se retrouvent à la seconde près et au même prix. On ajoute ainsi ${fmt.n(I.mises_a_jour_nationales)} mises à jour, jusqu'au ${jourTxt(I.fin)}.`],
      ["Contrôler les valeurs", "Chaque prix doit être compris entre 1 et 3,50 €/L. Une saisie isolée est repérée : un gazole à 1,250 € le 20 mai 2026 dans une station qui affichait 2,230 € avant et 2,210 € après. Il est retiré (faute de frappe probable)."],
      ["Reconstituer chaque journée", `Un prix reste valable jusqu'à la mise à jour suivante : pour chaque jour, on reporte le dernier prix connu de chaque station, pendant ${I.peremption_jours} jours au plus. Ce délai couvre le plafonnement TotalEnergies, qui a figé les prix de 26 stations de fin juillet à mi-novembre 2026. On obtient un tableau de ${I.stations} stations × ${I.jours} jours.`],
      ["Choisir la fenêtre d'analyse", `Avant le 1er avril 2025, moins de 90 % des stations sont présentes dans le fichier : l'analyse démarre donc à cette date. Deux périodes sont comparées : avant la crise (${P1.jours} jours) et pendant la crise, du 28 février au ${jourTxt(P2.fin)} (${P2.jours} jours).`],
      ["Calculer les indicateurs", "Moyenne, médiane, quartiles, écart-type, étendue, covariance, coefficient de corrélation et droites d'ajustement, avec pandas et numpy, puis vérifiés avec les formules d'Excel dans le classeur fourni."]
    ];
    document.getElementById("etapes").replaceChildren(...items.map(([t, p]) => {
      const li = AP.el("li"); const d = AP.el("div");
      d.append(AP.el("h4", null, t), AP.el("p", null, p)); li.appendChild(d); return li;
    }));
  }

  /* ---------- tableau des statistiques descriptives ---------- */
  function tableau() {
    const X = I.descriptives;
    const cols = [X.P1.Gazole, X.P2.Gazole, X.P1.SP95, X.P2.SP95];
    const lignes = [
      ["Nombre de prix station×jour", c => fmt.n(c.n)],
      ["Moyenne", c => fmt.prix(c.moy)], ["Médiane", c => fmt.prix(c.med)],
      ["1er quartile (Q1)", c => fmt.prix(c.q1)], ["3e quartile (Q3)", c => fmt.prix(c.q3)],
      ["Écart interquartile (Q3 – Q1)", c => fmt.cts(c.eiq * 100).replace("+", "")],
      ["Écart-type", c => fmt.cts(c.et * 100).replace("+", "")], ["Variance", c => dec(c.var, 5)],
      ["Coefficient de variation", c => dec(c.cv, 1) + " %"],
      ["Minimum", c => fmt.prix(c.min)], ["Maximum", c => fmt.prix(c.max)], ["Étendue", c => fmt.cts(c.etendue * 100).replace("+", "")]
    ];
    document.querySelector("#table-desc tbody").replaceChildren(...lignes.map(([lab, f]) => {
      const tr = AP.el("tr"); const th = AP.el("th", null, lab); th.scope = "row"; th.style.position = "static"; th.style.background = "transparent"; th.style.fontWeight = "500";
      tr.appendChild(th); cols.forEach(c => tr.appendChild(AP.el("td", "n", f(c)))); return tr;
    }));
  }

  /* ---------- boîtes à moustaches mensuelles ---------- */
  function boites() {
    const box = document.getElementById("boites"), carte = document.getElementById("carte-boites");
    const loc = { k: "g" };
    let elems;
    function construire() {
      box.replaceChildren();
      const data = D.boites[loc.k];
      const W = box.clientWidth, H = Math.round(Math.max(300, Math.min(420, W * 0.42)));
      const m = { t: 20, r: 16, b: 34, l: 52 };
      const x = d3.scaleBand().domain(data.map(d => d.mois)).range([m.l, W - m.r]).padding(0.3);
      const y = d3.scaleLinear().domain([d3.min(data, d => d.bas) - 0.03, d3.max(data, d => d.haut) + 0.03]).nice().range([H - m.b, m.t]);
      const svg = d3.select(box).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
      svg.append("g").attr("class", "grid").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(6).tickSize(-(W - m.l - m.r)).tickFormat(""));
      svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(6).tickFormat(v => dec(v, 2) + " €").tickSize(0).tickPadding(8)).call(g => g.select(".domain").remove());
      svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`)
        .call(d3.axisBottom(x).tickFormat((mo, i) => { const d = parseJour(mo + "-01"); const t = (W < 640 && i % 2) ? "" : (d.getMonth() === 0 || i === 0 ? fmt.moisC(d) : fmt.moisSeul(d)); return libMois(mo) !== fmt.mois(d) && t ? t + "*" : t; }).tickSizeOuter(0));
      const bw = Math.min(28, x.bandwidth());
      const g = svg.append("g").selectAll("g").data(data).join("g").attr("transform", d => `translate(${x(d.mois) + x.bandwidth() / 2},0)`);
      g.append("line").attr("class", "whisker").attr("y1", d => y(d.bas)).attr("y2", d => y(d.haut));
      g.append("line").attr("class", "whisker").attr("x1", -bw / 4).attr("x2", bw / 4).attr("y1", d => y(d.bas)).attr("y2", d => y(d.bas));
      g.append("line").attr("class", "whisker").attr("x1", -bw / 4).attr("x2", bw / 4).attr("y1", d => y(d.haut)).attr("y2", d => y(d.haut));
      g.append("rect").attr("class", "box").attr("x", -bw / 2).attr("width", bw).attr("rx", 3).attr("y", d => y(d.q3)).attr("height", d => Math.max(1.5, y(d.q1) - y(d.q3)));
      g.append("line").attr("class", "median").attr("x1", -bw / 2).attr("x2", bw / 2).attr("y1", d => y(d.med)).attr("y2", d => y(d.med));
      g.each(function (d) { marqueur(d3.select(this), loc.k, 0, y(d.moy), 8); });
      g.append("rect").attr("class", "hit").attr("x", -x.step() / 2).attr("width", x.step()).attr("y", m.t).attr("height", H - m.t - m.b)
        .attr("tabindex", 0).attr("aria-label", d => `${fmt.mois(parseJour(d.mois + "-01"))} : médiane ${fmt.prix(d.med)}`)
        .on("pointerenter pointermove focus", (e, d) => showTip(e.type === "focus" ? { target: e.target } : e, libMois(d.mois), [
          { key: "3e quartile", val: fmt.prix(d.q3) }, { key: "Médiane", val: fmt.prix(d.med) }, { key: "1er quartile", val: fmt.prix(d.q1) },
          { key: "Moyenne", val: fmt.prix(d.moy), sw: (loc.k === "g" ? "carre g" : "rond s") }, { key: "Écart-type", val: dec(d.et * 100, 1) + " ct" },
          { key: "Minimum – maximum", val: `${dec(d.min, 3)} – ${dec(d.max, 3)}` }, { key: "Valeurs atypiques", val: fmt.n(d.atypiques) }
        ], `${fmt.n(d.n)} prix station×jour`))
        .on("pointerleave blur", hideTip);
      elems = { g, y };
    }
    function animerEntree() {
      elems.g.selectAll("rect.box").attr("transform", "scale(1,0)").style("transform-box", "fill-box").style("transform-origin", "center")
        .transition().duration(700).delay((d, i) => i * 40).attr("transform", "scale(1,1)");
    }
    construire();
    segmente(document.getElementById("bx-carb"), v => { loc.k = v; construire(); });
    surRedimension(box, construire);
    document.addEventListener("themechange", construire);
    premiereVue(box, animerEntree);
    equiperCarte(carte, {
      titre: "Répartition mensuelle des prix affichés",
      colonnes: [{ t: "Mois" }, { t: "Q1", n: 1 }, { t: "Médiane", n: 1 }, { t: "Q3", n: 1 }, { t: "Moyenne", n: 1 }, { t: "Écart-type (ct)", n: 1 }, { t: "Min", n: 1 }, { t: "Max", n: 1 }],
      lignes: () => D.boites[loc.k].map(d => [libMois(d.mois), dec(d.q1), dec(d.med), dec(d.q3), dec(d.moy), dec(d.et * 100, 1), dec(d.min), dec(d.max)])
    });
  }

  /* ---------- série double : nuage de points et droites d'ajustement ---------- */
  function nuage() {
    const box = document.getElementById("nuage"), carte = document.getElementById("carte-nuage"), panel = document.getElementById("reg-panel");
    const loc = { per: "P1" };
    const reg = () => (loc.per === "P1" ? I.regression : I.regression_P2);
    let svg, x, y, W, H, m, points, lignes, gpts, premiere = true;
    function domaines() {
      const pts = D.serie_double[loc.per];
      const ex = d3.extent(pts, d => d.x), ey = d3.extent(pts, d => d.y);
      const px = (ex[1] - ex[0]) * 0.08, py = (ey[1] - ey[0]) * 0.08;
      x.domain([ex[0] - px, ex[1] + px]); y.domain([ey[0] - py, ey[1] + py]);
    }
    function construire() {
      box.replaceChildren();
      W = box.clientWidth; H = Math.round(Math.max(320, Math.min(520, W * 0.55)));
      m = { t: 20, r: 20, b: 48, l: 64 };
      x = d3.scaleLinear().range([m.l, W - m.r]); y = d3.scaleLinear().range([H - m.b, m.t]);
      svg = d3.select(box).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
      svg.append("defs").append("clipPath").attr("id", "clip-nuage").append("rect").attr("x", m.l).attr("y", m.t).attr("width", W - m.l - m.r).attr("height", H - m.t - m.b);
      svg.append("g").attr("class", "grid gx");
      svg.append("g").attr("class", "grid gy");
      svg.append("g").attr("class", "axis ax").attr("transform", `translate(0,${H - m.b})`);
      svg.append("g").attr("class", "axis ay").attr("transform", `translate(${m.l},0)`);
      svg.append("text").attr("class", "axis-title").attr("x", W - m.r).attr("y", H - 8).attr("text-anchor", "end").text("x : prix moyen du gazole (€/L)");
      svg.append("text").attr("class", "axis-title").attr("x", m.l).attr("y", m.t - 6).text("y : prix moyen du SP95 (€/L)");
      lignes = svg.append("g").attr("clip-path", "url(#clip-nuage)");
      lignes.append("path").attr("class", "reg-xy").attr("data-l", "xy");
      lignes.append("path").attr("class", "reg-mayer").attr("data-l", "mayer");
      lignes.append("path").attr("class", "reg-yx").attr("data-l", "yx");
      points = svg.append("g");
      gpts = svg.append("g");
      maj(false);
    }
    function maj(anime) {
      const dur = anime && !reduit() ? 800 : 0;
      domaines();
      const r = reg();
      const t = svg.transition().duration(dur).ease(d3.easeCubicInOut);
      svg.select(".ax").transition(t).call(d3.axisBottom(x).ticks(6).tickFormat(v => dec(v, 2)).tickSizeOuter(0));
      svg.select(".ay").transition(t).call(d3.axisLeft(y).ticks(6).tickFormat(v => dec(v, 2)).tickSize(0).tickPadding(8)).on("end", function () { d3.select(this).select(".domain").remove(); });
      svg.select(".gx").attr("transform", `translate(0,${H - m.b})`).transition(t).call(d3.axisBottom(x).ticks(6).tickSize(-(H - m.t - m.b)).tickFormat(""));
      svg.select(".gy").attr("transform", `translate(${m.l},0)`).transition(t).call(d3.axisLeft(y).ticks(6).tickSize(-(W - m.l - m.r)).tickFormat(""));
      const [x0, x1] = x.domain();
      const seg = f => `M${x(x0)},${y(f(x0))}L${x(x1)},${y(f(x1))}`;
      lignes.select("[data-l=yx]").transition(t).attr("d", seg(v => r.yx.a * v + r.yx.b));
      lignes.select("[data-l=xy]").transition(t).attr("d", seg(v => (v - r.xy.b) / r.xy.a));
      lignes.select("[data-l=mayer]").transition(t).attr("d", seg(v => r.mayer.a * v + r.mayer.b));
      afficherLignes();
      const pts = D.serie_double[loc.per];
      points.selectAll("circle").data(pts, d => d.id).join(
        en => en.append("circle").attr("r", 4.5).attr("class", "dot-ring").style("fill", "var(--ink-2)").attr("cx", d => x(d.x)).attr("cy", d => y(d.y)).style("opacity", 0).call(e => e.transition(t).style("opacity", 0.75)),
        up => up.call(u => u.transition(t).attr("cx", d => x(d.x)).attr("cy", d => y(d.y)).style("opacity", 0.75)),
        ex => ex.call(e => e.transition(t).style("opacity", 0).remove()));
      // point moyen G et points moyens G1, G2 (Mayer)
      gpts.selectAll("*").remove();
      const tg = gpts.append("g").style("opacity", 0);
      tg.transition().delay(dur).duration(250).style("opacity", 1);
      const montrerMayer = document.getElementById("nu-mayer").checked;
      if (montrerMayer) for (const [lab, p] of [["G1", r.mayer.g1], ["G2", r.mayer.g2]]) {
        tg.append("circle").attr("class", "g-sub").attr("cx", x(p[0])).attr("cy", y(p[1])).attr("r", 6);
        tg.append("text").attr("class", "label-strong halo").attr("x", x(p[0]) + 10).attr("y", y(p[1]) + 18).text(lab);
      }
      tg.append("circle").attr("class", "g-point").attr("cx", x(r.moy_x)).attr("cy", y(r.moy_y)).attr("r", 7);
      tg.append("text").attr("class", "label-strong halo").attr("x", x(r.moy_x) - 12).attr("y", y(r.moy_y) - 10).attr("text-anchor", "end").text("G (point moyen)");
      // survol au point le plus proche
      const delaunay = d3.Delaunay.from(pts, d => x(d.x), d => y(d.y));
      svg.selectAll("rect.hit").remove();
      svg.append("rect").attr("class", "hit").attr("x", m.l).attr("y", m.t).attr("width", W - m.l - m.r).attr("height", H - m.t - m.b)
        .on("pointermove", e => {
          const [mx, my] = d3.pointer(e), d = pts[delaunay.find(mx, my)];
          if (Math.hypot(x(d.x) - mx, y(d.y) - my) > 24) { hideTip(); points.selectAll("circle").style("opacity", 0.75); return; }
          const s = stationsById.get(d.id);
          points.selectAll("circle").style("opacity", c => (c.id === d.id ? 1 : 0.3));
          const yh = r.yx.a * d.x + r.yx.b;
          showTip(e, s.nom, [{ key: "x : gazole", val: fmt.prix(d.x), sw: "carre g" }, { key: "y : SP95", val: fmt.prix(d.y), sw: "rond s" },
            { key: "y estimé (y en x)", val: fmt.prix(yh) }, { key: "Résidu", val: fmt.cts((d.y - yh) * 100) }], `${s.commune} · ${nomMarque(s.marque)}`);
        })
        .on("pointerleave", () => { hideTip(); points.selectAll("circle").style("opacity", 0.75); });
      panneau();
    }
    function afficherLignes() {
      for (const l of ["yx", "xy", "mayer"]) lignes.select(`[data-l=${l}]`).style("display", document.getElementById("nu-" + l).checked ? null : "none");
    }
    function panneau() {
      const r = reg();
      const sg = v => (v < 0 ? "− " + dec(-v, 3) : "+ " + dec(v, 3));
      const items = [
        ["Point moyen G", `x̄ = ${dec(r.moy_x)} ; ȳ = ${dec(r.moy_y)}`, null],
        ["Écarts-types", `σ(x) = ${dec(r.et_x, 4)} ; σ(y) = ${dec(r.et_y, 4)}`, null],
        ["Covariance", `cov(x, y) = ${dec(r.cov, 6)}`, null],
        ["Corrélation", `r = ${dec(r.r, 3)} ; r² = ${dec(r.r2, 3)}`, null],
        ["Moindres carrés de y en x", `y = ${dec(r.yx.a, 3)}x ${sg(r.yx.b)}`, "var(--ink)"],
        ["Moindres carrés de x en y", `x = ${dec(r.xy.a, 3)}y ${sg(r.xy.b)}, soit y = ${dec(r.xy.a_en_y, 3)}x ${sg(r.xy.b_en_y)}`, "var(--cat-2)"],
        ["Droite de Mayer (G1, G2)", `y = ${dec(r.mayer.a, 3)}x ${sg(r.mayer.b)} (2 nuages de ${r.mayer.n1} et ${r.mayer.n2} stations)`, "var(--cat-1)"]
      ];
      panel.replaceChildren(...items.map(([k, v, c]) => {
        const d = AP.el("div", "reg-item"); const kk = AP.el("div", "k");
        if (c) { const s = AP.el("span", "key key-line"); s.style.background = c; kk.appendChild(s); }
        kk.appendChild(document.createTextNode(k));
        d.append(kk, AP.el("div", "eq", v)); return d;
      }));
      const n = AP.el("p", "ctl-label");
      n.style.gridColumn = "1 / -1";
      n.textContent = `${r.n} stations. Avec r = ${dec(r.r, 3)}, ${r.r > 0.95 ? "l'ajustement affine est pleinement justifié : les trois droites sont presque confondues" : "la liaison reste forte mais plus lâche qu'avant la crise : les droites s'écartent davantage"}.`;
      panel.appendChild(n);
    }
    function animerEntree() {
      points.selectAll("circle").attr("cy", y(y.domain()[0])).style("opacity", 0)
        .transition().duration(900).delay((d, i) => i * 6).ease(d3.easeCubicOut).attr("cy", d => y(d.y)).style("opacity", 0.75);
      lignes.selectAll("path").each(function () {
        const L = this.getTotalLength();
        d3.select(this).attr("stroke-dasharray", `${L} ${L}`).attr("stroke-dashoffset", L).transition().delay(900).duration(900).attr("stroke-dashoffset", 0)
          .on("end", function () { d3.select(this).attr("stroke-dasharray", null); });
      });
    }
    construire();
    segmente(document.getElementById("nu-per"), v => { loc.per = v; maj(true); });
    ["yx", "xy"].forEach(l => document.getElementById("nu-" + l).addEventListener("change", afficherLignes));
    document.getElementById("nu-mayer").addEventListener("change", () => maj(false));
    surRedimension(box, construire);
    document.addEventListener("themechange", construire);
    premiereVue(box, animerEntree);
    equiperCarte(carte, {
      titre: "Prix moyen du SP95 en fonction du prix moyen du gazole par station",
      colonnes: [{ t: "Station" }, { t: "Commune" }, { t: "x : gazole (€/L)", n: 1 }, { t: "y : SP95 (€/L)", n: 1 }],
      lignes: () => D.serie_double[loc.per].map(d => { const s = stationsById.get(d.id); return [s.nom, s.commune, dec(d.x, 4), dec(d.y, 4)]; })
    });
  }

  /* ---------- calendrier des changements de prix ---------- */
  function calendrier() {
    const box = document.getElementById("calendrier"), carte = document.getElementById("carte-calendrier");
    const loc = { k: "g" };
    function construire() {
      box.replaceChildren();
      const vals = D.changements[loc.k];
      const max = d3.max(vals);
      const sombre = getComputedStyle(document.documentElement).colorScheme === "dark" || document.documentElement.dataset.theme === "dark";
      const rampe = ["#cde2fb", "#86b6ef", "#3987e5", "#1c5cab", "#0d366b"];
      const col = d3.scaleSequential(d3.interpolateRgbBasis(sombre ? rampe.slice().reverse() : rampe)).domain([1, max]);
      // une ligne de calendrier par année si la période ne tient pas en largeur
      const W = box.clientWidth;
      const m = { t: 40, r: 8, b: 8, l: 34 };
      const annees = Array.from(new Set(jours.map(d => d.getFullYear())));
      const debutAnnee = a => d3.timeMonday.floor(a === annees[0] ? jours[0] : new Date(a, 0, 1));
      const semTotal = d3.timeMonday.count(d3.timeMonday.floor(jours[0]), jours[N - 1]) + 1;
      const parAn = (W - m.l - m.r) / semTotal < 9;
      const blocs = parAn ? annees : [annees[0]];
      const nbSem = parAn ? d3.max(annees, a => d3.timeMonday.count(debutAnnee(a), a === annees[annees.length - 1] ? jours[N - 1] : new Date(a, 11, 31)) + 1) : semTotal;
      const c = Math.max(6, Math.min(16, Math.floor((W - m.l - m.r) / nbSem)));
      const hBloc = c * 7 + 34;
      const H = m.t + m.b + c * 7 + (blocs.length - 1) * hBloc;
      const svg = d3.select(box).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
      const bloc = i => (parAn ? annees.indexOf(jours[i].getFullYear()) : 0);
      const pos = i => {
        const b = bloc(i), origine = parAn ? debutAnnee(annees[b]) : d3.timeMonday.floor(jours[0]);
        return { x: m.l + d3.timeMonday.count(origine, jours[i]) * c, y: m.t + b * hBloc + ((jours[i].getDay() + 6) % 7) * c };
      };
      svg.append("g").selectAll("rect").data(d3.range(N)).join("rect").attr("class", i => "cell" + (vals[i] ? "" : " empty"))
        .attr("x", i => pos(i).x).attr("y", i => pos(i).y).attr("width", c - 2).attr("height", c - 2).attr("rx", 2)
        .style("fill", i => (vals[i] ? col(vals[i]) : null))
        .on("pointerenter pointermove", (e, i) => showTip(e, fmt.jour(jours[i]).trim(), [{ key: "Stations qui changent leur prix", val: String(vals[i]) }], carb[loc.k].nom))
        .on("pointerleave", hideTip);
      blocs.forEach((a, b) => ["lun.", "mer.", "ven.", "dim."].forEach((t, j) => svg.append("text").attr("class", "tick-label").attr("x", m.l - 6)
        .attr("y", m.t + b * hBloc + [0, 2, 4, 6][j] * c + c * 0.7).attr("text-anchor", "end").text(t)));
      // mois sur une ligne, année au-dessus (premier mois affiché et janvier)
      d3.range(N).filter(i => jours[i].getDate() === 1 || i === 0).forEach(i => {
        const { x: px } = pos(i), y0 = m.t + bloc(i) * hBloc;
        if (i === 0 || jours[i].getMonth() === 0 || (parAn && jours[i - 1] && jours[i - 1].getFullYear() !== jours[i].getFullYear()))
          svg.append("text").attr("class", "tick-label").attr("x", px).attr("y", y0 - 22).style("font-weight", 600).text(jours[i].getFullYear());
        if (c * 4 < 30 && jours[i].getMonth() % 2) return;
        svg.append("text").attr("class", "tick-label").attr("x", px).attr("y", y0 - 8).text(fmt.moisSeul(jours[i]));
      });
      const imax = vals.indexOf(max), p = pos(imax);
      svg.append("rect").attr("x", p.x - 2).attr("y", p.y - 2).attr("width", c + 2).attr("height", c + 2).attr("rx", 3).attr("fill", "none").attr("stroke", "var(--ink)").attr("stroke-width", 2);
      const leg = document.getElementById("ca-legende");
      leg.replaceChildren(AP.el("span", null, "1 station"), Object.assign(AP.el("span", "ramp"), {}), AP.el("span", null, max + " stations"));
      leg.children[1].style.background = `linear-gradient(90deg, ${d3.range(0, 1.01, 0.25).map(t => col(1 + t * (max - 1))).join(",")})`;
      const note = AP.el("p", "ctl-label");
      note.style.marginTop = "8px";
      note.textContent = `Record : ${max} stations le ${fmt.jour(jours[imax]).trim()} (case encadrée). ${loc.k === "g" ? fmt.n(I.nb_chg_gazole) : fmt.n(I.nb_chg_sp95)} changements de prix au total sur la période.`;
      box.appendChild(note);
    }
    construire();
    segmente(document.getElementById("ca-carb"), v => { loc.k = v; construire(); });
    surRedimension(box, construire);
    document.addEventListener("themechange", construire);
    equiperCarte(carte, {
      titre: "Calendrier des changements de prix",
      colonnes: [{ t: "Jour" }, { t: "Stations qui changent leur prix", n: 1 }],
      lignes: () => d3.range(N).filter(i => D.changements[loc.k][i] > 0).sort((a, b) => D.changements[loc.k][b] - D.changements[loc.k][a]).slice(0, 40)
        .map(i => [fmt.jour(jours[i]).trim(), String(D.changements[loc.k][i])])
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    etapes();
    tableau();
    boites();
    nuage();
    calendrier();
  });
})();
