/* ══════════════════════════════════════════════════════════════════════
   CONFIGURATION DE LA SOURCE DE DONNÉES — Tendances Scientifiques
   ══════════════════════════════════════════════════════════════════════
   👉 C'est le SEUL endroit à modifier quand la base de données
      (Flask + SQLite) sera disponible, ou quand de nouveaux mois seront
      ajoutés.
   ══════════════════════════════════════════════════════════════════════ */
const APP_CONFIG = {
    'arxiv_aout2025.json',
    'arxiv_avril2025.json',
    'arxiv_avril2026.json',
    'arxiv_decembre2025.json',
    'arxiv_fevrier2025.json',
    'arxiv_fevrier2026.json',
    'arxiv_janvier2026.json',
    'arxiv_juillet2025.json',
    'arxiv_juin2025.json',
    'arxiv_juin2026.json',
    'arxiv_mai2026.json',
    'arxiv_mars2025.json',
    'arxiv_mars2026.json',
    'arxiv_novembre2025.json',
   
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

  // 'json'    : charge les fichiers arxiv_<mois>.json ci-dessus (actif)
  // 'backend' : interroge l'API Flask + SQLite (à activer plus tard)
  DATA_SOURCE: 'json',

  // URL de base de l'API backend (utilisée uniquement si DATA_SOURCE = 'backend')
  // Endpoint attendu : GET {BACKEND_API_URL}/articles?mois=fevrier2026
  BACKEND_API_URL: 'http://localhost:5000/api',
};
