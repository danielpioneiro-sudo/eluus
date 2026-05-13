import { useRouter } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth } from '../firebaseConfig';

export default function RecuperarSenha() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');

  const enviar = async () => {
    if (!email.trim()) {
      setErro('Digite seu e-mail');
      return;
    }
    setErro('');
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setEnviado(true);
    } catch (e: any) {
      if (e.code === 'auth/user-not-found') {
        setErro('Nenhuma conta encontrada com esse email');
      } else if (e.code === 'auth/invalid-email') {
        setErro('Email inválido');
      } else {
        setErro('Não foi possível enviar o email. Tente novamente.');
      }
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#0d0f14' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.titulo}>Recuperar senha</Text>
      <Text style={styles.sub}>
        {enviado
          ? 'Email enviado!'
          : 'Digite seu e-mail e enviaremos um link para redefinir sua senha.'}
      </Text>

      {enviado ? (
        <View style={styles.sucessoBox}>
          <Text style={styles.sucessoEmoji}>✉️</Text>
          <Text style={styles.sucessoTxt}>
            Email enviado! Verifique sua caixa de entrada para redefinir sua senha.
          </Text>
        </View>
      ) : (
        <>
          <TextInput
            style={styles.input}
            placeholder="Seu e-mail"
            placeholderTextColor="#4a5568"
            value={email}
            onChangeText={t => { setEmail(t); setErro(''); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {erro ? <Text style={styles.erro}>{erro}</Text> : null}
          <TouchableOpacity style={styles.btn} onPress={enviar} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btntxt}>Enviar link de recuperação</Text>}
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.link}>← Voltar ao login</Text>
      </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 32,
    paddingTop: 100,
  },
  titulo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  sub: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 40,
    lineHeight: 24,
  },
  input: {
    backgroundColor: '#1a1f2e',
    borderRadius: 14,
    padding: 16,
    color: '#fff',
    fontSize: 15,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2a3044',
  },
  erro: {
    color: '#f87171',
    fontSize: 13,
    marginBottom: 12,
    paddingLeft: 4,
  },
  btn: {
    backgroundColor: '#4a9eff',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
    minHeight: 56,
    justifyContent: 'center',
  },
  btntxt: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  link: {
    color: '#4a9eff',
    textAlign: 'center',
    marginTop: 24,
    fontSize: 15,
  },
  sucessoBox: {
    backgroundColor: '#0f2a1a',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: '#22c55e',
    marginBottom: 24,
  },
  sucessoEmoji: {
    fontSize: 48,
  },
  sucessoTxt: {
    color: '#22c55e',
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
  },
});
