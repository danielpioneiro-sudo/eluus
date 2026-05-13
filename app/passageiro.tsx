import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, getDocs, increment, limit, onSnapshot, orderBy, query, runTransaction, updateDoc, where } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { auth, db } from '../firebaseConfig';

const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY;
const HISTORICO_KEY = '@eluus_historico_busca';
const CASA_KEY = '@eluus_endereco_casa';
const TRABALHO_KEY = '@eluus_endereco_trabalho';

type EnderecoSalvo = { placeId: string; descricao: string };

export default function Passageiro() {
  const router = useRouter();

  // — estado original —
  const [motoristas, setMotoristas] = useState<any[]>([]);
  const [motoristasIds, setMotoristasIds] = useState<string[]>([]);
  const [destino, setDestino] = useState('');
  const [destinoPlaceId, setDestinoPlaceId] = useState('');
  const [sugestoes, setSugestoes] = useState<any[]>([]);
  const [calculando, setCalculando] = useState(false);
  const [valores, setValores] = useState<any>({});
  const [codigoMotorista, setCodigoMotorista] = useState('');
  const [adicionando, setAdicionando] = useState(false);
  const [mostrarAdd, setMostrarAdd] = useState(false);
  const [nomeUsuario, setNomeUsuario] = useState('');
  const [corridaAtiva, setCorridaAtiva] = useState<any>(null);
  const [minhaLocalizacao, setMinhaLocalizacao] = useState<any>(null);
  const [mostrarChat, setMostrarChat] = useState(false);
  const [mensagens, setMensagens] = useState<any[]>([]);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [motoristaChegou, setMotoristaChegou] = useState(false);
  const [msgNaoLidas, setMsgNaoLidas] = useState(0);
  const [mostrarModalAvaliacao, setMostrarModalAvaliacao] = useState(false);
  const [estrelasAvaliacao, setEstrelasAvaliacao] = useState(5);
  const [comentarioAvaliacao, setComentarioAvaliacao] = useState('');
  const [corridaParaAvaliar, setCorridaParaAvaliar] = useState<any>(null);
  const [mostrarAvisoInicial, setMostrarAvisoInicial] = useState(true);
  const [corridaPendente, setCorridaPendente] = useState<any>(null);

  // — novo estado —
  const [motoristaPerfilModal, setMotoristaPerfilModal] = useState<any>(null);
  const [historicoBusca, setHistoricoBusca] = useState<EnderecoSalvo[]>([]);
  const [casaEndereco, setCasaEndereco] = useState<EnderecoSalvo | null>(null);
  const [trabalhoEndereco, setTrabalhoEndereco] = useState<EnderecoSalvo | null>(null);
  const [destinoFocado, setDestinoFocado] = useState(false);
  const [parada, setParada] = useState('');
  const [paradaSugestoes, setParadaSugestoes] = useState<any[]>([]);
  const [paradaInfo, setParadaInfo] = useState<any>(null);
  const [mostrarParada, setMostrarParada] = useState(false);
  const [mostrarDenuncia, setMostrarDenuncia] = useState(false);
  const [categoriaDenuncia, setCategoriaDenuncia] = useState('');
  const [textoDenuncia, setTextoDenuncia] = useState('');
  const [denunciando, setDenunciando] = useState(false);

  const corridaAtivaRef = useRef<any>(null);
  const corridaPendenteRef = useRef<any>(null);
  const motoristaChegouRef = useRef(false);
  const unsubMotoristasRef = useRef<any[]>([]);
  const unsubCorridaRef = useRef<any>(null);
  const unsubChatRef = useRef<any>(null);
  const chatAbertoRef = useRef(false);

  useEffect(() => {
    carregarPassageiro();
    pegarLocalizacao();
    carregarDadosSalvos();
    restaurarCorrida();
    return () => {
      unsubMotoristasRef.current.forEach(u => u());
      if (unsubCorridaRef.current) unsubCorridaRef.current();
      if (unsubChatRef.current) unsubChatRef.current();
    };
  }, []);

  // ── dados salvos localmente ──────────────────────────────────────────────

  const carregarDadosSalvos = async () => {
    try {
      const hist = await AsyncStorage.getItem(HISTORICO_KEY);
      if (hist) setHistoricoBusca(JSON.parse(hist));
      const casa = await AsyncStorage.getItem(CASA_KEY);
      if (casa) setCasaEndereco(JSON.parse(casa));
      const trab = await AsyncStorage.getItem(TRABALHO_KEY);
      if (trab) setTrabalhoEndereco(JSON.parse(trab));
    } catch (e) {}
  };

  const salvarNoHistorico = async (placeId: string, descricao: string) => {
    try {
      const novo: EnderecoSalvo = { placeId, descricao };
      const filtrado = historicoBusca.filter(h => h.placeId !== placeId);
      const atualizado = [novo, ...filtrado].slice(0, 8);
      setHistoricoBusca(atualizado);
      await AsyncStorage.setItem(HISTORICO_KEY, JSON.stringify(atualizado));
    } catch (e) {}
  };

  const salvarCasa = async () => {
    if (!destinoPlaceId) return;
    const dados: EnderecoSalvo = { placeId: destinoPlaceId, descricao: destino };
    setCasaEndereco(dados);
    await AsyncStorage.setItem(CASA_KEY, JSON.stringify(dados)).catch(() => null);
    Alert.alert('Salvo! 🏠', 'Endereço de casa atualizado.');
  };

  const salvarTrabalho = async () => {
    if (!destinoPlaceId) return;
    const dados: EnderecoSalvo = { placeId: destinoPlaceId, descricao: destino };
    setTrabalhoEndereco(dados);
    await AsyncStorage.setItem(TRABALHO_KEY, JSON.stringify(dados)).catch(() => null);
    Alert.alert('Salvo! 💼', 'Endereço de trabalho atualizado.');
  };

  // ── localização ──────────────────────────────────────────────────────────

  const pegarLocalizacao = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setMinhaLocalizacao({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch (e) {}
  };

  // ── Firestore ────────────────────────────────────────────────────────────

  const carregarPassageiro = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const userDoc = await getDoc(doc(db, 'usuarios', uid));
      if (userDoc.exists()) {
        setNomeUsuario(userDoc.data().nome);
        const ids: string[] = [...new Set(userDoc.data().motoristas || [])] as string[];
        setMotoristasIds(ids);
        escutarMotoristas(ids);
      }
    } catch (e) {}
  };

  const restaurarCorrida = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      const snap = await getDocs(query(
        collection(db, 'corridas'),
        where('passageiroId', '==', uid),
        where('status', 'in', ['pendente', 'aceita'])
      ));
      if (snap.empty) return;
      const corridaDoc = snap.docs[0];
      const corridaData = { id: corridaDoc.id, ...corridaDoc.data() };
      const motoristaNome = corridaData.motoristaNome || '';

      if (corridaData.status === 'aceita') {
        corridaAtivaRef.current = corridaData;
        setCorridaAtiva(corridaData);
        if (corridaData.motoristaChegou) {
          motoristaChegouRef.current = true;
          setMotoristaChegou(true);
        }
        escutarChat(corridaDoc.id);
      }

      if (corridaData.status === 'pendente') {
        corridaPendenteRef.current = corridaData;
        setCorridaPendente(corridaData);
      }

      if (unsubCorridaRef.current) unsubCorridaRef.current();
      unsubCorridaRef.current = onSnapshot(doc(db, 'corridas', corridaDoc.id), (docSnap) => {
        const data = docSnap.data();
        if (!data) return;
        if (data.status === 'aceita' && !corridaAtivaRef.current) {
          corridaPendenteRef.current = null;
          setCorridaPendente(null);
          const cd = { id: corridaDoc.id, ...data };
          corridaAtivaRef.current = cd;
          setCorridaAtiva(cd);
          escutarChat(corridaDoc.id);
          Alert.alert('Corrida aceita! 🎉', `${motoristaNome} aceitou! Ele está a caminho.`);
        }
        if (data.status === 'recusada') {
          corridaPendenteRef.current = null;
          setCorridaPendente(null);
          if (unsubCorridaRef.current) unsubCorridaRef.current();
        }
        if (data.status === 'cancelada') {
          corridaPendenteRef.current = null;
          setCorridaPendente(null);
          Alert.alert('Corrida cancelada', data.canceladoPor === 'motorista' ? `${motoristaNome} cancelou a corrida.` : 'Corrida cancelada.');
          corridaAtivaRef.current = null;
          setCorridaAtiva(null);
          setMotoristaChegou(false);
          motoristaChegouRef.current = false;
          if (unsubCorridaRef.current) unsubCorridaRef.current();
          if (unsubChatRef.current) unsubChatRef.current();
        }
        if (data.status === 'finalizada') {
          const corridaInfo = { id: corridaDoc.id, motoristaId: data.motoristaId, motoristaNome: data.motoristaNome };
          corridaAtivaRef.current = null;
          setCorridaAtiva(null);
          setMotoristaChegou(false);
          motoristaChegouRef.current = false;
          if (unsubCorridaRef.current) unsubCorridaRef.current();
          if (unsubChatRef.current) unsubChatRef.current();
          const currentUid = auth.currentUser?.uid;
          if (currentUid) verificarIndicacao(currentUid).catch(() => null);
          setCorridaParaAvaliar(corridaInfo);
          setEstrelasAvaliacao(5);
          setComentarioAvaliacao('');
          setMostrarModalAvaliacao(true);
        }
        const statusTerminal = data.status === 'finalizada' || data.status === 'cancelada';
        if (data.motoristaChegou && !motoristaChegouRef.current && !statusTerminal) {
          motoristaChegouRef.current = true;
          setMotoristaChegou(true);
          Vibration.vibrate([0, 500, 200, 500]);
          Alert.alert('🚗 Motorista chegou!', `${motoristaNome} está no local de embarque!`);
        }
      });
    } catch (e) {}
  };

  const escutarMotoristas = (ids: string[]) => {
    unsubMotoristasRef.current.forEach(u => u());
    unsubMotoristasRef.current = [];
    const motoMap: any = {};
    ids.forEach(motId => {
      const unsub = onSnapshot(doc(db, 'usuarios', motId), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          // Motoristas não verificados por SMS (não-BR) não aparecem online
          const isVerificado = data.pais === 'BR' || !data.pais || data.phoneVerified === true;
          motoMap[motId] = { id: motId, ...data, online: isVerificado ? data.online : false };
          setMotoristas(Object.values(motoMap));
        }
      });
      unsubMotoristasRef.current.push(unsub);
    });
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
        if (ultima?.remetente === 'motorista' && !chatAbertoRef.current) {
          setMsgNaoLidas(n => n + 1);
          Vibration.vibrate([0, 300, 100, 300]);
        }
      }
      primeiraLeitura = false;
    });
  };

  const enviarMensagem = async () => {
    if (!novaMensagem.trim() || !corridaAtivaRef.current) return;
    try {
      await addDoc(collection(db, 'corridas', corridaAtivaRef.current.id, 'mensagens'), {
        texto: novaMensagem.trim(),
        remetente: 'passageiro',
        remetenteNome: nomeUsuario,
        criadoEm: new Date(),
      });
      setNovaMensagem('');
    } catch (e) { Alert.alert('Erro', 'Não foi possível enviar a mensagem'); }
  };

  const abrirChat = () => { chatAbertoRef.current = true; setMsgNaoLidas(0); setMostrarChat(true); };
  const fecharChat = () => { chatAbertoRef.current = false; setMostrarChat(false); };

  // ── busca de endereço ────────────────────────────────────────────────────

  const buscarSugestoes = async (texto: string) => {
    setDestino(texto);
    setDestinoPlaceId('');
    if (paradaInfo) { setParadaInfo(null); setParada(''); setMostrarParada(false); }
    if (texto.length < 3) { setSugestoes([]); return; }
    try {
      const res = await axios.get(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(texto)}&language=pt-BR&components=country:br&key=${GOOGLE_KEY}`
      );
      if (res.data.status === 'OK') setSugestoes(res.data.predictions || []);
    } catch (e) {}
  };

  const buscarSugestoesParada = async (texto: string) => {
    setParada(texto);
    if (texto.length < 3) { setParadaSugestoes([]); return; }
    try {
      const res = await axios.get(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(texto)}&language=pt-BR&components=country:br&key=${GOOGLE_KEY}`
      );
      if (res.data.status === 'OK') setParadaSugestoes(res.data.predictions || []);
    } catch (e) {}
  };

  const selecionarParada = async (placeId: string, descricao: string) => {
    setParada(descricao);
    setParadaSugestoes([]);
    try {
      const detRes = await axios.get(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry&key=${GOOGLE_KEY}`
      );
      if (detRes.data.status === 'OK') {
        const loc = detRes.data.result.geometry.location;
        const novaParada = { descricao, placeId, lat: loc.lat, lng: loc.lng };
        setParadaInfo(novaParada);
        if (destinoPlaceId) await calcularValores(destinoPlaceId, destino, novaParada);
      }
    } catch (e) {}
  };

  const removerParada = () => {
    setParadaInfo(null);
    setParada('');
    setMostrarParada(false);
    if (destinoPlaceId) calcularValores(destinoPlaceId, destino, null);
  };

  // ── cálculo de valores ───────────────────────────────────────────────────

  const calcularValores = async (placeId: string, descricao: string, paradaOverride?: any) => {
    const paradaAtual = paradaOverride !== undefined ? paradaOverride : paradaInfo;
    setDestino(descricao);
    setDestinoPlaceId(placeId);
    setSugestoes([]);
    setDestinoFocado(false);
    await salvarNoHistorico(placeId, descricao);
    setCalculando(true);
    setValores({});
    try {
      const detRes = await axios.get(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry&key=${GOOGLE_KEY}`
      );
      if (detRes.data.status !== 'OK') { Alert.alert('Erro', 'Destino não encontrado'); setCalculando(false); return; }
      const destCoords = detRes.data.result.geometry.location;

      let locAtual = minhaLocalizacao;
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        locAtual = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        setMinhaLocalizacao(locAtual);
      } catch (e) {}

      const novosValores: any = {};
      for (const m of motoristas) {
        let mLat = m.lat;
        let mLng = m.lng;
        let estimado = false;
        if (!m.online) {
          if (!m.ultimaLocalizacao?.lat || !m.ultimaLocalizacao?.lng) continue;
          mLat = m.ultimaLocalizacao.lat;
          mLng = m.ultimaLocalizacao.lng;
          estimado = true;
        } else if (!m.lat || !m.lng) {
          continue;
        }

        let distMotoristaPassageiro = 0;
        if (locAtual?.lat && locAtual?.lng) {
          const rota1 = await axios.get(
            `https://maps.googleapis.com/maps/api/directions/json?origin=${mLat},${mLng}&destination=${locAtual.lat},${locAtual.lng}&language=pt-BR&key=${GOOGLE_KEY}`
          );
          if (rota1.data.status === 'OK' && rota1.data.routes.length > 0) {
            distMotoristaPassageiro = rota1.data.routes[0].legs[0].distance.value / 1000;
          }
        }

        const origemPassageiro = locAtual?.lat ? `${locAtual.lat},${locAtual.lng}` : `${mLat},${mLng}`;
        const waypointParam = paradaAtual ? `&waypoints=${paradaAtual.lat},${paradaAtual.lng}` : '';
        const rota2 = await axios.get(
          `https://maps.googleapis.com/maps/api/directions/json?origin=${origemPassageiro}&destination=${destCoords.lat},${destCoords.lng}${waypointParam}&language=pt-BR&key=${GOOGLE_KEY}`
        );

        if (rota2.data.status === 'OK' && rota2.data.routes.length > 0) {
          const legs = rota2.data.routes[0].legs;
          const distPassageiroDestino = legs.reduce((s: number, l: any) => s + l.distance.value, 0) / 1000;
          const duracao = legs[legs.length - 1].duration.text;
          const distanciaTotal = distMotoristaPassageiro + distPassageiroDestino;
          const cobrarDesl = m.cobrarDeslocamento !== false;
          const distCobravel = cobrarDesl ? distanciaTotal : distPassageiroDestino;
          const preco = distCobravel * (m.precoPorKm || 2.5);
          novosValores[m.id] = {
            distMotoristaPassageiro: distMotoristaPassageiro.toFixed(1),
            distPassageiroDestino: distPassageiroDestino.toFixed(1),
            distanciaTotal: distanciaTotal.toFixed(1),
            duracao,
            preco: preco.toFixed(2),
            destLat: destCoords.lat,
            destLng: destCoords.lng,
            estimado,
            ultimaLocalizacaoEm: estimado ? (m.ultimaLocalizacao.atualizadoEm?.toDate?.() ?? m.ultimaLocalizacao.atualizadoEm ?? null) : null,
          };
        }
      }
      if (Object.keys(novosValores).length === 0) Alert.alert('Atenção', 'Nenhum motorista disponível com localização salva.');
      setValores(novosValores);
    } catch (e) { Alert.alert('Erro', 'Não foi possível calcular as rotas'); }
    setCalculando(false);
  };

  // ── corrida ──────────────────────────────────────────────────────────────

  const solicitarCorrida = async (motorista: any, confirmarOffline = false) => {
    if (!motorista.online && !confirmarOffline) {
      Alert.alert(
        'Motorista offline',
        'Este motorista está offline. Sua solicitação será enviada e ele será notificado quando ficar online. Deseja continuar?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Enviar mesmo assim', onPress: () => solicitarCorrida(motorista, true) },
        ]
      );
      return;
    }
    try {
      const uid = auth.currentUser?.uid;
      const val = valores[motorista.id];
      if (!val) return;

      let locAtual = minhaLocalizacao;
      let passageiroEndereco = '';
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        locAtual = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        setMinhaLocalizacao(locAtual);
        const geo = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        if (geo[0]) {
          const g = geo[0];
          const partes = [g.street, g.streetNumber, g.district, g.city].filter(Boolean);
          passageiroEndereco = partes.join(', ');
        }
      } catch (e) {}

      const corridaRef = await addDoc(collection(db, 'corridas'), {
        passageiroId: uid,
        passageiroNome: nomeUsuario,
        passageiroLat: locAtual?.lat || null,
        passageiroLng: locAtual?.lng || null,
        passageiroEndereco: passageiroEndereco || null,
        motoristaId: motorista.id,
        motoristaNome: motorista.nome,
        destino,
        destLat: val.destLat,
        destLng: val.destLng,
        paradaDescricao: paradaInfo?.descricao || null,
        paradaLat: paradaInfo?.lat || null,
        paradaLng: paradaInfo?.lng || null,
        valor: val.preco,
        distancia: val.distanciaTotal,
        distMotoristaPassageiro: val.distMotoristaPassageiro,
        distPassageiroDestino: val.distPassageiroDestino,
        status: 'pendente',
        motoristaChegou: false,
        criadoEm: new Date(),
      });

      if (motorista.expoPushToken) {
        fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: motorista.expoPushToken,
            title: '🚗 Nova corrida!',
            body: `${nomeUsuario} quer ir para ${destino}`,
            data: { corridaId: corridaRef.id },
            channelId: 'corridas',
            priority: 'high',
            sound: 'default',
          }),
        }).catch(() => null);
      }

      if (motorista.online) {
        Alert.alert('Solicitação enviada! 🚗', `Aguardando ${motorista.nome} aceitar...`);
      } else {
        const pd = { id: corridaRef.id, motoristaNome: motorista.nome, destino, valor: val.preco, status: 'pendente' };
        corridaPendenteRef.current = pd;
        setCorridaPendente(pd);
      }

      if (unsubCorridaRef.current) unsubCorridaRef.current();
      unsubCorridaRef.current = onSnapshot(doc(db, 'corridas', corridaRef.id), (snap) => {
        const data = snap.data();
        if (!data) return;

        if (data.status === 'aceita') {
          corridaPendenteRef.current = null;
          setCorridaPendente(null);
          const corridaData = { id: corridaRef.id, ...data };
          corridaAtivaRef.current = corridaData;
          setCorridaAtiva(corridaData);
          escutarChat(corridaRef.id);
          Alert.alert('Corrida aceita! 🎉', `${motorista.nome} aceitou! Ele está a caminho.`);
        }
        if (data.status === 'recusada') {
          corridaPendenteRef.current = null;
          setCorridaPendente(null);
          Alert.alert('Corrida recusada', `${motorista.nome} não pode atender agora.`);
          if (unsubCorridaRef.current) unsubCorridaRef.current();
        }
        if (data.status === 'cancelada') {
          corridaPendenteRef.current = null;
          setCorridaPendente(null);
          Alert.alert('Corrida cancelada', data.canceladoPor === 'motorista' ? `${motorista.nome} cancelou a corrida.` : 'Corrida cancelada.');
          corridaAtivaRef.current = null;
          setCorridaAtiva(null);
          setMotoristaChegou(false);
          motoristaChegouRef.current = false;
          if (unsubCorridaRef.current) unsubCorridaRef.current();
          if (unsubChatRef.current) unsubChatRef.current();
        }
        if (data.status === 'finalizada') {
          const corridaInfo = { id: corridaRef.id, motoristaId: data.motoristaId, motoristaNome: data.motoristaNome };
          corridaAtivaRef.current = null;
          setCorridaAtiva(null);
          setMotoristaChegou(false);
          motoristaChegouRef.current = false;
          if (unsubCorridaRef.current) unsubCorridaRef.current();
          if (unsubChatRef.current) unsubChatRef.current();
          const uid = auth.currentUser?.uid;
          if (uid) verificarIndicacao(uid).catch(() => null);
          setCorridaParaAvaliar(corridaInfo);
          setEstrelasAvaliacao(5);
          setComentarioAvaliacao('');
          setMostrarModalAvaliacao(true);
        }
        const statusTerminal = data.status === 'finalizada' || data.status === 'cancelada' || data.status === 'recusada';
        if (data.motoristaChegou && !motoristaChegouRef.current && !statusTerminal) {
          motoristaChegouRef.current = true;
          setMotoristaChegou(true);
          Vibration.vibrate([0, 500, 200, 500]);
          Alert.alert('🚗 Motorista chegou!', `${motorista.nome} está no local de embarque!`);
        }
      });
    } catch (e) { Alert.alert('Erro', 'Não foi possível solicitar a corrida'); }
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

  const salvarAvaliacaoMotorista = async (pular: boolean) => {
    setMostrarModalAvaliacao(false);
    if (pular || !corridaParaAvaliar) return;
    try {
      await updateDoc(doc(db, 'corridas', corridaParaAvaliar.id), {
        avaliacaoMotorista: { estrelas: estrelasAvaliacao, comentario: comentarioAvaliacao, criadoEm: new Date() },
      });
      const motoristaRef = doc(db, 'usuarios', corridaParaAvaliar.motoristaId);
      const motoristaSnap = await getDoc(motoristaRef);
      if (motoristaSnap.exists()) {
        const d = motoristaSnap.data();
        const total = d.totalAvaliacoes || 0;
        const media = d.avaliacaoMedia || 5.0;
        const novoTotal = total + 1;
        const novaMedia = ((media * total) + estrelasAvaliacao) / novoTotal;
        await updateDoc(motoristaRef, {
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

  const enviarDenuncia = async () => {
    if (!categoriaDenuncia) { Alert.alert('Atenção', 'Selecione uma categoria'); return; }
    if (!textoDenuncia.trim()) { Alert.alert('Atenção', 'Descreva o ocorrido'); return; }
    setDenunciando(true);
    try {
      await addDoc(collection(db, 'denuncias'), {
        denuncianteId: auth.currentUser?.uid,
        tipo: 'motorista',
        corridaId: corridaAtivaRef.current?.id || corridaParaAvaliar?.id || null,
        denunciadoId: corridaAtivaRef.current?.motoristaId || corridaParaAvaliar?.motoristaId || null,
        denunciadoNome: corridaAtivaRef.current?.motoristaNome || corridaParaAvaliar?.motoristaNome || null,
        categoria: categoriaDenuncia,
        descricao: textoDenuncia.trim(),
        criadoEm: new Date(),
      });
      Alert.alert('Denúncia enviada', 'Obrigado. Nossa equipe irá analisar.');
      setMostrarDenuncia(false);
      setCategoriaDenuncia('');
      setTextoDenuncia('');
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível enviar a denúncia');
    }
    setDenunciando(false);
  };

  const cancelarCorridaPendente = async () => {
    if (!corridaPendenteRef.current) return;
    Alert.alert('Cancelar solicitação?', 'A solicitação será cancelada.', [
      { text: 'Não', style: 'cancel' },
      {
        text: 'Sim, cancelar', style: 'destructive', onPress: async () => {
          await updateDoc(doc(db, 'corridas', corridaPendenteRef.current.id), {
            status: 'cancelada', canceladoPor: 'passageiro', canceladoEm: new Date(),
          });
          corridaPendenteRef.current = null;
          setCorridaPendente(null);
          if (unsubCorridaRef.current) unsubCorridaRef.current();
        },
      },
    ]);
  };

  const cancelarCorrida = async () => {
    if (!corridaAtivaRef.current) return;
    Alert.alert('Cancelar corrida?', 'O motorista será notificado.', [
      { text: 'Não', style: 'cancel' },
      {
        text: 'Sim, cancelar', style: 'destructive', onPress: async () => {
          await updateDoc(doc(db, 'corridas', corridaAtivaRef.current.id), {
            status: 'cancelada', canceladoPor: 'passageiro', canceladoEm: new Date(),
          });
          corridaAtivaRef.current = null;
          setCorridaAtiva(null);
          setMotoristaChegou(false);
          motoristaChegouRef.current = false;
          if (unsubCorridaRef.current) unsubCorridaRef.current();
          if (unsubChatRef.current) unsubChatRef.current();
        },
      },
    ]);
  };

  const adicionarMotorista = async () => {
    if (!codigoMotorista || codigoMotorista.length < 6) { Alert.alert('Atenção', 'Digite o código completo'); return; }
    setAdicionando(true);
    try {
      const uid = auth.currentUser?.uid;
      const q = query(collection(db, 'usuarios'), where('codigo', '==', codigoMotorista.toUpperCase()), where('tipo', '==', 'motorista'));
      const snap = await getDocs(q);
      if (snap.empty) { Alert.alert('Não encontrado', 'Nenhum motorista com esse código'); setAdicionando(false); return; }
      const motoristaDoc = snap.docs[0];
      if (motoristasIds.includes(motoristaDoc.id)) { Alert.alert('Atenção', 'Este motorista já está na sua lista'); setAdicionando(false); return; }
      const novosIds = [...motoristasIds, motoristaDoc.id];
      await updateDoc(doc(db, 'usuarios', uid!), { motoristas: novosIds });
      Alert.alert('Sucesso', `${motoristaDoc.data().nome} adicionado!`);
      setCodigoMotorista('');
      setMostrarAdd(false);
      setMotoristasIds(novosIds);
      escutarMotoristas(novosIds);
    } catch (e) { Alert.alert('Erro', 'Não foi possível adicionar motorista'); }
    setAdicionando(false);
  };

  const sair = async () => {
    await signOut(auth);
    router.replace('/');
  };

  const onlineCount = motoristas.filter((m: any) => m.online).length;
  const primeiroNome = nomeUsuario.split(' ')[0];
  const mostrarHistorico = destinoFocado && destino.length < 3 && historicoBusca.length > 0 && sugestoes.length === 0;

  const tempoDecorrido = (data: any): string => {
    if (!data) return 'desconhecido';
    const diffMin = Math.floor((Date.now() - new Date(data).getTime()) / 60000);
    if (diffMin < 60) return `${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH} hora${diffH !== 1 ? 's' : ''}`;
    return `${Math.floor(diffH / 24)} dia${Math.floor(diffH / 24) !== 1 ? 's' : ''}`;
  };

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView style={styles.wrapper} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      {/* Aviso inicial */}
      <Modal visible={mostrarAvisoInicial} transparent animationType="fade">
        <View style={styles.avisoOverlay}>
          <View style={styles.avisoCard}>
            <Text style={styles.avisoEmoji}>🤝</Text>
            <Text style={styles.avisoTitulo}>Lembrete importante</Text>
            <Text style={styles.avisoTexto}>
              O eluus é só para motoristas que você já conhece. Nunca peça corrida para um desconhecido.
            </Text>
            <TouchableOpacity style={styles.avisoBtn} onPress={() => setMostrarAvisoInicial(false)}>
              <Text style={styles.avisoBtnTxt}>Entendi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal perfil do motorista */}
      <Modal visible={!!motoristaPerfilModal} transparent animationType="slide" onRequestClose={() => setMotoristaPerfilModal(null)}>
        <View style={styles.perfilOverlay}>
          <View style={styles.perfilCard}>
            <TouchableOpacity style={styles.perfilFechar} onPress={() => setMotoristaPerfilModal(null)}>
              <Text style={styles.perfilFecharTxt}>✕</Text>
            </TouchableOpacity>
            {motoristaPerfilModal?.fotoUri ? (
              <Image source={{ uri: motoristaPerfilModal.fotoUri }} style={styles.perfilFoto} />
            ) : (
              <View style={styles.perfilAvatarGrande}>
                <Text style={styles.perfilAvatarTxt}>{motoristaPerfilModal?.nome?.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.perfilNome}>{motoristaPerfilModal?.nome}</Text>
            {motoristaPerfilModal?.avaliacaoMedia ? (
              <View style={styles.perfilAvalRow}>
                <Text style={styles.perfilEstrela}>★</Text>
                <Text style={styles.perfilAvalTxt}>
                  {motoristaPerfilModal.avaliacaoMedia.toFixed(1)} ({motoristaPerfilModal.totalAvaliacoes || 0} avaliações)
                </Text>
              </View>
            ) : (
              <Text style={styles.perfilSemAval}>Sem avaliações ainda</Text>
            )}
            <View style={styles.perfilDivisor} />
            <View style={styles.perfilInfoGrid}>
              {motoristaPerfilModal?.veiculo ? (
                <View style={styles.perfilInfoItem}>
                  <Text style={styles.perfilInfoLabel}>Veículo</Text>
                  <Text style={styles.perfilInfoValor}>{motoristaPerfilModal.veiculo}</Text>
                </View>
              ) : null}
              {motoristaPerfilModal?.cor ? (
                <View style={styles.perfilInfoItem}>
                  <Text style={styles.perfilInfoLabel}>Cor</Text>
                  <Text style={styles.perfilInfoValor}>{motoristaPerfilModal.cor}</Text>
                </View>
              ) : null}
              {motoristaPerfilModal?.placa ? (
                <View style={styles.perfilInfoItem}>
                  <Text style={styles.perfilInfoLabel}>Placa</Text>
                  <Text style={styles.perfilInfoValor}>{motoristaPerfilModal.placa}</Text>
                </View>
              ) : null}
              {motoristaPerfilModal?.precoPorKm ? (
                <View style={styles.perfilInfoItem}>
                  <Text style={styles.perfilInfoLabel}>Preço/km</Text>
                  <Text style={styles.perfilInfoValor}>R$ {motoristaPerfilModal.precoPorKm.toFixed(2)}</Text>
                </View>
              ) : null}
            </View>
            {motoristaPerfilModal?.telefone ? (
              <View style={styles.perfilTelBox}>
                <Text style={styles.perfilTelLabel}>📞 Telefone</Text>
                <Text style={styles.perfilTelValor}>{motoristaPerfilModal.telefone}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Modal denúncia */}
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
        <View style={styles.avaliacaoOverlay}>
          <View style={styles.avaliacaoCard}>
            <Text style={styles.avaliacaoEmoji}>⭐</Text>
            <Text style={styles.avaliacaoTitulo}>Como foi a corrida?</Text>
            <Text style={styles.avaliacaoSub}>Avalie {corridaParaAvaliar?.motoristaNome}</Text>
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
            <TouchableOpacity style={styles.avaliacaoBtn} onPress={() => salvarAvaliacaoMotorista(false)}>
              <Text style={styles.avaliacaoBtnTxt}>Enviar avaliação</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => salvarAvaliacaoMotorista(true)}>
              <Text style={styles.avaliacaoPularTxt}>Pular</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal chat */}
      <Modal visible={mostrarChat} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.chatOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.chatCard}>
            <View style={styles.chatHeader}>
              <Text style={styles.chatTitulo}>💬 Chat — {corridaAtiva?.motoristaNome}</Text>
              <TouchableOpacity onPress={fecharChat}>
                <Text style={styles.chatFechar}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.chatMensagens} showsVerticalScrollIndicator={false}>
              {mensagens.length === 0 && <Text style={styles.chatVazio}>Nenhuma mensagem ainda</Text>}
              {mensagens.map((m: any) => (
                <View key={m.id} style={[styles.msgBubble, m.remetente === 'passageiro' ? styles.msgMinha : styles.msgDele]}>
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

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>eluus</Text>
            <Text style={styles.bemvindo}>Olá, {primeiroNome} 👋</Text>
          </View>
          <View style={styles.headerBtns}>
            <TouchableOpacity onPress={() => router.push('/historico')} style={styles.headerBtn}>
              <Text style={styles.headerBtnTxt}>🕐</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/perfil')} style={styles.headerBtn}>
              <Text style={styles.headerBtnTxt}>👤</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={sair} style={styles.headerBtn}>
              <Text style={styles.headerBtnTxt}>Sair</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Status */}
        <View style={styles.statusBox}>
          <View style={[styles.bolinha, { backgroundColor: onlineCount > 0 ? '#22c55e' : '#4a5568' }]} />
          <Text style={styles.statusTxt}>{onlineCount} motorista{onlineCount !== 1 ? 's' : ''} online agora</Text>
        </View>

        {/* Corrida ativa */}
        {corridaAtiva && (
          <View style={[styles.corridaAtivaCard, motoristaChegou && styles.corridaChegouCard]}>
            <View style={styles.corridaAtivaTop}>
              <Text style={styles.corridaAtivaEmoji}>{motoristaChegou ? '🚗' : '⏳'}</Text>
              <View style={styles.corridaAtivaInfo}>
                <Text style={[styles.corridaAtivaTitulo, motoristaChegou && styles.corridaChegouTitulo]}>
                  {motoristaChegou ? '🚗 Motorista chegou!' : 'Corrida em andamento'}
                </Text>
                <Text style={styles.corridaAtivaMotorista}>{corridaAtiva.motoristaNome} está a caminho</Text>
                <Text style={styles.corridaAtivaDestino}>📍 {corridaAtiva.destino}</Text>
                {corridaAtiva.paradaDescricao ? (
                  <Text style={styles.corridaAtivaDestino}>🔶 Parada: {corridaAtiva.paradaDescricao}</Text>
                ) : null}
                <Text style={styles.corridaAtivaValor}>💰 R$ {corridaAtiva.valor} · {corridaAtiva.distancia} km total</Text>
              </View>
            </View>
            <View style={styles.corridaAtivaBtns}>
              <TouchableOpacity style={styles.corridaBtnChat} onPress={abrirChat}>
                <Text style={styles.corridaBtnTxt}>💬 Chat{msgNaoLidas > 0 ? ` (${msgNaoLidas})` : ''}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.corridaBtnCancelar} onPress={cancelarCorrida}>
                <Text style={styles.corridaBtnCancelarTxt}>✕ Cancelar</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setMostrarDenuncia(true)} style={styles.denunciarBtn}>
              <Text style={styles.denunciarBtnTxt}>🚨 Denunciar motorista</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Aguardando motorista offline */}
        {corridaPendente && !corridaAtiva && (
          <View style={styles.aguardandoCard}>
            <View style={styles.aguardandoTop}>
              <Text style={styles.aguardandoEmoji}>⏳</Text>
              <View style={styles.aguardandoInfo}>
                <Text style={styles.aguardandoTitulo}>Aguardando motorista ficar online...</Text>
                <Text style={styles.aguardandoMotorista}>{corridaPendente.motoristaNome}</Text>
                <Text style={styles.aguardandoDestino}>📍 {corridaPendente.destino}</Text>
                {corridaPendente.valor ? (
                  <Text style={styles.aguardandoValor}>💰 R$ {corridaPendente.valor}</Text>
                ) : null}
              </View>
            </View>
            <TouchableOpacity style={styles.corridaBtnCancelar} onPress={cancelarCorridaPendente}>
              <Text style={styles.corridaBtnCancelarTxt}>✕ Cancelar solicitação</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Destino */}
        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>Para onde?</Text>

          {/* Atalhos Casa / Trabalho */}
          {(casaEndereco || trabalhoEndereco) && (
            <View style={styles.atalhosBtns}>
              {casaEndereco && (
                <TouchableOpacity style={styles.atalhoBtn} onPress={() => calcularValores(casaEndereco.placeId, casaEndereco.descricao)}>
                  <Text style={styles.atalhoTxt}>🏠 Casa</Text>
                </TouchableOpacity>
              )}
              {trabalhoEndereco && (
                <TouchableOpacity style={styles.atalhoBtn} onPress={() => calcularValores(trabalhoEndereco.placeId, trabalhoEndereco.descricao)}>
                  <Text style={styles.atalhoTxt}>💼 Trabalho</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <TextInput
            style={styles.input}
            placeholder="Digite o destino..."
            placeholderTextColor="#4a5568"
            value={destino}
            onChangeText={buscarSugestoes}
            onFocus={() => setDestinoFocado(true)}
            onBlur={() => setTimeout(() => setDestinoFocado(false), 200)}
          />

          {/* Histórico de buscas */}
          {mostrarHistorico && (
            <View style={styles.sugestoesBox}>
              <Text style={styles.historicoLabel}>Buscas recentes</Text>
              {historicoBusca.map((h, i) => (
                <TouchableOpacity key={i} style={styles.sugestaoItem} onPress={() => calcularValores(h.placeId, h.descricao)}>
                  <Text style={styles.historicoIcon}>🕐</Text>
                  <Text style={styles.sugestaoTxt}>{h.descricao}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Sugestões do autocomplete */}
          {sugestoes.length > 0 && (
            <View style={styles.sugestoesBox}>
              {sugestoes.map((s: any) => (
                <TouchableOpacity key={s.place_id} style={styles.sugestaoItem} onPress={() => calcularValores(s.place_id, s.description)}>
                  <Text style={styles.historicoIcon}>📍</Text>
                  <Text style={styles.sugestaoTxt}>{s.description}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Salvar como casa/trabalho + adicionar parada */}
          {destinoPlaceId ? (
            <View style={styles.destinoAcoesRow}>
              <TouchableOpacity style={styles.destinoAcaoBtn} onPress={salvarCasa}>
                <Text style={styles.destinoAcaoTxt}>🏠 Salvar como casa</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.destinoAcaoBtn} onPress={salvarTrabalho}>
                <Text style={styles.destinoAcaoTxt}>💼 Salvar como trabalho</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Parada intermediária */}
          {destinoPlaceId && !mostrarParada && (
            <TouchableOpacity style={styles.addParadaBtn} onPress={() => setMostrarParada(true)}>
              <Text style={styles.addParadaTxt}>+ Adicionar parada</Text>
            </TouchableOpacity>
          )}

          {mostrarParada && (
            <View style={styles.paradaContainer}>
              <View style={styles.paradaHeader}>
                <Text style={styles.paradaLabel}>🔶 Parada intermediária</Text>
                <TouchableOpacity onPress={removerParada}>
                  <Text style={styles.paradaRemoverTxt}>Remover</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Digite a parada..."
                placeholderTextColor="#4a5568"
                value={parada}
                onChangeText={buscarSugestoesParada}
              />
              {paradaSugestoes.length > 0 && (
                <View style={styles.sugestoesBox}>
                  {paradaSugestoes.map((s: any) => (
                    <TouchableOpacity key={s.place_id} style={styles.sugestaoItem} onPress={() => selecionarParada(s.place_id, s.description)}>
                      <Text style={styles.historicoIcon}>📍</Text>
                      <Text style={styles.sugestaoTxt}>{s.description}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>

        {calculando && (
          <View style={styles.calculandoBox}>
            <ActivityIndicator color="#4a9eff" />
            <Text style={styles.calculandoTxt}>Calculando valores{paradaInfo ? ' com parada' : ''}...</Text>
          </View>
        )}

        {/* Motoristas */}
        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>Meus Motoristas</Text>
          {motoristas.length === 0 ? (
            <View style={styles.vazio}>
              <Text style={styles.vazioemoji}>🚗</Text>
              <Text style={styles.vaziotxt}>Nenhum motorista adicionado</Text>
              <Text style={styles.vaziossub}>Adicione motoristas pelo código de usuário</Text>
            </View>
          ) : (
            motoristas.map((m: any) => (
              <View key={m.id} style={[styles.motoristaCard, m.online && valores[m.id] && styles.motoristaCardDestaque]}>
                <View style={styles.motoristaTop}>
                  {/* Avatar com foto */}
                  <TouchableOpacity onPress={() => setMotoristaPerfilModal(m)}>
                    {m.fotoUri ? (
                      <Image source={{ uri: m.fotoUri }} style={styles.avatarImg} />
                    ) : (
                      <View style={styles.avatar}>
                        <Text style={styles.avatarTxt}>{m.nome?.charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <View style={styles.motoristaInfo}>
                    <TouchableOpacity onPress={() => setMotoristaPerfilModal(m)}>
                      <Text style={styles.motoristaNome}>{m.nome}</Text>
                    </TouchableOpacity>
                    <Text style={styles.motoristaSub}>
                      R$ {m.precoPorKm?.toFixed(2) || '2.50'}/km
                      {m.veiculo ? ` · ${m.veiculo}` : ''}
                      {m.cor ? ` ${m.cor}` : ''}
                    </Text>
                    {m.placa ? <Text style={styles.motoristaSub}>🚗 {m.placa}</Text> : null}
                    {m.avaliacaoMedia ? (
                      <Text style={styles.motoristaSub}>⭐ {m.avaliacaoMedia.toFixed(1)} ({m.totalAvaliacoes || 0} aval.)</Text>
                    ) : null}
                  </View>

                  <View style={styles.onlineTag}>
                    <View style={[styles.bolinhaStatus, { backgroundColor: m.online ? '#22c55e' : '#4a5568' }]} />
                    <Text style={[styles.onlineTxt, { color: m.online ? '#22c55e' : '#4a5568' }]}>{m.online ? 'Online' : 'Offline'}</Text>
                  </View>
                </View>

                {!m.online && !m.ultimaLocalizacao && (
                  <Text style={styles.semLocalizacaoTxt}>Localização não disponível</Text>
                )}

                {valores[m.id]?.estimado && (
                  <View style={styles.estimadoAvisoBox}>
                    <Text style={styles.estimadoAvisoTxt}>⚠️ Valor estimado • localização desatualizada</Text>
                    {valores[m.id].ultimaLocalizacaoEm ? (
                      <Text style={styles.ultimaLocTxt}>Última localização: há {tempoDecorrido(valores[m.id].ultimaLocalizacaoEm)}</Text>
                    ) : null}
                  </View>
                )}

                {valores[m.id] && (
                  <View style={styles.valorBox}>
                    <View style={styles.valorItem}>
                      <Text style={styles.valorLabel}>Até você</Text>
                      <Text style={styles.valorTxt}>{valores[m.id].distMotoristaPassageiro} km</Text>
                    </View>
                    <View style={styles.valorItem}>
                      <Text style={styles.valorLabel}>Ao destino</Text>
                      <Text style={styles.valorTxt}>{valores[m.id].distPassageiroDestino} km</Text>
                    </View>
                    <View style={styles.valorItem}>
                      <Text style={styles.valorLabel}>Total</Text>
                      <Text style={styles.valorPreco}>R$ {valores[m.id].preco}</Text>
                    </View>
                  </View>
                )}
                {valores[m.id] && !corridaAtiva && !corridaPendente && (
                  <TouchableOpacity style={styles.solicitarBtn} onPress={() => solicitarCorrida(m)}>
                    <Text style={styles.solicitarTxt}>{m.online ? 'Solicitar corrida' : 'Enviar solicitação'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>

        {/* Adicionar motorista */}
        {mostrarAdd ? (
          <View style={styles.addCard}>
            <Text style={styles.addTitulo}>Digite o código do motorista</Text>
            <TextInput style={styles.addInput} placeholder="Ex: AB12CD" placeholderTextColor="#64748b" value={codigoMotorista} onChangeText={setCodigoMotorista} autoCapitalize="characters" maxLength={6} />
            <View style={styles.addBtns}>
              <TouchableOpacity style={styles.cancelarBtn} onPress={() => setMostrarAdd(false)}>
                <Text style={styles.cancelarTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmarBtn} onPress={adicionarMotorista} disabled={adicionando}>
                <Text style={styles.confirmarTxt}>{adicionando ? 'Buscando...' : 'Adicionar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.addBtn} onPress={() => setMostrarAdd(true)}>
            <Text style={styles.addTxt}>+ Adicionar Motorista</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#0d0f14' },
  container: { flex: 1, padding: 24, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  logo: { fontSize: 22, fontWeight: 'bold', color: '#4a9eff', letterSpacing: 1 },
  bemvindo: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginTop: 4 },
  headerBtns: { flexDirection: 'row', gap: 8 },
  headerBtn: { backgroundColor: '#1a1f2e', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#2a3044' },
  headerBtnTxt: { color: '#94a3b8', fontSize: 13 },
  statusBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 },
  bolinha: { width: 8, height: 8, borderRadius: 4 },
  statusTxt: { color: '#94a3b8', fontSize: 13 },
  corridaAtivaCard: { backgroundColor: '#0f2a1a', borderRadius: 20, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#22c55e', gap: 10 },
  corridaChegouCard: { borderColor: '#f59e0b', backgroundColor: '#1a1a0a' },
  corridaAtivaTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  corridaAtivaEmoji: { fontSize: 32 },
  corridaAtivaInfo: { flex: 1, gap: 4 },
  corridaAtivaTitulo: { color: '#22c55e', fontWeight: 'bold', fontSize: 15 },
  corridaChegouTitulo: { color: '#f59e0b' },
  corridaAtivaMotorista: { color: '#fff', fontSize: 13 },
  corridaAtivaDestino: { color: '#94a3b8', fontSize: 12 },
  corridaAtivaValor: { color: '#4a9eff', fontSize: 12, fontWeight: '600' },
  corridaAtivaBtns: { flexDirection: 'row', gap: 8 },
  corridaBtnChat: { flex: 1, backgroundColor: '#1a1f2e', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#7c5cfc' },
  corridaBtnCancelar: { flex: 1, backgroundColor: '#2a1a1a', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#ef4444' },
  corridaBtnTxt: { color: '#fff', fontWeight: '600', fontSize: 13 },
  corridaBtnCancelarTxt: { color: '#ef4444', fontWeight: '600', fontSize: 13 },
  secao: { marginBottom: 24 },
  secaoTitulo: { color: '#94a3b8', fontSize: 12, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
  atalhosBtns: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  atalhoBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1f2e', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#2a3044' },
  atalhoTxt: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  input: { backgroundColor: '#1a1f2e', borderRadius: 14, padding: 16, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#2a3044' },
  sugestoesBox: { backgroundColor: '#1a1f2e', borderRadius: 14, marginTop: 4, borderWidth: 1, borderColor: '#2a3044', overflow: 'hidden' },
  historicoLabel: { color: '#64748b', fontSize: 11, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 },
  sugestaoItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: '#2a3044' },
  historicoIcon: { fontSize: 14 },
  sugestaoTxt: { color: '#fff', fontSize: 13, flex: 1 },
  destinoAcoesRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  destinoAcaoBtn: { flex: 1, backgroundColor: '#1a1f2e', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center', borderWidth: 1, borderColor: '#2a3044' },
  destinoAcaoTxt: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  addParadaBtn: { marginTop: 10, alignItems: 'center', paddingVertical: 8 },
  addParadaTxt: { color: '#4a9eff', fontSize: 13, fontWeight: '600' },
  paradaContainer: { marginTop: 8, gap: 6 },
  paradaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  paradaLabel: { color: '#f59e0b', fontSize: 13, fontWeight: '600' },
  paradaRemoverTxt: { color: '#ef4444', fontSize: 12 },
  calculandoBox: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20, padding: 16, backgroundColor: '#1a1f2e', borderRadius: 14 },
  calculandoTxt: { color: '#94a3b8', fontSize: 14 },
  vazio: { backgroundColor: '#1a1f2e', borderRadius: 16, padding: 32, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#2a3044' },
  vazioemoji: { fontSize: 40, marginBottom: 8 },
  vaziotxt: { color: '#fff', fontWeight: '600', fontSize: 15, textAlign: 'center' },
  vaziossub: { color: '#64748b', fontSize: 13, textAlign: 'center' },
  motoristaCard: { backgroundColor: '#1a1f2e', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#2a3044' },
  motoristaCardDestaque: { borderColor: '#4a9eff' },
  motoristaTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#4a9eff', alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 46, height: 46, borderRadius: 23 },
  avatarTxt: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  motoristaInfo: { flex: 1 },
  motoristaNome: { color: '#fff', fontWeight: '600', fontSize: 15 },
  motoristaSub: { color: '#64748b', fontSize: 12, marginTop: 2 },
  onlineTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bolinhaStatus: { width: 8, height: 8, borderRadius: 4 },
  onlineTxt: { fontSize: 12, fontWeight: '600' },
  valorBox: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, padding: 12, backgroundColor: '#0d0f14', borderRadius: 12 },
  valorItem: { alignItems: 'center', flex: 1 },
  valorLabel: { color: '#64748b', fontSize: 11, marginBottom: 4 },
  valorTxt: { color: '#fff', fontWeight: '600', fontSize: 14 },
  valorPreco: { color: '#4a9eff', fontWeight: 'bold', fontSize: 18 },
  solicitarBtn: { backgroundColor: '#4a9eff', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 12 },
  solicitarTxt: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  addBtn: { backgroundColor: '#1a1f2e', borderRadius: 16, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: '#4a9eff', borderStyle: 'dashed' },
  addTxt: { color: '#4a9eff', fontWeight: '600', fontSize: 15 },
  addCard: { backgroundColor: '#1a1f2e', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#4a9eff', gap: 12 },
  addTitulo: { color: '#fff', fontWeight: '600', fontSize: 15 },
  addInput: { backgroundColor: '#0d0f14', borderRadius: 12, padding: 14, color: '#ffffff', fontSize: 24, fontWeight: 'bold', letterSpacing: 6, textAlign: 'center', borderWidth: 1, borderColor: '#4a9eff' },
  addBtns: { flexDirection: 'row', gap: 10 },
  cancelarBtn: { flex: 1, backgroundColor: '#2a3044', borderRadius: 12, padding: 14, alignItems: 'center' },
  cancelarTxt: { color: '#ffffff', fontWeight: '600', fontSize: 15 },
  confirmarBtn: { flex: 1, backgroundColor: '#4a9eff', borderRadius: 12, padding: 14, alignItems: 'center' },
  confirmarTxt: { color: '#ffffff', fontWeight: '600', fontSize: 15 },
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
  avaliacaoOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
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
  avisoOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  avisoCard: { backgroundColor: '#13161e', borderRadius: 24, padding: 28, alignItems: 'center', gap: 14, borderWidth: 1, borderColor: '#4a9eff', width: '100%' },
  avisoEmoji: { fontSize: 48 },
  avisoTitulo: { color: '#fff', fontWeight: 'bold', fontSize: 20, textAlign: 'center' },
  avisoTexto: { color: '#94a3b8', fontSize: 15, lineHeight: 24, textAlign: 'center' },
  avisoBtn: { backgroundColor: '#4a9eff', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40, marginTop: 4 },
  avisoBtnTxt: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  // perfil do motorista
  perfilOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  perfilCard: { backgroundColor: '#13161e', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 32, alignItems: 'center', gap: 10, borderTopWidth: 1, borderColor: '#2a3044', paddingBottom: 48 },
  perfilFechar: { position: 'absolute', top: 20, right: 24 },
  perfilFecharTxt: { color: '#64748b', fontSize: 20, fontWeight: 'bold' },
  perfilFoto: { width: 96, height: 96, borderRadius: 48, marginBottom: 4 },
  perfilAvatarGrande: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#4a9eff', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  perfilAvatarTxt: { color: '#fff', fontWeight: 'bold', fontSize: 40 },
  perfilNome: { color: '#fff', fontWeight: 'bold', fontSize: 22 },
  perfilAvalRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  perfilEstrela: { color: '#f59e0b', fontSize: 18 },
  perfilAvalTxt: { color: '#94a3b8', fontSize: 14 },
  perfilSemAval: { color: '#475569', fontSize: 13 },
  perfilDivisor: { width: '100%', height: 1, backgroundColor: '#1a1f2e', marginVertical: 8 },
  perfilInfoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, width: '100%' },
  perfilInfoItem: { backgroundColor: '#1a1f2e', borderRadius: 12, padding: 14, flex: 1, minWidth: '44%', borderWidth: 1, borderColor: '#2a3044' },
  perfilInfoLabel: { color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  perfilInfoValor: { color: '#fff', fontWeight: '600', fontSize: 15 },
  perfilTelBox: { width: '100%', backgroundColor: '#0f1e2e', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#1e3a55', alignItems: 'center', marginTop: 4 },
  perfilTelLabel: { color: '#64748b', fontSize: 12, marginBottom: 4 },
  perfilTelValor: { color: '#4a9eff', fontWeight: '700', fontSize: 18, letterSpacing: 1 },
  denunciarBtn: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12 },
  denunciarBtnTxt: { color: '#ef4444', fontSize: 12, fontWeight: '600' },
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
  aguardandoCard: { backgroundColor: '#1a1a0a', borderRadius: 20, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#f59e0b', gap: 10 },
  aguardandoTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  aguardandoEmoji: { fontSize: 32 },
  aguardandoInfo: { flex: 1, gap: 4 },
  aguardandoTitulo: { color: '#f59e0b', fontWeight: 'bold', fontSize: 14 },
  aguardandoMotorista: { color: '#fff', fontSize: 13 },
  aguardandoDestino: { color: '#94a3b8', fontSize: 12 },
  aguardandoValor: { color: '#4a9eff', fontSize: 12, fontWeight: '600' },
  estimadoAvisoBox: { backgroundColor: '#1a160a', borderRadius: 10, padding: 10, marginTop: 10, borderWidth: 1, borderColor: '#f59e0b66' },
  estimadoAvisoTxt: { color: '#f59e0b', fontSize: 12, fontWeight: '600' },
  ultimaLocTxt: { color: '#94a3b8', fontSize: 11, marginTop: 3 },
  semLocalizacaoTxt: { color: '#4a5568', fontSize: 12, fontStyle: 'italic', marginTop: 8 },
});
