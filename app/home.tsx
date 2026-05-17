import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { auth, db } from '../firebaseConfig';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        console.log('[home] sem usuário autenticado, redirecionando para /');
        router.replace('/');
        return;
      }
      unsub(); // cancelar listener APÓS confirmar usuário autenticado
      console.log('[home] usuário autenticado:', user.uid);
      await verificarTipo(user.uid);
    });
    return unsub;
  }, []);

  const verificarTipo = async (uid: string) => {
    try {
      console.log('[home] verificando tipo do usuário:', uid);
      const userDoc = await getDoc(doc(db, 'usuarios', uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.pais && data.pais !== 'BR' && !data.phoneVerified) {
          router.replace({ pathname: '/verificar-telefone', params: { telefone: data.telefone || '' } });
          return;
        }
        if (data.tipo === 'motorista') {
          router.replace('/motorista');
        } else {
          router.replace('/passageiro');
        }
      } else {
        console.warn('[home] documento do usuário não encontrado, redirecionando para /');
        router.replace('/');
      }
    } catch (e) {
      console.error('[home] erro ao verificar tipo:', e);
      router.replace('/');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {loading && <ActivityIndicator size="large" color="#4a9eff" />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0f14',
    alignItems: 'center',
    justifyContent: 'center',
  },
});