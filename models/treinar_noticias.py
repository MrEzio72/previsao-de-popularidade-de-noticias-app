"""
Pipeline de Treino: Modelo de Website e Notícias
------------------------------------------------
Este script treina o classificador de artigos (SEO/Jornalismo).
Aplica a fusão do Histórico Recolhido com o Feedback Humano para corrigir o viés da máquina.
"""
# ============================================================
# TREINO DO MODELO - SQL SERVER EDITION (Com Proxy Editorial)
# ============================================================
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
import joblib
import os
import warnings
import sys

# Garante que o Python encontra o ficheiro db_connection.py na pasta raiz
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import db_connection 

warnings.filterwarnings("ignore")

print("🔌 A ligar à Base de Dados SQL Server para treino de Website...")

# 1. CARREGAR DADOS DO SQL (Histórico + Feedback juntos)
try:
    df_noticias, df_feedback = db_connection.carregar_dados_treino()  
    
    if df_noticias is None:
        print("🚨 Falha crítica: Não foi possível obter dados da BD.")
        sys.exit(1) # Faz o GitHub Actions ficar VERMELHO

    df_noticias.columns = df_noticias.columns.str.lower()
    
    if not df_feedback.empty:
        df_feedback.columns = df_feedback.columns.str.lower()
        
    print(f"✅ Dados carregados: {len(df_noticias)} notícias históricas | {len(df_feedback)} feedbacks humanos.")

except Exception as e:
    print(f"❌ Erro ao ligar à BD: {e}")
    sys.exit(1)

# ==========================================
# 2. PREPARAR DATASET
# ==========================================

# Preparar o Histórico de Notícias
if not df_noticias.empty:
    if 'popularidade_real' in df_noticias.columns:
        df_noticias = df_noticias.rename(columns={"popularidade_real": "popularidade"})
        df_noticias = df_noticias.dropna(subset=["popularidade"])
        df_noticias["popularidade"] = df_noticias["popularidade"].str.lower()
    else:
        print("⚠️ Aviso: A coluna 'popularidade_real' não existe nas notícias.")

# Preparar Feedback Humano (O REFORÇO DE APRENDIZAGEM 🌟)
if not df_feedback.empty:
    if 'popularidade_real' in df_feedback.columns:
        df_feedback = df_feedback.rename(columns={"popularidade_real": "popularidade"})
    elif 'realidade' in df_feedback.columns: 
        df_feedback = df_feedback.rename(columns={"realidade": "popularidade"})
    
    if 'categoria' not in df_feedback.columns:
        df_feedback['categoria'] = 'geral'

    # Reforço de aprendizagem: Multiplicamos o feedback humano por 5
    # Isto garante que a IA "ouve" mais o que tu corrigiste no site do que os dados automáticos
    df_feedback = pd.concat([df_feedback]*5, ignore_index=True)

# Juntar os dois mundos (Histórico + Feedback)
cols_treino = ["n_palavras_titulo", "n_palavras_desc", "sentimento", "dia_semana", "hora", "categoria", "popularidade"]

df_treino = pd.concat([
    df_noticias[cols_treino] if not df_noticias.empty else pd.DataFrame(columns=cols_treino),
    df_feedback[cols_treino] if not df_feedback.empty else pd.DataFrame(columns=cols_treino)
], ignore_index=True).dropna()

print(f"📊 Dataset Final de Treino: {len(df_treino)} registos válidos.")

if len(df_treino) == 0:
    print("🚨 Não há dados suficientes para treinar!")
    sys.exit(1)

# ==========================================
# 3. TREINO DA INTELIGÊNCIA ARTIFICIAL
# ==========================================
features_numericas = ["n_palavras_titulo", "n_palavras_desc", "sentimento", "dia_semana", "hora"]
features_categoricas = ["categoria"]

X = df_treino[features_numericas + features_categoricas]
y = df_treino["popularidade"]

preprocessor = ColumnTransformer(
    transformers=[
        ("num", StandardScaler(), features_numericas),
        ("cat", OneHotEncoder(handle_unknown="ignore"), features_categoricas)
    ]
)

pipeline = Pipeline(steps=[
    ("preprocess", preprocessor),
    ("clf", RandomForestClassifier(n_estimators=300, max_depth=12, random_state=42))
])

print("🧠 A treinar o Random Forest (Website)...")
pipeline.fit(X, y)

# ==========================================
# 4. GUARDAR O CÉREBRO
# ==========================================
os.makedirs(os.path.join(os.path.dirname(__file__)), exist_ok=True)
caminho_modelo = os.path.join(os.path.dirname(__file__), "modelo_noticias.pkl")
joblib.dump(pipeline, caminho_modelo)

print(f"✅ SUCESSO! Modelo de Notícias guardado em {caminho_modelo}")