/* =====================================================================
   À la pompe — fonctions communes à toutes les pages
   (formats français, données, infobulle, export PNG/SVG, tableau, thème)
   ===================================================================== */
(function () {
  "use strict";
  const D = window.DATA;

  /* ---------- formats français ---------- */
  const loc = d3.formatLocale({ decimal: ",", thousands: " ", grouping: [3], currency: ["", " €"] });
  const tloc = d3.timeFormatLocale({
    dateTime: "%A %e %B %Y à %X", date: "%d/%m/%Y", time: "%H:%M:%S", periods: ["AM", "PM"],
    days: ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"],
    shortDays: ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."],
    months: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
    shortMonths: ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
  });
  const f3 = loc.format(".3f"), f2 = loc.format(".2f"), f1 = loc.format(".1f"), f0 = loc.format(",.0f");
  const fmt = {
    prix: v => (v == null || isNaN(v)) ? "–" : f3(v) + " €",
    prixL: v => (v == null || isNaN(v)) ? "–" : f3(v) + " €/L",
    eur: v => f2(v) + " €",
    eur0: v => f0(v) + " €",
    cts: v => { const r = Math.round(v * 10) / 10; return (r > 0 ? "+" : r < 0 ? "−" : "") + f1(Math.abs(r)) + " ct"; },
    pct: v => (v > 0 ? "+" : v < 0 ? "−" : "") + f1(Math.abs(v)) + " %",
    n: v => f0(v),
    dec: (v, d = 3) => loc.format("." + d + "f")(v),
    jour: tloc.format("%e %B %Y"),
    jourC: tloc.format("%d/%m/%Y"),
    jourCourt: tloc.format("%e %b %Y"),
    mois: tloc.format("%B %Y"),
    moisC: tloc.format("%b %Y"),
    moisSeul: tloc.format("%b"),
    axeMois: d => (d.getMonth() === 0 ? tloc.format("%b %Y")(d) : tloc.format("%b")(d)),
    axeMoisCourt: d => (d.getMonth() === 0 ? String(d.getFullYear()) : tloc.format("%b")(d)), // axes étroits : l'année marque janvier
    /* durée en toutes lettres entre deux dates : « six semaines », « sept mois » */
    duree: (d0, d1) => {
      const j = Math.round((d1 - d0) / 864e5);
      const mots = ["zéro", "une", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze"];
      if (j < 60) { const s = Math.round(j / 7); return `${mots[s] ?? s} semaine${s > 1 ? "s" : ""}`; }
      const m = Math.round(j / 30.44); return `${(m === 1 ? "un" : mots[m]) ?? m} mois`;
    }
  };
  const parseJour = d3.timeParse("%Y-%m-%d");

  /* ---------- données ---------- */
  const jours = D.jours.map(parseJour);
  const N = jours.length;
  /* libellé d'un mois « AAAA-MM », en signalant un mois incomplet au début ou à la fin des données */
  function libMois(mo, court = false) {
    const d = parseJour(mo + "-01"), base = court ? fmt.moisC(d) : fmt.mois(d);
    const dans = D.jours.filter(j => j.startsWith(mo));
    const finMois = d3.timeDay.offset(d3.timeMonth.offset(d, 1), -1).getDate();
    const j0 = +dans[0].slice(8), j1 = +dans[dans.length - 1].slice(8);
    if (j0 === 1 && j1 === finMois) return base;
    return `${base} (${j0 === 1 ? "1er" : j0}–${j1} ${fmt.moisSeul(d)})`;
  }
  const carb = {
    g: { cle: "g", nom: "Gazole", code: "B7", classe: "g", forme: "carre" },
    s: { cle: "s", nom: "SP95", code: "E5", classe: "s", forme: "rond" }
  };
  const stationsById = new Map(D.stations.map(s => [s.id, s]));
  const panels = {};
  function panel(k) { // reconstitue le prix journalier de chaque station à partir des points de changement
    if (panels[k]) return panels[k];
    const m = new Map();
    for (const st of D.stations) {
      const pts = D.series[k][st.id] || [];
      const a = new Float64Array(N).fill(NaN);
      for (let i = 0; i < pts.length; i++) {
        const [deb, v] = pts[i];
        const fin = i + 1 < pts.length ? pts[i + 1][0] : N;
        if (v) a.fill(v / 1000, deb, fin);
      }
      m.set(st.id, a);
    }
    return (panels[k] = m);
  }
  function jourIndex(date) { return Math.max(0, Math.min(N - 1, d3.bisectLeft(jours, date))); }
  const marques = ["VITO", "TotalEnergies", "ENI", "Indépendant sans enseigne"];
  const couleurMarque = m => ({ VITO: "var(--cat-1)", TotalEnergies: "var(--cat-2)", ENI: "var(--cat-3)" }[m] || "var(--cat-autre)");
  const nomMarque = m => (m === "Indépendant sans enseigne" ? "Indépendants" : m);
  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const reduit = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- icônes ---------- */
  const ICON = {
    png: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>'
  };

  /* ---------- en-tête : menu mobile et thème ---------- */
  function initEntete() {
    const burger = document.querySelector(".burger");
    const nav = document.querySelector(".nav");
    if (burger && nav) {
      burger.addEventListener("click", () => {
        const open = nav.classList.toggle("open");
        burger.setAttribute("aria-expanded", String(open));
      });
    }
    const btn = document.querySelector(".theme-toggle");
    const root = document.documentElement;
    let saved = null;
    try { saved = localStorage.getItem("alapompe-theme"); } catch (e) { /* stockage indisponible */ }
    if (saved) root.dataset.theme = saved;
    const estSombre = () => (root.dataset.theme ? root.dataset.theme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches);
    const maj = () => {
      if (!btn) return;
      btn.innerHTML = estSombre() ? ICON.sun : ICON.moon;
      btn.setAttribute("aria-label", estSombre() ? "Passer en thème clair" : "Passer en thème sombre");
      btn.title = btn.getAttribute("aria-label");
    };
    maj();
    if (btn) btn.addEventListener("click", () => {
      root.dataset.theme = estSombre() ? "light" : "dark";
      try { localStorage.setItem("alapompe-theme", root.dataset.theme); } catch (e) { /* rien */ }
      maj();
      document.dispatchEvent(new CustomEvent("themechange"));
    });
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { maj(); document.dispatchEvent(new CustomEvent("themechange")); });
  }

  /* ---------- infobulle ---------- */
  const tip = document.createElement("div");
  tip.className = "tooltip";
  tip.setAttribute("role", "status");
  document.addEventListener("DOMContentLoaded", () => document.body.appendChild(tip));
  function el(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  /** rows : [{key: "Gazole", val: "1,799 €", sw: "carre g" | "rond s" | "ligne var(--cat-1)"}] */
  function showTip(evt, titre, rows, sousTitre) {
    tip.replaceChildren();
    tip.appendChild(el("div", "t-title", titre));
    if (sousTitre) tip.appendChild(el("div", "t-sub", sousTitre));
    for (const r of rows || []) {
      const row = el("div", "t-row");
      const k = el("span", "t-key");
      if (r.sw) {
        const s = el("span", "key");
        const [forme, c] = r.sw.split(" ");
        if (forme === "carre") { s.classList.add("key-sq"); s.classList.add("bg-" + c); }
        else if (forme === "rond") { s.classList.add("key-ci"); s.classList.add("bg-" + c); }
        else { s.classList.add("key-line"); s.style.background = c; }
        k.appendChild(s);
      }
      k.appendChild(document.createTextNode(r.key));
      row.appendChild(k);
      row.appendChild(el("span", "t-val", r.val));
      tip.appendChild(row);
    }
    moveTip(evt);
    tip.classList.add("show");
  }
  function moveTip(evt) {
    const pad = 14, w = tip.offsetWidth, h = tip.offsetHeight;
    let x, y;
    if (evt && evt.clientX != null) { x = evt.clientX + pad; y = evt.clientY + pad; }
    else if (evt && evt.target && evt.target.getBoundingClientRect) { const b = evt.target.getBoundingClientRect(); x = b.right + pad; y = b.top; }
    else { x = 20; y = 20; }
    if (x + w > window.innerWidth - 8) x = Math.max(8, (evt.clientX || x) - w - pad);
    if (y + h > window.innerHeight - 8) y = Math.max(8, window.innerHeight - h - 8);
    tip.style.left = x + "px"; tip.style.top = y + "px";
  }
  function hideTip() { tip.classList.remove("show"); }

  function toast(msg) {
    const t = el("div", "toast", msg);
    t.setAttribute("role", "status");
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }

  /* ---------- export PNG / SVG ---------- */
  const PROPS = ["fill", "fill-opacity", "stroke", "stroke-width", "stroke-opacity", "stroke-dasharray", "stroke-linecap", "stroke-linejoin",
    "opacity", "font-family", "font-size", "font-weight", "font-style", "letter-spacing", "text-anchor", "dominant-baseline",
    "paint-order", "visibility", "display", "shape-rendering"];
  function chargerPolices() {
    if (window.FONTS_B64) return Promise.resolve(window.FONTS_B64);
    return new Promise((ok, ko) => {
      const s = document.createElement("script");
      s.src = (document.querySelector('script[src*="common.js"]').getAttribute("src").replace("common.js", "fonts-embed.js"));
      s.onload = () => ok(window.FONTS_B64); s.onerror = ko;
      document.head.appendChild(s);
    });
  }
  function nomFichier(t) { return "alapompe-" + t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60); }
  async function serialiser(svgNode, titre, source) {
    const w = svgNode.viewBox.baseVal && svgNode.viewBox.baseVal.width ? svgNode.viewBox.baseVal.width : svgNode.clientWidth;
    const h = svgNode.viewBox.baseVal && svgNode.viewBox.baseVal.height ? svgNode.viewBox.baseVal.height : svgNode.clientHeight;
    const clone = svgNode.cloneNode(true);
    const src = svgNode.querySelectorAll("*"), dst = clone.querySelectorAll("*");
    src.forEach((n, i) => {
      const cs = getComputedStyle(n);
      let st = "";
      for (const p of PROPS) { const v = cs.getPropertyValue(p); if (v && v !== "normal" && v !== "auto") st += p + ":" + v + ";"; }
      dst[i].setAttribute("style", st);
      dst[i].removeAttribute("class");
    });
    const top = 64, bas = 34, mx = 0;
    const W = w + mx * 2, H = h + top + bas;
    const NS = "http://www.w3.org/2000/svg";
    const out = document.createElementNS(NS, "svg");
    out.setAttribute("xmlns", NS);
    out.setAttribute("width", W); out.setAttribute("height", H); out.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const fonts = await chargerPolices().catch(() => null);
    if (fonts) {
      const style = document.createElementNS(NS, "style");
      style.textContent = Object.entries(fonts).map(([k, b]) => {
        const [fam, poids] = k.split("|");
        return `@font-face{font-family:"${fam}";font-weight:${poids};src:url(data:font/woff2;base64,${b}) format("woff2");}`;
      }).join("");
      out.appendChild(style);
    }
    const bg = document.createElementNS(NS, "rect");
    bg.setAttribute("width", W); bg.setAttribute("height", H); bg.setAttribute("fill", css("--surface"));
    out.appendChild(bg);
    const t1 = document.createElementNS(NS, "text");
    t1.setAttribute("x", 16); t1.setAttribute("y", 36);
    t1.setAttribute("style", `font-family:"Barlow Condensed",sans-serif;font-weight:700;font-size:24px;fill:${css("--ink")}`);
    t1.textContent = titre;
    out.appendChild(t1);
    const g = document.createElementNS(NS, "g");
    g.setAttribute("transform", `translate(${mx},${top})`);
    while (clone.childNodes.length) g.appendChild(clone.childNodes[0]);
    out.appendChild(g);
    const t2 = document.createElementNS(NS, "text");
    t2.setAttribute("x", 16); t2.setAttribute("y", H - 12);
    t2.setAttribute("style", `font-family:Barlow,sans-serif;font-size:12px;fill:${css("--muted")}`);
    t2.textContent = source || "Sources : data.corsica (jusqu'au 2 juin 2026), puis prix-carburants.gouv.fr · Traitement : À la pompe (SAÉ 303)";
    out.appendChild(t2);
    return { xml: new XMLSerializer().serializeToString(out), W, H };
  }
  function telecharger(blob, nom) {
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = nom;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast("Fichier « " + nom + " » téléchargé");
    } catch (e) {
      toast("Le téléchargement est bloqué ici : ouvrez le site depuis le dossier ou en ligne.");
    }
  }
  async function exporter(svgNode, titre, type, source) {
    const { xml, W, H } = await serialiser(svgNode, titre, source);
    const nom = nomFichier(titre);
    if (type === "svg") return telecharger(new Blob([xml], { type: "image/svg+xml" }), nom + ".svg");
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
    await img.decode();
    const k = 2, cv = document.createElement("canvas");
    cv.width = W * k; cv.height = H * k;
    const ctx = cv.getContext("2d");
    ctx.scale(k, k); ctx.drawImage(img, 0, 0, W, H);
    cv.toBlob(b => telecharger(b, nom + ".png"), "image/png");
  }

  /* ---------- carte de graphique : boutons d'export + tableau de données ---------- */
  /** opts : {titre, colonnes: [{t, n?}], lignes: () => [[...]], source} */
  function equiperCarte(carte, opts) {
    const foot = carte.querySelector(".chart-foot");
    if (!foot) return;
    const box = el("div", "export");
    for (const type of ["png", "svg"]) {
      const b = el("button");
      b.type = "button";
      b.innerHTML = ICON[type];
      b.appendChild(document.createTextNode(type.toUpperCase()));
      b.setAttribute("aria-label", "Exporter le graphique en " + type.toUpperCase());
      b.addEventListener("click", () => {
        const svg = carte.querySelector(".chart svg");
        if (svg) exporter(svg, opts.titre, type, opts.source).catch(err => { console.error(err); toast("Export impossible dans ce navigateur."); });
      });
      box.appendChild(b);
    }
    foot.appendChild(box);
    if (opts.colonnes) {
      const det = el("details", "data-table");
      const sum = el("summary", null, "Voir les données sous forme de tableau");
      det.appendChild(sum);
      det.addEventListener("toggle", () => {
        if (!det.open) return;
        det.querySelector(".table-scroll")?.remove();
        const wrap = el("div", "table-scroll");
        const t = el("table");
        const cap = el("caption", "sr-only", opts.titre);
        t.appendChild(cap);
        const th = el("thead"), tr = el("tr");
        opts.colonnes.forEach(c => { const h = el("th", c.n ? "n" : null, c.t); h.scope = "col"; tr.appendChild(h); });
        th.appendChild(tr); t.appendChild(th);
        const tb = el("tbody");
        for (const ligne of opts.lignes()) {
          const r = el("tr");
          ligne.forEach((v, i) => r.appendChild(el("td", opts.colonnes[i].n ? "n" : null, v)));
          tb.appendChild(r);
        }
        t.appendChild(tb); wrap.appendChild(t); det.appendChild(wrap);
      });
      carte.appendChild(det);
    }
  }

  /* ---------- utilitaires de mise en page ---------- */
  function surRedimension(elem, fn) {
    let w = elem.clientWidth, t = null;
    const ro = new ResizeObserver(() => {
      if (Math.abs(elem.clientWidth - w) < 8) return;
      w = elem.clientWidth;
      clearTimeout(t); t = setTimeout(fn, 120);
    });
    ro.observe(elem);
  }
  function premiereVue(elem, fn) { // lance une animation la première fois que le graphique devient visible
    if (reduit() || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(es => {
      es.forEach(e => { if (e.isIntersecting) { io.disconnect(); fn(); } });
    }, { threshold: 0.35 });
    io.observe(elem);
  }
  function segmente(conteneur, onChange) { // groupe de boutons à bascule (aria-pressed)
    const bs = conteneur.querySelectorAll("button");
    bs.forEach(b => b.addEventListener("click", () => {
      bs.forEach(x => x.setAttribute("aria-pressed", String(x === b)));
      onChange(b.dataset.v);
    }));
  }
  /** chemin d'une barre horizontale à extrémité arrondie (4px), carrée côté ligne de base */
  function barreH(x0, x1, y, h, r = 4) {
    const w = x1 - x0;
    if (w <= 0) return "";
    r = Math.min(r, w, h / 2);
    return `M${x0},${y}H${x1 - r}A${r},${r} 0 0 1 ${x1},${y + r}V${y + h - r}A${r},${r} 0 0 1 ${x1 - r},${y + h}H${x0}Z`;
  }
  function barreV(x, w, y0, y1, r = 4) { // colonne : y1 = extrémité (haut si y1 < y0)
    const up = y1 < y0, hgt = Math.abs(y0 - y1);
    if (hgt < 0.5) return "";
    r = Math.min(r, hgt, w / 2);
    return up
      ? `M${x},${y0}V${y1 + r}A${r},${r} 0 0 1 ${x + r},${y1}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y1 + r}V${y0}Z`
      : `M${x},${y0}V${y1 - r}A${r},${r} 0 0 0 ${x + r},${y1}H${x + w - r}A${r},${r} 0 0 0 ${x + w},${y1 - r}V${y0}Z`;
  }
  /** marqueur de carburant : carré (B7, gazole) ou rond (E5, SP95) */
  function marqueur(sel, k, x, y, taille = 9) {
    if (k === "g") return sel.append("rect").attr("x", x - taille / 2).attr("y", y - taille / 2).attr("width", taille).attr("height", taille).attr("rx", 1.5).attr("class", "fill-g dot-ring");
    return sel.append("circle").attr("cx", x).attr("cy", y).attr("r", taille / 2 + 0.5).attr("class", "fill-s dot-ring");
  }

  /* ---------- valeurs reprises dans le texte des pages (mises à jour avec les données) ---------- */
  const I = D.indicateurs;
  const VALEURS = {
    "stations": () => String(D.meta.stations),
    "jours": () => fmt.n(N),
    "date-fin": () => fmt.jour(jours[N - 1]).trim(),
    "date-fin-court": () => fmt.jourCourt(jours[N - 1]).trim(),
    "periode": () => fmt.mois(jours[0]) + " – " + fmt.mois(jours[N - 1]),
    "maj": () => fmt.n(I.mises_a_jour),
    "p2-jours": () => String(I.periodes.P2.jours),
    "ratio-et": () => fmt.dec(I.descriptives.P2.Gazole.et / I.descriptives.P1.Gazole.et, 1),
    "note-mois-partiel": () => {
      const mo = D.jours[N - 1].slice(0, 7), dans = D.jours.filter(j => j.startsWith(mo));
      if (libMois(mo) === fmt.mois(parseJour(mo + "-01"))) return "";
      const j0 = +dans[0].slice(8), j1 = +dans[dans.length - 1].slice(8);
      return ` (* ${fmt.mois(parseJour(mo + "-01"))} : du ${j0 === 1 ? "1er" : j0} au ${j1})`;
    },
    "record-chg-date": () => fmt.jour(parseJour(Object.keys(I.top_jours_changements)[0])).trim(),
    "record-chg-n": () => String(Object.values(I.top_jours_changements)[0]),
    "genere": () => D.meta.genere ? fmt.jourC(parseJour(D.meta.genere.slice(0, 10))) : ""
  };
  document.addEventListener("DOMContentLoaded", () => {
    initEntete();
    const an = document.querySelector("[data-annee]");
    if (an) an.textContent = new Date().getFullYear();
    document.querySelectorAll("[data-ap]").forEach(e => { const f = VALEURS[e.dataset.ap]; if (f) e.textContent = f(); });
  });

  window.AP = { D, fmt, parseJour, jours, N, libMois, carb, panel, jourIndex, stationsById, marques, couleurMarque, nomMarque, css, reduit,
    ICON, showTip, moveTip, hideTip, toast, equiperCarte, exporter, surRedimension, premiereVue, segmente, barreH, barreV, marqueur, el };
})();
