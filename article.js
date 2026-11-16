/* article.js — article long d'une variété (style Wikipédia)
   - rendu d'un Markdown volontairement limité, TOUJOURS échappé (aucun HTML saisi n'est interprété)
       ## Titre · ### Sous-titre · **gras** · *italique* · - liste · 1. liste · > citation · [texte](https://lien)
   - outils pour la barre de mise en forme de l'éditeur
   - import du texte complet d'un article de fr.wikipedia.org (API MediaWiki, sans clé), avec source + licence CC BY-SA */
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const slug = s => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'section';
  const MAX = 30000;
  const WIKI_OK = /^https:\/\/fr\.wikipedia\.org\//;
  const LOGO = 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Wikipedia-logo-v2.svg/64px-Wikipedia-logo-v2.svg.png';

  // ── Rendu ─────────────────────────────────────────────────────────────────
  function inline(t) {
    let h = esc(t);
    h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    h = h.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<i>$2</i>');
    return h;
  }
  function render(md) {
    const lines = String(md || '').replace(/\r/g, '').split('\n');
    const out = [], heads = [];
    let para = [], list = null;
    const flushP = () => { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } };
    const flushL = () => { if (list) { out.push('<' + list.t + '>' + list.i.map(x => '<li>' + inline(x) + '</li>').join('') + '</' + list.t + '>'); list = null; } };
    lines.forEach(raw => {
      const l = raw.trim();
      let m;
      if (!l) { flushP(); flushL(); return; }
      if ((m = /^(#{1,4})\s+(.+?)\s*#*$/.exec(l))) {
        flushP(); flushL();
        const lvl = m[1].length <= 2 ? 2 : 3;
        const id = 'art-' + slug(m[2]) + '-' + heads.length;
        heads.push({ lvl, id, t: m[2] });
        out.push('<h' + lvl + ' id="' + id + '">' + inline(m[2]) + '</h' + lvl + '>');
        return;
      }
      if ((m = /^[-*•]\s+(.+)$/.exec(l))) { flushP(); if (!list || list.t !== 'ul') { flushL(); list = { t: 'ul', i: [] }; } list.i.push(m[1]); return; }
      if ((m = /^\d+[.)]\s+(.+)$/.exec(l))) { flushP(); if (!list || list.t !== 'ol') { flushL(); list = { t: 'ol', i: [] }; } list.i.push(m[1]); return; }
      if ((m = /^>\s?(.*)$/.exec(l))) { flushP(); flushL(); out.push('<blockquote>' + inline(m[1]) + '</blockquote>'); return; }
      flushL(); para.push(l);
    });
    flushP(); flushL();
    const h2 = heads.filter(h => h.lvl === 2);
    let toc = '';
    if (h2.length >= 3) toc = '<nav class="art-toc" aria-label="Sommaire"><b>Sommaire</b><ol>' + h2.map(h => '<li><button type="button" data-art-go="' + h.id + '">' + inline(h.t) + '</button></li>').join('') + '</ol></nav>';
    return { html: out.join(''), toc, headings: heads };
  }

  function source(src) {
    if (!src || !WIKI_OK.test(src.url || '')) return '';
    return '<div class="art-src"><img src="' + LOGO + '" alt="" width="18" height="18" loading="lazy" onerror="this.style.display=\'none\'"><span>Texte issu de l’article « <a href="' + esc(src.url) + '" target="_blank" rel="noopener noreferrer">' + esc(src.title || 'Wikipédia') + '</a> » de Wikipédia, sous licence <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.fr" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a> (auteurs : voir l’historique de la page).</span></div>';
  }
  // Bloc complet pour la fiche d'une variété
  function block(md, src) {
    if (!md || !String(md).trim()) return '';
    const r = render(md);
    return '<div class="detail-section-title">Article</div><div class="art">' + r.toc + r.html + '</div>' + source(src);
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-art-go]');
    if (!b) return;
    const el = document.getElementById(b.getAttribute('data-art-go'));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ── Outils de l'éditeur (textarea) ────────────────────────────────────────
  function wrap(ta, before, after, placeholder) {
    const s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
    const sel = v.slice(s, e) || placeholder || '';
    ta.value = v.slice(0, s) + before + sel + after + v.slice(e);
    ta.focus();
    ta.setSelectionRange(s + before.length, s + before.length + sel.length);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function line(ta, prefix) {
    const v = ta.value;
    const s = v.lastIndexOf('\n', ta.selectionStart - 1) + 1;
    let e = v.indexOf('\n', ta.selectionEnd);
    if (e < 0) e = v.length;
    const block = v.slice(s, e).split('\n').map((l, i) => {
      const clean = l.replace(/^(#{1,4}\s+|[-*]\s+|\d+[.)]\s+|>\s?)/, '');
      return /^\d+\./.test(prefix) ? (i + 1) + '. ' + clean : prefix + clean;
    }).join('\n');
    ta.value = v.slice(0, s) + block + v.slice(e);
    ta.focus();
    ta.setSelectionRange(s, s + block.length);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // ── Import Wikipédia ──────────────────────────────────────────────────────
  const API = 'https://fr.wikipedia.org/w/api.php?format=json&origin=*&';
  async function getJSON(url) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const to = setTimeout(() => ctl && ctl.abort(), 12000);
    try {
      const r = await fetch(url, { signal: ctl && ctl.signal, headers: { Accept: 'application/json' } });
      return r.ok ? await r.json() : null;
    } catch (e) { return null; } finally { clearTimeout(to); }
  }
  const DROP = /^(notes?( et references?)?|references?|voir aussi|liens? externes?|bibliographie|articles? connexes?|sources?)$/;
  function toMarkdown(text) {
    const out = [];
    let skip = false;
    String(text || '').replace(/\r/g, '').split('\n').forEach(l => {
      const m = /^(={2,5})\s*(.+?)\s*\1\s*$/.exec(l.trim());
      if (m) {
        const lvl = m[1].length;
        if (lvl === 2) skip = DROP.test(norm(m[2]).trim());
        if (skip) return;
        out.push((lvl === 2 ? '## ' : '### ') + m[2]);
        return;
      }
      if (!skip) out.push(l);
    });
    let md = out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (md.length > MAX) { md = md.slice(0, MAX); const i = md.lastIndexOf('\n\n'); if (i > MAX * .6) md = md.slice(0, i); }
    return md;
  }
  async function fetchFull(title) {
    const d = await getJSON(API + 'action=query&prop=extracts&explaintext=1&exsectionformat=wiki&redirects=1&titles=' + encodeURIComponent(title));
    const pages = d && d.query && d.query.pages;
    const p = pages && Object.values(pages)[0];
    if (!p || p.missing !== undefined || !p.extract) return null;
    return { title: p.title, url: 'https://fr.wikipedia.org/wiki/' + encodeURIComponent(p.title.replace(/ /g, '_')), markdown: toMarkdown(p.extract), raw: p.extract };
  }
  const STOP = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'tomate', 'tomates', 'hybride', 'f1', 'ancienne', 'variete']);
  const sig = name => norm(name).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
  function relevant(page, words) {
    const body = norm(page.title + ' ' + page.raw.slice(0, 700));
    if (!/tomate/.test(body) || !words.length) return false;
    return words.filter(w => body.includes(w)).length >= Math.max(1, Math.ceil(words.length * .75));
  }
  // title : titre de page choisi par l'utilisateur (sinon recherche d'après le nom, avec contrôle de pertinence)
  async function importWiki(name, title) {
    title = String(title || '').trim();
    if (title) {
      const p = await fetchFull(title);
      return p && p.markdown ? { title: p.title, url: p.url, markdown: p.markdown } : null;
    }
    const words = sig(name);
    if (!words.length) return null;
    const res = await getJSON(API + 'action=query&list=search&srlimit=3&srsearch=' + encodeURIComponent(name + ' tomate'));
    const hits = (res && res.query && res.query.search) || [];
    for (const h of hits) {
      const p = await fetchFull(h.title);
      if (p && p.markdown && relevant(p, words)) return { title: p.title, url: p.url, markdown: p.markdown };
    }
    return null;
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const st = document.createElement('style');
  st.textContent = `
.art{font-size:15px;line-height:1.75;color:var(--text-main);margin-bottom:12px}
.art h2{font-family:Georgia,'Linux Libertine','Times New Roman',serif;font-weight:400;font-size:22px;line-height:1.25;margin:26px 0 10px;padding-bottom:5px;border-bottom:1px solid #d1d5db;scroll-margin-top:16px}
.art h3{font-family:Georgia,'Linux Libertine','Times New Roman',serif;font-weight:700;font-size:17px;margin:20px 0 6px;scroll-margin-top:16px}
.art>:first-child{margin-top:0}
.art p{margin:0 0 12px}.art ul,.art ol{margin:0 0 14px 22px}.art li{margin:3px 0}
.art a{color:#0b57d0;text-decoration:underline;text-underline-offset:2px}
.art blockquote{margin:0 0 14px;padding:8px 14px;border-left:3px solid #fca5a5;background:#fef2f2;border-radius:0 10px 10px 0;color:#444}
.art-toc{display:inline-block;min-width:220px;max-width:100%;margin:2px 0 16px;padding:12px 18px 12px 16px;background:#f8f9fa;border:1px solid #d1d5db;border-radius:8px;font-size:14px}
.art-toc b{display:block;margin-bottom:6px;font-size:14.5px}
.art-toc ol{margin:0 0 0 20px}.art-toc li{margin:2px 0}
.art-toc button{border:none;background:none;padding:0;font:inherit;color:#0b57d0;cursor:pointer;text-align:left}.art-toc button:hover{text-decoration:underline}
.art-src{display:flex;gap:8px;align-items:flex-start;font-size:12.5px;line-height:1.5;color:var(--text-muted);margin:0 0 22px}
.art-src img{margin-top:1px;flex-shrink:0}.art-src a{color:inherit;text-decoration:underline;text-underline-offset:2px}
`;
  document.head.appendChild(st);

  window.ART = { render, block, source, wrap, line, importWiki, MAX };
})();
