"""
API Principal (Servidor Flask) | AI Popularity Predictor
--------------------------------------------------------
Orquestra a interface web e processa as previsões de Machine Learning.
Suporta IA Multimodal (NLP para texto e ResNet18/OpenCV para imagens).
Implementa estratégias de 'Lazy Loading' para otimizar o uso de RAM na Cloud (Render).
"""

from flask import Flask, request, jsonify
import pandas as pd
import numpy as np
import joblib
import os
import cv2
from datetime import datetime
import db_connection

app = Flask(__name__)

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

# Rota de estado do servidor.
@app.route('/')
def home():
    return jsonify({"sucesso": True, "mensagem": "Servidor AI Popularity Predictor online."})

"""
    Endpoint preditivo para o modelo de Websites/Notícias.
    Utiliza métricas baseadas em texto (NLP) e contexto temporal.
"""
@app.route('/prever', methods=['POST'])
def prever():
    try:
        
        # Suporta tanto JSON (App Mobile) como Form Data (Site Web atual)
        dados = request.get_json(silent=True) or request.form
        
        titulo = dados.get('titulo', '')
        descricao = dados.get('descricao', '')
        categoria = dados.get('categoria', 'geral')
        
        sent = analisar_sentimento(titulo + " " + descricao)
        
        df_input = pd.DataFrame([{
            "n_palavras_titulo": len(titulo.split()) if titulo else 0, 
            "n_palavras_desc": len(descricao.split()) if descricao else 0,
            "sentimento": sent, 
            "dia_semana": datetime.now().weekday(),
            "hora": datetime.now().hour, 
            "categoria": categoria
        }])
        
        previsao = modelo_noticias.predict(df_input)[0]
        return jsonify({"sucesso": True, "previsao": previsao})
    except Exception as e:
        return jsonify({"sucesso": False, "erro": str(e)})

"""
    Endpoint preditivo para Redes Sociais.
    Combina métricas base (likes, followers) com extração vetorial da imagem (ResNet18).
"""
@app.route('/prever_social', methods=['POST'])
def prever_social():
    try:
        
        seguidores = int(request.form.get('seguidores', 1000))
        likes = int(request.form.get('likes', 0))
        comentarios = int(request.form.get('comentarios', 0))
        
        foto = request.files.get('imagem_post')
        n_rostos, brilho = 0, 127
        resnet_vec = np.zeros(512)

        if foto and foto.filename != '':
            file_bytes = np.frombuffer(foto.read(), np.uint8)
            img_cv = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
            if img_cv is not None:
                altura, largura = img_cv.shape[:2]
                if largura > 600:
                    proporcao = 600 / largura
                    img_cv = cv2.resize(img_cv, (600, int(altura * proporcao)))
                gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
                brilho = int(np.mean(gray))
                faces = face_cascade.detectMultiScale(gray, 1.1, 4)
                n_rostos = len(faces)

                if ia_visual_ativa:
                    from PIL import Image
                    import torch
                    from torchvision import transforms
                    img_pil = Image.fromarray(cv2.cvtColor(img_cv, cv2.COLOR_BGR2RGB))
                    preprocess = transforms.Compose([
                        transforms.Resize(256), transforms.CenterCrop(224),
                        transforms.ToTensor(), transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
                    ])
                    tensor = preprocess(img_pil).unsqueeze(0)
                    with torch.no_grad():
                        resnet_vec = extrator_visao(tensor).squeeze().numpy()

        input_final = np.hstack([np.array([likes, comentarios, seguidores, n_rostos, brilho]), resnet_vec]).reshape(1, -1)
        previsao = modelo_social.predict(input_final)[0]

        return jsonify({
            "sucesso": True, "previsao": previsao, 
            "rostos": n_rostos, "brilho": brilho,
            "ia_visual": "Total" if ia_visual_ativa else "Lite (OpenCV)"
        })
    except Exception as e:
        return jsonify({"sucesso": False, "erro": str(e)})

"""
    NOVO ENDPOINT: Receber Feedback Manual
    Guarda as validações do utilizador na tabela feedbacksocial
"""
@app.route('/feedback', methods=['POST'])
def guardar_feedback():
    try:
        dados = request.get_json(silent=True) or {}
        if not dados:
            return jsonify({"sucesso": False, "erro": "Dados em falta ou formato incorreto"})
        popularidade_real = dados.get('popularidade_real') 

        # Capturar o momento exato
        from datetime import datetime
        agora = datetime.now()
        dia_semana = agora.weekday()
        hora = agora.hour

        # Ligar à base de dados
        import db_connection
        conn = db_connection.get_connection()
        cursor = conn.cursor()
        
        # LÓGICA DE SEPARAÇÃO: É Notícia (Site) ou é Rede Social?
        if 'titulo' in dados:
            # --- É UMA NOTÍCIA DO SITE ---
            titulo = dados.get('titulo', '')
            descricao = dados.get('descricao', '')
            categoria = dados.get('categoria', 'geral')
            
            # Recalcular métricas que a tua tabela Feedback exige
            n_pal_titulo = len(titulo.split()) if titulo else 0
            n_pal_desc = len(descricao.split()) if descricao else 0
            sentimento = analisar_sentimento(titulo + " " + descricao)

            query = """
            INSERT INTO dbo.Feedback (Titulo_Input, Descricao_Input, Categoria_Input, N_Palavras_Titulo, N_Palavras_Desc, Sentimento, Dia_Semana, Hora, Popularidade_Real, DataFeedback)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, GETDATE())
            """
            cursor.execute(query, (titulo, descricao, categoria, n_pal_titulo, n_pal_desc, sentimento, dia_semana, hora, popularidade_real))
            mensagem_sucesso = "Feedback de Notícia guardado com sucesso!"

        else:
            # --- É UMA REDE SOCIAL ---
            texto_post = dados.get('texto_post', '')
            
            # Garantir que seguidores é número
            try:
                seguidores = int(dados.get('seguidores', 0))
            except:
                seguidores = 0
            
            n_palavras = len(texto_post.split()) if texto_post else 0
            n_hashtags = texto_post.count('#') if texto_post else 0
            mes = agora.month
            
            query = """
            INSERT INTO dbo.Feedback_Social 
            (Texto_Post, Seguidores, Mes, Dia_Semana, Hora, N_Hashtags, N_Palavras, Popularidade_Real, Data_Registo)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, GETDATE())
            """
            
            cursor.execute(query, (texto_post, seguidores, mes, dia_semana, hora, n_hashtags, n_palavras, popularidade_real))
            mensagem_sucesso = "Feedback Social guardado com sucesso!"

        conn.commit()
        conn.close()

        return jsonify({"sucesso": True, "mensagem": mensagem_sucesso})

    except Exception as e:
        print(f"Erro ao guardar feedback: {e}")
        return jsonify({"sucesso": False, "erro": str(e)})

if __name__ == '__main__':
    # Forçar a porta 7860 para o Hugging Face Docker Space
    app.run(host='0.0.0.0', port=7860)