/* fiche-visuals.js — éléments visuels des fiches tomates
   - FV.tomato(couleur, px)            : petite tomate SVG réaliste, à la couleur de la variété
   - FV.weightScale(poids, taille, c)  : échelle poids/taille (plus petite → plus grosse tomate du monde)
   - FV.country(nom, code)             : silhouette du pays (frontières noires), chargée depuis countries-shapes.json
   - FV.cycle(cycle, semis, couleur)   : animation du cycle de culture (SMIL, aucune lib)
   - FV.hydrate(racine)                : à appeler après l'insertion du HTML (remplit les pays) */
(function () {
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const L = (k, d) => {
    try { const v = typeof tr === 'function' ? tr(k) : k; return v && v !== k ? v : d; } catch (e) { return d; }
  };
  let uid = 0;

  // ── Couleurs de base des tomates ──────────────────────────────────────────
  const PAL = {
    rouge: '#e03a2f', jaune: '#f6c21b', noire: '#4a2a33', verte: '#7db240', orange: '#f2800f',
    rose: '#ea6197', blanche: '#f3efdc', violette: '#6c43c9', bordeaux: '#7a1d2b', creme: '#e5c98b',
    bleue: '#3f61d6', turquoise: '#19b3a1', corail: '#fb6f5f', saumon: '#f98a7c', chocolat: '#6a3f26',
    ocre: '#cf9a3c', prune: '#722a4e', grise: '#a3a9b3', doree: '#d9b23a',
    bicolore: '#ee7a2c', rayee: '#a8b83a', 'arc-en-ciel': '#e05a7a'
  };
  const baseColor = c => PAL[norm(c)] || PAL.rouge;

  function fillDef(color, id) {
    const k = norm(color);
    if (k === 'bicolore')
      return `<linearGradient id="${id}f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e53935"/><stop offset=".42" stop-color="#ec5a35"/><stop offset=".6" stop-color="#f5a623"/><stop offset="1" stop-color="#f7c52a"/></linearGradient>`;
    if (k === 'rayee')
      return `<linearGradient id="${id}f" x1="0" y1="0" x2=".2" y2="0" spreadMethod="repeat"><stop offset="0" stop-color="#6fae3f"/><stop offset=".5" stop-color="#6fae3f"/><stop offset=".5" stop-color="#e9b52a"/><stop offset="1" stop-color="#e9b52a"/></linearGradient>`;
    if (k === 'arc-en-ciel')
      return `<linearGradient id="${id}f" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ef4444"/><stop offset=".25" stop-color="#f59e0b"/><stop offset=".5" stop-color="#84cc16"/><stop offset=".75" stop-color="#3b82f6"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient>`;
    return `<linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${baseColor(color)}"/><stop offset="1" stop-color="${baseColor(color)}"/></linearGradient>`;
  }

  // ── Tomate réaliste ───────────────────────────────────────────────────────
  // Les dégradés sont définis UNE fois par couleur dans un <svg> caché : les cartes
  // n'embarquent plus de <defs> (HTML plus léger, rendu stable, pas de filtre coûteux).
  const defsDone = {};
  function defsHolder() {
    let h = document.getElementById('fv-defs');
    if (!h) {
      document.body.insertAdjacentHTML('beforeend', '<svg id="fv-defs" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true" focusable="false"><defs></defs></svg>');
      h = document.getElementById('fv-defs');
      h.firstChild.insertAdjacentHTML('beforeend', `<radialGradient id="fvt-s" cx=".36" cy=".3" r=".85"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset=".62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".42"/></radialGradient><linearGradient id="fvt-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cb342"/><stop offset="1" stop-color="#3d7a1f"/></linearGradient>`);
    }
    return h.firstChild;
  }
  function tomatoId(color) {
    const id = 'fvt-' + (norm(color).replace(/[^a-z]/g, '') || 'rouge');
    if (!defsDone[id]) { defsDone[id] = 1; defsHolder().insertAdjacentHTML('beforeend', fillDef(color, id)); }
    return id;
  }
  function tomato(color, px) {
    px = px || 22;
    const id = tomatoId(color);
    const body = 'M32 17 C22 10 5 16 5 35 C5 51 17 60 32 60 C47 60 59 51 59 35 C59 16 42 10 32 17Z';
    const sepal = a => `<path transform="rotate(${a} 32 19)" d="M32 19 C28.5 22 27.5 28 32 33 C36.5 28 35.5 22 32 19Z"/>`;
    return `<svg class="fv-tomato" viewBox="0 0 64 66" width="${px}" height="${Math.round(px * 66 / 64)}" aria-hidden="true" focusable="false">
  <ellipse cx="32" cy="62" rx="19" ry="2.6" fill="#000" opacity=".16"/>
  <path d="${body}" fill="url(#${id}f)"/>
  <path d="${body}" fill="url(#fvt-s)"/>
  <path d="M32 18 C25 30 25 47 32 59 M32 18 C39 30 39 47 32 59" fill="none" stroke="#000" stroke-opacity=".09" stroke-width="1.2"/>
  <ellipse cx="20" cy="29" rx="4.6" ry="8" transform="rotate(28 20 29)" fill="#fff" opacity=".34"/>
  <g fill="url(#fvt-g)" stroke="#2f5f17" stroke-width=".4" stroke-linejoin="round">${[-78, -40, 0, 40, 78].map(sepal).join('')}</g>
  <path d="M32 20 C31.5 15 32 11 34 8" fill="none" stroke="#4d7c0f" stroke-width="2.4" stroke-linecap="round"/>
</svg>`;
  }

  // Miniature légère (proxy d'images redimensionnées) : évite de télécharger/décoder des photos de plusieurs Mo
  function thumb(u, w) {
    if (!u || !/^https?:\/\//i.test(u)) return u;
    if (/images\.unsplash\.com/.test(u)) return /[?&]w=\d+/.test(u) ? u.replace(/([?&])w=\d+/, '$1w=' + w) : u + (u.includes('?') ? '&' : '?') + 'w=' + w;
    if (/wsrv\.nl/.test(u)) return u;
    return 'https://wsrv.nl/?url=' + encodeURIComponent(u) + '&w=' + w + '&output=webp&q=72&we=1';
  }

  // ── Échelle poids / taille ────────────────────────────────────────────────
  const W_MIN = 1, W_MAX = 7661; // ~1 g (tomate groseille) → 7,66 kg (record Guinness 2025)
  const SIZE_W = { cerise: 15, petite: 55, moyenne: 140, grosse: 300, 'tres grosse': 600 };
  const fmtW = g => g >= 1000 ? (g / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' kg' : Math.round(g) + ' g';
  const posOf = g => Math.min(1, Math.max(0, Math.log(g / W_MIN) / Math.log(W_MAX / W_MIN)));

  function weightScale(weight, sizeLabel, color, rawSize) {
    let w = Number(weight) || 0;
    if (!w && rawSize) w = SIZE_W[norm(rawSize)] || 0;
    if (!w) return '';
    const p = posOf(w);
    const vis = Math.min(96, Math.max(4, p * 100));
    const ticks = [1, 10, 100, 1000].map(g => `<i style="left:${posOf(g) * 100}%"><b>${fmtW(g)}</b></i>`).join('');
    const head = (weight ? `<b>${fmtW(w)}</b>` : `<b>≈ ${fmtW(w)}</b>`) + (sizeLabel ? ` <span>· ${sizeLabel}</span>` : '');
    return `<div class="fv-card">
  <div class="fv-card-title">${L('fv_weight_size', 'Poids &amp; taille')}</div>
  <div class="fv-scale-head">${head}</div>
  <div class="fv-scale">
    <div class="fv-end fv-end-l">${tomato(color, 14)}<small>${L('fv_smallest', 'Plus petite')}<br>~1 g</small></div>
    <div class="fv-track-wrap">
      <div class="fv-marker" style="--p:${vis}%">${tomato(color, 34)}<span class="fv-pin"></span></div>
      <div class="fv-track"><span class="fv-fill" style="--p:${vis}%"></span>${ticks}</div>
    </div>
    <div class="fv-end fv-end-r">${tomato(color, 40)}<small>${L('fv_biggest', 'Record')}<br>7,66 kg</small></div>
  </div>
  <div class="fv-note">${L('fv_log_note', 'Échelle logarithmique : de la plus petite à la plus grosse tomate du monde.')}</div>
</div>`;
  }

  // ── Pays (silhouette) ─────────────────────────────────────────────────────
  let shapesPromise = null;
  function loadShapes() {
    if (!shapesPromise) shapesPromise = fetch('countries-shapes.json').then(r => r.json()).catch(() => ({}));
    return shapesPromise;
  }
  function country(name, code) {
    if (!name) return '';
    return `<div class="fv-country-row"><div class="fv-country" data-code="${code || ''}"></div><span>${name}</span></div>`;
  }
  function hydrate(root) {
    root = root || document;
    root.querySelectorAll('.fv-country[data-code]').forEach(el => {
      const code = el.getAttribute('data-code');
      if (!code) { el.remove(); return; }
      loadShapes().then(S => {
        const s = S[code];
        if (!s) { el.remove(); return; }
        const k = 1.45, w = (s.w + 4) * k, h = (s.h + 4) * k;
        el.innerHTML = `<svg viewBox="-2 -2 ${s.w + 4} ${s.h + 4}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" role="img" aria-label="${code}">
  <path d="${s.d}" fill="#fff1e8" stroke="#111" stroke-width="1.6" stroke-linejoin="round" vector-effect="non-scaling-stroke" fill-rule="evenodd"/></svg>`;
      });
    });
    root.querySelectorAll('svg.fv-cycle-svg').forEach(svg => {
      if (svg._fvWatch) return;
      const days = +svg.getAttribute('data-days') || 0, out = svg.querySelector('.fv-day');
      let inView = true, paused = false;
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver(es => { inView = es[es.length - 1].isIntersecting; }, { threshold: 0 });
        io.observe(svg);
        svg._fvIO = io;
      }
      svg._fvWatch = setInterval(() => {
        if (!svg.isConnected) { clearInterval(svg._fvWatch); if (svg._fvIO) svg._fvIO.disconnect(); return; }
        const hidden = !inView || !!svg.closest('.modal-overlay:not(.active)') || document.hidden;
        try {
          if (hidden && !paused) { svg.pauseAnimations(); paused = true; }
          else if (!hidden && paused) { svg.unpauseAnimations(); paused = false; }
        } catch (e) {}
        if (hidden || !days || !out) return;
        const f = Math.min(1, ((svg.getCurrentTime() % DUR) / DUR) / .8);
        const txt = Math.round(f * days) + ' / ' + days;
        if (out.textContent !== txt) out.textContent = txt;
      }, 250);
    });
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.querySelectorAll('svg.fv-cycle-svg').forEach(svg => {
        try { svg.setCurrentTime(DUR * .88); svg.pauseAnimations(); } catch (e) {}
      });
    }
  }

  // ── Cycle animé : coupe de jardin ─────────────────────────────────────────
  const DUR = 16;
  const EASE = '.45 0 .2 1';
  const an = (attr, vals, times, o) => {
    o = o || {};
    const sp = o.ease ? ` calcMode="spline" keySplines="${vals.slice(1).map(() => EASE).join(';')}"` : '';
    return `<animate attributeName="${attr}" values="${vals.join(';')}" keyTimes="${times.join(';')}" dur="${o.dur || DUR}s" repeatCount="indefinite"${sp}/>`;
  };
  const at = (type, vals, times, o) => {
    o = o || {};
    const sp = o.ease ? ` calcMode="spline" keySplines="${vals.slice(1).map(() => EASE).join(';')}"` : '';
    return `<animateTransform attributeName="transform" type="${type}" values="${vals.join(';')}" keyTimes="${times.join(';')}" dur="${o.dur || DUR}s" repeatCount="indefinite"${sp}/>`;
  };
  // pousse un trait (pathLength=1) entre t0 et t1
  const grow = (d, t0, t1, stroke, w, extra) =>
    `<path d="${d}" pathLength="1" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1" stroke-dashoffset="1" opacity="0" ${extra || ''}>${an('stroke-dashoffset', [1, 1, 0, 0], [0, t0, t1, 1], { ease: true })}${an('opacity', [0, 0, 1, 1], [0, t0, Math.min(.999, t0 + .002), 1])}</path>`;
  // apparition par échelle (avec léger dépassement) puis balancement continu
  const pop = (inner, t0, t1, sway, swayDur, pivot) => {
    const s = at('scale', [0, 0, 1, 1], [0, t0, t1, 1], { ease: true });
    const w = sway ? `<g>${at('rotate', [`${-sway} ${pivot || '0 0'}`, `${sway} ${pivot || '0 0'}`, `${-sway} ${pivot || '0 0'}`], [0, .5, 1], { ease: true, dur: swayDur || 5 })}${inner}</g>` : inner;
    return `<g>${s}${w}</g>`;
  };

  const LEAFLET = 'M0 0 C2 -3.6 5.2 -5.8 8.6 -5.1 L9.6 -7 C11.6 -5.2 13.6 -3.9 15.2 -1.2 L17.2 -.9 C16.2 1.3 14.6 3.1 12.2 4.1 L12.6 6.1 C8.6 5.3 4 3.9 0 0Z';
  function compoundLeaf() {
    const lf = (x, a, s) => `<g transform="translate(${x} 0) rotate(${a}) scale(${s})"><path d="${LEAFLET}" fill="url(#fvlf)" stroke="#34581c" stroke-width=".55" stroke-linejoin="round"/><path d="M0 0 L13 -.6" stroke="#34581c" stroke-width=".45" opacity=".7"/></g>`;
    return `<path d="M0 0 C10 -1.5 22 -1 33 0" fill="none" stroke="#4c7a2a" stroke-width="1.3" stroke-linecap="round"/>` +
      lf(7, -58, .7) + lf(7, 58, .7) + lf(15, -52, .85) + lf(15, 52, .85) + lf(24, -48, .8) + lf(24, 48, .8) + lf(32, 0, 1.15);
  }
  function leaf(x, y, rot, s, t0, t1, swayDur) {
    return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">${pop(compoundLeaf(), t0, t1, 2.2, swayDur)}</g>`;
  }
  function flower(x, y, t0, t1) {
    const pet = [0, 60, 120, 180, 240, 300].map(a => `<ellipse cx="0" cy="-3.7" rx="1.35" ry="3.7" transform="rotate(${a})" fill="#ffd23f" stroke="#d99a00" stroke-width=".25"/>`).join('');
    return `<g transform="translate(${x} ${y})"><g>${at('scale', [0, 0, 1, 1, 0, 0], [0, t0, t0 + .035, t1, t1 + .03, 1], { ease: true })}${pet}<path d="M-1.4 0 L0 -3.2 L1.4 0Z" fill="#f2a900"/><circle r="1.1" fill="#b45f06"/></g></g>`;
  }
  function fruit(x, y, r, base, mid, t0) {
    const ry = r * .93, top = -ry;
    const star = `<path transform="translate(0 ${top + 1}) scale(${r / 8.5})" d="M0,-2.6 L1,-1 L3.8,-1.6 L2,.4 L3.4,2.8 L.8,1.7 L0,3.4 L-.8,1.7 L-3.4,2.8 L-2,.4 L-3.8,-1.6 L-1,-1Z" fill="#3f7d20"/>`;
    const fillAnim = mid ? an('fill', ['#8cba4d', '#8cba4d', mid, base, base], [0, t0 + .1, t0 + .2, t0 + .3, 1], { ease: true })
      : an('fill', ['#8cba4d', '#8cba4d', base, base], [0, t0 + .1, t0 + .3, 1], { ease: true });
    return `<g transform="translate(${x} ${y})">${pop(`<ellipse rx="${r}" ry="${ry}" fill="#8cba4d">${fillAnim}</ellipse>
      <ellipse rx="${r}" ry="${ry}" fill="url(#fvcs)"/>
      <ellipse cx="${-r * .38}" cy="${-r * .3}" rx="${r * .2}" ry="${r * .36}" transform="rotate(28 ${-r * .38} ${-r * .3})" fill="#fff" opacity=".38"/>${star}`, t0, t0 + .14, 2.5, 4.5, `0 ${top}`)}</g>`;
  }
  const mixHex = (a, b, k) => {
    const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const A = p(a), B = p(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join('');
  };
  function truss(sx, sy, dir, t0, base, mid) {
    const P = [[12, 8, 15, 19, 6.6], [23, 11, 27, 25, 8.2], [33, 11, 38, 20, 6.2]];
    const ped = `M0 0 C${dir * 8} -3 ${dir * 22} -2 ${dir * 36} 11`;
    const sticks = P.map(p => `<path d="M${dir * p[0]} ${p[1] - 1} L${dir * p[2]} ${p[3] - p[4]}" stroke="#5b8c3a" stroke-width="1" fill="none" stroke-linecap="round" stroke-dasharray="1" pathLength="1" stroke-dashoffset="1" opacity="0">${an('stroke-dashoffset', [1, 1, 0, 0], [0, t0 + .04, t0 + .08, 1])}${an('opacity', [0, 0, 1, 1], [0, t0 + .04, t0 + .042, 1])}</path>`).join('');
    const fl = P.map((p, i) => flower(dir * p[2], p[3] - 3, t0 + .06 + i * .008, t0 + .15)).join('');
    const fr = P.map((p, i) => fruit(dir * p[2], p[3], p[4], base, mid, t0 + .15 + i * .015)).join('');
    return `<g transform="translate(${sx} ${sy})">${grow(ped, t0, t0 + .08, '#5b8c3a', 1.6)}${sticks}${fl}${fr}</g>`;
  }

  function cycle(cycleTxt, semisTxt, color) {
    if (!cycleTxt) return '';
    const base = baseColor(color);
    const k = norm(color);
    const warm = ['rouge', 'corail', 'saumon', 'orange', 'bordeaux', 'rose', 'prune', 'bicolore', 'noire', 'chocolat'].includes(k);
    const mid = k === 'verte' ? null : (warm ? '#e8a23a' : mixHex('#8cba4d', base, .5));
    const nums = (String(cycleTxt).match(/\d+/g) || []).map(Number);
    const days = nums.length ? Math.max.apply(null, nums) : 0;

    const stages = [['Semis', 'fv_st_sow', 0], ['Levée', 'fv_st_up', .12], ['Croissance', 'fv_st_grow', .3], ['Floraison', 'fv_st_flower', .55], ['Fruits', 'fv_st_green', .66], ['Maturité', 'fv_st_ripe', .8]];
    const X = i => 32 + i * 51.2;
    const labels = stages.map(([d, key, a], i) => {
      const b = i < 5 ? stages[i + 1][2] : 1, f = .02;
      const vals = i === 0 ? [1, 1, .4, .4] : i === 5 ? [.4, .4, 1, 1] : [.4, .4, 1, 1, .4, .4];
      const times = i === 0 ? [0, b - f, b, 1] : i === 5 ? [0, a, a + f, 1] : [0, a, a + f, b - f, b, 1];
      return `<text x="${X(i)}" y="209" text-anchor="middle" font-size="9" fill="#3b4a2a" opacity=".4">${L(key, d)}${an('opacity', vals, times)}</text>`;
    }).join('');
    const ticks = stages.map((s, i) => `<circle cx="${X(i)}" cy="198" r="2.2" fill="#fbf5e6" stroke="#8a9a6a" stroke-width="1"/>`).join('');
    const mk = stages.map((s, i) => X(i));
    const markerVals = [...mk, mk[5]];
    const markerTimes = [...stages.map(s => s[2]), 1];

    const grass = Array.from({ length: 34 }, (_, i) => {
      const x = 6 + i * 9.4 + (i % 3) * 1.3, h = 3 + (i * 7 % 5);
      return `<path d="M${x} 141 q${(i % 2 ? 1 : -1) * 1.5} ${-h * .6} ${(i % 2 ? 2.5 : -2.5)} ${-h}" stroke="#6a9a3b" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
    }).join('');
    const specks = Array.from({ length: 46 }, (_, i) => {
      const x = (i * 53) % 312 + 4, y = 150 + (i * 31) % 34, r = .6 + (i % 4) * .35;
      return `<circle cx="${x}" cy="${y}" r="${r}" fill="${i % 3 ? '#6e4a2c' : '#b08a5b'}" opacity=".55"/>`;
    }).join('');
    const roots = [
      ['M150 158 C149 168 152 176 150 185', .1, .3, 1.8], ['M150 163 C140 166 132 168 124 176', .2, .34, 1.1], ['M150 166 C160 168 170 171 178 179', .22, .36, 1.1],
      ['M150 173 C144 176 140 180 134 184', .26, .38, .9], ['M150 175 C157 178 161 181 166 185', .28, .4, .9]
    ].map(r => grow(r[0], r[1], r[2], '#efe2bd', r[3])).join('');

    const info = `<div class="fv-cycle-info"><b>${L('fv_cycle', 'Cycle')} : ${cycleTxt}</b>${semisTxt ? `<span>${L('fv_sow', 'Semis')} : ${semisTxt}</span>` : ''}</div>`;
    return `<div class="fv-card">
  <div class="fv-card-title">${L('fv_cycle_title', 'Cycle de culture')}</div>
  <svg class="fv-cycle-svg" data-days="${days}" viewBox="0 0 320 214" role="img" aria-label="${L('fv_cycle_title', 'Cycle de culture')}">
    <defs>
      <linearGradient id="fvlf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#86b24a"/><stop offset="1" stop-color="#4f7f2a"/></linearGradient>
      <linearGradient id="fvsoil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a5232"/><stop offset="1" stop-color="#4e3320"/></linearGradient>
      <radialGradient id="fvcs" cx=".36" cy=".3" r=".85"><stop offset="0" stop-color="#fff" stop-opacity=".4"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".34"/></radialGradient>
    </defs>
    <rect width="320" height="214" rx="14" fill="#fbf5e6"/>
    <rect x="3" y="3" width="314" height="208" rx="11" fill="none" stroke="#d8c9a3" stroke-width=".8"/>
    <text x="16" y="21" font-size="10" letter-spacing=".08em" fill="#7a6a45">${L('fv_day', 'JOUR').toUpperCase()}</text>
    <text class="fv-day" x="56" y="21" font-size="13" font-weight="700" fill="#3b4a2a">0${days ? ' / ' + days : ''}</text>
    <path d="M10 141 L310 141 L310 174 Q310 188 296 188 L24 188 Q10 188 10 174Z" fill="url(#fvsoil)"/>
    <g opacity=".9">${specks}</g>
    <path d="M10 141 L310 141" stroke="#5f8b34" stroke-width="3.2" stroke-linecap="round"/>
    ${grass}
    <g>${an('opacity', [1, 1, 0, 0, 1], [0, .95, .985, .999, 1])}
      ${roots}
      <g transform="translate(150 152) rotate(-18)"><g>${at('scale', [1, 1, 1.35, 1.35], [0, .02, .1, 1], { ease: true })}<ellipse rx="4.4" ry="2.9" fill="#e8d7a0" stroke="#a88f4e" stroke-width=".7"/><path d="M-2.5 -.6 L2.6 -.4" stroke="#c4ad6f" stroke-width=".5"/></g></g>
      ${grow('M150 152 C150 148 151 144 150 139', .13, .22, '#efe2bd', 2.2)}
      <g>
        <rect x="159" y="40" width="2.6" height="106" rx="1.2" fill="#b98c55" stroke="#8a6535" stroke-width=".5" transform="translate(0 0)">${an('height', [0, 0, 106, 106], [0, .34, .44, 1], { ease: true })}${an('y', [146, 146, 40, 40], [0, .34, .44, 1], { ease: true })}</rect>
      </g>
      ${grow('M150 140 C148 122 152 104 149 88 C147 72 152 58 150 44', .22, .5, '#4c7a2a', 3.4)}
      ${pop('<ellipse cx="-9" cy="0" rx="9" ry="2.6" fill="#8ab653" stroke="#4f7f2a" stroke-width=".5" transform="rotate(8)"/>', .26, .33, 0).replace('<g>', '<g transform="translate(150 130)">')}
      ${pop('<ellipse cx="9" cy="0" rx="9" ry="2.6" fill="#8ab653" stroke="#4f7f2a" stroke-width=".5" transform="rotate(-8)"/>', .27, .34, 0).replace('<g>', '<g transform="translate(150 128)">')}
      ${leaf(150, 128, -16, 1, .31, .4, 5.5)}${leaf(150, 120, 196, 1, .33, .42, 6.5)}
      ${leaf(150, 108, 202, .95, .36, .45, 6)}${leaf(150, 76, -32, .92, .4, .48, 5.2)}
      ${leaf(150, 62, -38, .85, .42, .5, 7)}${leaf(150, 54, 216, .82, .43, .5, 6.2)}${leaf(150, 45, -78, .6, .45, .52, 5)}
      <g>
        ${[[128, .4], [96, .43], [66, .46]].map(([y, t]) => `<g transform="translate(150 ${y})">${pop('<path d="M-2.4 -1.2 C0 .3 2.4 .3 4.8 -1.2 M-2.4 1.2 C0 2.7 2.4 2.7 4.8 1.2" stroke="#e7d9a8" stroke-width="1.1" fill="none" stroke-linecap="round"/><path d="M4.2 -2 L4.6 2.4" stroke="#e7d9a8" stroke-width=".9"/>', t, t + .05, 0)}</g>`).join('')}
      </g>
      ${truss(150, 92, 1, .5, base, mid)}
      ${truss(150, 70, -1, .52, base, mid)}
      <g>${an('opacity', [0, 0, 1, 1, 0, 0], [0, .55, .57, .66, .69, 1])}
        <g><animateMotion dur="${DUR}s" repeatCount="indefinite" keyTimes="0;.55;.68;1" keyPoints="0;0;1;1" calcMode="linear" path="M110 40 C128 58 118 76 132 86 S170 108 178 118 S196 90 214 58 S250 30 292 40"/>
          <ellipse cx="0" cy="0" rx="3.3" ry="2.3" fill="#f2bf0d" stroke="#3a2a05" stroke-width=".4"/><path d="M-.7 -2 L-.7 2 M1 -2.1 L1 2.1" stroke="#3a2a05" stroke-width=".9"/>
          <ellipse cx="-.6" cy="-3.4" rx="2.6" ry="1.5" fill="#fff" opacity=".75" stroke="#9bb" stroke-width=".25">${an('ry', [1.5, .4, 1.5], [0, .5, 1], { dur: .12 })}</ellipse>
        </g>
      </g>
    </g>
    <line x1="${X(0)}" y1="198" x2="${X(5)}" y2="198" stroke="#8a9a6a" stroke-width="1"/>
    ${ticks}
    <circle r="4" cy="198" fill="#2f7d32" stroke="#fbf5e6" stroke-width="1.4"><animate attributeName="cx" values="${markerVals.join(';')}" keyTimes="${markerTimes.join(';')}" dur="${DUR}s" repeatCount="indefinite"/></circle>
    ${labels}
  </svg>
  ${info}
</div>`;
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const css = `
.fv-inline{display:inline-flex;align-items:center;gap:8px}
.fv-tomato{display:inline-block;vertical-align:middle;flex-shrink:0}
.fv-card{margin:0 0 22px;padding:16px 18px;border:1px solid var(--line,#e5e7eb);border-radius:16px;background:var(--card-bg,rgba(255,255,255,.6))}
.fv-card-title{font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted,#6b7280);margin-bottom:10px}
.fv-scale-head{font-size:15px;margin-bottom:4px}.fv-scale-head span{color:var(--text-muted,#6b7280)}
.fv-scale{display:flex;align-items:flex-end;gap:10px;padding-top:6px}
.fv-end{display:flex;flex-direction:column;align-items:center;gap:3px;text-align:center;min-width:48px}
.fv-end small{font-size:10.5px;line-height:1.25;color:var(--text-muted,#6b7280)}
.fv-track-wrap{position:relative;flex:1;min-width:0;height:78px;margin-bottom:34px}
.fv-track{position:absolute;left:0;right:0;bottom:0;height:8px;border-radius:99px;background:linear-gradient(90deg,#fde8e4,#f3c9c1);box-shadow:inset 0 1px 2px rgba(0,0,0,.12)}
.fv-fill{position:absolute;left:0;top:0;bottom:0;border-radius:99px;background:linear-gradient(90deg,#f7a99d,#e03a2f);width:var(--p);animation:fvGrow 1.1s cubic-bezier(.22,1,.36,1) both}
.fv-track i{position:absolute;top:-3px;width:1.5px;height:14px;background:rgba(0,0,0,.28);transform:translateX(-50%)}
.fv-track i b{position:absolute;top:18px;left:50%;transform:translateX(-50%);font-size:10px;font-style:normal;font-weight:600;color:var(--text-muted,#6b7280);white-space:nowrap}
.fv-marker{position:absolute;bottom:6px;left:var(--p);transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;animation:fvSlide 1.1s cubic-bezier(.34,1.4,.5,1) both}
.fv-pin{width:2px;height:10px;background:#111;border-radius:2px;margin-top:-2px}
.fv-note{font-size:11px;color:var(--text-muted,#6b7280);margin-top:2px}
.fv-country-row{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.fv-country svg{display:block;max-width:100%;height:auto}
.fv-cycle-svg{display:block;width:100%;max-width:480px;height:auto;border-radius:14px}
.fv-cycle-info{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:10px;font-size:14px}
.fv-cycle-info span{color:var(--text-muted,#6b7280)}
@keyframes fvSlide{from{left:0}to{left:var(--p)}}
@keyframes fvGrow{from{width:0}to{width:var(--p)}}
@media (prefers-reduced-motion:reduce){.fv-marker,.fv-fill{animation:none}}
`;
  const st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  // ── Extraction du cycle / semis depuis la description importée ───────────
  function parseCulture(t) {
    const d = (t && t.description) || '';
    const c = (t && t.cycle) || ((/cycle\s+([^,.\n]+)/i.exec(d) || [])[1] || '').trim();
    const s = (t && t.semis) || ((/semis\s+([^,.\n]+)/i.exec(d.split('Culture :')[1] || '') || [])[1] || '').trim();
    return { cycle: c, semis: s };
  }

  // Couleurs ajoutées par les modérateurs : on enregistre la teinte, et on force la régénération du dégradé
  function registerColor(name, hex) {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex || '')) return;
    const k = norm(name);
    PAL[k] = hex;
    const id = 'fvt-' + (k.replace(/[^a-z]/g, '') || 'rouge');
    delete defsDone[id];
    const old = document.getElementById(id + 'f');
    if (old) old.remove();
  }
  window.FV = { tomato, thumb, weightScale, country, cycle, hydrate, parseCulture, registerColor };
})();
