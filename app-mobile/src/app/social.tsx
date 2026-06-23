import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';

const API_URL = 'https://tthheodor-previsao-popularidade.hf.space';

export default function Social() {
  const { userToken } = useAuth();
  const [plataforma, setPlataforma] = useState<'Instagram' | 'Facebook'>('Instagram');
  const [textoPost, setTextoPost] = useState('');
  const [seguidores, setSeguidores] = useState('1000');
  const [likes, setLikes] = useState('0');
  const [comentarios, setComentarios] = useState('0');
  const [imagem, setImagem] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);

  const escolherImagem = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à galeria para escolher uma imagem.');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImagem(result.assets[0].uri);
    }
  };

  const submeter = async () => {
    setLoading(true);
    setResultado(null);

    try {
      const formData = new FormData();
      formData.append('seguidores', seguidores);
      formData.append('likes', likes);
      formData.append('comentarios', comentarios);
      formData.append('texto_social', textoPost);

      if (imagem) {
        const filename = imagem.split('/').pop() || 'upload.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        formData.append('imagem_post', {
          uri: imagem,
          name: filename,
          type: type
        } as any);
      }

      const response = await fetch(`${API_URL}/prever_social`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`,
        },
        body: formData,
      });

      const data = await response.json();
      
      if (data.sucesso) {
        setResultado(data);
        
        // Salvar no histórico de previsões
        try {
          const novoItem = {
            id: Date.now().toString(),
            tipo: 'social',
            data: new Date().toLocaleString('pt-PT'),
            plataforma,
            textoPost,
            seguidores: parseInt(seguidores) || 0,
            likes: parseInt(likes) || 0,
            comentarios: parseInt(comentarios) || 0,
            imagem,
            previsao: data.previsao,
            rostos: data.rostos,
            brilho: data.brilho,
            iaVisual: data.ia_visual === 'Total' ? 'Total' : 'Lite (OpenCV)',
            contexto_ia: data.contexto_ia,
            sugestoes: data.sugestoes
          };
          const historicoSalvo = await AsyncStorage.getItem('historico_previsoes');
          const historico = historicoSalvo ? JSON.parse(historicoSalvo) : [];
          historico.unshift(novoItem);
          await AsyncStorage.setItem('historico_previsoes', JSON.stringify(historico));
        } catch (e) {
          console.error("Erro ao guardar no histórico:", e);
        }
      } else {
        Alert.alert('Erro', data.erro || 'Erro ao comunicar com o servidor');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Erro de Ligação', 'Não foi possível ligar ao servidor. Garante que o servidor Flask está a correr na porta 7860.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Destino da Publicação</Text>
      <View style={styles.platformSelector}>
        <TouchableOpacity 
          style={[styles.platformButton, plataforma === 'Instagram' && styles.platformButtonActive]}
          onPress={() => setPlataforma('Instagram')}
          activeOpacity={0.8}
        >
          <Text style={[styles.platformButtonText, plataforma === 'Instagram' && styles.platformButtonTextActive]}>Instagram</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.platformButton, plataforma === 'Facebook' && styles.platformButtonActive]}
          onPress={() => setPlataforma('Facebook')}
          activeOpacity={0.8}
        >
          <Text style={[styles.platformButtonText, plataforma === 'Facebook' && styles.platformButtonTextActive]}>Facebook</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Texto do Post</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Escreva o texto do post..."
        multiline
        numberOfLines={3}
        value={textoPost}
        onChangeText={setTextoPost}
      />

      <Text style={styles.label}>Nº de Seguidores</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={seguidores}
        onChangeText={setSeguidores}
      />

      <View style={styles.row}>
        <View style={styles.flex1}>
          <Text style={styles.label}>Likes (Estimados)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={likes}
            onChangeText={setLikes}
          />
        </View>
        <View style={{ width: 16 }} />
        <View style={styles.flex1}>
          <Text style={styles.label}>Comentários</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={comentarios}
            onChangeText={setComentarios}
          />
        </View>
      </View>

      <Text style={styles.label}>Imagem do Post (Opcional)</Text>
      <TouchableOpacity style={styles.imagePicker} onPress={escolherImagem}>
        {imagem ? (
          <Image source={{ uri: imagem }} style={styles.imagePreview} />
        ) : (
          <Text style={styles.imagePickerText}>📷 Tocar para escolher imagem</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.button} 
        onPress={submeter}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Prever Popularidade</Text>
        )}
      </TouchableOpacity>

      {resultado && (
        <View style={styles.resultsContainer}>
          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>Previsão do Modelo:</Text>
            <Text style={[
              styles.resultValue, 
              resultado.previsao?.toLowerCase().trim() === 'alta' ? {color: '#2e7d32'} : 
              resultado.previsao?.toLowerCase().trim() === 'baixa' ? {color: '#c62828'} : {color: '#f57c00'}
            ]}>
              {resultado.previsao ? resultado.previsao.charAt(0).toUpperCase() + resultado.previsao.slice(1).toLowerCase() : ''}
            </Text>
            
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{resultado.rostos}</Text>
                <Text style={styles.statLabel}>Rostos</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{resultado.brilho}</Text>
                <Text style={styles.statLabel}>Brilho</Text>
              </View>
            </View>
            <Text style={styles.iaInfo}>Motor Visual: {resultado.iaVisual || resultado.ia_visual}</Text>
          </View>

          {resultado.contexto_ia && (
            <View style={styles.likesCard}>
              <Text style={styles.cardSectionTitle}>📈 Análise de Contexto e Likes</Text>
              <Text style={styles.contextText}>{resultado.contexto_ia}</Text>
            </View>
          )}

          {resultado.sugestoes && Array.isArray(resultado.sugestoes) && resultado.sugestoes.length > 0 && (
            <View style={styles.sugestoesCard}>
              <Text style={styles.cardSectionTitle}>💡 Sugestões da IA</Text>
              {resultado.sugestoes.map((sug: string, idx: number) => (
                <View key={idx} style={styles.sugestaoItem}>
                  <Text style={styles.sugestaoBullet}>•</Text>
                  <Text style={styles.sugestaoText}>{sug}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
  },
  row: {
    flexDirection: 'row',
  },
  flex1: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  platformSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  platformButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  platformButtonActive: {
    backgroundColor: '#1a1a1a',
    borderColor: '#1a1a1a',
  },
  platformButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  platformButtonTextActive: {
    color: '#fff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  imagePicker: {
    height: 150,
    backgroundColor: '#f8f8f8',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    overflow: 'hidden',
  },
  imagePickerText: {
    color: '#888',
    fontSize: 16,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  button: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultsContainer: {
    marginTop: 30,
    gap: 16,
    marginBottom: 40,
  },
  resultCard: {
    padding: 24,
    backgroundColor: '#fff',
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  resultLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  resultValue: {
    fontSize: 36,
    fontWeight: '900',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 12,
    width: '100%',
  },
  statBox: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  iaInfo: {
    fontSize: 12,
    color: '#aaa',
    fontStyle: 'italic',
  },
  likesCard: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  contextText: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
    textAlign: 'center',
  },
  cardSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  likesValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#1a1a1a',
    marginVertical: 4,
  },
  likesSubtitle: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
  },
  sugestoesCard: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  sugestaoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  sugestaoBullet: {
    fontSize: 16,
    color: '#1a1a1a',
    marginRight: 8,
    lineHeight: 20,
  },
  sugestaoText: {
    fontSize: 14,
    color: '#444',
    flex: 1,
    lineHeight: 20,
  }
});
