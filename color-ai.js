/* TomatoList — avis d'une petite IA locale sur la couleur d'une tomate (optionnel).
 *
 * Modèle : CLIP (Xenova/clip-vit-base-patch32) via transformers.js, exécuté dans le navigateur du modérateur.
 *   - aucune photo n'est envoyée à un serveur d'IA ;
 *   - le modèle est téléchargé une seule fois (puis mis en cache par le navigateur) ;
 *   - c'est une classification « zéro-shot » : on lui donne des phrases (« a photo of a red tomato »…) et il dit laquelle colle le mieux à l'image.
 * On lui donne l'image déjà recadrée sur la tomate par color-detect.js, puis on fusionne son avis avec celui des pixels.
 */
(function (root) {
  'use strict';
  var LIB = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';
  var MODELE = 'Xenova/clip-vit-base-patch32';

  // Phrases décrivant chaque couleur connue (en anglais : c'est la langue de CLIP)
  var PHRASES = {
    'Rouge': 'a photo of a ripe red tomato',
    'Jaune': 'a photo of a yellow tomato',
    'Noire': 'a photo of a black tomato, very dark purple-brown',
    'Verte': 'a photo of a green tomato',
    'Orange': 'a photo of an orange tomato',
    'Rose': 'a photo of a pink tomato',
    'Blanche': 'a photo of a white tomato',
    'Violette': 'a photo of a purple tomato',
    'Bordeaux': 'a photo of a dark burgundy red tomato',
    'Crème': 'a photo of a cream-colored pale tomato',
    'Bleue': 'a photo of a blue-indigo tomato',
    'Turquoise': 'a photo of a turquoise tomato',
    'Corail': 'a photo of a coral tomato',
    'Saumon': 'a photo of a salmon-colored tomato',
    'Chocolat': 'a photo of a chocolate brown tomato',
    'Ocre': 'a photo of an ochre tomato',
    'Prune': 'a photo of a plum-colored tomato',
    'Grise': 'a photo of a grey tomato',
    'Dorée': 'a photo of a golden tomato',
    'Bicolore': 'a photo of a bicolor tomato, red and yellow',
    'Rayée': 'a photo of a striped tomato with green and yellow stripes',
    'Arc-en-ciel': 'a photo of a rainbow multicolored tomato'
  };
  var EN = { Rouge: 'red', Jaune: 'yellow', Noire: 'black', Verte: 'green', Orange: 'orange', Rose: 'pink', Blanche: 'white', Violette: 'purple', Bordeaux: 'burgundy', 'Crème': 'cream', Bleue: 'blue', Turquoise: 'turquoise', Corail: 'coral', Saumon: 'salmon', Chocolat: 'brown', Ocre: 'ochre', Prune: 'plum', Grise: 'grey', 'Dorée': 'golden' };

  var pipePromise = null;

  function charger(progression) {
    if (pipePromise) return pipePromise;
    pipePromise = (async function () {
      var T = await import(LIB);
      var options = { progress_callback: function (p) { if (progression && p && p.status === 'progress') progression(Math.round(p.progress || 0), p.file); } };
      if (typeof navigator !== 'undefined' && navigator.gpu) {
        try { return await T.pipeline('zero-shot-image-classification', MODELE, Object.assign({ device: 'webgpu' }, options)); }
        catch (e) { /* WebGPU indisponible : on retombe sur WASM */ }
      }
      return await T.pipeline('zero-shot-image-classification', MODELE, options);
    })();
    pipePromise.catch(function () { pipePromise = null; }); // permet de réessayer après un échec réseau
    return pipePromise;
  }

  function versBlobUrl(canvas) {
    return new Promise(function (ok, ko) {
      canvas.toBlob(function (b) { b ? ok(URL.createObjectURL(b)) : ko(new Error('canvas vide')); }, 'image/png');
    });
  }

  // extra : { nom: hex | {hex, hex2} } (couleurs ajoutées par les modérateurs) ; recadrages : canvas[]
  // Renvoie { Rouge: 0.71, Jaune: 0.05, … } (somme = 1) ou null si l'IA n'a rien pu dire.
  async function classer(recadrages, extra, progression) {
    if (!recadrages || !recadrages.length) return null;
    var phrases = Object.assign({}, PHRASES);
    Object.keys(extra || {}).forEach(function (nom) { // couleurs bigarrées créées : « a pink and green bicolor tomato »
      var v = extra[nom];
      if (!v || typeof v !== 'object' || !v.hex2 || !root.ColorDetect) return;
      var a = EN[root.ColorDetect.ancreDe(v.hex)], b = EN[root.ColorDetect.ancreDe(v.hex2)];
      if (a && b && a !== b) phrases[nom] = 'a photo of a ' + a + ' and ' + b + ' bicolor tomato';
    });
    var noms = Object.keys(phrases), labels = noms.map(function (n) { return phrases[n]; });
    var clf = await charger(progression);
    var somme = {}, n = 0;
    for (var i = 0; i < Math.min(2, recadrages.length); i++) {
      var url = await versBlobUrl(recadrages[i]);
      try {
        var sortie = await clf(url, labels, { hypothesis_template: '{}' });
        sortie.forEach(function (r) { var nom = noms[labels.indexOf(r.label)]; if (nom) somme[nom] = (somme[nom] || 0) + r.score; });
        n++;
      } finally { URL.revokeObjectURL(url); }
    }
    if (!n) return null;
    var tot = 0;
    Object.keys(somme).forEach(function (k) { tot += somme[k]; });
    var res = {};
    Object.keys(somme).forEach(function (k) { res[k] = somme[k] / tot; });
    return res;
  }

  root.ColorAI = { charger: charger, classer: classer, MODELE: MODELE };
})(typeof window !== 'undefined' ? window : globalThis);
