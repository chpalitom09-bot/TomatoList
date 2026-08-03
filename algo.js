/**
 * Moteur de Recommandation - TomatoList
 * Calcule un score de pertinence pour chaque tomate en fonction du profil utilisateur 
 * et de son historique de "Likes" (filtrage collaboratif).
 */

export function sortTomatoes(tomatoes, sortBy, userProfile, currentUserUid) {
  if (sortBy === 'alpha') {
    return tomatoes.sort((a, b) => (a.name || '').localeCompare(b.name));
  }
  
  if (sortBy === 'likes') {
    return tomatoes.sort((a, b) => (Object.keys(b.likes || {}).length) - (Object.keys(a.likes || {}).length));
  }
  
  if (sortBy === 'foryou') {
    // 1. Pré-calculer les tendances implicites de l'utilisateur (ce qu'il a liké)
    const implicitPreferences = analyzeUserLikes(tomatoes, currentUserUid);

    // 2. Assigner un score à chaque tomate
    const scoredTomatoes = tomatoes.map(tomato => {
      const score = computeScore(tomato, userProfile, implicitPreferences);
      return { ...tomato, _score: score };
    });

    // 3. Trier par score décroissant (les meilleures recommandations en premier)
    return scoredTomatoes.sort((a, b) => b._score - a._score);
  }
  
  // Par défaut : Tri par date (Les plus récentes)
  return tomatoes.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

function analyzeUserLikes(allTomatoes, uid) {
  const prefs = { colors: {}, sizes: {} };
  if (!uid) return prefs;

  allTomatoes.forEach(t => {
    if (t.likes && t.likes[uid]) {
      // Compte les couleurs likées
      if (t.color) prefs.colors[t.color] = (prefs.colors[t.color] || 0) + 1;
      // Compte les tailles likées
      if (t.averageSize) prefs.sizes[t.averageSize] = (prefs.sizes[t.averageSize] || 0) + 1;
    }
  });
  return prefs;
}

function computeScore(tomato, profile, implicitPrefs) {
  let score = 0;
  
  // A. PREUVE SOCIALE (Popularité globale)
  // +1 point par like global
  score += Object.keys(tomato.likes || {}).length * 1;
  
  if (!profile) return score; // Si l'utilisateur n'est pas connecté, seul le score de popularité compte.

  // B. PRÉFÉRENCES EXPLICITES (Ce que l'utilisateur a répondu dans auth.html)
  if (profile.favoriteColors && profile.favoriteColors.includes(tomato.color)) {
    score += 15;
  }
  if (profile.favoriteSize && tomato.averageSize === profile.favoriteSize) {
    score += 10;
  }
  if (profile.country && tomato.country === profile.country) {
    score += 5;
  }

  // C. PRÉFÉRENCES IMPLICITES (L'historique de ses likes)
  // Si la tomate a la même couleur qu'une couleur qu'il a souvent likée, on ajoute un bonus proportionnel
  if (tomato.color && implicitPrefs.colors[tomato.color]) {
    score += (implicitPrefs.colors[tomato.color] * 2); 
  }
  if (tomato.averageSize && implicitPrefs.sizes[tomato.averageSize]) {
    score += (implicitPrefs.sizes[tomato.averageSize] * 1.5);
  }

  return score;
}
