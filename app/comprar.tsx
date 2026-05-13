import * as Localization from 'expo-localization';
import { useRouter } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { auth, db, functions } from '../firebaseConfig';

// Detecta se o dispositivo é do Brasil (locale pt-BR ou timezone Brasil)
const isBrazil = (): boolean => {
  const locales = Localization.getLocales();
  const locale = locales[0];
  if (locale?.regionCode === 'BR') return true;
  if (locale?.languageTag?.includes('BR') || locale?.languageTag?.includes('pt-')) return true;
  const tz = Localization.getCalendars()[0]?.timeZone || '';
  return tz.startsWith('America/Sao_Paulo') || tz.startsWith('America/Fortaleza') ||
    tz.startsWith('America/Manaus') || tz.startsWith('America/Belem') || tz.includes('Brazil');
};

const PACOTES = [
  { id: '30',  corridas: 30,  valor: 'R$ 29',  valorNum: 29,  priceUnit: 'R$ 0,97/corrida', descricao: 'Ideal para começar',    destaque: false },
  { id: '50',  corridas: 50,  valor: 'R$ 39',  valorNum: 39,  priceUnit: 'R$ 0,78/corrida', descricao: 'Mais popular ⭐',       destaque: true },
  { id: '100', corridas: 100, valor: 'R$ 69',  valorNum: 69,  priceUnit: 'R$ 0,69/corrida', descricao: 'Melhor custo-benefício', destaque: false },
  { id: '200', corridas: 200, valor: 'R$ 119', valorNum: 119, priceUnit: 'R$ 0,59/corrida', descricao: 'Pacote profissional',    destaque: false },
];

export default function Comprar() {
  const router = useRouter();
  const { t } = useTranslation();
  const [creditos, setCreditos] = useState(0);
  const [carregando, setCarregando] = useState<string | null>(null);
  const [modalPix, setModalPix] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [qrCodeBase64, setQrCodeBase64] = useState('');
  const [timer, setTimer] = useState(1800);
  const [pago, setPago] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unsubPedidoRef = useRef<(() => void) | null>(null);
  const brasil = isBrazil();

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsub = onSnapshot(doc(db, 'usuarios', uid), (snap) => {
      if (snap.exists()) setCreditos(snap.data().creditos ?? 0);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (unsubPedidoRef.current) unsubPedidoRef.current();
    };
  }, []);

  // ── PIX (Android Brasil) ──────────────────────────────────
  const comprarPix = async (pacoteId: string) => {
    setCarregando(pacoteId);
    try {
      const criarPix = httpsCallable(functions, 'criarPagamentoPix');
      const result = await criarPix({ pacote: pacoteId }) as any;
      const { pedidoId, qrCode: qr, qrCodeBase64: qrb64 } = result.data;
      setQrCode(qr);
      setQrCodeBase64(qrb64);
      setTimer(1800);
      setPago(false);
      setModalPix(true);
      iniciarTimer();
      escutarPedido(pedidoId);
    } catch (e: any) {
      Alert.alert('Erro ao gerar PIX', e.message || 'Tente novamente');
    }
    setCarregando(null);
  };

  // ── PayPal (Android todos os países) ─────────────────────
  const comprarPayPal = async (pacoteId: string, valorNum: number) => {
    setCarregando(`paypal_${pacoteId}`);
    try {
      const criarPayPal = httpsCallable(functions, 'criarPedidoPayPal');
      const result = await criarPayPal({ pacote: pacoteId, valor: valorNum }) as any;
      const { approvalUrl, pedidoId } = result.data;
      if (unsubPedidoRef.current) unsubPedidoRef.current();
      escutarPedido(pedidoId);
      await Linking.openURL(approvalUrl);
    } catch (e: any) {
      Alert.alert('Erro PayPal', e.message || 'Não foi possível iniciar o pagamento');
    }
    setCarregando(null);
  };

  const handleComprar = (pacote: typeof PACOTES[0]) => {
    if (brasil) {
      Alert.alert(
        t('comprar.paymentMethod'),
        t('comprar.pixAndPaypal'),
        [
          { text: '🏦 PIX', onPress: () => comprarPix(pacote.id) },
          { text: '🔵 PayPal', onPress: () => comprarPayPal(pacote.id, pacote.valorNum) },
          { text: t('common.cancel'), style: 'cancel' },
        ]
      );
    } else {
      comprarPayPal(pacote.id, pacote.valorNum);
    }
  };

  const iniciarTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer(t => {
        if (t <= 1) { clearInterval(timerRef.current!); fecharModal(); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  const escutarPedido = (pedidoId: string) => {
    if (unsubPedidoRef.current) unsubPedidoRef.current();
    unsubPedidoRef.current = onSnapshot(doc(db, 'pagamentos', pedidoId), (snap) => {
      if (snap.exists() && snap.data()?.status === 'pago') {
        if (timerRef.current) clearInterval(timerRef.current);
        setPago(true);
      }
    });
  };

  const fecharModal = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (unsubPedidoRef.current) { unsubPedidoRef.current(); unsubPedidoRef.current = null; }
    setModalPix(false);
    setPago(false);
    setQrCode('');
    setQrCodeBase64('');
  };

  const formatarTimer = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const copiarCodigo = () => {
    Alert.alert('Código PIX Copia e Cola', qrCode, [{ text: 'Fechar' }]);
  };

  const labelMetodoPagamento = brasil ? t('comprar.pixAndPaypal') : 'PayPal';

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* Modal PIX */}
      <Modal visible={modalPix} transparent animationType="slide" onRequestClose={fecharModal}>
        <View style={styles.pixOverlay}>
          <View style={styles.pixCard}>
            {pago ? (
              <>
                <Text style={styles.pagoEmoji}>✅</Text>
                <Text style={styles.pagoTitulo}>{t('comprar.paymentConfirmed')}</Text>
                <Text style={styles.pagoSub}>{t('comprar.creditsAdded')}</Text>
                <View style={styles.pagoSaldoRow}>
                  <Text style={styles.pagoSaldoLabel}>{t('comprar.newBalance')}</Text>
                  <Text style={styles.pagoSaldoNum}>{creditos}</Text>
                  <Text style={styles.pagoSaldoLabel}> {t('comprar.credits')}</Text>
                </View>
                <TouchableOpacity style={styles.pagoBtn} onPress={fecharModal}>
                  <Text style={styles.pagoBtnTxt}>{t('comprar.continue')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.pixTitulo}>{t('comprar.payWithPix')}</Text>
                <Text style={styles.pixTimer}>⏱ {formatarTimer(timer)}</Text>
                {qrCodeBase64 ? (
                  <Image source={{ uri: `data:image/png;base64,${qrCodeBase64}` }} style={styles.pixQR} />
                ) : (
                  <ActivityIndicator color="#4a9eff" size="large" style={{ margin: 40 }} />
                )}
                <Text style={styles.pixInstrucao}>Ou use o código copia e cola:</Text>
                <TouchableOpacity style={styles.copiaBox} onPress={copiarCodigo}>
                  <Text style={styles.copiaTxt} numberOfLines={2}>{qrCode}</Text>
                  <Text style={styles.copiaBtn}>📋 Copiar</Text>
                </TouchableOpacity>
                <View style={styles.pixAguardando}>
                  <ActivityIndicator color="#22c55e" size="small" />
                  <Text style={styles.pixAguardandoTxt}>{t('comprar.waitingPayment')}</Text>
                </View>
                <TouchableOpacity onPress={fecharModal} style={{ marginTop: 16 }}>
                  <Text style={styles.pixCancelar}>{t('comprar.cancel')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.voltarBtn}>
          <Text style={styles.voltarTxt}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.titulo}>{t('comprar.title')}</Text>
      </View>

      {/* Saldo atual */}
      <View style={styles.saldoCard}>
        <Text style={styles.saldoLabel}>{t('comprar.currentBalance')}</Text>
        <Text style={[styles.saldoNum, { color: creditos === 0 ? '#ef4444' : creditos <= 10 ? '#f59e0b' : '#22c55e' }]}>
          {creditos}
        </Text>
        <Text style={styles.saldoSub}>{t('comprar.creditsLabel')}</Text>
      </View>

      {/* Indicador de método de pagamento */}
      <View style={styles.metodoCard}>
        <Text style={styles.metodoLabel}>
          {brasil ? '🏦' : '🔵'} {labelMetodoPagamento}
        </Text>
      </View>

      {/* Pacotes */}
      <Text style={styles.secaoTitulo}>{t('comprar.choosePlan')}</Text>

      {PACOTES.map(p => {
        const isLoading = carregando === p.id || carregando === `paypal_${p.id}`;
        return (
          <TouchableOpacity
            key={p.id}
            style={[styles.pacoteCard, p.destaque && styles.pacoteDestaque]}
            onPress={() => handleComprar(p)}
            disabled={!!carregando}
          >
            {p.destaque && (
              <View style={styles.destaqueTag}>
                <Text style={styles.destaqueTxt}>{t('comprar.mostPopular')}</Text>
              </View>
            )}
            <View style={styles.pacoteLeft}>
              <Text style={[styles.pacoteCorridas, p.destaque && styles.pacoteCorridasDestaque]}>
                {p.corridas}
              </Text>
              <Text style={styles.pacoteLabel}>{t('comprar.rides')}</Text>
            </View>
            <View style={styles.pacoteCenter}>
              <Text style={styles.pacoteDescricao}>{p.descricao}</Text>
              <Text style={styles.pacoteKm}>{p.priceUnit}</Text>
            </View>
            <View style={styles.pacoteRight}>
              <Text style={[styles.pacoteValor, p.destaque && styles.pacoteValorDestaque]}>{p.valor}</Text>
              {isLoading
                ? <ActivityIndicator color="#4a9eff" size="small" />
                : <Text style={styles.pacoteSeta}>{brasil ? '🏦/🔵' : '🔵'}</Text>
              }
            </View>
          </TouchableOpacity>
        );
      })}

      {/* Informativo de indicação */}
      <View style={styles.indicacaoCard}>
        <Text style={styles.indicacaoEmoji}>🎁</Text>
        <Text style={styles.indicacaoTxt}>{t('comprar.referralMsg')}</Text>
      </View>

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
  saldoCard: { backgroundColor: '#1a1f2e', borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#2a3044' },
  saldoLabel: { color: '#94a3b8', fontSize: 14, marginBottom: 8 },
  saldoNum: { fontSize: 56, fontWeight: 'bold', lineHeight: 64 },
  saldoSub: { color: '#64748b', fontSize: 13, marginTop: 4 },
  metodoCard: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 12, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#4a9eff40' },
  metodoLabel: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  secaoTitulo: { color: '#fff', fontWeight: '700', fontSize: 16, marginBottom: 14 },
  pacoteCard: { backgroundColor: '#1a1f2e', borderRadius: 18, padding: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#2a3044', overflow: 'hidden' },
  pacoteDestaque: { borderColor: '#4a9eff', backgroundColor: '#111827' },
  destaqueTag: { position: 'absolute', top: 0, right: 0, backgroundColor: '#4a9eff', paddingHorizontal: 10, paddingVertical: 4, borderBottomLeftRadius: 10 },
  destaqueTxt: { color: '#fff', fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5 },
  pacoteLeft: { alignItems: 'center', marginRight: 16, minWidth: 52 },
  pacoteCorridas: { fontSize: 32, fontWeight: 'bold', color: '#fff' },
  pacoteCorridasDestaque: { color: '#4a9eff' },
  pacoteLabel: { color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  pacoteCenter: { flex: 1 },
  pacoteDescricao: { color: '#fff', fontWeight: '600', fontSize: 14, marginBottom: 3 },
  pacoteKm: { color: '#64748b', fontSize: 12 },
  pacoteRight: { alignItems: 'flex-end', gap: 6 },
  pacoteValor: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  pacoteValorDestaque: { color: '#4a9eff' },
  pacoteSeta: { color: '#4a5568', fontSize: 15 },
  indicacaoCard: { backgroundColor: '#0f2a1a', borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 8, borderWidth: 1, borderColor: '#22c55e' },
  indicacaoEmoji: { fontSize: 24 },
  indicacaoTxt: { flex: 1, color: '#94a3b8', fontSize: 13, lineHeight: 20 },
  // Modal PIX
  pixOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  pixCard: { backgroundColor: '#13161e', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 32, alignItems: 'center', gap: 14, borderTopWidth: 1, borderColor: '#2a3044' },
  pixTitulo: { color: '#fff', fontWeight: 'bold', fontSize: 22 },
  pixTimer: { color: '#f59e0b', fontWeight: '700', fontSize: 16 },
  pixQR: { width: 220, height: 220, borderRadius: 12 },
  pixInstrucao: { color: '#94a3b8', fontSize: 13 },
  copiaBox: { backgroundColor: '#1a1f2e', borderRadius: 14, padding: 14, width: '100%', borderWidth: 1, borderColor: '#2a3044', gap: 8 },
  copiaTxt: { color: '#64748b', fontSize: 10, lineHeight: 16 },
  copiaBtn: { color: '#4a9eff', fontWeight: '700', fontSize: 14 },
  pixAguardando: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pixAguardandoTxt: { color: '#22c55e', fontSize: 13, fontWeight: '600' },
  pixCancelar: { color: '#4a5568', fontSize: 14 },
  // Pago
  pagoEmoji: { fontSize: 56 },
  pagoTitulo: { color: '#22c55e', fontWeight: 'bold', fontSize: 22 },
  pagoSub: { color: '#94a3b8', fontSize: 14, textAlign: 'center' },
  pagoSaldoRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  pagoSaldoLabel: { color: '#94a3b8', fontSize: 15 },
  pagoSaldoNum: { color: '#22c55e', fontSize: 36, fontWeight: 'bold' },
  pagoBtn: { backgroundColor: '#22c55e', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 48, marginTop: 8 },
  pagoBtnTxt: { color: '#000', fontWeight: 'bold', fontSize: 16 },
});
