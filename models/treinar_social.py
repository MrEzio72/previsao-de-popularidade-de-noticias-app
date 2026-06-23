import pandas as pd
import numpy as np
import joblib
import os
import requests
from io import BytesIO
from sklearn.ensemble import RandomForestClassifier

# Importa a ligação
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from db_connection import get_connection

# Visão Artificial (Importação Opcional / Lazy)
torch_disponivel = False
try:
    import torch
    from torchvision.models import resnet18, ResNet18_Weights
    from PIL import Image
    torch_disponivel = True
except ImportError:
    pass

def atualizar_modelo():
    print("Acedendo ao Azure SQL para fundir Dados Reais + Feedback Humano...")
    conn = get_connection()
    if not conn: 
        print("Falha crítica: Não foi possível ligar à BD.")
        sys.exit(1)

    # 1. CARREGAR DADOS
    # Adicionamos N_Rostos e Brilho_Imagem na query, e Seguidores como placeholder 0
    query_real = """
    SELECT Texto_Post, Link_Imagem, Likes, Comentarios, 0 as Seguidores,
           N_Rostos, Brilho_Imagem, Popularidade_Real as Popularidade 
    FROM dbo.Dataset_Social_Real 
    WHERE Avaliado = 1
    """
    
    # No feedback manual, usamos os valores reais de Likes, Comentarios e Seguidores
    query_feedback = """
    SELECT Texto_Post, '' as Link_Imagem, Likes, Comentarios, Seguidores, 
           0 as N_Rostos, 127 as Brilho_Imagem, Popularidade_Real as Popularidade 
    FROM dbo.Feedback_Social
    """
    
    try:
        df_real = pd.read_sql(query_real, conn)
        df_feed = pd.read_sql(query_feedback, conn)
        
        if not df_feed.empty:
            df_feed = pd.concat([df_feed] * 10, ignore_index=True)
            
        df = pd.concat([df_real, df_feed], ignore_index=True).dropna(subset=['Popularidade'])
        
    except Exception as e:
        print(f"Erro ao ler SQL: {e}")
        return
    finally:
        conn.close()

    if df.empty:
        print("Sem dados (Avaliado=1) para treinar. O robô ainda está a processar os posts?")
        return

    # 2. CONFIGURAR VISÃO (RESNET18) - Extração de "estilo" da imagem
    ia_visual_ativa = False
    if torch_disponivel:
        try:
            weights = ResNet18_Weights.DEFAULT
            modelo_visao = resnet18(weights=weights)
            extrator = torch.nn.Sequential(*list(modelo_visao.children())[:-1])
            extrator.eval()
            preprocess = weights.transforms()
            ia_visual_ativa = True
        except Exception as e:
            print(f"Erro ao inicializar ResNet18, a usar Modo Lite: {e}")

    def extrair_features(url):
        if not ia_visual_ativa or not url or str(url) == 'nan' or "http" not in str(url): 
            return np.zeros(512)
        try:
            res = requests.get(url, timeout=5)
            img = Image.open(BytesIO(res.content)).convert('RGB')
            tensor = preprocess(img).unsqueeze(0)
            with torch.no_grad():
                return extrator(tensor).squeeze().numpy()
        except:
            return np.zeros(512)

    if ia_visual_ativa:
        print(f"A processar {len(df)} imagens com ResNet18 (Deep Learning)...")
    else:
        print(f"Modo Lite: Preenchendo {len(df)} imagens com zeros (Sem ResNet)...")
        
    features_list = df['Link_Imagem'].apply(extrair_features)
    df_img = pd.DataFrame(features_list.to_list(), index=df.index)

    # 3. TREINO - A "Fórmula" da Popularidade
    # Combinamos: Métricas Sociais + Visão Computacional (OpenCV) + Deep Learning (ResNet)
    colunas_reais = ['Likes', 'Comentarios', 'Seguidores', 'N_Rostos', 'Brilho_Imagem']
    
    # X = (5 colunas numéricas) + (512 colunas da ResNet)
    X = pd.concat([df[colunas_reais], df_img], axis=1).fillna(0)
    y = df['Popularidade'] # Usamos a coluna unificada 'Popularidade'

    print("A treinar o Random Forest...")
    modelo = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
    modelo.fit(X.values, y)

    # 4. ATUALIZAR O FICHEIRO .PKL
    caminho_pkl = os.path.join(os.path.dirname(__file__), 'modelo_social.pkl')
    joblib.dump(modelo, caminho_pkl)
    print(f"SUCESSO! Modelo atualizado com {len(df)} exemplos.")

if __name__ == "__main__":
    atualizar_modelo()