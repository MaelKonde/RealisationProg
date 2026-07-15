"""
Nom........ : alimenter_bdd.py
Description : Alimente la base de données par le biais de l'importation des fichiers JSON générés
Usage...... : python3 alimtenter_bdd.py
"""

import sqlite3
import json
import glob

def inserer_article(article: dict) -> None:
    curseur.execute("""
        INSERT OR IGNORE INTO articles (id, titre, date, langue, citations, index_inverse_compte)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        article["id de l'article"],
        article["titre"],
        article["date"],
        article["language"],
        article["Nombre de citations"],
        json.dumps(article["index_inverse_compte"])
    ))

    for auteur in article["auteurs"]:
        nom = auteur["nom"]
        liste_pays = auteur["pays"]
        for pays in liste_pays:
            curseur.execute("""
                INSERT INTO auteurs (id_article, nom, pays)
                VALUES (?, ?, ?)
            """, (
                article["id de l'article"],
                nom,
                pays
            ))

if __name__ == "__main__":
    connexion = sqlite3.connect("bdd.db")
    curseur = connexion.cursor()
    
    fichiers = glob.glob("arxiv_*.json")
    print(f"Fichiers trouvés : {fichiers}")
    for fichier in fichiers:
        print(f"Importation de : '{fichier}'")
        with open(fichier, "r", encoding="utf-8") as f:
            articles = json.load(f)
        for article in articles:
            inserer_article(article)
            
    print("Importation terminée.")
    connexion.commit()
    connexion.close()

