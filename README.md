# Veille Scientifique — Front-end

## Structure des fichiers

```
├── index.html          → structure HTML uniquement
├── favicon.svg          → icône du site
├── css/
│   └── style.css        → tous les styles (variables, header, hero, cartes, footer, responsive…)
├── js/
│   ├── config.js         → 🔌 point de bascule JSON ↔ BDD (à modifier plus tard)
│   ├── data.js            → données de démonstration (fallback) et constantes (pays, mois, stopwords)
│   └── app.js               → toute la logique applicative (recherche, filtres, stats, rendu…)
└── arxiv_<mois>.json    → (à ajouter par vous) fichiers de données mensuels, en mode JSON local
```

## Passer du mode JSON local à la base de données

Un seul fichier à modifier : **`js/config.js`**

```js
const APP_CONFIG = {
  DATA_SOURCE: 'json',        // → passer à 'backend' quand la BDD est prête
  BACKEND_API_URL: 'http://localhost:5000/api',  // → mettre l'URL réelle de l'API Flask
};
```

Le reste du code (`js/app.js`, fonction `fetchMonthData`) s'adapte automatiquement :
- en mode `'json'`, il va chercher `arxiv_<mois>.json` dans le dossier du site ;
- en mode `'backend'`, il appelle `GET {BACKEND_API_URL}/articles?mois=<mois>`.

Le back-end doit renvoyer un tableau JSON avec la même structure que les
fichiers `arxiv_<mois>.json` actuels (voir commentaire au-dessus de
`normalizeLocal()` dans `js/app.js`) : `titre`, `id de l'article`, `date`,
`auteurs`, `language`, `Nombre de citations`, `index_inverse_compte`.

Si l'un ou l'autre échoue (fichier absent, API indisponible), le site
retombe automatiquement sur les données de démonstration (`DEMO_DATA`
dans `js/data.js`), avec un message d'avertissement affiché à l'utilisateur.

## Lancer le site en local

```bash
python3 -m http.server
```

puis ouvrir `http://localhost:8000`.
