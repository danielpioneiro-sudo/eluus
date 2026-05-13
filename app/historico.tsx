import { useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Clipboard,
    KeyboardAvoidingView,
    Linking,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { auth, db } from '../firebaseConfig';

export default function Historico() {
  const router = useRouter();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [corridas, setCorridas] = useState<any[]>([]);
  const [tipo, setTipo] = useState('');
  const [filtro, setFiltro] = useState('todas');

  // "Esqueci algo" state
  const [corridaSelecionada, setCorridaSelecionada] = useState<any>(null);
  const [mostrarEsqueci, setMostrarEsqueci] = useState(false);
  const [mostrarChat, setMostrarChat] = useState(false);
  const [mostrarContato, setMostrarContato] = useState(false);
  const [motoristaDados, setMotoristaDados] = useState<any>(null);
  const [buscandoContato, setBuscandoContato] = useState(false);
  const [mensagens, setMensagens] = useState<any[]>([]);
  const [novaMensagem, setNovaMensagem] = useState('');
  const unsubChatRef = useRef<any>(null);

  // Badge de msgs não lidas por corrida (motorista)
  const [msgsBadges, setMsgsBadges] = useState<Record<string, number>>({});
  const unsubsMsgsRef = useRef<any[]>([]);
  const nomeUsuario = useRef('');

  useEffect(() => {
    carregarHistorico();
    return () => {
      if (unsubChatRef.current) unsubChatRef.current();
      unsubsMsgsRef.current.forEach(u => u());
    };
  }, []);

  const carregarHistorico = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      const { getDoc: _getDoc, doc: _doc } = await import('firebase/firestore');
      const userDoc = await _getDoc(_doc(db, 'usuarios', uid));
      const data = userDoc.data();
      const tipoUsuario = data?.tipo || 'passageiro';
      nomeUsuario.current = data?.nome || '';
      setTipo(tipoUsuario);

      const campo = tipoUsuario === 'motorista' ? 'motoristaId' : 'passageiroId';
      const q = query(
        collection(db, 'corridas'),
        where(campo, '==', uid),
        orderBy('criadoEm', 'desc')
      );
      const snap = await getDocs(q);
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCorridas(lista);

      if (tipoUsuario === 'motorista') {
        escutarMsgsBadgesMotorista(lista);
      }
    } catch (e) {}
    setLoading(false);
  };

  const escutarMsgsBadgesMotorista = (lista: any[]) => {
    unsubsMsgsRef.current.forEach(u => u());
    unsubsMsgsRef.current = [];
    const h48Atras = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const recentes = lista.filter(c =>
      c.status === 'finalizada' &&
      c.finalizadaEm?.toDate?.() >= h48Atras
    );
    recentes.forEach(corrida => {
      const q = query(
        collection(db, 'corridas', corrida.id, 'mensagens'),
        where('remetente', '==', 'passageiro'),
        where('lida', '!=', true)
      );
      const unsub = onSnapshot(q, snap => {
        setMsgsBadges(prev => ({ ...prev, [corrida.id]: snap.docs.length }));
      });
      unsubsMsgsRef.current.push(unsub);
    });
  };

  const abrirEsqueci = (corrida: any) => {
    setCorridaSelecionada(corrida);
    setMostrarEsqueci(true);
  };

  const abrirChat = (corrida: any) => {
    setCorridaSelecionada(corrida);
    setMostrarEsqueci(false);
    setMensagens([]);
    setMostrarChat(true);
    escutarMensagens(corrida.id);
  };

  const escutarMensagens = (corridaId: string) => {
    if (unsubChatRef.current) unsubChatRef.current();
    const q = query(collection(db, 'corridas', corridaId, 'mensagens'), orderBy('criadoEm', 'asc'));
    unsubChatRef.current = onSnapshot(q, snap => {
      setMensagens(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      // Marca mensagens do motorista como lidas (para o passageiro)
      snap.docs.forEach(async d => {
        const data = d.data();
        if (data.remetente === 'motorista' && !data.lida) {
          await updateDoc(d.ref, { lida: true }).catch(() => null);
        }
      });
    });
  };

  const enviarMensagem = async () => {
    if (!novaMensagem.trim() || !corridaSelecionada) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const remetente = tipo === 'motorista' ? 'motorista' : 'passageiro';
    try {
      await addDoc(collection(db, 'corridas', corridaSelecionada.id, 'mensagens'), {
        texto: novaMensagem.trim(),
        remetente,
        remetenteNome: nomeUsuario.current,
        criadoEm: new Date(),
        lida: false,
      });
      setNovaMensagem('');
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível enviar a mensagem');
    }
  };

  const fecharChat = () => {
    if (unsubChatRef.current) unsubChatRef.current();
    setMostrarChat(false);
    setMensagens([]);
    // Recarrega para atualizar badges
    carregarHistorico();
  };

  const buscarContatoMotorista = async (corrida: any) => {
    setBuscandoContato(true);
    setMostrarEsqueci(false);
    try {
      const motoristaDoc = await getDoc(doc(db, 'usuarios', corrida.motoristaId));
      if (motoristaDoc.exists()) {
        setMotoristaDados({ id: corrida.motoristaId, ...motoristaDoc.data() });
      } else {
        setMotoristaDados(null);
      }
    } catch (e) {
      setMotoristaDados(null);
    }
    setBuscandoContato(false);
    setMostrarContato(true);
  };

  const copiarNumero = (numero: string) => {
    try {
      Clipboard.setString(numero);
    } catch { /* ignore */ }
    Alert.alert('', t('historico.numberCopied'));
  };

  const formatarWhatsApp = (tel: string): string => {
    return tel.replace(/[\s\-()]/g, '');
  };

  const corridasFiltradas = corridas.filter(c => {
    if (filtro === 'todas') return true;
    return c.status === filtro;
  });

  const totalGasto = corridas
    .filter(c => c.status === 'finalizada')
    .reduce((acc, c) => acc + parseFloat(c.valor || 0), 0);

  const statusInfo: any = {
    finalizada: { cor: '#22c55e', emoji: '✅', label: t('historico.statusFinalizada') },
    cancelada: { cor: '#ef4444', emoji: '✕', label: t('historico.statusCancelada') },
    pendente: { cor: '#f59e0b', emoji: '⏳', label: t('historico.statusPendente') },
    aceita: { cor: '#4a9eff', emoji: '🚗', label: t('historico.statusAceita') },
    recusada: { cor: '#64748b', emoji: '✕', label: t('historico.statusRecusada') },
  };

  const formatarData = (timestamp: any) => {
    if (!timestamp) return '';
    const data = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return data.toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#4a9eff" size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0d0f14' }}>

      {/* Modal Esqueci algo */}
      <Modal visible={mostrarEsqueci} transparent animationType="slide" onRequestClose={() => setMostrarEsqueci(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalEmoji}>🎒</Text>
            <Text style={styles.modalTitulo}>{t('historico.forgotTitle')}</Text>
            <Text style={styles.modalSub}>{t('historico.forgotSub')}</Text>
            <TouchableOpacity style={styles.opcaoBtn} onPress={() => corridaSelecionada && abrirChat(corridaSelecionada)}>
              <Text style={styles.opcaoTxt}>{t('historico.sendMessage')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.opcaoBtn} onPress={() => corridaSelecionada && buscarContatoMotorista(corridaSelecionada)}>
              {buscandoContato
                ? <ActivityIndicator color="#4a9eff" />
                : <Text style={styles.opcaoTxt}>{t('historico.seeContact')}</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMostrarEsqueci(false)}>
              <Text style={styles.cancelarTxt}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Contato do Motorista */}
      <Modal visible={mostrarContato} transparent animationType="slide" onRequestClose={() => setMostrarContato(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalEmoji}>📞</Text>
            <Text style={styles.modalTitulo}>{t('historico.contactTitle')}</Text>
            {motoristaDados ? (
              <>
                <Text style={styles.motoristaNome}>{motoristaDados.nome}</Text>
                {/* Telefone */}
                <View style={styles.contatoBox}>
                  <Text style={styles.contatoLabel}>Telefone</Text>
                  {motoristaDados.telefone ? (
                    <>
                      <Text style={styles.contatoNumero}>{motoristaDados.telefone}</Text>
                      <View style={styles.contatoBtns}>
                        <TouchableOpacity style={styles.contatoBtn} onPress={() => copiarNumero(motoristaDados.telefone)}>
                          <Text style={styles.contatoBtnTxt}>{t('historico.copyNumber')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.contatoBtn, styles.contatoBtnLigar]} onPress={() => Linking.openURL(`tel:${motoristaDados.telefone}`)}>
                          <Text style={styles.contatoBtnTxt}>{t('historico.callDriver')}</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <Text style={styles.contatoVazio}>{t('historico.noPhone')}</Text>
                  )}
                </View>
                {/* WhatsApp */}
                <View style={styles.contatoBox}>
                  <Text style={styles.contatoLabel}>WhatsApp</Text>
                  {motoristaDados.whatsapp ? (
                    <>
                      <Text style={styles.contatoNumero}>{motoristaDados.whatsapp}</Text>
                      <View style={styles.contatoBtns}>
                        <TouchableOpacity style={styles.contatoBtn} onPress={() => copiarNumero(motoristaDados.whatsapp)}>
                          <Text style={styles.contatoBtnTxt}>{t('historico.copyNumber')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.contatoBtn, styles.contatoBtnWhatsApp]} onPress={() => Linking.openURL(`https://wa.me/${formatarWhatsApp(motoristaDados.whatsapp)}`)}>
                          <Text style={styles.contatoBtnTxt}>{t('historico.openWhatsApp')}</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : motoristaDados.telefone ? (
                    <>
                      <Text style={styles.contatoNumero}>{motoristaDados.telefone}</Text>
                      <TouchableOpacity style={[styles.contatoBtn, styles.contatoBtnWhatsApp]} onPress={() => Linking.openURL(`https://wa.me/${formatarWhatsApp(motoristaDados.telefone)}`)}>
                        <Text style={styles.contatoBtnTxt}>{t('historico.openWhatsApp')}</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <Text style={styles.contatoVazio}>{t('historico.noWhatsApp')}</Text>
                  )}
                </View>
              </>
            ) : (
              <Text style={styles.contatoVazio}>Informações de contato não disponíveis</Text>
            )}
            <TouchableOpacity onPress={() => setMostrarContato(false)}>
              <Text style={styles.cancelarTxt}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Chat pós-corrida */}
      <Modal visible={mostrarChat} transparent animationType="slide" onRequestClose={fecharChat}>
        <KeyboardAvoidingView style={styles.chatOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.chatCard}>
            <View style={styles.chatHeader}>
              <Text style={styles.chatTitulo}>💬 {t('historico.chatTitle')}</Text>
              <TouchableOpacity onPress={fecharChat}>
                <Text style={styles.chatFechar}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.chatMensagens} showsVerticalScrollIndicator={false}>
              {mensagens.length === 0 && (
                <Text style={styles.chatVazio}>{t('historico.noMessages')}</Text>
              )}
              {mensagens.map((m: any) => {
                const isMe = (tipo === 'motorista' && m.remetente === 'motorista') ||
                             (tipo !== 'motorista' && m.remetente === 'passageiro');
                return (
                  <View key={m.id} style={[styles.msgBubble, isMe ? styles.msgMinha : styles.msgDele]}>
                    <Text style={styles.msgTxt}>{m.texto}</Text>
                  </View>
                );
              })}
            </ScrollView>
            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatTextInput}
                placeholder={t('historico.messagePlaceholder')}
                placeholderTextColor="#4a5568"
                value={novaMensagem}
                onChangeText={setNovaMensagem}
              />
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
          <TouchableOpacity onPress={() => router.back()} style={styles.voltarBtn}>
            <Text style={styles.voltarTxt}>{t('common.back')}</Text>
          </TouchableOpacity>
          <Text style={styles.titulo}>{t('historico.title')}</Text>
          <View style={{ width: 80 }} />
        </View>

        {/* Resumo */}
        <View style={styles.resumoRow}>
          <View style={styles.resumoCard}>
            <Text style={styles.resumoValor}>{corridas.filter(c => c.status === 'finalizada').length}</Text>
            <Text style={styles.resumoLabel}>{t('historico.completed')}</Text>
          </View>
          <View style={styles.resumoCard}>
            <Text style={styles.resumoValor}>{corridas.filter(c => c.status === 'cancelada').length}</Text>
            <Text style={styles.resumoLabel}>{t('historico.cancelled')}</Text>
          </View>
          <View style={styles.resumoCard}>
            <Text style={[styles.resumoValor, { color: '#4a9eff', fontSize: 16 }]}>
              R$ {totalGasto.toFixed(2)}
            </Text>
            <Text style={styles.resumoLabel}>
              {tipo === 'motorista' ? t('historico.received') : t('historico.spent')}
            </Text>
          </View>
        </View>

        {/* Filtros */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtrosContainer}>
          {[
            { key: 'todas', label: t('historico.all') },
            { key: 'finalizada', label: `✅ ${t('historico.completed')}` },
            { key: 'cancelada', label: `✕ ${t('historico.cancelled')}` },
            { key: 'pendente', label: `⏳ ${t('historico.statusPendente')}` },
          ].map(f => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filtroBtn, filtro === f.key && styles.filtroBtnAtivo]}
              onPress={() => setFiltro(f.key)}>
              <Text style={[styles.filtroTxt, filtro === f.key && styles.filtroTxtAtivo]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Lista */}
        {corridasFiltradas.length === 0 ? (
          <View style={styles.vazio}>
            <Text style={styles.vazioemoji}>🕐</Text>
            <Text style={styles.vaziotxt}>{t('historico.noRides')}</Text>
            <Text style={styles.vaziossub}>{t('historico.noRidesSub')}</Text>
          </View>
        ) : (
          corridasFiltradas.map((c: any) => {
            const info = statusInfo[c.status] || statusInfo.pendente;
            const badgeCount = msgsBadges[c.id] || 0;
            return (
              <View key={c.id} style={styles.corridaCard}>
                <View style={styles.corridaTop}>
                  <View style={[styles.statusBadge, { backgroundColor: info.cor + '20', borderColor: info.cor }]}>
                    <Text style={[styles.statusTxt, { color: info.cor }]}>{info.emoji} {info.label}</Text>
                  </View>
                  <Text style={styles.corridaData}>{formatarData(c.criadoEm)}</Text>
                </View>

                <View style={styles.corridaInfo}>
                  <View style={styles.corridaRow}>
                    <Text style={styles.corridaLabel}>
                      {tipo === 'motorista' ? t('historico.passenger') : t('historico.driver')}
                    </Text>
                    <Text style={styles.corridaValorTxt}>
                      {tipo === 'motorista' ? c.passageiroNome : c.motoristaNome}
                    </Text>
                  </View>
                  <View style={styles.corridaRow}>
                    <Text style={styles.corridaLabel}>{t('historico.destination')}</Text>
                    <Text style={styles.corridaDestino} numberOfLines={2}>{c.destino}</Text>
                  </View>
                  <View style={styles.corridaDivider} />
                  <View style={styles.corridaRow}>
                    <Text style={styles.corridaLabel}>{t('historico.distance')}</Text>
                    <Text style={styles.corridaValorTxt}>{c.distancia} km</Text>
                  </View>
                  <View style={styles.corridaRow}>
                    <Text style={styles.corridaLabel}>{t('historico.value')}</Text>
                    <Text style={styles.corridaPreco}>R$ {c.valor}</Text>
                  </View>
                </View>

                {/* Botão "Esqueci algo" — apenas passageiros em corridas finalizadas */}
                {tipo !== 'motorista' && c.status === 'finalizada' && (
                  <TouchableOpacity style={styles.esqueciBtn} onPress={() => abrirEsqueci(c)}>
                    <Text style={styles.esqueciTxt}>{t('historico.forgotSomething')}</Text>
                  </TouchableOpacity>
                )}

                {/* Botão chat pós-corrida para motorista + badge */}
                {tipo === 'motorista' && c.status === 'finalizada' && badgeCount > 0 && (
                  <TouchableOpacity style={styles.chatBadgeBtn} onPress={() => abrirChat(c)}>
                    <Text style={styles.chatBadgeTxt}>
                      💬 {badgeCount} {t('historico.unreadMessages')}
                    </Text>
                  </TouchableOpacity>
                )}
                {tipo === 'motorista' && c.status === 'finalizada' && badgeCount === 0 && (
                  <TouchableOpacity style={styles.chatRespondBtn} onPress={() => abrirChat(c)}>
                    <Text style={styles.chatRespondTxt}>💬 {t('historico.chatTitle')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: '#0d0f14', alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: '#0d0f14', padding: 24, paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  voltarBtn: { backgroundColor: '#1a1f2e', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#2a3044' },
  voltarTxt: { color: '#94a3b8', fontSize: 13 },
  titulo: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  resumoRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  resumoCard: { flex: 1, backgroundColor: '#1a1f2e', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#2a3044', gap: 4 },
  resumoValor: { color: '#fff', fontWeight: 'bold', fontSize: 22 },
  resumoLabel: { color: '#64748b', fontSize: 11, textAlign: 'center' },
  filtrosContainer: { marginBottom: 20 },
  filtroBtn: { backgroundColor: '#1a1f2e', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#2a3044' },
  filtroBtnAtivo: { backgroundColor: '#4a9eff20', borderColor: '#4a9eff' },
  filtroTxt: { color: '#64748b', fontSize: 13 },
  filtroTxtAtivo: { color: '#4a9eff', fontWeight: '600' },
  vazio: { backgroundColor: '#1a1f2e', borderRadius: 16, padding: 48, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#2a3044', marginTop: 20 },
  vazioemoji: { fontSize: 48, marginBottom: 8 },
  vaziotxt: { color: '#fff', fontWeight: '600', fontSize: 16, textAlign: 'center' },
  vaziossub: { color: '#64748b', fontSize: 13, textAlign: 'center' },
  corridaCard: { backgroundColor: '#1a1f2e', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#2a3044' },
  corridaTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  statusTxt: { fontSize: 12, fontWeight: '600' },
  corridaData: { color: '#4a5568', fontSize: 11 },
  corridaInfo: { gap: 8 },
  corridaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  corridaLabel: { color: '#64748b', fontSize: 13, flex: 1 },
  corridaValorTxt: { color: '#fff', fontSize: 13, fontWeight: '500', flex: 2, textAlign: 'right' },
  corridaDestino: { color: '#fff', fontSize: 13, fontWeight: '500', flex: 2, textAlign: 'right' },
  corridaDivider: { height: 1, backgroundColor: '#2a3044', marginVertical: 4 },
  corridaPreco: { color: '#4a9eff', fontSize: 16, fontWeight: 'bold', flex: 2, textAlign: 'right' },
  esqueciBtn: { marginTop: 12, backgroundColor: '#1a1a2e', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#7c5cfc' },
  esqueciTxt: { color: '#a78bfa', fontWeight: '600', fontSize: 13 },
  chatBadgeBtn: { marginTop: 12, backgroundColor: '#1a0a0a', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#ef4444' },
  chatBadgeTxt: { color: '#ef4444', fontWeight: '700', fontSize: 13 },
  chatRespondBtn: { marginTop: 12, backgroundColor: '#0d0f14', borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#2a3044' },
  chatRespondTxt: { color: '#64748b', fontSize: 12 },
  // Modais
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#13161e', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 28, alignItems: 'center', gap: 14, borderTopWidth: 1, borderColor: '#2a3044' },
  modalEmoji: { fontSize: 48 },
  modalTitulo: { color: '#fff', fontWeight: 'bold', fontSize: 20 },
  modalSub: { color: '#94a3b8', fontSize: 14, textAlign: 'center' },
  opcaoBtn: { width: '100%', backgroundColor: '#1a1f2e', borderRadius: 16, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: '#4a9eff', minHeight: 56, justifyContent: 'center' },
  opcaoTxt: { color: '#4a9eff', fontWeight: '700', fontSize: 15 },
  cancelarTxt: { color: '#64748b', fontSize: 14, paddingVertical: 12 },
  motoristaNome: { color: '#fff', fontWeight: 'bold', fontSize: 17 },
  contatoBox: { width: '100%', backgroundColor: '#1a1f2e', borderRadius: 14, padding: 14, gap: 8, borderWidth: 1, borderColor: '#2a3044' },
  contatoLabel: { color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  contatoNumero: { color: '#fff', fontWeight: '600', fontSize: 16 },
  contatoVazio: { color: '#4a5568', fontSize: 13, fontStyle: 'italic' },
  contatoBtns: { flexDirection: 'row', gap: 8 },
  contatoBtn: { flex: 1, backgroundColor: '#2a3044', borderRadius: 10, padding: 10, alignItems: 'center' },
  contatoBtnLigar: { backgroundColor: '#0f2a1a', borderWidth: 1, borderColor: '#22c55e' },
  contatoBtnWhatsApp: { backgroundColor: '#0a1f15', borderWidth: 1, borderColor: '#25d366' },
  contatoBtnTxt: { color: '#fff', fontWeight: '600', fontSize: 12 },
  // Chat
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
  chatInputRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  chatTextInput: { flex: 1, backgroundColor: '#1a1f2e', borderRadius: 14, padding: 14, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#2a3044' },
  chatEnviar: { backgroundColor: '#4a9eff', width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  chatEnviarTxt: { color: '#fff', fontSize: 18 },
});
