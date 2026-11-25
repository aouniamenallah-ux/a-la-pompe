/* =====================================================================
   Atelier des visuels de communication — À la pompe
   Construit en SVG (D3.js) l'affiche A3, le carrousel Instagram, la bannière
   web et la story animée, à partir des mêmes données que le site.
   Format choisi par l'ancre de l'URL : #affiche, #insta1, #insta2, #insta3,
   #banniere, #story (la story expose window.renderAt(t) pour l'export vidéo).
   ===================================================================== */
(function () {
  "use strict";
  const { D, fmt, parseJour, jours, N, panel } = AP;
  const Q = D.quotidien, I = D.indicateurs;
  const C = {
    bg: "#1b1f23", panel: "#0c0e10", bord: "#2f353b", ink: "#f2f3ef", ink2: "#b9bfc4", muted: "#8b939a",
    mark: "#f2b705", ledG: "#ffc23a", ledS: "#4ee28e", moins: "#4a8fe0", neutre: "#5d6369", plus: "#e0574b", grille: "#30363c"
  };
  const NS = "http://www.w3.org/2000/svg";
  const FONT_CSS = [["Barlow", 400, "barlow-latin-400-normal"], ["Barlow", 500, "barlow-latin-500-normal"], ["Barlow", 600, "barlow-latin-600-normal"],
    ["Barlow", 700, "barlow-latin-700-normal"], ["Barlow Condensed", 600, "barlow-condensed-latin-600-normal"], ["Barlow Condensed", 700, "barlow-condensed-latin-700-normal"],
    ["Barlow Condensed", 800, "barlow-condensed-latin-800-normal"], ["DSEG7 Classic", 700, "DSEG7Classic-Bold"]]
    .map(([f, w, file]) => `@font-face{font-family:"${f}";font-weight:${w};src:url("../fonts/${file}.woff2") format("woff2");}`).join("");
  const idx = s => D.jours.indexOf(s);
  const dPic = parseJour(I.gazole_date_pic), dVeille = d3.timeDay.offset(parseJour(I.debut_crise), -1);
  const DUREE_HAUSSE = fmt.duree(dVeille, dPic);                       // « sept mois »
  const PERIODE = "avril 2025 – " + fmt.mois(jours[N - 1]);           // « avril 2025 – novembre 2026 »
  const sansAnnee = d => fmt.jourCourt(d).trim().replace(/ \d{4}$/, ""); // « 27 sept. »
  const COND = '"Barlow Condensed", "Arial Narrow", sans-serif', BODY = 'Barlow, "Segoe UI", sans-serif', LED = '"DSEG7 Classic", monospace';

  function doc(W, H) {
    const host = d3.select("#scene");
    host.selectAll("*").remove();
    const svg = host.append("svg").attr("xmlns", NS).attr("width", W).attr("height", H).attr("viewBox", `0 0 ${W} ${H}`);
    svg.append("rect").attr("width", W).attr("height", H).attr("fill", C.bg);
    return svg;
  }
  /* texte : lignes multiples possibles, [x, y] = ligne de base de la première ligne */
  function texte(g, x, y, lignes, o = {}) {
    const t = g.append("text").attr("x", x).attr("y", y)
      .attr("font-family", o.f || BODY).attr("font-weight", o.w || 400).attr("font-size", o.s || 24)
      .attr("fill", o.c || C.ink).attr("text-anchor", o.a || "start");
    if (o.ls) t.attr("letter-spacing", o.ls);
    [].concat(lignes).forEach((l, i) => {
      const ts = t.append("tspan").attr("x", x).attr("dy", i === 0 ? 0 : (o.lh || 1.15) * (o.s || 24));
      if (Array.isArray(l)) l.forEach(([s, col]) => ts.append("tspan").attr("fill", col || null).text(s));
      else ts.text(l);
    });
    return t;
  }
  function logo(g, x, y, k = 1, couleurTexte = C.ink) {
    const l = g.append("g").attr("transform", `translate(${x},${y}) scale(${k})`);
    l.append("rect").attr("x", 5).attr("y", 4).attr("width", 14).attr("height", 23).attr("rx", 2.5).attr("fill", C.mark);
    l.append("rect").attr("x", 8).attr("y", 7.5).attr("width", 8).attr("height", 6).attr("rx", 1).attr("fill", C.bg);
    l.append("rect").attr("x", 3).attr("y", 26).attr("width", 18).attr("height", 3).attr("rx", 1).attr("fill", C.mark);
    l.append("path").attr("d", "M19 10.5h3a2 2 0 0 1 2 2v9a1.75 1.75 0 0 0 3.5 0v-9.5l-3-3.5").attr("fill", "none").attr("stroke", C.mark)
      .attr("stroke-width", 2.2).attr("stroke-linecap", "round").attr("stroke-linejoin", "round");
    texte(l, 38, 25, [[["À la ", couleurTexte], ["pompe", C.mark]]], { f: COND, w: 800, s: 27 });
    return l;
  }
  function marquage(g, x0, x1, y, h = 8, tiret = 56, vide = 38) { // ligne de marquage routier en pointillé
    g.append("line").attr("x1", x0).attr("x2", x1).attr("y1", y).attr("y2", y).attr("stroke", C.mark).attr("stroke-width", h).attr("stroke-dasharray", `${tiret} ${vide}`);
  }
  /* totem de station : panneau, en-tête, prix en chiffres LED, mât */
  function totem(g, x, y, w, o) {
    const t = g.append("g").attr("transform", `translate(${x},${y})`);
    const h = o.h || w * 0.62;
    t.append("rect").attr("width", w).attr("height", h).attr("rx", 16).attr("fill", C.panel).attr("stroke", C.bord).attr("stroke-width", 3);
    texte(t, 24, 46, o.titre, { f: COND, w: 700, s: o.ts || 26, c: o.couleurTitre || C.ink2, ls: "0.1em" });
    if (o.badge) {
      const b = t.append("g").attr("transform", `translate(${w - 24 - 46},${16})`);
      if (o.badge === "B7") b.append("rect").attr("width", 46).attr("height", 46).attr("rx", 4).attr("fill", C.ledG);
      else b.append("circle").attr("cx", 23).attr("cy", 23).attr("r", 23).attr("fill", "#23a35a");
      texte(b, 23, 31, o.badge, { f: COND, w: 800, s: 22, c: o.badge === "B7" ? C.panel : "#fff", a: "middle" });
    }
    t.append("line").attr("x1", 18).attr("x2", w - 18).attr("y1", 78).attr("y2", 78).attr("stroke", "#262b30").attr("stroke-width", 2);
    const ps = o.ps || w * 0.24;
    texte(t, 24, 78 + (h - 78) / 2 + ps * 0.42, "8.888", { f: LED, w: 700, s: ps, c: "rgba(255,255,255,0.06)" });
    const prix = texte(t, 24, 78 + (h - 78) / 2 + ps * 0.42, o.prix, { f: LED, w: 700, s: ps, c: o.couleur || C.ledG });
    texte(t, w - 22, 78 + (h - 78) / 2 + ps * 0.42, "€/L", { f: COND, w: 700, s: ps * 0.3, c: C.muted, a: "end" });
    if (o.mat !== false) {
      t.append("rect").attr("x", w / 2 - w * 0.06).attr("y", h).attr("width", w * 0.12).attr("height", o.mat || 60).attr("fill", "#353c42");
      t.append("rect").attr("x", w / 2 - w * 0.2).attr("y", h + (o.mat || 60)).attr("width", w * 0.4).attr("height", 12).attr("rx", 4).attr("fill", "#353c42");
    }
    return { g: t, prix };
  }
  /* courbe du prix moyen sur une plage de dates */
  function courbe(g, x0, y0, w, h, o) {
    const i0 = idx(o.debut), i1 = idx(o.fin);
    const ii = d3.range(i0, i1 + 1);
    const vals = (o.series || ["g"]).flatMap(k => ii.map(i => Q[k].moy[i]));
    const x = d3.scaleTime().domain([jours[i0], jours[i1]]).range([x0, x0 + w]);
    const y = d3.scaleLinear().domain(o.dom || [d3.min(vals) - 0.04, d3.max(vals) + 0.04]).range([y0 + h, y0]);
    const gg = g.append("g");
    y.ticks(o.nbTicks || 4).forEach(v => {
      gg.append("line").attr("x1", x0).attr("x2", x0 + w).attr("y1", y(v)).attr("y2", y(v)).attr("stroke", C.grille).attr("stroke-width", 1);
      texte(gg, x0 - 10, y(v) + 6, fmt.dec(v, 2) + " €", { s: o.fs || 18, c: C.muted, a: "end" });
    });
    (o.mois || []).forEach(s => texte(gg, x(parseJour(s)), y0 + h + (o.fs || 18) + 12, fmt.moisC(parseJour(s)), { s: o.fs || 18, c: C.muted, a: "middle" }));
    const paths = {};
    for (const k of (o.series || ["g"])) {
      paths[k] = gg.append("path").attr("fill", "none").attr("stroke", k === "g" ? C.ledG : C.ledS).attr("stroke-width", o.ep || 5)
        .attr("stroke-linejoin", "round").attr("stroke-linecap", "round")
        .attr("d", d3.line().x(i => x(jours[i])).y(i => y(Q[k].moy[i]))(ii));
    }
    return { x, y, paths, gg };
  }
  /* carte des stations colorées selon l'écart au prix médian du jour */
  function carte(g, x0, y0, w, h, i, k = "g", r = 6) {
    const proj = d3.geoMercator().fitExtent([[x0, y0], [x0 + w, y0 + h]], window.CORSE_GEO.contour);
    const path = d3.geoPath(proj);
    const gg = g.append("g");
    gg.append("g").selectAll("path").data(window.CORSE_GEO.communes.features).join("path").attr("d", path).attr("fill", "#2a3036").attr("stroke", C.bg).attr("stroke-width", 0.7);
    const P = panel(k);
    const vals = D.stations.map(s => ({ s, v: P.get(s.id)[i] })).filter(d => !isNaN(d.v));
    const med = d3.median(vals, d => d.v);
    const col = d3.scaleDiverging(d3.piecewise(d3.interpolateLab, [C.moins, C.neutre, C.plus])).domain([-0.1, 0, 0.1]).clamp(true);
    gg.append("g").selectAll("circle").data(vals).join("circle")
      .attr("cx", d => proj([d.s.lon, d.s.lat])[0]).attr("cy", d => proj([d.s.lon, d.s.lat])[1]).attr("r", r)
      .attr("fill", d => col(d.v - med)).attr("stroke", C.bg).attr("stroke-width", r * 0.4);
    return { gg, med, col };
  }
  function barresEcart(g, x0, y0, w, h, o = {}) {
    const sem = d3.rollups(d3.range(N), is => ({ j0: jours[is[0]], v: d3.mean(is, i => (Q.g.moy[i] - Q.s.moy[i]) * 100) }), i => +d3.timeMonday.floor(jours[i])).map(d => d[1]);
    const x = d3.scaleBand().domain(sem.map((d, i) => i)).range([x0, x0 + w]).paddingInner(0.2);
    const y = d3.scaleLinear().domain([-12, 26]).range([y0 + h, y0]);
    const gg = g.append("g");
    [-10, 0, 10, 20].forEach(v => {
      gg.append("line").attr("x1", x0).attr("x2", x0 + w).attr("y1", y(v)).attr("y2", y(v)).attr("stroke", v === 0 ? C.ink2 : C.grille).attr("stroke-width", v === 0 ? 2 : 1);
      texte(gg, x0 - 10, y(v) + 6, (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v) + " ct", { s: o.fs || 18, c: C.muted, a: "end" });
    });
    const bars = gg.append("g").selectAll("path").data(sem).join("path")
      .attr("fill", d => (d.v >= 0 ? C.ledG : C.ledS))
      .attr("d", d => AP.barreV(x(sem.indexOf(d)), x.bandwidth(), y(0), y(d.v), Math.min(3, x.bandwidth() / 2)));
    return { sem, x, y, bars, gg };
  }
  function pied(g, x, y, s = 17) {
    texte(g, x, y, "Données : data.corsica et prix-carburants.gouv.fr (Licence Ouverte 2.0) · Traitement et visuels : À la pompe, SAÉ 303, BUT MMI 2, IUT de Corse", { s, c: C.muted });
  }

  /* =================== AFFICHE A3 =================== */
  function affiche() {
    const W = 1190, H = 1684, M = 72;
    const svg = doc(W, H);
    logo(svg, M, 58, 1.35);
    texte(svg, W - M, 92, "CARBURANTS EN CORSE · 2025 – 2026", { f: COND, w: 700, s: 24, c: C.mark, a: "end", ls: "0.12em" });
    marquage(svg, 0, W, 150, 8);
    texte(svg, M, 318, ["LE PLEIN,", [["ÇA SE ", C.ink], ["COMPARE.", C.mark]]], { f: COND, w: 800, s: 158, lh: 0.92 });
    texte(svg, M, 520, ["En Corse, le prix du litre change d'une station à l'autre.", "Depuis la flambée de 2026, l'écart s'est creusé."], { s: 34, w: 500, c: C.ink2, lh: 1.3 });
    // deux totems : la station la moins chère et la plus chère de l'île, le dernier jour des données
    const i = N - 1, P = panel("g");
    const vals = D.stations.map(s => P.get(s.id)[i]).filter(v => !isNaN(v));
    const mn = d3.min(vals), mx = d3.max(vals);
    const tw = 470;
    totem(svg, M, 630, tw, { titre: "LA MOINS CHÈRE", prix: mn.toFixed(3), badge: "B7", couleur: C.ledG, couleurTitre: "#7fb0f0", ps: 104, h: 270, mat: 34 });
    totem(svg, W - M - tw, 630, tw, { titre: "LA PLUS CHÈRE", prix: mx.toFixed(3), badge: "B7", couleur: C.ledG, couleurTitre: "#f08a80", ps: 104, h: 270, mat: 34 });
    texte(svg, W / 2, 780, "≠", { f: COND, w: 800, s: 90, c: C.mark, a: "middle" });
    // grand chiffre
    const ecart = (mx - mn) * 50;
    texte(svg, M, 1168, fmt.n(Math.round(ecart)) + " €", { f: COND, w: 800, s: 230, c: C.mark });
    texte(svg, M + 400, 1070, ["d'écart sur un plein de 50 litres de gazole", "entre la station la moins chère et la plus chère", "de l'île, le " + fmt.jour(jours[i]).trim() + "."], { s: 33, w: 500, c: C.ink, lh: 1.3 });
    svg.append("line").attr("x1", M).attr("x2", W - M).attr("y1", 1215).attr("y2", 1215).attr("stroke", C.grille).attr("stroke-width", 2);
    // courbe
    texte(svg, M, 1262, "Prix moyen du gazole en Corse", { f: COND, w: 700, s: 30, c: C.ink });
    texte(svg, M, 1294, PERIODE + ", en euros par litre", { s: 21, c: C.muted });
    const cv = courbe(svg, M + 66, 1320, 470, 170, { debut: D.jours[0], fin: D.jours[N - 1], dom: [1.6, 2.4], nbTicks: 4, mois: ["2025-07-01", "2026-01-01", "2026-07-01"], fs: 18, ep: 4.5 });
    const ip = idx(I.gazole_date_pic);
    svg.append("circle").attr("cx", cv.x(jours[ip])).attr("cy", cv.y(Q.g.moy[ip])).attr("r", 8).attr("fill", C.ledG).attr("stroke", C.bg).attr("stroke-width", 3);
    const xa = cv.x(parseJour("2026-02-20")) - 10;
    texte(svg, xa, cv.y(2.27), ["+" + fmt.dec(I.gazole_hausse_pic_cts, 1) + " ct", "en " + DUREE_HAUSSE], { f: COND, w: 800, s: 28, c: C.ink, a: "end", lh: 1.0 });
    // carte
    texte(svg, 680, 1262, "Les 108 stations le " + fmt.jourCourt(jours[i]).trim(), { f: COND, w: 700, s: 30, c: C.ink });
    texte(svg, 680, 1294, "gazole, prix comparé à la médiane de l'île", { s: 21, c: C.muted });
    carte(svg, 680, 1312, 240, 250, i, "g", 5.5);
    const lg = svg.append("g").attr("transform", "translate(940, 1380)");
    [["moins chère", "que la médiane", C.moins], ["plus chère", "que la médiane", C.plus]].forEach(([t, t2, c], j) => {
      lg.append("circle").attr("cx", 8).attr("cy", j * 78 - 6).attr("r", 9).attr("fill", c);
      texte(lg, 26, j * 78, [t, t2], { s: 21, c: C.ink2, lh: 1.15 });
    });
    // appel à l'action
    marquage(svg, 0, W, 1574, 6, 40, 28);
    texte(svg, M, 1626, [[["Avant de faire le plein, comparez : ", C.ink], ["prix-carburants.gouv.fr", C.mark]]], { s: 33, w: 600 });
    pied(svg, M, 1662, 15.5);
  }

  /* =================== CARROUSEL INSTAGRAM =================== */
  function cadreInsta(n) {
    const W = 1080, H = 1080, M = 72;
    const svg = doc(W, H);
    logo(svg, M, 50, 1.15);
    texte(svg, W - M, 84, `${n}/3`, { f: COND, w: 700, s: 30, c: C.muted, a: "end" });
    marquage(svg, 0, W, 132, 6, 46, 30);
    texte(svg, M, H - 40, "Sources : data.corsica et prix-carburants.gouv.fr · À la pompe, SAÉ 303", { s: 19, c: C.muted });
    return { svg, W, H, M };
  }
  function insta1() {
    const { svg, W, M } = cadreInsta(1);
    texte(svg, M, 256, ["Le plein de gazole", [["a pris ", C.ink], [fmt.n(Math.round(I.surcout_plein_pic_g)) + " €", C.mark]], "en " + DUREE_HAUSSE + "."], { f: COND, w: 800, s: 98, lh: 1.0 });
    const cv = courbe(svg, M + 66, 600, W - 2 * M - 80, 300, { debut: "2026-02-01", fin: D.jours[N - 1], dom: [1.7, 2.4], nbTicks: 4, mois: ["2026-03-01", "2026-06-01", "2026-09-01"], fs: 22, ep: 6 });
    for (const [s, lab, dx, a] of [["2026-02-27", "27 févr.", -14, "end"], [I.gazole_date_pic, sansAnnee(dPic), -14, "end"]]) {
      const i = idx(s), px = cv.x(jours[i]), py = cv.y(Q.g.moy[i]);
      svg.append("circle").attr("cx", px).attr("cy", py).attr("r", 10).attr("fill", C.ledG).attr("stroke", C.bg).attr("stroke-width", 4);
      texte(svg, px + dx, py - 20, [[[fmt.prix(Q.g.moy[i]), C.ink]]], { f: COND, w: 800, s: 40, a });
      texte(svg, px + dx, s === "2026-02-27" ? py + 38 : py - 62, lab, { s: 24, c: C.ink2, a });
    }
    texte(svg, M, 540, "Prix moyen du litre de gazole dans les stations corses", { s: 26, c: C.ink2 });
  }
  function insta2() {
    const { svg, W, M } = cadreInsta(2);
    texte(svg, M, 256, ["Depuis le 5 mars 2026,", [["le gazole coûte ", C.ink], ["plus cher", C.mark]], "que l'essence."], { f: COND, w: 800, s: 92, lh: 1.0 });
    texte(svg, M, 540, "Écart entre le prix moyen du gazole et celui du SP95, par semaine", { s: 26, c: C.ink2 });
    const b = barresEcart(svg, M + 80, 600, W - 2 * M - 90, 330, { fs: 22 });
    const max = b.sem.reduce((a, c) => (c.v > a.v ? c : a));
    const xm = b.x(b.sem.indexOf(max));
    texte(svg, xm, b.y(max.v) - 16, fmt.cts(max.v), { f: COND, w: 800, s: 38, c: C.ink, a: "end" });
    texte(svg, M + 90, b.y(0) - 16, "avant : le gazole moins cher", { s: 22, c: C.ink2 });
    const lg = svg.append("g").attr("transform", `translate(${M}, 985)`);
    lg.append("rect").attr("width", 22).attr("height", 22).attr("rx", 3).attr("fill", C.ledS);
    texte(lg, 32, 19, "SP95 plus cher", { s: 22, c: C.ink2 });
    lg.append("rect").attr("x", 230).attr("width", 22).attr("height", 22).attr("rx", 3).attr("fill", C.ledG);
    texte(lg, 262, 19, "gazole plus cher", { s: 22, c: C.ink2 });
  }
  function insta3() {
    const { svg, W, M } = cadreInsta(3);
    const i = N - 1, P = panel("g");
    const vals = D.stations.map(s => P.get(s.id)[i]).filter(v => !isNaN(v));
    const mn = d3.min(vals), mx = d3.max(vals);
    texte(svg, M, 250, [[["Jusqu'à ", C.ink], [fmt.n(Math.round((mx - mn) * 50)) + " €", C.mark]], "d'écart sur un plein."], { f: COND, w: 800, s: 104, lh: 1.0 });
    const tw = 430;
    totem(svg, M, 420, tw, { titre: "LA MOINS CHÈRE", prix: mn.toFixed(3), badge: "B7", couleurTitre: "#7fb0f0", ps: 92, h: 236, mat: 50 });
    totem(svg, W - M - tw, 420, tw, { titre: "LA PLUS CHÈRE", prix: mx.toFixed(3), badge: "B7", couleurTitre: "#f08a80", ps: 92, h: 236, mat: 50 });
    texte(svg, M, 820, "Gazole, plein de 50 litres, le " + fmt.jour(jours[i]).trim() + ".", { s: 28, c: C.ink2 });
    texte(svg, M, 905, [[["Le plein, ça se compare : ", C.ink], ["prix-carburants.gouv.fr", C.mark]]], { s: 38, w: 700 });
  }

  /* =================== BANNIÈRE WEB (Open Graph) =================== */
  function banniere() {
    const W = 1200, H = 630, M = 64;
    const svg = doc(W, H);
    logo(svg, M, 48, 1.2);
    texte(svg, M, 220, ["Le plein de gazole", [["a pris ", C.ink], [fmt.n(Math.round(I.surcout_plein_pic_g)) + " €", C.mark]], "en " + DUREE_HAUSSE + "."], { f: COND, w: 800, s: 84, lh: 1.0 });
    texte(svg, M, 470, ["Les prix des carburants en Corse,", "station par station (2025 – 2026)"], { s: 30, w: 500, c: C.ink2, lh: 1.3 });
    marquage(svg, 0, W, H - 34, 8, 52, 34);
    totem(svg, 720, 120, 420, { titre: "PRIX MOYEN · " + fmt.jourC(dPic), prix: Q.g.moy[idx(I.gazole_date_pic)].toFixed(3), badge: "B7", ps: 92, h: 250, mat: 90, ts: 22 });
  }

  /* =================== STORY ANIMÉE 1080 × 1920 =================== */
  function story() {
    const W = 1080, H = 1920, M = 80;
    const svg = doc(W, H);
    const ease = d3.easeCubicInOut, cl = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
    logo(svg, M, 70, 1.3);
    marquage(svg, 0, W, 170, 8);
    texte(svg, M, H - 120, ["Données : data.corsica et prix-carburants.gouv.fr (Licence Ouverte 2.0)", "À la pompe · SAÉ 303 · BUT MMI 2 · IUT de Corse"], { s: 24, c: C.muted, lh: 1.35 });
    const sc = [0, 1, 2, 3].map(() => svg.append("g"));
    // scène 1 : totem qui défile du 27 février au jour du record
    const s1t = texte(sc[0], M, 330, ["Carburants en Corse :", [["le gazole a ", C.ink], ["flambé.", C.mark]]], { f: COND, w: 800, s: 104, lh: 1.0 });
    const tt = totem(sc[0], M, 620, W - 2 * M, { titre: "PRIX MOYEN · CORSE", prix: "1.801", badge: "B7", ps: 210, h: 470, mat: 180, ts: 34 });
    const dateT = texte(sc[0], W - M - 24 - 46 - 22, 620 + 47, "27/02/2026", { f: COND, w: 700, s: 34, c: C.mark, a: "end" });
    const pleinT = texte(sc[0], M, 1450, "", { s: 40, w: 600, c: C.ink });
    // scène 2 : courbe
    texte(sc[1], M, 330, ["+" + fmt.dec(I.gazole_hausse_pic_cts, 1) + " centimes", "en " + DUREE_HAUSSE + "."], { f: COND, w: 800, s: 112, lh: 1.0 });
    texte(sc[1], M, 610, "Prix moyen du litre, " + PERIODE, { s: 32, c: C.ink2 });
    const cv = courbe(sc[1], M + 80, 680, W - 2 * M - 90, 640, { debut: D.jours[0], fin: D.jours[N - 1], series: ["s", "g"], dom: [1.6, 2.4], nbTicks: 5, mois: ["2025-07-01", "2026-01-01", "2026-07-01"], fs: 26, ep: 7 });
    const xc = cv.x(parseJour(I.debut_crise));
    const crise = sc[1].append("g");
    crise.append("line").attr("x1", xc).attr("x2", xc).attr("y1", 660).attr("y2", 1320).attr("stroke", C.ink2).attr("stroke-width", 2);
    texte(crise, xc - 14, 720, ["28 février :", "guerre au", "Moyen-Orient"], { s: 28, w: 600, c: C.ink, a: "end", lh: 1.15 });
    const lg2 = sc[1].append("g").attr("transform", `translate(${M}, 1440)`);
    lg2.append("rect").attr("width", 26).attr("height", 26).attr("rx", 4).attr("fill", C.ledG); texte(lg2, 40, 22, "Gazole", { s: 30, c: C.ink2 });
    lg2.append("circle").attr("cx", 233).attr("cy", 13).attr("r", 14).attr("fill", C.ledS); texte(lg2, 260, 22, "SP95", { s: 30, c: C.ink2 });
    const bascule = texte(sc[1], M, 1560, [[["Depuis le " + sansAnnee(parseJour(I.date_bascule_gazole_plus_cher)) + ", le gazole coûte ", C.ink], ["plus cher", C.mark]], "que l'essence."], { s: 42, w: 600, lh: 1.25 });
    const L = { g: cv.paths.g.node().getTotalLength(), s: cv.paths.s.node().getTotalLength() };
    // scène 3 : deux totems
    const P = panel("g"), i = N - 1;
    const vals = D.stations.map(s => P.get(s.id)[i]).filter(v => !isNaN(v));
    const mn = d3.min(vals), mx = d3.max(vals), ecart = (mx - mn) * 50;
    texte(sc[2], M, 330, ["D'une station", "à l'autre…"], { f: COND, w: 800, s: 120, lh: 1.0 });
    const tA = totem(sc[2], M, 600, W - 2 * M, { titre: "LA MOINS CHÈRE", prix: mn.toFixed(3), badge: "B7", couleurTitre: "#7fb0f0", ps: 170, h: 330, mat: false, ts: 32 });
    const tB = totem(sc[2], M, 980, W - 2 * M, { titre: "LA PLUS CHÈRE", prix: mx.toFixed(3), badge: "B7", couleurTitre: "#f08a80", ps: 170, h: 330, mat: false, ts: 32 });
    const gros = texte(sc[2], M, 1560, "0 €", { f: COND, w: 800, s: 170, c: C.mark });
    texte(sc[2], M + 390, 1488, ["d'écart sur un plein", "de 50 L (" + fmt.jourC(jours[i]) + ")"], { s: 36, w: 600, c: C.ink, lh: 1.25 });
    // scène 4 : message
    texte(sc[3], M, 700, ["LE PLEIN,", "ÇA SE", [["COMPARE.", C.mark]]], { f: COND, w: 800, s: 210, lh: 0.92 });
    texte(sc[3], M, 1320, "Avant de faire le plein :", { s: 44, w: 500, c: C.ink2 });
    texte(sc[3], M, 1400, "prix-carburants.gouv.fr", { s: 64, w: 700, c: C.mark });
    marquage(sc[3], M, W - M, 1480, 10, 60, 40);

    const iA = idx("2026-02-27"), iB = idx(I.gazole_date_pic);
    const DUREE = 19;
    function scene(g, t, a, b) { // fondu d'entrée et de sortie de 0,4 s
      const o = Math.min(cl(t, a, a + 0.4), 1 - cl(t, b - 0.4, b));
      g.attr("opacity", o).attr("display", o <= 0 ? "none" : null);
      return o;
    }
    window.renderAt = function (t) {
      // scène 1 (0 – 5 s)
      scene(sc[0], t, -1, 5);
      const p = ease(cl(t, 0.8, 4.2)), j = Math.round(iA + (iB - iA) * p);
      tt.prix.select("tspan").text(Q.g.moy[j].toFixed(3));
      dateT.select("tspan").text(fmt.jourC(jours[j]));
      pleinT.select("tspan").text("Plein de 50 L : " + fmt.eur(Q.g.moy[j] * 50));
      s1t.attr("transform", `translate(0,${(1 - ease(cl(t, 0, 0.7))) * 40})`);
      // scène 2 (5 – 10,5 s)
      scene(sc[1], t, 5, 10.5);
      const pl = ease(cl(t, 5.3, 8.6));
      for (const k of ["g", "s"]) cv.paths[k].attr("stroke-dasharray", `${L[k]} ${L[k]}`).attr("stroke-dashoffset", L[k] * (1 - pl));
      crise.attr("opacity", cl(t, 7.6, 8.0));
      bascule.attr("opacity", cl(t, 8.7, 9.1));
      // scène 3 (10,5 – 15,5 s)
      scene(sc[2], t, 10.5, 15.5);
      tA.g.attr("transform", `translate(${M - (1 - ease(cl(t, 10.6, 11.4))) * 900},600)`);
      tB.g.attr("transform", `translate(${M + (1 - ease(cl(t, 11.2, 12.0))) * 900},980)`);
      gros.select("tspan").text(fmt.n(Math.round(ecart * ease(cl(t, 12.2, 13.6)))) + " €");
      // scène 4 (15,5 – 19 s)
      scene(sc[3], t, 15.5, 99);
    };
    window.DUREE = DUREE;
    window.renderAt(DUREE - 0.01);
  }

  window.FONT_CSS = FONT_CSS; // ajouté seulement dans les fichiers SVG exportés (chemins relatifs à site/communication/)
  const formats = { affiche, insta1, insta2, insta3, banniere, story };
  function lancer() { (formats[location.hash.slice(1)] || affiche)(); window.PRET = true; }
  document.fonts.ready.then(() => document.fonts.load('700 40px "DSEG7 Classic"')).then(lancer);
})();
