"""
Nom........ : api_flask.py
Description : Renvoie les données de la base de données par le biais d'une API Flask
"""
import sqlite3
from flask import Flask, jsonify, send_from_directory

application = Flask(__name__)

def connecter_bdd():
    connexion = sqlite3.connect("bdd.db")
    connexion.row_factory = sqlite3.Row
    return connexion

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
    auteurs = [
        {
            "nom": ligne["nom"],
            "pays": ligne["pays"]
        }
        for ligne in lignes
    ]
    return jsonify(auteurs)

# ── Sert le frontend statique (index.html, app.js, config.js, style.css, data.js, arxiv_*.json) ──
@application.route("/")
def index():
    return send_from_directory(".", "index.html")

@application.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(".", filename)

if __name__ == "__main__":
    application.run(debug=True)
