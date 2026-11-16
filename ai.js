const WORKER_URL = 'https://tomatolist-assistant.wikimind-ai.workers.dev';

(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TLx = () => window.TL || { getTomatoes: () => [], openDetail() {}, toast() {} };
  const SPARK = '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M12 2l2.2 6.3L20.5 10l-6.3 1.7L12 18l-2.2-6.3L3.5 10l6.3-1.7z" fill="currentColor"/></svg>';

  const QUESTION = 'Je cherche une tomate précoce pour mon balcon, que me conseilles-tu ?';
  const CLE_HIST = 'tl_ai_hist_v1';
  const MAX_ECHANGES = 6;
  const LIVE = !!String(WORKER_URL || '').trim();

  function infoOf(t) {
    const c = window.FV ? FV.parseCulture(t) : { cycle: '' };
    const n = (String(c.cycle).match(/\d+/g) || []).map(Number);
    return { t, days: n.length ? Math.max.apply(null, n) : 0 };
  }
  function pick() {
    const all = TLx().getTomatoes().filter(t => (t.imageURLs && t.imageURLs[0]) || t.imageURL);
    const info = infoOf;
    const small = t => /cerise|petite/i.test(t.averageSize || '') || (+t.weight > 0 && +t.weight <= 60);
    let c = all.map(info).filter(x => x.days && x.days <= 80 && small(x.t)).sort((a, b) => a.days - b.days);
    if (c.length < 3) c = c.concat(all.map(info).filter(x => x.days && !c.includes(x)).sort((a, b) => a.days - b.days));
    if (c.length < 3) c = c.concat(all.map(info).filter(x => !c.includes(x)));
    return c.slice(0, 3);
  }
  function card(x) {
    const t = x.t, u = (t.imageURLs && t.imageURLs[0]) || t.imageURL || '';
    const img = window.FV ? FV.thumb(u, 160) : u;
    const meta = [t.weight ? t.weight + ' g' : '', x.days ? 'cycle ' + x.days + ' j' : '', t.country || ''].filter(Boolean).map(esc).join(' · ');
    const im = img ? `<img src="${esc(img)}" data-o="${esc(u)}" referrerpolicy="no-referrer" alt="" loading="lazy" decoding="async" onerror="if(this.dataset.o&&this.src!==this.dataset.o){this.src=this.dataset.o}else{this.style.display='none'}">` : '';
    return `<div class="ai-card" data-open="${esc(t.id)}">
      <div class="ai-thumb">${im}</div>
      <div class="ai-cinfo"><b>${esc(t.name)}</b><span>${window.FV ? FV.tomato(t.color, 14) : ''} ${esc(t.color || '')}</span><small>${meta}</small></div>
    </div>`;
  }
  function cardsFromIds(ids) {
    const all = TLx().getTomatoes();
    const out = [];
    (ids || []).slice(0, 5).forEach(id => { const t = all.find(x => String(x.id) === String(id)); if (t) out.push(infoOf(t)); });
    return out.length ? `<div class="ai-cards">${out.map(card).join('')}</div>` : '';
  }
  function texteHtml(s) {
    return String(s || '').split(/\n{2,}|\n/).map(p => p.trim()).filter(Boolean)
      .map(p => '<p>' + esc(p).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>') + '</p>').join('');
  }

  const lireHist = () => { try { const h = JSON.parse(sessionStorage.getItem(CLE_HIST) || '[]'); return Array.isArray(h) ? h : []; } catch (e) { return []; } };
  const ecrireHist = h => { try { sessionStorage.setItem(CLE_HIST, JSON.stringify(h.slice(-MAX_ECHANGES))); } catch (e) {} };

  // ── Fiche en contexte (page d'une tomate ouverte) ──
  let ctxId = null, ctxOff = {}, ctxFresh = true;
  const CTX_SUGG = ['Comment la cultiver ?', 'Quel goût a-t-elle ?', 'Des variétés proches ?'];
  const ctxTomato = () => ctxId ? TLx().getTomatoes().find(x => String(x.id) === String(ctxId)) || null : null;
  function imgOf(t, w) {
    const u = (t.imageURLs && t.imageURLs[0]) || t.imageURL || '';
    if (!u) return '';
    const im = window.FV ? FV.thumb(u, w || 120) : u;
    return `<img src="${esc(im)}" data-o="${esc(u)}" referrerpolicy="no-referrer" alt="" decoding="async" onerror="if(this.dataset.o&&this.src!==this.dataset.o){this.src=this.dataset.o}else{this.style.display='none'}">`;
  }
  function ctxTag(nom, couleur) {
    return nom ? `<div class="ai-ctxtag">${window.FV ? FV.tomato(couleur || 'Rouge', 13) : '🍅'}<span>${esc(nom)}</span></div>` : '';
  }
  function renderCtx() {
    const box = panel && panel.querySelector('#ai-ctx');
    if (!box) return;
    const inp = panel.querySelector('#ai-input');
    const t = ctxTomato();
    if (!t) { box.hidden = true; box.innerHTML = ''; if (inp) inp.placeholder = 'Pose ta question…'; return; }
    const meta = [t.weight ? t.weight + ' g' : '', t.country || ''].filter(Boolean).map(esc).join(' · ');
    box.hidden = false;
    box.innerHTML = `<div class="ai-ctx-card">
        <div class="ai-thumb">${imgOf(t, 120)}</div>
        <div class="ai-cinfo"><small><i class="fa-solid fa-paperclip"></i> Fiche en contexte</small><b>${esc(t.name)}</b><span>${window.FV ? FV.tomato(t.color, 14) : ''} ${esc(t.color || '')}${meta ? ' · ' + meta : ''}</span></div>
        <button class="ai-ctx-x" type="button" aria-label="Retirer cette fiche du contexte"><i class="fa-solid fa-xmark"></i></button>
      </div>` + (ctxFresh ? `<div class="ai-chips">${CTX_SUGG.map(q => `<button class="ai-chip" type="button">${esc(q)}</button>`).join('')}</div>` : '');
    if (inp) inp.placeholder = 'Pose ta question sur cette tomate…';
  }
  function syncCtx() {
    const id = TLx().detailId ? TLx().detailId() : null;
    if (!id) { ctxOff = {}; if (ctxId) { ctxId = null; ctxFresh = true; } }
    else if (String(id) !== String(ctxId) && !ctxOff[id]) { ctxId = String(id); ctxFresh = true; }
    renderCtx();
  }

  let fab, panel, msgs, played = false, labelTimer;
  function build() {
    if (fab) return;
    fab = document.createElement('button');
    fab.id = 'ai-fab'; fab.type = 'button'; fab.setAttribute('aria-label', 'Poser une question sur les tomates');
    fab.innerHTML = `<span class="ai-fab-label" id="ai-fab-label">Une question&nbsp;?</span><span class="ai-fab-ico">${window.FV ? FV.tomato('Rouge', 26) : '🍅'}<i class="ai-spark">${SPARK}</i></span>`;
    fab.onclick = openChat;
    document.body.appendChild(fab);

    panel = document.createElement('section');
    panel.id = 'ai-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Assistant tomates');
    panel.innerHTML = `
      <header class="ai-head">
        <span class="ai-av">${window.FV ? FV.tomato('Rouge', 24) : '🍅'}</span>
        <div><b>Assistant tomates</b><small>Il connaît toutes les variétés recensées</small></div>
        <button class="ai-x" aria-label="Fermer"><i class="fa-solid fa-xmark"></i></button>
      </header>
      ${LIVE ? '<div class="ai-note"><i class="fa-solid fa-lock"></i> Tes questions sont envoyées à un service d’IA externe (Pollinations).</div>' : '<div class="ai-demo-note"><i class="fa-solid fa-flask"></i> Aperçu : l’assistant n’est pas encore connecté, cette conversation est un exemple.</div>'}
      <div class="ai-msgs" id="ai-msgs" aria-live="polite"></div>
      <div class="ai-ctx" id="ai-ctx" hidden></div>
      <form class="ai-form" autocomplete="off"><input type="text" id="ai-input" maxlength="300" placeholder="Pose ta question…" aria-label="Ta question"><button type="submit" aria-label="Envoyer"><i class="fa-solid fa-paper-plane"></i></button></form>`;
    document.body.appendChild(panel);
    msgs = panel.querySelector('#ai-msgs');
    panel.querySelector('.ai-x').onclick = closeChat;
    panel.querySelector('form').onsubmit = e => { e.preventDefault(); const i = panel.querySelector('#ai-input'); const v = i.value.trim(); if (v) { i.value = ''; ask(v); } };
    panel.addEventListener('click', e => {
      const x = e.target.closest('.ai-ctx-x');
      if (x) { if (ctxId) ctxOff[ctxId] = true; ctxId = null; renderCtx(); return; }
      const chip = e.target.closest('.ai-chip');
      if (chip) { ask(chip.textContent); return; }
      const c = e.target.closest('.ai-card[data-open]');
      if (c && !e.target.closest('button')) { closeChat(); TLx().openDetail(c.dataset.open); }
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && panel.classList.contains('open')) closeChat(); });
  }

  const scroll = () => { msgs.scrollTop = msgs.scrollHeight; };
  const bubble = (who, html) => { const d = document.createElement('div'); d.className = 'ai-m ' + who; d.innerHTML = html; msgs.appendChild(d); scroll(); return d; };
  const typing = () => bubble('bot', '<span class="ai-dots"><i></i><i></i><i></i></span>');
  const wait = ms => new Promise(r => setTimeout(r, ms));

  async function playDemo() {
    bubble('me', esc(QUESTION));
    const t = typing();
    await wait(1100);
    const picks = pick();
    t.remove();
    if (!picks.length) {
      bubble('bot', '<p>Le recensement est en cours de chargement… rouvre-moi dans un instant.</p>');
      played = false; return;
    }
    const names = picks.map(x => `<b>${esc(x.t.name)}</b>`);
    const m = bubble('bot', `
      <p>Pour un balcon, vise des variétés <b>à petits fruits et à cycle court</b> : elles se contentent d’un grand pot et mûrissent vite. Dans le recensement, je te propose ${names.length > 1 ? names.slice(0, -1).join(', ') + ' et ' + names[names.length - 1] : names[0]} :</p>
      <div class="ai-cards">${picks.map(card).join('')}</div>
      <p class="ai-tip">Astuce : un pot de 10 à 20 litres, du soleil direct la majeure partie de la journée et un arrosage régulier suffisent.</p>
      <div class="ai-chips"><button class="ai-chip" type="button">Laquelle est la plus facile ?</button><button class="ai-chip" type="button">Compare-les moi</button><button class="ai-chip" type="button">Et pour une salade ?</button></div>`);
    if (window.PL) PL.refresh();
    msgs.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function askDemo(text) {
    bubble('me', esc(text));
    const t = typing();
    await wait(800);
    t.remove();
    const n = TLx().getTomatoes().length;
    bubble('bot', `<p>Ceci est un aperçu : je ne suis pas encore connecté à l’IA. Bientôt, je pourrai chercher dans les ${n || ''} variétés recensées et te montrer leurs photos 🍅</p>`);
  }

  let busy = false;
  function setBusy(v) {
    busy = v;
    const i = panel.querySelector('#ai-input'), b = panel.querySelector('.ai-form button');
    if (i) i.disabled = v; if (b) b.disabled = v;
    if (!v && i && matchMedia('(hover:hover)').matches) i.focus();
  }
  function erreurTexte(status, code, connecte) {
    if (code === 'quota') return 'Tu as atteint la limite de questions pour aujourd’hui. Reviens demain' + (connecte ? '.' : ' (ou connecte-toi pour en avoir davantage).');
    if (code === 'plein') return 'L’assistant a beaucoup servi cette heure. Réessaie dans quelques minutes.';
    if (status === 429) return 'L’assistant est très sollicité en ce moment. Réessaie dans une minute.';
    if (status === 403 || status === 503) return 'L’assistant est indisponible pour le moment. Réessaie plus tard.';
    if (status === 413 || code === 'long') return 'Ta question est trop longue : essaie de la raccourcir.';
    return 'Je n’arrive pas à répondre pour l’instant. Réessaie dans un instant.';
  }
  const PH_DEBUT = ['Je réfléchis…', 'Je feuillette le recensement…', 'Je compare les variétés…'];
  const PH_SUITE = ['Je prépare ma réponse…', 'Je choisis les meilleures variétés…'];
  function thinking() {
    const d = bubble('bot', `<div class="ai-think"><span class="ai-think-ico">${window.FV ? FV.tomato('Rouge', 28) : '🍅'}</span><span class="ai-think-lab"><span class="ai-think-l in">${PH_DEBUT[0]}</span><span class="ai-dots"><i></i><i></i><i></i></span></span></div>`);
    d.classList.add('ai-thinking');
    const lab = d.querySelector('.ai-think-l'), ico = d.querySelector('.ai-think-ico');
    let phase = 'think', tour = 0, k = 0, timer;
    const set = txt => { if (lab.textContent === txt) return; lab.classList.remove('in'); void lab.offsetWidth; lab.textContent = txt; lab.classList.add('in'); };
    timer = setInterval(() => { if (phase === 'think') { const l = tour ? PH_SUITE : PH_DEBUT; k = (k + 1) % l.length; set(l[k]); } }, 2300);
    return {
      el: d,
      status(ev) {
        if (ev.s === 'search') { phase = 'search'; ico.classList.add('search'); set('Je cherche dans le recensement' + (ev.q ? ' : « ' + ev.q + ' »' : '') + '…'); }
        else { phase = 'think'; tour = ev.tour || 0; k = 0; ico.classList.remove('search'); set(tour ? PH_SUITE[0] : PH_DEBUT[0]); }
      },
      stop() { clearInterval(timer); }
    };
  }
  const avecCurseur = h => h.replace(/<\/p>$/, '<span class="ai-caret"></span></p>') || '<span class="ai-caret"></span>';

  async function askLive(text) {
    if (busy) return;
    text = String(text).trim().slice(0, 300);
    if (!text) return;
    syncCtx();
    const ct = ctxTomato();
    const cid = ct ? String(ct.id) : null;
    bubble('me', ctxTag(ct && ct.name, ct && ct.color) + esc(text));
    if (cid) { ctxFresh = false; renderCtx(); }
    let th = thinking();
    setBusy(true);
    const hist = lireHist();
    const historique = [];
    hist.forEach(h => { historique.push({ role: 'user', content: h.q }, { role: 'assistant', content: h.a }); });
    const ctrl = new AbortController();
    let stop = setTimeout(() => ctrl.abort(), 60000);
    let final = null, erreur = null;
    let live = null, acc = '', shown = 0, raf = 0, drainRes = null;

    const proche = () => msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 90;
    function ensureLive() {
      if (live) return;
      th.stop(); live = th.el; live.classList.remove('ai-thinking'); live.innerHTML = '';
    }
    function draw() {
      ensureLive();
      const bas = proche();
      live.innerHTML = avecCurseur(texteHtml(acc.slice(0, shown)));
      if (bas) msgs.scrollTop = msgs.scrollHeight;
    }
    function tick() {
      raf = 0;
      if (shown < acc.length) { shown = Math.min(acc.length, shown + Math.max(2, Math.ceil((acc.length - shown) / 14))); draw(); }
      if (shown < acc.length) raf = requestAnimationFrame(tick);
      else if (drainRes) { drainRes(); drainRes = null; }
    }
    const pump = () => { if (!raf) raf = requestAnimationFrame(tick); };
    const drained = () => new Promise(res => { if (shown >= acc.length) res(); else { drainRes = res; pump(); } });

    function onEvent(ev) {
      if (ev.t === 'status') { if (!live) th.status(ev); }
      else if (ev.t === 'delta') { acc += ev.x; pump(); }
      else if (ev.t === 'reset') {
        acc = ''; shown = 0;
        if (live) { live.remove(); live = null; th = thinking(); }
      }
      else if (ev.t === 'done') final = ev;
      else if (ev.t === 'error') erreur = erreurTexte(ev.status, ev.erreur, ev.connecte);
    }

    try {
      let jeton = null;
      try { jeton = window.TL && TL.getToken ? await TL.getToken() : null; } catch (e) {}
      const headers = { 'Content-Type': 'application/json' };
      if (jeton) headers.Authorization = 'Bearer ' + jeton;
      const r = await fetch(WORKER_URL, { method: 'POST', headers, body: JSON.stringify({ message: text, historique, stream: true, tomate_id: cid || undefined }), signal: ctrl.signal });
      const typeRep = r.headers.get('content-type') || '';
      if (!r.ok || !/event-stream/i.test(typeRep) || !r.body) {
        let j = null; try { j = await r.json(); } catch (e) {}
        if (r.ok && j && typeof j.texte === 'string') { acc = j.texte; final = Object.assign({ t: 'done' }, j); }
        else erreur = erreurTexte(r.status, j && j.erreur, j && j.connecte);
      } else {
        const lecteur = r.body.getReader(), dec = new TextDecoder();
        let tampon = '';
        for (;;) {
          const { done, value } = await lecteur.read();
          if (done) break;
          tampon += dec.decode(value, { stream: true });
          let i;
          while ((i = tampon.indexOf('\n')) >= 0) {
            const ligne = tampon.slice(0, i).trim(); tampon = tampon.slice(i + 1);
            if (!ligne.startsWith('data:')) continue;
            let ev; try { ev = JSON.parse(ligne.slice(5)); } catch (e) { continue; }
            onEvent(ev);
          }
        }
        if (!final && !erreur) erreur = acc ? null : erreurTexte(0);
      }
    } catch (e) {
      erreur = navigator.onLine === false ? 'Tu n’as pas l’air d’être connecté à Internet. Vérifie ta connexion et réessaie.' : (e && e.name === 'AbortError' ? 'L’assistant met trop de temps à répondre. Réessaie dans un instant.' : 'Impossible de joindre l’assistant pour le moment. Réessaie dans un instant.');
    }
    clearTimeout(stop);
    if (final) { acc = final.texte; await drained(); }
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    th.stop();
    setBusy(false);
    if (!final) {
      if (live) live.remove(); else th.el.remove();
      bubble('bot', '<p>' + esc(erreur || erreurTexte(0)) + '</p>');
      return;
    }
    hist.push({ q: text, a: final.texte, ids: final.ids || [], c: ct ? ct.name : '', cc: ct ? ct.color : '' });
    ecrireHist(hist);
    ensureLive();
    live.innerHTML = texteHtml(final.texte) + cardsFromIds(final.ids) + (typeof final.reste === 'number' && final.reste <= 3 && !final.connecte ? `<p class="ai-tip">Il te reste ${esc(final.reste)} question${final.reste > 1 ? 's' : ''} aujourd’hui.</p>` : '');
    if (window.PL) PL.refresh();
    if (live.offsetHeight > msgs.clientHeight - 24) msgs.scrollTop = Math.max(0, live.offsetTop - 10); else msgs.scrollTop = msgs.scrollHeight;
  }
  const ask = text => (LIVE ? askLive(text) : askDemo(text));

  const SUGGESTIONS = ['Une tomate précoce pour un balcon', 'Des tomates cerises très sucrées', 'Une grosse tomate noire'];
  function restaurer() {
    const hist = lireHist();
    if (!hist.length) {
      bubble('bot', `<p>Salut ! Je suis l’assistant de TomatoList. Dis-moi ce que tu cherches : couleur, taille, précocité, pays…</p><div class="ai-chips">${SUGGESTIONS.map(s => `<button class="ai-chip" type="button">${esc(s)}</button>`).join('')}</div>`);
      return;
    }
    hist.forEach(h => { bubble('me', ctxTag(h.c, h.cc) + esc(h.q)); bubble('bot', texteHtml(h.a) + cardsFromIds(h.ids)); });
    if (window.PL) PL.refresh();
    scroll();
  }

  function openChat() {
    build();
    clearTimeout(labelTimer); fab.classList.remove('wide');
    syncCtx();
    panel.classList.add('open'); fab.classList.add('hide');
    if (!played) { played = true; if (LIVE) restaurer(); else playDemo(); }
    setTimeout(() => { const i = panel.querySelector('#ai-input'); if (i && matchMedia('(hover:hover)').matches) i.focus(); }, 300);
  }
  function closeChat() { panel.classList.remove('open'); fab.classList.remove('hide'); }

  function hint(text, ms) {
    build();
    if (panel.classList.contains('open')) return;
    document.getElementById('ai-fab-label').innerHTML = text;
    fab.classList.add('wide');
    clearTimeout(labelTimer);
    labelTimer = setTimeout(() => fab.classList.remove('wide'), ms || 5000);
  }
  function init() {
    build();
    let seen = false; try { seen = sessionStorage.getItem('tl_ai_hint'); } catch (e) {}
    if (!seen) setTimeout(() => { hint('Une question sur les tomates&nbsp;?', 6000); try { sessionStorage.setItem('tl_ai_hint', '1'); } catch (e) {} }, 9000);
    new MutationObserver(() => { if (panel && panel.classList.contains('open')) syncCtx(); if (document.body.classList.contains('detail-open')) hint('Une question sur cette tomate&nbsp;?', 4500); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    const grid = document.getElementById('tomatoes-grid');
    if (grid) new MutationObserver(() => {
      const e = grid.querySelector('.empty-state .fa-leaf');
      if (e && !grid.querySelector('.ai-ask')) e.parentElement.insertAdjacentHTML('beforeend', '<button class="btn btn-primary btn-sm ai-ask" type="button" style="margin:14px auto 0"><i class="fa-solid fa-wand-magic-sparkles"></i> Demander à l’assistant</button>');
    }).observe(grid, { childList: true });
    document.addEventListener('click', e => { if (e.target.closest('.ai-ask')) openChat(); });
  }

  const st = document.createElement('style');
  st.textContent = `
#ai-fab{position:fixed;right:14px;bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:1150;display:flex;align-items:center;gap:0;height:48px;padding:0;border:1px solid rgba(185,28,28,.22);border-radius:99px;background:#fff;color:var(--text-main);box-shadow:0 4px 16px rgba(0,0,0,.16);cursor:pointer;opacity:.9;transition:opacity .2s,transform .25s,box-shadow .2s}
#ai-fab:hover{opacity:1;box-shadow:0 6px 20px rgba(0,0,0,.22)}
#ai-fab.hide{transform:scale(.6);opacity:0;pointer-events:none}
.ai-fab-label{max-width:0;overflow:hidden;white-space:nowrap;font-size:13.5px;font-weight:600;transition:max-width .35s cubic-bezier(.22,.8,.2,1),padding .35s}
#ai-fab.wide .ai-fab-label{max-width:230px;padding:0 4px 0 16px}
.ai-fab-ico{position:relative;width:46px;height:46px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.ai-spark{position:absolute;top:7px;right:6px;display:flex;color:#f59e0b;background:#fff;border-radius:50%;padding:1px}
#ai-fab.wide .ai-spark{animation:aiTwinkle 1.4s ease-in-out infinite}
@keyframes aiTwinkle{0%,100%{transform:scale(1) rotate(0)}50%{transform:scale(1.25) rotate(20deg)}}
#ai-panel{position:fixed;right:16px;bottom:16px;width:min(390px,calc(100vw - 24px));height:min(620px,calc(100vh - 32px));height:min(620px,calc(100dvh - 32px));z-index:1200;display:flex;flex-direction:column;background:var(--surface,#fff);border:1px solid var(--line);border-radius:20px;box-shadow:0 24px 64px rgba(0,0,0,.3);overflow:hidden;opacity:0;transform:translateY(24px) scale(.98);pointer-events:none;transition:opacity .2s,transform .28s cubic-bezier(.22,.8,.2,1)}
#ai-panel.open{opacity:1;transform:none;pointer-events:auto}
@media (max-width:640px){#ai-panel{left:0;right:0;bottom:0;width:auto;height:84vh;height:84dvh;border-radius:20px 20px 0 0;border-bottom:none}}
.ai-head{display:flex;align-items:center;gap:10px;padding:12px 14px;background:#fef2f2;border-bottom:1px solid #fecaca}
.ai-head div{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.25}.ai-head b{font-size:15px}.ai-head small{font-size:12px;color:var(--text-muted)}
.ai-av{width:36px;height:36px;border-radius:50%;background:#fff;border:1px solid #fecaca;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.ai-x{width:36px;height:36px;border:none;border-radius:50%;background:transparent;font-size:16px;cursor:pointer;color:var(--text-main)}.ai-x:hover{background:#fee2e2}
.ai-note{font-size:12px;padding:7px 14px;background:#f0fdf4;color:#166534;border-bottom:1px solid #bbf7d0}
.ai-demo-note{font-size:12px;padding:7px 14px;background:#fffbeb;color:#92400e;border-bottom:1px solid #fde68a}
.ai-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:12px;overscroll-behavior:contain;background:#fffafa}
.ai-m{max-width:92%;font-size:14.5px;line-height:1.5;animation:aiIn .3s ease both}
@keyframes aiIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.ai-m.me{align-self:flex-end;background:var(--primary);color:#fff;padding:10px 14px;border-radius:16px 16px 4px 16px}
.ai-m.bot{align-self:flex-start;background:#fff;border:1px solid var(--line);padding:11px 13px;border-radius:16px 16px 16px 4px;box-shadow:0 1px 3px rgba(0,0,0,.05)}
.ai-m p{margin:0}.ai-m p+*{margin-top:10px}.ai-tip{font-size:13px;color:var(--text-muted)}
.ai-cards{display:flex;flex-direction:column;gap:8px}
.ai-card{display:flex;align-items:center;gap:10px;padding:7px;border:1px solid var(--line);border-radius:12px;background:#fff;cursor:pointer}.ai-card:hover{border-color:#fca5a5;background:#fef2f2}
.ai-thumb{width:56px;height:56px;border-radius:9px;overflow:hidden;background:#f3f4f6;flex-shrink:0}.ai-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.ai-cinfo{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}.ai-cinfo b{font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ai-cinfo span{font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:5px}.ai-cinfo small{font-size:11.5px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ai-chips{display:flex;flex-wrap:wrap;gap:6px}
.ai-chip{border:1px solid #fca5a5;background:#fff;color:var(--primary);border-radius:99px;padding:6px 12px;font-size:12.5px;font-weight:600;cursor:pointer}.ai-chip:hover{background:#fef2f2}
.ai-dots{display:inline-flex;gap:4px;padding:4px 2px}.ai-dots i{width:7px;height:7px;border-radius:50%;background:#d1a0a0;animation:aiDot 1s infinite}.ai-dots i:nth-child(2){animation-delay:.15s}.ai-dots i:nth-child(3){animation-delay:.3s}
@keyframes aiDot{0%,60%,100%{transform:translateY(0);opacity:.5}30%{transform:translateY(-4px);opacity:1}}
.ai-form{display:flex;gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--line);background:#fff}
.ai-form input{flex:1;min-width:0;padding:11px 14px;border:1px solid var(--line);border-radius:99px;font:inherit;font-size:16px;background:#fafafa;color:var(--text-main)}.ai-form input:focus{outline:2px solid #fca5a5;border-color:transparent}
.ai-form button{width:42px;height:42px;flex-shrink:0;border:none;border-radius:50%;background:var(--primary);color:#fff;cursor:pointer}
@media (prefers-reduced-motion:reduce){.ai-m,#ai-fab.wide .ai-spark{animation:none}}
.ai-form input:disabled,.ai-form button:disabled{opacity:.6}
.ai-ctx{padding:8px 12px 0;background:#fff;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:8px;animation:aiIn .25s ease both}
.ai-ctx[hidden]{display:none}
.ai-ctx-card{display:flex;align-items:center;gap:10px;padding:6px 6px 6px 6px;border:1px solid #fecaca;border-radius:14px;background:linear-gradient(135deg,#fef2f2,#fff)}
.ai-ctx-card .ai-thumb{width:46px;height:46px;border-radius:10px}
.ai-ctx-card .ai-cinfo small{display:flex;align-items:center;gap:5px;font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--primary)}
.ai-ctx-card .ai-cinfo b{font-size:14px}
.ai-ctx-x{width:30px;height:30px;flex-shrink:0;border:none;border-radius:50%;background:#fee2e2;color:var(--primary);font-size:12px;cursor:pointer}.ai-ctx-x:hover{background:#fecaca}
.ai-ctx .ai-chips{flex-wrap:nowrap;overflow-x:auto;padding-bottom:2px;scrollbar-width:none}.ai-ctx .ai-chips::-webkit-scrollbar{display:none}
.ai-ctx .ai-chip{white-space:nowrap;flex-shrink:0}
.ai-ctx + .ai-form{border-top:none;padding-top:8px}
.ai-ctxtag{display:inline-flex;align-items:center;gap:6px;max-width:100%;margin-bottom:7px;padding:3px 9px 3px 6px;border-radius:99px;background:rgba(255,255,255,.2);font-size:12px;font-weight:600}
.ai-ctxtag span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ai-m.me .ai-ctxtag{display:flex;width:fit-content}
.ai-think{display:flex;align-items:center;gap:10px;min-height:34px}
.ai-think-ico{display:flex;width:30px;height:30px;align-items:center;justify-content:center;flex-shrink:0;transform-origin:50% 100%;animation:aiBounce 1.1s cubic-bezier(.3,.7,.4,1) infinite}
.ai-think-ico.search{animation:aiRoll 1.6s ease-in-out infinite}
@keyframes aiBounce{0%,100%{transform:translateY(0) scale(1,1)}45%{transform:translateY(-8px) scale(.96,1.04) rotate(-6deg)}60%{transform:translateY(-8px) rotate(6deg)}85%{transform:translateY(0) scale(1.06,.94)}}
@keyframes aiRoll{0%,100%{transform:translateX(-4px) rotate(-25deg)}50%{transform:translateX(4px) rotate(25deg)}}
.ai-think-lab{display:flex;align-items:center;gap:6px;font-size:13.5px;color:var(--text-muted);min-width:0}
.ai-think-l{opacity:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ai-think-l.in{animation:aiLab .35s ease forwards}
@keyframes aiLab{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
.ai-m.ai-thinking{background:linear-gradient(100deg,#fff 30%,#fff1f1 50%,#fff 70%);background-size:220% 100%;animation:aiIn .3s ease both,aiShimmer 2.2s linear infinite}
@keyframes aiShimmer{from{background-position:120% 0}to{background-position:-120% 0}}
.ai-caret{display:inline-block;width:2px;height:1.05em;margin-left:2px;vertical-align:text-bottom;background:var(--primary);animation:aiBlink .8s steps(1) infinite}
@keyframes aiBlink{50%{opacity:0}}
@media (prefers-reduced-motion:reduce){.ai-think-ico,.ai-thinking,.ai-caret{animation:none}}
`;
  document.head.appendChild(st);

  window.AI = { open: () => { build(); openChat(); }, hint };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
