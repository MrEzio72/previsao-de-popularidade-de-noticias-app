import requests
from apify_client import ApifyClient
import db_connection
from datetime import datetime
import numpy as np
import os
import pandas as pd
from dotenv import load_dotenv

# Carrega as variáveis de ambiente (Token do Apify e DB)
load_dotenv()
token_apify = os.getenv('APIFY_TOKEN')
client = ApifyClient(token_apify)

# ==========================================
# 1. FUNÇÕES DE EXTRAÇÃO (DESCOBERTA)
# ==========================================

def extrair_instagram(username, limite=5):
    """Descobre posts novos num perfil de Instagram."""
    print(f"INSTAGRAM -> A descobrir novos posts: {username}")
    run_input = { "username": [username], "resultsLimit": limite }
    run = client.actor("apify/instagram-post-scraper").call(run_input=run_input)
    return list(client.dataset(run["defaultDatasetId"]).iterate_items())

def extrair_facebook(page_name, limite=5):
    """Descobre posts novos numa página de Facebook."""
    print(f"FACEBOOK -> A descobrir novos posts: {page_name}")
    run_input = {
        "startUrls": [{"url": f"https://www.facebook.com/{page_name}"}],
        "resultsLimit": limite,
        "viewOption": "POSTS_RECENT"
    }
    run = client.actor("apify/facebook-posts-scraper").call(run_input=run_input)
    return list(client.dataset(run["defaultDatasetId"]).iterate_items())

# ==========================================
# 2. FUNÇÃO DE ATUALIZAÇÃO (MODO SNIPER)
# ==========================================

def extrair_posts_especificos(urls, rede):
    """Usa o link direto para atualizar likes e imagens de posts pendentes."""
    if not urls: return []
    print(f"PRIORIDADE -> A atualizar {len(urls)} posts pendentes no {rede}")
    
    actor = "apify/instagram-post-scraper" if rede == "instagram" else "apify/facebook-posts-scraper"
    
    if rede == "instagram":
        # O Apify exige username mesmo com directUrls. Usamos 'rtpnoticias' como padrão.
        run_input = { 
            "username": ["rtpnoticias"], 
            "directUrls": urls ,
            "resultsLimit": len(urls)
        }
    else:
        # Facebook usa startUrls para links diretos
        run_input = { "startUrls": [{"url": u} for u in urls] }
    
    run = client.actor(actor).call(run_input=run_input)
    return list(client.dataset(run["defaultDatasetId"]).iterate_items())

# ==========================================
# 3. FUNÇÕES AUXILIARES DE TRATAMENTO
# ==========================================

def tratar_data(p):
    """Normaliza o formato de data vindo do Apify para o SQL Server."""
    ts = p.get('timestamp') or p.get('date') or p.get('createdAt')
    if not ts: return datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    try:
        if 'T' in str(ts):
            return datetime.fromisoformat(str(ts).replace('Z', '+00:00')).strftime('%Y-%m-%d %H:%M:%S')
    except: pass
    return datetime.now().strftime('%Y-%m-%d %H:%M:%S')

def calcular_popularidade(likes, comments, l_inf=50, l_sup=500):
    """Calcula a classe de popularidade (Opcional, o db_connection pode sobrepor)."""
    total = likes + comments
    if total >= l_sup: return "alta"
    if total <= l_inf: return "baixa"
    return "média"

# ==========================================
# 4. LÓGICA PRINCIPAL (ORQUESTRAÇÃO COM BLOQUEIO)
# ==========================================

def executar_tudo():
    print(f"\n--- INÍCIO DA RUN: {datetime.now().strftime('%d/%m/%Y %H:%M')} ---")

    # --- PASSO 1: O GATEKEEPER (Verificar Pendentes) ---
    try:
        # Esta função busca posts com Avaliado=0 que caem nas janelas de 12h, 24h ou 48h
        df_update = db_connection.get_posts_para_checkpoint() 
        
        if not df_update.empty:
            print(f"BLOQUEIO DE SEGURANÇA: Existem {len(df_update)} atualizações pendentes.")
            print("Garantindo que os dados antigos estão completos antes de trazer novos...")

            for rede in ['instagram', 'facebook']:
                # O [:15] garante que ele só manda 15 links no máximo por cada vez que o GitHub Actions corre!
                urls = df_update[df_update['Plataforma'] == rede]['Link_Post'].tolist()[:50]
                if urls:
                    posts_revistos = extrair_posts_especificos(urls, rede)
                    for pr in posts_revistos:
                        # O db_connection.upsert_social_real agora faz análise de imagem (Rostos/Brilho)
                        likes = int(pr.get('likesCount', pr.get('likes', pr.get('reactionsCount', 0)) or 0))
                        comments = int(pr.get('commentsCount', pr.get('comments', 0) or 0))
                        pop_calculada = calcular_popularidade(likes, comments, l_inf=50, l_sup=500)

                        # CORREÇÃO AQUI: Passamos a data pelo tratar_data() e montamos o dicionário pr_sql
                        pr_sql = {
                            'id': pr.get('id', pr.get('shortCode', str(np.random.randint(1e9)))),
                            'likesCount': likes,
                            'commentsCount': comments,
                            'caption': (pr.get('caption') or pr.get('text') or "Sem texto")[:1000],
                            'url': pr.get('url', pr.get('facebookUrl', '')),
                            'timestamp': tratar_data(pr), # <--- TRATAMENTO DA DATA APLICADO
                            'image_url': pr.get('displayUrl') or pr.get('mediaUrl') or pr.get('image') or ''
                        }

                        db_connection.upsert_social_real(pr_sql, "Update", rede, pop_calculada, 0)
            
            print("Atualizações concluídas. Run encerrada para preservar integridade do dataset.")
            return # BLOQUEIO: Sai do script e não vai buscar notícias novas

        else:
            print("✨ BD LIMPA: Não há posts à espera de likes de 12h/24h/48h.")
            
    except Exception as e:
        print(f"Erro crítico no Passo 1 (Checkpoints): {e}")
        return # Se falhar a BD, não arriscamos trazer novas

    # --- PASSO 2: DESCOBERTA (Só chega aqui se o Passo 1 estiver VAZIO) ---
    print("AUTORIZADO: A procurar sangue novo nas redes sociais...")
    
    fontes = [
        {"user": "rtpnoticias", "nome": "RTP", "rede": "instagram"},
        {"user": "publico.pt", "nome": "Publico", "rede": "instagram"},
        {"user": "observador", "nome": "Observador", "rede": "instagram"},
        {"user": "rtpnoticias", "nome": "RTP", "rede": "facebook"},
        {"user": "publico", "nome": "Publico", "rede": "facebook"},
        {"user": "Observador", "nome": "Observador", "rede": "facebook"}
    ]

    for f in fontes:
        try:
            # Limite baixo (5) para garantir qualidade e economia
            posts = extrair_instagram(f['user'], 5) if f['rede'] == "instagram" else extrair_facebook(f['user'], 5)
            
            for p in posts:
                # Prepara o dicionário para o db_connection
                likes = int(p.get('likesCount', p.get('likes', p.get('reactionsCount', 0)) or 0))
                comments = int(p.get('commentsCount', p.get('comments', 0) or 0))
                
                p_sql = {
                    'id': p.get('id', p.get('shortCode', str(np.random.randint(1e9)))),
                    'likesCount': likes,
                    'commentsCount': comments,
                    'caption': (p.get('caption') or p.get('text') or "Sem texto")[:1000],
                    'url': p.get('url', p.get('facebookUrl', '')),
                    'timestamp': tratar_data(p),
                    'image_url': p.get('displayUrl') or p.get('mediaUrl') or p.get('image') or ''
                }
                
                # Guarda como Avaliado = 0 para entrar no loop de checkpoints nas próximas runs
                pop_calculada = calcular_popularidade(likes, comments, l_inf=50, l_sup=500)
                db_connection.upsert_social_real(p_sql, f['nome'], f['rede'], pop_calculada, 0)
                
            print(f"{f['nome']} ({f['rede']}) processado.")
        except Exception as e:
            print(f"Erro na Descoberta de {f['nome']}: {e}")

if __name__ == "__main__":
    executar_tudo()