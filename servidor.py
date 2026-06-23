"""
API Principal (Servidor Flask) | AI Popularity Predictor
--------------------------------------------------------
Orquestra a interface web e processa as previsões de Machine Learning.
Suporta IA Multimodal (NLP para texto e ResNet18/OpenCV para imagens).
Implementa estratégias de 'Lazy Loading' para otimizar o uso de RAM na Cloud (Render).
"""

from flask import Flask, render_template, request, jsonify
import pandas as pd
import numpy as np
import joblib
import os
import cv2
from datetime import datetime, timedelta
import db_connection
import bcrypt
import jwt
from functools import wraps
from dotenv import load_dotenv


load_dotenv()
app = Flask(__name__)

# CHAVE SECRETA DO SERVIDOR (Usada para encriptar os Tokens JWT)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY') or "Chave_Secreta_De_Seguranca_Backup_2026"
# --- VARIÁVEIS GLOBAIS ---
modelo_noticias = None
modelo_social = None
extrator_visao = None
face_cascade = None
ia_visual_ativa = False

# Analisa a carga emocional do texto com base num dicionário léxico pré-definido.
def analisar_sentimento(txt):
    """Função simples de NLP para análise de sentimento."""
    if not txt: return 0
    t = str(txt).lower()
    pos = ["vitória", "bom", "excelente", "sucesso", "positivo", "ganhou", "destaque"]
    neg = ["crise", "mau", "queda", "problema", "erro", "morreu", "perigo"]
    pontos = sum(1 for p in pos if p in t) - sum(1 for n in neg if n in t)
    return max(min(pontos, 5), -5)

""" Implementa 'Eager Loading'. Carrega os modelos pesados no arranque do servidor
    para evitar demoras na primeira previsão do utilizador."""
def carregar_recursos():
    global modelo_noticias, modelo_social, extrator_visao, face_cascade, ia_visual_ativa
    
    if modelo_social is None:
        print("A carregar componentes base...")
        base_path = os.path.dirname(__file__)
        
        try:
            modelo_noticias = joblib.load(os.path.join(base_path, "models", "modelo_noticias.pkl"))
            modelo_social = joblib.load(os.path.join(base_path, "models", "modelo_social.pkl"))
            face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        except Exception as e:
            print(f"Erro ao carregar ficheiros .pkl: {e}")
            raise e

        try:
            import torch
            from torchvision import models
            print("A carregar ResNet18...")
            # --- ACELERADOR DE CPU ---
            torch.set_num_threads(2)
            # -------------------------
            resnet = models.resnet18(pretrained=True)
            extrator_visao = torch.nn.Sequential(*list(resnet.children())[:-1])
            extrator_visao.eval()
            ia_visual_ativa = True
        except Exception as e:
            print(f"Modo Lite Ativado: {e}")
            ia_visual_ativa = False

# --- PRÉ-CARREGAMENTO NO ARRANQUE DO SERVIDOR ---
print("A inicializar servidor e a pré-carregar Inteligência Artificial...")
carregar_recursos()
print("Modelos carregados com sucesso! Pronto a receber previsões.")
# ------------------------------------------------

# ==========================================
# O "GUARDA-COSTAS" (Decorador JWT)
# ==========================================
def token_obrigatorio(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].split(" ")[1]
        if not token:
            return jsonify({'sucesso': False, 'erro': 'Token em falta!'}), 401
        try:
            dados = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user_id = dados['user_id']
        except:
            return jsonify({'sucesso': False, 'erro': 'Token inválido ou expirado!'}), 401
        return f(current_user_id, *args, **kwargs)
    return decorated

# Rota para servir o Dashboard (Frontend).
@app.route('/')
def home():
    return render_template('index.html')

@app.route('/login-page')
def pagina_login():
    return render_template('login.html')
# ==========================================
# ROTAS DE PREVISÃO (INTACTAS DO TEU CÓDIGO)
# ==========================================
@app.route('/prever', methods=['POST'])
def prever():
    try:
        # Suporta leitura quer de JSON quer de Form Data
        if request.is_json:
            dados = request.json or {}
            titulo = dados.get('titulo', '')
            descricao = dados.get('descricao', '')
            categoria = dados.get('categoria', 'geral')
            dia_semana = int(dados.get('dia_semana', datetime.now().weekday()))
            hora = int(dados.get('hora', datetime.now().hour))
        else:
            titulo = request.form.get('titulo', '')
            descricao = request.form.get('descricao', '')
            categoria = request.form.get('categoria', 'geral')
            dia_semana = int(request.form.get('dia_semana', datetime.now().weekday()))
            hora = int(request.form.get('hora', datetime.now().hour))
            
        sent = analisar_sentimento(titulo + " " + descricao)
        
        df_input = pd.DataFrame([{
            "n_palavras_titulo": len(titulo.split()) if titulo else 0, 
            "n_palavras_desc": len(descricao.split()) if descricao else 0,
            "sentimento": sent, 
            "dia_semana": dia_semana,
            "hora": hora, 
            "categoria": categoria
        }])
        
        previsao = str(modelo_noticias.predict(df_input)[0]).strip().capitalize()
        
        # Guardar na BD se o utilizador estiver autenticado
        db_id = None
        if 'Authorization' in request.headers:
            try:
                auth_header = request.headers['Authorization']
                if auth_header and " " in auth_header:
                    token = auth_header.split(" ")[1]
                    chave_jwt = app.config.get('SECRET_KEY') or "Chave_Secreta_De_Seguranca_Backup_2026"
                    dados_token = jwt.decode(token, chave_jwt, algorithms=["HS256"])
                    utilizador_id = dados_token['user_id']
                    
                    if utilizador_id:
                        conn = db_connection.get_connection()
                        cursor = conn.cursor()
                        query = """
                        INSERT INTO dbo.Feedback (Titulo_Input, Descricao_Input, Categoria_Input, N_Palavras_Titulo, N_Palavras_Desc, Sentimento, Dia_Semana, Hora, Popularidade_Real, Previsao_IA, Utilizador_ID, DataFeedback)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NULL, %s, %s, GETDATE())
                        """
                        cursor.execute(query, (titulo, descricao, categoria, len(titulo.split()) if titulo else 0, len(descricao.split()) if descricao else 0, sent, dia_semana, hora, previsao, utilizador_id))
                        conn.commit()
                        
                        cursor.execute("SELECT SCOPE_IDENTITY()")
                        db_id = cursor.fetchone()[0]
                        conn.close()
            except Exception as e:
                print(f"Erro ao guardar previsão na BD: {e}")
                
        return jsonify({"sucesso": True, "previsao": previsao, "db_id": db_id})
    except Exception as e:
        return jsonify({"sucesso": False, "erro": str(e)})

@app.route('/prever_social', methods=['POST'])
def prever_social():
    try:
        # 1. DEFINIÇÃO DE VARIÁVEIS (Escopo no topo)
        seguidores = int(request.form.get('seguidores', 1000))
        likes = int(request.form.get('likes', 0))
        comentarios = int(request.form.get('comentarios', 0))
        texto_post = request.form.get('texto_social', '')
        
        foto = request.files.get('imagem_post')
        n_rostos, brilho = 0, 127
        resnet_vec = np.zeros(512)

        # 2. Processamento Imagem
        imagem_fornecida = False
        if foto and foto.filename != '':
            file_bytes = np.frombuffer(foto.read(), np.uint8)
            img_cv = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
            if img_cv is not None:
                gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
                brilho = int(np.mean(gray))
                faces = face_cascade.detectMultiScale(gray, 1.1, 4)
                n_rostos = len(faces)
                imagem_fornecida = True

        # 3. Previsão
        input_final = np.hstack([np.array([likes, comentarios, seguidores, n_rostos, brilho]), resnet_vec]).reshape(1, -1)
        resultado_final = str(modelo_social.predict(input_final)[0]).strip().capitalize()
        
        # Obter apenas a média da popularidade prevista com os valores rígidos especificados
        avg_likes = 35
        if resultado_final.lower() in ['média', 'media', 'medium']:
            avg_likes = 250
        elif resultado_final.lower() in ['alta', 'high']:
            avg_likes = 1200

        # Apenas a frase da média de likes, sem detetar rostos/brilho no texto de contexto
        contexto = f"A média de likes vai ser de +{avg_likes}."
            
        # 5. Motor de Sugestões
        sugestoes = []
        if resultado_final.lower() in ['baixa', 'média', 'media']:
            if n_rostos == 0: sugestoes.append("💡 Dica: Notícias com rostos geram mais empatia.")
            if brilho < 90: sugestoes.append("💡 Dica: Tente uma imagem com mais luminosidade.")
            if len(texto_post.split()) < 15: sugestoes.append("💡 Dica: Desenvolva a narrativa (storytelling) do post.")
            if texto_post.count('#') < 3: sugestoes.append("💡 Dica: Adicione 3 a 5 hashtags relevantes.")

        # Guardar na BD se o utilizador estiver autenticado
        db_id = None
        if 'Authorization' in request.headers:
            try:
                auth_header = request.headers['Authorization']
                if auth_header and " " in auth_header:
                    token = auth_header.split(" ")[1]
                    chave_jwt = app.config.get('SECRET_KEY') or "Chave_Secreta_De_Seguranca_Backup_2026"
                    dados_token = jwt.decode(token, chave_jwt, algorithms=["HS256"])
                    utilizador_id = dados_token['user_id']
                    
                    if utilizador_id:
                        agora = datetime.now()
                        conn = db_connection.get_connection()
                        cursor = conn.cursor()
                        query = """
                        INSERT INTO dbo.Feedback_Social 
                        (Texto_Post, Seguidores, Likes, Comentarios, Mes, Dia_Semana, Hora, N_Hashtags, N_Palavras, Popularidade_Real, Previsao_IA, Utilizador_ID, Data_Registo)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NULL, %s, %s, GETDATE())
                        """
                        cursor.execute(query, (texto_post, seguidores, likes, comentarios, agora.month, agora.weekday(), agora.hour, texto_post.count('#'), len(texto_post.split()) if texto_post else 0, resultado_final, utilizador_id))
                        conn.commit()
                        
                        cursor.execute("SELECT SCOPE_IDENTITY()")
                        db_id = cursor.fetchone()[0]
                        conn.close()
            except Exception as e:
                print(f"Erro ao guardar previsão social na BD: {e}")

        return jsonify({
            "sucesso": True, 
            "previsao": resultado_final, 
            "contexto_ia": contexto, 
            "sugestoes": sugestoes,
            "rostos": n_rostos,
            "brilho": brilho if imagem_fornecida else 0,
            "has_image": imagem_fornecida,
            "ia_visual": "Total" if ia_visual_ativa else "Lite (OpenCV)",
            "db_id": db_id
        })
    except Exception as e:
        return jsonify({"sucesso": False, "erro": str(e)})

# ==========================================
# ROTAS DE AUTENTICAÇÃO (NOVO)
# ==========================================
@app.route('/api/registar', methods=['POST'])
def registar():
    try:
        dados = request.json
        salt = bcrypt.gensalt()
        pwd_hash = bcrypt.hashpw(dados['password'].encode('utf-8'), salt).decode('utf-8')
        conn = db_connection.get_connection()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO dbo.Utilizadores (Nome, Email, Password_Hash) VALUES (%s, %s, %s)", 
                       (dados['nome'], dados['email'], pwd_hash))
        conn.commit()
        return jsonify({"sucesso": True, "mensagem": "Conta criada com sucesso!"})
    except Exception as e:
        return jsonify({"sucesso": False, "erro": "Erro ao criar conta. Email já existe?"}), 400

@app.route('/api/login', methods=['POST'])
def login():
    try:
        dados = request.json
        email_limpo = dados.get('email', '').strip()
        password_inserida = dados.get('password', '')

        conn = db_connection.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT ID, Nome, Password_Hash FROM dbo.Utilizadores WHERE Email = %s", (email_limpo,))
        user = cursor.fetchone()
        conn.close()

        # 1. VERIFICA SE O EMAIL EXISTE
        if not user:
            return jsonify({"sucesso": False, "erro": f"O email '{email_limpo}' não existe na Base de Dados."}), 401

        hash_db = user[2].strip()

        # 2. VERIFICA SE O AZURE CORROMPEU A PASSWORD
        if len(hash_db) != 60:
            return jsonify({"sucesso": False, "erro": f"Erro BD: O Hash guardado tem {len(hash_db)} caracteres (devia ter exatamente 60)."}), 401

        # 3. VERIFICA SE A PASSWORD BATE CERTO
        if bcrypt.checkpw(password_inserida.encode('utf-8'), hash_db.encode('utf-8')):
            
            # SOLUÇÃO FINAL: Obriga o servidor a ter sempre uma chave em texto!
            chave_jwt = app.config.get('SECRET_KEY')
            if not chave_jwt: # Se for Nulo ou Vazio
                chave_jwt = "Chave_Secreta_De_Seguranca_Backup_2026"
                
            token = jwt.encode({"user_id": user[0], "exp": datetime.utcnow() + timedelta(hours=24)}, 
                               chave_jwt, algorithm="HS256")
                               
            return jsonify({"sucesso": True, "token": token, "nome": user[1], "email": email_limpo})
        else:
            return jsonify({"sucesso": False, "erro": "A password está errada e não corresponde ao Hash."}), 401

    except Exception as e:
         return jsonify({"sucesso": False, "erro": f"Erro interno: {str(e)}"}), 500

@app.route('/api/perfil', methods=['GET'])
@token_obrigatorio
def gerir_perfil(current_user_id):
    conn = db_connection.get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT Nome, Email FROM dbo.Utilizadores WHERE ID = %s", (current_user_id,))
    user = cursor.fetchone()
    return jsonify({"sucesso": True, "nome": user[0], "email": user[1]})

# ==========================================
# ENDPOINT DE FEEDBACK
# ==========================================
@app.route('/feedback', methods=['POST'])
def guardar_feedback():
    try:
        dados = request.json
        popularidade_real = dados.get('popularidade_real') 
        previsao_ia = dados.get('previsao_ia', 'N/A')
        db_id = dados.get('db_id') or dados.get('id') # Suporta db_id ou id

        utilizador_id = None
        if 'Authorization' in request.headers:
            try:
                auth_header = request.headers['Authorization']
                if auth_header and " " in auth_header:
                    token = auth_header.split(" ")[1]
                    chave_jwt = app.config.get('SECRET_KEY') or "Chave_Secreta_De_Seguranca_Backup_2026"
                    dados_token = jwt.decode(token, chave_jwt, algorithms=["HS256"])
                    utilizador_id = dados_token['user_id']
            except:
                pass

        agora = datetime.now()
        conn = db_connection.get_connection()
        cursor = conn.cursor()
        
        # Detetar se é notícia
        is_noticia = 'titulo' in dados or dados.get('tipo') == 'noticia' or dados.get('tipo') == 'noticias'
        
        if is_noticia:
            if db_id:
                # Efetuar UPDATE na previsão existente
                query = """
                UPDATE dbo.Feedback 
                SET Popularidade_Real = %s, DataFeedback = GETDATE()
                WHERE ID = %s
                """
                cursor.execute(query, (popularidade_real, db_id))
                mensagem_sucesso = "Feedback de Notícia atualizado com sucesso!"
            else:
                # Efetuar INSERT novo
                titulo = dados.get('titulo', '')
                descricao = dados.get('descricao', '')
                categoria = dados.get('categoria', 'geral')
                
                n_pal_titulo = len(titulo.split()) if titulo else 0
                n_pal_desc = len(descricao.split()) if descricao else 0
                sentimento = analisar_sentimento(titulo + " " + descricao)

                query = """
                INSERT INTO dbo.Feedback (Titulo_Input, Descricao_Input, Categoria_Input, N_Palavras_Titulo, N_Palavras_Desc, Sentimento, Dia_Semana, Hora, Popularidade_Real, Previsao_IA, Utilizador_ID, DataFeedback)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, GETDATE())
                """
                cursor.execute(query, (titulo, descricao, categoria, n_pal_titulo, n_pal_desc, sentimento, agora.weekday(), agora.hour, popularidade_real, previsao_ia, utilizador_id))
                mensagem_sucesso = "Feedback de Notícia guardado com sucesso!"
        else:
            if db_id:
                # Efetuar UPDATE na previsão existente
                query = """
                UPDATE dbo.Feedback_Social 
                SET Popularidade_Real = %s, Data_Registo = GETDATE()
                WHERE ID = %s
                """
                cursor.execute(query, (popularidade_real, db_id))
                mensagem_sucesso = "Feedback Social atualizado com sucesso!"
            else:
                # Efetuar INSERT novo
                texto_post = dados.get('texto_post', '')
                try:
                    seguidores = int(dados.get('seguidores', 0))
                    likes = int(dados.get('likes', 0))             
                    comentarios = int(dados.get('comentarios', 0)) 
                except:
                    seguidores, likes, comentarios = 0, 0, 0
                
                n_palavras = len(texto_post.split()) if texto_post else 0
                n_hashtags = texto_post.count('#') if texto_post else 0
                mes = agora.month
                
                query = """
                INSERT INTO dbo.Feedback_Social 
                (Texto_Post, Seguidores, Likes, Comentarios, Mes, Dia_Semana, Hora, N_Hashtags, N_Palavras, Popularidade_Real, Previsao_IA, Utilizador_ID, Data_Registo)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, GETDATE())
                """
                cursor.execute(query, (texto_post, seguidores, likes, comentarios, mes, agora.weekday(), agora.hour, n_hashtags, n_palavras, popularidade_real, previsao_ia, utilizador_id))
                mensagem_sucesso = "Feedback Social guardado com sucesso!"

        conn.commit()
        conn.close()

        return jsonify({"sucesso": True, "mensagem": mensagem_sucesso})

    except Exception as e:
        print(f"Erro ao guardar feedback: {e}")
        return jsonify({"sucesso": False, "erro": str(e)})

# ==========================================
# OBTER HISTÓRICO DO UTILIZADOR
# ==========================================
@app.route('/api/historico', methods=['GET'])
@token_obrigatorio
def obter_historico(current_user_id):
    try:
        conn = db_connection.get_connection()
        cursor = conn.cursor()

        # NOVO: Vai buscar a Previsao_IA (n[5])
        cursor.execute("""
            SELECT ID, Titulo_Input, Categoria_Input, Popularidade_Real, DataFeedback, Previsao_IA 
            FROM dbo.Feedback 
            WHERE Utilizador_ID = %s 
            ORDER BY DataFeedback DESC
        """, (current_user_id,))
        noticias = cursor.fetchall()

        # NOVO: Vai buscar a Previsao_IA (s[7])
        cursor.execute("""
            SELECT ID, Texto_Post, Seguidores, Popularidade_Real, Data_Registo, Likes, Comentarios, Previsao_IA 
            FROM dbo.Feedback_Social 
            WHERE Utilizador_ID = %s 
            ORDER BY Data_Registo DESC
        """, (current_user_id,))
        social = cursor.fetchall()
        
        conn.close()

        historico = []
        for n in noticias:
            historico.append({
                "id": n[0],
                "tipo": "noticia", "titulo": n[1] or "Sem Título", 
                "detalhe": f"Categoria: {n[2]}", "feedback": n[3], 
                "data": n[4].strftime("%Y-%m-%d %H:%M") if n[4] else "",
                "previsao_ia": n[5] if n[5] else "N/A"
            })
            
        for s in social:
            likes_val = s[5] if s[5] is not None else 0
            coments_val = s[6] if s[6] is not None else 0
            historico.append({
                "id": s[0],
                "tipo": "social", "titulo": s[1] or "Post sem texto", 
                "detalhe": f"Seguidores: {s[2]}  •  Likes: {likes_val}  •  Comentários: {coments_val}", 
                "feedback": s[3], 
                "data": s[4].strftime("%Y-%m-%d %H:%M") if s[4] else "",
                "previsao_ia": s[7] if s[7] else "N/A"
            })

        historico = sorted(historico, key=lambda x: x['data'], reverse=True)
        return jsonify({"sucesso": True, "historico": historico})
        
    except Exception as e:
        print(f"Erro no histórico: {e}")
        return jsonify({"sucesso": False, "erro": "Não foi possível carregar o histórico."}), 500

if __name__ == '__main__':
    # Forçar a porta 7860 para o Hugging Face Docker Space
    app.run(host='0.0.0.0', port=7860)