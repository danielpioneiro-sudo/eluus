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
          <Text style={styles.btnIcon}>🧍</Text>
          <Text style={styles.btnTitle}>{t('index.passenger')}</Text>
          <Text style={styles.btnSub}>{t('index.passengerSub')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnMotorista} onPress={() => router.push('/cadastro')}>
          <Text style={styles.btnIcon}>🚗</Text>
          <Text style={styles.btnTitle}>{t('index.driver')}</Text>
          <Text style={styles.btnSub}>{t('index.driverSub')}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/login')}>
          <Text style={styles.link}>{t('index.login')}</Text>
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
    paddingTop: 100,
    paddingBottom: 48,
  },
  header: {
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 220,
    height: 160,
  },
  loading: {
    flex: 1,
    backgroundColor: '#0d0f14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttons: {
    width: '100%',
    gap: 16,
  },
  btnPassageiro: {
    backgroundColor: '#1a1f2e',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#4a9eff',
  },
  btnMotorista: {
    backgroundColor: '#1a1f2e',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  btnIcon: {
    fontSize: 40,
  },
  btnTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  btnSub: {
    fontSize: 13,
    color: '#64748b',
  },
  link: {
    color: '#4a9eff',
    textAlign: 'center',
    fontSize: 15,
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