import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';
import { initI18n } from '../i18n';
import { auth, db, functions } from '../firebaseConfig';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

const CODIGO_PENDENTE_KEY = '@eluus_codigo_pendente';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [i18nReady, setI18nReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    initI18n().then(() => setI18nReady(true));
  }, []);

  useEffect(() => {
    const handleURL = async (url: string) => {
      // PayPal: retorno após aprovação
      if (url.startsWith('eluus://payment/success')) {
        const token = url.split('token=')[1]?.split('&')[0];
        if (!token || !auth.currentUser) return;
        try {
          const capturar = httpsCallable(functions, 'capturarPedidoPayPal');
          await capturar({ orderId: token });
        } catch (e) {
          console.error('[PayPal] Erro ao capturar:', e);
        }
        return;
      }

      // QR code do motorista: eluus://cadastro?codigo=XXXXXX
      const codigoMatch = url.match(/[?&]codigo=([A-Z0-9]+)/i);
      if (codigoMatch) {
        const codigo = codigoMatch[1].toUpperCase();
        await AsyncStorage.setItem(CODIGO_PENDENTE_KEY, codigo);
        if (!auth.currentUser) return;
        try {
          const userDoc = await getDoc(doc(db, 'usuarios', auth.currentUser.uid));
          if (userDoc.exists() && userDoc.data().tipo === 'passageiro') {
            router.replace('/passageiro');
          }
        } catch (e) {
          console.error('[QR] Erro ao verificar tipo:', e);
        }
        return;
      }
    };

    const sub = Linking.addEventListener('url', ({ url }) => handleURL(url));
    Linking.getInitialURL().then(url => { if (url) handleURL(url); });

    return () => sub.remove();
  }, []);

  if (!i18nReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0d0f14', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#4a9eff" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false, headerBackTitle: '' }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
