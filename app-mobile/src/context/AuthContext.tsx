import React, { createContext, useState, useEffect, useContext } from 'react';
import * as SecureStore from 'expo-secure-store';

interface AuthContextType {
  userToken: string | null;
  userName: string | null;
  userEmail: string | null;
  isGuest: boolean;
  isLoading: boolean;
  login: (token: string, name: string, email: string) => Promise<void>;
  logout: () => Promise<void>;
  loginAsGuest: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userToken, setUserToken] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Carregar o token, nome e email guardados ao arrancar a app
  useEffect(() => {
    async function loadAuthData() {
      try {
        const token = await SecureStore.getItemAsync('userToken');
        const name = await SecureStore.getItemAsync('userName');
        const email = await SecureStore.getItemAsync('userEmail');
        if (token) {
          setUserToken(token);
        }
        if (name) {
          setUserName(name);
        }
        if (email) {
          setUserEmail(email);
        }
      } catch (error) {
        console.error('Erro ao ler os dados de autenticação:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadAuthData();
  }, []);

  const login = async (token: string, name: string, email: string) => {
    try {
      await SecureStore.setItemAsync('userToken', token);
      await SecureStore.setItemAsync('userName', name);
      await SecureStore.setItemAsync('userEmail', email);
      setUserToken(token);
      setUserName(name);
      setUserEmail(email);
      setIsGuest(false); // Reset guest state on active login
    } catch (error) {
      console.error('Erro ao guardar os dados de autenticação:', error);
    }
  };

  const logout = async () => {
    try {
      await SecureStore.deleteItemAsync('userToken');
      await SecureStore.deleteItemAsync('userName');
      await SecureStore.deleteItemAsync('userEmail');
      setUserToken(null);
      setUserName(null);
      setUserEmail(null);
      setIsGuest(false); // Reset guest state on logout so layout guard works
    } catch (error) {
      console.error('Erro ao eliminar os dados de autenticação:', error);
    }
  };

  const loginAsGuest = () => {
    setIsGuest(true);
  };

  return (
    <AuthContext.Provider value={{ userToken, userName, userEmail, isGuest, isLoading, login, logout, loginAsGuest }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
