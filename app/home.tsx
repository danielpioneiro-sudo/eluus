import { useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { auth, db } from '../firebaseConfig';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    verificarTipo();
  }, []);

  const verificarTipo = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        router.replace('/');
        return;
      }
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
      }
    } catch (e) {
      router.replace('/');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.txt}>Carregando...</Text>
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
  txt: {
    color: '#94a3b8',
    fontSize: 16,
  },
});