import { httpsCallable } from 'firebase/functions';
import { collection, getDocs, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { auth, db, functions } from '../firebaseConfig';

export default function Admin() {
  const router = useRouter();
  const [verificando, setVerificando] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [emailBusca, setEmailBusca] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [motorista, setMotorista] = useState<any>(null);
  const [quantidade, setQuantidade] = useState('');
  const [motivo, setMotivo] = useState('');
  const [adicionando, setAdicionando] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    verificarAdmin();
  }, []);

  const verificarAdmin = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) { router.replace('/'); return; }
    try {
      const snap = await getDocs(query(collection(db, 'usuarios'), where('__name__', '==', uid)));
      if (snap.empty || snap.docs[0].data().tipo !== 'admin') {
        router.replace('/home');
        return;
      }
      setIsAdmin(true);
      carregarLogs();
    } catch (e) {
      router.replace('/home');
    }
    setVerificando(false);
  };

  const carregarLogs = () => {
    const q = query(collection(db, 'adminLogs'), orderBy('criadoEm', 'desc'), limit(10));
    return onSnapshot(q, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  };

  const buscarMotorista = async () => {
    if (!emailBusca.trim()) return;
    setBuscando(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'usuarios'), where('email', '==', emailBusca.trim().toLowerCase()))
      );
      if (snap.empty) {
        Alert.alert('Não encontrado', 'Nenhum usuário com este e-mail');
        setMotorista(null);
      } else {
        setMotorista({ id: snap.docs[0].id, ...snap.docs[0].data() });
      }
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    }
    setBuscando(false);
  };

  const adicionarCreditos = async () => {
    if (!motorista) return;
    const qtd = parseInt(quantidade);
    if (!qtd || qtd <= 0) { Alert.alert('Atenção', 'Informe uma quantidade válida'); return; }
    setAdicionando(true);
    try {
      const fn = httpsCallable(functions, 'adicionarCreditosAdmin');
      await fn({ targetUid: motorista.id, quantidade: qtd, motivo: motivo.trim() });
      Alert.alert('Sucesso', `${qtd} créditos adicionados a ${motorista.nome}`);
      setQuantidade('');
      setMotivo('');
      setMotorista((m: any) => m ? { ...m, creditos: (m.creditos || 0) + qtd } : m);
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    }
    setAdicionando(false);
  };

  const formatarData = (ts: any) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  if (verificando) {
    return (
      <View style={styles.centralizando}>
        <ActivityIndicator color="#4a9eff" size="large" />
      </View>
    );
  }

  if (!isAdmin) return null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.voltarBtn}>
            <Text style={styles.voltarTxt}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.titulo}>Área administrativa</Text>
          <Text style={styles.sub}>Gestão de créditos de motoristas</Text>
        </View>

        {/* Busca */}
        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>Buscar motorista</Text>
          <View style={styles.buscaRow}>
            <TextInput
              style={styles.buscaInput}
              placeholder="E-mail do motorista"
              placeholderTextColor="#4a5568"
              value={emailBusca}
              onChangeText={setEmailBusca}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.buscaBtn} onPress={buscarMotorista} disabled={buscando}>
              {buscando ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.buscaBtnTxt}>Buscar</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {/* Resultado */}
        {motorista && (
          <View style={styles.motoristaCard}>
            <View style={styles.motoristaInfo}>
              <Text style={styles.motoristaNome}>{motorista.nome}</Text>
              <Text style={styles.motoristaEmail}>{motorista.email}</Text>
              <Text style={styles.motoristaTipo}>{motorista.tipo} · {motorista.corridas || 0} corridas</Text>
            </View>
            <View style={styles.creditosAtual}>
              <Text style={styles.creditosAtualNum}>{motorista.creditos ?? 0}</Text>
              <Text style={styles.creditosAtualLabel}>créditos</Text>
            </View>
          </View>
        )}

        {/* Adicionar créditos */}
        {motorista && (
          <View style={styles.secao}>
            <Text style={styles.secaoTitulo}>Adicionar créditos</Text>
            <TextInput
              style={styles.input}
              placeholder="Quantidade de créditos"
              placeholderTextColor="#4a5568"
              value={quantidade}
              onChangeText={setQuantidade}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.input}
              placeholder="Motivo (opcional)"
              placeholderTextColor="#4a5568"
              value={motivo}
              onChangeText={setMotivo}
            />
            <TouchableOpacity style={styles.adicionarBtn} onPress={adicionarCreditos} disabled={adicionando}>
              {adicionando
                ? <ActivityIndicator color="#000" size="small" />
                : <Text style={styles.adicionarBtnTxt}>Adicionar créditos</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* Logs */}
        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>Últimas adições manuais</Text>
          {logs.length === 0 ? (
            <Text style={styles.semLogs}>Nenhum log encontrado</Text>
          ) : (
            logs.map(log => (
              <View key={log.id} style={styles.logItem}>
                <View style={styles.logTop}>
                  <Text style={styles.logQtd}>+{log.quantidade} créditos</Text>
                  <Text style={styles.logData}>{formatarData(log.criadoEm)}</Text>
                </View>
                <Text style={styles.logUid} numberOfLines={1}>Para: {log.targetUid}</Text>
                {log.motivo ? <Text style={styles.logMotivo}>{log.motivo}</Text> : null}
              </View>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  centralizando: { flex: 1, backgroundColor: '#0d0f14', alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: '#0d0f14', padding: 24, paddingTop: 60 },
  header: { marginBottom: 28 },
  voltarBtn: { marginBottom: 12 },
  voltarTxt: { color: '#4a9eff', fontSize: 15 },
  titulo: { fontSize: 26, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  sub: { color: '#94a3b8', fontSize: 14 },
  secao: { marginBottom: 24 },
  secaoTitulo: { color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 14 },
  buscaRow: { flexDirection: 'row', gap: 10 },
  buscaInput: { flex: 1, backgroundColor: '#1a1f2e', borderRadius: 14, padding: 14, color: '#fff', fontSize: 14, borderWidth: 1, borderColor: '#2a3044' },
  buscaBtn: { backgroundColor: '#4a9eff', borderRadius: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  buscaBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  motoristaCard: { backgroundColor: '#1a1f2e', borderRadius: 16, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#2a3044' },
  motoristaInfo: { flex: 1 },
  motoristaNome: { color: '#fff', fontWeight: '700', fontSize: 16, marginBottom: 4 },
  motoristaEmail: { color: '#64748b', fontSize: 13, marginBottom: 4 },
  motoristaTipo: { color: '#94a3b8', fontSize: 12 },
  creditosAtual: { alignItems: 'center' },
  creditosAtualNum: { color: '#4a9eff', fontSize: 36, fontWeight: 'bold' },
  creditosAtualLabel: { color: '#64748b', fontSize: 11 },
  input: { backgroundColor: '#1a1f2e', borderRadius: 14, padding: 14, color: '#fff', fontSize: 14, borderWidth: 1, borderColor: '#2a3044', marginBottom: 12 },
  adicionarBtn: { backgroundColor: '#4a9eff', borderRadius: 14, padding: 16, alignItems: 'center' },
  adicionarBtnTxt: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  semLogs: { color: '#4a5568', fontSize: 14 },
  logItem: { backgroundColor: '#1a1f2e', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#2a3044', gap: 4 },
  logTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logQtd: { color: '#22c55e', fontWeight: '700', fontSize: 15 },
  logData: { color: '#64748b', fontSize: 12 },
  logUid: { color: '#94a3b8', fontSize: 11 },
  logMotivo: { color: '#64748b', fontSize: 12, fontStyle: 'italic' },
});
