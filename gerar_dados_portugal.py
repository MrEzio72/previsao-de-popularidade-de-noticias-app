"""
Motor de Aquisição de Notícias e Avaliador de Capas (Proxy de Visibilidade)
---------------------------------------------------------------------------
Recolhe feeds RSS e processa a lógica de NLP (Sentimento) para metadados.
Implementa o Proxy Editorial: Raspa a homepage (HTML) do portal de notícias 
para deduzir automaticamente o nível de popularidade com base na posição do artigo.
"""
# ============================================================
# Recolha de Notícias -> SQL SERVER 🛢️
# ============================================================
import pandas as pd
import requests
from bs4 import BeautifulSoup
import re
import time
from datetime import datetime
import db_connection  # <--- O NOSSO NOVO MÓDULO

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

FEEDS = {
    "RTP": {
        "politica": "https://www.rtp.pt/noticias/rss/politica",
        "economia": "https://www.rtp.pt/noticias/rss/economia",
        "cultura": "https://www.rtp.pt/noticias/rss/cultura",
        "desporto": "https://www.rtp.pt/noticias/rss/desporto",
        "pais": "https://www.rtp.pt/noticias/rss/pais",
    },
    "Publico": { 
        "geral": "https://www.publico.pt/rss/ultimas",
        "politica": "https://www.publico.pt/rss/politica",
        "economia": "https://www.publico.pt/rss/economia",
        "cultura": "https://www.publico.pt/rss/cultura",
        "desporto": "https://www.publico.pt/rss/desporto",
        "sociedade": "https://www.publico.pt/rss/sociedade"
    },
    "Observador": { 
        "geral": "https://observador.pt/feed",
        "politica": "https://observador.pt/seccao/politica/feed/",
        "economia": "https://observador.pt/seccao/economia/feed/",
        "cultura": "https://observador.pt/seccao/cultura/feed/",
        "desporto": "https://observador.pt/seccao/desporto/feed/",
        "sociedade": "https://observador.pt/seccao/sociedade/feed/"
    },
}

PAL_POS = [
    "vitória", "excelente", "positivo", "feliz", "bom", "ganha", "recorde", 
    "sucesso", "cresce", "lucro", "avanço", "melhora", "aprova", "recuperação", 
    "alta", "investimento", "acordo", "crescimento", "vantagem"
]

PAL_NEG = [
    "crise", "mau", "queda", "derrota", "trágico", "pior", "problema", 
    "falha", "rombo", "desemprego", "tensão", "prejuízo", "crime", "morte", 
    "risco", "baixa", "greve", "inflação", "polémica", "violência"
]

EXCECOES_NEGATIVAS = [
    "crise cresce", "desemprego sobe", "desemprego aumenta", "não ganha", 
    "não é bom", "lucro cai", "risco aumenta", "problema agrava", 
    "inflação sobe", "tensão aumenta", "sem acordo", "recuperação falha"
]

EXCECOES_POSITIVAS = [
    "desemprego cai", "desemprego desce", "crise diminui", "inflação desce", 
    "não é mau", "risco diminui", "problema resolvido", "tensão desce",
    "fim da greve", "bate recorde"
]

"""Calcula a carga emocional utilizando análise sintática e de exceções."""
def analisar_sentimento(txt):
    if not txt: return 0
    t = txt.lower()
    
    pontuacao = 0
    
    # PASSO 1: Procurar Expressões Compostas (Têm prioridade máxima)
    for exp in EXCECOES_NEGATIVAS:
        if exp in t:
            pontuacao -= 2
            t = t.replace(exp, "") # Remove da frase para não ler as palavras soltas depois
            
    for exp in EXCECOES_POSITIVAS:
        if exp in t:
            pontuacao += 2
            t = t.replace(exp, "")

    # PASSO 2: Procurar Palavras Soltas (Valem 1 ponto)
    pontuacao += sum(p in t for p in PAL_POS)
    pontuacao -= sum(p in t for p in PAL_NEG)
    
    # PASSO 3: Limitar o score para não criar valores absurdos que confundam a IA
    if pontuacao > 5: pontuacao = 5
    if pontuacao < -5: pontuacao = -5
    
    return pontuacao

def fetch_xml(url):
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        if r.status_code == 200:
            return r.text
        else:
            print(f"⚠️ Aviso: {url} retornou status {r.status_code}")
            return None
    except Exception as e:
        print(f"❌ Erro ao aceder a {url}: {e}")
        return None

def clean_html(text):
    if not text: return ""
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\s+", " ", text).strip()

def extrair_publico_html():
    registos = []
    print("A extrair Público via HTML Scraper (Bypass ao RSS)...")
    url = "https://www.publico.pt/ultimas"
    
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        soup = BeautifulSoup(r.text, "html.parser")
        
        # O Público organiza as notícias em tags <article>
        artigos = soup.find_all("article")
        
        for art in artigos:
            # Encontrar Título e Link
            h_tag = art.find(["h2", "h3"])
            a_tag = h_tag.find("a") if h_tag else art.find("a")
            
            if not a_tag or not a_tag.text.strip():
                continue
                
            titulo = a_tag.text.strip()
            link = a_tag.get("href")
            
            # Corrigir links relativos (ex: /2026/03/noticia... para https://...)
            if link and link.startswith("/"):
                link = "https://www.publico.pt" + link
                
            # Encontrar Descrição (Normalmente em tags <p> com classes como 'blurb' ou 'lead')
            desc_tag = art.find("p", class_=re.compile(r"blurb|lead", re.I))
            desc = desc_tag.text.strip() if desc_tag else ""
            
            # Encontrar Data (Tag <time>)
            time_tag = art.find("time")
            data_pub = time_tag.get("datetime") if time_tag else str(datetime.now())
            
            registos.append({
                "titulo": titulo, 
                "descricao": desc, 
                "link": link,
                "data_publicacao": data_pub, 
                "fonte": "Publico", 
                "categoria": "geral"
            })
    except Exception as e:
        print(f"❌ Erro ao raspar o Público: {e}")
        
    return registos

def recolher_noticias():
    registos = []
    print("A iniciar recolha de RSS e Web Scraping...")
    
    for fonte, categorias in FEEDS.items():
        # IGNORAR O PÚBLICO NO CICLO DOS RSS!
        if fonte == "Publico":
            continue 
            
        for categoria, url in categorias.items():
            xml = fetch_xml(url)
            if not xml: continue
            
            soup = BeautifulSoup(xml, "xml")
            items = soup.find_all("item")
            
            for it in items:
                try:
                    titulo = it.title.text.strip()
                    desc = clean_html(it.description.text)
                    link = it.link.text.strip()
                    pub_date = it.pubDate.text.strip() if it.pubDate else str(datetime.now())
                    
                    registos.append({
                        "titulo": titulo, "descricao": desc, "link": link,
                        "data_publicacao": pub_date, "fonte": fonte, "categoria": categoria
                    })
                except: continue

    # JUNTAR AS NOTÍCIAS DO PÚBLICO (Extraídas por HTML)
    registos.extend(extrair_publico_html())

    df = pd.DataFrame(registos).drop_duplicates(subset=["link"])
    return df


"""
    Obtém o código fonte principal do portal de forma a identificar 
    quais as notícias que os editores escolheram colocar na "montra".
    """
def obter_html_homepages():
    print("A analisar as Homepages (Capas) dos jornais para deduzir popularidade...")
    return {
        "RTP": fetch_xml("https://www.rtp.pt/noticias/"),
        "Publico": fetch_xml("https://www.publico.pt/"),
        "Observador": fetch_xml("https://observador.pt/")
    }

"""
    Aplica engenharia de características (Feature Engineering) e 
    conduz a lógica de rotulagem baseada em visibilidade.
    """
def enriquecer(df):
    if df.empty: return df
    print("A enriquecer dados (NLP e Datas)...")
    df["n_palavras_titulo"] = df["titulo"].apply(lambda x: len(str(x).split()))
    df["n_palavras_desc"] = df["descricao"].apply(lambda x: len(str(x).split()))
    df["data_publicacao"] = pd.to_datetime(df["data_publicacao"], errors="coerce", utc=True).dt.tz_localize(None)
    df["dia_semana"] = df["data_publicacao"].dt.weekday 
    df["hora"] = df["data_publicacao"].dt.hour 
    df["sentimento"] = df["descricao"].apply(analisar_sentimento)
    
    # --- A MAGIA DO PROXY (Rotulagem Automática) ---
    homepages_html = obter_html_homepages()
    
    """
        Rotula 'Alta' se o slug estiver visível no HTML principal e for polémico.
        'Média' se apenas estiver na capa e 'Baixa' se for orgânico.
        """
    def classificar_popularidade_proxy(row):
        fonte = row['fonte']
        link = str(row['link'])
        
        # O link do RSS pode ser diferente do da capa. Usamos o final do link (o "slug")
        partes_link = [p for p in link.split('/') if p]
        slug = partes_link[-1] if partes_link else ""
        
        html_da_fonte = homepages_html.get(fonte, "")
        
        # Se um pedaço do link estiver no código da página inicial, é porque a notícia está lá!
        if html_da_fonte and slug and (slug in html_da_fonte):
            # Está em destaque! Se tiver sentimento forte (polémica/entusiasmo), é Alta. Senão, é Média.
            if abs(row['sentimento']) >= 1:
                return "alta"
            return "média"
        else:
            # Notícias normais que só estão nos feeds e não na capa
            return "baixa"

    print("A classificar popularidade através do Proxy de Visibilidade Editorial...")
    df["popularidade_real"] = df.apply(classificar_popularidade_proxy, axis=1)
    
    return df.dropna()

if __name__ == "__main__":
    df_raw = recolher_noticias()
    df_final = enriquecer(df_raw)
    
    print(f"Notícias prontas e rotuladas: {len(df_final)}")
    print(df_final['popularidade_real'].value_counts()) # Mostra quantas altas, médias e baixas gerou
    
    if not df_final.empty:
        # ATENÇÃO: Garante que o teu db_connection.py foi atualizado para guardar esta nova coluna "popularidade_real"
        db_connection.salvar_noticias_batch(df_final)
    else:
        print("Nenhuma notícia nova para guardar.")