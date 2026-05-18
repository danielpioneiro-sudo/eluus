import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { auth } from '../firebaseConfig';
import { navegarDashboard } from '../utils/navegarDashboard';

export default function Login() {
  const router = useRouter();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);

  const entrar = async () => {
    if (!email || !senha) {
      Alert.alert('Atenção', 'Preencha todos os campos');
      return;
    }
    setLoading(true);
    try {
      console.log('[login] iniciando signIn para:', email.trim().toLowerCase());
      const credential = await signInWithEmailAndPassword(auth, email.trim(), senha);
      console.log('[login] signIn OK, consultando dashboard para:', credential.user.uid);
      await navegarDashboard(credential.user.uid, router);
    } catch (e: any) {
      console.error('[login] signIn error:', e.code, e.message);
      Alert.alert('Erro', 'E-mail ou senha incorretos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Image
        source={require('../assets/images/logo-completa.png')}
        style={styles.logo}
        resizeMode="contain"
      />

      <TextInput
        style={styles.input}
        placeholder={t('login.emailPlaceholder')}
        placeholderTextColor="#4a5568"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder={t('login.passwordPlaceholder')}
        placeholderTextColor="#4a5568"
        value={senha}
        onChangeText={setSenha}
        secureTextEntry
      />

      <TouchableOpacity style={styles.btn} onPress={entrar} disabled={loading}>
        <Text style={styles.btntxt}>{loading ? t('login.loggingIn') : t('login.loginBtn')}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/recuperar-senha')} style={styles.esqueceuBtn}>
        <Text style={styles.esqueceuTxt}>{t('login.forgotPassword')}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/cadastro')}>
        <Text style={styles.link}>{t('login.noAccount')}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/admin')} style={styles.adminLink}>
        <Text style={styles.adminLinkTxt}>·</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0f14',
    padding: 32,
    paddingTop: 80,
  },
  logo: {
    width: '100%',
    height: 100,
    marginBottom: 48,
  },
  input: {
    backgroundColor: '#1a1f2e',
    borderRadius: 14,
    padding: 16,
    color: '#fff',
    fontSize: 15,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#2a3044',
  },
  btn: {
    backgroundColor: '#4a9eff',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  btntxt: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  esqueceuBtn: {
    marginTop: 16,
    alignItems: 'center',
  },
  esqueceuTxt: {
    color: '#64748b',
    fontSize: 14,
  },
  link: {
    color: '#4a9eff',
    textAlign: 'center',
    marginTop: 24,
    fontSize: 15,
  },
  adminLink: { position: 'absolute', bottom: 20, right: 24 },
  adminLinkTxt: { color: '#0d0f14', fontSize: 28, fontWeight: 'bold' },
});
