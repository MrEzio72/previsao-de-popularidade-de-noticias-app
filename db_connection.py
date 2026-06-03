"""
Módulo de Integração com Azure SQL Database
------------------------------------------
Gere a persistência de dados do AI Popularity Predictor.
Implementa padrões de ligação segura utilizando variáveis de ambiente
e lida com a sincronização de dados de RSS, Scrapers e Input do Utilizador.
"""
import pymssql
import pandas as pd
from datetime import datetime
import os
import requests
import cv2
import numpy as np
from dotenv import load_dotenv

# Carrega as variáveis de ambiente do ficheiro .env
load_dotenv()

# ==========================================
# CONFIGURAÇÕES DO AZURE SQL
# ==========================================
SERVER = os.getenv('DB_SERVER')
DATABASE = os.getenv('DB_NAME')
USERNAME = os.getenv('DB_USER')
PASSWORD = os.getenv('DB_PASS')

import time

def get_connection():
    """Estabelece a ligação com o SQL Server no Azure com lógica de Retry."""
    tentativas = 3
    for i in range(tentativas):
        try:
            conn = pymssql.connect(
                server=SERVER, 
                user=USERNAME, 
                password=PASSWORD, 
                database=DATABASE,
                timeout=30 
            )
            return conn
        except Exception as e:
            if i < tentativas - 1:
                print(f"Azure em pausa? A tentar novamente em 30s... ({i+1}/{tentativas})")
                time.sleep(30) # Espera 30 segundos para a Azure acordar
            else:
                print(f"Erro final de ligação ao Azure SQL: {e}")
                return None

# ==========================================
# AUXILIAR: VISÃO ARTIFICIAL (ROSTOS E BRILHO)
# ==========================================
def analisar_imagem_v2(url):
    """Saca a imagem da internet e analisa rostos e brilho em memória."""
    if not url or "http" not in url:
        return 0, 127 # Valores default se não houver imagem
    try:
        res = requests.get(url, timeout=5)
        if res.status_code != 200: return 0, 127
        
        img_array = np.asarray(bytearray(res.content), dtype="uint8")
        img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        if img is None: return 0, 127

        # 1. Calcular Brilho
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        brilho = int(hsv[:,:,2].mean())

        # 2. Contar Rostos (Filtros rigorosos para evitar falsos positivos)
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        faces = face_cascade.detectMultiScale(
            gray, 
            scaleFactor=1.2,      # Reduz falsos positivos em texturas
            minNeighbors=8,       # Exige alta certeza na deteção
            minSize=(40, 40)      # Ignora ruído pequeno no fundo
        )
        
        return len(faces), brilho
    except:
        return 0, 127

def atualizar_dados_visuais(post_id, n_rostos, brilho):
    """Atualiza apenas os dados de rostos e brilho de um post específico."""
    conn = get_connection()
    if not conn: return
    cursor = conn.cursor()
    try:
        cursor.execute("""
            UPDATE dbo.Dataset_Social_Real 
            SET N_Rostos = %d, Brilho_Imagem = %d 
            WHERE Post_ID_Social = %s
        """, (n_rostos, brilho, str(post_id)))
        conn.commit()
    except Exception as e:
        print(f"❌ Erro ao atualizar dados visuais do post {post_id}: {e}")
    finally:
        conn.close()

# ==========================================
# 1. GESTÃO DE NOTÍCIAS (WEBSITE / RSS)
# ==========================================
def salvar_noticias_batch(df):
    conn = get_connection()
    if not conn: return
    cursor = conn.cursor()
    try:
        for index, row in df.iterrows():
            cursor.execute("SELECT COUNT(*) FROM dbo.Noticias WHERE Link = %s", (row['link'],))
            if cursor.fetchone()[0] == 0:
                cursor.execute("""
                    INSERT INTO dbo.Noticias 
                    (Titulo, Descricao, Link, DataPublicacao, Fonte, Categoria, 
                     N_Palavras_Titulo, N_Palavras_Desc, Dia_Semana, Hora, Sentimento, Popularidade_Real)
                    VALUES (%s, %s, %s, %s, %s, %s, %d, %d, %d, %d, %d, %s)
                """, (
                    row['titulo'], row['descricao'], row['link'], row['data_publicacao'],
                    row['fonte'], row['categoria'], row['n_palavras_titulo'], 
                    row['n_palavras_desc'], row['dia_semana'], row['hora'], 
                    row['sentimento'], row['popularidade_real']
                ))
        conn.commit()
        print("Notícias RSS sincronizadas.")
    except Exception as e:
        print(f"Erro ao guardar notícias: {e}")
    finally:
        conn.close()

# ==========================================
# 2. GESTÃO DE FEEDBACK (USER INPUT)
# ==========================================
def salvar_feedback(dados, realidade):
    conn = get_connection()
    if not conn: return
    cursor = conn.cursor()
    try:
        titulo = dados.get('titulo', '')
        desc = dados.get('descricao', '')
        cursor.execute("""
            INSERT INTO Feedback (Titulo_Input, Descricao_Input, Categoria_Input, N_Palavras_Titulo, 
            N_Palavras_Desc, Sentimento, Dia_Semana, Hora, Popularidade_Real)
            VALUES (%s, %s, %s, %d, %d, %d, %d, %d, %s)
        """, (
            titulo, desc, dados.get('categoria', 'geral'),
            len(titulo.split()), len(desc.split()), 
            dados.get('sentimento', 0), datetime.now().weekday(), 
            datetime.now().hour, realidade
        ))
        conn.commit()
    finally:
        conn.close()

def salvar_feedback_social(dados, realidade):
    conn = get_connection()
    if not conn: return
    cursor = conn.cursor()
    try:
        texto = dados.get('Texto_Post', '')
        agora = datetime.now()
        cursor.execute("""
            INSERT INTO dbo.Feedback_Social 
            (Texto_Post, Seguidores, Tipo_Post, Categoria, Mes, Dia_Semana, Hora, 
             Pago, N_Hashtags, N_Palavras, Popularidade_Real, Plataforma)
            VALUES (%s, %d, %s, %d, %d, %d, %d, %d, %d, %d, %s, %s)
        """, (
            texto, 
            int(dados.get('Seguidores', 0)), 
            dados.get('Type', 'Link'),
            int(dados.get('Category', 1)), 
            agora.month, 
            agora.weekday(),
            agora.hour, 
            0, 
            texto.count('#'), 
            len(texto.split()), 
            realidade, 
            dados.get('Plataforma', 'instagram')
        ))
        conn.commit()
    except Exception as e:
        print(f"Erro Feedback Social: {e}")
    finally:
        conn.close()

# ==========================================
# 3. GESTÃO DE DADOS REAIS (APIFY / CHECKPOINTS)
# ==========================================
def get_posts_para_checkpoint():
    conn = get_connection()
    if not conn: return pd.DataFrame()
    
    query = """
    SELECT ID, Link_Post, Plataforma 
    FROM dbo.Dataset_Social_Real 
    WHERE Avaliado = 0 
    AND (
        DATEDIFF(hour, Data_Publicacao, GETDATE()) BETWEEN 11 AND 15 OR
        DATEDIFF(hour, Data_Publicacao, GETDATE()) BETWEEN 23 AND 28 OR
        DATEDIFF(hour, Data_Publicacao, GETDATE()) >= 47
    )
    """
    try:
        return pd.read_sql(query, conn)
    finally:
        conn.close()

def upsert_social_real(p, fonte, plataforma, popularidade, avaliado):
    conn = get_connection()
    if not conn: return
    cursor = conn.cursor()
    
    post_id = str(p.get('id', p.get('shortCode', '')))
    img_url = p.get('image_url') or p.get('displayUrl') or p.get('mediaUrl') or p.get('image') or ''
    
    # ---  ANÁLISE DE IMAGEM PARA ROSTOS E BRILHO ---
    n_rostos, brilho = analisar_imagem_v2(img_url)
    
    likes = int(p.get('likesCount', p.get('likes', p.get('reactionsCount', 0)) or 0))
    comments = int(p.get('commentsCount', p.get('comments', 0) or 0))
    text = str(p.get('caption', p.get('text', '')))[:1000]
    link = str(p.get('url', p.get('facebookUrl', '')))
    
    ts = p.get('timestamp') or p.get('date') or p.get('createdAt')
    if not ts: 
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    else:
        try:
            if 'T' in str(ts):
                timestamp = datetime.fromisoformat(str(ts).replace('Z', '+00:00')).strftime('%Y-%m-%d %H:%M:%S')
            else:
                timestamp = str(ts)
        except: 
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    try:
        cursor.execute("SELECT ID, Data_Publicacao, Likes_12h, Likes_24h, Likes_48h FROM dbo.Dataset_Social_Real WHERE Post_ID_Social = %s", (post_id,))
        row = cursor.fetchone()
        
        if row:
            try:
                dt_pub = row[1].replace(tzinfo=None) if isinstance(row[1], datetime) else datetime.fromisoformat(str(row[1]).replace('Z', '+00:00')).replace(tzinfo=None)
                horas_passadas = (datetime.now() - dt_pub).total_seconds() / 3600
            except:
                horas_passadas = 0

            # UPDATE INCLUINDO ROSTOS E BRILHO
            update_parts = ["Likes = %d", "Comentarios = %d", "Popularidade_Real = %s", "Link_Imagem = %s", "N_Rostos = %d", "Brilho_Imagem = %d"]
            params = [likes, comments, popularidade, img_url, n_rostos, brilho]

            if horas_passadas >= 11 and row[2] is None:
                update_parts.append("Likes_12h = %d"); params.append(likes)
            if horas_passadas >= 23 and row[3] is None:
                update_parts.append("Likes_24h = %d"); params.append(likes)
            if horas_passadas >= 47:
                if row[4] is None:
                    update_parts.append("Likes_48h = %d"); params.append(likes)
                update_parts.append("Avaliado = 1")

            sql = f"UPDATE dbo.Dataset_Social_Real SET {', '.join(update_parts)} WHERE Post_ID_Social = %s"
            params.append(post_id)
            cursor.execute(sql, tuple(params))
        else:
            # INSERT INCLUINDO ROSTOS E BRILHO
            cursor.execute("""
                INSERT INTO dbo.Dataset_Social_Real 
                (Post_ID_Social, Fonte, Plataforma, Texto_Post, Link_Post, Data_Publicacao, 
                 Likes, Comentarios, Partilhas, Popularidade_Real, Data_Recolha, Avaliado, Link_Imagem, N_Rostos, Brilho_Imagem)
                VALUES (%s, %s, %s, %s, %s, %s, %d, %d, %d, %s, %s, %d, %s, %d, %d)
            """, (post_id, fonte, plataforma, text, link, timestamp, likes, comments, 0, popularidade, datetime.now(), 0, img_url, n_rostos, brilho))
            
        conn.commit()
    except Exception as e:
        print(f"Erro SQL ao guardar {plataforma}: {e}")
    finally:
        conn.close()

# ==========================================
# 4. CARREGAMENTO PARA TREINO
# ==========================================
def carregar_dados_treino():
    conn = get_connection()
    if not conn: return pd.DataFrame(), pd.DataFrame()
    try:
        df_noticias = pd.read_sql("SELECT * FROM Noticias", conn)
        df_feedback = pd.read_sql("SELECT * FROM Feedback", conn)
        return df_noticias, df_feedback
    finally:
        conn.close()

def carregar_dados_sociais_reais():
    conn = get_connection()
    if not conn: return pd.DataFrame()
    try:
        return pd.read_sql("SELECT * FROM dbo.Dataset_Social_Real", conn)
    finally:
        conn.close()