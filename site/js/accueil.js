/* =====================================================================
   À la pompe — page « L'essentiel » : totem animé, chiffres clés,
   courbe des prix moyens et écart gazole / SP95
   ===================================================================== */
(function () {
  "use strict";
  const { D, fmt, parseJour, jours, N, libMois, showTip, hideTip, equiperCarte, surRedimension, premiereVue, segmente, barreV, marqueur, reduit } = AP;
  const I = D.indicateurs, Q = D.quotidien;
  const idx = s => D.jours.indexOf(s);

  /* ---------- chiffres clés ---------- */
  function chiffres() {
    const set = (k, html) => document.querySelectorAll(`[data-kpi="${k}"]`).forEach(e => (e.innerHTML = html));
    const dVeille = d3.timeDay.offset(parseJour(I.debut_crise), -1), dPic = parseJour(I.gazole_date_pic), dFin = parseJour(D.meta.fin);
    set("surcout", fmt.n(Math.round(I.surcout_plein_pic_g)) + "&nbsp;€");
    set("duree", fmt.duree(dVeille, dPic));
    set("avant", fmt.prix(I.gazole_veille_crise));
    set("pic", fmt.prix(I.gazole_pic));
    set("date-pic", fmt.jour(dPic).trim());
    set("date-fin", fmt.jour(dFin).trim());
    set("dernier", fmt.prix(I.gazole_dernier));
    set("surcout-fin", fmt.n(Math.round((I.gazole_dernier - I.gazole_veille_crise) * D.meta.plein)) + "&nbsp;€");
    set("jours-txt", String(I.jours_gazole_plus_cher));
    set("ecart-fin", fmt.dec((I.gazole_dernier - I.sp95_dernier) * 100, 1) + " centimes");
    set("date-pic-court", fmt.jour(dPic).trim().replace(/ 2026$/, ""));
    // le gazole est-il resté plus cher que le SP95 chaque jour depuis la bascule ?
    const ib = idx(I.date_bascule_gazole_plus_cher), apres = d3.range(Math.max(0, ib), N);
    const toujours = ib >= 0 && apres.every(i => Q.g.moy[i] > Q.s.moy[i]);
    const dBascule = fmt.jour(parseJour(I.date_bascule_gazole_plus_cher)).trim();
    set("jours-sub", (toujours ? "tous depuis le " : "depuis le ") + dBascule);
    set("inversion", toujours ? `le gazole coûte plus cher que le SP95 depuis ${I.jours_gazole_plus_cher} jours d'affilée`
      : `le gazole a coûté plus cher que le SP95 pendant ${I.jours_gazole_plus_cher} jours`);
    const ecartFin = (I.gazole_dernier - I.sp95_dernier) * 100;
    set("ecart-fin-phrase", ecartFin > 0 ? `Le ${fmt.jour(dFin).trim()}, l'écart est encore de ${fmt.dec(ecartFin, 1)} centimes.`
      : `Le ${fmt.jour(dFin).trim()}, le SP95 est redevenu plus cher que le gazole, de ${fmt.dec(-ecartFin, 1)} centimes.`);
    // évolution depuis le déblocage des stocks stratégiques de gazole (1er novembre 2026)
    const RP = I.reperes || {};
    if (RP.veille_destockage) {
      const b = (RP.veille_destockage.gazole - I.gazole_dernier) * 100;
      const verbe = b >= 0.05 ? `il a perdu ${fmt.dec(b, 1)} centimes` : b <= -0.05 ? `il a repris ${fmt.dec(-b, 1)} centimes` : "il n'a presque pas bougé";
      set("destockage", `Depuis le déblocage des stocks stratégiques de gazole par l'État, le 1<sup>er</sup> novembre, ${verbe}&nbsp;: ${fmt.prix(I.gazole_dernier)} le ${fmt.jour(dFin).trim()}.`);
    }
    const nMin = d3.min(Q.g.n), nMax = d3.max(Q.g.n);
    set("n-range", nMin === nMax ? String(nMin) : `${nMin} à ${nMax}`);
    // descriptions accessibles des deux graphiques, recalculées avec les données
    const per = `${fmt.mois(jours[0])} à ${fmt.mois(jours[N - 1])}`;
    document.getElementById("evolution").setAttribute("aria-label", `Courbes du prix moyen du gazole et du SP95 en Corse, d'${per}. ` +
      `Les prix restent stables autour de 1,74 et 1,82 euro jusqu'en février 2026, puis montent fortement en mars. Le gazole atteint ` +
      `${fmt.prix(I.gazole_pic)} le ${fmt.jour(dPic).trim()}, son plus haut niveau, et vaut ${fmt.prix(I.gazole_dernier)} le ${fmt.jour(dFin).trim()}. ` +
      `Il coûte plus cher que le SP95 depuis le ${dBascule}.`);
    document.getElementById("ecart").setAttribute("aria-label", `Diagramme en barres de l'écart hebdomadaire entre gazole et SP95, d'${per} : ` +
      `environ 8 centimes en faveur du gazole jusqu'en février 2026, puis un écart qui s'inverse début mars, avec un record de ` +
      `${fmt.dec(I.ecart_max_gazole_sp95_cts, 1)} centimes le ${fmt.jour(parseJour(I.date_ecart_max)).trim()}.`);
    set("hausse", "+" + fmt.dec(I.gazole_hausse_pic_cts, 1) + "<small>&nbsp;ct</small>");
    set("hausse-pct", "soit " + fmt.pct(I.gazole_hausse_pic_pct));
    set("jours", I.jours_gazole_plus_cher + "<small>&nbsp;jours</small>");
    set("ecart-plein", fmt.n(Math.round(I.dispersion.Gazole.dernier_jour.plein)) + "<small>&nbsp;€</small>");
    set("ecart-date", "le " + fmt.jour(parseJour(D.meta.fin)).trim());
    set("maj", fmt.n(I.mises_a_jour) + " mises à jour de prix");
    set("ecart-max", fmt.dec(I.ecart_max_gazole_sp95_cts, 1) + " centimes");
  }

  /* ---------- totem : prix moyen jour par jour pendant la flambée ---------- */
  function totem() {
    const i0 = idx(I.debut_crise) - 1, i1 = idx(I.gazole_date_pic);
    const ledG = document.getElementById("led-g"), ledS = document.getElementById("led-s");
    const date = document.getElementById("totem-date"), plein = document.getElementById("totem-plein");
    const afficher = i => {
      ledG.textContent = Q.g.moy[i].toFixed(3);
      ledS.textContent = Q.s.moy[i].toFixed(3);
      date.textContent = fmt.jourC(jours[i]);
      date.setAttribute("datetime", D.jours[i]);
      plein.textContent = fmt.eur(Q.g.moy[i] * D.meta.plein);
    };
    let timer = null;
    const jouer = () => {
      if (timer) timer.stop();
      if (reduit()) return afficher(i1);
      const duree = 4200;
      afficher(i0);
      timer = d3.timer(t => {
        const p = d3.easeCubicInOut(Math.min(1, t / duree));
        afficher(Math.round(i0 + (i1 - i0) * p));
        if (t >= duree) { timer.stop(); afficher(i1); }
      }, 500);
    };
    afficher(i1);
    document.getElementById("totem-replay").addEventListener("click", jouer);
    jouer();
  }

  /* ---------- courbe d'évolution des prix moyens ---------- */
  function evolution() {
    const box = document.getElementById("evolution");
    const carte = document.getElementById("carte-evolution");
    const etat = { per: "tout", ext: false };
    const PER = { tout: [jours[0], jours[N - 1]], p1: [jours[0], parseJour("2026-02-27")], p2: [parseJour("2026-02-14"), jours[N - 1]] };
    let W, H, m, x, y, svg, gGrid, gX, gY, el = {}, cross, survol, iSurvol = null;

    const lineGen = (k, champ) => d3.line().defined((d, i) => Q[k][champ][i] != null).x((d, i) => x(jours[i])).y((d, i) => y(Q[k][champ][i]));
    const areaGen = (k, bas, haut) => d3.area().defined((d, i) => Q[k][bas][i] != null).x((d, i) => x(jours[i])).y0((d, i) => y(Q[k][bas][i])).y1((d, i) => y(Q[k][haut][i]));
    const seq = d3.range(N);

    function construire() {
      box.replaceChildren();
      W = box.clientWidth; H = Math.round(Math.max(300, Math.min(450, W * 0.48)));
      m = { t: 40, r: W < 640 ? 16 : 104, b: 34, l: 52 };
      x = d3.scaleTime().range([m.l, W - m.r]);
      y = d3.scaleLinear().range([H - m.b, m.t]);
      svg = d3.select(box).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
      const cid = "clip-evo";
      svg.append("defs").append("clipPath").attr("id", cid).append("rect").attr("x", m.l).attr("y", 0).attr("width", W - m.l - m.r).attr("height", H);
      gGrid = svg.append("g").attr("class", "grid");
      gX = svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`);
      gY = svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`);
      const plot = svg.append("g").attr("clip-path", `url(#${cid})`);
      el.zone = plot.append("rect").attr("class", "annot-zone");
      for (const k of ["g", "s"]) {
        el["ext" + k] = plot.append("path").attr("class", "band-ext band-" + k).style("opacity", 0);
        el["iq" + k] = plot.append("path").attr("class", "band-" + k);
      }
      for (const k of ["g", "s"]) el["l" + k] = plot.append("path").attr("class", "line line-" + k);
      el.annot = svg.append("g");
      el.fins = svg.append("g");
      cross = svg.append("g").style("display", "none").attr("pointer-events", "none");
      cross.append("line").attr("class", "crosshair");
      survol = svg.append("rect").attr("class", "hit").attr("x", m.l).attr("y", m.t).attr("width", W - m.l - m.r).attr("height", H - m.t - m.b)
        .attr("tabindex", 0).attr("role", "application")
        .attr("aria-label", "Zone du graphique : utilisez les flèches gauche et droite pour lire les prix jour par jour");
      survol.on("pointermove", e => montrer(trouver(d3.pointer(e)[0]), e))
        .on("pointerleave", cacher)
        .on("focus", () => montrer(iSurvol ?? visibles()[1], null))
        .on("blur", cacher)
        .on("keydown", e => {
          if (!["ArrowLeft", "ArrowRight", "Escape"].includes(e.key)) return;
          e.preventDefault();
          if (e.key === "Escape") return cacher();
          const [a, b] = visibles();
          iSurvol = Math.max(a, Math.min(b, (iSurvol ?? b) + (e.key === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 7 : 1)));
          montrer(iSurvol, null);
        });
      maj(false);
    }

    function visibles() { const [d0, d1] = x.domain(); return [AP.jourIndex(d0), Math.min(N - 1, AP.jourIndex(d1))]; }
    const bis = d3.bisector(d => d);
    function trouver(px) { const [a, b] = visibles(); return Math.max(a, Math.min(b, bis.center(jours, x.invert(px)))); }

    function maj(anime) {
      const dur = anime && !reduit() ? 750 : 0;
      x.domain(PER[etat.per]);
      const [a, b] = visibles();
      const champs = etat.ext ? ["min", "max"] : ["q1", "q3"];
      const vals = [];
      for (const k of ["g", "s"]) for (const c of champs.concat("moy")) for (let i = a; i <= b; i++) if (Q[k][c][i] != null) vals.push(Q[k][c][i]);
      const [lo, hi] = d3.extent(vals);
      y.domain([lo - (hi - lo) * 0.06, hi + (hi - lo) * 0.08]).nice();
      const t = svg.transition().duration(dur).ease(d3.easeCubicInOut);
      const nbx = W < 640 ? 5 : 10;
      gX.transition(t).call(d3.axisBottom(x).ticks(nbx).tickFormat(W < 640 ? fmt.axeMoisCourt : fmt.axeMois).tickSizeOuter(0));
      gY.transition(t).call(d3.axisLeft(y).ticks(6).tickFormat(v => fmt.dec(v, 2) + " €").tickSize(0).tickPadding(8)).call(g => g.select(".domain").remove());
      gGrid.transition(t).call(d3.axisLeft(y).ticks(6).tickSize(-(W - m.l - m.r)).tickFormat("")).attr("transform", `translate(${m.l},0)`);
      const xc = x(parseJour(I.debut_crise));
      el.zone.transition(t).attr("x", xc).attr("y", m.t).attr("width", Math.max(0, W - m.r - xc)).attr("height", H - m.t - m.b);
      for (const k of ["g", "s"]) {
        el["ext" + k].transition(t).attr("d", areaGen(k, "min", "max")(seq)).style("opacity", etat.ext ? 1 : 0);
        el["iq" + k].transition(t).attr("d", areaGen(k, "q1", "q3")(seq)).style("opacity", etat.ext ? 0 : 1);
        el["l" + k].transition(t).attr("d", lineGen(k, "moy")(seq));
      }
      t.on("end.annot", () => annoter());
      if (!dur) annoter();
      else { el.annot.attr("opacity", 0); el.fins.attr("opacity", 0); }
    }

    function annoter() {
      el.annot.selectAll("*").remove(); el.fins.selectAll("*").remove();
      el.annot.attr("opacity", 1); el.fins.attr("opacity", 1);
      const [a, b] = visibles();
      const dans = s => { const i = idx(s); return i >= a && i <= b; };
      const etroit = W < 640;
      // événement daté : trait vertical et libellé au-dessus du graphique, du côté où il y a la place
      const evenement = (jour, long, court) => {
        if (!dans(jour)) return;
        const xc = x(parseJour(jour)), aGauche = xc - m.l > (etroit ? 120 : 270);
        el.annot.append("line").attr("class", "annot-line").attr("x1", xc).attr("x2", xc).attr("y1", m.t - 18).attr("y2", H - m.b);
        el.annot.append("text").attr("class", "label-strong halo").attr("x", xc + (aGauche ? -6 : 6)).attr("y", m.t - 22)
          .attr("text-anchor", aGauche ? "end" : "start").text(etroit ? court : long);
      };
      evenement(I.debut_crise, "28 février 2026 : guerre au Moyen-Orient", "28 févr. : guerre");
      if (!etroit || etat.per === "p2") evenement("2026-11-01", "1er nov. : stocks de gazole débloqués", "1er nov.");
      // record de la période et premier pic du printemps
      const ip = idx(I.gazole_date_pic);
      const i0 = idx(I.debut_crise), iEte = idx("2026-06-30");
      const ip1 = i0 >= 0 && iEte > i0 ? i0 + d3.maxIndex(Q.g.moy.slice(i0, iEte)) : -1;
      const pics = [[ip, true]];
      if (ip1 >= 0 && ip1 !== ip && !(etroit && etat.per !== "p2")) pics.push([ip1, false]);
      for (const [i, record] of pics) {
        if (i < a || i > b) continue;
        const px = x(jours[i]), py = y(Q.g.moy[i]);
        el.annot.append("circle").attr("class", "annot-dot dot-ring").attr("cx", px).attr("cy", py).attr("r", record ? 4.5 : 4);
        const lib = `${fmt.jourCourt(jours[i]).trim().replace(/ \d{4}$/, "")} : ${fmt.prix(Q.g.moy[i])}${record && !etroit ? " (record)" : ""}`;
        el.annot.append("text").attr("class", (record ? "label-strong" : "label") + " halo").attr("x", px - 10).attr("y", py - 12)
          .attr("text-anchor", "end").text(lib);
      }
      const ib = idx(I.date_bascule_gazole_plus_cher);
      if (!etroit && ib >= a && ib <= b && etat.per !== "p1") {
        const px = x(jours[ib]), py = y(Q.g.moy[ib]);
        el.annot.append("circle").attr("class", "annot-dot dot-ring").attr("cx", px).attr("cy", py).attr("r", 4);
        el.annot.append("text").attr("class", "label halo").attr("x", px + 10).attr("y", py + 26)
          .text(`${fmt.jourCourt(jours[ib]).trim().replace(/ \d{4}$/, "")} : le gazole dépasse le SP95`);
        el.annot.append("line").attr("class", "annot-line").attr("x1", px + 2).attr("y1", py + 5).attr("x2", px + 8).attr("y2", py + 14);
      }
      if (etat.per === "p1") {
        const i = idx(I.periodes.P1.Gazole.date_max);
        el.annot.append("text").attr("class", "label halo").attr("x", x(jours[i])).attr("y", y(Q.g.moy[i]) - 14).attr("text-anchor", "middle")
          .text("Moins de 20 centimes de variation en 11 mois");
      }
      if (W >= 640) { // étiquettes directes en bout de courbe
        const pos = ["g", "s"].map(k => ({ k, v: Q[k].moy[b], y: y(Q[k].moy[b]) }));
        if (Math.abs(pos[0].y - pos[1].y) < 34) { // évite le chevauchement : décale avec un trait de rappel
          const milieu = (pos[0].y + pos[1].y) / 2, haut = pos[0].y < pos[1].y ? 0 : 1;
          pos[haut].ly = milieu - 17; pos[1 - haut].ly = milieu + 17;
        }
        for (const p of pos) {
          const ly = p.ly ?? p.y, x0 = W - m.r;
          marqueur(el.fins, p.k, x0, p.y, 9);
          if (p.ly != null) el.fins.append("line").attr("class", "annot-line").attr("x1", x0 + 6).attr("y1", p.y).attr("x2", x0 + 12).attr("y2", ly);
          el.fins.append("text").attr("class", "label-strong").attr("x", x0 + 14).attr("y", ly - 3).text(p.k === "g" ? "Gazole" : "SP95");
          el.fins.append("text").attr("class", "label").attr("x", x0 + 14).attr("y", ly + 13).text(fmt.prix(p.v));
        }
      }
    }

    function montrer(i, evt) {
      iSurvol = i;
      const px = x(jours[i]);
      cross.style("display", null);
      cross.select("line").attr("x1", px).attr("x2", px).attr("y1", m.t).attr("y2", H - m.b);
      cross.selectAll(".mk").remove();
      for (const k of ["g", "s"]) if (Q[k].moy[i] != null) marqueur(cross, k, px, y(Q[k].moy[i]), 10).classed("mk", true);
      const ecart = (Q.g.moy[i] - Q.s.moy[i]) * 100;
      const pseudo = evt || (() => { const r = survol.node().getBoundingClientRect(); return { clientX: r.left + (px - m.l) * r.width / (W - m.l - m.r), clientY: r.top + 20 }; })();
      showTip(pseudo, fmt.jour(jours[i]).trim(), [
        { key: "Gazole", val: fmt.prix(Q.g.moy[i]), sw: "carre g" },
        { key: "SP95", val: fmt.prix(Q.s.moy[i]), sw: "rond s" },
        { key: "Écart gazole – SP95", val: fmt.cts(ecart) },
        { key: "Stations", val: String(Q.g.n[i]) }
      ], `Moitié centrale : ${fmt.dec(Q.g.q1[i], 3)} – ${fmt.dec(Q.g.q3[i], 3)} € (gazole)`);
    }
    function cacher() { cross.style("display", "none"); hideTip(); }

    function animerEntree() {
      for (const k of ["g", "s"]) {
        const p = el["l" + k].node(), L = p.getTotalLength();
        d3.select(p).attr("stroke-dasharray", `${L} ${L}`).attr("stroke-dashoffset", L)
          .transition().duration(1800).ease(d3.easeCubicInOut).attr("stroke-dashoffset", 0)
          .on("end", function () { d3.select(this).attr("stroke-dasharray", null).attr("stroke-dashoffset", null); });
      }
      el.fins.attr("opacity", 0).transition().delay(1500).duration(400).attr("opacity", 1);
    }

    construire();
    segmente(document.getElementById("evo-periode"), v => { etat.per = v; maj(true); });
    document.getElementById("evo-extremes").addEventListener("change", e => { etat.ext = e.target.checked; maj(true); });
    surRedimension(box, construire);
    document.addEventListener("themechange", construire);
    premiereVue(box, animerEntree);
    equiperCarte(carte, {
      titre: "Prix moyen du litre dans les stations corses",
      colonnes: [{ t: "Mois" }, { t: "Gazole (€/L)", n: 1 }, { t: "SP95 (€/L)", n: 1 }, { t: "Écart (ct)", n: 1 }],
      lignes: () => D.mensuel.map(r => [libMois(r.mois), fmt.dec(r.g, 3), fmt.dec(r.s, 3), fmt.cts((r.g - r.s) * 100)])
    });
  }

  /* texte centré sur plusieurs lignes (petits écrans) */
  function texte2(svg, x, y, lignes) {
    const t = svg.append("text").attr("class", "label halo").attr("x", x).attr("y", y).attr("text-anchor", "middle");
    lignes.forEach((l, i) => t.append("tspan").attr("x", x).attr("dy", i ? 15 : 0).text(l));
    return t;
  }

  /* ---------- écart hebdomadaire gazole – SP95 ---------- */
  function ecart() {
    const box = document.getElementById("ecart");
    const carte = document.getElementById("carte-ecart");
    // regroupement par semaine (lundi → dimanche)
    const sem = d3.rollups(d3.range(N), is => ({
      debut: d3.timeMonday.floor(jours[is[0]]), j0: jours[is[0]], j1: jours[is[is.length - 1]], nb: is.length,
      v: d3.mean(is, i => (Q.g.moy[i] - Q.s.moy[i]) * 100), g: d3.mean(is, i => Q.g.moy[i]), s: d3.mean(is, i => Q.s.moy[i])
    }), i => +d3.timeMonday.floor(jours[i])).map(d => d[1]);
    let svg, barres, x, y, H, m;

    function construire() {
      box.replaceChildren();
      const W = box.clientWidth; H = Math.round(Math.max(260, Math.min(360, W * 0.36)));
      m = { t: 34, r: 16, b: 34, l: 52 };
      x = d3.scaleBand().domain(sem.map(d => +d.debut)).range([m.l, W - m.r]).paddingInner(0.18).paddingOuter(0.1);
      const [lo, hi] = d3.extent(sem, d => d.v);
      y = d3.scaleLinear().domain([Math.min(-10, lo - 2), hi + 4]).nice().range([H - m.b, m.t]);
      svg = d3.select(box).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
      svg.append("g").attr("class", "grid").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(6).tickSize(-(W - m.l - m.r)).tickFormat(""));
      svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`)
        .call(d3.axisLeft(y).ticks(6).tickFormat(v => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v) + " ct").tickSize(0).tickPadding(8)).call(g => g.select(".domain").remove());
      const debutsMois = sem.filter((d, i) => i === 0 || d.j0.getMonth() !== sem[i - 1].j0.getMonth());
      const pas = W < 640 ? 3 : 1;
      svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`)
        .call(d3.axisBottom(x).tickValues(debutsMois.filter((d, i) => i % pas === 0).map(d => +d.debut)).tickFormat(v => (W < 640 ? fmt.axeMoisCourt : fmt.axeMois)(sem.find(d => +d.debut === v).j0)).tickSizeOuter(0))
        .call(g => g.select(".domain").remove());
      const bw = Math.min(24, x.bandwidth());
      barres = svg.append("g").selectAll("path").data(sem).join("path")
        .attr("class", d => (d.v >= 0 ? "fill-g" : "fill-s"))
        .attr("d", d => barreV(x(+d.debut) + (x.bandwidth() - bw) / 2, bw, y(0), y(d.v), Math.min(3, bw / 2)));
      svg.append("line").attr("class", "zero").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(0)).attr("y2", y(0));
      // annotations
      const max = sem.reduce((a, b) => (b.v > a.v ? b : a));
      const cx = x(+max.debut) + x.bandwidth() / 2;
      svg.append("text").attr("class", "label-strong halo").attr("x", cx).attr("y", y(max.v) - 10).attr("text-anchor", W < 640 ? "end" : "middle")
        .text(`${fmt.cts(max.v)} la semaine du ${fmt.jourCourt(max.debut).trim()}`);
      const p1 = sem.filter(d => d.j1 < parseJour(I.debut_crise));
      const moyP1 = d3.mean(p1, d => d.v);
      const xm = x(+p1[Math.floor(p1.length / 2)].debut);
      if (W < 640) texte2(svg, xm, y(0) - 28, ["Avant la crise :", `gazole moins cher de ${fmt.dec(Math.abs(moyP1), 1)} ct`]);
      else svg.append("text").attr("class", "label halo").attr("x", xm).attr("y", y(0) - 12).attr("text-anchor", "middle")
        .text(`Avant la crise, le gazole coûte en moyenne ${fmt.dec(Math.abs(moyP1), 1)} ct de moins que le SP95`);
      // survol
      svg.append("g").selectAll("rect").data(sem).join("rect").attr("class", "hit")
        .attr("x", d => x(+d.debut) - x.step() * x.paddingInner() / 2).attr("width", x.step()).attr("y", m.t).attr("height", H - m.t - m.b)
        .attr("tabindex", 0).attr("aria-label", d => `Semaine du ${fmt.jour(d.j0).trim()} : écart ${fmt.cts(d.v)}`)
        .on("pointerenter pointermove focus", (e, d) => {
          barres.style("opacity", b => (b === d ? 1 : 0.45));
          showTip(e.type === "focus" ? { target: e.target } : e, `Du ${fmt.jour(d.j0).trim()} au ${fmt.jour(d.j1).trim()}`, [
            { key: "Écart gazole – SP95", val: fmt.cts(d.v) },
            { key: "Gazole", val: fmt.prix(d.g), sw: "carre g" },
            { key: "SP95", val: fmt.prix(d.s), sw: "rond s" }]);
        })
        .on("pointerleave blur", () => { barres.style("opacity", 1); hideTip(); });
    }
    function animerEntree() {
      barres.attr("d", d => { const bw = Math.min(24, x.bandwidth()); return barreV(x(+d.debut) + (x.bandwidth() - bw) / 2, bw, y(0), y(0) + (d.v >= 0 ? -0.6 : 0.6), 0); })
        .transition().duration(900).delay((d, i) => i * 14).ease(d3.easeCubicOut)
        .attr("d", d => { const bw = Math.min(24, x.bandwidth()); return barreV(x(+d.debut) + (x.bandwidth() - bw) / 2, bw, y(0), y(d.v), Math.min(3, bw / 2)); });
    }
    construire();
    surRedimension(box, construire);
    document.addEventListener("themechange", construire);
    premiereVue(box, animerEntree);
    equiperCarte(carte, {
      titre: "Écart de prix entre le gazole et le SP95, par semaine",
      colonnes: [{ t: "Semaine du" }, { t: "Écart (ct/L)", n: 1 }, { t: "Gazole (€/L)", n: 1 }, { t: "SP95 (€/L)", n: 1 }],
      lignes: () => sem.map(d => [fmt.jourC(d.j0), fmt.cts(d.v), fmt.dec(d.g, 3), fmt.dec(d.s, 3)])
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    chiffres();
    totem();
    evolution();
    ecart();
  });
})();
