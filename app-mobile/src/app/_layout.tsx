import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function Layout() {
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
        <Stack.Screen name="index" options={{ title: 'Previsão de Popularidade' }} />
        <Stack.Screen name="noticias" options={{ title: 'Prever Notícia' }} />
        <Stack.Screen name="social" options={{ title: 'Prever post de uma rede social' }} />
        <Stack.Screen name="historico" options={{ title: 'Histórico de Previsões' }} />
      </Stack>
    </>
  );
}
