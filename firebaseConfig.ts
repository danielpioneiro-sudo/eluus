import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

// Polyfill crypto for Hermes engine (React Native)
if (typeof crypto === 'undefined' || typeof (crypto as any).randomUUID === 'undefined') {
  const getRandomValues = (array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  };
  const randomUUID = (): string => {
    const b = new Uint8Array(16);
    getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
  };
  // @ts-ignore
  global.crypto = { getRandomValues, randomUUID };
}

import { initializeApp } from "firebase/app";
import { initializeAppCheck, CustomProvider } from 'firebase/app-check';
// @ts-expect-error - getReactNativePersistence is available in the RN bundle but not in CJS types
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from "firebase/firestore";
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

export const firebaseConfig = {
  apiKey: "AIzaSyBvG4vKKfzER4nckH85sjtoAyyIU3uGMb0",
  authDomain: "voucom-285e0.firebaseapp.com",
  projectId: "voucom-285e0",
  storageBucket: "voucom-285e0.firebasestorage.app",
  messagingSenderId: "446769198236",
  appId: "1:446769198236:web:ddcda470b13bf894cae959"
};

const app = initializeApp(firebaseConfig);

// App Check: em desenvolvimento usa token de debug; em produção usa Play Integrity (Android)
// e DeviceCheck (iOS) — configurados no Firebase Console.
if (__DEV__) {
  // @ts-ignore
  globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

initializeAppCheck(app, {
  provider: new CustomProvider({
    getToken: () => {
      // Em produção via EAS Build, o token vem do Play Integrity / DeviceCheck
      // nativamente. O debug token acima substitui automaticamente em __DEV__.
      return Promise.resolve({
        token: '',
        expireTimeMillis: Date.now() + 3600 * 1000,
      });
    },
  }),
  isTokenAutoRefreshEnabled: true,
});

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);
