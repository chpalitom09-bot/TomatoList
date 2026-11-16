/* wiki.js — bloc « En savoir plus » : résumé de l'article Wikipédia de la variété
   - cherche l'article (API MediaWiki) puis lit le résumé (API REST), sans clé ni compte
   - ne garde un article que s'il parle bien de tomate ET contient le nom de la variété
   - sinon : résumé de l'article général « Tomate » (clairement indiqué)
   - résultats mis en cache 30 jours dans le navigateur (localStorage)
   - source Wikipédia + logo + licence CC BY-SA affichés (obligatoires) */
(function () {
  const SEARCH = 'https://fr.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=4&srsearch=';
  const SUMMARY = 'https://fr.wikipedia.org/api/rest_v1/page/summary/';
  const LOGO = 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Wikipedia-logo-v2.svg/64px-Wikipedia-logo-v2.svg.png';
  const KEY = 'tl_wiki_v1', TTL = 30 * 24 * 3600 * 1000, MAX_ENTRIES = 80;
  const STOP = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'tomate', 'tomates', 'hybride', 'f1', 'ancienne', 'variete']);

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const sig = name => norm(name).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));

  // ── Cache ─────────────────────────────────────────────────────────────────
  function readCache() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function writeCache(c) {
    const keys = Object.keys(c);
    if (keys.length > MAX_ENTRIES) keys.sort((a, b) => c[a].t - c[b].t).slice(0, keys.length - MAX_ENTRIES).forEach(k => delete c[k]);
    try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {}
  }
  const inflight = {};

  // ── Réseau ────────────────────────────────────────────────────────────────
  async function getJSON(url) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const to = setTimeout(() => ctl && ctl.abort(), 7000);
    try {
      const r = await fetch(url, { signal: ctl && ctl.signal, headers: { Accept: 'application/json' } });
      if (!r.ok) return null;
      return await r.json();
    } catch (e) { return null; } finally { clearTimeout(to); }
  }
  async function summaryOf(title) {
    const d = await getJSON(SUMMARY + encodeURIComponent(title.replace(/ /g, '_')));
    if (!d || d.type === 'disambiguation' || !d.extract) return null;
    return { title: d.title, extract: d.extract, desc: d.description || '', url: (d.content_urls && d.content_urls.desktop && d.content_urls.desktop.page) || ('https://fr.wikipedia.org/wiki/' + encodeURIComponent(d.title.replace(/ /g, '_'))) };
  }
  function relevant(s, words) {
    const body = norm(s.title + ' ' + s.desc + ' ' + s.extract.slice(0, 400));
    if (!/tomate/.test(body)) return false;
    if (!words.length) return false;
    const hit = words.filter(w => body.includes(w)).length;
    return hit >= Math.max(1, Math.ceil(words.length * .75));
  }
  async function lookup(name) {
    const words = sig(name);
    if (words.length) {
      const res = await getJSON(SEARCH + encodeURIComponent(name + ' tomate'));
      const hits = (res && res.query && res.query.search) || [];
      for (const h of hits.slice(0, 3)) {
        const s = await summaryOf(h.title);
        if (s && relevant(s, words)) return s;
      }
    }
    const g = await summaryOf('Tomate');
    return g ? Object.assign(g, { generic: true }) : null;
  }
  async function get(name) {
    const k = norm(name).replace(/\s+/g, ' ').trim();
    const c = readCache();
    if (c[k] && Date.now() - c[k].t < TTL) return c[k].d;
    if (!inflight[k]) {
      inflight[k] = lookup(name).then(d => {
        if (d) { const cc = readCache(); cc[k] = { t: Date.now(), d }; writeCache(cc); }
        delete inflight[k];
        return d;
      });
    }
    return inflight[k];
  }

  // ── Affichage ─────────────────────────────────────────────────────────────
  function trim(text, max) {
    text = String(text).replace(/\s+/g, ' ').trim();
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    const i = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    return (i > max * .5 ? cut.slice(0, i + 1) : cut.replace(/\s+\S*$/, '') + '…');
  }
  const logo = () => `<img class="wk-logo" src="${LOGO}" alt="Wikipédia" width="20" height="20" loading="lazy" decoding="async" onerror="this.outerHTML='<span class=&quot;wk-logo wk-w&quot;>W</span>'">`;

  function block(t) {
    if (!t || !t.name) return '';
    return `<div class="fv-card wk-card" data-wk="${esc(t.name)}">
  <div class="fv-card-title">En savoir plus</div>
  <div class="wk-skel"><i></i><i></i><i style="width:60%"></i></div>
</div>`;
  }
  function hydrate(root) {
    (root || document).querySelectorAll('.wk-card[data-wk]').forEach(el => {
      const name = el.getAttribute('data-wk');
      el.removeAttribute('data-wk');
      get(name).then(d => {
        if (!el.isConnected) return;
        if (!d) { el.remove(); return; }
        el.innerHTML = `<div class="fv-card-title">En savoir plus</div>
  <div class="wk-h">${esc(d.generic ? 'La tomate' : d.title)}${d.generic ? ' <span>· présentation générale</span>' : ''}</div>
  <p class="wk-x">${esc(trim(d.extract, 560))}</p>
  <div class="wk-src">${logo()}<span>Source : <a href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">Wikipédia</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.fr" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a></span><a class="wk-more" href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">Lire l’article <i class="fa-solid fa-arrow-up-right-from-square"></i></a></div>`;
      });
    });
  }

  const st = document.createElement('style');
  st.textContent = `
.wk-h{font-weight:700;font-size:16px;margin-bottom:6px}.wk-h span{font-weight:400;font-size:13px;color:var(--text-muted)}
.wk-x{font-size:14.5px;line-height:1.6;margin:0 0 12px;color:var(--text-main)}
.wk-src{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12.5px;color:var(--text-muted)}
.wk-src a{color:inherit;text-decoration:underline;text-underline-offset:2px}
.wk-logo{width:20px;height:20px;flex-shrink:0;display:inline-block}
.wk-w{border:1px solid currentColor;border-radius:50%;font:700 12px/18px Georgia,serif;text-align:center;color:#111}
.wk-more{margin-left:auto;font-weight:600;text-decoration:none!important;color:var(--primary)!important}
.wk-skel i{display:block;height:12px;border-radius:6px;margin:9px 0;background:linear-gradient(90deg,#eee 25%,#f5f5f5 37%,#eee 63%);background-size:400% 100%;animation:shimmer 1.4s ease infinite}
`;
  document.head.appendChild(st);

  window.WK = { block, hydrate, get };
})();
