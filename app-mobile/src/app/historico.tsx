import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../context/AuthContext';

const API_URL = 'https://tthheodor-previsao-popularidade.hf.space';

interface PredictionItem {
  id: string;
  tipo: 'social' | 'noticias';
  titulo: string;
  detalhe: string;
  feedback?: string | null;
  data: string;
  previsao_ia: string;
}

export default function Historico() {
  const { userToken, logout } = useAuth();
  const router = useRouter();
  const [historico, setHistorico] = useState<PredictionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFeedback, setSelectedFeedback] = useState<{ [key: string]: 'Alta' | 'Médio' | 'Baixa' }>({});
  const [submittingFeedback, setSubmittingFeedback] = useState<{ [key: string]: boolean }>({});

  useFocusEffect(
    useCallback(() => {
      if (userToken) {
        carregarHistorico();
      }
    }, [userToken])
  );

  if (!userToken) {
    return (
      <View style={styles.guestContainer}>
        <Text style={styles.guestEmoji}>📊</Text>
        <Text style={styles.guestTitle}>Histórico de Previsões</Text>
        <Text style={styles.guestText}>
          Para poder guardar as suas previsões na nuvem e consultar o seu histórico a partir de qualquer dispositivo, precisa de criar uma conta ou iniciar sessão.
        </Text>
        <TouchableOpacity 
          style={styles.primaryButton}
          onPress={() => router.push('/login' as any)}
        >
          <Text style={styles.primaryButtonText}>Iniciar Sessão</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.secondaryButton}
          onPress={() => router.push('/register' as any)}
        >
          <Text style={styles.secondaryButtonText}>Criar uma Conta</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const carregarHistorico = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/historico`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok && data.historico) {
        // Mapear dados retornados do servidor
        const fetchedHistory = data.historico.map((item: any, index: number) => ({
          ...item,
          id: item.id || `hist-${index}-${Date.parse(item.data) || index}`,
        }));
        setHistorico(fetchedHistory);
      } else {
        if (response.status === 401 || data.erro === 'Token inválido ou expirado!' || data.erro === 'Token em falta!') {
          Alert.alert('Sessão Expirada', 'A sua sessão expirou ou é inválida. Por favor, inicie sessão novamente.');
          await logout();
        } else {
          Alert.alert('Erro', data.erro || 'Erro ao obter histórico do servidor.');
        }
      }
    } catch (e) {
      console.error(e);
      Alert.alert(
        'Erro de Ligação',
        'Não foi possível ligar ao servidor para obter o histórico. Pretende carregar o histórico local em cache?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { 
            text: 'Histórico Local', 
            onPress: async () => {
              const dados = await AsyncStorage.getItem('historico_previsoes');
              if (dados) {
                setHistorico(JSON.parse(dados));
              }
            } 
          }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const enviarFeedback = async (item: PredictionItem) => {
    const feedback = selectedFeedback[item.id];
    if (!feedback) {
      Alert.alert('Aviso', 'Por favor escolha uma popularidade (Alta, Médio ou Baixa).');
      return;
    }

    setSubmittingFeedback(prev => ({ ...prev, [item.id]: true }));

    try {
      const payload = {
        id: item.id,
        tipo: item.tipo,
        titulo: item.titulo,
        detalhe: item.detalhe,
        popularidade_real: feedback
      };

      const response = await fetch(`${API_URL}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`,
        },
        body: JSON.stringify(payload),
      });

      const resData = await response.json();
      if (resData.sucesso) {
        Alert.alert('Sucesso', 'Feedback enviado com sucesso!');
        
        // Atualizar feedback no estado
        const novoHistorico = historico.map(h => {
          if (h.id === item.id) {
            return { ...h, feedback: feedback };
          }
          return h;
        });
        setHistorico(novoHistorico);
        await AsyncStorage.setItem('historico_previsoes', JSON.stringify(novoHistorico));
      } else {
        if (response.status === 401 || resData.erro === 'Token inválido ou expirado!') {
          Alert.alert('Sessão Expirada', 'A sua sessão expirou. Por favor, inicie sessão novamente.');
          await logout();
        } else {
          Alert.alert('Erro', resData.erro || 'Erro ao enviar feedback para o servidor.');
        }
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Erro de Ligação', 'Não foi possível ligar ao servidor.');
    } finally {
      setSubmittingFeedback(prev => ({ ...prev, [item.id]: false }));
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1a1a1a" />
        <Text style={styles.loadingText}>A carregar o seu histórico...</Text>
      </View>
    );
  }

  if (!historico || historico.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>📊 Ainda não tem nenhuma previsão registada.</Text>
      </View>
    );
  }

  const renderItem = ({ item }: { item: PredictionItem }) => {
    const borderLeftColor = 
      item.previsao_ia?.toLowerCase().trim() === 'alta' ? '#2e7d32' : 
      item.previsao_ia?.toLowerCase().trim() === 'baixa' ? '#c62828' : '#f57c00';

    return (
      <View style={[styles.card, { borderLeftColor }]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIconTitle}>
            <Text style={styles.cardEmoji}>
              {item.tipo === 'social' ? '📱' : '📰'}
            </Text>
            <Text style={styles.cardType}>
              {item.tipo === 'social' ? 'Rede Social' : 'Notícia / Website'}
            </Text>
          </View>
          <Text style={styles.cardDate}>{item.data}</Text>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.infoTitle} numberOfLines={2}>
            {item.titulo}
          </Text>
          <Text style={styles.infoDetail} numberOfLines={3}>
            {item.detalhe}
          </Text>

          <View style={styles.predictionRow}>
            <Text style={styles.predictionLabel}>Previsão IA:</Text>
            <Text style={[
              styles.predictionValue,
              item.previsao_ia?.toLowerCase().trim() === 'alta' ? { color: '#2e7d32' } : 
              item.previsao_ia?.toLowerCase().trim() === 'baixa' ? { color: '#c62828' } : { color: '#f57c00' }
            ]}>
              {item.previsao_ia ? item.previsao_ia.charAt(0).toUpperCase() + item.previsao_ia.slice(1).toLowerCase() : ''}
            </Text>
          </View>

          <View style={styles.separator} />

          {item.feedback ? (
            <View style={styles.feedbackSuccessBox}>
              <Text style={styles.feedbackSuccessText}>
                ✓ Feedback enviado: Popularidade {item.feedback}
              </Text>
            </View>
          ) : (
            <View style={styles.feedbackSection}>
              <Text style={styles.feedbackQuestion}>Esta previsão foi correta?</Text>
              
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
                  <Text style={styles.submitFeedbackText}>Enviar Feedback</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <FlatList
      data={historico}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      contentContainerStyle={styles.container}
      ListHeaderComponent={<Text style={styles.title}>Atividade Recente</Text>}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    flexGrow: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 15,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 16,
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
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#eee',
    borderLeftWidth: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardIconTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardEmoji: {
    fontSize: 18,
  },
  cardType: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  cardDate: {
    fontSize: 11,
    color: '#888',
  },
  cardBody: {
    gap: 6,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    lineHeight: 20,
  },
  infoDetail: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 4,
  },
  predictionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  predictionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
  },
  predictionValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 10,
  },
  feedbackSection: {
    gap: 6,
  },
  feedbackQuestion: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  feedbackSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
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
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  feedbackOptTextActive: {
    color: '#fff',
  },
  submitFeedbackButton: {
    backgroundColor: '#1a1a1a',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
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
    fontSize: 12,
  },
  guestContainer: {
    flex: 1,
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  guestEmoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  guestTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 12,
    textAlign: 'center',
  },
  guestText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 12,
  },
  primaryButton: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#1a1a1a',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
