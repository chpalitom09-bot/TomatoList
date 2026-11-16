import { getApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { getDatabase, ref, get, update, runTransaction } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-database.js";

const END = Date.UTC(2026, 11, 31, 23, 0, 0);
const INTRO_KEY = 'tl_qx_intro_v1';
const RULES = {
  pub: { xp: 20, cap: 5, label: 'Publier une variété' },
  comment: { xp: 5, cap: 10, label: 'Poster un commentaire' },
  like: { xp: 2, cap: 20, label: 'Aimer une variété' },
  share: { xp: 1, cap: 100, label: 'Partager le site' }
};
const QUEST = { need: 3, xp: 100 };
const LEVELS = [
  { n: 'Graine', x: 0 },
  { n: 'Pousse', x: 100 },
  { n: 'Plant', x: 300 },
  { n: 'Floraison', x: 700 },
  { n: 'Récolte', x: 1500 },
  { n: 'Maître jardinier', x: 3000 }
];

let db = null, auth = null, user = null, state = null, name = 'Cultivateur', tab = 'quests', board = 'week', lbData = null, busy = false;

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' });
const fmtHour = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' });
const dayKey = (t) => fmtDay.format(t || Date.now());

function mondayOf(day) {
  const d = new Date(day + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
const weekKey = (t) => 'w' + mondayOf(dayKey(t));

function parisMidnight(day) {
  const [y, m, d] = day.split('-').map(Number);
  const base = Date.UTC(y, m - 1, d);
  return base - parseInt(fmtHour.format(base), 10) * 3600000;
}
function nextDayStart() {
  const d = new Date(dayKey() + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return parisMidnight(d.toISOString().slice(0, 10));
}
function nextWeekStart() {
  const d = new Date(mondayOf(dayKey()) + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 7);
  return parisMidnight(d.toISOString().slice(0, 10));
}
const contestOn = () => Date.now() < END;

function fmtLeft(ms) {
  if (ms <= 0) return 'terminé';
  const m = Math.floor(ms / 60000), h = Math.floor(m / 60), j = Math.floor(h / 24);
  if (j > 0) return j + ' j ' + (h % 24) + ' h';
  if (h > 0) return h + ' h ' + (m % 60) + ' min';
  return Math.max(1, m) + ' min';
}

function levelOf(xp) {
  let i = 0;
  LEVELS.forEach((l, k) => { if (xp >= l.x) i = k; });
  const cur = LEVELS[i], nxt = LEVELS[i + 1];
  return { i, name: cur.n, from: cur.x, to: nxt ? nxt.x : null, pct: nxt ? Math.min(100, Math.round((xp - cur.x) / (nxt.x - cur.x) * 100)) : 100 };
}

function today(s) {
  const d = s && s.days && s.days[dayKey()];
  return Object.assign({ pub: 0, comment: 0, like: 0, share: 0, quest: 0 }, d || {});
}
function weekXp(s) {
  return s && s.week && s.week.k === weekKey() ? (s.week.xp || 0) : 0;
}

function compute(cur, kind, id) {
  const s = cur ? JSON.parse(JSON.stringify(cur)) : {};
  const day = dayKey(), wk = weekKey();
  s.total = s.total || 0;
  s.days = s.days || {};
  const d = s.days[day] = Object.assign({ pub: 0, comment: 0, like: 0, share: 0, quest: 0 }, s.days[day] || {});
  Object.keys(s.days).sort().slice(0, -3).forEach(k => { delete s.days[k]; });
  const r = RULES[kind];
  if (!r || d[kind] >= r.cap) return null;
  let gain = r.xp, bonus = 0;
  if (kind === 'like') {
    s.liked = s.liked || {};
    if (s.liked[id]) return null;
    s.liked[id] = true;
  }
  d[kind]++;
  if (kind === 'pub' && d.pub >= QUEST.need && !d.quest) { d.quest = 1; bonus = QUEST.xp; gain += bonus; }
  s.total += gain;
  if (contestOn()) {
    if (!s.week || s.week.k !== wk) s.week = { k: wk, xp: 0 };
    s.week.xp += gain;
  }
  return { s, gain, bonus };
}

async function award(kind, id) {
  if (!user || !db) return;
  let out = null;
  try {
    const res = await runTransaction(ref(db, 'quest/' + user.uid), cur => {
      out = compute(cur, kind, id);
      return out ? out.s : undefined;
    });
    if (!res.committed || !out) return;
    state = res.snapshot.val();
    const up = {};
    up['lb/' + user.uid + '/name'] = name;
    up['lb/' + user.uid + '/total'] = state.total;
    if (contestOn() && state.week) up['lb/' + user.uid + '/weeks/' + state.week.k] = state.week.xp;
    await update(ref(db), up);
    lbData = null;
    notify(kind, out);
    paint();
  } catch (e) {}
}

function notify(kind, out) {
  const t = window.TL && window.TL.toast;
  if (!t) return;
  let msg = '+' + (out.gain - out.bonus) + ' XP';
  if (out.bonus) msg += ', quête du jour terminée +' + out.bonus + ' XP';
  t(msg, 'fa-star');
}

async function loadState() {
  state = null;
  if (!user) return;
  try {
    const s = await get(ref(db, 'quest/' + user.uid));
    state = s.exists() ? s.val() : { total: 0 };
    const p = await get(ref(db, 'users/' + user.uid + '/profile'));
    if (p.exists()) {
      const v = p.val();
      const f = String(v.firstname || '').trim(), l = String(v.lastname || '').trim();
      name = (f + (l ? ' ' + l.charAt(0).toUpperCase() + '.' : '')).trim().slice(0, 40) || 'Cultivateur';
    }
  } catch (e) {}
}

async function loadBoard() {
  try {
    const s = await get(ref(db, 'lb'));
    lbData = s.exists() ? s.val() : {};
  } catch (e) { lbData = {}; }
}

function css() {
  const st = document.createElement('style');
  st.textContent = `
  .qx-chip{background:var(--primary);color:#fff;border-radius:99px;font-size:11px;font-weight:700;padding:2px 8px;margin-left:2px}
  .qx-chip:empty{display:none}
  .qx-ov{position:fixed;inset:0;background:rgba(17,24,39,.55);z-index:4000;display:none;align-items:center;justify-content:center;padding:16px}
  .qx-ov.show{display:flex}
  .qx-panel{background:#fff;width:min(560px,100%);max-height:90vh;overflow:auto;border-radius:18px;box-shadow:0 20px 50px rgba(0,0,0,.25);position:relative;overscroll-behavior:contain}
  .qx-head{display:flex;align-items:center;gap:14px;padding:20px 20px 14px}
  .qx-head h2{font-family:var(--display);font-size:20px;line-height:1.2}
  .qx-x{position:absolute;top:12px;right:12px;width:34px;height:34px;border:none;background:#f3f4f6;border-radius:50%;cursor:pointer;font-size:14px;color:var(--text-main)}
  .qx-bar{height:8px;background:#f3f4f6;border-radius:99px;overflow:hidden}
  .qx-bar i{display:block;height:100%;background:var(--primary);border-radius:99px;transition:width .4s}
  .qx-sub{font-size:12.5px;color:var(--text-muted);margin-top:6px}
  .qx-tabs{display:flex;gap:6px;padding:0 20px;border-bottom:1px solid var(--line)}
  .qx-tab{border:none;background:none;padding:10px 4px;margin-right:14px;font:600 14px var(--sans);color:var(--text-muted);cursor:pointer;border-bottom:2px solid transparent}
  .qx-tab.on{color:var(--text-main);border-color:var(--primary)}
  .qx-body{padding:16px 20px 22px;display:flex;flex-direction:column;gap:14px}
  .qx-card{border:1px solid var(--line);border-radius:14px;padding:14px 16px;background:#fff}
  .qx-card.main{border-color:#fecaca;background:#fffafa}
  .qx-row{display:flex;align-items:center;justify-content:space-between;gap:10px}
  .qx-t{font-weight:700;font-size:15px}
  .qx-xp{font-weight:700;color:var(--primary);font-size:13px;white-space:nowrap}
  .qx-list{display:flex;flex-direction:column}
  .qx-li{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-top:1px solid #f3f4f6;font-size:14px}
  .qx-li:first-child{border-top:none}
  .qx-li small{color:var(--text-muted);font-size:12px}
  .qx-btn{border:none;border-radius:10px;padding:11px 16px;font:600 14px var(--sans);cursor:pointer;background:var(--primary);color:#fff}
  .qx-btn.ghost{background:#f3f4f6;color:var(--text-main)}
  .qx-seg{display:flex;background:#f3f4f6;border-radius:10px;padding:3px}
  .qx-seg button{flex:1;border:none;background:none;padding:8px;border-radius:8px;font:600 13px var(--sans);color:var(--text-muted);cursor:pointer}
  .qx-seg button.on{background:#fff;color:var(--text-main);box-shadow:0 1px 3px rgba(0,0,0,.1)}
  .qx-rk{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;font-size:14px}
  .qx-rk:nth-child(odd){background:#fafafa}
  .qx-rk.me{background:#fef2f2;font-weight:700}
  .qx-n{width:26px;text-align:center;font-weight:700;color:var(--text-muted)}
  .qx-rk.top .qx-n{color:var(--primary)}
  .qx-nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .qx-intro .qx-panel{padding:26px 22px 20px;text-align:center}
  .qx-intro h2{font-family:var(--display);font-size:22px;margin:10px 0 6px}
  .qx-intro p{font-size:14px;color:var(--text-muted);line-height:1.5}
  .qx-intro ul{list-style:none;text-align:left;margin:16px 0;display:flex;flex-direction:column;gap:8px}
  .qx-intro li{display:flex;justify-content:space-between;gap:10px;font-size:14px;padding:9px 12px;background:#fafafa;border-radius:10px}
  .qx-intro li b{color:var(--primary);white-space:nowrap}
  .qx-acts{display:flex;gap:8px;margin-top:6px}
  .qx-acts .qx-btn{flex:1}
  .qx-empty{text-align:center;color:var(--text-muted);font-size:14px;padding:18px 0}
  @media(max-width:640px){
    .qx-ov{align-items:flex-end;padding:0}
    .qx-panel{width:100%;max-height:92vh;border-radius:18px 18px 0 0;padding-bottom:env(safe-area-inset-bottom)}
    .qx-intro .qx-panel{padding-bottom:calc(20px + env(safe-area-inset-bottom))}
    .qx-head{padding:18px 16px 12px}
    .qx-tabs,.qx-body{padding-left:16px;padding-right:16px}
  }`;
  document.head.appendChild(st);
}

const tom = (c, px) => (window.FV && window.FV.tomato) ? window.FV.tomato(c, px) : '';

function bar(p) { return '<div class="qx-bar"><i style="width:' + p + '%"></i></div>'; }

function viewQuests() {
  const rows = [];
  const d = today(state);
  const lv = levelOf(state ? state.total : 0);
  if (!user) {
    return '<div class="qx-card main"><div class="qx-t">Un compte est nécessaire</div><p class="qx-sub" style="margin:6px 0 12px">Connectez-vous pour gagner de l\'XP, suivre vos quêtes et apparaître dans le classement.</p><button class="qx-btn" data-go="login">Se connecter</button></div>' + viewRules();
  }
  const pct = Math.min(100, Math.round(d.pub / QUEST.need * 100));
  rows.push('<div class="qx-card main"><div class="qx-row"><span class="qx-t">Quête du jour : publier ' + QUEST.need + ' variétés</span><span class="qx-xp">+' + QUEST.xp + ' XP</span></div><div style="margin:10px 0 6px">' + bar(pct) + '</div><div class="qx-row"><span class="qx-sub" style="margin:0">' + Math.min(d.pub, QUEST.need) + ' / ' + QUEST.need + (d.quest ? ' terminée' : '') + '</span><span class="qx-sub" style="margin:0">Nouvelle quête dans ' + fmtLeft(nextDayStart() - Date.now()) + '</span></div></div>');
  let list = '';
  Object.keys(RULES).forEach(k => {
    const r = RULES[k];
    list += '<div class="qx-li"><span>' + r.label + '<br><small>' + d[k] + ' / ' + r.cap + ' aujourd\'hui</small></span><span class="qx-xp">+' + r.xp + ' XP</span></div>';
  });
  rows.push('<div class="qx-card"><div class="qx-t" style="margin-bottom:6px">Activités du jour</div><div class="qx-list">' + list + '</div></div>');
  const wx = weekXp(state);
  rows.push('<div class="qx-card"><div class="qx-row"><span class="qx-t">Concours de la semaine</span><span class="qx-xp">' + wx + ' XP</span></div><p class="qx-sub">' + (contestOn() ? 'Fin de la semaine dans ' + fmtLeft(nextWeekStart() - Date.now()) + '. Concours ouvert jusqu\'au 1er janvier 2027 à minuit (dans ' + fmtLeft(END - Date.now()) + ').' : 'Le concours est terminé.') + '</p></div>');
  return rows.join('');
}

function viewRules() {
  let li = '';
  Object.keys(RULES).forEach(k => { li += '<div class="qx-li"><span>' + RULES[k].label + '<br><small>' + RULES[k].cap + ' par jour au maximum</small></span><span class="qx-xp">+' + RULES[k].xp + ' XP</span></div>'; });
  li += '<div class="qx-li"><span>Quête du jour<br><small>Publier ' + QUEST.need + ' variétés</small></span><span class="qx-xp">+' + QUEST.xp + ' XP</span></div>';
  return '<div class="qx-card"><div class="qx-t" style="margin-bottom:6px">Comment gagner de l\'XP</div><div class="qx-list">' + li + '</div></div>';
}

function viewBoard() {
  const seg = '<div class="qx-seg"><button data-b="week" class="' + (board === 'week' ? 'on' : '') + '">Cette semaine</button><button data-b="all" class="' + (board === 'all' ? 'on' : '') + '">Total</button></div>';
  if (!lbData) return seg + '<div class="qx-empty">Chargement</div>';
  const wk = weekKey();
  const arr = Object.keys(lbData).map(uid => {
    const v = lbData[uid] || {};
    return { uid, name: v.name || 'Cultivateur', xp: board === 'week' ? ((v.weeks && v.weeks[wk]) || 0) : (v.total || 0) };
  }).filter(x => x.xp > 0).sort((a, b) => b.xp - a.xp);
  const top = arr.slice(0, 50);
  let h = seg;
  if (board === 'week') h += '<p class="qx-sub" style="margin:0">' + (contestOn() ? 'Le classement repart à zéro dans ' + fmtLeft(nextWeekStart() - Date.now()) + '.' : 'Concours terminé.') + '</p>';
  if (!top.length) return h + '<div class="qx-empty">Personne n\'a encore marqué de points. Soyez le premier.</div>';
  h += '<div>' + top.map((x, i) => '<div class="qx-rk' + (user && x.uid === user.uid ? ' me' : '') + (i < 3 ? ' top' : '') + '"><span class="qx-n">' + (i + 1) + '</span><span class="qx-nm">' + esc(x.name) + '</span><span class="qx-xp">' + x.xp + ' XP</span></div>').join('') + '</div>';
  if (user) {
    const idx = arr.findIndex(x => x.uid === user.uid);
    if (idx >= 50) h += '<p class="qx-sub">Votre position : ' + (idx + 1) + 'e avec ' + arr[idx].xp + ' XP</p>';
  }
  return h;
}

function paint() {
  const xp = state ? state.total : 0;
  const chip = document.getElementById('qx-chip');
  if (chip) chip.textContent = user ? xp + ' XP' : '';
  const panel = document.getElementById('qx-body');
  if (!panel) return;
  const lv = levelOf(xp);
  document.getElementById('qx-head').innerHTML = '<div>' + tom('Rouge', 46) + '</div><div style="flex:1;min-width:0"><h2>' + (user ? esc(lv.name) : 'Quêtes TomatoList') + '</h2>' + (user ? '<div style="margin-top:8px">' + bar(lv.pct) + '</div><div class="qx-sub">' + xp + ' XP' + (lv.to ? ', encore ' + (lv.to - xp) + ' pour le niveau suivant' : ', niveau maximum') + '</div>' : '<div class="qx-sub">Gagnez de l\'XP en participant au site</div>') + '</div>';
  document.querySelectorAll('.qx-tab').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
  panel.innerHTML = tab === 'quests' ? viewQuests() : viewBoard();
}

function build() {
  const nav = document.getElementById('btn-auth');
  const b = document.createElement('button');
  b.className = 'btn btn-outline';
  b.id = 'btn-quests';
  b.type = 'button';
  b.innerHTML = '<i class="fa-solid fa-trophy"></i> <span class="hide-mobile">Quêtes</span><b class="qx-chip" id="qx-chip"></b>';
  if (nav && nav.parentNode) nav.parentNode.insertBefore(b, nav);
  b.onclick = () => open('quests');

  const ov = document.createElement('div');
  ov.className = 'qx-ov';
  ov.id = 'qx-ov';
  ov.innerHTML = '<div class="qx-panel" role="dialog" aria-modal="true" aria-label="Quêtes"><button class="qx-x" id="qx-x" aria-label="Fermer"><i class="fa-solid fa-xmark"></i></button><div class="qx-head" id="qx-head"></div><div class="qx-tabs"><button class="qx-tab on" data-t="quests">Mes quêtes</button><button class="qx-tab" data-t="board">Classement</button></div><div class="qx-body" id="qx-body"></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', e => {
    if (e.target === ov || e.target.closest('#qx-x')) { ov.classList.remove('show'); return; }
    const t = e.target.closest('.qx-tab');
    if (t) { tab = t.dataset.t; if (tab === 'board' && !lbData) loadBoard().then(paint); paint(); return; }
    const bb = e.target.closest('[data-b]');
    if (bb) { board = bb.dataset.b; paint(); return; }
    if (e.target.closest('[data-go="login"]')) window.location.href = 'auth.html';
  });

  const intro = document.createElement('div');
  intro.className = 'qx-ov qx-intro';
  intro.id = 'qx-intro';
  intro.innerHTML = '<div class="qx-panel" role="dialog" aria-modal="true" aria-label="Présentation des quêtes"><div style="display:flex;justify-content:center">' + tom('Rouge', 56) + '</div><h2>Les quêtes arrivent sur TomatoList</h2><p>Chaque action utile fait grimper votre XP. Un compte est nécessaire pour participer et figurer au classement.</p><ul><li><span>Publier une variété</span><b>+20 XP</b></li><li><span>Quête du jour : 3 variétés publiées</span><b>+100 XP</b></li><li><span>Commentaire (10 par jour)</span><b>+5 XP</b></li><li><span>J\'aime</span><b>+2 XP</b></li><li><span>Partage du site</span><b>+1 XP</b></li></ul><p>Concours hebdomadaire avec classement, jusqu\'au 1er janvier 2027 à minuit.</p><div class="qx-acts" style="margin-top:16px"><button class="qx-btn ghost" id="qx-later">Plus tard</button><button class="qx-btn" id="qx-see">Voir les quêtes</button></div></div>';
  document.body.appendChild(intro);
  const closeIntro = () => { intro.classList.remove('show'); try { localStorage.setItem(INTRO_KEY, '1'); } catch (e) {} };
  intro.querySelector('#qx-later').onclick = closeIntro;
  intro.querySelector('#qx-see').onclick = () => { closeIntro(); open('quests'); };
  intro.addEventListener('click', e => { if (e.target === intro) closeIntro(); });
  let seen = false;
  try { seen = localStorage.getItem(INTRO_KEY) === '1'; } catch (e) {}
  if (!seen) setTimeout(() => intro.classList.add('show'), 1200);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { ov.classList.remove('show'); if (intro.classList.contains('show')) closeIntro(); } });
  paint();
}

function open(t) {
  tab = t || 'quests';
  document.getElementById('qx-ov').classList.add('show');
  paint();
  if (!lbData) loadBoard().then(paint);
  loadState().then(paint);
}

function boot() {
  let tries = 0;
  const iv = setInterval(() => {
    let app = null;
    try { app = getApp(); } catch (e) {}
    if (!app && ++tries < 100) return;
    clearInterval(iv);
    if (!app) return;
    db = getDatabase(app);
    auth = getAuth(app);
    css();
    build();
    onAuthStateChanged(auth, async u => { user = u; await loadState(); paint(); });
  }, 100);
}

window.QX = { award, open };

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
