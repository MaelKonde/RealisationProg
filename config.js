/* ══════════════════════════════════════════════════════════════════════
   CONFIGURATION DE LA SOURCE DE DONNÉES
   ══════════════════════════════════════════════════════════════════════
   👉 C'est le SEUL endroit à modifier quand la base de données
      (Flask + SQLite) sera disponible.

   1. Passez DATA_SOURCE de 'json' à 'backend'
   2. Renseignez BACKEND_API_URL avec l'URL de votre API
   3. C'est tout — app.js s'adapte automatiquement (voir fetchMonthData
      dans js/app.js)
   ══════════════════════════════════════════════════════════════════════ */
const APP_CONFIG = {
  // 'json'    : lit les fichiers arxiv_<mois>.json placés à côté de index.html
  //             (mode actuel, en attendant la BDD)
  // 'backend' : interroge l'API Flask + SQLite via BACKEND_API_URL
  DATA_SOURCE: 'json',

  // URL de base de l'API backend (utilisée uniquement si DATA_SOURCE = 'backend')
  // Endpoint attendu : GET {BACKEND_API_URL}/articles?mois=fevrier2026
  BACKEND_API_URL: 'http://localhost:5000/api',
};
