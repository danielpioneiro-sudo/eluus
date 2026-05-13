import { Audio } from 'expo-av';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, getDocs, increment, limit, onSnapshot, orderBy, query, runTransaction, updateDoc, where, writeBatch } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const [online, setOnline] = useState(false);
  const [nomeUsuario, setNomeUsuario] = useState('');
  const [precoPorKm, setPrecoPorKm] = useState(2.5);
  const [corridas, setCorridas] = useState(0);
  const [codigo, setCodigo] = useState('');
  const [solicitacoes, setSolicitacoes] = useState<any[]>([]);
  const [solicitacaoAtiva, setSolicitacaoAtiva] = useState<any>(null);
  const [corridaAceita, setCorridaAceita] = useState<any>(null);
  const [mostrarNavegacao, setMostrarNavegacao] = useState(false);
  const [navegandoPara, setNavegandoPara] = useState<'passageiro' | 'destino'>('passageiro');
  const [mostrarChat, setMostrarChat] = useState(false);
  const [mensagens, setMensagens] = useState<any[]>([]);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [msgNaoLidas, setMsgNaoLidas] = useState(0);
  const corridaAceitaRef = useRef<any>(null);
  const avisouChegadaRef = useRef(false);
  const chatAbertoRef = useRef(false);
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

  useEffect(() => {
    registrarParaNotificacoes();
    carregarSom();
    escutarUsuario();
    escutarSolicitacoes();
    restaurarCorrida();
    escutarMsgsPosCorridaMotorista();
    const appStateSub = AppState.addEventListener('change', async (nextState) => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      if (nextState === 'background' || nextState === 'inactive') {
        if (!corridaAceitaRef.current) {
          await updateDoc(doc(db, 'usuarios', uid), { online: false });
        }
      } else if (nextState === 'active') {
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
      unsubsMsgsPosRef.current.forEach(u => u());
      appStateSub.remove();
    };
  }, []);

  useEffect(() => {
    if (corridaAceitaRef.current && navegandoPara === 'passageiro' && corridaAceitaRef.current.passageiroLat) {
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

  const avisarChegada = async (corridaId: string, automatico = false) => {
    try {
      await updateDoc(doc(db, 'corridas', corridaId), {
        motoristaChegou: true, chegadaEm: new Date(),
      });
      if (!automatico) Alert.alert('Aviso enviado!', 'O passageiro foi notificado que você chegou.');
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

  const escutarChat = (corridaId: string) => {
    if (unsubChatRef.current) unsubChatRef.current();
    const q = query(collection(db, 'corridas', corridaId, 'mensagens'), orderBy('criadoEm', 'asc'));
    let primeiraLeitura = true;
    unsubChatRef.current = onSnapshot(q, (snap) => {
      const novas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMensagens(novas);
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
    } catch (e) { Alert.alert('Erro', 'Não foi possível enviar a mensagem'); }
  };

  const abrirChat = () => { chatAbertoRef.current = true; setMsgNaoLidas(0); setMostrarChat(true); };
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
      const corridaData = { id: corridaDoc.id, ...corridaDoc.data() };
      corridaAceitaRef.current = corridaData;
      setCorridaAceita(corridaData);
      avisouChegadaRef.current = corridaData.motoristaChegou || false;
      setNavegandoPara(corridaData.motoristaChegou ? 'destino' : 'passageiro');
      escutarChat(corridaDoc.id);
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
      Alert.alert('Erro', e.message || 'Não foi possível atualizar status');
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
        'Sem créditos',
        'Você não tem créditos para aceitar corridas. Compre um pacote para continuar.',
        [
          { text: 'Agora não', style: 'cancel' },
          { text: 'Comprar créditos', onPress: () => router.push('/comprar') },
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
      } else {
        await updateDoc(doc(db, 'corridas', corridaId), {
          status: 'recusada', atualizadoEm: new Date(),
        });
        setSolicitacaoAtiva(null);
      }
    } catch (e) { Alert.alert('Erro', 'Não foi possível responder a solicitação'); }
  };

  const cancelarCorrida = async () => {
    if (!corridaAceitaRef.current) return;
    Alert.alert('Cancelar corrida?', 'O passageiro será notificado.', [
      { text: 'Não', style: 'cancel' },
      { text: 'Sim, cancelar', style: 'destructive', onPress: async () => {
        await updateDoc(doc(db, 'corridas', corridaAceitaRef.current.id), {
          status: 'cancelada', canceladoPor: 'motorista', canceladoEm: new Date(),
        });
        pararRastreamento();
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
    Alert.alert('Encerrar corrida?', 'Confirma que a corrida foi finalizada?', [
      { text: 'Não', style: 'cancel' },
      { text: 'Sim, finalizar', onPress: async () => {
        const corridaInfo = { ...corridaAceitaRef.current };
        await updateDoc(doc(db, 'corridas', corridaAceitaRef.current.id), {
          status: 'finalizada', finalizadaEm: new Date(),
        });
        verificarIndicacao(corridaInfo.passageiroId).catch(() => null);
        pararRastreamento();
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
    const labels = ['', 'Muito ruim', 'Ruim', 'Regular', 'Bom', 'Excelente!'];
    return labels[n] || '';
  };

  const abrirNavegacao = (app: string) => {
    if (!corridaAceitaRef.current) return;
    const lat = navegandoPara === 'passageiro' ? corridaAceitaRef.current.passageiroLat : corridaAceitaRef.current.destLat;
    const lng = navegandoPara === 'passageiro' ? corridaAceitaRef.current.passageiroLng : corridaAceitaRef.current.destLng;
    if (!lat || !lng) { Alert.alert('Atenção', 'Localização não disponível'); return; }
    let url = '';
    if (app === 'google') url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    else if (app === 'waze') url = `waze://?ll=${lat},${lng}&navigate=yes`;
    else if (app === 'apple') url = `maps://?daddr=${lat},${lng}`;
    Linking.canOpenURL(url).then(supported => {
      Linking.openURL(supported ? url : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`);
    });
    setMostrarNavegacao(false);
  };

  const sair = async () => {
    const uid = auth.currentUser?.uid;
    if (uid) await updateDoc(doc(db, 'usuarios', uid), { online: false });
    await signOut(auth);
    router.replace('/');
  };

  const enviarDenuncia = async () => {
    if (!categoriaDenuncia) { Alert.alert('Atenção', 'Selecione uma categoria'); return; }
    if (!textoDenuncia.trim()) { Alert.alert('Atenção', 'Descreva o ocorrido'); return; }
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
      Alert.alert('Denúncia enviada', 'Obrigado. Nossa equipe irá analisar.');
    } catch (e) { Alert.alert('Erro', 'Não foi possível enviar a denúncia'); }
    setDenunciando(false);
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
            <Text style={styles.qrTitulo}>Meu QR Code</Text>
            <Image source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent('eluus://cadastro?codigo=' + codigo)}&bgcolor=13161e&color=4a9eff&margin=10` }} style={styles.qrImage} />
            <Text style={styles.qrCodigo}>{codigo}</Text>
            <Text style={styles.qrInfo}>Mostre para que te adicionem sem digitar o código</Text>
          </View>
        </View>
      </Modal>

      {/* Modal Denúncia */}
      <Modal visible={mostrarDenuncia} transparent animationType="slide" onRequestClose={() => setMostrarDenuncia(false)}>
        <View style={styles.denunciaOverlay}>
          <View style={styles.denunciaCard}>
            <Text style={styles.denunciaTitulo}>🚨 Fazer Denúncia</Text>
            <Text style={styles.denunciaLabel}>Categoria</Text>
            <View style={styles.categoriasRow}>
              {['Comportamento', 'Segurança', 'Fraude', 'Outro'].map(c => (
                <TouchableOpacity key={c} style={[styles.categoriaBtn, categoriaDenuncia === c && styles.categoriaBtnAtivo]} onPress={() => setCategoriaDenuncia(c)}>
                  <Text style={[styles.categoriaTxt, categoriaDenuncia === c && styles.categoriaTxtAtivo]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.denunciaLabel}>Descreva o ocorrido</Text>
            <TextInput
              style={styles.denunciaInput}
              placeholder="O que aconteceu?"
              placeholderTextColor="#4a5568"
              value={textoDenuncia}
              onChangeText={setTextoDenuncia}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <TouchableOpacity style={styles.denunciaEnviarBtn} onPress={enviarDenuncia} disabled={denunciando}>
              <Text style={styles.denunciaEnviarTxt}>{denunciando ? 'Enviando...' : 'Enviar denúncia'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setMostrarDenuncia(false); setCategoriaDenuncia(''); setTextoDenuncia(''); }}>
              <Text style={styles.denunciaCancelarTxt}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal avaliação */}
      <Modal visible={mostrarModalAvaliacao} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.avaliacaoCard}>
            <Text style={styles.avaliacaoEmoji}>⭐</Text>
            <Text style={styles.avaliacaoTitulo}>Como foi a corrida?</Text>
            <Text style={styles.avaliacaoSub}>Avalie {corridaParaAvaliar?.passageiroNome}</Text>
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
              placeholder="Comentário (opcional)..."
              placeholderTextColor="#4a5568"
              value={comentarioAvaliacao}
              onChangeText={setComentarioAvaliacao}
              multiline
              numberOfLines={3}
            />
            <TouchableOpacity style={styles.avaliacaoBtn} onPress={() => salvarAvaliacaoPassageiro(false)}>
              <Text style={styles.avaliacaoBtnTxt}>Enviar avaliação</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => salvarAvaliacaoPassageiro(true)}>
              <Text style={styles.avaliacaoPularTxt}>Pular</Text>
            </TouchableOpacity>
          </View>
        </View>
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
                  <Text style={styles.modalDestLabel}>Origem</Text>
                  <Text style={styles.modalDestino}>{solicitacaoAtiva.passageiroEndereco || 'Localização atual'}</Text>
                </View>
                <View style={styles.modalDestBox}>
                  <Text style={styles.modalDestLabel}>Destino</Text>
                  <Text style={styles.modalDestino}>{solicitacaoAtiva.destino}</Text>
                </View>
                <View style={styles.modalInfoRow}>
                  <View style={styles.modalInfoItem}>
                    <Text style={styles.modalInfoLabel}>Distância</Text>
                    <Text style={styles.modalInfoValor}>{solicitacaoAtiva.distancia} km</Text>
                  </View>
                  <View style={styles.modalInfoItem}>
                    <Text style={styles.modalInfoLabel}>Valor</Text>
                    <Text style={styles.modalInfoPreco}>R$ {solicitacaoAtiva.valor}</Text>
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
            <Text style={styles.modalEmoji}>{navegandoPara === 'passageiro' ? '🧍' : '📍'}</Text>
            <Text style={styles.modalTitulo}>{navegandoPara === 'passageiro' ? 'Buscar Passageiro' : 'Ir ao Destino'}</Text>
            {corridaAceita && (
              <>
                <View style={styles.modalDestBox}>
                  <Text style={styles.modalDestLabel}>{navegandoPara === 'passageiro' ? 'Passageiro' : 'Destino'}</Text>
                  <Text style={styles.modalDestino}>{navegandoPara === 'passageiro' ? corridaAceita.passageiroNome : corridaAceita.destino}</Text>
                </View>
                <Text style={styles.navSubtitulo}>Abrir com:</Text>
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
                  <TouchableOpacity style={styles.proximoBtn} onPress={() => setNavegandoPara('destino')}>
                    <Text style={styles.proximoBtnTxt}>Já busquei o passageiro → Ir ao destino</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.fecharNavBtn} onPress={() => setMostrarNavegacao(false)}>
                  <Text style={styles.fecharNavTxt}>Fechar</Text>
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
              <Text style={styles.chatTitulo}>💬 Chat — {corridaAceita?.passageiroNome}</Text>
              <TouchableOpacity onPress={fecharChat}>
                <Text style={styles.chatFechar}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.chatMensagens} showsVerticalScrollIndicator={false}>
              {mensagens.length === 0 && <Text style={styles.chatVazio}>Nenhuma mensagem ainda</Text>}
              {mensagens.map((m: any) => (
                <View key={m.id} style={[styles.msgBubble, m.remetente === 'motorista' ? styles.msgMinha : styles.msgDele]}>
                  <Text style={styles.msgTxt}>{m.texto}</Text>
                </View>
              ))}
            </ScrollView>
            <View style={styles.chatInput}>
              <TextInput style={styles.chatTextInput} placeholder="Digite uma mensagem..." placeholderTextColor="#4a5568" value={novaMensagem} onChangeText={setNovaMensagem} />
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
            <Text style={styles.bemvindo}>Olá, {primeiroNome} 👋</Text>
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
            <TouchableOpacity onPress={sair} style={styles.headerBtn}>
              <Text style={styles.headerBtnTxt}>Sair</Text>
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
                <Text style={styles.corridaAtivaTitulo}>Corrida em andamento</Text>
                <Text style={styles.corridaAtivaPassageiro}>👤 {corridaAceita.passageiroNome}</Text>
                <Text style={styles.corridaAtivaDestino}>📍 {corridaAceita.destino}</Text>
                <Text style={styles.corridaAtivaValor}>💰 R$ {corridaAceita.valor} · {corridaAceita.distancia} km</Text>
              </View>
            </View>
            <View style={styles.corridaAtivaBtns}>
              <TouchableOpacity style={styles.corridaBtnNav} onPress={() => setMostrarNavegacao(true)}>
                <Text style={styles.corridaBtnTxt}>🗺️ Navegar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.corridaBtnChat} onPress={abrirChat}>
                <Text style={styles.corridaBtnTxt}>💬 Chat{msgNaoLidas > 0 ? ` (${msgNaoLidas})` : ''}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.corridaAtivaBtns}>
              <TouchableOpacity style={styles.corridaBtnChegou} onPress={() => avisarChegada(corridaAceita.id)}>
                <Text style={styles.corridaBtnTxt}>📍 Avisar que cheguei</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.corridaAtivaBtns}>
              <TouchableOpacity style={styles.corridaBtnCancelar} onPress={cancelarCorrida}>
                <Text style={styles.corridaBtnCancelarTxt}>✕ Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.corridaBtnFinalizar} onPress={encerrarCorrida}>
                <Text style={styles.corridaBtnFinalizarTxt}>✓ Finalizar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Stats */}
        <View style={styles.stats}>
          <View style={styles.statCard}>
            <Text style={styles.statValor}>{corridas}</Text>
            <Text style={styles.statLabel}>Corridas</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValor}>R$ {precoPorKm.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Por km</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValor}>⭐ {avaliacaoMedia.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Avaliação</Text>
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
            <Text style={styles.creditosTitulo}>🎟️ Créditos de corridas</Text>
            <Text style={styles.creditosSub}>
              {creditos === 0
                ? 'Sem créditos — toque para comprar'
                : creditos <= 10
                ? `${creditos} corrida${creditos !== 1 ? 's' : ''} restante${creditos !== 1 ? 's' : ''} — compre mais`
                : `${creditos} corridas disponíveis`}
            </Text>
          </View>
          <Text style={[styles.creditosNum, { color: creditos === 0 ? '#ef4444' : creditos <= 10 ? '#f59e0b' : '#22c55e' }]}>
            {creditos}
          </Text>
        </TouchableOpacity>

        {/* Preço por km */}
        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>Meu preço por km</Text>
          <View style={styles.precoCard}>
            <TouchableOpacity style={styles.precoBtn} onPress={async () => {
              const novo = parseFloat(Math.max(1, precoPorKm - 0.1).toFixed(2));
              await updateDoc(doc(db, 'usuarios', auth.currentUser!.uid), { precoPorKm: novo });
            }}>
              <Text style={styles.precoBtnTxt}>−</Text>
            </TouchableOpacity>
            <Text style={styles.precoValor}>R$ {precoPorKm.toFixed(2)}/km</Text>
            <TouchableOpacity style={styles.precoBtn} onPress={async () => {
              const novo = parseFloat((precoPorKm + 0.1).toFixed(2));
              await updateDoc(doc(db, 'usuarios', auth.currentUser!.uid), { precoPorKm: novo });
            }}>
              <Text style={styles.precoBtnTxt}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.precoInfo}>Este valor será usado para calcular o preço das corridas</Text>
        </View>

        {/* Cobrar deslocamento */}
        <View style={styles.secao}>
          <View style={styles.deslocamentoCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.deslocamentoTitulo}>Cobrar deslocamento até o passageiro</Text>
              <Text style={styles.deslocamentoSub}>A km de ida até o passageiro entra no valor da corrida</Text>
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
          <Text style={styles.secaoTitulo}>Meu código</Text>
          <View style={styles.codigoCard}>
            <Text style={styles.codigoTxt}>{codigo}</Text>
            <Text style={styles.codigoSub}>Compartilhe este código com seus passageiros</Text>
            <View style={styles.codigoBtnsRow}>
              <TouchableOpacity style={styles.codigoAcaoBtn} onPress={() => setMostrarQR(true)}>
                <Text style={styles.codigoAcaoTxt}>📱 Ver QR Code</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.codigoAcaoBtn} onPress={() => setMostrarDenuncia(true)}>
                <Text style={[styles.codigoAcaoTxt, { color: '#ef4444' }]}>🚨 Denunciar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Solicitações */}
        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>Solicitações {solicitacoes.length > 0 ? `(${solicitacoes.length})` : ''}</Text>
          {solicitacoes.length === 0 ? (
            <View style={styles.vazio}>
              <Text style={styles.vazioemoji}>🕐</Text>
              <Text style={styles.vaziotxt}>Nenhuma solicitação no momento</Text>
              <Text style={styles.vaziossub}>Fique online para receber corridas</Text>
            </View>
          ) : (
            solicitacoes.map((s: any) => (
              <TouchableOpacity key={s.id} style={styles.solicitacaoCard} onPress={() => setSolicitacaoAtiva(s)}>
                <Text style={styles.solicitacaoEmoji}>🧍</Text>
                <View style={styles.solicitacaoInfo}>
                  <Text style={styles.solicitacaoNome}>{s.passageiroNome}</Text>
                  <Text style={styles.solicitacaoDestino}>📍 {s.destino}</Text>
                  <Text style={styles.solicitacaoValor}>R$ {s.valor} · {s.distancia} km</Text>
                </View>
                <Text style={styles.verBtn}>Ver →</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
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
});
