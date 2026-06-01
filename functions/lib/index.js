"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookPayPal = exports.criarPedidoPayPal = exports.verifyAppleReceipt = exports.adicionarCreditosAdmin = exports.webhookMercadoPago = exports.criarPagamentoPix = void 0;
const admin = __importStar(require("firebase-admin"));
const params_1 = require("firebase-functions/params");
const https_1 = require("firebase-functions/v2/https");
const axios_1 = __importDefault(require("axios"));
admin.initializeApp();
const db = admin.firestore();
const mpAccessToken = (0, params_1.defineSecret)('MP_ACCESS_TOKEN');
const paypalClientId = (0, params_1.defineSecret)('PAYPAL_CLIENT_ID');
const paypalClientSecret = (0, params_1.defineSecret)('PAYPAL_CLIENT_SECRET');
const paypalWebhookId = (0, params_1.defineSecret)('PAYPAL_WEBHOOK_ID');
const appleSharedSecret = (0, params_1.defineSecret)('APPLE_SHARED_SECRET');
const PAYPAL_BASE = 'https://api-m.paypal.com';
const PACOTES = {
    '30': { corridas: 30, valor: 29.0 },
    '50': { corridas: 50, valor: 39.0 },
    '100': { corridas: 100, valor: 69.0 },
    '200': { corridas: 200, valor: 119.0 },
};
// Callable: cria pagamento PIX no Mercado Pago e salva pedido pendente
exports.criarPagamentoPix = (0, https_1.onCall)({ secrets: [mpAccessToken] }, async (request) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    console.log('[criarPagamentoPix] Iniciando. uid:', (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid);
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Não autenticado');
    const { pacote } = request.data;
    const uid = request.auth.uid;
    const pacoteInfo = PACOTES[pacote];
    if (!pacoteInfo)
        throw new https_1.HttpsError('invalid-argument', `Pacote inválido: ${pacote}`);
    // Remove espaços, newlines e qualquer caractere não-imprimível
    const token = mpAccessToken.value().replace(/[^\x21-\x7E]/g, '').trim();
    console.log('[criarPagamentoPix] Token length:', token.length, '| prefixo:', token.slice(0, 8), '| sufixo:', token.slice(-6));
    if (!token)
        throw new https_1.HttpsError('internal', 'MP_ACCESS_TOKEN não configurado');
    const userSnap = await db.collection('usuarios').doc(uid).get();
    const user = userSnap.data();
    const nome = (_b = user === null || user === void 0 ? void 0 : user.nome) !== null && _b !== void 0 ? _b : '';
    const partes = nome.split(' ');
    const cpf = ((_c = user === null || user === void 0 ? void 0 : user.cpf) !== null && _c !== void 0 ? _c : '').replace(/\D/g, '') || '12345678909';
    const body = {
        transaction_amount: pacoteInfo.valor,
        description: `eluus - ${pacote} corridas`,
        payment_method_id: 'pix',
        date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        payer: {
            email: (_d = user === null || user === void 0 ? void 0 : user.email) !== null && _d !== void 0 ? _d : 'motorista@eluus.app',
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
        const mpRes = await axios_1.default.post('https://api.mercadopago.com/v1/payments', body, {
            params: { access_token: token },
            headers: {
                'Content-Type': 'application/json',
                'X-Idempotency-Key': `${uid}-${pacote}-${Date.now()}`,
            },
        });
        console.log('[criarPagamentoPix] MP status:', mpRes.status, '| payment id:', (_e = mpRes.data) === null || _e === void 0 ? void 0 : _e.id);
        const txData = (_g = (_f = mpRes.data) === null || _f === void 0 ? void 0 : _f.point_of_interaction) === null || _g === void 0 ? void 0 : _g.transaction_data;
        if (!(txData === null || txData === void 0 ? void 0 : txData.qr_code)) {
            console.error('[criarPagamentoPix] qr_code ausente. point_of_interaction:', JSON.stringify((_h = mpRes.data) === null || _h === void 0 ? void 0 : _h.point_of_interaction));
            throw new https_1.HttpsError('internal', 'Resposta do Mercado Pago não contém qr_code');
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
            qrCode: txData.qr_code,
            qrCodeBase64: (_j = txData.qr_code_base64) !== null && _j !== void 0 ? _j : '',
        };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        if (error.isAxiosError) {
            const axErr = error;
            console.error('[criarPagamentoPix] Axios HTTP status:', (_k = axErr.response) === null || _k === void 0 ? void 0 : _k.status);
            console.error('[criarPagamentoPix] Axios response body:', JSON.stringify((_l = axErr.response) === null || _l === void 0 ? void 0 : _l.data));
            throw new https_1.HttpsError('internal', `MP ${(_m = axErr.response) === null || _m === void 0 ? void 0 : _m.status}: ${JSON.stringify((_o = axErr.response) === null || _o === void 0 ? void 0 : _o.data)}`);
        }
        console.error('[criarPagamentoPix] Erro inesperado:', error === null || error === void 0 ? void 0 : error.message, error);
        throw new https_1.HttpsError('internal', (error === null || error === void 0 ? void 0 : error.message) || String(error));
    }
});
// HTTP: recebe notificação do Mercado Pago e credita corridas
exports.webhookMercadoPago = (0, https_1.onRequest)({ secrets: [mpAccessToken] }, async (req, res) => {
    if (req.method !== 'POST') {
        res.sendStatus(405);
        return;
    }
    const { type, data } = req.body;
    console.log('[webhookMercadoPago] type:', type, '| data.id:', data === null || data === void 0 ? void 0 : data.id);
    if (type !== 'payment' || !(data === null || data === void 0 ? void 0 : data.id)) {
        res.sendStatus(200);
        return;
    }
    const token = mpAccessToken.value().trim();
    if (!token) {
        console.error('[webhookMercadoPago] Token ausente');
        res.sendStatus(500);
        return;
    }
    try {
        const mpRes = await axios_1.default.get(`https://api.mercadopago.com/v1/payments/${data.id}`, { params: { access_token: token } });
        const mp = mpRes.data;
        console.log('[webhookMercadoPago] status:', mp.status, '| id:', mp.id);
        if (mp.status !== 'approved') {
            res.sendStatus(200);
            return;
        }
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
        batch.update(db.collection('usuarios').doc(pedidoData.uid), {
            creditos: admin.firestore.FieldValue.increment(pedidoData.corridas),
        });
        await batch.commit();
        console.log('[webhookMercadoPago] Batch commitado com sucesso');
        res.sendStatus(200);
    }
    catch (e) {
        console.error('[webhookMercadoPago] Erro:', e);
        res.sendStatus(500);
    }
});
// Callable: admin adiciona créditos manualmente com log
exports.adicionarCreditosAdmin = (0, https_1.onCall)(async (request) => {
    var _a;
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Não autenticado');
    const adminSnap = await db.collection('usuarios').doc(request.auth.uid).get();
    if (((_a = adminSnap.data()) === null || _a === void 0 ? void 0 : _a.tipo) !== 'admin')
        throw new https_1.HttpsError('permission-denied', 'Sem permissão');
    const { targetUid, quantidade, motivo } = request.data;
    if (!targetUid || !quantidade || quantidade <= 0)
        throw new https_1.HttpsError('invalid-argument', 'Dados inválidos');
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
exports.verifyAppleReceipt = (0, https_1.onCall)({ secrets: [appleSharedSecret], enforceAppCheck: false }, async (request) => {
    var _a;
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Não autenticado');
    const { receiptData, productId } = request.data;
    if (!receiptData || !productId)
        throw new https_1.HttpsError('invalid-argument', 'Dados inválidos');
    const PRODUTO_CORRIDAS = {
        'com.eluus.corridas30': 30,
        'com.eluus.corridas50': 50,
        'com.eluus.corridas100': 100,
        'com.eluus.corridas200': 200,
    };
    const corridas = PRODUTO_CORRIDAS[productId];
    if (!corridas)
        throw new https_1.HttpsError('invalid-argument', `Produto desconhecido: ${productId}`);
    const secret = appleSharedSecret.value().trim();
    const body = { 'receipt-data': receiptData };
    // Shared secret é obrigatório só para assinaturas; para consumíveis é opcional.
    // Só inclui se for um hex válido (32+ chars) para evitar erros com valores placeholder.
    if (/^[0-9a-f]{32,}$/i.test(secret))
        body.password = secret;
    // Tenta produção primeiro; se retornar 21007 (sandbox receipt), tenta sandbox
    let appleData = null;
    for (const url of [
        'https://buy.itunes.apple.com/verifyReceipt',
        'https://sandbox.itunes.apple.com/verifyReceipt',
    ]) {
        const res = await axios_1.default.post(url, body);
        if (res.data.status === 0) {
            appleData = res.data;
            break;
        }
        if (res.data.status === 21007)
            continue; // receipt de sandbox, tenta próxima URL
    }
    if (!appleData || appleData.status !== 0) {
        throw new https_1.HttpsError('invalid-argument', `Apple receipt inválido. Status: ${appleData === null || appleData === void 0 ? void 0 : appleData.status}`);
    }
    const inApp = ((_a = appleData.receipt) === null || _a === void 0 ? void 0 : _a.in_app) || appleData.latest_receipt_info || [];
    const purchase = inApp.find((p) => p.product_id === productId);
    if (!purchase)
        throw new https_1.HttpsError('invalid-argument', 'Produto não encontrado no receipt');
    const transactionId = purchase.transaction_id;
    const uid = request.auth.uid;
    // Idempotência: evita creditar duas vezes a mesma transação
    const existente = await db.collection('pagamentos')
        .where('transactionId', '==', transactionId)
        .limit(1).get();
    if (!existente.empty)
        return { success: true, alreadyCredited: true };
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
});
// ── PayPal: cria pedido e retorna URL de aprovação ────────────
exports.criarPedidoPayPal = (0, https_1.onCall)({ secrets: [paypalClientId, paypalClientSecret] }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Não autenticado');
    const { pacote } = request.data;
    const pacoteInfo = PACOTES[pacote];
    if (!pacoteInfo)
        throw new https_1.HttpsError('invalid-argument', `Pacote inválido: ${pacote}`);
    const clientId = paypalClientId.value().replace(/[^\x21-\x7E]/g, '').trim();
    const clientSecret = paypalClientSecret.value().replace(/[^\x21-\x7E]/g, '').trim();
    // Obtém token de acesso PayPal
    const tokenRes = await axios_1.default.post(`${PAYPAL_BASE}/v1/oauth2/token`, 'grant_type=client_credentials', {
        auth: { username: clientId, password: clientSecret },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const accessToken = tokenRes.data.access_token;
    // Cria ordem PayPal
    const orderRes = await axios_1.default.post(`${PAYPAL_BASE}/v2/checkout/orders`, {
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
    }, { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } });
    const orderId = orderRes.data.id;
    const approvalLink = orderRes.data.links.find((l) => l.rel === 'approve');
    if (!approvalLink)
        throw new https_1.HttpsError('internal', 'URL de aprovação PayPal não encontrada');
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
});
// ── PayPal Webhook: confirma pagamento e credita corridas ──────
exports.webhookPayPal = (0, https_1.onRequest)({ secrets: [paypalClientId, paypalClientSecret, paypalWebhookId] }, async (req, res) => {
    var _a, _b, _c, _d;
    if (req.method !== 'POST') {
        res.sendStatus(405);
        return;
    }
    try {
        // Verificação de assinatura do webhook PayPal
        const webhookIdValue = paypalWebhookId.value().trim();
        const transmissionId = req.headers['paypal-transmission-id'];
        const transmissionTime = req.headers['paypal-transmission-time'];
        const certUrl = req.headers['paypal-cert-url'];
        const transmissionSig = req.headers['paypal-transmission-sig'];
        if (webhookIdValue && transmissionId) {
            const clientId = paypalClientId.value().replace(/[^\x21-\x7E]/g, '').trim();
            const clientSecret = paypalClientSecret.value().replace(/[^\x21-\x7E]/g, '').trim();
            const tokenRes = await axios_1.default.post(`${PAYPAL_BASE}/v1/oauth2/token`, 'grant_type=client_credentials', { auth: { username: clientId, password: clientSecret }, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
            const verifyRes = await axios_1.default.post(`${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`, {
                auth_algo: req.headers['paypal-auth-algo'],
                cert_url: certUrl,
                transmission_id: transmissionId,
                transmission_sig: transmissionSig,
                transmission_time: transmissionTime,
                webhook_id: webhookIdValue,
                webhook_event: req.body,
            }, { headers: { Authorization: `Bearer ${tokenRes.data.access_token}`, 'Content-Type': 'application/json' } });
            if (verifyRes.data.verification_status !== 'SUCCESS') {
                console.warn('[webhookPayPal] Assinatura inválida');
                res.sendStatus(400);
                return;
            }
        }
        const event = req.body;
        if (event.event_type !== 'PAYMENT.CAPTURE.COMPLETED') {
            res.sendStatus(200);
            return;
        }
        const orderId = ((_c = (_b = (_a = event.resource) === null || _a === void 0 ? void 0 : _a.supplementary_data) === null || _b === void 0 ? void 0 : _b.related_ids) === null || _c === void 0 ? void 0 : _c.order_id)
            || ((_d = event.resource) === null || _d === void 0 ? void 0 : _d.id);
        if (!orderId) {
            res.sendStatus(200);
            return;
        }
        const pedidosSnap = await db.collection('pagamentos')
            .where('orderId', '==', orderId)
            .where('status', '==', 'pendente')
            .limit(1).get();
        if (pedidosSnap.empty) {
            res.sendStatus(200);
            return;
        }
        const pedido = pedidosSnap.docs[0];
        const pedidoData = pedido.data();
        const batch = db.batch();
        batch.update(pedido.ref, { status: 'pago', pagoEm: admin.firestore.FieldValue.serverTimestamp() });
        batch.update(db.collection('usuarios').doc(pedidoData.uid), {
            creditos: admin.firestore.FieldValue.increment(pedidoData.corridas),
        });
        await batch.commit();
        console.log('[webhookPayPal] Creditado:', pedidoData.corridas, 'corridas ao uid:', pedidoData.uid);
        res.sendStatus(200);
    }
    catch (e) {
        console.error('[webhookPayPal] Erro:', e);
        res.sendStatus(500);
    }
});
//# sourceMappingURL=index.js.map