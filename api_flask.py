"""
Nom........ : api_flask.py
Description : Renvoie les données de la base de données par le biais d'une API Flask
"""
import sqlite3
import json
import re
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

application = Flask(__name__)
CORS(application)  # autorise les appels depuis un frontend sur un autre domaine

MOIS_FR = {
    "janvier": "01", "fevrier": "02", "mars": "03", "avril": "04",
    "mai": "05", "juin": "06", "juillet": "07", "aout": "08",
    "septembre": "09", "octobre": "10", "novembre": "11", "decembre": "12",
}
MOIS_FR_INV = {v: k for k, v in MOIS_FR.items()}


def connecter_bdd():
    connexion = sqlite3.connect("bdd.db")
    connexion.row_factory = sqlite3.Row
    return connexion


def mois_vers_annee_mois(mois: str):
    """'fevrier2025' -> '2025-02'  (None si non reconnu)"""
    m = re.match(r"^([a-z]+)(\d{4})$", mois.strip().lower())
    if not m:
        return None
    nom, annee = m.groups()
    num = MOIS_FR.get(nom)
    if not num:
        return None
    return f"{annee}-{num}"


def date_vers_mois(date_str: str) -> str:
    """'2025-02-28' -> 'fevrier2025'"""
    if not date_str or len(date_str) < 7:
        return ""
    annee, num = date_str[:4], date_str[5:7]
    nom = MOIS_FR_INV.get(num, num)
    return f"{nom}{annee}"


def recuperer_auteurs(curseur, id_article):
    curseur.execute("SELECT nom, pays FROM auteurs WHERE id_article = ?", (id_article,))
    groupes = {}
    for ligne in curseur.fetchall():
        groupes.setdefault(ligne["nom"], []).append(ligne["pays"])
    return [{"nom": nom, "pays": pays} for nom, pays in groupes.items()]


# ── Anciennes routes (conservées) ──────────────────────────────────────────
@application.route("/articles/<int:limite>")
def liste_articles(limite):
    connexion = connecter_bdd()
    curseur = connexion.cursor()
    curseur.execute("""
        SELECT id, titre, date, langue, citations
        FROM articles
        ORDER BY date DESC
        LIMIT ?
    """, (limite,))
    lignes = curseur.fetchall()
    connexion.close()
    articles = [
        {
            "id": ligne["id"],
            "titre": ligne["titre"],
            "date": ligne["date"],
            "langue": ligne["langue"],
            "citations": ligne["citations"]
        }
        for ligne in lignes
    ]
    return jsonify(articles)


@application.route("/auteurs/<id_article>")
def liste_auteurs(id_article):
    connexion = connecter_bdd()
    curseur = connexion.cursor()
    curseur.execute("""
        SELECT nom, pays
        FROM auteurs
        WHERE id_article = ?
    """, (id_article,))
    lignes = curseur.fetchall()
    connexion.close()
    auteurs = [{"nom": ligne["nom"], "pays": ligne["pays"]} for ligne in lignes]
    return jsonify(auteurs)


# ── Nouvelle route : /articles?mois=fevrier2025 ─────────────────────────────
# Utilisée par fetchMonthArticles() dans app.js (mode DATA_SOURCE = 'backend')
# Renvoie le même format brut que les fichiers arxiv_<mois>.json
@application.route("/articles")
def articles_par_mois():
    mois = request.args.get("mois", "")
    annee_mois = mois_vers_annee_mois(mois)
    if not annee_mois:
        return jsonify({"erreur": f"Paramètre 'mois' invalide : '{mois}'"}), 400

    connexion = connecter_bdd()
    curseur = connexion.cursor()
    curseur2 = connexion.cursor()
    curseur.execute("""
        SELECT id, titre, date, langue, citations, index_inverse_compte
        FROM articles
        WHERE substr(date, 1, 7) = ?
    """, (annee_mois,))
    lignes = curseur.fetchall()

    resultat = []
    for ligne in lignes:
        resultat.append({
            "titre": ligne["titre"],
            "id de l'article": ligne["id"],
            "date": ligne["date"],
            "auteurs": recuperer_auteurs(curseur2, ligne["id"]),
            "language": ligne["langue"],
            "Nombre de citations": ligne["citations"],
            "index_inverse_compte": json.loads(ligne["index_inverse_compte"] or "{}"),
        })
    connexion.close()
    return jsonify(resultat)


# ── Nouvelle route : /api/search?q=...&pays=...&limit=... ──────────────────
# Utilisée par fetchArticlesFromAPI() dans app.js (recherche live, API_MODE = true)
# Renvoie { articles: [...] } déjà au format normalisé attendu par l'affichage
@application.route("/api/search")
def recherche_articles():
    mot_cle = request.args.get("q", "").strip().lower()
    pays_filtre = request.args.get("pays", "").strip().upper()
    limite = request.args.get("limit", 50, type=int)

    connexion = connecter_bdd()
    curseur = connexion.cursor()
    curseur2 = connexion.cursor()

    if pays_filtre:
        curseur.execute("""
            SELECT DISTINCT a.id, a.titre, a.date, a.langue, a.citations, a.index_inverse_compte
            FROM articles a
            JOIN auteurs au ON au.id_article = a.id
            WHERE au.pays = ?
            ORDER BY a.citations DESC
        """, (pays_filtre,))
    else:
        curseur.execute("""
            SELECT id, titre, date, langue, citations, index_inverse_compte
            FROM articles
            ORDER BY citations DESC
        """)

    articles = []
    for ligne in curseur.fetchall():
        kw = json.loads(ligne["index_inverse_compte"] or "{}")
        titre_lower = (ligne["titre"] or "").lower()

        if mot_cle:
            match_titre = mot_cle in titre_lower
            match_mot = any(mot_cle in w.lower() for w in kw.keys())
            if not (match_titre or match_mot):
                continue

        auteurs = recuperer_auteurs(curseur2, ligne["id"])
        pays_liste = sorted({p for au in auteurs for p in au["pays"]})
        mots_tries = sorted(kw.items(), key=lambda x: x[1], reverse=True)[:10]

        articles.append({
            "titre": ligne["titre"],
            "id": ligne["id"],
            "date": ligne["date"],
            "mois": date_vers_mois(ligne["date"]),
            "auteurs": auteurs,
            "langue": ligne["langue"],
            "citations": ligne["citations"],
            "mots_cles": [w for w, _ in mots_tries],
            "pays": pays_liste,
        })

        if len(articles) >= limite:
            break

    connexion.close()
    return jsonify({"articles": articles})


# ── Sert le frontend statique ───────────────────────────────────────────────
@application.route("/")
def index():
    return send_from_directory(".", "index.html")


@application.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(".", filename)


if __name__ == "__main__":
    application.run(debug=True)
