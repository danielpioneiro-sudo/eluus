import { useRouter } from 'expo-router';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../firebaseConfig';

type Periodo = 'hoje' | 'semana' | 'mes' | 'tudo';

const PERIODOS: { id: Periodo; label: string }[] = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'semana', label: '7 dias' },
  { id: 'mes', label: '30 dias' },
  { id: 'tudo', label: 'Tudo' },
];

function inicioDodia(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dataInicio(periodo: Periodo): Date | null {
  const agora = new Date();
  if (periodo === 'hoje') return inicioDodia(agora);
  if (periodo === 'semana') { const d = new Date(agora); d.setDate(d.getDate() - 6); return inicioDodia(d); }
  if (periodo === 'mes') { const d = new Date(agora); d.setDate(d.getDate() - 29); return inicioDodia(d); }
  return null;
}

export default function Relatorio() {
  const router = useRouter();
  const [periodo, setPeriodo] = useState<Periodo>('semana');
  const [corridas, setCorridas] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    buscar();
  }, [periodo]);

  const buscar = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setCarregando(true);
    try {
      const inicio = dataInicio(periodo);
      const constraints: any[] = [
        where('motoristaId', '==', uid),
        where('status', '==', 'finalizada'),
        orderBy('criadoEm', 'desc'),
      ];
      if (inicio) constraints.splice(2, 0, where('criadoEm', '>=', inicio));
      const snap = await getDocs(query(collection(db, 'corridas'), ...constraints));
      setCorridas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {}
    setCarregando(false);
  };

  // Agrupa por passageiro
  const porPassageiro: Record<string, any[]> = {};
  for (const c of corridas) {
    const nome = c.passageiroNome || c.passageiroId || 'Desconhecido';
    if (!porPassageiro[nome]) porPassageiro[nome] = [];
    porPassageiro[nome].push(c);
  }

  const totalValor = corridas.reduce((s, c) => s + parseFloat(c.valor || '0'), 0);
  const totalKm = corridas.reduce((s, c) => s + parseFloat(c.distancia || '0'), 0);

  const formatarData = (ts: any) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.voltarBtn}>
          <Text style={styles.voltarTxt}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.titulo}>Relatório de corridas</Text>
      </View>

      {/* Filtro de período */}
      <View style={styles.periodosRow}>
        {PERIODOS.map(p => (
          <TouchableOpacity
            key={p.id}
            style={[styles.periodoBtn, periodo === p.id && styles.periodoBtnAtivo]}
            onPress={() => setPeriodo(p.id)}
          >
            <Text style={[styles.periodoTxt, periodo === p.id && styles.periodoTxtAtivo]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {carregando ? (
        <ActivityIndicator color="#4a9eff" style={{ marginTop: 40 }} />
      ) : corridas.length === 0 ? (
        <View style={styles.vazio}>
          <Text style={styles.vazioemoji}>📋</Text>
          <Text style={styles.vaziotxt}>Nenhuma corrida neste período</Text>
        </View>
      ) : (
        <>
          {/* Resumo */}
          <View style={styles.resumoRow}>
            <View style={styles.resumoCard}>
              <Text style={styles.resumoValor}>{corridas.length}</Text>
              <Text style={styles.resumoLabel}>corridas</Text>
            </View>
            <View style={styles.resumoCard}>
              <Text style={styles.resumoValor}>R$ {totalValor.toFixed(2)}</Text>
              <Text style={styles.resumoLabel}>faturado</Text>
            </View>
            <View style={styles.resumoCard}>
              <Text style={styles.resumoValor}>{totalKm.toFixed(1)} km</Text>
              <Text style={styles.resumoLabel}>rodados</Text>
            </View>
          </View>

          {/* Por passageiro */}
          {Object.entries(porPassageiro).map(([nome, lista]) => {
            const totalPax = lista.reduce((s, c) => s + parseFloat(c.valor || '0'), 0);
            return (
              <View key={nome} style={styles.passageiroSection}>
                <View style={styles.passageiroHeader}>
                  <Text style={styles.passageiroNome}>{nome}</Text>
                  <Text style={styles.passageiroTotal}>{lista.length}x · R$ {totalPax.toFixed(2)}</Text>
                </View>
                {lista.map(c => (
                  <View key={c.id} style={styles.corridaItem}>
                    <View style={styles.corridaItemTop}>
                      <Text style={styles.corridaItemDestino} numberOfLines={1}>📍 {c.destino}</Text>
                      <Text style={styles.corridaItemValor}>R$ {c.valor}</Text>
                    </View>
                    <View style={styles.corridaItemBottom}>
                      <Text style={styles.corridaItemInfo}>{c.distancia} km · {formatarData(c.criadoEm)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            );
          })}
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0f14', padding: 24, paddingTop: 60 },
  header: { marginBottom: 24 },
  voltarBtn: { marginBottom: 12 },
  voltarTxt: { color: '#4a9eff', fontSize: 15 },
  titulo: { fontSize: 26, fontWeight: 'bold', color: '#fff' },
  periodosRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  periodoBtn: { flex: 1, backgroundColor: '#1a1f2e', borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#2a3044' },
  periodoBtnAtivo: { borderColor: '#4a9eff', backgroundColor: '#1a2a4a' },
  periodoTxt: { color: '#64748b', fontWeight: '600', fontSize: 13 },
  periodoTxtAtivo: { color: '#4a9eff' },
  vazio: { alignItems: 'center', marginTop: 60, gap: 12 },
  vazioemoji: { fontSize: 48 },
  vaziotxt: { color: '#64748b', fontSize: 16 },
  resumoRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  resumoCard: { flex: 1, backgroundColor: '#1a1f2e', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#2a3044' },
  resumoValor: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginBottom: 4 },
  resumoLabel: { color: '#64748b', fontSize: 11 },
  passageiroSection: { marginBottom: 20 },
  passageiroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  passageiroNome: { color: '#fff', fontWeight: '700', fontSize: 15 },
  passageiroTotal: { color: '#4a9eff', fontSize: 13, fontWeight: '600' },
  corridaItem: { backgroundColor: '#1a1f2e', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#2a3044' },
  corridaItemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  corridaItemDestino: { color: '#fff', fontSize: 13, flex: 1, marginRight: 8 },
  corridaItemValor: { color: '#22c55e', fontWeight: '700', fontSize: 14 },
  corridaItemBottom: {},
  corridaItemInfo: { color: '#64748b', fontSize: 12 },
});
