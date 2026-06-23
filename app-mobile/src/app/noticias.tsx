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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dataPublicacao, setDataPublicacao] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<PrevisaoResultado | null>(null);

  const opcoesCategoria = [
    { label: 'Nacional / País', value: 'pais' },
    { label: 'Política', value: 'politica' },
    { label: 'Economia', value: 'economia' },
    { label: 'Cultura', value: 'cultura' },
    { label: 'Desporto', value: 'desporto' },
    { label: 'Geral', value: 'geral' },
  ];

  const obterLabelCategoria = (val: string) => {
    const found = opcoesCategoria.find(o => o.value === val);
    return found ? found.label : 'Geral';
  };


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
    const selectedDate = date || (event instanceof Date ? event : (event?.nativeEvent?.timestamp ? new Date(event.nativeEvent.timestamp) : undefined));
    if (selectedDate) {
      const updated = new Date(dataPublicacao);
      updated.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      setDataPublicacao(updated);
    }
  };

  const handleTimeChange = (event: any, date?: Date) => {
    setShowTimePicker(false);
    const selectedDate = date || (event instanceof Date ? event : (event?.nativeEvent?.timestamp ? new Date(event.nativeEvent.timestamp) : undefined));
    if (selectedDate) {
      const updated = new Date(dataPublicacao);
      updated.setHours(selectedDate.getHours(), selectedDate.getMinutes());
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
            detalhe: `Categoria: ${obterLabelCategoria(categoria)}`,
            previsao_ia: data.previsao,
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

      <View style={styles.editorialCard}>
        <Text style={styles.sectionTitle}>Contexto Editorial</Text>
        
        <Text style={styles.fieldLabel}>CATEGORIA</Text>
        <View style={styles.dropdownContainer}>
          <TouchableOpacity 
            style={[styles.dropdownHeader, dropdownOpen && styles.dropdownHeaderActive]} 
            onPress={() => setDropdownOpen(!dropdownOpen)}
            activeOpacity={0.8}
          >
            <Text style={styles.dropdownHeaderText}>{obterLabelCategoria(categoria)}</Text>
            <Text style={styles.dropdownChevron}>{dropdownOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          
          {dropdownOpen && (
            <View style={styles.dropdownList}>
              {opcoesCategoria.map((opcao) => (
                <TouchableOpacity
                  key={opcao.value}
                  style={[
                    styles.dropdownItem,
                    categoria === opcao.value && styles.dropdownItemActive
                  ]}
                  onPress={() => {
                    setCategoria(opcao.value);
                    setDropdownOpen(false);
                  }}
                >
                  <Text style={[
                    styles.dropdownItemText,
                    categoria === opcao.value && styles.dropdownItemTextActive
                  ]}>
                    {opcao.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.row}>
          <View style={styles.flex1}>
            <Text style={styles.fieldLabel}>DATA</Text>
            <TouchableOpacity 
              style={styles.pickerButton} 
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.pickerButtonText}>📅 {formatarData(dataPublicacao)}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ width: 12 }} />
          <View style={styles.flex1}>
            <Text style={styles.fieldLabel}>HORA</Text>
            <TouchableOpacity 
              style={styles.pickerButton} 
              onPress={() => setShowTimePicker(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.pickerButtonText}>⏰ {formatarHora(dataPublicacao)}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={dataPublicacao}
          mode="date"
          display="default"
          onValueChange={handleDateChange}
          onDismiss={() => setShowDatePicker(false)}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={dataPublicacao}
          mode="time"
          display="default"
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
              (resultado.previsao || '').toLowerCase().trim() === 'alta' ? {color: '#2e7d32'} : 
              (resultado.previsao || '').toLowerCase().trim() === 'baixa' ? {color: '#c62828'} : {color: '#f57c00'}
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
  editorialCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  dropdownContainer: {
    marginBottom: 16,
    position: 'relative',
    zIndex: 10,
  },
  dropdownHeader: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownHeaderActive: {
    borderColor: '#1a1a1a',
    borderWidth: 1.5,
  },
  dropdownHeaderText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  dropdownChevron: {
    fontSize: 12,
    color: '#666',
  },
  dropdownList: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 250,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  dropdownItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  dropdownItemActive: {
    backgroundColor: '#1a1a1a',
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#333',
  },
  dropdownItemTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
  },
  flex1: {
    flex: 1,
  },
  pickerButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 14,
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
