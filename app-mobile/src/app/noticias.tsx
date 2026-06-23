import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../context/AuthContext';

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
  const [dataPublicacao, setDataPublicacao] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<PrevisaoResultado | null>(null);

  // Estados para feedback manual
  const [mostrarFeedback, setMostrarFeedback] = useState(false);
  const [feedbackEnviado, setFeedbackEnviado] = useState(false);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const formatarData = (date: Date) => {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const formatarHora = (date: Date) => {
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${min}`;
  };

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      const updated = new Date(dataPublicacao);
      updated.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
      setDataPublicacao(updated);
    }
  };

  const handleTimeChange = (event: any, date?: Date) => {
    setShowTimePicker(false);
    if (date) {
      const updated = new Date(dataPublicacao);
      updated.setHours(date.getHours(), date.getMinutes());
      setDataPublicacao(updated);
    }
  };

  const submeter = async () => {
    if (!titulo || !descricao) {
      Alert.alert('Erro', 'Por favor preenche o título e a descrição.');
      return;
    }

    setLoading(true);
    setResultado(null);
    setMostrarFeedback(false);
    setFeedbackEnviado(false);

    try {
      // 1. Criar o FormData para a previsão de notícias
      const formData = new FormData();
      formData.append('titulo', titulo);
      formData.append('descricao', descricao);
      formData.append('categoria', categoria);

      console.log('Enviando pedido de previsão para /prever...');
      const response = await fetch(`${API_URL}/prever`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`,
        },
        body: formData,
      });

      const data = await response.json();
      console.log('Resposta de /prever recebida:', data);
      
      if (data.sucesso) {
        setResultado({
          previsao: data.previsao,
          sugestoes: data.sugestoes
        });
        setMostrarFeedback(true);

        // 3. Salvar no histórico de previsões local
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
          console.error("Erro ao guardar no histórico local:", e);
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

  const enviarFeedback = async (popularidadeReal: 'Alta' | 'Média' | 'Baixa') => {
    setSubmittingFeedback(true);
    try {
      const feedbackPayload = {
        titulo: titulo,
        descricao: descricao,
        categoria: categoria,
        popularidade_real: popularidadeReal,
        previsao_ia: resultado?.previsao || ''
      };

      console.log('Enviando feedback manual para /feedback...', feedbackPayload);
      const feedbackResponse = await fetch(`${API_URL}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`,
        },
        body: JSON.stringify(feedbackPayload),
      });

      const feedbackData = await feedbackResponse.json();
      console.log('Resposta de /feedback recebida:', feedbackData);
      
      if (feedbackData.sucesso) {
        setFeedbackEnviado(true);
        Alert.alert('Sucesso', 'Feedback registado com sucesso!');
      } else {
        Alert.alert('Erro', feedbackData.erro || 'Erro ao enviar feedback para o servidor.');
      }
    } catch (fbError) {
      console.error('Erro ao registar feedback manual no servidor:', fbError);
      Alert.alert('Erro de Ligação', 'Não foi possível ligar ao servidor para submeter o feedback.');
    } finally {
      setSubmittingFeedback(false);
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

      <Text style={styles.label}>Data e Hora de Publicação</Text>
      <View style={styles.pickerRow}>
        <TouchableOpacity 
          style={styles.pickerButton} 
          onPress={() => setShowDatePicker(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.pickerButtonText}>📅 {formatarData(dataPublicacao)}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.pickerButton} 
          onPress={() => setShowTimePicker(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.pickerButtonText}>⏰ {formatarHora(dataPublicacao)}</Text>
        </TouchableOpacity>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={dataPublicacao}
          mode="date"
          display="default"
          onChange={handleDateChange}
          onValueChange={handleDateChange}
          onDismiss={() => setShowDatePicker(false)}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={dataPublicacao}
          mode="time"
          display="default"
          onChange={handleTimeChange}
          onValueChange={handleTimeChange}
          onDismiss={() => setShowTimePicker(false)}
        />
      )}

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
              resultado.previsao?.toLowerCase().trim() === 'alta' ? {color: '#2e7d32'} : 
              resultado.previsao?.toLowerCase().trim() === 'baixa' ? {color: '#c62828'} : {color: '#f57c00'}
            ]}>
              {resultado.previsao ? resultado.previsao.charAt(0).toUpperCase() + resultado.previsao.slice(1).toLowerCase() : ''}
            </Text>
          </View>

          {resultado.sugestoes && (
            <View style={styles.sugestoesCard}>
              <Text style={styles.cardSectionTitle}>💡 Sugestões da IA</Text>
              <Text style={styles.sugestaoText}>{resultado.sugestoes}</Text>
            </View>
          )}

          {mostrarFeedback && (
            <View style={styles.feedbackContainer}>
              <Text style={styles.feedbackTitle}>Qual foi a popularidade real da notícia?</Text>
              {feedbackEnviado ? (
                <Text style={styles.feedbackSuccessText}>✓ Feedback registado com sucesso!</Text>
              ) : (
                <View style={styles.feedbackButtonRow}>
                  {(['Alta', 'Média', 'Baixa'] as const).map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={styles.feedbackOptButton}
                      onPress={() => enviarFeedback(opt)}
                      disabled={submittingFeedback}
                    >
                      <Text style={styles.feedbackOptButtonText}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
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
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  pickerButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerButtonText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '600',
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
  cardSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  sugestoesCard: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  sugestaoText: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  feedbackContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#eee',
    alignItems: 'center',
  },
  feedbackTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  feedbackButtonRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  feedbackOptButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    alignItems: 'center',
  },
  feedbackOptButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  feedbackSuccessText: {
    color: '#2e7d32',
    fontWeight: 'bold',
    fontSize: 15,
    textAlign: 'center',
  },
});
