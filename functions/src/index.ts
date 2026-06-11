import * as admin from 'firebase-admin';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import axios, { AxiosError } from 'axios';

admin.initializeApp();
const db = admin.firestore();

const mpAccessToken = defineSecret('MP_ACCESS_TOKEN');
const paypalClientId = defineSecret('PAYPAL_CLIENT_ID');
const paypalClientSecret = defineSecret('PAYPAL_CLIENT_SECRET');
const paypalWebhookId = defineSecret('PAYPAL_WEBHOOK_ID');
const appleSharedSecret = defineSecret('APPLE_SHARED_SECRET');

const PAYPAL_BASE = 'https://api-m.paypal.com';

const PACOTES: Record<string, { corridas: number; valor: number }> = {
  '30':  { corridas: 30,  valor: 29.0  },
  '50':  { corridas: 50,  valor: 39.0  },
  '100': { corridas: 100, valor: 69.0  },
  '200': { corridas: 200, valor: 119.0 },
};

// Callable: cria pagamento PIX no Mercado Pago e salva pedido pendente
export const criarPagamentoPix = onCall(
  { secrets: [mpAccessToken] },
  async (request) => {
    console.log('[criarPagamentoPix] Iniciando. uid:', request.auth?.uid);

    if (!request.auth) throw new HttpsError('unauthenticated', 'Não autenticado');

    const { pacote } = request.data as { pacote: string };
    const uid = request.auth.uid;
    const pacoteInfo = PACOTES[pacote];
    if (!pacoteInfo) throw new HttpsError('invalid-argument', `Pacote inválido: ${pacote}`);

    // Remove espaços, newlines e qualquer caractere não-imprimível
    const token = mpAccessToken.value().replace(/[^\x21-\x7E]/g, '').trim();
    console.log('[criarPagamentoPix] Token length:', token.length, '| prefixo:', token.slice(0, 8), '| sufixo:', token.slice(-6));
    if (!token) throw new HttpsError('internal', 'MP_ACCESS_TOKEN não configurado');

    const userSnap = await db.collection('usuarios').doc(uid).get();
    const user = userSnap.data();
    const nome = (user?.nome as string | undefined) ?? '';
    const partes = nome.split(' ');

    const cpf = ((user?.cpf as string | undefined) ?? '').replace(/\D/g, '') || '12345678909';
    const body = {
      transaction_amount: pacoteInfo.valor,
      description: `eluus - ${pacote} corridas`,
      payment_method_id: 'pix',
      date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      payer: {
        email: (user?.email as string | undefined) ?? 'motorista@eluus.app',
        first_name: partes[0] || 'Motorista',
        last_name: partes.slice(1).join(' ') || 'Usuario',
        identification: {
          type: 'CPF',
          number: cpf,
        },
      },
    };
    console.log('[criarPagamentoPix] CPF usado:', cpf, '| token prefixo:', token.slice(0, 8));
    console.log('[criarPagamentoPix] Body:', JSON.stringify(body));

    try {
      const mpRes = await axios.post(
        'https://api.mercadopago.com/v1/payments',
        body,
        {
          params: { access_token: token },
          headers: {
            'Content-Type': 'application/json',
            'X-Idempotency-Key': `${uid}-${pacote}-${Date.now()}`,
          },
        }
      );

      console.log('[criarPagamentoPix] MP status:', mpRes.status, '| payment id:', mpRes.data?.id);

      const txData = mpRes.data?.point_of_interaction?.transaction_data;
      if (!txData?.qr_code) {
        console.error('[criarPagamentoPix] qr_code ausente. point_of_interaction:', JSON.stringify(mpRes.data?.point_of_interaction));
        throw new HttpsError('internal', 'Resposta do Mercado Pago não contém qr_code');
      }

      const pedidoRef = await db.collection('pagamentos').add({
        uid,
        pacote,
        corridas: pacoteInfo.corridas,
        valor: pacoteInfo.valor,
        status: 'pendente',
        pagamentoId: String(mpRes.data.id),
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log('[criarPagamentoPix] Pedido salvo:', pedidoRef.id);

      return {
        pedidoId: pedidoRef.id,
        qrCode:       txData.qr_code,
        qrCodeBase64: txData.qr_code_base64 ?? '',
      };

    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      if ((error as AxiosError).isAxiosError) {
        const axErr = error as AxiosError<any>;
        console.error('[criarPagamentoPix] Axios HTTP status:', axErr.response?.status);
        console.error('[criarPagamentoPix] Axios response body:', JSON.stringify(axErr.response?.data));
        throw new HttpsError(
          'internal',
          `MP ${axErr.response?.status}: ${JSON.stringify(axErr.response?.data)}`
        );
      }
      console.error('[criarPagamentoPix] Erro inesperado:', error?.message, error);
      throw new HttpsError('internal', error?.message || String(error));
    }
  }
);

// HTTP: recebe notificação do Mercado Pago e credita corridas
export const webhookMercadoPago = onRequest(
  { secrets: [mpAccessToken] },
  async (req, res) => {
    if (req.method !== 'POST') { res.sendStatus(405); return; }

    const { type, data } = req.body as { type: string; data?: { id?: string } };
    console.log('[webhookMercadoPago] type:', type, '| data.id:', data?.id);
    if (type !== 'payment' || !data?.id) { res.sendStatus(200); return; }

    const token = mpAccessToken.value().trim();
    if (!token) { console.error('[webhookMercadoPago] Token ausente'); res.sendStatus(500); return; }

    try {
      const mpRes = await axios.get(
        `https://api.mercadopago.com/v1/payments/${data.id}`,
        { params: { access_token: token } }
      );
      const mp = mpRes.data;
      console.log('[webhookMercadoPago] status:', mp.status, '| id:', mp.id);

      if (mp.status !== 'approved') { res.sendStatus(200); return; }

      const pedidosSnap = await db.collection('pagamentos')
        .where('pagamentoId', '==', String(mp.id))
        .where('status', '==', 'pendente')
        .limit(1)
        .get();

      if (pedidosSnap.empty) {
        console.log('[webhookMercadoPago] Pedido não encontrado ou já processado');
        res.sendStatus(200);
        return;
      }

      const pedido = pedidosSnap.docs[0];
      const pedidoData = pedido.data();
      console.log('[webhookMercadoPago] Creditando', pedidoData.corridas, 'corridas ao uid:', pedidoData.uid);

      const batch = db.batch();
      batch.update(pedido.ref, { status: 'pago', pagoEm: admin.firestore.FieldValue.serverTimestamp() });
      batch.update(db.collection('usuarios').doc(pedidoData.uid as string), {
        creditos: admin.firestore.FieldValue.increment(pedidoData.corridas as number),
      });
      await batch.commit();
      console.log('[webhookMercadoPago] Batch commitado com sucesso');

      res.sendStatus(200);
    } catch (e) {
      console.error('[webhookMercadoPago] Erro:', e);
      res.sendStatus(500);
    }
  }
);

// Callable: admin adiciona créditos manualmente com log
export const adicionarCreditosAdmin = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Não autenticado');

  const adminSnap = await db.collection('usuarios').doc(request.auth.uid).get();
  if (adminSnap.data()?.tipo !== 'admin') throw new HttpsError('permission-denied', 'Sem permissão');

  const { targetUid, quantidade, motivo } = request.data as {
    targetUid: string;
    quantidade: number;
    motivo?: string;
  };
  if (!targetUid || !quantidade || quantidade <= 0) throw new HttpsError('invalid-argument', 'Dados inválidos');

  const batch = db.batch();
  batch.update(db.collection('usuarios').doc(targetUid), {
    creditos: admin.firestore.FieldValue.increment(quantidade),
  });
  batch.set(db.collection('adminLogs').doc(), {
    adminId: request.auth.uid,
    targetUid,
    quantidade,
    motivo: motivo || '',
    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
  });
  await batch.commit();

  return { success: true };
});

// ── Apple In-App Purchase: verifica receipt e credita corridas ──
export const verifyAppleReceipt = onCall(
  { secrets: [appleSharedSecret], enforceAppCheck: false },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Não autenticado');
    const { receiptData, productId } = request.data as { receiptData: string; productId: string };
    if (!receiptData || !productId) throw new HttpsError('invalid-argument', 'Dados inválidos');

    const PRODUTO_CORRIDAS: Record<string, number> = {
      'com.eluus.corridas30': 30,
      'com.eluus.corridas50': 50,
      'com.eluus.corridas100': 100,
      'com.eluus.corridas200': 200,
    };
    const corridas = PRODUTO_CORRIDAS[productId];
    if (!corridas) throw new HttpsError('invalid-argument', `Produto desconhecido: ${productId}`);

    const secret = appleSharedSecret.value().trim();
    const body: Record<string, string> = { 'receipt-data': receiptData };
    // Shared secret é obrigatório só para assinaturas; para consumíveis é opcional.
    // Só inclui se for um hex válido (32+ chars) para evitar erros com valores placeholder.
    if (/^[0-9a-f]{32,}$/i.test(secret)) body.password = secret;

    // Tenta produção primeiro; se retornar 21007 (sandbox receipt), tenta sandbox
    let appleData: any = null;
    for (const url of [
      'https://buy.itunes.apple.com/verifyReceipt',
      'https://sandbox.itunes.apple.com/verifyReceipt',
    ]) {
      const res = await axios.post(url, body);
      if (res.data.status === 0) { appleData = res.data; break; }
      if (res.data.status === 21007) continue; // receipt de sandbox, tenta próxima URL
    }
    if (!appleData || appleData.status !== 0) {
      throw new HttpsError('invalid-argument', `Apple receipt inválido. Status: ${appleData?.status}`);
    }

    const inApp: any[] = appleData.receipt?.in_app || appleData.latest_receipt_info || [];
    const purchase = inApp.find((p: any) => p.product_id === productId);
    if (!purchase) throw new HttpsError('invalid-argument', 'Produto não encontrado no receipt');

    const transactionId = purchase.transaction_id;
    const uid = request.auth.uid;

    // Idempotência: evita creditar duas vezes a mesma transação
    const existente = await db.collection('pagamentos')
      .where('transactionId', '==', transactionId)
      .limit(1).get();
    if (!existente.empty) return { success: true, alreadyCredited: true };

    const batch = db.batch();
    const pedidoRef = db.collection('pagamentos').doc();
    batch.set(pedidoRef, {
      uid, productId, corridas, transactionId,
      metodo: 'apple_iap',
      status: 'pago',
      pagoEm: admin.firestore.FieldValue.serverTimestamp(),
    });
    batch.update(db.collection('usuarios').doc(uid), {
      creditos: admin.firestore.FieldValue.increment(corridas),
    });
    await batch.commit();

    return { success: true, corridas };
  }
);

// ── PayPal: cria pedido e retorna URL de aprovação ────────────
export const criarPedidoPayPal = onCall(
  { secrets: [paypalClientId, paypalClientSecret] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Não autenticado');
    const { pacote } = request.data as { pacote: string };
    const pacoteInfo = PACOTES[pacote];
    if (!pacoteInfo) throw new HttpsError('invalid-argument', `Pacote inválido: ${pacote}`);

    const clientId = paypalClientId.value().replace(/[^\x21-\x7E]/g, '').trim();
    const clientSecret = paypalClientSecret.value().replace(/[^\x21-\x7E]/g, '').trim();

    // Obtém token de acesso PayPal
    const tokenRes = await axios.post(
      `${PAYPAL_BASE}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        auth: { username: clientId, password: clientSecret },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );
    const accessToken = tokenRes.data.access_token;

    // Cria ordem PayPal
    const orderRes = await axios.post(
      `${PAYPAL_BASE}/v2/checkout/orders`,
      {
        intent: 'CAPTURE',
        purchase_units: [{
          amount: { currency_code: 'BRL', value: pacoteInfo.valor.toFixed(2) },
          description: `eluus - ${pacote} corridas`,
          custom_id: `${request.auth.uid}_${pacote}`,
        }],
        application_context: {
          return_url: 'eluus://payment/success',
          cancel_url: 'eluus://payment/cancel',
          brand_name: 'Eluus',
          landing_page: 'BILLING',
          user_action: 'PAY_NOW',
        },
      },
      { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
    );

    const orderId = orderRes.data.id;
    const approvalLink = orderRes.data.links.find((l: any) => l.rel === 'approve');
    if (!approvalLink) throw new HttpsError('internal', 'URL de aprovação PayPal não encontrada');

    // Salva pedido pendente
    const pedidoRef = await db.collection('pagamentos').add({
      uid: request.auth.uid,
      pacote,
      corridas: pacoteInfo.corridas,
      valor: pacoteInfo.valor,
      orderId,
      metodo: 'paypal',
      status: 'pendente',
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { pedidoId: pedidoRef.id, approvalUrl: approvalLink.href, orderId };
  }
);

// ── PayPal: captura ordem após aprovação do usuário ───────────
export const capturarPedidoPayPal = onCall(
  { secrets: [paypalClientId, paypalClientSecret] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Não autenticado');
    const { orderId } = request.data as { orderId: string };
    if (!orderId) throw new HttpsError('invalid-argument', 'orderId ausente');

    const clientId = paypalClientId.value().replace(/[^\x21-\x7E]/g, '').trim();
    const clientSecret = paypalClientSecret.value().replace(/[^\x21-\x7E]/g, '').trim();

    try {
      const tokenRes = await axios.post(
        `${PAYPAL_BASE}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          auth: { username: clientId, password: clientSecret },
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );
      const accessToken = tokenRes.data.access_token;

      const captureRes = await axios.post(
        `${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`,
        {},
        { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
      );

      if (captureRes.data.status !== 'COMPLETED') {
        throw new HttpsError('internal', `Captura não completada: ${captureRes.data.status}`);
      }

      const pedidosSnap = await db.collection('pagamentos')
        .where('orderId', '==', orderId)
        .where('status', '==', 'pendente')
        .limit(1)
        .get();

      if (pedidosSnap.empty) return { success: true, alreadyProcessed: true };

      const pedido = pedidosSnap.docs[0];
      const pedidoData = pedido.data();

      const batch = db.batch();
      batch.update(pedido.ref, { status: 'pago', pagoEm: admin.firestore.FieldValue.serverTimestamp() });
      batch.update(db.collection('usuarios').doc(pedidoData.uid as string), {
        creditos: admin.firestore.FieldValue.increment(pedidoData.corridas as number),
      });
      await batch.commit();

      console.log('[capturarPedidoPayPal] Creditado:', pedidoData.corridas, 'corridas ao uid:', pedidoData.uid);
      return { success: true };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      if ((error as AxiosError).isAxiosError) {
        const axErr = error as AxiosError<any>;
        throw new HttpsError('internal', `PayPal ${axErr.response?.status}: ${JSON.stringify(axErr.response?.data)}`);
      }
      throw new HttpsError('internal', error?.message || String(error));
    }
  }
);

// ── PayPal Webhook: confirma pagamento e credita corridas ──────
export const webhookPayPal = onRequest(
  { secrets: [paypalClientId, paypalClientSecret, paypalWebhookId] },
  async (req, res) => {
    if (req.method !== 'POST') { res.sendStatus(405); return; }

    try {
      // Verificação de assinatura do webhook PayPal
      const webhookIdValue = paypalWebhookId.value().trim();
      const transmissionId = req.headers['paypal-transmission-id'] as string;
      const transmissionTime = req.headers['paypal-transmission-time'] as string;
      const certUrl = req.headers['paypal-cert-url'] as string;
      const transmissionSig = req.headers['paypal-transmission-sig'] as string;

      if (webhookIdValue && transmissionId) {
        const clientId = paypalClientId.value().replace(/[^\x21-\x7E]/g, '').trim();
        const clientSecret = paypalClientSecret.value().replace(/[^\x21-\x7E]/g, '').trim();
        const tokenRes = await axios.post(
          `${PAYPAL_BASE}/v1/oauth2/token`,
          'grant_type=client_credentials',
          { auth: { username: clientId, password: clientSecret }, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        const verifyRes = await axios.post(
          `${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`,
          {
            auth_algo: req.headers['paypal-auth-algo'],
            cert_url: certUrl,
            transmission_id: transmissionId,
            transmission_sig: transmissionSig,
            transmission_time: transmissionTime,
            webhook_id: webhookIdValue,
            webhook_event: req.body,
          },
          { headers: { Authorization: `Bearer ${tokenRes.data.access_token}`, 'Content-Type': 'application/json' } }
        );
        if (verifyRes.data.verification_status !== 'SUCCESS') {
          console.warn('[webhookPayPal] Assinatura inválida');
          res.sendStatus(400);
          return;
        }
      }

      const event = req.body;
      if (event.event_type !== 'PAYMENT.CAPTURE.COMPLETED') { res.sendStatus(200); return; }

      const orderId = event.resource?.supplementary_data?.related_ids?.order_id
        || event.resource?.id;
      if (!orderId) { res.sendStatus(200); return; }

      const pedidosSnap = await db.collection('pagamentos')
        .where('orderId', '==', orderId)
        .where('status', '==', 'pendente')
        .limit(1).get();

      if (pedidosSnap.empty) { res.sendStatus(200); return; }

      const pedido = pedidosSnap.docs[0];
      const pedidoData = pedido.data();

      const batch = db.batch();
      batch.update(pedido.ref, { status: 'pago', pagoEm: admin.firestore.FieldValue.serverTimestamp() });
      batch.update(db.collection('usuarios').doc(pedidoData.uid as string), {
        creditos: admin.firestore.FieldValue.increment(pedidoData.corridas as number),
      });
      await batch.commit();
      console.log('[webhookPayPal] Creditado:', pedidoData.corridas, 'corridas ao uid:', pedidoData.uid);

      res.sendStatus(200);
    } catch (e) {
      console.error('[webhookPayPal] Erro:', e);
      res.sendStatus(500);
    }
  }
);

// ── Trigger: ban automático após 2 denúncias únicas de motoristas ─────────
export const verificarBanPassageiro = onDocumentCreated(
  'denuncias/{denunciaId}',
  async (event) => {
    const denuncia = event.data?.data();
    if (!denuncia) return;

    if (denuncia.tipo !== 'passageiro' || !denuncia.denunciadoId) return;

    const passageiroId = denuncia.denunciadoId as string;

    const passageiroSnap = await db.collection('usuarios').doc(passageiroId).get();
    if (!passageiroSnap.exists || passageiroSnap.data()?.bloqueado) return;

    const denunciasSnap = await db.collection('denuncias')
      .where('denunciadoId', '==', passageiroId)
      .where('tipo', '==', 'passageiro')
      .get();

    const denunciantesUnicos = new Set(denunciasSnap.docs.map(d => d.data().denuncianteId as string));
    if (denunciantesUnicos.size < 2) return;

    await db.collection('usuarios').doc(passageiroId).update({ bloqueado: true });
    console.log('[verificarBanPassageiro] Passageiro banido:', passageiroId);

    const expoPushToken = passageiroSnap.data()?.expoPushToken as string | undefined;
    if (expoPushToken) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: expoPushToken,
          title: 'Conta suspensa',
          body: 'Sua conta foi suspensa por denúncias. Entre em contato com suporte@eluus.app',
          sound: 'default',
        }),
      }).catch(e => console.error('[verificarBanPassageiro] Push erro:', e));
    }
  }
);

// ── Callable: admin exclui usuário (Firestore + Auth) ──────────────────────
export const adminExcluirUsuario = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Não autenticado');

  const adminSnap = await db.collection('usuarios').doc(request.auth.uid).get();
  if (adminSnap.data()?.tipo !== 'admin') throw new HttpsError('permission-denied', 'Sem permissão');

  const { targetUid } = request.data as { targetUid: string };
  if (!targetUid) throw new HttpsError('invalid-argument', 'targetUid ausente');

  await db.collection('usuarios').doc(targetUid).delete();
  await admin.auth().deleteUser(targetUid);

  return { success: true };
});
