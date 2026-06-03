# Usa o Python 3.11 como base
FROM python:3.11

# O Hugging Face exige que os sites corram na porta 7860
EXPOSE 7860

WORKDIR /app

# Copia os ficheiros e instala as bibliotecas
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia o resto do teu código para lá
COPY . .

# Regra de segurança do Hugging Face: Não correr como Administrador (root)
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

# O comando para arrancar o teu site!
CMD ["gunicorn", "servidor:app", "--bind", "0.0.0.0:7860", "--timeout", "120"]