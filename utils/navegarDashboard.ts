import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

type Router = { replace: (href: any) => void };

export async function navegarDashboard(uid: string, router: Router): Promise<void> {
  try {
    console.log('[navegarDashboard] consultando tipo do usuário:', uid);
    const userDoc = await getDoc(doc(db, 'usuarios', uid));
    if (!userDoc.exists()) {
      console.warn('[navegarDashboard] documento não encontrado, redirecionando para /');
      router.replace('/');
      return;
    }
    const data = userDoc.data();
    if (data.pais && data.pais !== 'BR' && !data.phoneVerified) {
      router.replace({ pathname: '/verificar-telefone', params: { telefone: data.telefone || '' } });
      return;
    }
    if (data.tipo === 'motorista') {
      console.log('[navegarDashboard] → /motorista');
      router.replace('/motorista');
    } else {
      console.log('[navegarDashboard] → /passageiro');
      router.replace('/passageiro');
    }
  } catch (e) {
    console.error('[navegarDashboard] erro:', e);
    router.replace('/');
  }
}
