import 'react-native-gesture-handler';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, TouchableOpacity, Text } from 'react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

function RootLayoutNav() {
  const { userToken, isGuest, isLoading, logout } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    // Verificar se o utilizador está nos ecrãs de autenticação
    const routeSegments = segments as unknown as string[];
    const inAuthGroup = routeSegments[0] === 'login' || routeSegments[0] === 'register';

    if (!userToken && !isGuest && !inAuthGroup) {
      // Redireciona para o Login se não estiver autenticado
      router.replace('/login' as any);
    } else if (userToken && inAuthGroup) {
      // Redireciona para o Home se já estiver autenticado e tentar aceder a login/register
      router.replace('/' as any);
    }
  }, [userToken, isGuest, isLoading, segments]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
        <ActivityIndicator size="large" color="#1a1a1a" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#ffffff',
          },
          headerTintColor: '#000000',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          contentStyle: {
            backgroundColor: '#f5f5f5',
          },
        }}
      >
        <Stack.Screen 
          name="index" 
          options={{ 
            title: 'Previsão de Popularidade',
            headerRight: () => (
              userToken ? (
                <TouchableOpacity onPress={() => logout()} style={{ padding: 8 }}>
                  <Text style={{ color: '#c62828', fontWeight: '600', fontSize: 15 }}>Sair</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => router.push('/login' as any)} style={{ padding: 8 }}>
                  <Text style={{ color: '#007afd', fontWeight: '600', fontSize: 15 }}>Entrar</Text>
                </TouchableOpacity>
              )
            )
          }} 
        />
        <Stack.Screen name="noticias" options={{ title: 'Prever Notícia / Portal de Notícias' }} />
        <Stack.Screen name="social" options={{ title: 'Prever post de uma rede social' }} />
        <Stack.Screen name="historico" options={{ title: 'Histórico de Previsões' }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

