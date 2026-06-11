import { Audio } from 'expo-av';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { addDoc, arrayRemove, collection, doc, getDoc, getDocs, increment, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Alert,
  AppState,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View
} from 'react-native';
import { auth, db } from '../firebaseConfig';

const DISTANCIA_AVISO = 200;

// Garante que notificações apareçam mesmo com o app em foreground
Notifications.setNotificationHandler({
  handleNotification: async (): Promise<Notifications.NotificationBehavior> => ({
    shouldShowAlert: true,
    shouldPlaySound: false, // som customizado já é tocado pelo expo-av
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function calcularDistancia(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export default function Motorista() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [online, setOnline] = useState(false);
  const [nomeUsuario, setNomeUsuario] = useState('');
  const [precoPorKm, setPrecoPorKm] = useState(2.5);
  const [corridas, setCorridas] = useState(0);
  const [codigo, setCodigo] = useState('');
  const [solicitacoes, setSolicitacoes] = useState<any[]>([]);
  const [solicitacaoAtiva, setSolicitacaoAtiva] = useState<any>(null);
  const [corridaAceita, setCorridaAceita] = useState<any>(null);
  const [mostrarNavegacao, setMostrarNavegacao] = useState(false);
  const [navegandoPara, setNavegandoPara] = useState<'passageiro' | 'parada' | 'destino'>('passageiro');
  const [mostrarChat, setMostrarChat] = useState(false);
  const [mensagens, setMensagens] = useState<any[]>([]);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [msgNaoLidas, setMsgNaoLidas] = useState(0);
  const corridaAceitaRef = useRef<any>(null);
  const avisouChegadaRef = useRef(false);
  const chatAbertoRef = useRef(false);
  const chatScrollRef = useRef<any>(null);
  const unsubUsuarioRef = useRef<any>(null);
  const unsubCorridasRef = useRef<any>(null);
  const unsubChatRef = useRef<any>(null);
  const locationWatchRef = useRef<any>(null);
  const solicitacoesAnteriores = useRef<number>(0);
  const somRef = useRef<Audio.Sound | null>(null);
  const somTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [avaliacaoMedia, setAvaliacaoMedia] = useState(5.0);
  const [mostrarModalAvaliacao, setMostrarModalAvaliacao] = useState(false);
  const [estrelasAvaliacao, setEstrelasAvaliacao] = useState(5);
  const [comentarioAvaliacao, setComentarioAvaliacao] = useState('');
  const [corridaParaAvaliar, setCorridaParaAvaliar] = useState<any>(null);
  const [creditos, setCreditos] = useState(0);
  const [cobrarDeslocamento, setCobrarDeslocamento] = useState(true);
  const [mostrarQR, setMostrarQR] = useState(false);
  const [mostrarDenuncia, setMostrarDenuncia] = useState(false);
  const [categoriaDenuncia, setCategoriaDenuncia] = useState('');
  const [textoDenuncia, setTextoDenuncia] = useState('');
  const [denunciando, setDenunciando] = useState(false);
  const [msgsPosCorridaBadge, setMsgsPosCorridaBadge] = useState(0);
  const unsubsMsgsPosRef = useRef<any[]>([]);
  const unsubCorridaAtivaRef = useRef<any>(null);
  const [passageiros, setPassageiros] = useState<any[]>([]);
  const unsubPassageirosRef = useRef<any>(null);
  const [mostrarConvidar, setMostrarConvidar] = useState(false);
  const [codigoConvite, setCodigoConvite] = useState('');
  const [enviandoConvite, setEnviandoConvite] = useState(false);

  useEffect(() => {
    registrarParaNotificacoes();
    carregarSom();
    escutarUsuario();
    escutarSolicitacoes();
    restaurarCorrida();
    escutarMsgsPosCorridaMotorista();
    escutarPassageiros();
    const appStateSub = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active') {
        verificarCorridasPendentesAoVoltar();
      }
    });
    return () => {
      pararNotificacao();
      somRef.current?.unloadAsync();
      if (unsubUsuarioRef.current) unsubUsuarioRef.current();
      if (unsubCorridasRef.current) unsubCorridasRef.current();
      if (unsubChatRef.current) unsubChatRef.current();
      if (locationWatchRef.current) locationWatchRef.current.remove();
      if (unsubCorridaAtivaRef.current) unsubCorridaAtivaRef.current();
      if (unsubPassageirosRef.current) unsubPassageirosRef.current();
      unsubsMsgsPosRef.current.forEach(u => u());
      appStateSub.remove();
    };
  }, []);

  useEffect(() => {
    if (corridaAceitaRef.current && (navegandoPara === 'passageiro' || navegandoPara === 'parada') && corridaAceitaRef.current.passageiroLat) {
      iniciarRastreamento();
    } else {
      pararRastreamento();
    }
  }, [corridaAceita, navegandoPara]);

  useEffect(() => {
    Notifications.setBadgeCountAsync(solicitacoes.length).catch(() => null);
  }, [solicitacoes]);

  const registrarParaNotificacoes = async () => {
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('corridas', {
          name: 'Novas Corridas',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 500, 200, 500, 200, 500],
          lightColor: '#4a9eff',
        });
      }
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId;
      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

      const uid = auth.currentUser?.uid;
      if (uid && token) {
        await updateDoc(doc(db, 'usuarios', uid), { expoPushToken: token });
      }
    } catch (e) {}

  };

  const carregarSom = async () => {
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        require('../assets/sounds/notificacao.mp3')
      );
      somRef.current = sound;
    } catch (e) {}
  };

  const pararNotificacao = async () => {
    if (somTimeoutRef.current) {
      clearTimeout(somTimeoutRef.current);
      somTimeoutRef.current = null;
    }
    try {
      if (somRef.current) {
        await somRef.current.stopAsync();
        await somRef.current.setIsLoopingAsync(false);
      }
    } catch (e) { /* som já parado */ }
  };

  const tocarNotificacao = async () => {
    try {
      if (!somRef.current) return;
      await somRef.current.setIsLoopingAsync(true);
      await somRef.current.setPositionAsync(0);
      await somRef.current.playAsync();
      if (somTimeoutRef.current) clearTimeout(somTimeoutRef.current);
      somTimeoutRef.current = setTimeout(pararNotificacao, 30_000);
    } catch (e) {}
  };

  const iniciarRastreamento = async () => {
    if (locationWatchRef.current) return;
    try {
      locationWatchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 20 },
        async (loc) => {
          if (!corridaAceitaRef.current?.passageiroLat) return;
          const dist = calcularDistancia(
            loc.coords.latitude, loc.coords.longitude,
            corridaAceitaRef.current.passageiroLat, corridaAceitaRef.current.passageiroLng
          );
          await updateDoc(doc(db, 'usuarios', auth.currentUser!.uid), {
            lat: loc.coords.latitude, lng: loc.coords.longitude,
          });
          if (dist <= DISTANCIA_AVISO && !avisouChegadaRef.current) {
            avisouChegadaRef.current = true;
            await avisarChegada(corridaAceitaRef.current.id, true);
          }
        }
      );
    } catch (e) {}
  };

  const pararRastreamento = () => {
    if (locationWatchRef.current) {
      locationWatchRef.current.remove();
      locationWatchRef.current = null;
    }
  };

  const escutarCorridaAtiva = (corridaId: string) => {
    if (unsubCorridaAtivaRef.current) unsubCorridaAtivaRef.current();
    unsubCorridaAtivaRef.current = onSnapshot(doc(db, 'corridas', corridaId), (snap) => {
      const data = snap.data();
      if (!data) return;
      const atual = corridaAceitaRef.current;
      const temNovaParada = data.paradaDescricao && (!atual?.paradaDescricao || data.paradaDescricao !== atual.paradaDescricao);
      const novoValor = data.valor !== atual?.valor;
      if (temNovaParada || novoValor) {
        const msgs: string[] = [];
        if (temNovaParada) msgs.push(t('motorista.rideUpdateStop', { stop: data.paradaDescricao }));
        if (novoValor) msgs.push(t('motorista.rideUpdateValue', { value: data.valor }));
        Alert.alert(t('motorista.rideUpdated'), msgs.join('\n'));
      }
      corridaAceitaRef.current = { id: corridaId, ...data };
      setCorridaAceita({ id: corridaId, ...data });
    });
  };

  const avisarChegada = async (corridaId: string, automatico = false) => {
    try {
      await updateDoc(doc(db, 'corridas', corridaId), {
        motoristaChegou: true, chegadaEm: new Date(),
      });
      if (!automatico) Alert.alert(t('motorista.arrivedNotification'), t('motorista.arrivedNotificationMsg'));
    } catch (e) {}
  };

  const verificarCorridasPendentesAoVoltar = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || corridaAceitaRef.current) return;
    try {
      const snap = await getDocs(query(
        collection(db, 'corridas'),
        where('motoristaId', '==', uid),
        where('status', '==', 'pendente'),
        orderBy('criadoEm', 'desc'),
        limit(1)
      ));
      if (!snap.empty) {
        const corridaDoc = snap.docs[0];
        const solicitacao = { id: corridaDoc.id, ...corridaDoc.data() };
        setSolicitacaoAtiva(solicitacao);
        tocarNotificacao();
        Vibration.vibrate([0, 500, 200, 500, 200, 500]);
      }
    } catch (e) {}
  };

  const marcarLidasMotorista = (msgs: any[], corridaId: string) => {
    msgs.forEach(m => {
      if (m.remetente === 'passageiro' && m.lida !== true) {
        updateDoc(doc(db, 'corridas', corridaId, 'mensagens', m.id), { lida: true }).catch(() => null);
      }
    });
  };

  const escutarChat = (corridaId: string) => {
    if (unsubChatRef.current) unsubChatRef.current();
    const q = query(collection(db, 'corridas', corridaId, 'mensagens'), orderBy('criadoEm', 'asc'));
    let primeiraLeitura = true;
    unsubChatRef.current = onSnapshot(q, (snap) => {
      const novas: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMensagens(novas);
      if (chatAbertoRef.current) {
        marcarLidasMotorista(novas, corridaId);
      }
      if (!primeiraLeitura) {
        const ultima = novas[novas.length - 1];
        if (ultima?.remetente === 'passageiro' && !chatAbertoRef.current) {
          setMsgNaoLidas(n => n + 1);
          Vibration.vibrate([0, 300, 100, 300]);
        }
      }
      primeiraLeitura = false;
    });
  };

  const enviarMensagem = async () => {
    if (!novaMensagem.trim() || !corridaAceitaRef.current) return;
    try {
      await addDoc(collection(db, 'corridas', corridaAceitaRef.current.id, 'mensagens'), {
        texto: novaMensagem.trim(),
        remetente: 'motorista',
        remetenteNome: nomeUsuario,
        criadoEm: new Date(),
      });
      setNovaMensagem('');
    } catch (e) { Alert.alert(t('common.error'), t('motorista.errSendMsg')); }
  };

  const abrirChat = () => {
    chatAbertoRef.current = true;
    setMsgNaoLidas(0);
    setMostrarChat(true);
    if (corridaAceitaRef.current) marcarLidasMotorista(mensagens, corridaAceitaRef.current.id);
  };
  const fecharChat = () => { chatAbertoRef.current = false; setMostrarChat(false); };

  const escutarUsuario = () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    unsubUsuarioRef.current = onSnapshot(doc(db, 'usuarios', uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setNomeUsuario(data.nome || '');
        setOnline(data.online || false);
        setPrecoPorKm(data.precoPorKm || 2.5);
        setCorridas(data.corridas || 0);
        setCodigo(data.codigo || '');
        setAvaliacaoMedia(data.avaliacaoMedia || 5.0);
        setCobrarDeslocamento(data.cobrarDeslocamento !== false);
        setCreditos(data.creditos ?? 0);
      }
    });
  };

  const escutarSolicitacoes = () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const q = query(collection(db, 'corridas'), where('motoristaId', '==', uid), where('status', '==', 'pendente'));
    unsubCorridasRef.current = onSnapshot(q, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSolicitacoes(lista);
      if (lista.length > solicitacoesAnteriores.current) {
        const nova = lista[lista.length - 1];
        setSolicitacaoAtiva(nova);
        tocarNotificacao();
        Vibration.vibrate([0, 500, 200, 500, 200, 500]);
      }
      solicitacoesAnteriores.current = lista.length;
    });
  };

  const restaurarCorrida = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      const snap = await getDocs(query(
        collection(db, 'corridas'),
        where('motoristaId', '==', uid),
        where('status', '==', 'aceita')
      ));
      if (snap.empty) return;
      const corridaDoc = snap.docs[0];
      const corridaData: any = { id: corridaDoc.id, ...corridaDoc.data() };
      corridaAceitaRef.current = corridaData;
      setCorridaAceita(corridaData);
      avisouChegadaRef.current = corridaData.motoristaChegou || false;
      setNavegandoPara(corridaData.motoristaChegou ? 'destino' : 'passageiro');
      escutarChat(corridaDoc.id);
      escutarCorridaAtiva(corridaDoc.id);
      await updateDoc(doc(db, 'usuarios', uid), { online: true });
    } catch (e) {}
  };

  const escutarMsgsPosCorridaMotorista = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const h48Atras = new Date(Date.now() - 48 * 60 * 60 * 1000);
    try {
      const snap = await getDocs(query(
        collection(db, 'corridas'),
        where('motoristaId', '==', uid),
        where('status', '==', 'finalizada'),
        where('finalizadaEm', '>=', h48Atras)
      ));
      unsubsMsgsPosRef.current.forEach(u => u());
      unsubsMsgsPosRef.current = [];
      const contadores: Record<string, number> = {};
      snap.docs.forEach(corridaDoc => {
        const corridaId = corridaDoc.id;
        const q = query(
          collection(db, 'corridas', corridaId, 'mensagens'),
          where('remetente', '==', 'passageiro'),
          where('lida', '!=', true)
        );
        const unsub = onSnapshot(q, msgSnap => {
          contadores[corridaId] = msgSnap.docs.length;
          setMsgsPosCorridaBadge(Object.values(contadores).reduce((a, b) => a + b, 0));
        });
        unsubsMsgsPosRef.current.push(unsub);
      });
    } catch (e) { /* não crítico */ }
  };

  const copiarCodigo = async () => {
    await Clipboard.setStringAsync(codigo);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(t('common.copied') || 'Copiado!', codigo);
  };

  const toggleOnline = async (valor: boolean) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      if (!valor) {
        // Salva última localização antes de ficar offline
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          await updateDoc(doc(db, 'usuarios', uid), {
            online: false,
            ultimaLocalizacao: { lat: loc.coords.latitude, lng: loc.coords.longitude, atualizadoEm: new Date() },
          });
        } catch (_) {
          await updateDoc(doc(db, 'usuarios', uid), { online: false });
        }
      } else {
        await updateDoc(doc(db, 'usuarios', uid), { online: true });
      }
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message || 'Não foi possível atualizar status');
      return;
    }
    if (valor) {
      // Busca localização precisa em background sem bloquear o toggle
      (async () => {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') return;
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          await updateDoc(doc(db, 'usuarios', uid), {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          });
        } catch (_) {}
      })();
    }
  };

  const responderSolicitacao = async (corridaId: string, aceitar: boolean, solicitacao: any) => {
    pararNotificacao();
    if (aceitar && creditos <= 0) {
      Alert.alert(
        t('motorista.noCredits'),
        t('motorista.noCreditsMsg'),
        [
          { text: t('motorista.later'), style: 'cancel' },
          { text: t('motorista.buyNow'), onPress: () => router.push('/comprar') },
        ]
      );
      return;
    }
    try {
      if (aceitar) {
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        // Batch atômico: aceita corrida + debita crédito simultaneamente
        const batch = writeBatch(db);
        batch.update(doc(db, 'corridas', corridaId), {
          status: 'aceita', atualizadoEm: new Date(),
        });
        batch.update(doc(db, 'usuarios', uid), {
          corridas: increment(1),
          creditos: increment(-1),
          corridasUsadas: increment(1),
        });
        await batch.commit();
        setSolicitacaoAtiva(null);
        corridaAceitaRef.current = solicitacao;
        setCorridaAceita(solicitacao);
        avisouChegadaRef.current = false;
        setNavegandoPara('passageiro');
        setMostrarNavegacao(true);
        escutarChat(corridaId);
        escutarCorridaAtiva(corridaId);
      } else {
        await updateDoc(doc(db, 'corridas', corridaId), {
          status: 'recusada', atualizadoEm: new Date(),
        });
        setSolicitacaoAtiva(null);
      }
    } catch (e) { Alert.alert(t('common.error'), t('motorista.errResponse')); }
  };

  const cancelarCorrida = async () => {
    if (!corridaAceitaRef.current) return;
    Alert.alert(t('motorista.cancelRideTitle'), t('motorista.cancelRideMsg'), [
      { text: t('common.no'), style: 'cancel' },
      { text: t('motorista.yesCancel'), style: 'destructive', onPress: async () => {
        await updateDoc(doc(db, 'corridas', corridaAceitaRef.current.id), {
          status: 'cancelada', canceladoPor: 'motorista', canceladoEm: new Date(),
        });
        pararRastreamento();
        if (unsubCorridaAtivaRef.current) unsubCorridaAtivaRef.current();
        corridaAceitaRef.current = null;
        setCorridaAceita(null);
        setMostrarNavegacao(false);
        setMostrarChat(false);
        if (unsubChatRef.current) unsubChatRef.current();
      }}
    ]);
  };

  const verificarIndicacao = async (passageiroId: string) => {
    if (!passageiroId) return;
    try {
      const passageiroRef = doc(db, 'usuarios', passageiroId);
      const passageiroSnap = await getDoc(passageiroRef);
      const passageiro = passageiroSnap.data();
      if (!passageiro || passageiro.primeiraCorrida !== false) return;

      let motoristaIndicadorRef: any = null;
      if (passageiro.indicadoPor) {
        const snap = await getDocs(query(
          collection(db, 'usuarios'),
          where('codigo', '==', passageiro.indicadoPor),
          where('tipo', '==', 'motorista'),
          limit(1)
        ));
        if (!snap.empty) motoristaIndicadorRef = snap.docs[0].ref;
      }

      await runTransaction(db, async (t) => {
        const reSnap = await t.get(passageiroRef);
        if (reSnap.data()?.primeiraCorrida !== false) return;
        t.update(passageiroRef, { primeiraCorrida: true });
        if (motoristaIndicadorRef) t.update(motoristaIndicadorRef, { creditos: increment(5) });
      });
    } catch (e) { /* não crítico */ }
  };

  const encerrarCorrida = async () => {
    if (!corridaAceitaRef.current) return;
    Alert.alert(t('motorista.finishRideTitle'), t('motorista.finishRideMsg'), [
      { text: t('common.no'), style: 'cancel' },
      { text: t('motorista.yesFinish'), onPress: async () => {
        const corridaInfo = { ...corridaAceitaRef.current };
        await updateDoc(doc(db, 'corridas', corridaAceitaRef.current.id), {
          status: 'finalizada', finalizadaEm: new Date(),
        });
        verificarIndicacao(corridaInfo.passageiroId).catch(() => null);
        pararRastreamento();
        if (unsubCorridaAtivaRef.current) unsubCorridaAtivaRef.current();
        corridaAceitaRef.current = null;
        setCorridaAceita(null);
        setMostrarNavegacao(false);
        setMostrarChat(false);
        if (unsubChatRef.current) unsubChatRef.current();
        setCorridaParaAvaliar(corridaInfo);
        setEstrelasAvaliacao(5);
        setComentarioAvaliacao('');
        setMostrarModalAvaliacao(true);
      }}
    ]);
  };

  const salvarAvaliacaoPassageiro = async (pular: boolean) => {
    setMostrarModalAvaliacao(false);
    if (pular || !corridaParaAvaliar) return;
    try {
      await updateDoc(doc(db, 'corridas', corridaParaAvaliar.id), {
        avaliacaoPassageiro: { estrelas: estrelasAvaliacao, comentario: comentarioAvaliacao, criadoEm: new Date() },
      });
      const passageiroRef = doc(db, 'usuarios', corridaParaAvaliar.passageiroId);
      const passageiroSnap = await getDoc(passageiroRef);
      if (passageiroSnap.exists()) {
        const d = passageiroSnap.data();
        const total = d.totalAvaliacoes || 0;
        const media = d.avaliacaoMedia || 5.0;
        const novoTotal = total + 1;
        const novaMedia = ((media * total) + estrelasAvaliacao) / novoTotal;
        await updateDoc(passageiroRef, {
          avaliacaoMedia: parseFloat(novaMedia.toFixed(2)),
          totalAvaliacoes: novoTotal,
        });
      }
    } catch (e) {}
  };

  const getAvaliacaoLabel = (n: number) => {
    const labels = ['', t('common.rating1'), t('common.rating2'), t('common.rating3'), t('common.rating4'), t('common.rating5')];
    return labels[n] || '';
  };

  const abrirNavegacao = (app: string) => {
    if (!corridaAceitaRef.current) return;
    let lat, lng;
    if (navegandoPara === 'passageiro') {
      lat = corridaAceitaRef.current.passageiroLat;
      lng = corridaAceitaRef.current.passageiroLng;
    } else if (navegandoPara === 'parada') {
      lat = corridaAceitaRef.current.paradaLat;
      lng = corridaAceitaRef.current.paradaLng;
    } else {
      lat = corridaAceitaRef.current.destLat;
      lng = corridaAceitaRef.current.destLng;
    }
    if (!lat || !lng) { Alert.alert(t('common.attention'), t('motorista.locationUnavailable')); return; }
    let url = '';
    if (app === 'google') url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    else if (app === 'waze') url = `waze://?ll=${lat},${lng}&navigate=yes`;
    else if (app === 'apple') url = `maps://?daddr=${lat},${lng}`;
    Linking.canOpenURL(url).then(supported => {
      Linking.openURL(supported ? url : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`);
    });
    setMostrarNavegacao(false);
  };

  const enviarDenuncia = async () => {
    if (!categoriaDenuncia) { Alert.alert(t('common.attention'), t('motorista.errSelectCategory')); return; }
    if (!textoDenuncia.trim()) { Alert.alert(t('common.attention'), t('motorista.errDescribe')); return; }
    setDenunciando(true);
    try {
      await addDoc(collection(db, 'denuncias'), {
        denuncianteId: auth.currentUser?.uid,
        tipo: 'passageiro',
        corridaId: corridaAceitaRef.current?.id || corridaParaAvaliar?.id || null,
        denunciadoId: corridaAceitaRef.current?.passageiroId || corridaParaAvaliar?.passageiroId || null,
        denunciadoNome: corridaAceitaRef.current?.passageiroNome || corridaParaAvaliar?.passageiroNome || null,
        categoria: categoriaDenuncia,
        descricao: textoDenuncia.trim(),
        criadoEm: new Date(),
      });
      setMostrarDenuncia(false);
      setCategoriaDenuncia('');
      setTextoDenuncia('');
      Alert.alert(t('motorista.reportSent'), t('motorista.reportSentMsg'));
    } catch (e) { Alert.alert(t('common.error'), t('motorista.errSendReport')); }
    setDenunciando(false);
  };

  const escutarPassageiros = () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    if (unsubPassageirosRef.current) unsubPassageirosRef.current();
    const q = query(
      collection(db, 'usuarios'),
      where('tipo', '==', 'passageiro'),
      where('motoristas', 'array-contains', uid)
    );
    unsubPassageirosRef.current = onSnapshot(q, (snap) => {
      setPassageiros(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  };

  const removerPassageiro = async (passageiroId: string, passageiroNome: string) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    Alert.alert(
      'Remover passageiro',
      `Deseja remover ${passageiroNome} da sua rede?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'Remover', style: 'destructive', onPress: async () => {
            try {
              await updateDoc(doc(db, 'usuarios', passageiroId), { motoristas: arrayRemove(uid) });
            } catch (e) {
              Alert.alert(t('common.error'), 'Não foi possível remover o passageiro');
            }
          },
        },
      ]
    );
  };

  const convidarPassageiro = async () => {
    if (!codigoConvite || codigoConvite.length < 6) {
      Alert.alert(t('common.attention'), 'Digite o código completo do passageiro');
      return;
    }
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setEnviandoConvite(true);
    try {
      const q = query(
        collection(db, 'usuarios'),
        where('codigo', '==', codigoConvite.toUpperCase()),
        where('tipo', '==', 'passageiro')
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        Alert.alert('Não encontrado', 'Passageiro com este código não encontrado');
        setEnviandoConvite(false);
        return;
      }
      const passageiroDoc = snap.docs[0];
      const passageiroNome = passageiroDoc.data().nome || 'Passageiro';

      if (passageiros.some(p => p.id === passageiroDoc.id)) {
        Alert.alert(t('common.attention'), `${passageiroNome} já está na sua rede`);
        setEnviandoConvite(false);
        return;
      }

      const conviteExistente = await getDocs(query(
        collection(db, 'convites'),
        where('deId', '==', uid),
        where('paraId', '==', passageiroDoc.id),
        where('status', '==', 'pendente')
      ));
      if (!conviteExistente.empty) {
        Alert.alert(t('common.attention'), `Convite já enviado para ${passageiroNome}`);
        setEnviandoConvite(false);
        return;
      }

      await addDoc(collection(db, 'convites'), {
        deId: uid,
        deNome: nomeUsuario,
        paraId: passageiroDoc.id,
        status: 'pendente',
        criadoEm: serverTimestamp(),
      });

      Alert.alert('Convite enviado', `Convite enviado para ${passageiroNome}`);
      setCodigoConvite('');
      setMostrarConvidar(false);
    } catch (e) {
      Alert.alert(t('common.error'), 'Não foi possível enviar o convite');
    }
    setEnviandoConvite(false);
  };

  const primeiroNome = nomeUsuario.split(' ')[0];

  return (
    <View style={styles.wrapper}>

      {/* Modal QR Code */}
      <Modal visible={mostrarQR} transparent animationType="fade" onRequestClose={() => setMostrarQR(false)}>
        <View style={styles.qrOverlay}>
          <View style={styles.qrCard}>
            <TouchableOpacity style={styles.qrFechar} onPress={() => setMostrarQR(false)}>
              <Text style={styles.qrFecharTxt}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.qrTitulo}>{t('motorista.myQrCode')}</Text>
            <Image source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent('https://voucom-285e0.web.app/m?c=' + codigo)}&bgcolor=13161e&color=4a9eff&margin=10` }} style={styles.qrImage} />
            <TouchableOpacity onPress={copiarCodigo} activeOpacity={0.7}>
              <Text style={styles.qrCodigo}>{codigo}</Text>
            </TouchableOpacity>
            <Text style={styles.qrInfo}>{t('motorista.qrInfo')}</Text>
          </View>
        </View>
      </Modal>

      {/* Modal Denúncia */}
      <Modal visible={mostrarDenuncia} transparent animationType="slide" onRequestClose={() => setMostrarDenuncia(false)}>
        <KeyboardAvoidingView style={styles.denunciaOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.denunciaCard}>
            <Text style={styles.denunciaTitulo}>{t('motorista.reportTitle')}</Text>
            <Text style={styles.denunciaLabel}>{t('motorista.reportCategory')}</Text>
            <View style={styles.categoriasRow}>
              {[
                { v: 'Comportamento', l: t('motorista.catBehavior') },
                { v: 'Segurança', l: t('motorista.catSecurity') },
                { v: 'Fraude', l: t('motorista.catFraud') },
                { v: 'Outro', l: t('motorista.catOther') },
              ].map(c => (
                <TouchableOpacity key={c.v} style={[styles.categoriaBtn, categoriaDenuncia === c.v && styles.categoriaBtnAtivo]} onPress={() => setCategoriaDenuncia(c.v)}>
                  <Text style={[styles.categoriaTxt, categoriaDenuncia === c.v && styles.categoriaTxtAtivo]}>{c.l}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.denunciaLabel}>{t('motorista.reportDescribe')}</Text>
            <TextInput
              style={styles.denunciaInput}
              placeholder={t('motorista.reportWhatHappened')}
              placeholderTextColor="#4a5568"
              value={textoDenuncia}
              onChangeText={setTextoDenuncia}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <TouchableOpacity style={styles.denunciaEnviarBtn} onPress={enviarDenuncia} disabled={denunciando}>
              <Text style={styles.denunciaEnviarTxt}>{denunciando ? t('motorista.reportSending') : t('motorista.reportSendBtn')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setMostrarDenuncia(false); setCategoriaDenuncia(''); setTextoDenuncia(''); }}>
              <Text style={styles.denunciaCancelarTxt}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal avaliação */}
      <Modal visible={mostrarModalAvaliacao} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.avaliacaoCard} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.avaliacaoEmoji}>⭐</Text>
            <Text style={styles.avaliacaoTitulo}>{t('motorista.ratePassengerTitle')}</Text>
            <Text style={styles.avaliacaoSub}>{t('motorista.ratePassengerSub', { name: corridaParaAvaliar?.passageiroNome })}</Text>
            <View style={styles.estrelasRow}>
              {[1, 2, 3, 4, 5].map(i => (
                <TouchableOpacity key={i} onPress={() => setEstrelasAvaliacao(i)}>
                  <Text style={[styles.estrelaIcon, { color: i <= estrelasAvaliacao ? '#f59e0b' : '#2a3044' }]}>★</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.avaliacaoNota}>{getAvaliacaoLabel(estrelasAvaliacao)}</Text>
            <TextInput
              style={styles.avaliacaoInput}
              placeholder={t('motorista.commentPlaceholder')}
              placeholderTextColor="#4a5568"
              value={comentarioAvaliacao}
              onChangeText={setComentarioAvaliacao}
              multiline
              numberOfLines={3}
            />
            <TouchableOpacity style={styles.avaliacaoBtn} onPress={() => salvarAvaliacaoPassageiro(false)}>
              <Text style={styles.avaliacaoBtnTxt}>{t('passageiro.sendRating')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => salvarAvaliacaoPassageiro(true)}>
              <Text style={styles.avaliacaoPularTxt}>{t('common.skip')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal solicitação */}
      <Modal visible={!!solicitacaoAtiva} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalEmoji}>🚗</Text>
            <Text style={styles.modalTitulo}>{t('motorista.newRide')}</Text>
            {solicitacaoAtiva && (
              <>
                <Text style={styles.modalPassageiro}>{solicitacaoAtiva.passageiroNome}</Text>
                <View style={styles.modalDestBox}>
                  <Text style={styles.modalDestLabel}>{t('motorista.origin')}</Text>
                  <Text style={styles.modalDestino}>{solicitacaoAtiva.passageiroEndereco || t('motorista.currentLocation')}</Text>
                </View>
                <View style={styles.modalDestBox}>
                  <Text style={styles.modalDestLabel}>{t('motorista.destination')}</Text>
                  <Text style={styles.modalDestino}>{solicitacaoAtiva.destino}</Text>
                </View>
                <View style={styles.modalInfoRow}>
                  <View style={styles.modalInfoItem}>
                    <Text style={styles.modalInfoLabel}>{t('motorista.distance')}</Text>
                    <Text style={styles.modalInfoValor}>{solicitacaoAtiva.distancia} km</Text>
                  </View>
                  <View style={styles.modalInfoItem}>
                    <Text style={styles.modalInfoLabel}>{t('motorista.value')}</Text>
                    <Text style={styles.modalInfoPreco}>$ {solicitacaoAtiva.valor}</Text>
                  </View>
                </View>
                <View style={styles.modalBtns}>
                  <TouchableOpacity style={styles.recusarBtn} onPress={() => responderSolicitacao(solicitacaoAtiva.id, false, solicitacaoAtiva)}>
                    <Text style={styles.recusarTxt}>{t('motorista.refuse')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.aceitarBtn} onPress={() => responderSolicitacao(solicitacaoAtiva.id, true, solicitacaoAtiva)}>
                    <Text style={styles.aceitarTxt}>{t('motorista.accept')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal navegação */}
      <Modal visible={mostrarNavegacao} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalEmoji}>{navegandoPara === 'passageiro' ? '🧍' : navegandoPara === 'parada' ? '🔶' : '📍'}</Text>
            <Text style={styles.modalTitulo}>
              {navegandoPara === 'passageiro' ? t('motorista.fetchPassenger') : navegandoPara === 'parada' ? t('motorista.goToStop') : t('motorista.goToDest')}
            </Text>
            {corridaAceita && (
              <>
                <View style={styles.modalDestBox}>
                  <Text style={styles.modalDestLabel}>
                    {navegandoPara === 'passageiro' ? t('motorista.navPassengerLabel') : navegandoPara === 'parada' ? t('motorista.navStopLabel') : t('motorista.navDestLabel')}
                  </Text>
                  <Text style={styles.modalDestino}>
                    {navegandoPara === 'passageiro'
                      ? corridaAceita.passageiroNome
                      : navegandoPara === 'parada'
                      ? corridaAceita.paradaDescricao
                      : corridaAceita.destino}
                  </Text>
                </View>
                {corridaAceita.paradaDescricao && (
                  <View style={styles.modalDestBox}>
                    <Text style={styles.modalDestLabel}>{t('motorista.navStop2')}</Text>
                    <Text style={styles.modalDestino}>{corridaAceita.paradaDescricao}</Text>
                  </View>
                )}
                <Text style={styles.navSubtitulo}>{t('motorista.openWith')}</Text>
                <View style={styles.navBtns}>
                  <TouchableOpacity style={styles.navBtn} onPress={() => abrirNavegacao('google')}>
                    <Text style={styles.navBtnEmoji}>🗺️</Text>
                    <Text style={styles.navBtnTxt}>Google Maps</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.navBtn} onPress={() => abrirNavegacao('waze')}>
                    <Text style={styles.navBtnEmoji}>🚦</Text>
                    <Text style={styles.navBtnTxt}>Waze</Text>
                  </TouchableOpacity>
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity style={styles.navBtn} onPress={() => abrirNavegacao('apple')}>
                      <Text style={styles.navBtnEmoji}>🍎</Text>
                      <Text style={styles.navBtnTxt}>Apple Maps</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {navegandoPara === 'passageiro' && (
                  <TouchableOpacity style={styles.proximoBtn} onPress={() => {
                    if (corridaAceita?.paradaDescricao) {
                      setNavegandoPara('parada');
                    } else {
                      setNavegandoPara('destino');
                    }
                  }}>
                    <Text style={styles.proximoBtnTxt}>
                      {corridaAceita?.paradaDescricao ? t('motorista.passengerFetchedStop') : t('motorista.passengerFetched')}
                    </Text>
                  </TouchableOpacity>
                )}
                {navegandoPara === 'parada' && (
                  <TouchableOpacity style={styles.proximoBtn} onPress={() => setNavegandoPara('destino')}>
                    <Text style={styles.proximoBtnTxt}>{t('motorista.stopPassed')}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.fecharNavBtn} onPress={() => setMostrarNavegacao(false)}>
                  <Text style={styles.fecharNavTxt}>{t('common.close')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal chat */}
      <Modal visible={mostrarChat} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.chatOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.chatCard}>
            <View style={styles.chatHeader}>
              <Text style={styles.chatTitulo}>{t('motorista.chatWith', { name: corridaAceita?.passageiroNome })}</Text>
              <TouchableOpacity onPress={fecharChat}>
                <Text style={styles.chatFechar}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              ref={chatScrollRef}
              style={styles.chatMensagens}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: false })}>
              {mensagens.length === 0 && <Text style={styles.chatVazio}>{t('motorista.noMessages')}</Text>}
              {mensagens.map((m: any) => (
                <View key={m.id} style={[styles.msgBubble, m.remetente === 'motorista' ? styles.msgMinha : styles.msgDele]}>
                  <Text style={styles.msgTxt}>{m.texto}</Text>
                  {m.remetente === 'motorista' && (
                    <Text style={styles.msgRecibo}>{m.lida ? '✓✓' : '✓'}</Text>
                  )}
                </View>
              ))}
            </ScrollView>
            <View style={styles.chatInput}>
              <TextInput style={styles.chatTextInput} placeholder={t('motorista.messagePlaceholder')} placeholderTextColor="#4a5568" value={novaMensagem} onChangeText={setNovaMensagem} />
              <TouchableOpacity style={styles.chatEnviar} onPress={enviarMensagem}>
                <Text style={styles.chatEnviarTxt}>➤</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>eluus</Text>
            <Text style={styles.bemvindo}>{t('motorista.hello')}, {primeiroNome} 👋</Text>
          </View>
          <View style={styles.headerBtns}>
            <TouchableOpacity onPress={() => router.push('/relatorio')} style={styles.headerBtn}>
              <Text style={styles.headerBtnTxt}>📊</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/historico')} style={styles.headerBtn}>
              <View>
                <Text style={styles.headerBtnTxt}>🕐</Text>
                {msgsPosCorridaBadge > 0 && (
                  <View style={styles.badgeDot}>
                    <Text style={styles.badgeTxt}>{msgsPosCorridaBadge > 9 ? '9+' : msgsPosCorridaBadge}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/perfil')} style={styles.headerBtn}>
              <Text style={styles.headerBtnTxt}>👤</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Status online */}
        <View style={[styles.statusCard, online ? styles.statusOnline : styles.statusOffline]}>
          <View style={styles.statusLeft}>
            <Text style={styles.statusEmoji}>{online ? '🟢' : '⚫'}</Text>
            <View>
              <Text style={styles.statusTitulo}>{online ? t('motorista.online') : t('motorista.offline')}</Text>
              <Text style={styles.statusSub}>{online ? t('motorista.onlineSub') : t('motorista.offlineSub')}</Text>
            </View>
          </View>
          <Switch value={online} onValueChange={toggleOnline} trackColor={{ false: '#2a3044', true: '#22c55e' }} thumbColor="#fff" />
        </View>

        {/* Corrida ativa */}
        {corridaAceita && (
          <View style={styles.corridaAtivaCard}>
            <View style={styles.corridaAtivaTop}>
              <Text style={styles.corridaAtivaEmoji}>🧭</Text>
              <View style={styles.corridaAtivaInfo}>
                <Text style={styles.corridaAtivaTitulo}>{t('motorista.rideInProgress')}</Text>
                <Text style={styles.corridaAtivaPassageiro}>👤 {corridaAceita.passageiroNome}</Text>
                <Text style={styles.corridaAtivaDestino}>📍 {corridaAceita.destino}</Text>
                {corridaAceita.paradaDescricao && (
                  <Text style={styles.corridaAtivaDestino}>🔶 {t('passageiro.stopPrefix')}: {corridaAceita.paradaDescricao}</Text>
                )}
                <Text style={styles.corridaAtivaValor}>💰 $ {corridaAceita.valor} · {corridaAceita.distancia} km</Text>
              </View>
            </View>
            <View style={styles.corridaAtivaBtns}>
              <TouchableOpacity style={styles.corridaBtnNav} onPress={() => setMostrarNavegacao(true)}>
                <Text style={styles.corridaBtnTxt}>{t('motorista.navigate')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.corridaBtnChat} onPress={abrirChat}>
                <Text style={styles.corridaBtnTxt}>💬 Chat{msgNaoLidas > 0 ? ` (${msgNaoLidas})` : ''}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.corridaAtivaBtns}>
              <TouchableOpacity style={styles.corridaBtnChegou} onPress={() => avisarChegada(corridaAceita.id)}>
                <Text style={styles.corridaBtnTxt}>{t('motorista.arrivedBtn')}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.corridaAtivaBtns}>
              <TouchableOpacity style={styles.corridaBtnCancelar} onPress={cancelarCorrida}>
                <Text style={styles.corridaBtnCancelarTxt}>{t('motorista.cancelRide')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.corridaBtnFinalizar} onPress={encerrarCorrida}>
                <Text style={styles.corridaBtnFinalizarTxt}>{t('motorista.finishRide')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Stats */}
        <View style={styles.stats}>
          <View style={styles.statCard}>
            <Text style={styles.statValor}>{corridas}</Text>
            <Text style={styles.statLabel}>{t('motorista.rides')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValor}>$ {precoPorKm.toFixed(2)}</Text>
            <Text style={styles.statLabel}>{t('motorista.perKm')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValor}>⭐ {avaliacaoMedia.toFixed(1)}</Text>
            <Text style={styles.statLabel}>{t('motorista.rating')}</Text>
          </View>
        </View>

        {/* Créditos */}
        <TouchableOpacity
          style={[
            styles.creditosCard,
            creditos === 0 && styles.creditosCardZero,
            creditos > 0 && creditos <= 10 && styles.creditosCardBaixo,
          ]}
          onPress={() => router.push('/comprar')}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.creditosTitulo}>{t('motorista.credits')}</Text>
            <Text style={styles.creditosSub}>
              {creditos === 0
                ? t('motorista.creditsZero')
                : creditos <= 10
                ? t('motorista.ridesLow', { count: creditos, plural: creditos !== 1 ? 's' : '' })
                : t('motorista.ridesAvailable', { count: creditos })}
            </Text>
          </View>
          <Text style={[styles.creditosNum, { color: creditos === 0 ? '#ef4444' : creditos <= 10 ? '#f59e0b' : '#22c55e' }]}>
            {creditos}
          </Text>
        </TouchableOpacity>

        {/* Preço por km */}
        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>{t('motorista.pricePerKm')}</Text>
          <View style={styles.precoCard}>
            <TouchableOpacity style={styles.precoBtn} onPress={async () => {
              const novo = parseFloat(Math.max(1, precoPorKm - 0.1).toFixed(2));
              await updateDoc(doc(db, 'usuarios', auth.currentUser!.uid), { precoPorKm: novo });
            }}>
              <Text style={styles.precoBtnTxt}>−</Text>
            </TouchableOpacity>
            <Text style={styles.precoValor}>$ {precoPorKm.toFixed(2)}/km</Text>
            <TouchableOpacity style={styles.precoBtn} onPress={async () => {
              const novo = parseFloat((precoPorKm + 0.1).toFixed(2));
              await updateDoc(doc(db, 'usuarios', auth.currentUser!.uid), { precoPorKm: novo });
            }}>
              <Text style={styles.precoBtnTxt}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.precoInfo}>{t('motorista.priceInfo')}</Text>
        </View>

        {/* Cobrar deslocamento */}
        <View style={styles.secao}>
          <View style={styles.deslocamentoCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.deslocamentoTitulo}>{t('motorista.cobrarDesl')}</Text>
              <Text style={styles.deslocamentoSub}>{t('motorista.cobrarDeslSub')}</Text>
            </View>
            <Switch
              value={cobrarDeslocamento}
              onValueChange={async (v) => {
                setCobrarDeslocamento(v);
                const uid = auth.currentUser?.uid;
                if (uid) await updateDoc(doc(db, 'usuarios', uid), { cobrarDeslocamento: v });
              }}
              trackColor={{ false: '#2a3044', true: '#1a2a4a' }}
              thumbColor={cobrarDeslocamento ? '#4a9eff' : '#64748b'}
            />
          </View>
        </View>

        {/* Código */}
        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>{t('motorista.myCode')}</Text>
          <View style={styles.codigoCard}>
            <TouchableOpacity onPress={copiarCodigo} activeOpacity={0.7}>
              <Text style={styles.codigoTxt}>{codigo}</Text>
              <Text style={styles.codigoCopiarHint}>📋 {t('common.tapToCopy') || 'Toque para copiar'}</Text>
            </TouchableOpacity>
            <Text style={styles.codigoSub}>{t('motorista.shareCode')}</Text>
            <View style={styles.codigoBtnsRow}>
              <TouchableOpacity style={styles.codigoAcaoBtn} onPress={() => setMostrarQR(true)}>
                <Text style={styles.codigoAcaoTxt}>{t('motorista.viewQrCode')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.codigoAcaoBtn} onPress={() => setMostrarDenuncia(true)}>
                <Text style={[styles.codigoAcaoTxt, { color: '#ef4444' }]}>{t('motorista.reportBtn')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Solicitações */}
        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>{t('motorista.myRequests')} {solicitacoes.length > 0 ? `(${solicitacoes.length})` : ''}</Text>
          {solicitacoes.length === 0 ? (
            <View style={styles.vazio}>
              <Text style={styles.vazioemoji}>🕐</Text>
              <Text style={styles.vaziotxt}>{t('motorista.noRequests')}</Text>
              <Text style={styles.vaziossub}>{t('motorista.noRequestsSub')}</Text>
            </View>
          ) : (
            solicitacoes.map((s: any) => (
              <TouchableOpacity key={s.id} style={styles.solicitacaoCard} onPress={() => setSolicitacaoAtiva(s)}>
                <Text style={styles.solicitacaoEmoji}>🧍</Text>
                <View style={styles.solicitacaoInfo}>
                  <Text style={styles.solicitacaoNome}>{s.passageiroNome}</Text>
                  <Text style={styles.solicitacaoDestino}>📍 {s.destino}</Text>
                  <Text style={styles.solicitacaoValor}>$ {s.valor} · {s.distancia} km</Text>
                </View>
                <Text style={styles.verBtn}>Ver →</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Minha rede de passageiros */}
        <View style={styles.secao}>
          <View style={styles.redeHeader}>
            <Text style={styles.secaoTitulo}>Minha rede</Text>
            <TouchableOpacity style={styles.convidarBtn} onPress={() => setMostrarConvidar(v => !v)}>
              <Text style={styles.convidarBtnTxt}>+ Convidar</Text>
            </TouchableOpacity>
          </View>

          {mostrarConvidar && (
            <View style={styles.convidarCard}>
              <Text style={styles.convidarLabel}>Código do passageiro</Text>
              <TextInput
                style={styles.convidarInput}
                placeholder="Ex: AB12CD"
                placeholderTextColor="#64748b"
                value={codigoConvite}
                onChangeText={setCodigoConvite}
                autoCapitalize="characters"
                maxLength={6}
              />
              <View style={styles.convidarBtns}>
                <TouchableOpacity style={styles.convidarCancelar} onPress={() => { setMostrarConvidar(false); setCodigoConvite(''); }}>
                  <Text style={styles.convidarCancelarTxt}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.convidarConfirmar} onPress={convidarPassageiro} disabled={enviandoConvite}>
                  <Text style={styles.convidarConfirmarTxt}>{enviandoConvite ? 'Enviando…' : 'Enviar convite'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {passageiros.length === 0 ? (
            <View style={styles.vazio}>
              <Text style={styles.vazioemoji}>🧍</Text>
              <Text style={styles.vaziotxt}>Nenhum passageiro na rede</Text>
              <Text style={styles.vaziossub}>Convide passageiros pelo código</Text>
            </View>
          ) : (
            passageiros.map((p: any) => (
              <View key={p.id} style={styles.passageiroCard}>
                <View style={styles.passageiroAvatar}>
                  <Text style={styles.passageiroAvatarTxt}>{p.nome?.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.passageiroNome}>{p.nome}</Text>
                  <Text style={styles.passageiroSub}>{p.telefone || ''}</Text>
                </View>
                <TouchableOpacity style={styles.removerPassageiroBtn} onPress={() => removerPassageiro(p.id, p.nome)}>
                  <Text style={styles.removerPassageiroTxt}>Remover</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#0d0f14' },
  container: { flex: 1, padding: 24, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  logo: { fontSize: 22, fontWeight: 'bold', color: '#4a9eff', letterSpacing: 1 },
  bemvindo: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginTop: 4 },
  headerBtns: { flexDirection: 'row', gap: 8 },
  headerBtn: { backgroundColor: '#1a1f2e', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#2a3044' },
  headerBtnTxt: { color: '#94a3b8', fontSize: 13 },
  statusCard: { borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, borderWidth: 1 },
  statusOnline: { backgroundColor: '#0f2a1a', borderColor: '#22c55e' },
  statusOffline: { backgroundColor: '#1a1f2e', borderColor: '#2a3044' },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusEmoji: { fontSize: 28 },
  statusTitulo: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  statusSub: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  corridaAtivaCard: { backgroundColor: '#0f2a1a', borderRadius: 20, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#22c55e', gap: 10 },
  corridaAtivaTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  corridaAtivaEmoji: { fontSize: 32 },
  corridaAtivaInfo: { flex: 1, gap: 3 },
  corridaAtivaTitulo: { color: '#22c55e', fontWeight: 'bold', fontSize: 15 },
  corridaAtivaPassageiro: { color: '#fff', fontSize: 13 },
  corridaAtivaDestino: { color: '#94a3b8', fontSize: 12 },
  corridaAtivaValor: { color: '#4a9eff', fontSize: 12, fontWeight: '600' },
  corridaAtivaBtns: { flexDirection: 'row', gap: 8 },
  corridaBtnNav: { flex: 1, backgroundColor: '#1a2a4a', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#4a9eff' },
  corridaBtnChat: { flex: 1, backgroundColor: '#1a1f2e', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#7c5cfc' },
  corridaBtnChegou: { flex: 1, backgroundColor: '#1a2a2a', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#22c55e' },
  corridaBtnCancelar: { flex: 1, backgroundColor: '#2a1a1a', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#ef4444' },
  corridaBtnFinalizar: { flex: 1, backgroundColor: '#0f2a1a', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#22c55e' },
  corridaBtnTxt: { color: '#fff', fontWeight: '600', fontSize: 13 },
  corridaBtnCancelarTxt: { color: '#ef4444', fontWeight: '600', fontSize: 13 },
  corridaBtnFinalizarTxt: { color: '#22c55e', fontWeight: '600', fontSize: 13 },
  stats: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: '#1a1f2e', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#2a3044' },
  statValor: { color: '#fff', fontWeight: 'bold', fontSize: 18, marginBottom: 4 },
  statLabel: { color: '#64748b', fontSize: 11 },
  secao: { marginBottom: 24 },
  secaoTitulo: { color: '#94a3b8', fontSize: 12, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
  precoCard: { backgroundColor: '#1a1f2e', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#2a3044' },
  precoBtn: { backgroundColor: '#2a3044', width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  precoBtnTxt: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  precoValor: { color: '#fff', fontWeight: 'bold', fontSize: 20 },
  precoInfo: { color: '#64748b', fontSize: 12, marginTop: 10, lineHeight: 18 },
  codigoCard: { backgroundColor: '#1a1f2e', borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#4a9eff', gap: 8 },
  codigoTxt: { color: '#4a9eff', fontWeight: 'bold', fontSize: 32, letterSpacing: 6 },
  codigoSub: { color: '#64748b', fontSize: 12, textAlign: 'center' },
  codigoCopiarHint: { color: '#4a9eff', fontSize: 11, textAlign: 'center', marginTop: 4, opacity: 0.7 },
  vazio: { backgroundColor: '#1a1f2e', borderRadius: 16, padding: 32, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#2a3044' },
  vazioemoji: { fontSize: 40, marginBottom: 8 },
  vaziotxt: { color: '#fff', fontWeight: '600', fontSize: 15, textAlign: 'center' },
  vaziossub: { color: '#64748b', fontSize: 13, textAlign: 'center' },
  solicitacaoCard: { backgroundColor: '#1a1f2e', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10, borderWidth: 1, borderColor: '#f59e0b' },
  solicitacaoEmoji: { fontSize: 32 },
  solicitacaoInfo: { flex: 1, gap: 3 },
  solicitacaoNome: { color: '#fff', fontWeight: '600', fontSize: 15 },
  solicitacaoDestino: { color: '#94a3b8', fontSize: 12 },
  solicitacaoValor: { color: '#4a9eff', fontSize: 13, fontWeight: '600' },
  verBtn: { color: '#f59e0b', fontWeight: 'bold', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#13161e', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 32, alignItems: 'center', gap: 12, borderTopWidth: 1, borderColor: '#22c55e' },
  modalEmoji: { fontSize: 56, marginBottom: 4 },
  modalTitulo: { color: '#22c55e', fontWeight: 'bold', fontSize: 24 },
  modalPassageiro: { color: '#fff', fontWeight: '600', fontSize: 18 },
  modalDestBox: { width: '100%', backgroundColor: '#1a1f2e', borderRadius: 16, padding: 16, marginTop: 4 },
  modalDestLabel: { color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  modalDestino: { color: '#fff', fontSize: 14, lineHeight: 20 },
  modalInfoRow: { flexDirection: 'row', gap: 12, width: '100%' },
  modalInfoItem: { flex: 1, backgroundColor: '#1a1f2e', borderRadius: 16, padding: 16, alignItems: 'center' },
  modalInfoLabel: { color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  modalInfoValor: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  modalInfoPreco: { color: '#4a9eff', fontWeight: 'bold', fontSize: 22 },
  modalBtns: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 8 },
  recusarBtn: { flex: 1, backgroundColor: '#2a1a1a', borderRadius: 16, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: '#ef4444' },
  recusarTxt: { color: '#ef4444', fontWeight: 'bold', fontSize: 16 },
  aceitarBtn: { flex: 1, backgroundColor: '#0f2a1a', borderRadius: 16, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: '#22c55e' },
  aceitarTxt: { color: '#22c55e', fontWeight: 'bold', fontSize: 16 },
  navSubtitulo: { color: '#94a3b8', fontSize: 14, marginTop: 4 },
  navBtns: { flexDirection: 'row', gap: 12, width: '100%' },
  navBtn: { flex: 1, backgroundColor: '#1a1f2e', borderRadius: 16, padding: 16, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#2a3044' },
  navBtnEmoji: { fontSize: 32 },
  navBtnTxt: { color: '#fff', fontWeight: '600', fontSize: 12, textAlign: 'center' },
  proximoBtn: { width: '100%', backgroundColor: '#1a2a4a', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#4a9eff' },
  proximoBtnTxt: { color: '#4a9eff', fontWeight: '600', fontSize: 13, textAlign: 'center' },
  fecharNavBtn: { width: '100%', backgroundColor: '#1a1f2e', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#2a3044' },
  fecharNavTxt: { color: '#64748b', fontWeight: '600', fontSize: 14 },
  chatOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)' },
  chatCard: { flex: 1, backgroundColor: '#13161e', marginTop: 60, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  chatTitulo: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  chatFechar: { color: '#94a3b8', fontSize: 20, fontWeight: 'bold' },
  chatMensagens: { flex: 1, marginBottom: 16 },
  chatVazio: { color: '#4a5568', textAlign: 'center', marginTop: 40 },
  msgBubble: { padding: 12, borderRadius: 16, marginBottom: 8, maxWidth: '80%' },
  msgMinha: { backgroundColor: '#1a2a4a', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  msgDele: { backgroundColor: '#1a1f2e', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  msgTxt: { color: '#fff', fontSize: 14 },
  msgRecibo: { color: '#4a9eff', fontSize: 10, alignSelf: 'flex-end', marginTop: 2 },
  chatInput: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  chatTextInput: { flex: 1, backgroundColor: '#1a1f2e', borderRadius: 14, padding: 14, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#2a3044' },
  chatEnviar: { backgroundColor: '#4a9eff', width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  chatEnviarTxt: { color: '#fff', fontSize: 18 },
  avaliacaoCard: { backgroundColor: '#13161e', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 32, alignItems: 'center', gap: 12, borderTopWidth: 1, borderColor: '#f59e0b' },
  avaliacaoEmoji: { fontSize: 48 },
  avaliacaoTitulo: { color: '#fff', fontWeight: 'bold', fontSize: 22 },
  avaliacaoSub: { color: '#94a3b8', fontSize: 15 },
  estrelasRow: { flexDirection: 'row', gap: 12, marginVertical: 8 },
  estrelaIcon: { fontSize: 44 },
  avaliacaoNota: { color: '#f59e0b', fontWeight: '600', fontSize: 14, height: 20 },
  avaliacaoInput: { width: '100%', backgroundColor: '#1a1f2e', borderRadius: 14, padding: 14, color: '#fff', fontSize: 14, borderWidth: 1, borderColor: '#2a3044', textAlignVertical: 'top', minHeight: 80 },
  avaliacaoBtn: { width: '100%', backgroundColor: '#f59e0b', borderRadius: 16, padding: 18, alignItems: 'center' },
  avaliacaoBtnTxt: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  avaliacaoPularTxt: { color: '#4a5568', fontSize: 14, marginTop: 4 },
  deslocamentoCard: { backgroundColor: '#1a1f2e', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#2a3044', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deslocamentoTitulo: { color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 4 },
  deslocamentoSub: { color: '#64748b', fontSize: 12, maxWidth: '85%' },
  codigoBtnsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  codigoAcaoBtn: { flex: 1, backgroundColor: '#0d0f14', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#2a3044' },
  codigoAcaoTxt: { color: '#4a9eff', fontWeight: '600', fontSize: 13 },
  qrOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' },
  qrCard: { backgroundColor: '#13161e', borderRadius: 24, padding: 32, alignItems: 'center', width: 300, borderWidth: 1, borderColor: '#2a3044' },
  qrFechar: { position: 'absolute', top: 16, right: 16, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  qrFecharTxt: { color: '#94a3b8', fontSize: 18, fontWeight: 'bold' },
  qrTitulo: { color: '#fff', fontWeight: 'bold', fontSize: 18, marginBottom: 20 },
  qrImage: { width: 240, height: 240, borderRadius: 12, marginBottom: 16 },
  qrCodigo: { color: '#4a9eff', fontWeight: 'bold', fontSize: 22, letterSpacing: 4, marginBottom: 8 },
  qrInfo: { color: '#64748b', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  denunciaOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  denunciaCard: { backgroundColor: '#13161e', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, gap: 14, borderTopWidth: 1, borderColor: '#2a1a1a' },
  denunciaTitulo: { color: '#fff', fontWeight: 'bold', fontSize: 20, marginBottom: 4 },
  denunciaLabel: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  categoriasRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoriaBtn: { backgroundColor: '#1a1f2e', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1, borderColor: '#2a3044' },
  categoriaBtnAtivo: { backgroundColor: '#2a1a1a', borderColor: '#ef4444' },
  categoriaTxt: { color: '#64748b', fontSize: 13, fontWeight: '600' },
  categoriaTxtAtivo: { color: '#ef4444' },
  denunciaInput: { backgroundColor: '#1a1f2e', borderRadius: 14, padding: 14, color: '#fff', fontSize: 14, borderWidth: 1, borderColor: '#2a3044', textAlignVertical: 'top', minHeight: 100 },
  denunciaEnviarBtn: { backgroundColor: '#ef4444', borderRadius: 14, padding: 16, alignItems: 'center' },
  denunciaEnviarTxt: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  denunciaCancelarTxt: { color: '#64748b', textAlign: 'center', fontSize: 14, paddingVertical: 8 },
  creditosCard: { backgroundColor: '#1a1f2e', borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, borderWidth: 1.5, borderColor: '#2a3044' },
  creditosCardBaixo: { borderColor: '#f59e0b', backgroundColor: '#1a170a' },
  creditosCardZero: { borderColor: '#ef4444', backgroundColor: '#1a0a0a' },
  creditosTitulo: { color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 4 },
  creditosSub: { color: '#94a3b8', fontSize: 12 },
  creditosNum: { fontSize: 42, fontWeight: 'bold', lineHeight: 50, marginLeft: 12 },
  badgeDot: { position: 'absolute', top: -6, right: -6, backgroundColor: '#ef4444', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  badgeTxt: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  redeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  convidarBtn: { backgroundColor: '#1a2a4a', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 14, borderWidth: 1, borderColor: '#4a9eff' },
  convidarBtnTxt: { color: '#4a9eff', fontWeight: '700', fontSize: 13 },
  convidarCard: { backgroundColor: '#1a1f2e', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#4a9eff44', gap: 10 },
  convidarLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  convidarInput: { backgroundColor: '#0d0f14', borderRadius: 12, padding: 14, color: '#fff', fontSize: 22, fontWeight: 'bold', letterSpacing: 6, textAlign: 'center', borderWidth: 1, borderColor: '#4a9eff' },
  convidarBtns: { flexDirection: 'row', gap: 10 },
  convidarCancelar: { flex: 1, backgroundColor: '#2a3044', borderRadius: 12, padding: 12, alignItems: 'center' },
  convidarCancelarTxt: { color: '#fff', fontWeight: '600', fontSize: 14 },
  convidarConfirmar: { flex: 1, backgroundColor: '#4a9eff', borderRadius: 12, padding: 12, alignItems: 'center' },
  convidarConfirmarTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  passageiroCard: { backgroundColor: '#1a1f2e', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10, borderWidth: 1, borderColor: '#2a3044' },
  passageiroAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#7c5cfc', alignItems: 'center', justifyContent: 'center' },
  passageiroAvatarTxt: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  passageiroNome: { color: '#fff', fontWeight: '600', fontSize: 14 },
  passageiroSub: { color: '#64748b', fontSize: 12, marginTop: 2 },
  removerPassageiroBtn: { backgroundColor: '#2a1a1a', borderRadius: 10, paddingVertical: 7, paddingHorizontal: 12, borderWidth: 1, borderColor: '#ef4444' },
  removerPassageiroTxt: { color: '#ef4444', fontWeight: '700', fontSize: 12 },
});
