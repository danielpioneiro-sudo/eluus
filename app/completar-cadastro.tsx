import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { auth, db } from '../firebaseConfig';

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

export default function CompletarCadastro() {
  const router = useRouter();
  const { nome: nomeParam = '', email: emailParam = '' } = useLocalSearchParams<{
    nome: string;
    email: string;
  }>();

  const [pais] = useState(() => getPais());
  const isBrasil = pais === 'BR';

  const [nome, setNome] = useState(nomeParam);
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [tipo, setTipo] = useState('passageiro');
  const [cnh, setCnh] = useState('');
  const [codigoConvite, setCodigoConvite] = useState('');
  const [declaracaoMotorista, setDeclaracaoMotorista] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) router.replace('/');
  }, []);

  const handleTelefone = (v: string) => {
    if (isBrasil) {
      setTelefone(mascaraTelefoneBR(v));
    } else {
      setTelefone(v.replace(/[^+\d\s()\-]/g, ''));
    }
  };

  const completar = async () => {
    const cpfLimpo = cpf.replace(/\D/g, '');
    const telLimpo = isBrasil ? telefone.replace(/\D/g, '') : telefone.trim();

    if (!nome.trim() || !telefone || !codigoConvite.trim()) {
      Alert.alert('Atenção', 'Preencha todos os campos obrigatórios');
      return;
    }
    if (isBrasil && !cpf) {
      Alert.alert('Atenção', 'Preencha todos os campos obrigatórios');
      return;
    }
    if (nome.trim().split(' ').length < 2) {
      Alert.alert('Atenção', 'Digite seu nome completo (nome e sobrenome)');
      return;
    }
    if (isBrasil && !validarCPF(cpfLimpo)) {
      Alert.alert('CPF inválido', 'Verifique o CPF digitado');
      return;
    }
    if (isBrasil && telLimpo.length < 10) {
      Alert.alert('Telefone inválido', 'Digite um telefone com DDD');
      return;
    }
    if (!isBrasil && !validarTelefoneIntl(telLimpo)) {
      Alert.alert('Telefone inválido', 'Use o formato internacional: +1 555 1234567');
      return;
    }
    if (tipo === 'motorista' && isBrasil && !cnh.trim()) {
      Alert.alert('Atenção', 'Digite o número da sua CNH');
      return;
    }
    if (tipo === 'motorista' && !declaracaoMotorista) {
      Alert.alert('Declaração obrigatória', 'Você precisa aceitar a declaração de uso responsável.');
      return;
    }

    setLoading(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Usuário não autenticado');

      const inviteSnap = await getDocs(
        query(collection(db, 'usuarios'), where('codigo', '==', codigoConvite.trim().toUpperCase()))
      );
      if (inviteSnap.empty) {
        Alert.alert('Código inválido', 'Este código de convite não existe. Peça o código a um amigo que já usa o eluus.');
        setLoading(false);
        return;
      }

      if (isBrasil) {
        const cpfSnap = await getDocs(query(collection(db, 'usuarios'), where('cpf', '==', cpfLimpo)));
        if (!cpfSnap.empty) {
          Alert.alert('CPF já cadastrado', 'Este CPF já possui uma conta no eluus.');
          setLoading(false);
          return;
        }
      }

      const codigo = Math.random().toString(36).substring(2, 8).toUpperCase();
      const partes = nome.trim().split(' ');
      const telSalvo = isBrasil ? telLimpo : telefone.trim();

      await setDoc(doc(db, 'usuarios', uid), {
        nome: nome.trim(),
        primeiroNome: partes[0],
        sobrenome: partes.slice(1).join(' '),
        email: emailParam || auth.currentUser?.email || '',
        telefone: telSalvo,
        tipo,
        online: false,
        codigo,
        creditos: 20,
        primeiraCorrida: false,
        pais,
        phoneVerified: isBrasil,
        ...(isBrasil && { cpf: cpfLimpo }),
        ...(isBrasil && tipo === 'motorista' && { cnh: cnh.trim() }),
        criadoEm: new Date(),
      });

      await AsyncStorage.setItem('@eluus_ultimo_cadastro', Date.now().toString()).catch(() => null);

      if (isBrasil) {
        router.replace('/home');
      } else {
        router.replace({ pathname: '/verificar-telefone', params: { telefone: telefone.trim() } });
      }
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Não foi possível concluir o cadastro.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#0d0f14' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Text style={styles.titulo}>Quase lá!</Text>
        <Text style={styles.sub}>Precisamos de mais alguns dados para criar sua conta</Text>

        <View style={styles.tipos}>
          <TouchableOpacity
            style={[styles.tipobtn, tipo === 'passageiro' && styles.tipoativo]}
            onPress={() => setTipo('passageiro')}>
            <Text style={styles.tipoicon}>🧍</Text>
            <Text style={[styles.tipotxt, tipo === 'passageiro' && styles.tipotxtativo]}>Passageiro</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tipobtn, tipo === 'motorista' && styles.tipoativoverde]}
            onPress={() => setTipo('motorista')}>
            <Text style={styles.tipoicon}>🚗</Text>
            <Text style={[styles.tipotxt, tipo === 'motorista' && styles.tipotxtativo]}>Motorista</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.secao}>Dados pessoais</Text>

        <TextInput
          style={styles.input}
          placeholder="Nome completo"
          placeholderTextColor="#4a5568"
          value={nome}
          onChangeText={setNome}
          autoCapitalize="words"
        />

        {isBrasil && (
          <TextInput
            style={styles.input}
            placeholder="CPF (000.000.000-00)"
            placeholderTextColor="#4a5568"
            value={cpf}
            onChangeText={v => setCpf(mascaraCPF(v))}
            keyboardType="numeric"
          />
        )}

        <TextInput
          style={styles.input}
          placeholder={isBrasil ? 'Telefone com DDD' : '+1 555 123 4567'}
          placeholderTextColor="#4a5568"
          value={telefone}
          onChangeText={handleTelefone}
          keyboardType="phone-pad"
        />
        {!isBrasil && (
          <Text style={styles.smsAviso}>
            📱 Seu número de telefone é usado para verificar sua identidade
          </Text>
        )}

        {tipo === 'motorista' && isBrasil && (
          <>
            <Text style={styles.secao}>Dados do motorista</Text>
            <TextInput
              style={styles.input}
              placeholder="Número da CNH"
              placeholderTextColor="#4a5568"
              value={cnh}
              onChangeText={setCnh}
              keyboardType="numeric"
              maxLength={11}
            />
          </>
        )}

        <Text style={styles.secao}>Código de convite</Text>
        <TextInput
          style={styles.input}
          placeholder="Código de um amigo (ex: AB12CD)"
          placeholderTextColor="#4a5568"
          value={codigoConvite}
          onChangeText={v => setCodigoConvite(v.toUpperCase())}
          autoCapitalize="characters"
          maxLength={6}
        />

        {tipo === 'motorista' && (
          <TouchableOpacity
            style={[styles.declaracaoBox, declaracaoMotorista && styles.declaracaoBoxAtiva]}
            onPress={() => setDeclaracaoMotorista(v => !v)}
            activeOpacity={0.8}>
            <View style={[styles.checkbox, declaracaoMotorista && styles.checkboxAtivo]}>
              {declaracaoMotorista && <Text style={styles.checkboxTick}>✓</Text>}
            </View>
            <Text style={styles.declaracaoTxt}>
              Declaro que só usarei o eluus para transportar pessoas que já conheço pessoalmente. Sei que usar com desconhecidos viola os termos e resulta em bloqueio permanente.
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.btn} onPress={completar} disabled={loading}>
          <Text style={styles.btntxt}>{loading ? 'Salvando...' : 'Concluir cadastro'}</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 32, paddingTop: 80 },
  titulo: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  sub: { fontSize: 15, color: '#94a3b8', marginBottom: 32, lineHeight: 22 },
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
});
