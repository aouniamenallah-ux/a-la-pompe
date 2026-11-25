/* =====================================================================
   À la pompe — page « Stations & carte »
   Carte animée + histogramme synchronisés, enseignes, intercommunalités,
   calculateur de plein et annuaire des stations
   ===================================================================== */
(function () {
  "use strict";
  const { D, fmt, parseJour, jours, N, carb, panel, stationsById, showTip, hideTip, equiperCarte, surRedimension, segmente,
    barreV, css, reduit, couleurMarque, nomMarque, ICON } = AP;
  const G = window.CORSE_GEO;
  const P = { g: panel("g"), s: panel("s") };

  /* ---------- état partagé (carburant, jour, station survolée) ---------- */
  const etat = { k: "g", i: N - 1, chaud: null, joue: false };
  const abonnes = [];
  const surChange = fn => abonnes.push(fn);
  const notifier = quoi => abonnes.forEach(fn => fn(quoi));

  /* statistiques du jour i pour le carburant k */
  function statsJour(k, i) {
    const vals = [];
    for (const s of D.stations) { const v = P[k].get(s.id)[i]; if (!isNaN(v)) vals.push({ s, v }); }
    const tri = vals.map(d => d.v).sort(d3.ascending);
    const min = vals.reduce((a, b) => (b.v < a.v ? b : a)), max = vals.reduce((a, b) => (b.v > a.v ? b : a));
    return { vals, n: vals.length, med: d3.quantileSorted(tri, 0.5), q1: d3.quantileSorted(tri, 0.25), q3: d3.quantileSorted(tri, 0.75), moy: d3.mean(tri), min, max };
  }
  let S = statsJour(etat.k, etat.i);

  /* échelle divergente : écart au prix médian du jour (bleu = moins cher, rouge = plus cher) */
  let couleur;
  function construireCouleur() {
    couleur = d3.scaleDiverging(d3.piecewise(d3.interpolateLab, [css("--moins"), css("--neutre"), css("--plus")])).domain([-0.1, 0, 0.1]).clamp(true);
    const ramp = document.getElementById("ramp");
    ramp.style.background = `linear-gradient(90deg, ${d3.range(0, 1.01, 0.1).map(t => couleur(-0.1 + 0.2 * t)).join(",")})`;
  }
  construireCouleur();

  /* ---------- lecteur : bouton lecture/pause + curseur de date ---------- */
  function lecteur() {
    const btn = document.getElementById("play"), range = document.getElementById("jour"), out = document.getElementById("jour-out");
    range.max = N - 1; range.value = etat.i;
    let timer = null;
    const icone = () => {
      btn.innerHTML = etat.joue ? ICON.pause : ICON.play;
      btn.setAttribute("aria-label", etat.joue ? "Mettre l'animation en pause" : "Lancer l'animation jour par jour");
    };
    const aller = i => {
      etat.i = i; range.value = i;
      out.textContent = fmt.jour(jours[i]).trim();
      S = statsJour(etat.k, etat.i);
      notifier("jour");
    };
    const stop = () => { if (timer) timer.stop(); timer = null; etat.joue = false; icone(); };
    btn.addEventListener("click", () => {
      if (etat.joue) return stop();
      if (etat.i >= N - 1) aller(0);
      etat.joue = true; icone();
      timer = d3.interval(() => { if (etat.i >= N - 1) return stop(); aller(etat.i + 1); }, reduit() ? 250 : 60);
    });
    range.addEventListener("input", () => { stop(); aller(+range.value); });
    icone();
    out.textContent = fmt.jour(jours[etat.i]).trim();
    segmente(document.getElementById("exp-carb"), v => { etat.k = v; S = statsJour(etat.k, etat.i); notifier("carburant"); });
  }

  /* ---------- carte des stations ---------- */
  function carte() {
    const box = document.getElementById("carte");
    // [nom, latitude, longitude, décalage x, décalage y, ancrage] : étiquettes placées à côté des points, hors de la côte
    const villes = [["Bastia", 42.6977, 9.4508, 12, 4, "start"], ["Ajaccio", 41.9192, 8.7386, -14, 4, "end"], ["Porto-Vecchio", 41.5911, 9.2795, 12, 4, "start"],
      ["Calvi", 42.5675, 8.7575, -12, -2, "end"], ["Corte", 42.3061, 9.1497, 12, 4, "start"], ["Bonifacio", 41.3874, 9.1594, 12, 6, "start"],
      ["L'Île-Rousse", 42.6347, 8.9378, 0, -14, "middle"], ["Propriano", 41.6758, 8.9036, -12, 4, "end"],
      ["Ghisonaccia", 42.0153, 9.4053, 12, 4, "start"], ["Saint-Florent", 42.6814, 9.3036, -10, -10, "end"]];
    let pts, dots, halo, delaunay;
    function construire() {
      box.replaceChildren();
      const W = box.clientWidth, H = Math.round(Math.min(660, Math.max(440, W * 1.3)));
      const proj = d3.geoMercator().fitExtent([[14, 14], [W - 14, H - 14]], G.contour);
      const path = d3.geoPath(proj);
      const svg = d3.select(box).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
      svg.append("g").selectAll("path").data(G.communes.features).join("path").attr("class", "commune").attr("d", path);
      svg.append("g").selectAll("path").data(G.departements.features).join("path").attr("class", "dep-line").attr("d", path);
      svg.append("text").attr("class", "label-muted").attr("x", W - 16).attr("y", 26).attr("text-anchor", "end").text("Haute-Corse (2B)");
      svg.append("text").attr("class", "label-muted").attr("x", 16).attr("y", H - 18).text("Corse-du-Sud (2A)");
      pts = D.stations.map(s => { const [x, y] = proj([s.lon, s.lat]); return { s, x, y }; });
      halo = svg.append("circle").attr("r", 13).attr("fill", "none").attr("stroke", css("--ink")).attr("stroke-width", 2).style("display", "none").attr("pointer-events", "none");
      dots = svg.append("g").selectAll("circle").data(pts).join("circle").attr("class", "station").attr("cx", d => d.x).attr("cy", d => d.y).attr("r", 5.5);
      delaunay = d3.Delaunay.from(pts, d => d.x, d => d.y);
      const gv = svg.append("g").attr("pointer-events", "none");
      gv.selectAll("text").data(villes).join("text").attr("class", "label halo")
        .attr("x", d => proj([d[2], d[1]])[0] + d[3]).attr("y", d => proj([d[2], d[1]])[1] + d[4]).attr("text-anchor", d => d[5]).text(d => d[0]);
      svg.append("rect").attr("class", "hit").attr("width", W).attr("height", H)
        .on("pointermove", e => {
          const [mx, my] = d3.pointer(e), d = pts[delaunay.find(mx, my)];
          if (Math.hypot(d.x - mx, d.y - my) < 20) { etat.chaud = d.s.id; notifier("chaud"); infobulle(e, d.s); }
          else if (etat.chaud) { etat.chaud = null; notifier("chaud"); hideTip(); }
        })
        .on("pointerleave", () => { etat.chaud = null; notifier("chaud"); hideTip(); });
      maj("tout");
    }
    function maj(quoi) {
      if (quoi === "chaud") {
        const p = pts.find(d => d.s.id === etat.chaud);
        halo.style("display", p ? null : "none");
        if (p) halo.attr("cx", p.x).attr("cy", p.y);
        dots.classed("is-hot", d => d.s.id === etat.chaud);
        return;
      }
      dots.each(function (d) {
        const v = P[etat.k].get(d.s.id)[etat.i];
        const c = d3.select(this);
        if (isNaN(v)) c.attr("r", 3.5).style("fill", "none").style("stroke", css("--axis"));
        else c.attr("r", 5.5).style("fill", couleur(v - S.med)).style("stroke", null);
      });
    }
    construire();
    surChange(maj);
    surRedimension(box, construire);
    return { construire };
  }

  function infobulle(e, s) {
    const v = P[etat.k].get(s.id)[etat.i];
    const pts = D.series[etat.k][s.id] || [];
    let depuis = null;
    for (const [j] of pts) if (j <= etat.i) depuis = j;
    showTip(e, s.nom, isNaN(v) ? [{ key: carb[etat.k].nom, val: "pas de prix ce jour" }] : [
      { key: carb[etat.k].nom, val: fmt.prix(v), sw: (etat.k === "g" ? "carre g" : "rond s") },
      { key: "Écart à la médiane", val: fmt.cts((v - S.med) * 100) },
      { key: "Plein de " + litres() + " L", val: fmt.eur(v * litres()) },
      { key: "Prix inchangé depuis le", val: depuis != null ? fmt.jourC(jours[depuis]) : "–" }
    ], `${s.commune} · ${nomMarque(s.marque)}`);
  }
  const litres = () => +(document.getElementById("litres")?.value || 50);

  /* ---------- histogramme des prix du jour ---------- */
  function histogramme() {
    const box = document.getElementById("essaim");
    const dom = {}, maxN = {};
    for (const k of ["g", "s"]) { // bornes fixes sur toute la période pour que l'animation reste lisible
      dom[k] = [Math.floor(d3.min(D.quotidien[k].min) * 20) / 20, Math.ceil(d3.max(D.quotidien[k].max) * 20) / 20 + 0.01];
      let mx = 0;
      for (let i = 0; i < N; i++) {
        const c = new Map();
        for (const s of D.stations) { const v = P[k].get(s.id)[i]; if (!isNaN(v)) { const b = Math.floor(v * 100 + 1e-6); c.set(b, (c.get(b) || 0) + 1); } }
        for (const n of c.values()) mx = Math.max(mx, n);
      }
      maxN[k] = mx;
    }
    let svg, x, y, W, H, m, gBar, gBox, gAx, gAy, gLab, gHit;
    function construire() {
      box.replaceChildren();
      W = box.clientWidth; H = Math.round(Math.max(260, Math.min(330, W * 0.55)));
      m = { t: 52, r: 14, b: 34, l: 40 };
      svg = d3.select(box).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
      gBox = svg.append("g"); gAy = svg.append("g").attr("class", "grid"); gAx = svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`);
      gBar = svg.append("g"); gLab = svg.append("g"); gHit = svg.append("g");
      svg.append("text").attr("class", "axis-title").attr("x", m.l).attr("y", 16).text("Nombre de stations par tranche de 1 centime");
      svg.append("text").attr("class", "label-muted").attr("x", m.l).attr("y", 33).text(W < 520 ? "Zone grise : moitié centrale (Q1 à Q3)" : "Zone grise : moitié centrale des stations (du 1er au 3e quartile)");
      maj("carburant");
    }
    function maj(quoi) {
      if (quoi === "chaud") {
        const v = etat.chaud ? P[etat.k].get(etat.chaud)[etat.i] : NaN;
        const b = isNaN(v) ? null : Math.floor(v * 100 + 1e-6);
        gBar.selectAll("path").style("opacity", d => (b == null || d.b === b ? 1 : 0.35));
        return;
      }
      const k = etat.k;
      x = d3.scaleLinear().domain(dom[k]).range([m.l, W - m.r]);
      y = d3.scaleLinear().domain([0, maxN[k]]).nice().range([H - m.b, m.t]);
      gAx.call(d3.axisBottom(x).ticks(W < 480 ? 5 : 8).tickFormat(v => fmt.dec(v, 2) + " €").tickSizeOuter(0));
      gAy.attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickSize(-(W - m.l - m.r)))
        .call(g => g.selectAll("text").attr("class", "tick-label").attr("x", -6)).call(g => g.select(".domain").remove());
      const bins = d3.rollups(S.vals, v => v.map(d => d.s), d => Math.floor(d.v * 100 + 1e-6)).map(([b, st]) => ({ b, st, n: st.length }));
      const bw = Math.max(1.5, x(dom[k][0] + 0.01) - x(dom[k][0]) - 1);
      const dur = etat.joue || quoi === "carburant" || reduit() ? 0 : 250;
      // moitié centrale des stations (Q1 → Q3) et médiane
      gBox.selectAll("rect").data([S]).join("rect").attr("class", "annot-zone").attr("y", m.t - 14).attr("height", H - m.b - m.t + 14)
        .transition().duration(dur).attr("x", d => x(d.q1)).attr("width", d => Math.max(2, x(d.q3 + 0.01) - x(d.q1)));
      gBar.selectAll("path").data(bins, d => d.b).join("path")
        .attr("d", d => barreV(x(d.b / 100) + 0.5, bw, y(0), y(d.n), Math.min(2, bw / 2)))
        .style("fill", d => couleur(d.b / 100 + 0.005 - S.med));
      gLab.selectAll("*").remove();
      const xm = x(S.med + 0.005);
      gLab.append("line").attr("class", "mean-line").attr("x1", xm).attr("x2", xm).attr("y1", m.t - 18).attr("y2", H - m.b);
      const droite = xm < W * 0.6;
      gLab.append("text").attr("class", "label-strong halo").attr("x", xm + (droite ? 6 : -6)).attr("y", m.t - 6).attr("text-anchor", droite ? "start" : "end")
        .text("Médiane : " + fmt.prix(S.med));
      gHit.selectAll("rect").data(bins, d => d.b).join("rect").attr("class", "hit")
        .attr("x", d => x(d.b / 100) - 3).attr("width", bw + 6).attr("y", m.t).attr("height", H - m.t - m.b)
        .on("pointerenter pointermove", (e, d) => {
          gBar.selectAll("path").style("opacity", b => (b.b === d.b ? 1 : 0.35));
          const noms = d.st.slice(0, 6).map(s => ({ key: s.nom.length > 28 ? s.nom.slice(0, 27) + "…" : s.nom, val: s.commune }));
          if (d.n > 6) noms.push({ key: `et ${d.n - 6} autre${d.n > 7 ? "s" : ""}`, val: "" });
          showTip(e, `${d.n} station${d.n > 1 ? "s" : ""} entre ${fmt.dec(d.b / 100, 2)} et ${fmt.dec((d.b + 1) / 100, 2)} €`, noms);
          etat.chaudsGroupe = new Set(d.st.map(s => s.id)); notifier("groupe");
        })
        .on("pointerleave", () => { gBar.selectAll("path").style("opacity", 1); hideTip(); etat.chaudsGroupe = null; notifier("groupe"); });
    }
    construire();
    surChange(q => (q === "groupe" ? null : maj(q)));
    surRedimension(box, construire);
    return { construire };
  }

  /* ---------- chiffres du jour ---------- */
  function chiffresDuJour() {
    const box = document.getElementById("day-stats");
    function maj(q) {
      if (q === "chaud" || q === "groupe") return;
      const L = litres();
      const items = [
        ["Prix médian", fmt.prix(S.med), `${S.n} stations affichent un prix`],
        ["Station la moins chère", fmt.prix(S.min.v), `${S.min.s.nom} (${S.min.s.commune})`],
        ["Station la plus chère", fmt.prix(S.max.v), `${S.max.s.nom} (${S.max.s.commune})`],
        [`Écart sur un plein de ${L} L`, fmt.eur((S.max.v - S.min.v) * L), "entre ces deux stations"]
      ];
      box.replaceChildren(...items.map(([k, v, w]) => {
        const d = AP.el("div", "day-stat");
        d.append(AP.el("div", "k", k), AP.el("div", "v", v), AP.el("div", "w", w));
        d.lastChild.title = w;
        return d;
      }));
    }
    maj();
    surChange(maj);
    return { maj };
  }

  /* la carte relaie aussi le survol d'une tranche de l'histogramme */
  surChange(q => {
    if (q !== "groupe") return;
    d3.selectAll("#carte .station").style("opacity", d => (!etat.chaudsGroupe || etat.chaudsGroupe.has(d.s.id) ? 1 : 0.18));
  });

  /* ---------- prix moyen par enseigne ---------- */
  function marques() {
    const box = document.getElementById("marques"), carteEl = document.getElementById("carte-marques");
    const ens = ["VITO", "TotalEnergies", "ENI"];
    const loc = { k: "g", per: "p2" };
    const series = {};
    for (const k of ["g", "s"]) {
      series[k] = ens.map(mq => {
        const ids = D.stations.filter(s => s.marque === mq).map(s => s.id);
        return { mq, v: d3.range(N).map(i => d3.mean(ids, id => { const v = P[k].get(id)[i]; return isNaN(v) ? undefined : v; })) };
      });
    }
    // plafonds annoncés par TotalEnergies (communiqués de mars à octobre 2026) : 1,99 € l'essence, 2,09 € puis 2,25 € le gazole ;
    // du 1er au 21 juillet, le plafond ne vaut plus que pour les stations rurales (pas de ligne tracée)
    const i13 = D.jours.indexOf("2026-03-13"), i8 = D.jours.indexOf("2026-04-08");
    const jul1 = D.jours.indexOf("2026-07-01"), jul22 = D.jours.indexOf("2026-07-22");
    const actif = i => i >= i13 && !(jul1 >= 0 && i >= jul1 && (jul22 < 0 || i < jul22));
    const plafond = { g: d3.range(N).map(i => (!actif(i) ? null : i < i8 ? 2.09 : 2.25)), s: d3.range(N).map(i => (!actif(i) ? null : 1.99)) };
    let x, y, W, H, m, svg, cross;
    const bis = d3.bisector(d => d);
    function construire() {
      box.replaceChildren();
      W = box.clientWidth; H = Math.round(Math.max(300, Math.min(430, W * 0.46)));
      m = { t: 26, r: W < 640 ? 16 : 120, b: 34, l: 52 };
      const i0 = loc.per === "p2" ? D.jours.indexOf("2026-02-01") : 0;
      x = d3.scaleTime().domain([jours[i0], jours[N - 1]]).range([m.l, W - m.r]);
      const vals = series[loc.k].flatMap(s => s.v.slice(i0)).concat(plafond[loc.k].slice(i0).filter(v => v));
      y = d3.scaleLinear().domain(d3.extent(vals)).nice().range([H - m.b, m.t]);
      svg = d3.select(box).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
      svg.append("g").attr("class", "grid").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(6).tickSize(-(W - m.l - m.r)).tickFormat(""));
      svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(6).tickFormat(v => fmt.dec(v, 2) + " €").tickSize(0).tickPadding(8)).call(g => g.select(".domain").remove());
      svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(W < 640 ? 4 : 8).tickFormat(W < 640 ? fmt.axeMoisCourt : fmt.axeMois).tickSizeOuter(0));
      const ligne = d3.line().defined(v => v != null && !isNaN(v)).x((v, j) => x(jours[i0 + j])).y(v => y(v)).curve(d3.curveStepAfter);
      svg.append("path").attr("class", "ref-line").attr("d", ligne(plafond[loc.k].slice(i0)));
      const lignes = svg.append("g").selectAll("path").data(series[loc.k]).join("path").attr("class", "line")
        .style("stroke", d => couleurMarque(d.mq)).attr("d", d => d3.line().defined(v => v != null).x((v, j) => x(jours[i0 + j])).y(v => y(v))(d.v.slice(i0)));
      // étiquettes directes en fin de courbe, avec rappel si elles se chevauchent
      if (W >= 640) {
        const fins = series[loc.k].map(d => ({ d, v: d.v[N - 1], y: y(d.v[N - 1]) })).sort((a, b) => a.y - b.y);
        for (let j = 1; j < fins.length; j++) fins[j].ly = Math.max(fins[j].y, (fins[j - 1].ly ?? fins[j - 1].y) + 30);
        fins.forEach(f => {
          const ly = f.ly ?? f.y, x0 = W - m.r;
          svg.append("circle").attr("cx", x0).attr("cy", f.y).attr("r", 4).attr("class", "dot-ring").style("fill", couleurMarque(f.d.mq));
          if (Math.abs(ly - f.y) > 1) svg.append("line").attr("class", "annot-line").attr("x1", x0 + 5).attr("y1", f.y).attr("x2", x0 + 11).attr("y2", ly);
          svg.append("text").attr("class", "label-strong").attr("x", x0 + 13).attr("y", ly - 2).text(f.d.mq);
          svg.append("text").attr("class", "label").attr("x", x0 + 13).attr("y", ly + 13).text(fmt.prix(f.v));
        });
      }
      const ip = loc.k === "s" ? i13 + 12 : i8 + 10;
      const etroit = W < 640;
      svg.append("text").attr("class", "label halo").attr("x", etroit ? W - m.r : x(jours[ip])).attr("y", y(plafond[loc.k][ip]) - 8)
        .attr("text-anchor", etroit ? "end" : "start")
        .text(etroit ? "Plafond Total" : (loc.k === "s" ? "Plafond TotalEnergies : 1,99 €" : "Plafond TotalEnergies : 2,09 € puis 2,25 €"));
      // opération « prix unique » de TotalEnergies pendant les ponts de mai 2026 : gazole à 2,09 €
      const iMai = D.jours.indexOf("2026-05-01");
      if (loc.k === "g" && !etroit && iMai >= i0) {
        svg.append("text").attr("class", "label halo").attr("x", x(jours[iMai]) - 4).attr("y", y(2.09) + 22).text("Ponts de mai : 2,09 €");
      }
      cross = svg.append("line").attr("class", "crosshair").attr("y1", m.t).attr("y2", H - m.b).style("display", "none");
      svg.append("rect").attr("class", "hit").attr("x", m.l).attr("y", m.t).attr("width", W - m.l - m.r).attr("height", H - m.t - m.b)
        .on("pointermove", e => {
          const i = Math.max(i0, bis.center(jours, x.invert(d3.pointer(e)[0])));
          cross.style("display", null).attr("x1", x(jours[i])).attr("x2", x(jours[i]));
          lignes.style("opacity", 1);
          showTip(e, fmt.jour(jours[i]).trim(), series[loc.k].map(s => ({ key: s.mq, val: fmt.prix(s.v[i]), sw: "ligne " + couleurMarque(s.mq) }))
            .concat(plafond[loc.k][i] ? [{ key: "Plafond TotalEnergies", val: fmt.prix(plafond[loc.k][i]) }] : []));
        })
        .on("pointerleave", () => { cross.style("display", "none"); hideTip(); });
    }
    construire();
    segmente(document.getElementById("mq-carb"), v => { loc.k = v; construire(); });
    segmente(document.getElementById("mq-per"), v => { loc.per = v; construire(); });
    surRedimension(box, construire);
    equiperCarte(carteEl, {
      titre: "Prix moyen par enseigne en Corse",
      colonnes: [{ t: "Mois" }, ...ens.map(e => ({ t: e + " (€/L)", n: 1 }))],
      lignes: () => d3.groups(d3.range(N), i => D.jours[i].slice(0, 7)).map(([mo, is]) => [fmt.mois(parseJour(mo + "-01")),
        ...series[loc.k].map(s => fmt.dec(d3.mean(is, i => s.v[i]), 3))])
    });
    return { construire };
  }

  /* ---------- écart à la moyenne par intercommunalité ---------- */
  function epci() {
    const box = document.getElementById("epci"), carteEl = document.getElementById("carte-epci");
    const loc = { k: "g", per: "P2" };
    const court = n => n.replace("Communauté d'agglomération", "CA").replace("Communauté de communes", "CC").replace(/^CC de l'/, "CC de l'").replace("Communauté d'Agglomération", "CA");
    function donnees() {
      const comp = D.indicateurs.comparaisons.epci[loc.per][carb[loc.k].nom];
      const moyIle = D.indicateurs.periodes[loc.per][carb[loc.k].nom].moy;
      return Object.entries(comp).filter(([, v]) => v.n >= 2).map(([nom, v]) => ({ nom: court(nom), n: v.n, ecart: (v.moy - moyIle) * 100 }))
        .sort((a, b) => b.ecart - a.ecart);
    }
    function construire() {
      box.replaceChildren();
      const data = donnees();
      const W = box.clientWidth, lh = 30;
      const m = { t: 30, r: 56, b: 30, l: Math.min(300, W * 0.48) };
      const H = m.t + m.b + data.length * lh;
      const lim = Math.max(4, d3.max(data, d => Math.abs(d.ecart)) * 1.1);
      const x = d3.scaleLinear().domain([-lim, lim]).nice().range([m.l, W - m.r]);
      const y = d3.scaleBand().domain(data.map(d => d.nom)).range([m.t, H - m.b]).padding(0.35);
      const svg = d3.select(box).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
      svg.append("g").attr("class", "grid").attr("transform", `translate(0,${m.t})`).call(d3.axisTop(x).ticks(6).tickSize(-(H - m.t - m.b)).tickFormat(""));
      svg.append("g").attr("class", "axis").attr("transform", `translate(0,${m.t})`).call(d3.axisTop(x).ticks(6).tickFormat(v => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v) + " ct").tickSize(0).tickPadding(6)).call(g => g.select(".domain").remove());
      svg.append("line").attr("class", "zero").attr("x1", x(0)).attr("x2", x(0)).attr("y1", m.t).attr("y2", H - m.b);
      svg.append("text").attr("class", "label-muted").attr("x", x(0) + 4).attr("y", H - 10).text("moyenne de la Corse");
      const rows = svg.append("g").selectAll("g").data(data).join("g");
      rows.append("text").attr("class", "label").attr("x", m.l - 12).attr("y", d => y(d.nom) + y.bandwidth() / 2 + 4).attr("text-anchor", "end")
        .text(d => `${d.nom.length > 44 ? d.nom.slice(0, 43) + "…" : d.nom} (${d.n})`);
      const h = Math.min(16, y.bandwidth());
      rows.append("path").style("fill", d => (d.ecart >= 0 ? "var(--plus)" : "var(--moins)"))
        .attr("d", d => {
          const y0 = y(d.nom) + (y.bandwidth() - h) / 2;
          if (d.ecart >= 0) return AP.barreH(x(0), x(d.ecart), y0, h, 3);
          const w = x(0) - x(d.ecart), r = Math.min(3, w, h / 2); // barre vers la gauche : arrondi à gauche
          return w <= 0 ? "" : `M${x(0)},${y0}H${x(d.ecart) + r}A${r},${r} 0 0 0 ${x(d.ecart)},${y0 + r}V${y0 + h - r}A${r},${r} 0 0 0 ${x(d.ecart) + r},${y0 + h}H${x(0)}Z`;
        });
      rows.append("text").attr("class", "label-strong").attr("y", d => y(d.nom) + y.bandwidth() / 2 + 4)
        .attr("x", d => (d.ecart >= 0 ? x(d.ecart) + 6 : x(d.ecart) - 6)).attr("text-anchor", d => (d.ecart >= 0 ? "start" : "end"))
        .text(d => fmt.cts(d.ecart));
    }
    construire();
    segmente(document.getElementById("ep-carb"), v => { loc.k = v; construire(); });
    segmente(document.getElementById("ep-per"), v => { loc.per = v; construire(); });
    surRedimension(box, construire);
    document.addEventListener("themechange", construire);
    equiperCarte(carteEl, {
      titre: "Écart à la moyenne de la Corse par intercommunalité",
      colonnes: [{ t: "Intercommunalité" }, { t: "Stations", n: 1 }, { t: "Écart (ct/L)", n: 1 }],
      lignes: () => donnees().map(d => [d.nom, String(d.n), fmt.cts(d.ecart)])
    });
  }

  /* ---------- calculateur de plein ---------- */
  function calculateur() {
    const r = document.getElementById("litres"), out = document.getElementById("litres-out");
    const box = document.getElementById("calc-out"), ctx = document.getElementById("calc-contexte");
    function maj(q) {
      if (q === "chaud" || q === "groupe") return;
      const L = +r.value;
      out.textContent = L + " litres";
      ctx.textContent = `${carb[etat.k].nom} · ${fmt.jour(jours[etat.i]).trim()} · ${S.n} stations`;
      const lignes = [["La moins chère", S.min.v, "cheap", S.min.s], ["Prix médian", S.med, "", null], ["La plus chère", S.max.v, "dear", S.max.s]];
      const xmax = S.max.v * L;
      box.replaceChildren(...lignes.map(([lab, v, cls, s]) => {
        const l = AP.el("div", "calc-line " + cls);
        const t = AP.el("span", null, lab);
        if (s) t.title = `${s.nom} (${s.commune})`;
        const barWrap = AP.el("div"); const bar = AP.el("div", "bar"); bar.style.width = (100 * (v * L) / xmax) + "%"; barWrap.appendChild(bar);
        l.append(t, barWrap, AP.el("span", "eur", fmt.eur(v * L)));
        return l;
      }));
      const save = AP.el("div", "calc-save");
      const st = AP.el("strong", null, fmt.eur((S.max.v - S.min.v) * L));
      save.append(document.createTextNode("Économie possible sur ce plein : "), st,
        AP.el("div", "w", `en choisissant ${S.min.s.nom} (${S.min.s.commune}) plutôt que ${S.max.s.nom} (${S.max.s.commune}).`));
      box.appendChild(save);
    }
    r.addEventListener("input", () => { maj(); notifier("litres"); });
    surChange(maj);
    maj();
  }

  /* ---------- annuaire des stations (tri + recherche) ---------- */
  function annuaire() {
    const tb = document.querySelector("#table-stations tbody"), q = document.getElementById("recherche");
    const note = document.getElementById("table-note");
    const tri = { col: "g", sens: 1 };
    function lignes() {
      const f = q.value.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      return D.stations.map(s => ({ s, g: P.g.get(s.id)[etat.i], sp: P.s.get(s.id)[etat.i] }))
        .filter(r => !f || (r.s.nom + " " + r.s.commune + " " + r.s.marque).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(f));
    }
    function rendre() {
      const L = lignes();
      const val = r => ({ nom: r.s.nom, commune: r.s.commune, marque: r.s.marque, g: r.g, s: r.sp, chg: r.s.chgG })[tri.col];
      L.sort((a, b) => {
        const va = val(a), vb = val(b);
        if (typeof va === "number" || typeof vb === "number") {
          if (isNaN(va)) return 1; if (isNaN(vb)) return -1;
          return (va - vb) * tri.sens;
        }
        return String(va).localeCompare(String(vb), "fr") * tri.sens;
      });
      tb.replaceChildren(...L.map(r => {
        const tr = AP.el("tr");
        tr.append(AP.el("td", null, r.s.nom), AP.el("td", null, r.s.commune), AP.el("td", null, nomMarque(r.s.marque)),
          AP.el("td", "n", fmt.prix(r.g)), AP.el("td", "n", fmt.prix(r.sp)), AP.el("td", "n", String(r.s.chgG)));
        tr.addEventListener("pointerenter", () => { etat.chaud = r.s.id; notifier("chaud"); });
        tr.addEventListener("pointerleave", () => { etat.chaud = null; notifier("chaud"); });
        return tr;
      }));
      note.textContent = `${L.length} station${L.length > 1 ? "s" : ""} · prix du ${fmt.jour(jours[etat.i]).trim()} · « Changements de prix » = nombre de jours où le prix du gazole a changé, sur toute la période.`;
    }
    document.querySelectorAll("#table-stations th").forEach(th => th.querySelector("button").addEventListener("click", () => {
      const col = th.dataset.col;
      tri.sens = tri.col === col ? -tri.sens : 1; tri.col = col;
      document.querySelectorAll("#table-stations th").forEach(h => h.removeAttribute("aria-sort"));
      th.setAttribute("aria-sort", tri.sens === 1 ? "ascending" : "descending");
      rendre();
    }));
    q.addEventListener("input", rendre);
    let t = null;
    surChange(quoi => { if (quoi === "jour" || quoi === "carburant") { clearTimeout(t); t = setTimeout(rendre, etat.joue ? 400 : 0); } });
    rendre();
  }

  document.addEventListener("DOMContentLoaded", () => {
    lecteur();
    const c = carte();
    const h = histogramme();
    chiffresDuJour();
    marques();
    epci();
    calculateur();
    annuaire();
    document.addEventListener("themechange", () => { construireCouleur(); c.construire(); h.construire(); });
    equiperCarte(document.getElementById("carte-explorer"), {
      titre: "Prix des stations corses le jour choisi",
      colonnes: [{ t: "Station" }, { t: "Commune" }, { t: "Enseigne" }, { t: "Prix (€/L)", n: 1 }, { t: "Écart à la médiane", n: 1 }],
      lignes: () => S.vals.slice().sort((a, b) => a.v - b.v).map(d => [d.s.nom, d.s.commune, nomMarque(d.s.marque), fmt.dec(d.v, 3), fmt.cts((d.v - S.med) * 100)])
    });
  });
})();
