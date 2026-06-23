import requests

url = "https://tthheodor-previsao-popularidade.hf.space/prever"
payload = {
    "titulo": "Teste de noticia",
    "descricao": "Esta e uma descricao de teste",
    "categoria": "geral",
    "dia_semana": 1,
    "hora": 12
}

headers = {
    "User-Agent": "okhttp/4.9.2",
    "Content-Type": "application/json"
}

try:
    print("Enviando POST para /prever com User-Agent 'okhttp/4.9.2'...")
    response = requests.post(url, json=payload, headers=headers, timeout=10)
    print(f"Status: {response.status_code}")
    print(f"Headers: {response.headers}")
    print(f"Resposta: {response.text}")
except Exception as e:
    print(f"Erro: {e}")
