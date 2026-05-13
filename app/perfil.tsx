import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { changeLang, LANGUAGES } from '../i18n';
import { EmailAuthProvider, reauthenticateWithCredential, sendEmailVerification, updateEmail, updatePassword } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert, Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { auth, db } from '../firebaseConfig';

export default function Perfil() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [tipo, setTipo] = useState('');
  const [codigo, setCodigo] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [fotoUri, setFotoUri] = useState('');
  const [veiculo, setVeiculo] = useState('');
  const [placa, setPlaca] = useState('');
  const [cor, setCor] = useState('');
  const [pais, setPais] = useState('');
  const [cpf, setCpfVal] = useState('');
  const [cnh, setCnh] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(true);
  const [editandoCodigo, setEditandoCodigo] = useState(false);
  const [novoCodigo, setNovoCodigo] = useState('');
  const [salvandoCodigo, setSalvandoCodigo] = useState(false);
  const [mostrarQR, setMostrarQR] = useState(false);
  const [modalSenha, setModalSenha] = useState(false);
  const [modalEmail, setModalEmail] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [novoEmail, setNovoEmail] = useState('');
  const [alterando, setAlterando] = useState(false);

  useEffect(() => {
    carregarPerfil();
  }, []);

  const carregarPerfil = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const userDoc = await getDoc(doc(db, 'usuarios', uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setNome(data.nome || '');
        setTelefone(data.telefone || '');
        setTipo(data.tipo || '');
        setCodigo(data.codigo || '');
        setEmail(data.email || '');
        setWhatsapp(data.whatsapp || '');
        setFotoUri(data.fotoUri || '');
        setVeiculo(data.veiculo || '');
        setPlaca(data.placa || '');
        setCor(data.cor || '');
        setPais(data.pais || '');
        setCpfVal(data.cpf || '');
        setCnh(data.cnh || '');
        setPhoneVerified(data.phoneVerified !== false);
      }
    } catch (e) {}
    setLoading(false);
  };

  const validarTelefone = (tel: string): boolean => {
    if (!tel.trim()) return false;
    // Formato brasileiro: (00) 00000-0000 ou (00) 0000-0000
    const brRegex = /^\(\d{2}\)\s?\d{4,5}-\d{4}$/;
    // Formato internacional: +1 555 1234567 / +55 11 91234-5678
    const intlRegex = /^\+\d{1,3}[\s-]?(\(\d{1,4}\)[\s-]?)?\d[\d\s-]{6,14}$/;
    return brRegex.test(tel.trim()) || intlRegex.test(tel.trim());
  };

  const salvarPerfil = async () => {
    if (!nome.trim()) {
      Alert.alert('Atenção', 'O nome não pode estar vazio');
      return;
    }
    if (tipo === 'motorista' && !validarTelefone(telefone)) {
      Alert.alert('Atenção', 'Informe um telefone válido: (00) 00000-0000 ou +1 555 1234567');
      return;
    }
    setSalvando(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const dados: any = { nome, telefone, whatsapp };
      if (tipo === 'motorista') {
        dados.veiculo = veiculo;
        dados.placa = placa.toUpperCase();
        dados.cor = cor;
      }
      await updateDoc(doc(db, 'usuarios', uid), dados);
      Alert.alert('Salvo! ✅', 'Perfil atualizado com sucesso.');
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível salvar o perfil');
    }
    setSalvando(false);
  };

  const escolherFoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Precisamos acessar suas fotos');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });
      if (!result.canceled && result.assets[0]) {
        const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setFotoUri(base64);
        const uid = auth.currentUser?.uid;
        if (uid) await updateDoc(doc(db, 'usuarios', uid), { fotoUri: base64 });
        Alert.alert('Foto atualizada! ✅');
      }
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível atualizar a foto');
    }
  };

  const fecharModalSenha = () => {
    setModalSenha(false);
    setSenhaAtual(''); setNovaSenha(''); setConfirmarSenha('');
  };

  const fecharModalEmail = () => {
    setModalEmail(false);
    setSenhaAtual(''); setNovoEmail('');
  };

  const alterarSenha = async () => {
    if (!senhaAtual || !novaSenha || !confirmarSenha) {
      Alert.alert('Atenção', 'Preencha todos os campos'); return;
    }
    if (novaSenha.length < 6) {
      Alert.alert('Atenção', 'A nova senha deve ter pelo menos 6 caracteres'); return;
    }
    if (novaSenha !== confirmarSenha) {
      Alert.alert('Atenção', 'A nova senha e a confirmação não coincidem'); return;
    }
    setAlterando(true);
    try {
      const user = auth.currentUser!;
      const cred = EmailAuthProvider.credential(user.email!, senhaAtual);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, novaSenha);
      fecharModalSenha();
      Alert.alert('Sucesso', 'Senha alterada com sucesso!');
    } catch (e: any) {
      if (e.code === 'auth/wrong-password') {
        Alert.alert('Erro', 'Senha atual incorreta');
      } else {
        Alert.alert('Erro', 'Não foi possível alterar a senha');
      }
    }
    setAlterando(false);
  };

  const alterarEmail = async () => {
    if (!senhaAtual || !novoEmail.trim()) {
      Alert.alert('Atenção', 'Preencha todos os campos'); return;
    }
    setAlterando(true);
    try {
      const user = auth.currentUser!;
      const cred = EmailAuthProvider.credential(user.email!, senhaAtual);
      await reauthenticateWithCredential(user, cred);
      await updateEmail(user, novoEmail.trim());
      await sendEmailVerification(user).catch(() => null);
      const uid = user.uid;
      await updateDoc(doc(db, 'usuarios', uid), { email: novoEmail.trim() });
      setEmail(novoEmail.trim());
      fecharModalEmail();
      Alert.alert('Sucesso', 'Email alterado! Verifique sua nova caixa de entrada.');
    } catch (e: any) {
      if (e.code === 'auth/wrong-password') {
        Alert.alert('Erro', 'Senha incorreta');
      } else if (e.code === 'auth/email-already-in-use') {
        Alert.alert('Erro', 'Esse email já está em uso');
      } else {
        Alert.alert('Erro', 'Não foi possível alterar o email');
      }
    }
    setAlterando(false);
  };

  const salvarCodigo = async () => {
    if (novoCodigo.length !== 6) { Alert.alert('Atenção', 'O código deve ter exatamente 6 caracteres'); return; }
    if (novoCodigo === codigo) { setEditandoCodigo(false); return; }
    setSalvandoCodigo(true);
    try {
      const uid = auth.currentUser?.uid;
      const snap = await getDocs(query(collection(db, 'usuarios'), where('codigo', '==', novoCodigo)));
      if (!snap.empty && snap.docs[0].id !== uid) {
        Alert.alert('Código em uso', 'Esse código já pertence a outro usuário. Escolha outro.');
        setSalvandoCodigo(false);
        return;
      }
      await updateDoc(doc(db, 'usuarios', uid!), { codigo: novoCodigo });
      setCodigo(novoCodigo);
      setEditandoCodigo(false);
      Alert.alert('Código atualizado!', `Seu novo código é ${novoCodigo}`);
    } catch (e) { Alert.alert('Erro', 'Não foi possível atualizar o código'); }
    setSalvandoCodigo(false);
  };

  const iniciais = nome.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#4a9eff" size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Modal QR Code */}
      <Modal visible={mostrarQR} transparent animationType="fade" onRequestClose={() => setMostrarQR(false)}>
        <View style={styles.qrOverlay}>
          <View style={styles.qrCard}>
            <TouchableOpacity style={styles.qrFechar} onPress={() => setMostrarQR(false)}>
              <Text style={styles.qrFecharTxt}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.qrTitulo}>Meu QR Code</Text>
            <Image
              source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent('eluus://cadastro?codigo=' + codigo)}&bgcolor=13161e&color=4a9eff&margin=10` }}
              style={styles.qrImage}
            />
            <Text style={styles.qrCodigo}>{codigo}</Text>
            <Text style={styles.qrInfo}>Mostre para que te adicionem sem digitar o código</Text>
          </View>
        </View>
      </Modal>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.voltarBtn}>
          <Text style={styles.voltarTxt}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.titulo}>Meu Perfil</Text>
        <View style={{ width: 80 }} />
      </View>

      {/* Foto */}
      <View style={styles.fotoSection}>
        <TouchableOpacity onPress={escolherFoto} style={styles.fotoContainer}>
          {fotoUri ? (
            <Image source={{ uri: fotoUri }} style={styles.foto} />
          ) : (
            <View style={styles.fotoPlaceholder}>
              <Text style={styles.fotoIniciais}>{iniciais}</Text>
            </View>
          )}
          <View style={styles.fotoEditBtn}>
            <Text style={styles.fotoEditTxt}>📷</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.fotoNome}>{nome}</Text>
        <View style={styles.tipoBadge}>
          <Text style={styles.tipoBadgeTxt}>
            {tipo === 'motorista' ? '🚗 Motorista' : '🧍 Passageiro'}
          </Text>
        </View>
      </View>

      {/* Código */}
      <View style={styles.codigoCard}>
        <Text style={styles.codigoLabel}>Meu código</Text>
        {editandoCodigo ? (
          <View style={styles.codigoEditRow}>
            <TextInput
              style={styles.codigoInput}
              value={novoCodigo}
              onChangeText={t => setNovoCodigo(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              maxLength={6}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
            />
            <TouchableOpacity style={styles.codigoSalvarBtn} onPress={salvarCodigo} disabled={salvandoCodigo}>
              <Text style={styles.codigoSalvarTxt}>{salvandoCodigo ? '...' : 'OK'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setEditandoCodigo(false); setNovoCodigo(codigo); }}>
              <Text style={styles.codigoCancelarTxt}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.codigoValor}>{codigo}</Text>
        )}
        <Text style={styles.codigoInfo}>
          {tipo === 'motorista' ? 'Compartilhe com seus passageiros' : 'Seu código de identificação'}
        </Text>
        <View style={styles.codigoBtnsRow}>
          <TouchableOpacity style={styles.codigoAcaoBtn} onPress={() => { setNovoCodigo(codigo); setEditandoCodigo(true); }}>
            <Text style={styles.codigoAcaoTxt}>✏️ Personalizar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.codigoAcaoBtn} onPress={() => setMostrarQR(true)}>
            <Text style={styles.codigoAcaoTxt}>📱 QR Code</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Dados pessoais */}
      <View style={styles.secao}>
        <Text style={styles.secaoTitulo}>Dados Pessoais</Text>

        <Text style={styles.label}>Nome completo</Text>
        <TextInput style={styles.input} value={nome} onChangeText={setNome} placeholder="Seu nome completo" placeholderTextColor="#4a5568" />

        <Text style={styles.label}>E-mail</Text>
        <View style={styles.inputDisabled}>
          <Text style={styles.inputDisabledTxt}>{email}</Text>
        </View>

        {pais === 'BR' && cpf ? (
          <>
            <Text style={styles.label}>CPF</Text>
            <View style={styles.inputDisabled}>
              <Text style={styles.inputDisabledTxt}>
                {cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
              </Text>
            </View>
          </>
        ) : null}

        {pais !== 'BR' && pais !== '' && (
          <View style={[styles.phoneVerifBadge, phoneVerified ? styles.badgeVerified : styles.badgePending]}>
            <Text style={styles.phoneVerifIcon}>{phoneVerified ? '✅' : '⏳'}</Text>
            <Text style={styles.phoneVerifTxt}>
              {phoneVerified
                ? 'Telefone verificado por SMS'
                : 'Telefone pendente de verificação'}
            </Text>
          </View>
        )}

        <Text style={styles.label}>
          Telefone{tipo === 'motorista' ? ' *' : ''}
        </Text>
        <TextInput
          style={[styles.input, tipo === 'motorista' && !telefone.trim() && styles.inputRequired]}
          value={telefone}
          onChangeText={setTelefone}
          placeholder="(00) 00000-0000"
          placeholderTextColor="#4a5568"
          keyboardType="phone-pad"
        />
        {tipo === 'motorista' && (
          <Text style={styles.phoneWarning}>📞 Número obrigatório para contato dos passageiros</Text>
        )}

        <Text style={styles.label}>WhatsApp (opcional)</Text>
        <TextInput
          style={styles.input}
          value={whatsapp}
          onChangeText={setWhatsapp}
          placeholder="+55 (00) 00000-0000"
          placeholderTextColor="#4a5568"
          keyboardType="phone-pad"
        />
      </View>

      {/* Dados do veículo (só motorista) */}
      {tipo === 'motorista' && (
        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>Dados do Veículo</Text>

          {pais === 'BR' && (
            <>
              <Text style={styles.label}>CNH</Text>
              <View style={styles.inputDisabled}>
                <Text style={styles.inputDisabledTxt}>{cnh || '—'}</Text>
              </View>
            </>
          )}

          <Text style={styles.label}>Modelo do veículo</Text>
          <TextInput style={styles.input} value={veiculo} onChangeText={setVeiculo} placeholder="Ex: HB20, Onix, Polo..." placeholderTextColor="#4a5568" />

          <Text style={styles.label}>Placa</Text>
          <TextInput style={styles.input} value={placa} onChangeText={setPlaca} placeholder="Ex: ABC1234" placeholderTextColor="#4a5568" autoCapitalize="characters" maxLength={7} />

          <Text style={styles.label}>Cor</Text>
          <TextInput style={styles.input} value={cor} onChangeText={setCor} placeholder="Ex: Prata, Branco, Preto..." placeholderTextColor="#4a5568" />
        </View>
      )}

      <TouchableOpacity style={styles.salvarBtn} onPress={salvarPerfil} disabled={salvando}>
        <Text style={styles.salvarTxt}>{salvando ? 'Salvando...' : 'Salvar alterações'}</Text>
      </TouchableOpacity>

      {/* Seletor de idioma */}
      <View style={[styles.secao, { marginTop: 28 }]}>
        <Text style={styles.secaoTitulo}>{t('perfil.language')}</Text>
        <View style={styles.langRow}>
          {LANGUAGES.map(lang => (
            <TouchableOpacity
              key={lang.code}
              style={[styles.langBtn, i18n.language === lang.code && styles.langBtnAtivo]}
              onPress={() => changeLang(lang.code)}
            >
              <Text style={styles.langFlag}>{lang.flag}</Text>
              <Text style={[styles.langTxt, i18n.language === lang.code && styles.langTxtAtivo]}>
                {lang.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Segurança da Conta */}
      <View style={[styles.secao, { marginTop: 4 }]}>
        <Text style={styles.secaoTitulo}>Segurança da Conta</Text>
        <TouchableOpacity style={styles.segBtn} onPress={() => setModalSenha(true)}>
          <Text style={styles.segBtnIcon}>🔑</Text>
          <Text style={styles.segBtnTxt}>Alterar senha</Text>
          <Text style={styles.segBtnArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.segBtn} onPress={() => setModalEmail(true)}>
          <Text style={styles.segBtnIcon}>✉️</Text>
          <Text style={styles.segBtnTxt}>Alterar email</Text>
          <Text style={styles.segBtnArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Modal — Alterar senha */}
      <Modal visible={modalSenha} transparent animationType="slide" onRequestClose={fecharModalSenha}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Alterar senha</Text>

            <Text style={styles.label}>Senha atual</Text>
            <TextInput style={styles.input} value={senhaAtual} onChangeText={setSenhaAtual} secureTextEntry placeholder="••••••" placeholderTextColor="#4a5568" />

            <Text style={styles.label}>Nova senha</Text>
            <TextInput style={styles.input} value={novaSenha} onChangeText={setNovaSenha} secureTextEntry placeholder="Mín. 6 caracteres" placeholderTextColor="#4a5568" />

            <Text style={styles.label}>Confirmar nova senha</Text>
            <TextInput style={styles.input} value={confirmarSenha} onChangeText={setConfirmarSenha} secureTextEntry placeholder="Repita a nova senha" placeholderTextColor="#4a5568" />

            <TouchableOpacity style={styles.modalBtn} onPress={alterarSenha} disabled={alterando}>
              {alterando
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.modalBtnTxt}>Salvar nova senha</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={fecharModalSenha} disabled={alterando}>
              <Text style={styles.modalCancelar}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal — Alterar email */}
      <Modal visible={modalEmail} transparent animationType="slide" onRequestClose={fecharModalEmail}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Alterar email</Text>

            <Text style={styles.label}>Senha atual</Text>
            <TextInput style={styles.input} value={senhaAtual} onChangeText={setSenhaAtual} secureTextEntry placeholder="••••••" placeholderTextColor="#4a5568" />

            <Text style={styles.label}>Novo email</Text>
            <TextInput style={styles.input} value={novoEmail} onChangeText={setNovoEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} placeholder="novo@email.com" placeholderTextColor="#4a5568" />

            <TouchableOpacity style={styles.modalBtn} onPress={alterarEmail} disabled={alterando}>
              {alterando
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.modalBtnTxt}>Salvar novo email</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={fecharModalEmail} disabled={alterando}>
              <Text style={styles.modalCancelar}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={{ height: 40 }} />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: '#0d0f14', alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: '#0d0f14', padding: 24, paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
  voltarBtn: { backgroundColor: '#1a1f2e', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#2a3044' },
  voltarTxt: { color: '#94a3b8', fontSize: 13 },
  titulo: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  fotoSection: { alignItems: 'center', marginBottom: 28, gap: 10 },
  fotoContainer: { position: 'relative' },
  foto: { width: 100, height: 100, borderRadius: 50 },
  fotoPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#4a9eff', alignItems: 'center', justifyContent: 'center' },
  fotoIniciais: { color: '#fff', fontWeight: 'bold', fontSize: 36 },
  fotoEditBtn: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#1a1f2e', borderRadius: 14, width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0d0f14' },
  fotoEditTxt: { fontSize: 14 },
  fotoNome: { color: '#fff', fontWeight: 'bold', fontSize: 20 },
  tipoBadge: { backgroundColor: '#1a1f2e', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#2a3044' },
  tipoBadgeTxt: { color: '#94a3b8', fontSize: 13 },
  codigoCard: { backgroundColor: '#1a1f2e', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: '#4a9eff', gap: 6 },
  codigoLabel: { color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  codigoValor: { color: '#4a9eff', fontWeight: 'bold', fontSize: 28, letterSpacing: 6 },
  codigoInfo: { color: '#64748b', fontSize: 12, textAlign: 'center' },
  secao: { marginBottom: 24 },
  secaoTitulo: { color: '#94a3b8', fontSize: 12, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 16 },
  label: { color: '#64748b', fontSize: 13, marginBottom: 8, marginTop: 4 },
  input: { backgroundColor: '#1a1f2e', borderRadius: 14, padding: 16, color: '#fff', fontSize: 15, marginBottom: 8, borderWidth: 1, borderColor: '#2a3044' },
  inputRequired: { borderColor: '#ef4444' },
  phoneWarning: { color: '#f59e0b', fontSize: 12, marginBottom: 8, marginTop: -4 },
  phoneVerifBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1 },
  badgeVerified: { backgroundColor: '#0f2a1a', borderColor: '#22c55e' },
  badgePending: { backgroundColor: '#1a1200', borderColor: '#f59e0b' },
  phoneVerifIcon: { fontSize: 16 },
  phoneVerifTxt: { color: '#94a3b8', fontSize: 13, flex: 1 },
  inputDisabled: { backgroundColor: '#0d1117', borderRadius: 14, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#1a2030' },
  inputDisabledTxt: { color: '#4a5568', fontSize: 15 },
  salvarBtn: { backgroundColor: '#4a9eff', borderRadius: 16, padding: 18, alignItems: 'center' },
  salvarTxt: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  codigoEditRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  codigoInput: { flex: 1, backgroundColor: '#0d0f14', borderRadius: 10, padding: 10, color: '#4a9eff', fontSize: 22, fontWeight: 'bold', letterSpacing: 6, textAlign: 'center', borderWidth: 1, borderColor: '#4a9eff' },
  codigoSalvarBtn: { backgroundColor: '#4a9eff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  codigoSalvarTxt: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  codigoCancelarTxt: { color: '#64748b', fontSize: 13 },
  codigoBtnsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  codigoAcaoBtn: { flex: 1, backgroundColor: '#0d0f14', borderRadius: 10, paddingVertical: 9, alignItems: 'center', borderWidth: 1, borderColor: '#2a3044' },
  codigoAcaoTxt: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  qrOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  qrCard: { backgroundColor: '#13161e', borderRadius: 28, padding: 28, alignItems: 'center', gap: 14, borderWidth: 1, borderColor: '#4a9eff', width: '100%' },
  qrFechar: { position: 'absolute', top: 16, right: 20 },
  qrFecharTxt: { color: '#64748b', fontSize: 20, fontWeight: 'bold' },
  qrTitulo: { color: '#fff', fontWeight: 'bold', fontSize: 20, marginTop: 8 },
  qrImage: { width: 220, height: 220, borderRadius: 16 },
  qrCodigo: { color: '#4a9eff', fontWeight: 'bold', fontSize: 28, letterSpacing: 8 },
  qrInfo: { color: '#64748b', fontSize: 13, textAlign: 'center' },
  segBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1f2e', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#2a3044', gap: 12 },
  segBtnIcon: { fontSize: 20 },
  segBtnTxt: { flex: 1, color: '#fff', fontSize: 15 },
  segBtnArrow: { color: '#4a5568', fontSize: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#13161e', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, gap: 4, borderTopWidth: 1, borderColor: '#2a3044' },
  modalTitulo: { color: '#fff', fontWeight: 'bold', fontSize: 20, marginBottom: 12 },
  modalBtn: { backgroundColor: '#4a9eff', borderRadius: 14, padding: 18, alignItems: 'center', marginTop: 8, minHeight: 56, justifyContent: 'center' },
  modalBtnTxt: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  modalCancelar: { color: '#64748b', textAlign: 'center', marginTop: 16, fontSize: 15, paddingBottom: 8 },
  langRow: { flexDirection: 'row', gap: 8 },
  langBtn: { flex: 1, backgroundColor: '#1a1f2e', borderRadius: 12, padding: 12, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#2a3044' },
  langBtnAtivo: { borderColor: '#4a9eff', backgroundColor: '#111a2e' },
  langFlag: { fontSize: 24 },
  langTxt: { color: '#64748b', fontSize: 11, fontWeight: '600' },
  langTxtAtivo: { color: '#4a9eff' },
});
