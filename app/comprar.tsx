import * as Localization from 'expo-localization';
import { useRouter } from 'expo-router';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  endConnection,
  ErrorCode,
  fetchProducts,
  finishTransaction,
  getReceiptIOS,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  type ProductIOS,
  type Purchase,
  type PurchaseError,
} from 'react-native-iap';
import { auth, db, functions } from '../firebaseConfig';

const isBrazil = (): boolean => {
  const locales = Localization.getLocales();
  const locale = locales[0];
  if (locale?.regionCode === 'BR') return true;
  if (locale?.languageTag?.includes('BR') || locale?.languageTag?.includes('pt-')) return true;
  const tz = Localization.getCalendars()[0]?.timeZone || '';
  return tz.startsWith('America/Sao_Paulo') || tz.startsWith('America/Fortaleza') ||
    tz.startsWith('America/Manaus') || tz.startsWith('America/Belem') || tz.includes('Brazil');
};

const PACOTES_BASE = [
  { id: '30',  sku: 'com.eluus.corridas30',  corridas: 30,  valor: 'R$ 29',  valorNum: 29,  priceUnit: 'R$ 0,97/corrida', descricaoKey: 'idealToStart',    destaque: false },
  { id: '50',  sku: 'com.eluus.corridas50',  corridas: 50,  valor: 'R$ 39',  valorNum: 39,  priceUnit: 'R$ 0,78/corrida', descricaoKey: 'mostPopularDesc', destaque: true  },
  { id: '100', sku: 'com.eluus.corridas100', corridas: 100, valor: 'R$ 69',  valorNum: 69,  priceUnit: 'R$ 0,69/corrida', descricaoKey: 'bestValue',       destaque: false },
  { id: '200', sku: 'com.eluus.corridas200', corridas: 200, valor: 'R$ 119', valorNum: 119, priceUnit: 'R$ 0,59/corrida', descricaoKey: 'superPack',       destaque: false },
];

const IAP_SKUS = PACOTES_BASE.map(p => p.sku);

export default function Comprar() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [creditos, setCreditos] = useState(0);
  const [carregando, setCarregando] = useState<string | null>(null);

  // Android — estado do modal PIX
  const [modalPix, setModalPix] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [qrCodeBase64, setQrCodeBase64] = useState('');
  const [timer, setTimer] = useState(1800);
  const [pago, setPago] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unsubPedidoRef = useRef<(() => void) | null>(null);

  // iOS — produtos da App Store
  const [iapProdutos, setIapProdutos] = useState<ProductIOS[]>([]);
  const [iapPronto, setIapPronto] = useState(false);
  const [iapErro, setIapErro] = useState(false);

  const brasil = isBrazil();

  const [modalCnh, setModalCnh] = useState(false);
  const [cnhInput, setCnhInput] = useState('');
  const [salvandoCnh, setSalvandoCnh] = useState(false);

  // Saldo em tempo real + verificar CNH
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsub = onSnapshot(doc(db, 'usuarios', uid), (snap) => {
      if (snap.exists()) {
        setCreditos(snap.data().creditos ?? 0);
        if (!snap.data().cnh) setModalCnh(true);
      }
    });
    return () => unsub();
  }, []);

  const salvarCnh = async () => {
    if (!cnhInput.trim()) { Alert.alert('Atenção', 'Digite o número da sua CNH'); return; }
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setSalvandoCnh(true);
    try {
      await updateDoc(doc(db, 'usuarios', uid), { cnh: cnhInput.trim() });
      setModalCnh(false);
      setCnhInput('');
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Não foi possível salvar a CNH');
    }
    setSalvandoCnh(false);
  };

  // IAP (iOS apenas)
  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    let purchaseListener: ReturnType<typeof purchaseUpdatedListener>;
    let errorListener: ReturnType<typeof purchaseErrorListener>;

    const setup = async () => {
      try {
        await initConnection();

        let products: ProductIOS[] = [];
        for (let tentativa = 0; tentativa < 3; tentativa++) {
          const resultado = await fetchProducts({ skus: IAP_SKUS, type: 'in-app' });
          products = resultado as ProductIOS[];
          if (products.length > 0) break;
          await new Promise(r => setTimeout(r, 1500));
        }

        if (products.length === 0) {
          setIapErro(true);
        } else {
          setIapProdutos(products);
        }
        setIapPronto(true);

        purchaseListener = purchaseUpdatedListener(async (purchase: Purchase) => {
          try {
            const receipt = await getReceiptIOS();
            if (!receipt) throw new Error('Receipt não obtido');
            const verifyFn = httpsCallable(functions, 'verifyAppleReceipt');
            await verifyFn({ receiptData: receipt, productId: purchase.productId });
            await finishTransaction({ purchase, isConsumable: true });
            setPago(true);
          } catch (e: any) {
            Alert.alert(t('comprar.errPagamento'), e.message || t('comprar.errPayment'));
            await finishTransaction({ purchase, isConsumable: true });
          }
          setCarregando(null);
        });

        errorListener = purchaseErrorListener((error: PurchaseError) => {
          if (error.code !== ErrorCode.UserCancelled) {
            Alert.alert(t('comprar.errPagamento'), error.message || t('comprar.errPayment'));
          }
          setCarregando(null);
        });
      } catch (e) {
        console.error('[IAP] initConnection error:', e);
        setIapErro(true);
        setIapPronto(true);
      }
    };

    setup();

    return () => {
      purchaseListener?.remove();
      errorListener?.remove();
      endConnection();
    };
  }, []);

  // Cleanup timers Android
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (unsubPedidoRef.current) unsubPedidoRef.current();
    };
  }, []);

  // ── iOS: StoreKit IAP ─────────────────────────────────────
  const comprarIAP = async (sku: string) => {
    const produto = iapProdutos.find(p => p.id === sku);
    if (!produto) {
      Alert.alert(t('comprar.errPagamento'), t('comprar.errProdutoNaoCarregado'));
      return;
    }
    setCarregando(sku);
    setPago(false);
    try {
      await requestPurchase({ request: { apple: { sku } }, type: 'in-app' });
    } catch (e: any) {
      if (e.code !== 'E_USER_CANCELLED') {
        Alert.alert(t('comprar.errPagamento'), e.message || t('comprar.errPayment'));
      }
      setCarregando(null);
    }
  };

  // ── Android: PIX ──────────────────────────────────────────
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
      Alert.alert(t('comprar.errPix'), e.message || 'Tente novamente');
    }
    setCarregando(null);
  };

  // ── Android: PayPal ───────────────────────────────────────
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
      Alert.alert(t('comprar.errPayPal'), e.message || t('comprar.errPayment'));
    }
    setCarregando(null);
  };

  const handleComprar = (pacote: typeof PACOTES_BASE[0]) => {
    if (Platform.OS === 'ios') {
      comprarIAP(pacote.sku);
      return;
    }
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
      setTimer(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); fecharModal(); return 0; }
        return prev - 1;
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
    Alert.alert(t('comprar.pixCopyTitle'), qrCode, [{ text: t('common.close') }]);
  };

  const getPrecoIos = (sku: string): string => {
    const produto = iapProdutos.find(p => p.id === sku);
    return produto?.displayPrice || '';
  };

  const labelMetodoPagamento = Platform.OS === 'ios'
    ? 'App Store'
    : brasil ? t('comprar.pixAndPaypal') : 'PayPal';

  const renderSucessoContent = (onClose: () => void) => (
    <>
      <Text style={styles.pagoEmoji}>✅</Text>
      <Text style={styles.pagoTitulo}>{t('comprar.paymentConfirmed')}</Text>
      <Text style={styles.pagoSub}>{t('comprar.creditsAdded')}</Text>
      <View style={styles.pagoSaldoRow}>
        <Text style={styles.pagoSaldoLabel}>{t('comprar.newBalance')}</Text>
        <Text style={styles.pagoSaldoNum}>{creditos}</Text>
        <Text style={styles.pagoSaldoLabel}> {t('comprar.credits')}</Text>
      </View>
      <TouchableOpacity style={styles.pagoBtn} onPress={onClose}>
        <Text style={styles.pagoBtnTxt}>{t('comprar.continue')}</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* Modal CNH */}
      <Modal visible={modalCnh} transparent animationType="fade">
        <View style={styles.pixOverlay}>
          <View style={styles.pixCard}>
            <Text style={styles.pixTitulo}>Número da CNH</Text>
            <Text style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', marginBottom: 8 }}>
              Para comprar créditos precisamos do número da sua CNH.
            </Text>
            <TextInput
              style={styles.cnhInput}
              placeholder="Número da CNH"
              placeholderTextColor="#4a5568"
              value={cnhInput}
              onChangeText={setCnhInput}
              keyboardType="numeric"
              maxLength={11}
            />
            <TouchableOpacity style={styles.pagoBtn} onPress={salvarCnh} disabled={salvandoCnh}>
              <Text style={styles.pagoBtnTxt}>{salvandoCnh ? 'Salvando…' : 'Salvar'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal PIX (Android) */}
      <Modal visible={modalPix} transparent animationType="slide" onRequestClose={fecharModal}>
        <View style={styles.pixOverlay}>
          <View style={styles.pixCard}>
            {pago ? renderSucessoContent(fecharModal) : (
              <>
                <Text style={styles.pixTitulo}>{t('comprar.payWithPix')}</Text>
                <Text style={styles.pixTimer}>⏱ {formatarTimer(timer)}</Text>
                {qrCodeBase64 ? (
                  <Image source={{ uri: `data:image/png;base64,${qrCodeBase64}` }} style={styles.pixQR} />
                ) : (
                  <ActivityIndicator color="#4a9eff" size="large" style={{ margin: 40 }} />
                )}
                <Text style={styles.pixInstrucao}>{t('comprar.pixInstrucao')}</Text>
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

      {/* Modal de sucesso IAP (iOS) */}
      <Modal visible={pago && Platform.OS === 'ios'} transparent animationType="slide" onRequestClose={() => setPago(false)}>
        <View style={styles.pixOverlay}>
          <View style={styles.pixCard}>
            {renderSucessoContent(() => setPago(false))}
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.voltarBtn}>
          <Text style={styles.voltarTxt}>{t('common.back')}</Text>
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

      {/* Método de pagamento */}
      <View style={styles.metodoCard}>
        <Text style={styles.metodoLabel}>
          {Platform.OS === 'ios' ? '🍎' : brasil ? '🏦' : '🔵'} {labelMetodoPagamento}
        </Text>
      </View>

      {/* Pacotes */}
      <Text style={styles.secaoTitulo}>{t('comprar.choosePlan')}</Text>

      {Platform.OS === 'ios' && !iapPronto && (
        <View style={styles.iapLoadingCard}>
          <ActivityIndicator color="#4a9eff" size="small" />
          <Text style={styles.iapLoadingTxt}>{t('comprar.carregandoProdutos')}</Text>
        </View>
      )}

      {Platform.OS === 'ios' && iapPronto && iapErro && (
        <View style={styles.iapErroCard}>
          <Text style={styles.iapErroTxt}>{t('comprar.errProdutosIndisponiveis')}</Text>
        </View>
      )}

      {PACOTES_BASE.map(p => {
        const loadingKey = Platform.OS === 'ios' ? p.sku : p.id;
        const isLoading = carregando === loadingKey || carregando === `paypal_${p.id}`;
        const descricao = t(`comprar.${p.descricaoKey}`);
        const precoExibido = Platform.OS === 'ios' ? (getPrecoIos(p.sku) || p.valor) : p.valor;
        const iapBloqueado = Platform.OS === 'ios' && (!iapPronto || iapErro);

        return (
          <TouchableOpacity
            key={p.id}
            style={[styles.pacoteCard, p.destaque && styles.pacoteDestaque, iapBloqueado && styles.pacoteDesabilitado]}
            onPress={() => handleComprar(p)}
            disabled={!!carregando || iapBloqueado}
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
              <Text style={styles.pacoteDescricao}>{descricao}</Text>
              <Text style={styles.pacoteKm}>{p.priceUnit}</Text>
            </View>
            <View style={styles.pacoteRight}>
              <Text style={[styles.pacoteValor, p.destaque && styles.pacoteValorDestaque]}>{precoExibido}</Text>
              {isLoading
                ? <ActivityIndicator color="#4a9eff" size="small" />
                : <Text style={styles.pacoteSeta}>{Platform.OS === 'ios' ? '🍎' : brasil ? '🏦/🔵' : '🔵'}</Text>
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

      <View style={{ height: insets.bottom + 24 }} />
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
  iapLoadingCard: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 4, marginBottom: 4 },
  iapLoadingTxt: { color: '#64748b', fontSize: 13 },
  iapErroCard: { backgroundColor: '#1a0f0f', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#ef444440' },
  iapErroTxt: { color: '#ef4444', fontSize: 13, textAlign: 'center' },
  pacoteDesabilitado: { opacity: 0.45 },
  indicacaoCard: { backgroundColor: '#0f2a1a', borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 8, borderWidth: 1, borderColor: '#22c55e' },
  indicacaoEmoji: { fontSize: 24 },
  indicacaoTxt: { flex: 1, color: '#94a3b8', fontSize: 13, lineHeight: 20 },
  // Modal PIX / sucesso
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
  pagoEmoji: { fontSize: 56 },
  pagoTitulo: { color: '#22c55e', fontWeight: 'bold', fontSize: 22 },
  pagoSub: { color: '#94a3b8', fontSize: 14, textAlign: 'center' },
  pagoSaldoRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  pagoSaldoLabel: { color: '#94a3b8', fontSize: 15 },
  pagoSaldoNum: { color: '#22c55e', fontSize: 36, fontWeight: 'bold' },
  pagoBtn: { backgroundColor: '#22c55e', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 48, marginTop: 8 },
  pagoBtnTxt: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  cnhInput: { backgroundColor: '#1a1f2e', borderRadius: 14, padding: 16, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#2a3044', width: '100%', marginBottom: 8 },
});
