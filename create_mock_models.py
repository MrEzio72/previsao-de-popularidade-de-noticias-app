import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
import joblib
import os

# 1. modelo_noticias
df_treino = pd.DataFrame({
    "n_palavras_titulo": [10, 20],
    "n_palavras_desc": [50, 100],
    "sentimento": [2, -1],
    "dia_semana": [1, 5],
    "hora": [10, 20],
    "categoria": ["geral", "desporto"],
    "popularidade": ["Alta", "Baixa"]
})
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
pipeline_noticias = Pipeline(steps=[
    ("preprocess", preprocessor),
    ("clf", RandomForestClassifier(n_estimators=10, random_state=42))
])
pipeline_noticias.fit(X, y)

# 2. modelo_social
X_social = np.random.rand(2, 517)
y_social = ["Alta", "Baixa"]
modelo_social = RandomForestClassifier(n_estimators=10, random_state=42)
modelo_social.fit(X_social, y_social)

os.makedirs("models", exist_ok=True)
joblib.dump(pipeline_noticias, os.path.join("models", "modelo_noticias.pkl"))
joblib.dump(modelo_social, os.path.join("models", "modelo_social.pkl"))
print("Mock models created!")
