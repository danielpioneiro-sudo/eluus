import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import es from './locales/es.json';
import ptBR from './locales/pt-BR.json';

const I18N_LANG_KEY = '@eluus_lang';

const getInitialLang = async (): Promise<string> => {
  try {
    const stored = await AsyncStorage.getItem(I18N_LANG_KEY);
    if (stored) return stored;
  } catch { /* ignore */ }
  const deviceLng = Localization.getLocales()[0]?.languageCode ?? 'pt';
  if (deviceLng === 'es') return 'es';
  if (deviceLng.startsWith('en')) return 'en';
  return 'pt';
};

export const changeLang = async (lang: string) => {
  try { await AsyncStorage.setItem(I18N_LANG_KEY, lang); } catch { /* ignore */ }
  await i18n.changeLanguage(lang);
};

export const LANGUAGES = [
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
];

let initialized = false;

export const initI18n = async () => {
  if (initialized) return;
  initialized = true;
  const lng = await getInitialLang();
  await i18n.use(initReactI18next).init({
    lng,
    fallbackLng: 'pt',
    compatibilityJSON: 'v4' as any,
    resources: {
      pt: { translation: ptBR },
      en: { translation: en },
      es: { translation: es },
    },
    interpolation: { escapeValue: false },
  });
};

export const formatCurrency = (value: number): string => {
  const lng = i18n.language;
  if (lng === 'en') return `US$ ${value.toFixed(2)}`;
  if (lng === 'es') return `$ ${value.toFixed(2)}`;
  return `R$ ${value.toFixed(2)}`;
};

export default i18n;
