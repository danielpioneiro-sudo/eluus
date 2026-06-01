import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { useRouter } from 'expo-router';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from 'firebase/auth';
import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { auth, db } from '../firebaseConfig';

const DOMINIOS_PERMITIDOS: string[] = [];

const EMAILS_DESCARTAVEIS = [
  'mailinator.com','guerrillamail.com','tempmail.com','throwaway.email','temp-mail.org',
  'fakeinbox.com','yopmail.com','sharklasers.com','grr.la','spam4.me','trashmail.com',
  'trashmail.me','trashmail.net','dispostable.com','maildrop.cc','spamgourmet.com',
  'mailnull.com','emailondeck.com','tempr.email','discard.email','tempinbox.com',
  'throwam.com','mailnesia.com','nospam.ze.tc','guerrillamail.info','spamfree24.org',
  'mailcatch.com','trashmail.at','getairmail.com','filzmail.com','tempemail.co',
  'spamgob.com','mytrashmail.com','sogetthis.com','otoways.com','spamthisplease.com',
  'mtmdev.com','mailinater.com','binkmail.com','safetymail.info','spammotel.com',
];

function getPais(): string {
  return Localization.getLocales()[0]?.regionCode?.toUpperCase() ?? 'XX';
}

function validarCPF(cpf: string): boolean {
  const n = cpf.replace(/\D/g, '');
  if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(n[i]) * (10 - i);
  let d1 = 11 - (s % 11);
  if (d1 >= 10) d1 = 0;
  if (d1 !== parseInt(n[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(n[i]) * (11 - i);
  let d2 = 11 - (s % 11);
  if (d2 >= 10) d2 = 0;
  return d2 === parseInt(n[10]);
}

function mascaraCPF(v: string): string {
  const n = v.replace(/\D/g, '').slice(0, 11);
  if (n.length <= 3) return n;
  if (n.length <= 6) return `${n.slice(0, 3)}.${n.slice(3)}`;
  if (n.length <= 9) return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6)}`;
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`;
}

function mascaraTelefoneBR(v: string): string {
  const n = v.replace(/\D/g, '').slice(0, 11);
  if (n.length <= 2) return n.length ? `(${n}` : '';
  if (n.length <= 7) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
}

function validarTelefoneIntl(tel: string): boolean {
  return /^\+[\d][\d\s\-().]{6,19}$/.test(tel.trim());
}

export default function Cadastro() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [pais] = useState(() => getPais());
  const isBrasil = pais === 'BR';

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [tipo, setTipo] = useState('passageiro');
  const [cnh, setCnh] = useState('');
  const [loading, setLoading] = useState(false);
  const [declaracaoMotorista, setDeclaracaoMotorista] = useState(false);

  const handleTelefone = (v: string) => {
    if (isBrasil) {
      setTelefone(mascaraTelefoneBR(v));
    } else {
      setTelefone(v.replace(/[^+\d\s()\-]/g, ''));
    }
  };

  const cadastrar = async () => {
    const cpfLimpo = cpf.replace(/\D/g, '');
    const telLimpo = isBrasil ? telefone.replace(/\D/g, '') : telefone.trim();
    const emailLimpo = email.trim().toLowerCase();
    const dominio = emailLimpo.split('@')[1] ?? '';

    if (!nome.trim() || !emailLimpo || !telefone || !senha || !confirmarSenha) {
      Alert.alert(t('common.attention'), t('cadastro.alertFillFields'));
      return;
    }
    if (isBrasil && !cpf) {
      Alert.alert(t('common.attention'), t('cadastro.alertFillFields'));
      return;
    }
    if (nome.trim().split(' ').length < 2) {
      Alert.alert(t('common.attention'), t('cadastro.alertFullName'));
      return;
    }
    if (isBrasil && !validarCPF(cpfLimpo)) {
      Alert.alert(t('cadastro.alertInvalidCPFTitle'), t('cadastro.alertInvalidCPFMsg'));
      return;
    }
    if (isBrasil && telLimpo.length < 10) {
      Alert.alert(t('cadastro.alertInvalidPhoneTitle'), t('cadastro.alertInvalidPhoneMsg'));
      return;
    }
    if (!isBrasil && !validarTelefoneIntl(telLimpo)) {
      Alert.alert(t('cadastro.alertInvalidPhoneTitle'), t('cadastro.alertInvalidPhoneIntlMsg'));
      return;
    }
    if (EMAILS_DESCARTAVEIS.includes(dominio)) {
      Alert.alert(t('cadastro.alertInvalidCPFTitle'), t('cadastro.alertDisposableEmailMsg'));
      return;
    }
    if (DOMINIOS_PERMITIDOS.length > 0 && !DOMINIOS_PERMITIDOS.includes(dominio)) {
      Alert.alert(t('cadastro.alertEmailNotAllowedTitle'), t('cadastro.alertEmailNotAllowedMsg', { domains: DOMINIOS_PERMITIDOS.join(', ') }));
      return;
    }
    if (senha.length < 6) {
      Alert.alert(t('common.attention'), t('cadastro.alertShortPassword'));
      return;
    }
    if (senha !== confirmarSenha) {
      Alert.alert(t('common.attention'), t('cadastro.alertPasswordMismatch'));
      return;
    }
    if (tipo === 'motorista' && isBrasil && !cnh.trim()) {
      Alert.alert(t('common.attention'), t('cadastro.alertNoCNH'));
      return;
    }
    if (tipo === 'motorista' && !declaracaoMotorista) {
      Alert.alert(t('cadastro.alertDeclarationTitle'), t('cadastro.alertDeclarationMsg'));
      return;
    }

    setLoading(true);
    try {
      const ultimaTentativa = await AsyncStorage.getItem('@eluus_ultimo_cadastro').catch(() => null);
      if (ultimaTentativa) {
        const LIMITE_MS = 24 * 60 * 60 * 1000;
        const decorrido = Date.now() - parseInt(ultimaTentativa);
        if (decorrido < LIMITE_MS) {
          const horas = Math.ceil((LIMITE_MS - decorrido) / (60 * 60 * 1000));
          Alert.alert(t('cadastro.alertLimitTitle'), t('cadastro.alertLimitMsg', { horas }));
          setLoading(false);
          return;
        }
      }

      console.log('[cadastro] criando conta para:', emailLimpo);
      const cred = await createUserWithEmailAndPassword(auth, emailLimpo, senha);
      console.log('[cadastro] conta criada:', cred.user.uid);
      await sendEmailVerification(cred.user).catch(() => null);

      if (isBrasil) {
        const cpfSnap = await getDocs(query(collection(db, 'usuarios'), where('cpf', '==', cpfLimpo)));
        if (!cpfSnap.empty) {
          await cred.user.delete().catch(() => null);
          Alert.alert(t('cadastro.alertCPFExistsTitle'), t('cadastro.alertCPFExistsMsg'));
          setLoading(false);
          return;
        }
      }
      const codigo = Math.random().toString(36).substring(2, 8).toUpperCase();
      const partes = nome.trim().split(' ');
      const telSalvo = isBrasil ? telLimpo : telefone.trim();

      await setDoc(doc(db, 'usuarios', cred.user.uid), {
        nome: nome.trim(),
        primeiroNome: partes[0],
        sobrenome: partes.slice(1).join(' '),
        email: emailLimpo,
        telefone: telSalvo,
        tipo,
        online: false,
        codigo,
        creditos: 20,
        primeiraCorrida: false,
        pais,
        phoneVerified: true,
        ...(isBrasil && { cpf: cpfLimpo }),
        ...(isBrasil && tipo === 'motorista' && { cnh: cnh.trim() }),
        criadoEm: new Date(),
      });

      await AsyncStorage.setItem('@eluus_ultimo_cadastro', Date.now().toString()).catch(() => null);

      const destino = tipo === 'motorista' ? '/motorista' : '/passageiro';
      Alert.alert(t('cadastro.alertWelcomeTitle'), t('cadastro.alertWelcomeMsg'));
      router.replace(destino);
    } catch (e: any) {
      console.error('[cadastro] erro:', e.code, e.message);
      if (e.code === 'auth/email-already-in-use') {
        Alert.alert(t('common.error'), t('cadastro.alertEmailInUse'));
      } else {
        Alert.alert(t('common.error'), e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#0d0f14' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>←</Text>
        </TouchableOpacity>
        <Text style={styles.titulo}>{t('cadastro.title')}</Text>
        <Text style={styles.sub}>{t('cadastro.subtitle')}</Text>

        <View style={styles.tipos}>
          <TouchableOpacity
            style={[styles.tipobtn, tipo === 'passageiro' && styles.tipoativo]}
            onPress={() => setTipo('passageiro')}>
            <Text style={styles.tipoicon}>🧍</Text>
            <Text style={[styles.tipotxt, tipo === 'passageiro' && styles.tipotxtativo]}>{t('cadastro.passenger')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tipobtn, tipo === 'motorista' && styles.tipoativoverde]}
            onPress={() => setTipo('motorista')}>
            <Text style={styles.tipoicon}>🚗</Text>
            <Text style={[styles.tipotxt, tipo === 'motorista' && styles.tipotxtativo]}>{t('cadastro.driver')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.secao}>{t('cadastro.personalData')}</Text>

        <TextInput style={styles.input} placeholder={t('cadastro.namePlaceholder')} placeholderTextColor="#4a5568"
          value={nome} onChangeText={setNome} autoCapitalize="words" />

        {isBrasil && (
          <TextInput style={styles.input} placeholder={t('cadastro.cpfPlaceholder')} placeholderTextColor="#4a5568"
            value={cpf} onChangeText={v => setCpf(mascaraCPF(v))} keyboardType="numeric" />
        )}

        <TextInput
          style={styles.input}
          placeholder={isBrasil ? t('cadastro.phonePlaceholder') : t('cadastro.phoneIntlPlaceholder')}
          placeholderTextColor="#4a5568"
          value={telefone}
          onChangeText={handleTelefone}
          keyboardType="phone-pad"
        />

        <TextInput style={styles.input} placeholder={t('cadastro.emailPlaceholder')} placeholderTextColor="#4a5568"
          value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

        {tipo === 'motorista' && isBrasil && (
          <>
            <Text style={styles.secao}>{t('cadastro.driverData')}</Text>
            <TextInput style={styles.input} placeholder={t('cadastro.cnhPlaceholder')} placeholderTextColor="#4a5568"
              value={cnh} onChangeText={setCnh} keyboardType="numeric" maxLength={11} />
          </>
        )}

        <Text style={styles.secao}>{t('cadastro.security')}</Text>

        <TextInput style={styles.input} placeholder={t('cadastro.passwordPlaceholder')} placeholderTextColor="#4a5568"
          value={senha} onChangeText={setSenha} secureTextEntry />
        <TextInput style={styles.input} placeholder={t('cadastro.confirmPasswordPlaceholder')} placeholderTextColor="#4a5568"
          value={confirmarSenha} onChangeText={setConfirmarSenha} secureTextEntry />

        {tipo === 'motorista' && (
          <TouchableOpacity
            style={[styles.declaracaoBox, declaracaoMotorista && styles.declaracaoBoxAtiva]}
            onPress={() => setDeclaracaoMotorista(v => !v)}
            activeOpacity={0.8}>
            <View style={[styles.checkbox, declaracaoMotorista && styles.checkboxAtivo]}>
              {declaracaoMotorista && <Text style={styles.checkboxTick}>✓</Text>}
            </View>
            <Text style={styles.declaracaoTxt}>{t('cadastro.driverDeclaration')}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.btn} onPress={cadastrar} disabled={loading}>
          <Text style={styles.btntxt}>{loading ? t('cadastro.registering') : t('cadastro.registerBtn')}</Text>
        </TouchableOpacity>

        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 32, paddingTop: 60 },
  backBtn: { marginBottom: 16 },
  backTxt: { color: '#4a9eff', fontSize: 28 },
  titulo: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  sub: { fontSize: 16, color: '#94a3b8', marginBottom: 20 },
  secao: { fontSize: 12, fontWeight: '700', color: '#4a9eff', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12, marginTop: 4 },
  tipos: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  tipobtn: { flex: 1, backgroundColor: '#1a1f2e', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#2a3044' },
  tipoativo: { borderColor: '#4a9eff' },
  tipoativoverde: { borderColor: '#22c55e' },
  tipoicon: { fontSize: 28, marginBottom: 6 },
  tipotxt: { color: '#64748b', fontWeight: '600' },
  tipotxtativo: { color: '#fff' },
  input: { backgroundColor: '#1a1f2e', borderRadius: 14, padding: 16, color: '#fff', fontSize: 15, marginBottom: 14, borderWidth: 1, borderColor: '#2a3044' },
  smsAviso: { color: '#94a3b8', fontSize: 12, marginTop: -10, marginBottom: 14, marginLeft: 4 },
  declaracaoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#1a1f2e', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#2a3044' },
  declaracaoBoxAtiva: { borderColor: '#22c55e', backgroundColor: '#0f2a1a' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#475569', alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 },
  checkboxAtivo: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
  checkboxTick: { color: '#fff', fontSize: 13, fontWeight: 'bold', lineHeight: 16 },
  declaracaoTxt: { flex: 1, fontSize: 13, color: '#94a3b8', lineHeight: 20 },
  btn: { backgroundColor: '#4a9eff', borderRadius: 14, padding: 18, alignItems: 'center', marginTop: 4 },
  btntxt: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  link: { color: '#4a9eff', textAlign: 'center', marginTop: 20, fontSize: 15 },
});
