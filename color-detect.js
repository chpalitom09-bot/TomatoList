/* TomatoList — détection de la couleur d'une tomate à partir de sa photo.
 *
 * Pas d'OCR : on analyse les pixels.
 *   1. on estime la couleur du fond avec le contour de l'image et on l'écarte ;
 *   2. on ignore les reflets blancs et les ombres très sombres ;
 *   3. chaque pixel restant vote pour la couleur de référence la plus proche (espace Lab) ;
 *   4. on retire le calice vert quand une autre couleur domine, puis on propose les 3 meilleures couleurs.
 *
 * C'est une aide à la décision : le modérateur valide ou corrige toujours.
 */
(function (root) {
  'use strict';

  // Couleurs « réelles » d'une tomate (plus fidèles que les pastilles de l'interface).
  var ANCHORS = {
    'Rouge': [198, 42, 31], 'Jaune': [232, 192, 42], 'Noire': [74, 42, 42], 'Verte': [125, 166, 58],
    'Orange': [238, 122, 28], 'Rose': [217, 102, 127], 'Blanche': [239, 233, 208], 'Violette': [109, 58, 94],
    'Bordeaux': [110, 27, 31], 'Crème': [230, 209, 154], 'Bleue': [74, 79, 122], 'Turquoise': [20, 184, 166],
    'Corail': [240, 115, 95], 'Saumon': [240, 154, 130], 'Chocolat': [92, 58, 33], 'Ocre': [196, 154, 58],
    'Prune': [90, 42, 69], 'Grise': [138, 138, 133], 'Dorée': [220, 178, 60]
  };
  // Couleurs voisines : deux couleurs d'une même famille ne font pas une tomate « bicolore ».
  var FAMILLES = [
    ['Rouge', 'Bordeaux', 'Corail', 'Saumon', 'Rose'],
    ['Jaune', 'Dorée', 'Ocre', 'Crème', 'Orange', 'Blanche'],
    ['Noire', 'Chocolat', 'Prune', 'Violette', 'Bordeaux', 'Bleue', 'Grise']
  ];
  // Couleurs courantes : à parts quasi égales avec une nuance voisine (Jaune/Dorée, Rouge/Bordeaux…), on propose d'abord la courante.
  var COURANTES = { 'Rouge': 1, 'Jaune': 1, 'Orange': 1, 'Rose': 1, 'Verte': 1, 'Blanche': 1, 'Noire': 1 };
  var memeFamille = function (a, b) {
    return FAMILLES.some(function (f) { return f.indexOf(a) >= 0 && f.indexOf(b) >= 0; });
  };

  var LIN = new Float64Array(256);
  for (var i = 0; i < 256; i++) { var c = i / 255; LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  var f = function (t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; };
  function rgb2lab(r, g, b) {
    var R = LIN[r], G = LIN[g], B = LIN[b];
    var fx = f((0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047);
    var fy = f(0.2126729 * R + 0.7151522 * G + 0.072175 * B);
    var fz = f((0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }
  function hex2rgb(h) {
    var m = /^#([0-9a-f]{6})$/i.exec(h || '');
    if (!m) return null;
    var n = parseInt(m[1], 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  function mediane(t) { t = t.slice().sort(function (a, b) { return a - b; }); return t[t.length >> 1] || 0; }

  // Construit la liste des références Lab : couleurs de base + couleurs ajoutées par les modérateurs.
  function construireRefs(extra) {
    var refs = [];
    Object.keys(ANCHORS).forEach(function (nom) { var a = ANCHORS[nom]; refs.push({ nom: nom, lab: rgb2lab(a[0], a[1], a[2]) }); });
    Object.keys(extra || {}).forEach(function (nom) {
      if (ANCHORS[nom]) return;
      var v = extra[nom];
      if (v && typeof v === 'object') { if (v.hex2) return; v = v.hex; } // une couleur bigarrée n'est pas une ancre : elle est traitée comme une paire
      var rgb = hex2rgb(v);
      if (rgb) refs.push({ nom: nom, lab: rgb2lab(rgb[0], rgb[1], rgb[2]) });
    });
    return refs;
  }

  function ancreDe(hex) {
    var rgb = hex2rgb(hex);
    if (!rgb) return null;
    return plusProche(rgb2lab(rgb[0], rgb[1], rgb[2]), construireRefs({}));
  }
  function plusProche(lab, refs) {
    var best = null, bd = 1e9;
    for (var k = 0; k < refs.length; k++) {
      var r = refs[k].lab;
      var dL = (lab[0] - r[0]) * 0.5, da = lab[1] - r[1], db = lab[2] - r[2]; // on tolère les variations de lumière
      var d = dL * dL + da * da + db * db;
      if (d < bd) { bd = d; best = refs[k].nom; }
    }
    return best;
  }

  // data : tableau RGBA (ImageData.data), w × h. Renvoie { poids: {nom: poids}, n }
  function classifier(data, w, h, refs, options) {
    options = options || {};
    var coin = Math.max(2, Math.round(Math.min(w, h) * 0.05));
    var anneau = { L: [], a: [], b: [] }, pas = 2, x, y, p, lab;
    for (y = 0; y < h; y += pas) for (x = 0; x < w; x += pas) {
      if (x >= coin && x < w - coin && y >= coin && y < h - coin) { x = w - coin - pas; if (x < 0) x = 0; continue; }
      p = (y * w + x) * 4;
      if (data[p + 3] < 128) continue;
      lab = rgb2lab(data[p], data[p + 1], data[p + 2]);
      anneau.L.push(lab[0]); anneau.a.push(lab[1]); anneau.b.push(lab[2]);
    }
    var fond = anneau.L.length ? [mediane(anneau.L), mediane(anneau.a), mediane(anneau.b)] : null;
    var fondFiable = false;
    if (fond) { // fond homogène (mur, table, fond blanc) = on peut le retirer sans risque
      var ecarts = anneau.L.map(function (_, i) {
        return Math.hypot(anneau.L[i] - fond[0], anneau.a[i] - fond[1], anneau.b[i] - fond[2]);
      }).sort(function (u, v) { return u - v; });
      fondFiable = ecarts[Math.floor(ecarts.length * 0.75)] < 14;
    }
    function passe(retirerFond) {
      var poids = {}, total = 0, cx = w / 2, cy = h / 2, x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < w; xx++) {
        var q = (yy * w + xx) * 4;
        if (data[q + 3] < 128) continue;
        var l = rgb2lab(data[q], data[q + 1], data[q + 2]);
        var chroma = Math.hypot(l[1], l[2]);
        if (l[0] > 96 && chroma < 6) continue; // reflet
        if (l[0] < 8) continue;                // ombre / noir du fond
        if (retirerFond && fond && Math.hypot(l[0] - fond[0], l[1] - fond[1], l[2] - fond[2]) < 18) continue;
        var dx = (xx - cx) / (w / 2), dy = (yy - cy) / (h / 2);
        var pd = Math.exp(-(dx * dx + dy * dy) / (2 * 0.55 * 0.55)); // le sujet est surtout au centre
        var nom = plusProche(l, refs);
        poids[nom] = (poids[nom] || 0) + pd;
        total += pd;
        if (pd > 0.15) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
      }
      return { poids: poids, total: total, boite: x1 >= 0 ? [x0, y0, x1, y1] : null };
    }
    var r = passe(fondFiable);
    var pleinTotal = w * h * 0.25; // poids max approximatif d'une image remplie
    if (fondFiable && r.total < pleinTotal * 0.08) { r = passe(false); r.sansRetraitFond = true; } // tomate blanche sur fond blanc
    return { poids: r.poids, total: r.total, fondFiable: fondFiable, boite: r.boite };
  }

  // Transforme des poids en parts + propositions triées
  function proposer(poids, extra) {
    var total = 0;
    Object.keys(poids).forEach(function (k) { total += poids[k]; });
    if (total <= 0) return { suggestions: [], parts: {}, confiance: 'aucune' };
    var parts = {};
    Object.keys(poids).forEach(function (k) { parts[k] = poids[k] / total; });

    // calice / feuilles : le vert est ignoré s'il est minoritaire face à une autre couleur
    var autreMax = 0;
    Object.keys(parts).forEach(function (k) { if (k !== 'Verte' && parts[k] > autreMax) autreMax = parts[k]; });
    var vertePaire = Object.keys(extra || {}).some(function (n) { var v = extra[n]; return v && typeof v === 'object' && v.hex2 && (ancreDe(v.hex) === 'Verte' || ancreDe(v.hex2) === 'Verte'); });
    if (!vertePaire && parts['Verte'] && parts['Verte'] < 0.25 && autreMax > 0.4) delete parts['Verte']; // calice
    if (parts['Grise'] && parts['Grise'] < 0.2 && autreMax > 0.5) delete parts['Grise']; // tige, ombre
    var somme = 0;
    Object.keys(parts).forEach(function (k) { somme += parts[k]; });
    Object.keys(parts).forEach(function (k) { parts[k] /= somme; });

    var tri = Object.keys(parts).map(function (k) { return { nom: k, part: parts[k] }; })
      .sort(function (a, b) { return b.part * (COURANTES[b.nom] ? 1.4 : 1) - a.part * (COURANTES[a.nom] ? 1.4 : 1); });

    // regrouper les nuances d'une même famille quand une famille domine nettement (ex. rouge clair + rouge foncé)
    var sugg = tri.slice(0, 3);
    if (tri.length > 1 && tri[0].part >= 0.28 && tri[1].part >= 0.28 && !memeFamille(tri[0].nom, tri[1].nom)
        && tri[0].part + tri[1].part >= 0.7) {
      sugg = [{ nom: 'Bicolore', part: tri[0].part + tri[1].part, detail: tri[0].nom + ' + ' + tri[1].nom }]
        .concat(tri.slice(0, 2)).slice(0, 3);
    }
    // couleurs bigarrées créées par les modérateurs (ex. Rose + Verte) : on les propose si les deux teintes sont bien présentes
    var paires = [];
    Object.keys(extra || {}).forEach(function (nom) {
      var v = extra[nom];
      if (!v || typeof v !== 'object' || !v.hex2) return;
      var a = ancreDe(v.hex), b = ancreDe(v.hex2);
      if (!a || !b || a === b) return;
      var pa = parts[a] || 0, pb = parts[b] || 0;
      if (pa >= 0.2 && pb >= 0.2 && pa + pb >= 0.55) paires.push({ nom: nom, part: pa + pb, detail: a + ' + ' + b });
    });
    if (paires.length) {
      paires.sort(function (x, y) { return y.part - x.part; });
      sugg = [paires[0]].concat(sugg.filter(function (x) { return x.nom !== paires[0].nom; })).slice(0, 3);
    }

    // confiance : on regarde la part de toute la famille de couleurs de la tête de liste (une tomate jaune peut se répartir entre Jaune et Dorée)
    var tete = (sugg[0].nom === 'Bicolore' || sugg[0].detail) ? null : sugg[0].nom, fam = sugg[0].part;
    if (tete) { fam = 0; Object.keys(parts).forEach(function (k) { if (k === tete || memeFamille(k, tete)) fam += parts[k]; }); }
    var confiance = (fam >= 0.75 && sugg[0].part >= 0.4) ? 'haute' : (fam >= 0.55 ? 'moyenne' : 'faible');
    return { suggestions: sugg, parts: parts, confiance: confiance };
  }

  function analyserPixels(data, w, h, extra) {
    var refs = construireRefs(extra);
    var c = classifier(data, w, h, refs);
    var r = proposer(c.poids, extra);
    r.boite = c.boite;
    r.poids = c.poids; r.total = c.total; r.fondFiable = c.fondFiable;
    return r;
  }

  // ── Navigateur : charge l'image (via le proxy CORS déjà utilisé par le site) et analyse ──────────
  function charger(src) {
    return new Promise(function (ok) {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.referrerPolicy = 'no-referrer';
      img.onload = function () { ok(img); };
      img.onerror = function () { ok(null); };
      img.src = src;
    });
  }
  function proxy(u, w) { return 'https://wsrv.nl/?url=' + encodeURIComponent(u) + '&w=' + w + '&h=' + w + '&fit=inside&output=png&we=1'; }

  async function analyserUrl(url, extra, taille) {
    taille = taille || 200;
    if (!/^https?:\/\//i.test(url || '')) return null;
    var img = await charger(/wsrv\.nl/.test(url) ? url : proxy(url, taille));
    if (!img) img = await charger(url);
    if (!img) return null;
    var ratio = Math.min(1, taille / Math.max(img.naturalWidth, img.naturalHeight));
    var w = Math.max(8, Math.round(img.naturalWidth * ratio)), h = Math.max(8, Math.round(img.naturalHeight * ratio));
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    var data;
    try { data = ctx.getImageData(0, 0, w, h).data; } catch (e) { return null; } // image « tainted » (pas de CORS)
    var res = analyserPixels(data, w, h, extra);
    res.recadrage = recadrer(cv, res.boite);
    return res;
  }
  // Recadre sur le sujet détecté (avec une marge) ; si la boîte est suspecte, on garde toute l'image
  function recadrer(cv, b) {
    if (!b) return cv;
    var w = cv.width, h = cv.height, mx = Math.round((b[2] - b[0]) * 0.1) + 2, my = Math.round((b[3] - b[1]) * 0.1) + 2;
    var x0 = Math.max(0, b[0] - mx), y0 = Math.max(0, b[1] - my), x1 = Math.min(w - 1, b[2] + mx), y1 = Math.min(h - 1, b[3] + my);
    var cw = x1 - x0 + 1, ch = y1 - y0 + 1;
    if (cw * ch < w * h * 0.08) return cv;
    var out = document.createElement('canvas');
    out.width = cw; out.height = ch;
    out.getContext('2d').drawImage(cv, x0, y0, cw, ch, 0, 0, cw, ch);
    return out;
  }

  // Plusieurs photos : on additionne les poids de chaque photo analysée
  async function analyserPhotos(urls, extra) {
    var cumul = {}, utiles = 0, resultats = [], recadrages = [];
    for (var i = 0; i < Math.min(3, urls.length); i++) {
      var r = await analyserUrl(urls[i], extra);
      resultats.push(r);
      if (!r || !r.total) continue;
      utiles++;
      if (r.recadrage) recadrages.push(r.recadrage);
      Object.keys(r.poids).forEach(function (k) { cumul[k] = (cumul[k] || 0) + r.poids[k] / r.total; });
    }
    if (!utiles) return { suggestions: [], parts: {}, confiance: 'aucune', photos: resultats.length };
    var fin = proposer(cumul, extra);
    fin.photos = utiles; fin.recadrages = recadrages;
    return fin;
  }

  // Fusionne l'avis de l'IA (probabilités par couleur, somme = 1) et celui des pixels
  function fusionner(pixels, ia) {
    var noms = {};
    Object.keys(pixels.parts || {}).forEach(function (k) { noms[k] = 1; });
    Object.keys(ia || {}).forEach(function (k) { noms[k] = 1; });
    (pixels.suggestions || []).forEach(function (s) { noms[s.nom] = 1; });
    var sp = {};
    (pixels.suggestions || []).forEach(function (s) { sp[s.nom] = s.part; });
    var sc = Object.keys(noms).map(function (k) {
      var px = sp[k] != null ? sp[k] : (pixels.parts[k] || 0);
      return { nom: k, part: 0.6 * (ia[k] || 0) + 0.4 * px, ia: ia[k] || 0, detail: (pixels.suggestions.filter(function (s) { return s.nom === k; })[0] || {}).detail };
    }).sort(function (a, b) { return b.part - a.part; });
    var top = sc.slice(0, 3);
    var gap = top.length > 1 ? top[0].part - top[1].part : top[0] ? top[0].part : 0;
    return { suggestions: top, parts: pixels.parts, confiance: top[0] && top[0].part >= 0.55 && gap > 0.15 ? 'haute' : (top[0] && top[0].part >= 0.35 ? 'moyenne' : 'faible'), photos: pixels.photos, ia: true };
  }

  var API = { fusionner: fusionner, ancreDe: ancreDe, analyserPixels: analyserPixels, analyserUrl: analyserUrl, analyserPhotos: analyserPhotos, ANCHORS: ANCHORS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.ColorDetect = API;
})(typeof window !== 'undefined' ? window : globalThis);
