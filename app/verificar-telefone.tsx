import { useLocalSearchParams, useRouter } from 'expo-router';
import { PhoneAuthProvider, linkWithCredential } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { navegarDashboard } from '../utils/navegarDashboard';
import { useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { auth, db, firebaseConfig } from '../firebaseConfig';

// ApplicationVerifier customizado: usa WebView para obter token do reCAPTCHA invisível
class AppVerifier {
  readonly type = 'recaptcha' as const;
  private _res: ((t: string) => void) | null = null;
  private _rej: ((e: Error) => void) | null = null;

  verify(): Promise<string> {
    return new Promise((res, rej) => {
      this._res = res;
      this._rej = rej;
    });
  }
  onToken(t: string) { this._res?.(t); this._res = null; this._rej = null; }
  onError(m = 'Verificação falhou') { this._rej?.(new Error(m)); this._res = null; this._rej = null; }
  _reset() {}
}

const RC_HTML = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
<script>
firebase.initializeApp({
  apiKey:"${firebaseConfig.apiKey}",
  authDomain:"${firebaseConfig.authDomain}",
  projectId:"${firebaseConfig.projectId}"
});
window.addEventListener('load',function(){
  try{
    var v=new firebase.auth.RecaptchaVerifier('rc',{
      size:'invisible',
      callback:function(t){window.ReactNativeWebView.postMessage(JSON.stringify({ok:1,t:t}));},
      'error-callback':function(){window.ReactNativeWebView.postMessage(JSON.stringify({ok:0}));}
    });
    v.verify().catch(function(e){window.ReactNativeWebView.postMessage(JSON.stringify({ok:0,m:e.message}));});
  }catch(e){window.ReactNativeWebView.postMessage(JSON.stringify({ok:0,m:e.message}));}
});
</script></head>
<body style="background:#0d0f14;margin:0"><div id="rc"></div></body></html>`;

export default function VerificarTelefone() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { telefone: telefoneParam = '' } = useLocalSearchParams<{ telefone: string }>();

  const [telefone, setTelefone] = useState(typeof telefoneParam === 'string' ? telefoneParam : '');
  const [verificationId, setVerificationId] = useState('');
  const [codigo, setCodigo] = useState('');
  const [etapa, setEtapa] = useState<'telefone' | 'codigo'>('telefone');
  const [loading, setLoading] = useState(false);
  const [showRc, setShowRc] = useState(false);

  const verifier = useRef(new AppVerifier());

  const enviarCodigo = async () => {
    const tel = telefone.trim();
    if (!tel || !tel.startsWith('+')) {
      Alert.alert('Número inválido', 'Use o formato internacional com + (ex: +1 555 1234567)');
      return;
    }
    setLoading(true);
    verifier.current = new AppVerifier();
    setShowRc(true);
    try {
      const provider = new PhoneAuthProvider(auth);
      const vid = await provider.verifyPhoneNumber(tel, verifier.current as any);
      setVerificationId(vid);
      setEtapa('codigo');
    } catch (e: any) {
      Alert.alert('Erro ao enviar SMS', 'Verifique o número e tente novamente.\n\n' + (e.message || ''));
    }
    setShowRc(false);
    setLoading(false);
  };

  const verificarCodigo = async () => {
    if (codigo.trim().length !== 6) {
      Alert.alert('Código inválido', 'Digite o código de 6 dígitos recebido por SMS');
      return;
    }
    const uid = auth.currentUser?.uid;
    if (!uid) { router.replace('/'); return; }
    setLoading(true);
    try {
      const credential = PhoneAuthProvider.credential(verificationId, codigo.trim());
      try {
        await linkWithCredential(auth.currentUser!, credential);
      } catch (linkErr: any) {
        if (linkErr.code !== 'auth/credential-already-in-use' &&
            linkErr.code !== 'auth/provider-already-linked') {
          throw linkErr;
        }
      }
      await updateDoc(doc(db, 'usuarios', uid), {
        phoneVerified: true,
        telefone: telefone.trim(),
      });
      console.log('[verificar-telefone] verificação OK, consultando dashboard');
      await navegarDashboard(uid, router);
    } catch (e: any) {
      if (e.code === 'auth/invalid-verification-code') {
        Alert.alert('Código incorreto', 'Verifique o código e tente novamente.');
      } else if (e.code === 'auth/code-expired') {
        Alert.alert('Código expirado', 'Solicite um novo código.');
        setEtapa('telefone');
      } else {
        Alert.alert('Erro', e.message || 'Não foi possível verificar o código.');
      }
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#0d0f14' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

      {/* Modal reCAPTCHA invisível */}
      <Modal visible={showRc} transparent animationType="fade">
        <View style={styles.rcOverlay}>
          <View style={styles.rcCard}>
            <Text style={styles.rcTitulo}>Verificação de segurança...</Text>
            <View style={styles.rcWebViewBox}>
              <WebView
                source={{ html: RC_HTML }}
                style={{ flex: 1 }}
                javaScriptEnabled
                onMessage={e => {
                  try {
                    const msg = JSON.parse(e.nativeEvent.data);
                    if (msg.ok && msg.t) verifier.current.onToken(msg.t);
                    else verifier.current.onError(msg.m);
                  } catch { verifier.current.onError(); }
                }}
              />
            </View>
            <TouchableOpacity
              onPress={() => { setShowRc(false); setLoading(false); verifier.current.onError('Cancelado'); }}
              style={styles.rcCancelar}>
              <Text style={styles.rcCancelarTxt}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        <View style={styles.iconCircle}>
          <Text style={styles.iconEmoji}>📱</Text>
        </View>

        <Text style={styles.titulo}>Verificar telefone</Text>
        <Text style={styles.sub}>
          Seu número de telefone é usado para verificar sua identidade no eluus. Você receberá um SMS com um código de 6 dígitos.
        </Text>

        {etapa === 'telefone' ? (
          <>
            <Text style={styles.label}>Número de telefone com código do país</Text>
            <TextInput
              style={styles.input}
              placeholder="+1 555 123 4567"
              placeholderTextColor="#4a5568"
              value={telefone}
              onChangeText={v => setTelefone(v.replace(/[^+\d\s()\-]/g, ''))}
              keyboardType="phone-pad"
              autoFocus
            />
            <Text style={styles.dica}>
              Inclua o código do país com +{'\n'}
              Exemplos: +1 (EUA/Canadá) · +44 (UK) · +34 (Espanha) · +351 (Portugal)
            </Text>
            <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={enviarCodigo} disabled={loading}>
              <Text style={styles.btntxt}>{loading ? 'Enviando SMS...' : 'Enviar código SMS'}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.smsSentBox}>
              <Text style={styles.smsSentIcon}>✅</Text>
              <Text style={styles.smsSentTxt}>SMS enviado para{'\n'}<Text style={styles.smsSentNum}>{telefone}</Text></Text>
            </View>

            <Text style={styles.label}>Código de 6 dígitos</Text>
            <TextInput
              style={[styles.input, styles.codigoInput]}
              placeholder="000000"
              placeholderTextColor="#4a5568"
              value={codigo}
              onChangeText={v => setCodigo(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />

            <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={verificarCodigo} disabled={loading}>
              <Text style={styles.btntxt}>{loading ? 'Verificando...' : 'Verificar código'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { setEtapa('telefone'); setCodigo(''); }} style={styles.linkBtn} disabled={loading}>
              <Text style={styles.linkTxt}>Não recebeu o SMS? Tentar novamente</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 32, paddingTop: 72 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#1a2035', alignItems: 'center', justifyContent: 'center', marginBottom: 24, alignSelf: 'center', borderWidth: 1, borderColor: '#2a3a55' },
  iconEmoji: { fontSize: 32 },
  titulo: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 12, textAlign: 'center' },
  sub: { fontSize: 14, color: '#94a3b8', marginBottom: 32, textAlign: 'center', lineHeight: 22 },
  label: { color: '#64748b', fontSize: 13, marginBottom: 8, marginTop: 4 },
  input: { backgroundColor: '#1a1f2e', borderRadius: 14, padding: 16, color: '#fff', fontSize: 15, marginBottom: 8, borderWidth: 1, borderColor: '#2a3044' },
  codigoInput: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', letterSpacing: 12, color: '#4a9eff' },
  dica: { fontSize: 12, color: '#4a5568', marginBottom: 24, lineHeight: 18 },
  btn: { backgroundColor: '#4a9eff', borderRadius: 14, padding: 18, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  btntxt: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  smsSentBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f2a1a', borderRadius: 14, padding: 16, marginBottom: 24, gap: 12, borderWidth: 1, borderColor: '#22c55e' },
  smsSentIcon: { fontSize: 22 },
  smsSentTxt: { color: '#94a3b8', fontSize: 14, flex: 1 },
  smsSentNum: { color: '#fff', fontWeight: '700' },
  linkBtn: { marginTop: 16, alignItems: 'center' },
  linkTxt: { color: '#4a9eff', fontSize: 14 },
  rcOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  rcCard: { backgroundColor: '#13161e', borderRadius: 20, padding: 24, width: 280, alignItems: 'center', borderWidth: 1, borderColor: '#2a3044' },
  rcTitulo: { color: '#94a3b8', fontSize: 14, marginBottom: 16 },
  rcWebViewBox: { width: 240, height: 120, borderRadius: 12, overflow: 'hidden', backgroundColor: '#0d0f14' },
  rcCancelar: { marginTop: 20, padding: 10 },
  rcCancelarTxt: { color: '#64748b', fontSize: 14 },
});
