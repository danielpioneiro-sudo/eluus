import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
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
  View,
} from 'react-native';
import { auth, db } from '../firebaseConfig';

WebBrowser.maybeCompleteAuthSession();

export default function Login() {
  const router = useRouter();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      handleSocialCredential(credential);
    }
  }, [response]);

  const handleSocialCredential = async (credential: any) => {
    setLoading(true);
    try {
      const userCredential = await signInWithCredential(auth, credential);
      const uid = userCredential.user.uid;
      const snap = await getDoc(doc(db, 'usuarios', uid));
      if (snap.exists()) {
        router.replace('/home');
      } else {
        const u = userCredential.user;
        router.replace({
          pathname: '/completar-cadastro',
          params: {
            nome: u.displayName || '',
            email: u.email || '',
          },
        });
      }
    } catch (e: any) {
      Alert.alert('Erro', 'Falha no login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      const appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const provider = new OAuthProvider('apple.com');
      const credential = provider.credential({
        idToken: appleCredential.identityToken!,
      });
      const fullName = appleCredential.fullName;
      const nome = [fullName?.givenName, fullName?.familyName].filter(Boolean).join(' ');
      // displayName not set by Apple provider automatically — pass name via params
      const userCred = await signInWithCredential(auth, credential);
      const snap = await getDoc(doc(db, 'usuarios', userCred.user.uid));
      if (snap.exists()) {
        router.replace('/home');
      } else {
        router.replace({
          pathname: '/completar-cadastro',
          params: {
            nome,
            email: userCred.user.email || appleCredential.email || '',
          },
        });
      }
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Erro', 'Falha no login com Apple. Tente novamente.');
      }
    }
  };

  const entrar = async () => {
    if (!email || !senha) {
      Alert.alert('Atenção', 'Preencha todos os campos');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, senha);
      router.replace('/home');
    } catch (e: any) {
      Alert.alert('Erro', 'E-mail ou senha incorretos');
    }
    setLoading(false);
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

      <TouchableOpacity
        style={[styles.socialBtn, (!request || loading) && styles.socialBtnDisabled]}
        onPress={() => promptAsync()}
        disabled={!request || loading}>
        <Text style={styles.socialIcon}>G</Text>
        <Text style={styles.socialTxt}>Continuar com Google</Text>
      </TouchableOpacity>

      {Platform.OS === 'ios' && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={14}
          style={styles.appleBtn}
          onPress={handleAppleSignIn}
        />
      )}

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerTxt}>ou</Text>
        <View style={styles.dividerLine} />
      </View>

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
    marginBottom: 32,
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    gap: 10,
  },
  socialBtnDisabled: { opacity: 0.5 },
  socialIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4285F4',
  },
  socialTxt: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  appleBtn: {
    width: '100%',
    height: 54,
    marginBottom: 10,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2a3044',
  },
  dividerTxt: {
    color: '#4a5568',
    fontSize: 13,
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
