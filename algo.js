/**
 * Moteur de Recommandation - TomatoList
 * Calcule un score de pertinence pour chaque tomate en fonction du profil utilisateur,
 * de son historique de "Likes" (filtrage collaboratif) et de son comportement de clics.
 */

// ─── Clés localStorage ───────────────────────────────────────────────────────
const CLICK_STORAGE_KEY = 'tl_clicks_v2';

/**
 * Enregistre un clic utilisateur sur une tomate.
 * Stocke les métadonnées de la tomate pour analyse comportementale ultérieure.
 */
export function recordClick(tomato) {
  if (!tomato || !tomato.id) return;
  try {
    const raw = localStorage.getItem(CLICK_STORAGE_KEY);
    const store = raw ? JSON.parse(raw) : {};

    const existing = store[tomato.id] || { count: 0, color: null, size: null, country: null };
    store[tomato.id] = {
      count: existing.count + 1,
      lastAt: Date.now(),
      color: tomato.color || null,
      size: tomato.averageSize || null,
      country: tomato.country || null,
    };

    // Limiter à 500 entrées pour ne pas saturer le localStorage
    const keys = Object.keys(store);
    if (keys.length > 500) {
      // On garde les 400 plus récents
      const sorted = keys.sort((a, b) => (store[b].lastAt || 0) - (store[a].lastAt || 0));
      sorted.slice(400).forEach(k => delete store[k]);
    }

    localStorage.setItem(CLICK_STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    // localStorage indisponible (mode privé strict) — on ignore silencieusement
  }
}

/**
 * Récupère les données de clics depuis le localStorage.
 */
export function getClickData() {
  try {
    const raw = localStorage.getItem(CLICK_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

// ─── Analyse comportementale ──────────────────────────────────────────────────

/**
 * Analyse l'historique de clics pour extraire les préférences implicites.
 * Retourne un objet { colors, sizes, countries } avec des scores pondérés.
 */
function analyzeClickBehavior(clickData) {
  const prefs = { colors: {}, sizes: {}, countries: {} };
  if (!clickData || Object.keys(clickData).length === 0) return prefs;

  const now = Date.now();
  const DECAY_HALF_LIFE_MS = 14 * 24 * 60 * 60 * 1000; // 14 jours

  Object.values(clickData).forEach(entry => {
    if (!entry) return;

    // Décroissance temporelle : les clics récents comptent plus
    const age = now - (entry.lastAt || 0);
    const decayFactor = Math.pow(0.5, age / DECAY_HALF_LIFE_MS);
    const weight = (entry.count || 1) * decayFactor;

    if (entry.color) {
      prefs.colors[entry.color] = (prefs.colors[entry.color] || 0) + weight;
    }
    if (entry.size) {
      prefs.sizes[entry.size] = (prefs.sizes[entry.size] || 0) + weight;
    }
    if (entry.country) {
      prefs.countries[entry.country] = (prefs.countries[entry.country] || 0) + weight;
    }
  });

  return prefs;
}

/**
 * Analyse l'historique de likes pour extraire les préférences implicites.
 */
function analyzeUserLikes(allTomatoes, uid) {
  const prefs = { colors: {}, sizes: {} };
  if (!uid) return prefs;

  allTomatoes.forEach(t => {
    if (t.likes && t.likes[uid]) {
      if (t.color) prefs.colors[t.color] = (prefs.colors[t.color] || 0) + 1;
      if (t.averageSize) prefs.sizes[t.averageSize] = (prefs.sizes[t.averageSize] || 0) + 1;
    }
  });
  return prefs;
}

// ─── Calcul de score ──────────────────────────────────────────────────────────

function computeScore(tomato, profile, likePrefs, clickPrefs, clickData) {
  let score = 0;

  // ── A. PREUVE SOCIALE (Popularité globale) ─────────────────────────────────
  const likesCount = Object.keys(tomato.likes || {}).length;
  score += likesCount * 1;

  // ── B. PRÉFÉRENCES EXPLICITES (Profil utilisateur connecté) ───────────────
  if (profile) {
    if (profile.favoriteColors && profile.favoriteColors.includes(tomato.color)) {
      score += 15;
    }
    if (profile.favoriteSize && tomato.averageSize === profile.favoriteSize) {
      score += 10;
    }
    if (profile.country && tomato.country === profile.country) {
      score += 5;
    }
  }

  // ── C. PRÉFÉRENCES IMPLICITES — Likes ─────────────────────────────────────
  if (tomato.color && likePrefs.colors[tomato.color]) {
    score += likePrefs.colors[tomato.color] * 2;
  }
  if (tomato.averageSize && likePrefs.sizes[tomato.averageSize]) {
    score += likePrefs.sizes[tomato.averageSize] * 1.5;
  }

  // ── D. PRÉFÉRENCES COMPORTEMENTALES — Clics ────────────────────────────────
  // Bonus si la couleur / taille / pays correspondent à ce que l'utilisateur a souvent cliqué
  const colorClickScore = tomato.color ? (clickPrefs.colors[tomato.color] || 0) : 0;
  const sizeClickScore = tomato.averageSize ? (clickPrefs.sizes[tomato.averageSize] || 0) : 0;
  const countryClickScore = tomato.country ? (clickPrefs.countries[tomato.country] || 0) : 0;

  score += colorClickScore * 3;   // La couleur est le signal le plus fort
  score += sizeClickScore * 2;
  score += countryClickScore * 1.5;

  // ── E. PÉNALITÉ DE REDONDANCE — Tomates déjà vues ────────────────────────
  // Une tomate cliquée plusieurs fois est déjà connue : on favorise la découverte
  if (clickData && clickData[tomato.id]) {
    const viewCount = clickData[tomato.id].count || 1;
    // Pénalité progressive mais plafonnée : max -10 points
    score -= Math.min(viewCount * 1.5, 10);
  }

  // ── F. FRAÎCHEUR (légère prime aux tomates récentes) ─────────────────────
  const ageMs = Date.now() - (tomato.createdAt || 0);
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays < 7) score += 4;
  else if (ageDays < 30) score += 2;

  return score;
}

// ─── Point d'entrée principal ─────────────────────────────────────────────────

/**
 * Trie les tomates selon le mode souhaité.
 * @param {Array} tomatoes - Liste des tomates
 * @param {string} sortBy - 'foryou' | 'date' | 'alpha' | 'likes'
 * @param {object|null} userProfile - Profil Firebase de l'utilisateur
 * @param {string|null} currentUserUid - UID Firebase de l'utilisateur
 */
export function sortTomatoes(tomatoes, sortBy, userProfile, currentUserUid) {
  if (sortBy === 'alpha') {
    return [...tomatoes].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  if (sortBy === 'likes') {
    return [...tomatoes].sort(
      (a, b) => Object.keys(b.likes || {}).length - Object.keys(a.likes || {}).length
    );
  }

  if (sortBy === 'foryou') {
    const clickData = getClickData();
    const likePrefs = analyzeUserLikes(tomatoes, currentUserUid);
    const clickPrefs = analyzeClickBehavior(clickData);

    const scored = tomatoes.map(tomato => ({
      ...tomato,
      _score: computeScore(tomato, userProfile, likePrefs, clickPrefs, clickData),
    }));

    return scored.sort((a, b) => b._score - a._score);
  }

  // Défaut : date décroissante (plus récentes en premier)
  return [...tomatoes].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

// ─── Tomates similaires ───────────────────────────────────────────────────────

/**
 * Renvoie les tomates les plus proches d'une tomate donnée.
 * Utilisé pour le bloc "Tomates similaires" de la fiche détail.
 */
export function similarTomatoes(tomatoes, target, limit = 3) {
  if (!target) return [];
  return tomatoes
    .filter(t => t.id !== target.id)
    .map(t => {
      let score = 0;
      if (t.color && target.color && t.color === target.color) score += 3;
      if (t.country && target.country && t.country === target.country) score += 2;
      if (t.averageSize && target.averageSize && t.averageSize === target.averageSize) score += 1;
      return { t, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || (b.t.createdAt || 0) - (a.t.createdAt || 0))
    .slice(0, limit)
    .map(x => x.t);
}
