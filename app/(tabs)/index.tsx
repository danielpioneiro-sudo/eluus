import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { auth } from '../../firebaseConfig';
import { navegarDashboard } from '../../utils/navegarDashboard';

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    // One-shot: unsub imediatamente para não interferir com navegação do login
    const unsub = onAuthStateChanged(auth, async (user) => {
      unsub();
      if (user) {
        await navegarDashboard(user.uid, router);
      } else {
        setVerificando(false);
      }
    });
    return unsub;
  }, []);

  if (verificando) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#4a9eff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Image
          source={require('../../assets/images/logo-completa.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.btnPassageiro} onPress={() => router.push('/cadastro')}>
          <View>
            <Text style={styles.btnTitle}>{t('index.passenger')}</Text>
            <Text style={styles.btnSub}>{t('index.passengerSub')}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnMotorista} onPress={() => router.push('/cadastro')}>
          <View>
            <Text style={styles.btnTitle}>{t('index.driver')}</Text>
            <Text style={styles.btnSub}>{t('index.driverSub')}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/login')}>
          <Text style={styles.loginBtnTxt}>{t('index.login')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footerWrap}>
        <TouchableOpacity onPress={() => router.push('/termos')}>
          <Text style={styles.footer}>
            {t('index.terms')}{' '}
            <Text style={styles.footerLink}>{t('index.termsLink')}</Text>
          </Text>
        </TouchableOpacity>
        <View style={styles.footerLinks}>
          <TouchableOpacity onPress={() => router.push('/privacidade')}>
            <Text style={styles.footerLinkSm}>{t('index.privacy')}</Text>
          </TouchableOpacity>
          <Text style={styles.footerSep}> · </Text>
          <TouchableOpacity onPress={() => router.push('/consentimento-localizacao')}>
            <Text style={styles.footerLinkSm}>{t('index.location')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0f14',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 32,
    paddingTop: 60,
    paddingBottom: 48,
  },
  header: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  logo: {
    width: 260,
    height: 190,
  },
  loading: {
    flex: 1,
    backgroundColor: '#0d0f14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttons: {
    width: '100%',
    gap: 10,
    marginBottom: 24,
  },
  btnPassageiro: {
    backgroundColor: '#1a1f2e',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#4a9eff',
  },
  btnMotorista: {
    backgroundColor: '#1a1f2e',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  btnIcon: {
    fontSize: 26,
  },
  btnTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  btnSub: {
    fontSize: 12,
    color: '#64748b',
  },
  link: {
    color: '#4a9eff',
    textAlign: 'center',
    fontSize: 15,
    marginTop: 4,
  },
  loginBtn: {
    borderWidth: 1,
    borderColor: '#4a9eff',
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  loginBtnTxt: {
    color: '#4a9eff',
    fontSize: 15,
    fontWeight: '600',
  },
  footerWrap: {
    alignItems: 'center',
    gap: 8,
  },
  footer: {
    fontSize: 12,
    color: '#334155',
    textAlign: 'center',
  },
  footerLink: {
    color: '#4a9eff',
    textDecorationLine: 'underline',
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerLinkSm: {
    fontSize: 11,
    color: '#4a9eff',
    textDecorationLine: 'underline',
  },
  footerSep: {
    fontSize: 11,
    color: '#334155',
  },
});