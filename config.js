/* ══════════════════════════════════════════════════════════════════════
   CONFIGURATION DE LA SOURCE DE DONNÉES — Tendances Scientifiques
   ══════════════════════════════════════════════════════════════════════
   👉 C'est le SEUL endroit à modifier quand la base de données
      (Flask + SQLite) sera disponible, ou quand de nouveaux mois seront
      ajoutés.
   ══════════════════════════════════════════════════════════════════════ */
const APP_CONFIG = {
  MONTHS_FILES: [
    'fevrier2025',
    'mars2025',
    'avril2025',
    'juin2025',
    'juillet2025',
    'aout2025',
    'novembre2025',
    'decembre2025',
    'janvier2026',
    'fevrier2026',
    'mars2026',
    'avril2026',
    'mai2026',
    'juin2026',
  ],
  // 'json'    : charge les fichiers arxiv_<mois>.json ci-dessus
  // 'backend' : interroge l'API Flask + SQLite (actif)
  DATA_SOURCE: 'backend',
  // URL de base de l'API backend (utilisée uniquement si DATA_SOURCE = 'backend')
  // Endpoint attendu : GET {BACKEND_API_URL}/articles?mois=fevrier2026
  BACKEND_API_URL: 'https://realisationprog-1.onrender.com',
};
