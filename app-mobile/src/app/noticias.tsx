import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 10.0.2.2 é o localhost do teu computador a partir do simulador Android
const API_URL = 'http://10.0.2.2:7860';

export default function Noticias() {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('geral');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  const submeter = async () => {
    if (!titulo || !descricao) {
      Alert.alert('Erro', 'Por favor preenche o título e a descrição.');
      return;
    }

    setLoading(true);
    setResultado(null);

    try {
      const response = await fetch(`${API_URL}/prever`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          titulo,
          descricao,
          categoria
        }),
      });

      const data = await response.json();
      
      if (data.sucesso) {
        setResultado(data.previsao);
        
        // Salvar no histórico de previsões
        try {
          const novoItem = {
            id: Date.now().toString(),
            tipo: 'noticias',
            data: new Date().toLocaleString('pt-PT'),
            titulo,
            descricao,
            categoria,
            previsao: data.previsao
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
      <Text style={styles.label}>Título da Notícia</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: O novo avanço da Inteligência Artificial"
        value={titulo}
        onChangeText={setTitulo}
      />

      <Text style={styles.label}>Descrição (Resumo)</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Escreve um pequeno resumo da notícia..."
        multiline
        numberOfLines={4}
        value={descricao}
        onChangeText={setDescricao}
      />

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
        <View style={styles.resultCard}>
          <Text style={styles.resultLabel}>Previsão do Modelo:</Text>
          <Text style={[
            styles.resultValue, 
            resultado === 'Alta' ? {color: '#2e7d32'} : resultado === 'Baixa' ? {color: '#c62828'} : {color: '#f57c00'}
          ]}>
            {resultado}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    marginBottom: 20,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultCard: {
    marginTop: 30,
    padding: 24,
    backgroundColor: '#fff',
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
  },
  resultLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  resultValue: {
    fontSize: 32,
    fontWeight: '900',
  }
});
