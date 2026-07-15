"""
Nom........ : creer_bdd.py
Description : Créé une base de données avec une table relative aux articles et une table relative aux auteurs
Usage...... : python3 creer_bdd.py
"""

import sqlite3
import json

def creer_bdd() -> None:
    curseur.execute("""
    CREATE TABLE IF NOT EXISTS articles (
        id TEXT PRIMARY KEY,
        titre TEXT,
        date TEXT,
        langue TEXT,
        citations INTEGER,
        index_inverse_compte TEXT
    )
    """)

    curseur.execute("""
    CREATE TABLE IF NOT EXISTS auteurs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_article TEXT,
        nom TEXT,
        pays TEXT,
        FOREIGN KEY(id_article) REFERENCES articles(id)
    )
    """)

if __name__ == "__main__":
    connexion = sqlite3.connect("bdd.db")
    curseur = connexion.cursor()
    
    creer_bdd()
    
    connexion.commit()
    connexion.close()
    
    print("Base de données créée.")

