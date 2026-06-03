import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://10.0.2.2:7860';

interface PredictionItem {
  id: string;
  tipo: 'social' | 'noticias';
  data: string;
  // Social fields
  plataforma?: string;
  textoPost?: string;
  seguidores?: number;
  likes?: number;
  comentarios?: number;
  imagem?: string | null;
  // Noticias fields
  titulo?: string;
  descricao?: string;
  categoria?: string;
  
  previsao: string;
  feedbackEnviado?: boolean;
}

export default function Historico() {
  const [historico, setHistorico] = useState<PredictionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFeedback, setSelectedFeedback] = useState<{ [key: string]: 'Alta' | 'Médio' | 'Baixa' }>({});
  const [submittingFeedback, setSubmittingFeedback] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    carregarHistorico();
  }, []);

  const carregarHistorico = async () => {
    try {
      const dados = await AsyncStorage.getItem('historico_previsoes');
      if (dados) {
        setHistorico(JSON.parse(dados));
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Não foi possível carregar o histórico.');
    } finally {
      setLoading(false);
    }
  };

  const eliminarItem = async (id: string) => {
    Alert.alert(
      'Eliminar Previsão',
      'Tem a certeza que deseja eliminar esta previsão do histórico?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive',
          onPress: async () => {
            try {
              const novoHistorico = historico.filter(item => item.id !== id);
              setHistorico(novoHistorico);
              await AsyncStorage.setItem('historico_previsoes', JSON.stringify(novoHistorico));
            } catch (e) {
              console.error(e);
              Alert.alert('Erro', 'Não foi possível eliminar o item.');
            }
          }
        }
      ]
    );
  };

  const enviarFeedback = async (item: PredictionItem) => {
    const feedback = selectedFeedback[item.id];
    if (!feedback) {
      Alert.alert('Aviso', 'Por favor escolha uma popularidade (Alta, Médio ou Baixa).');
      return;
    }

    setSubmittingFeedback(prev => ({ ...prev, [item.id]: true }));

    try {
      const payload: any = {
        popularidade_real: feedback
      };

      if (item.tipo === 'noticias') {
        payload.titulo = item.titulo || '';
        payload.descricao = item.descricao || '';
        payload.categoria = item.categoria || 'geral';
      } else {
        payload.texto_post = item.textoPost || '';
        payload.seguidores = item.seguidores || 0;
      }

      const response = await fetch(`${API_URL}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const resData = await response.json();
      if (resData.sucesso) {
        Alert.alert('Sucesso', 'Feedback enviado com sucesso!');
        
        // Marcar no histórico local que o feedback foi enviado
        const novoHistorico = historico.map(h => {
          if (h.id === item.id) {
            return { ...h, feedbackEnviado: true };
          }
          return h;
        });
        setHistorico(novoHistorico);
        await AsyncStorage.setItem('historico_previsoes', JSON.stringify(novoHistorico));
      } else {
        Alert.alert('Erro', resData.erro || 'Erro ao enviar feedback para o servidor.');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Erro de Ligação', 'Não foi possível ligar ao servidor Flask.');
    } finally {
      setSubmittingFeedback(prev => ({ ...prev, [item.id]: false }));
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1a1a1a" />
      </View>
    );
  }

  if (historico.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>📊 Ainda não realizou nenhuma previsão.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {historico.map((item) => (
        <View key={item.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardType}>
              {item.tipo === 'social' ? `📱 Post de Redes Sociais` : `📰 Notícia / Website`}
            </Text>
            <View style={styles.headerRight}>
              <Text style={styles.cardDate}>{item.data}</Text>
              <TouchableOpacity onPress={() => eliminarItem(item.id)} style={styles.deleteButton}>
                <Text style={styles.deleteButtonText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.cardBody}>
            {item.tipo === 'social' ? (
              <>
                <Text style={styles.infoText} numberOfLines={2}>
                  <Text style={styles.infoLabel}>Texto: </Text>
                  {item.textoPost || <Text style={styles.italic}>Sem texto</Text>}
                </Text>
                <Text style={styles.infoText}>
                  <Text style={styles.infoLabel}>Plataforma: </Text>{item.plataforma}
                </Text>
                <Text style={styles.infoText}>
                  <Text style={styles.infoLabel}>Seguidores: </Text>{item.seguidores} |{' '}
                  <Text style={styles.infoLabel}>Likes: </Text>{item.likes} |{' '}
                  <Text style={styles.infoLabel}>Comentários: </Text>{item.comentarios}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.infoText} numberOfLines={2}>
                  <Text style={styles.infoLabel}>Título: </Text>{item.titulo}
                </Text>
                <Text style={styles.infoText} numberOfLines={2}>
                  <Text style={styles.infoLabel}>Descrição: </Text>{item.descricao}
                </Text>
                <Text style={styles.infoText}>
                  <Text style={styles.infoLabel}>Categoria: </Text>{item.categoria}
                </Text>
              </>
            )}

            <View style={styles.predictionRow}>
              <Text style={styles.predictionLabel}>Previsão Obtida:</Text>
              <Text style={[
                styles.predictionValue,
                item.previsao === 'Alta' ? { color: '#2e7d32' } : item.previsao === 'Baixa' ? { color: '#c62828' } : { color: '#f57c00' }
              ]}>
                {item.previsao}
              </Text>
            </View>

            <View style={styles.separator} />

            {item.feedbackEnviado ? (
              <View style={styles.feedbackSuccessBox}>
                <Text style={styles.feedbackSuccessText}>✓ Feedback submetido à Base de Dados!</Text>
              </View>
            ) : (
              <View style={styles.feedbackSection}>
                <Text style={styles.feedbackQuestion}>Esta previsão parece correta?</Text>
                <Text style={styles.feedbackSubtitle}>Ajuda a melhorar o modelo indicando a popularidade que esperas</Text>
                
                <View style={styles.feedbackSelector}>
                  {(['Alta', 'Médio', 'Baixa'] as const).map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[
                        styles.feedbackOptButton,
                        selectedFeedback[item.id] === opt && styles.feedbackOptButtonActive
                      ]}
                      onPress={() => setSelectedFeedback(prev => ({ ...prev, [item.id]: opt }))}
                    >
                      <Text style={[
                        styles.feedbackOptText,
                        selectedFeedback[item.id] === opt && styles.feedbackOptTextActive
                      ]}>
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={styles.submitFeedbackButton}
                  onPress={() => enviarFeedback(item)}
                  disabled={submittingFeedback[item.id]}
                >
                  {submittingFeedback[item.id] ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.submitFeedbackText}>Submeter Feedback</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    flexGrow: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#eef0f2',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardType: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardDate: {
    fontSize: 11,
    color: '#888',
  },
  deleteButton: {
    padding: 4,
  },
  deleteButtonText: {
    fontSize: 16,
  },
  cardBody: {
    gap: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#444',
    lineHeight: 18,
  },
  infoLabel: {
    fontWeight: '600',
    color: '#222',
  },
  italic: {
    fontStyle: 'italic',
    color: '#888',
  },
  predictionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  predictionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
  },
  predictionValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  separator: {
    height: 1,
    backgroundColor: '#eef0f2',
    marginVertical: 12,
  },
  feedbackSection: {
    gap: 6,
  },
  feedbackQuestion: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  feedbackSubtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  feedbackSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  feedbackOptButton: {
    flex: 1,
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  feedbackOptButtonActive: {
    backgroundColor: '#1a1a1a',
    borderColor: '#1a1a1a',
  },
  feedbackOptText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  feedbackOptTextActive: {
    color: '#fff',
  },
  submitFeedbackButton: {
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 4,
  },
  submitFeedbackText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  feedbackSuccessBox: {
    backgroundColor: '#e8f5e9',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  feedbackSuccessText: {
    color: '#2e7d32',
    fontWeight: '600',
    fontSize: 13,
  }
});
