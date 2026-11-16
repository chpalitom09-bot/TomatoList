import { getApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { getDatabase, ref, get, update, onValue, query, limitToLast } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-database.js";

let db = null, auth = null, user = null, notifs = [], unsub = null, curUid = null, curTab = 'apercu', cache = {}, seenIds = null;
const HUES = ['#b91c1c', '#c2410c', '#a16207', '#15803d', '#0f766e', '#9f1239'];
const Q = () => window.QX || {};
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toast = (m, i) => { if (window.TL && window.TL.toast) window.TL.toast(m, i || 'fa-check'); };
const hue = uid => HUES[[...String(uid)].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length];
const initial = n => (String(n || '?').trim().charAt(0) || '?').toUpperCase();

function css() {
  const st = document.createElement('style');
  st.textContent = `
  .qn-badge{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;border-radius:99px;background:var(--primary);color:#fff;font-size:11px;font-weight:700;display:none;align-items:center;justify-content:center;padding:0 5px;border:2px solid #fff}
  .qn-badge.on{display:flex}
  #btn-bell{position:relative}
  .qn-item{display:flex;gap:12px;align-items:flex-start;padding:12px 4px;border-top:1px solid #f3f4f6;cursor:pointer;font-size:14px;line-height:1.4}
  .qn-item:first-child{border-top:none}
  .qn-item.new{background:#fffafa}
  .qn-av{width:36px;height:36px;border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0}
  .qn-item small{display:block;color:var(--text-muted);font-size:12px;margin-top:2px}
  .qp{position:fixed;inset:0;background:var(--bg);z-index:3500;overflow:auto;display:none;overscroll-behavior:contain}
  .qp.show{display:block}
  .qp-bar{position:sticky;top:0;z-index:5;background:rgba(255,255,255,.95);border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:10px 16px;padding-top:calc(10px + env(safe-area-inset-top))}
  .qp-wrap{max-width:860px;margin:0 auto;padding-bottom:calc(40px + env(safe-area-inset-bottom))}
  .qp-hero{background:#fff;border-bottom:1px solid var(--line)}
  .qp-ban{height:120px}
  .qp-in{padding:0 20px 18px;position:relative}
  .qp-av{width:96px;height:96px;border-radius:50%;border:4px solid #fff;color:#fff;font:700 38px var(--display);display:flex;align-items:center;justify-content:center;margin-top:-48px;box-shadow:0 2px 8px rgba(0,0,0,.12)}
  .qp-top{display:flex;justify-content:space-between;align-items:flex-end;gap:10px;flex-wrap:wrap}
  .qp-nm{font:700 24px var(--display);margin-top:10px;word-break:break-word}
  .qp-meta{font-size:13px;color:var(--text-muted);margin-top:2px}
  .qp-bio{margin-top:10px;font-size:14.5px;line-height:1.5;white-space:pre-wrap;word-break:break-word}
  .qp-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:16px}
  .qp-stats div{background:#fafafa;border-radius:12px;padding:10px 6px;text-align:center;display:flex;flex-direction:column;gap:2px}
  .qp-stats b{font:700 19px var(--display)}
  .qp-stats span{font-size:11.5px;color:var(--text-muted)}
  .qp-tabs{display:flex;gap:4px;padding:0 14px;background:#fff;border-bottom:1px solid var(--line);overflow-x:auto;scrollbar-width:none}
  .qp-tab{border:none;background:none;padding:13px 10px;font:600 14px var(--sans);color:var(--text-muted);cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap}
  .qp-tab.on{color:var(--text-main);border-color:var(--primary)}
  .qp-body{padding:16px;display:flex;flex-direction:column;gap:14px}
  .qp-card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px}
  .qp-card h3{font:700 15px var(--sans);margin-bottom:10px}
  .qp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px}
  .qp-v{background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden;cursor:pointer;text-align:left;padding:0;font-family:inherit}
  .qp-v .im{aspect-ratio:1;background:#f3f4f6;display:flex;align-items:center;justify-content:center}
  .qp-v img{width:100%;height:100%;object-fit:cover;display:block}
  .qp-v .tx{padding:9px 11px;font-size:13.5px;font-weight:600}
  .qp-v .tx small{display:block;font-weight:500;color:var(--text-muted);font-size:12px;margin-top:2px}
  .qp-bd{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
  .qp-b{border:1px solid var(--line);border-radius:12px;padding:10px 12px;font-size:13px}
  .qp-b b{display:block;font-size:13.5px}
  .qp-b span{color:var(--text-muted);font-size:12px}
  .qp-b.on{border-color:#fca5a5;background:#fef2f2}
  .qp-b.off{opacity:.5}
  .qp-pp{display:flex;align-items:center;gap:12px;padding:10px;border-radius:12px;cursor:pointer}
  .qp-pp:hover{background:#fafafa}
  .qp-pp .qn-av{width:40px;height:40px}
  .qp-in input,.qp-in textarea,.qp-edit input,.qp-edit textarea{width:100%;border:1.5px solid var(--line);border-radius:10px;padding:10px 12px;font:14px var(--sans);margin-bottom:10px;background:#fff}
  .qp-btn{border:none;border-radius:10px;padding:10px 16px;font:600 14px var(--sans);cursor:pointer;background:var(--primary);color:#fff}
  .qp-btn.ghost{background:#f3f4f6;color:var(--text-main)}
  .qp-btn.line{background:#fff;border:1.5px solid var(--line);color:var(--text-main)}
  .qp-btn:disabled{opacity:.6}
  .qp-row{display:flex;gap:8px;flex-wrap:wrap}
  .qp-empty{text-align:center;color:var(--text-muted);font-size:14px;padding:24px 0}
  @media(max-width:640px){
    .qp-ban{height:90px}
    .qp-in{padding:0 14px 16px}
    .qp-nm{font-size:21px}
    .qp-stats b{font-size:16px}
    .qp-grid{grid-template-columns:repeat(2,1fr);gap:10px}
    .qp-body{padding:12px}
  }`;
  document.head.appendChild(st);
}

function lbOf(all, uid) { return (all && all[uid]) || {}; }

async function getList(path) {
  try { const s = await get(ref(db, path)); return s.exists() ? Object.keys(s.val()) : []; } catch (e) { return []; }
}

async function notify(target, type, extra) {
  if (!user || !target || target === user.uid) return;
  extra = extra || {};
  const c = Q().ctx ? Q().ctx() : {};
  const id = type === 'comment' ? 'c_' + Date.now().toString(36) + '_' + user.uid : type + '_' + (extra.tid ? extra.tid + '_' : '') + user.uid;
  const o = { type, from: user.uid, fromName: String(c.name || 'Quelqu\'un').slice(0, 40), at: Date.now(), read: false };
  if (extra.tid) o.tid = String(extra.tid).slice(0, 40);
  if (extra.tname) o.tname = String(extra.tname).slice(0, 80);
  try { await update(ref(db, 'notif/' + target), { [id]: o }); } catch (e) {}
}

function notifText(n) {
  const w = '<b>' + esc(n.fromName || 'Quelqu\'un') + '</b>';
  if (n.type === 'follow') return w + ' vous suit maintenant';
  if (n.type === 'like') return w + ' a aimé ' + esc(n.tname || 'votre variété');
  if (n.type === 'comment') return w + ' a commenté ' + esc(n.tname || 'votre variété');
  return w;
}

function ago(t) {
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return 'à l\'instant';
  if (m < 60) return 'il y a ' + m + ' min';
  const h = Math.floor(m / 60);
  if (h < 24) return 'il y a ' + h + ' h';
  return 'il y a ' + Math.floor(h / 24) + ' j';
}

function paintBell() {
  const n = notifs.filter(x => !x.read).length;
  const b = document.getElementById('qn-badge');
  if (!b) return;
  b.textContent = n > 9 ? '9+' : String(n);
  b.classList.toggle('on', n > 0);
  const list = document.getElementById('qn-list');
  if (!list) return;
  list.innerHTML = notifs.length ? notifs.map(n => '<div class="qn-item' + (n.read ? '' : ' new') + '" data-from="' + esc(n.from) + '" data-tid="' + esc(n.tid || '') + '" data-type="' + esc(n.type) + '"><span class="qn-av" style="background:' + hue(n.from) + '">' + esc(initial(n.fromName)) + '</span><div>' + notifText(n) + '<small>' + ago(n.at) + '</small></div></div>').join('') : '<div class="qp-empty">Aucune notification pour le moment</div>';
}

function watchNotifs() {
  if (unsub) { unsub(); unsub = null; }
  notifs = [];
  seenIds = null;
  paintBell();
  if (!user) return;
  unsub = onValue(query(ref(db, 'notif/' + user.uid), limitToLast(40)), snap => {
    const v = snap.val() || {};
    notifs = Object.keys(v).map(k => Object.assign({ id: k }, v[k])).sort((a, b) => b.at - a.at);
    if (seenIds && document.hidden && window.Notification && Notification.permission === 'granted') {
      notifs.filter(n => !n.read && !seenIds.has(n.id)).slice(0, 3).forEach(n => { try { new Notification('TomatoList', { body: notifText(n).replace(/<[^>]+>/g, '') }); } catch (e) {} });
    }
    seenIds = new Set(notifs.map(n => n.id));
    paintBell();
  }, () => {});
}

async function markRead() {
  if (!user) return;
  const up = {};
  notifs.filter(n => !n.read).forEach(n => { up['notif/' + user.uid + '/' + n.id + '/read'] = true; });
  if (Object.keys(up).length) { try { await update(ref(db), up); } catch (e) {} }
}

function buildNotifUi() {
  const bell = document.createElement('button');
  bell.className = 'btn btn-outline';
  bell.id = 'btn-bell';
  bell.type = 'button';
  bell.setAttribute('aria-label', 'Notifications');
  bell.innerHTML = '<i class="fa-solid fa-bell"></i><b class="qn-badge" id="qn-badge"></b>';
  const anchor = document.getElementById('btn-quests') || document.getElementById('btn-auth');
  if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(bell, anchor);
  const ov = document.createElement('div');
  ov.className = 'qx-ov';
  ov.id = 'qn-ov';
  ov.innerHTML = '<div class="qx-panel" role="dialog" aria-modal="true" aria-label="Notifications"><button class="qx-x" id="qn-x" aria-label="Fermer"><i class="fa-solid fa-xmark"></i></button><div class="qx-head"><h2>Notifications</h2></div><div class="qx-body"><div id="qn-list"></div><button class="qp-btn line" id="qn-perm" style="display:none">Activer les alertes du navigateur</button></div></div>';
  document.body.appendChild(ov);
  bell.onclick = () => {
    if (!user) { window.location.href = 'auth.html'; return; }
    ov.classList.add('show');
    const pm = document.getElementById('qn-perm');
    pm.style.display = window.Notification && Notification.permission === 'default' ? '' : 'none';
    paintBell();
    setTimeout(markRead, 600);
  };
  ov.addEventListener('click', e => {
    if (e.target === ov || e.target.closest('#qn-x')) { ov.classList.remove('show'); return; }
    if (e.target.closest('#qn-perm')) { Notification.requestPermission().then(() => { document.getElementById('qn-perm').style.display = 'none'; }); return; }
    const it = e.target.closest('.qn-item');
    if (!it) return;
    ov.classList.remove('show');
    if (it.dataset.tid && it.dataset.type !== 'follow' && window.TL) window.TL.openDetail(it.dataset.tid);
    else openProfile(it.dataset.from);
  });
}

function badges(l, followers) {
  const c = l.cnt || {};
  const lv = Q().levelOf ? Q().levelOf(l.total || 0).i : 0;
  return [
    ['Premier plant', '1 variété publiée', (c.pub || 0) >= 1],
    ['Jardinier', '10 variétés publiées', (c.pub || 0) >= 10],
    ['Bavard', '20 commentaires', (c.comment || 0) >= 20],
    ['Ambassadeur', '25 partages', (c.share || 0) >= 25],
    ['Parrain', '3 amis invités', (c.ref || 0) >= 3],
    ['Assidu', 'Série de 7 jours', (l.streak || 0) >= 7],
    ['Populaire', '10 abonnés', followers >= 10],
    ['Maître jardinier', 'Niveau maximum', lv >= 5]
  ];
}

async function render(uid) {
  const root = document.getElementById('qp-root');
  root.innerHTML = '<div class="qp-empty">Chargement</div>';
  const [all, pb, fing, fers] = await Promise.all([
    Q().board ? Q().board(true) : {},
    get(ref(db, 'pub/' + uid)).then(s => s.exists() ? s.val() : {}).catch(() => ({})),
    getList('follows/' + uid),
    getList('followers/' + uid)
  ]);
  if (curUid !== uid) return;
  cache = { all, pb, fing, fers };
  const l = lbOf(all, uid);
  const isMe = !!(user && user.uid === uid);
  const nm = pb.name || l.name || 'Cultivateur';
  const total = l.total || 0;
  const lv = Q().levelOf(total);
  const tom = (window.TL && window.TL.getTomatoes ? window.TL.getTomatoes() : []).filter(t => t.uid === uid).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const likes = tom.reduce((a, t) => a + Object.keys(t.likes || {}).length, 0);
  const sorted = Object.keys(all || {}).filter(k => (all[k].total || 0) > 0).sort((a, b) => (all[b].total || 0) - (all[a].total || 0));
  const rank = sorted.indexOf(uid) + 1;
  const iFollow = !!(user && fers.indexOf(user.uid) >= 0);
  const since = pb.since ? new Date(pb.since).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '';
  const tabs = [['apercu', 'Aperçu'], ['varietes', 'Variétés (' + tom.length + ')'], ['abonnes', 'Abonnés (' + fers.length + ')'], ['abonnements', 'Abonnements (' + fing.length + ')']];
  if (isMe) tabs.push(['fil', 'Fil']);
  if (!tabs.some(t => t[0] === curTab)) curTab = 'apercu';
  let actions = '';
  if (isMe) actions = '<button class="qp-btn line" data-a="edit">Modifier le profil</button><button class="qp-btn ghost" data-a="invite">Inviter</button><button class="qp-btn ghost" data-a="out">Déconnexion</button>';
  else actions = '<button class="qp-btn' + (iFollow ? ' line' : '') + '" data-a="follow">' + (iFollow ? 'Abonné' : 'Suivre') + '</button>';
  root.innerHTML = '<div class="qp-hero"><div class="qp-ban" style="background:' + hue(uid) + '"></div><div class="qp-in"><div class="qp-top"><div class="qp-av" style="background:' + hue(uid) + '">' + esc(initial(nm)) + '</div><div class="qp-row">' + actions + '</div></div><div class="qp-nm">' + esc(nm) + '</div><div class="qp-meta">Niveau ' + (lv.i + 1) + ', ' + esc(lv.name) + (since ? ' · membre depuis ' + esc(since) : '') + (l.streak ? ' · série de ' + l.streak + ' j' : '') + '</div>' + (pb.bio ? '<div class="qp-bio">' + esc(pb.bio) + '</div>' : (isMe ? '<div class="qp-bio" style="color:var(--text-muted)">Ajoutez une présentation pour vous faire connaître.</div>' : '')) + '<div id="qp-edit"></div><div class="qp-stats"><div><b>' + total + '</b><span>XP' + (rank ? ', #' + rank : '') + '</span></div><div><b>' + tom.length + '</b><span>variétés</span></div><div><b>' + likes + '</b><span>j\'aime reçus</span></div><div><b>' + fers.length + '</b><span>abonnés</span></div></div></div></div><div class="qp-tabs">' + tabs.map(t => '<button class="qp-tab' + (t[0] === curTab ? ' on' : '') + '" data-t="' + t[0] + '">' + t[1] + '</button>').join('') + '</div><div class="qp-body" id="qp-tab"></div>';
  paintTab(uid, { l, tom, fing, fers, all, isMe, total });
  root._d = { l, tom, fing, fers, all, isMe, total, nm, pb, iFollow };
}

function people(list, all) {
  if (!list.length) return '<div class="qp-empty">Personne pour le moment</div>';
  return '<div class="qp-card">' + list.map(u => { const nm = (all && all[u] && all[u].name) || 'Cultivateur'; return '<div class="qp-pp" data-p="' + esc(u) + '"><span class="qn-av" style="background:' + hue(u) + '">' + esc(initial(nm)) + '</span><div><b>' + esc(nm) + '</b><div class="qp-meta">' + ((all && all[u] && all[u].total) || 0) + ' XP</div></div></div>'; }).join('') + '</div>';
}

function card(t) {
  const im = Array.isArray(t.imageURLs) ? t.imageURLs[0] : (t.imageURLs && Object.values(t.imageURLs)[0]);
  const n = Object.keys(t.likes || {}).length;
  return '<button class="qp-v" data-tid="' + esc(t.id) + '"><div class="im">' + (im ? '<img loading="lazy" src="' + esc(im) + '" alt="' + esc(t.name) + '">' : (window.FV ? window.FV.tomato(t.color, 46) : '')) + '</div><div class="tx">' + esc(t.name) + '<small>' + n + ' j\'aime</small></div></button>';
}

function paintTab(uid, d) {
  const box = document.getElementById('qp-tab');
  if (!box) return;
  document.querySelectorAll('.qp-tab').forEach(b => b.classList.toggle('on', b.dataset.t === curTab));
  if (curTab === 'apercu') {
    const ds = Q().dayList(30);
    const vals = ds.map(k => (d.l.hist && d.l.hist[k]) || 0);
    const bd = badges(d.l, d.fers.length);
    box.innerHTML = '<div class="qp-card"><h3>XP gagnés, 30 derniers jours</h3>' + Q().chart(vals, ds, hue(uid)) + '</div><div class="qp-card"><h3>Badges (' + bd.filter(b => b[2]).length + ' sur ' + bd.length + ')</h3><div class="qp-bd">' + bd.map(b => '<div class="qp-b ' + (b[2] ? 'on' : 'off') + '"><b>' + b[0] + '</b><span>' + b[1] + '</span></div>').join('') + '</div></div>';
  } else if (curTab === 'varietes') {
    box.innerHTML = d.tom.length ? '<div class="qp-grid">' + d.tom.map(card).join('') + '</div>' : '<div class="qp-empty">Aucune variété publiée pour le moment</div>';
  } else if (curTab === 'abonnes') {
    box.innerHTML = people(d.fers, d.all);
  } else if (curTab === 'abonnements') {
    box.innerHTML = people(d.fing, d.all);
  } else if (curTab === 'fil') {
    const set = new Set(d.fing);
    const feed = (window.TL ? window.TL.getTomatoes() : []).filter(t => t.uid && set.has(t.uid)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 24);
    box.innerHTML = feed.length ? '<div class="qp-grid">' + feed.map(card).join('') + '</div>' : '<div class="qp-empty">Suivez des cultivateurs pour voir leurs nouvelles variétés ici</div>';
  }
}

async function toggleFollow(uid) {
  if (!user) { window.location.href = 'auth.html'; return; }
  const d = document.getElementById('qp-root')._d;
  const on = !d.iFollow;
  const up = {};
  up['follows/' + user.uid + '/' + uid] = on ? true : null;
  up['followers/' + uid + '/' + user.uid] = on ? true : null;
  try {
    await update(ref(db), up);
    if (on) notify(uid, 'follow');
    render(uid);
  } catch (e) { toast('Action impossible pour le moment', 'fa-triangle-exclamation'); }
}

function editForm() {
  const d = document.getElementById('qp-root')._d;
  const box = document.getElementById('qp-edit');
  box.innerHTML = '<div style="margin-top:14px"><input id="qe-name" maxlength="30" placeholder="Pseudo" value="' + esc(d.pb.name || d.l.name || '') + '"><textarea id="qe-bio" rows="3" maxlength="200" placeholder="Présentez-vous en quelques mots">' + esc(d.pb.bio || '') + '</textarea><div class="qp-row"><button class="qp-btn" data-a="save">Enregistrer</button><button class="qp-btn ghost" data-a="cancel">Annuler</button></div></div>';
}

async function saveForm() {
  const n = document.getElementById('qe-name').value.trim().slice(0, 30);
  const b = document.getElementById('qe-bio').value.trim().slice(0, 200);
  if (n.length < 2) { toast('Le pseudo doit faire au moins 2 caractères', 'fa-circle-exclamation'); return; }
  const up = {};
  up['pub/' + user.uid + '/name'] = n;
  up['pub/' + user.uid + '/bio'] = b;
  up['lb/' + user.uid + '/name'] = n;
  try {
    await update(ref(db), up);
    if (Q().setName) Q().setName(n);
    toast('Profil mis à jour', 'fa-check');
    render(user.uid);
  } catch (e) { toast('Enregistrement impossible', 'fa-triangle-exclamation'); }
}

function openProfile(uid) {
  uid = uid || (user && user.uid);
  if (!uid) { window.location.href = 'auth.html'; return; }
  if (window.location.hash === '#u=' + uid) { show(uid); return; }
  window.location.hash = 'u=' + uid;
}

function show(uid) {
  const el = document.getElementById('qp');
  if (!el) return;
  if (curUid !== uid) curTab = 'apercu';
  curUid = uid;
  el.classList.add('show');
  document.body.style.overflow = 'hidden';
  el.scrollTop = 0;
  render(uid);
}

function hide() {
  const el = document.getElementById('qp');
  if (el) el.classList.remove('show');
  document.body.style.overflow = '';
  curUid = null;
}

function closeProfile() {
  if (window.location.hash.indexOf('#u=') === 0) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  hide();
}

function route() {
  const m = /^#u=([A-Za-z0-9_-]{6,40})$/.exec(window.location.hash);
  if (m) show(m[1]); else hide();
}

function buildProfileUi() {
  const el = document.createElement('div');
  el.className = 'qp';
  el.id = 'qp';
  el.innerHTML = '<div class="qp-bar"><button class="qp-btn ghost" id="qp-back"><i class="fa-solid fa-arrow-left"></i> Retour</button><b style="font-family:var(--display)">TomatoList</b><span style="width:80px"></span></div><div class="qp-wrap" id="qp-root"></div>';
  document.body.appendChild(el);
  el.addEventListener('click', async e => {
    if (e.target.closest('#qp-back')) { closeProfile(); return; }
    const t = e.target.closest('.qp-tab');
    if (t) { curTab = t.dataset.t; const d = document.getElementById('qp-root')._d; if (d) paintTab(curUid, d); return; }
    const p = e.target.closest('[data-p]');
    if (p) { openProfile(p.dataset.p); return; }
    const v = e.target.closest('[data-tid]');
    if (v && window.TL) { closeProfile(); window.TL.openDetail(v.dataset.tid); return; }
    const a = e.target.closest('[data-a]');
    if (!a) return;
    const k = a.dataset.a;
    if (k === 'follow') toggleFollow(curUid);
    else if (k === 'edit') editForm();
    else if (k === 'cancel') document.getElementById('qp-edit').innerHTML = '';
    else if (k === 'save') saveForm();
    else if (k === 'invite') { if (Q().open) { closeProfile(); Q().open('quests'); } }
    else if (k === 'out') { try { await signOut(auth); } catch (x) {} closeProfile(); toast('Déconnexion réussie', 'fa-check'); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && el.classList.contains('show')) closeProfile(); });
  window.addEventListener('hashchange', route);
  route();
}

function boot() {
  let tries = 0;
  const iv = setInterval(() => {
    let app = null;
    try { app = getApp(); } catch (e) {}
    const ready = document.getElementById('btn-quests') && window.QX && window.QX.levelOf;
    if (!(app && ready) && ++tries < 120) return;
    clearInterval(iv);
    if (!app) return;
    db = getDatabase(app);
    auth = getAuth(app);
    css();
    buildNotifUi();
    buildProfileUi();
    onAuthStateChanged(auth, u => { user = u; watchNotifs(); });
  }, 100);
}

Object.assign(window.QX = window.QX || {}, { profile: openProfile, notify });

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
