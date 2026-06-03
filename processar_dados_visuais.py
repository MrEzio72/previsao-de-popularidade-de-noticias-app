import cv2
import numpy as np
import urllib.request
import db_connection
import pandas as pd
import warnings

# Ignorar os avisos do Pandas
warnings.filterwarnings('ignore')

def extrair_features_visuais(url):
    try:
        req = urllib.request.urlopen(url, timeout=5)
        arr = np.asarray(bytearray(req.read()), dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)

        if img is None: return 0, 127

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        
        # AQUI ESTÁ A CORREÇÃO: Filtros muito mais rigorosos para evitar falsos positivos
        faces = face_cascade.detectMultiScale(
            gray, 
            scaleFactor=1.2,      # Menos falsos positivos
            minNeighbors=8,       # Exige alta certeza (padrão é 3 ou 4, subimos para 8)
            minSize=(40, 40)      # Ignora "caras" com menos de 40x40 pixeis (ruído no fundo)
        )
        n_rostos = len(faces)
        
        brilho = int(np.mean(gray))

        return n_rostos, brilho
    except Exception as e:
        return 0, 127

def processar_dataset_existente():
    print("A resgatar TODAS as imagens do Azure para reavaliar...")
    conn = db_connection.get_connection()
    
    # Desta vez vamos reavaliar TUDO o que tem link de imagem, para corrigir os erros antigos
    query = """
        SELECT Post_ID_Social, Link_Imagem 
        FROM dbo.Dataset_Social_Real 
        WHERE Link_Imagem IS NOT NULL AND Link_Imagem != ''
    """
    df = pd.read_sql(query, conn)
    conn.close()

    print(f"{len(df)} imagens prontas para reanálise visual rigorosa.")

    sucessos = 0
    for index, row in df.iterrows():
        url_img = row['Link_Imagem']
        post_id = str(row['Post_ID_Social']).replace('.0', '').strip()
        
        rostos, brilho = extrair_features_visuais(url_img)
        
        # Atualiza a Base de Dados com os novos números (mais precisos)
        db_connection.atualizar_dados_visuais(post_id, rostos, brilho)
        sucessos += 1
        
        # Imprime o link se achar que tem muitos rostos, para tu verificares!
        if rostos > 1:
            print(f"Detetados {rostos} rostos nesta imagem: {url_img}")
            
        if sucessos % 20 == 0:
            print(f"Já analisámos {sucessos}/{len(df)} imagens...")

    print("🚀 Reanálise rigorosa concluída!")

if __name__ == "__main__":
    processar_dataset_existente()