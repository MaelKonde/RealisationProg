# Tendances Scientifiques — Front-end

## Structure des fichiers

```
├── index.html          → structure HTML uniquement
├── favicon.svg          → icône du site
├── style.css        → tous les styles (variables, header, hero, nuage, carte, footer, responsive…)
├── config.js         → 🔌 liste des mois disponibles + point de bascule JSON ↔ BDD
├── data.js            → constantes statiques (pays, coordonnées, stopwords) + données de secours
│── app.js               → toute la logique applicative (chargement des données, nuage, carte, articles…)
└── arxiv_<mois>.json    → (à déposer par vous) fichiers de données mensuels, à la racine
```

## Comment ça charge les données

Au chargement de la page, `app.js` va chercher, pour chaque mois listé dans
`config.js` (`APP_CONFIG.MONTHS_FILES`), le fichier `arxiv_<mois>.json`
correspondant à la racine du site, puis recalcule à la volée :

- **monthly_kw** : fréquence des mots-clés par mois (somme des occurrences
  filtrées par stopwords, à partir du champ `index_inverse_compte` de
  chaque article)
- **country_kw** : mêmes fréquences, agrégées par pays d'affiliation
- **monthly_vol** : nombre d'articles chargés par mois
- **articles_sample** : les 400 articles les plus cités, toutes périodes confondues
- **month_labels** : libellés affichés ("Fév 2025", "Mars 2025", …)

Si aucun fichier JSON n'est accessible (site ouvert sans serveur local,
fichiers pas encore déposés), le site retombe automatiquement sur un jeu de
données de démonstration (`TD_FALLBACK` dans `data.js`), avec un message
d'avertissement affiché à l'utilisateur.

⚠️ **Note** : ce calcul de fréquences est une approximation simple
(somme brute filtrée par stopwords), plus légère que la pondération
d'origine calculée côté serveur. Quand la BDD/API sera prête, on pourra
servir directement les statistiques pré-calculées côté serveur.

## Ajouter un nouveau mois

1. Déposez `arxiv_<mois>.json` à la racine du site (même format que les
   fichiers existants)
2. Ajoutez la clé `<mois>` dans `APP_CONFIG.MONTHS_FILES` (config.js),
   dans l'ordre chronologique

## Passer en mode base de données / API

Dans `config.js` :

```js
const APP_CONFIG = {
  ...
  DATA_SOURCE: 'backend',                          // au lieu de 'json'
  BACKEND_API_URL: 'https://votre-api.onrender.com/api',
};
```

Le back-end doit exposer `GET {BACKEND_API_URL}/articles?mois=<mois>` et
renvoyer un tableau JSON avec la même structure que les fichiers
`arxiv_<mois>.json` actuels.

Séparément, la recherche d'articles (`renderTopArticles`) dispose déjà de
son propre mécanisme de bascule vers une API Flask en direct
(`API_MODE` / `API_BASE`, tout en bas de `app.js`) — à activer quand
l'API de recherche sera prête.

## Lancer le site en local

```bash
python3 -m http.server
```

puis ouvrir `http://localhost:8000`.
