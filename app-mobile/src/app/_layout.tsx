import 'react-native-gesture-handler';
import { useEffect, useState, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, TouchableOpacity, Text, Animated, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Impedir que o ecrã de boot nativo desapareça automaticamente
SplashScreen.preventAutoHideAsync().catch(() => {});

function AnimatedSplashScreen({ children }: { children: React.ReactNode }) {
  const [animationFinished, setAnimationFinished] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current; // Opacidade do logotipo
  const scaleAnim = useRef(new Animated.Value(0.85)).current; // Escala do logotipo
  const containerFadeAnim = useRef(new Animated.Value(1)).current; // Opacidade do ecrã completo

  useEffect(() => {
    // Iniciar a sequência de animação
    Animated.sequence([
      // 1. Fade-in e Scale-up do logotipo
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1.1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
      // 2. Breve pausa para apreciação do logotipo minimalista
      Animated.delay(500),
      // 3. Fade-out suave do logotipo e do ecrã
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(containerFadeAnim, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    ]).start(async () => {
      // Quando a animação terminar, esconde a splash nativa e desmonta o overlay
      try {
        await SplashScreen.hideAsync();
      } catch (e) {
        // Silenciar erro caso já tenha sido ocultado
      }
      setAnimationFinished(true);
    });
  }, []);

  if (animationFinished) {
    return <>{children}</>;
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Renderiza a app em background para estar montada e pronta */}
      {children}
      
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: '#1A202C', // Cor idêntica à splash nativa do app.json para transição fluida
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 99999,
            opacity: containerFadeAnim,
          },
        ]}
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 84, marginBottom: 20 }}>📰</Text>
          <Text
            style={{
              color: '#ffffff',
              fontSize: 24,
              fontWeight: '900',
              letterSpacing: 6,
              textTransform: 'uppercase',
            }}
          >
            Previsão
          </Text>
          <Text
            style={{
              color: '#a0aec0',
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 3,
              marginTop: 8,
              textTransform: 'uppercase',
            }}
          >
            Popularidade de Notícias
          </Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

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
        <AnimatedSplashScreen>
          <RootLayoutNav />
        </AnimatedSplashScreen>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

