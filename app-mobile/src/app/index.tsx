import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const router = useRouter();
  const { userName } = useAuth();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Olá, {userName || 'Utilizador'}!</Text>
      <Text style={styles.subtitle}>O que desejas prever hoje?</Text>

      <TouchableOpacity 
        style={styles.card} 
        activeOpacity={0.8}
        onPress={() => router.push('/noticias')}
      >
        <Text style={styles.cardEmoji}>📰</Text>
        <Text style={styles.cardTitle}>Notícia / Portal de Notícias</Text>
        <Text style={styles.cardDesc}>Prever popularidade baseada no título e contexto.</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.card} 
        activeOpacity={0.8}
        onPress={() => router.push('/social')}
      >
        <Text style={styles.cardEmoji}>📱</Text>
        <Text style={styles.cardTitle}>Post de uma Rede Social</Text>
        <Text style={styles.cardDesc}>Prever popularidade usando likes, seguidores e imagem.</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.card} 
        activeOpacity={0.8}
        onPress={() => router.push('/historico' as any)}
      >
        <Text style={styles.cardEmoji}>📊</Text>
        <Text style={styles.cardTitle}>Histórico de Previsões</Text>
        <Text style={styles.cardDesc}>Ver e gerir as suas previsões passadas e enviar feedback.</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    padding: 24,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  cardEmoji: {
    fontSize: 32,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});
