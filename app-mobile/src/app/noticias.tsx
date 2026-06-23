import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';

// 10.0.2.2 é o localhost do teu computador a partir do simulador Android
const API_URL = 'https://tthheodor-previsao-popularidade.hf.space';

interface PrevisaoResultado {
  previsao: string;
  sugestoes?: string;
}

export default function Noticias() {
  const { userToken } = useAuth();
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('geral');
  const [diaSemana, setDiaSemana] = useState<number>(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
  const [hora, setHora] = useState<string>(new Date().getHours().toString());
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<PrevisaoResultado | null>(null);

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
          'Authorization': `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          titulo,
          descricao,
          categoria,
          dia_semana: diaSemana,
          hora: parseInt(hora) || 0
        }),
      });

      const data = await response.json();
      
      if (data.sucesso) {
        setResultado({
          previsao: data.previsao,
          sugestoes: data.sugestoes
        });
        
        // Salvar no histórico de previsões
        try {
          const novoItem = {
            id: Date.now().toString(),
            tipo: 'noticias',
            data: new Date().toLocaleString('pt-PT'),
            titulo,
            descricao,
            categoria,
            previsao: data.previsao,
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

      <Text style={styles.label}>Dia da Semana de Publicação</Text>
      <View style={styles.daysSelector}>
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d, index) => (
          <TouchableOpacity
            key={d}
            style={[
              styles.dayButton,
              diaSemana === index && styles.dayButtonActive
            ]}
            onPress={() => setDiaSemana(index)}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.dayButtonText,
              diaSemana === index && styles.dayButtonTextActive
            ]}>
              {d}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Hora de Publicação (0-23)</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        maxLength={2}
        value={hora}
        onChangeText={(text) => {
          const val = parseInt(text);
          if (text === '' || (val >= 0 && val <= 23)) {
            setHora(text);
          }
        }}
        placeholder="Ex: 14"
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
        <View style={styles.resultsContainer}>
          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>Previsão de Popularidade:</Text>
            <Text style={[
              styles.resultValue, 
              resultado.previsao === 'Alta' ? {color: '#2e7d32'} : resultado.previsao === 'Baixa' ? {color: '#c62828'} : {color: '#f57c00'}
            ]}>
              {resultado.previsao}
            </Text>
          </View>

          {resultado.sugestoes && (
            <View style={styles.sugestoesCard}>
              <Text style={styles.cardSectionTitle}>💡 Sugestões da IA</Text>
              <Text style={styles.sugestaoText}>{resultado.sugestoes}</Text>
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
  },
  resultLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  resultValue: {
    fontSize: 32,
    fontWeight: '900',
  },
  likesCard: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
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
  },
  daysSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 6,
  },
  dayButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  dayButtonActive: {
    backgroundColor: '#1a1a1a',
    borderColor: '#1a1a1a',
  },
  dayButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  dayButtonTextActive: {
    color: '#fff',
  },
});
