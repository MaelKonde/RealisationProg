"""
Nom........ : app.py
Description : API Flask exposant les données de bdd.db (arXiv/OpenAlex)
              pour le front-end Tendances Scientifiques.

              Contient :
              - les routes d'origine (liste_articles, liste_auteurs)
              - les routes attendues par le front-end : /articles?mois=...
                et /api/search?q=...
              - le téléchargement automatique de bdd.db depuis Google
                Drive au démarrage (le fichier est trop lourd pour Git,
                donc il n'est jamais commité : il est récupéré à chaud).

Usage...... : gunicorn app:application   (en production, sur Render)
              python3 app.py             (en local, pour tester)
"""

import json
import os
import re
import sqlite3
from collections import defaultdict

import gdown
from flask import Flask, jsonify, request
from flask_cors import CORS

DB_PATH = "bdd.db"

# ID extrait de : https://drive.google.com/file/d/120wyznKkDMfXWVANr_f8he4t2AMGhhVX/view
DRIVE_FILE_ID = "120wyznKkDMfXWVANr_f8he4t2AMGhhVX"


def ensure_db():
    """Télécharge bdd.db depuis Google Drive s'il n'est pas déjà présent
    (ex: premier démarrage du conteneur Render, disque éphémère)."""
    if os.path.exists(DB_PATH) and os.path.getsize(DB_PATH) > 0:
        return
    print(f"⬇ Téléchargement de {DB_PATH} depuis Google Drive…")
    gdown.download(id=DRIVE_FILE_ID, output=DB_PATH, quiet=False)
    if not os.path.exists(DB_PATH):
        raise RuntimeError("Échec du téléchargement de bdd.db depuis Google Drive")
    print(f"✓ {DB_PATH} téléchargé ({os.path.getsize(DB_PATH)} octets)")


ensure_db()

application = Flask(__name__)
app = application  # alias, pratique si un outil cherche `app.app`
CORS(application)  # autorise le front-end (autre domaine) à appeler cette API

# ── Correspondance mois FR -> numéro, pour /articles?mois=... ─────────
MOIS_NUM = {
    "janvier": "01", "fevrier": "02", "mars": "03", "avril": "04",
    "mai": "05", "juin": "06", "juillet": "07", "aout": "08",
    "septembre": "09", "octobre": "10", "novembre": "11", "decembre": "12",
}

STOPWORDS_MIN = {
    "this", "that", "with", "from", "have", "which", "these", "those",
    "were", "been", "such", "also", "their", "into", "using", "used",
    "based", "than", "then", "when", "where", "while", "under", "over",
}


def connecter_bdd():
    connexion = sqlite3.connect(DB_PATH)
    connexion.row_factory = sqlite3.Row
    return connexion


def mois_to_prefix(mois: str):
    """'fevrier2025' -> '2025-02' (None si format invalide)."""
    m = re.match(r"^([a-zéû]+)(\d{4})$", mois.strip().lower())
    if not m:
        return None
    nom, annee = m.group(1), m.group(2)
    num = MOIS_NUM.get(nom)
    if not num:
        return None
    return f"{annee}-{num}"


def build_auteurs(conn, id_article):
    rows = conn.execute(
        "SELECT nom, pays FROM auteurs WHERE id_article = ?", (id_article,)
    ).fetchall()
    par_nom = defaultdict(list)
    for r in rows:
        if r["pays"] and r["pays"] not in par_nom[r["nom"]]:
            par_nom[r["nom"]].append(r["pays"])
    return [{"nom": nom, "pays": pays} for nom, pays in par_nom.items()]


def row_to_article(conn, row):
    """Reconstruit un article au format attendu par app.js."""
    index_inverse = {}
    try:
        index_inverse = json.loads(row["index_inverse_compte"] or "{}")
    except (TypeError, json.JSONDecodeError):
        pass

    auteurs = build_auteurs(conn, row["id"])
    pays = sorted({p for a in auteurs for p in a["pays"]})

    mots_cles = [
        w for w, _ in sorted(
            (
                (w, c) for w, c in index_inverse.items()
                if len(w) > 3 and w.lower() not in STOPWORDS_MIN
            ),
            key=lambda x: x[1],
            reverse=True,
        )[:10]
    ]

    return {
        "titre": row["titre"],
        "id de l'article": row["id"],
        "id": row["id"],
        "date": row["date"],
        "auteurs": auteurs,
        "language": row["langue"],
        "langue": row["langue"],
        "Nombre de citations": row["citations"],
        "citations": row["citations"],
        "index_inverse_compte": index_inverse,
        "mots_cles": mots_cles,
        "pays": pays,
    }


# ══════════════════════════════════════════════════════════════════════
# Routes d'origine
# ══════════════════════════════════════════════════════════════════════

@application.route("/articles/<int:limite>")
def liste_articles(limite):
    connexion = connecter_bdd()
    curseur = connexion.cursor()
    curseur.execute(
        """
        SELECT id, titre, date, langue, citations
        FROM articles
        ORDER BY date DESC
        LIMIT ?
        """,
        (limite,),
    )
    lignes = curseur.fetchall()
    connexion.close()

    articles = [
        {
            "id": ligne["id"],
            "titre": ligne["titre"],
            "date": ligne["date"],
            "langue": ligne["langue"],
            "citations": ligne["citations"],
        }
        for ligne in lignes
    ]
    return jsonify(articles)


@application.route("/auteurs/<path:id_article>")
def liste_auteurs(id_article):
    connexion = connecter_bdd()
    curseur = connexion.cursor()
    curseur.execute(
        "SELECT nom, pays FROM auteurs WHERE id_article = ?", (id_article,)
    )
    lignes = curseur.fetchall()
    connexion.close()

    auteurs = [{"nom": ligne["nom"], "pays": ligne["pays"]} for ligne in lignes]
    return jsonify(auteurs)


# ══════════════════════════════════════════════════════════════════════
# Routes attendues par le front-end (app.js / config.js)
# ══════════════════════════════════════════════════════════════════════

@application.get("/health")
def health():
    return jsonify({"status": "ok"})


# ── TEMPORAIRE : à retirer une fois le bug 500 résolu ──────────────────
@application.errorhandler(Exception)
def handle_exception(e):
    import traceback
    return jsonify({
        "error": str(e),
        "type": type(e).__name__,
        "traceback": traceback.format_exc(),
    }), 500


@application.get("/debug/schema")
def debug_schema():
    """Diagnostic : montre le schéma réel de bdd.db (colonnes, nb de lignes)."""
    connexion = connecter_bdd()
    info = {}
    for table in ("articles", "auteurs"):
        cols = connexion.execute(f"PRAGMA table_info({table})").fetchall()
        count = connexion.execute(f"SELECT COUNT(*) AS n FROM {table}").fetchone()["n"]
        info[table] = {
            "columns": [dict(c) for c in cols],
            "row_count": count,
        }
    sample = connexion.execute("SELECT * FROM articles LIMIT 1").fetchone()
    info["sample_article"] = dict(sample) if sample else None
    connexion.close()
    return jsonify(info)


@application.get("/articles")
def articles_by_month():
    """GET /articles?mois=fevrier2025 -> utilisée par buildTD() côté front."""
    mois = request.args.get("mois", "")
    prefix = mois_to_prefix(mois)
    if not prefix:
        return jsonify({"error": f"mois invalide: {mois}"}), 400

    connexion = connecter_bdd()
    rows = connexion.execute(
        "SELECT * FROM articles WHERE date LIKE ?", (f"{prefix}%",)
    ).fetchall()
    result = [row_to_article(connexion, r) for r in rows]
    connexion.close()
    return jsonify(result)


@application.get("/api/search")
def search():
    """GET /api/search?q=quantum&pays=FR&limit=50 -> utilisée par renderTopArticles()."""
    q = request.args.get("q", "").strip().lower()
    pays_filtre = request.args.get("pays", "").strip().upper()
    try:
        limit = min(int(request.args.get("limit", 50)), 200)
    except ValueError:
        limit = 50

    connexion = connecter_bdd()
    if pays_filtre:
        rows = connexion.execute(
            """SELECT DISTINCT ar.* FROM articles ar
               JOIN auteurs au ON au.id_article = ar.id
               WHERE au.pays = ?""",
            (pays_filtre,),
        ).fetchall()
    else:
        rows = connexion.execute("SELECT * FROM articles").fetchall()

    articles = []
    for r in rows:
        a = row_to_article(connexion, r)
        if q:
            hay = (a["titre"] or "").lower() + " " + " ".join(a["mots_cles"]).lower()
            if q not in hay:
                continue
        articles.append(a)

    connexion.close()
    articles.sort(key=lambda a: a["citations"] or 0, reverse=True)
    return jsonify({"articles": articles[:limit]})


if __name__ == "__main__":
    application.run(debug=True)
