import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PaymentGatewaySession, PaymentMethod } from './src/types/dealkoro.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;
const IS_DEV =
  process.argv.includes('--dev') ||
  process.env.NODE_ENV === 'development' ||
  !fs.existsSync(path.join(__dirname, 'dist', 'index.html'));

const MAX_BODY_BYTES = 64 * 1024;
const SESSION_TTL_MS = 15 * 60 * 1000;
const sessionStore = new Map<string, PaymentGatewaySession>();

interface GatewayEnvConfig {
  bkashLive: boolean;
  nagadLive: boolean;
}

function getGatewayEnvConfig(): GatewayEnvConfig {
  const bkashLive = Boolean(
    process.env.BKASH_APP_KEY &&
      process.env.BKASH_APP_SECRET &&
      process.env.BKASH_USERNAME &&
      process.env.BKASH_PASSWORD
  );
  const nagadLive = Boolean(
    process.env.NAGAD_MERCHANT_ID &&
      process.env.NAGAD_PUBLIC_KEY &&
      process.env.NAGAD_PRIVATE_KEY
  );
  return { bkashLive, nagadLive };
}

function sanitizeIdLocal(raw: string): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
  return cleaned || `id_${Date.now().toString(36)}`;
}

function normalizeBdMobileLocal(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.startsWith('8801') && digits.length === 13) {
    return digits.slice(2);
  }
  return digits;
}

function maskBdPhoneLocal(raw: string): string {
  const normalized = normalizeBdMobileLocal(raw);
  if (normalized.length < 7) return '017**-******';
  return `${normalized.slice(0, 3)}****${normalized.slice(-4)}`;
}

function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error('Request payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw) as Record<string, unknown>);
      } catch {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

async function createBkashLiveSession(params: {
  dealId: string;
  amount: number;
  callbackUrl: string;
}): Promise<{ paymentID: string; bkashURL: string }> {
  const baseUrl = (
    process.env.BKASH_BASE_URL ||
    'https://tokenized.sandbox.bka.sh/v1.2.0-beta'
  ).replace(/\/+$/, '');

  const grantRes = await fetch(`${baseUrl}/tokenized/checkout/token/grant`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      username: process.env.BKASH_USERNAME || '',
      password: process.env.BKASH_PASSWORD || '',
    },
    body: JSON.stringify({
      app_key: process.env.BKASH_APP_KEY || '',
      app_secret: process.env.BKASH_APP_SECRET || '',
    }),
  });
  const grantData = (await grantRes.json()) as {
    id_token?: string;
    statusMessage?: string;
  };
  if (!grantRes.ok || !grantData.id_token) {
    throw new Error(grantData.statusMessage || 'bKash token grant failed');
  }

  const createRes = await fetch(`${baseUrl}/tokenized/checkout/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: grantData.id_token,
      'X-App-Key': process.env.BKASH_APP_KEY || '',
    },
    body: JSON.stringify({
      mode: '0011',
      payerReference: params.dealId,
      callbackURL: params.callbackUrl,
      amount: String(Math.round(params.amount)),
      currency: 'BDT',
      intent: 'sale',
      merchantInvoiceNumber: `DK-${params.dealId.slice(-12)}-${Date.now().toString(36)}`,
    }),
  });
  const createData = (await createRes.json()) as {
    paymentID?: string;
    bkashURL?: string;
    statusMessage?: string;
  };
  if (!createRes.ok || !createData.paymentID || !createData.bkashURL) {
    throw new Error(createData.statusMessage || 'bKash checkout create failed');
  }
  return { paymentID: createData.paymentID, bkashURL: createData.bkashURL };
}

async function executeBkashLivePayment(paymentID: string): Promise<{
  trxID: string;
  customerMsisdn?: string;
}> {
  const baseUrl = (
    process.env.BKASH_BASE_URL ||
    'https://tokenized.sandbox.bka.sh/v1.2.0-beta'
  ).replace(/\/+$/, '');

  const grantRes = await fetch(`${baseUrl}/tokenized/checkout/token/grant`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      username: process.env.BKASH_USERNAME || '',
      password: process.env.BKASH_PASSWORD || '',
    },
    body: JSON.stringify({
      app_key: process.env.BKASH_APP_KEY || '',
      app_secret: process.env.BKASH_APP_SECRET || '',
    }),
  });
  const grantData = (await grantRes.json()) as { id_token?: string; statusMessage?: string };
  if (!grantRes.ok || !grantData.id_token) {
    throw new Error(grantData.statusMessage || 'bKash token grant failed');
  }

  const execRes = await fetch(`${baseUrl}/tokenized/checkout/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: grantData.id_token,
      'X-App-Key': process.env.BKASH_APP_KEY || '',
    },
    body: JSON.stringify({ paymentID }),
  });
  const execData = (await execRes.json()) as {
    trxID?: string;
    transactionStatus?: string;
    customerMsisdn?: string;
    statusMessage?: string;
  };
  if (!execRes.ok || execData.transactionStatus !== 'Completed' || !execData.trxID) {
    throw new Error(execData.statusMessage || 'bKash payment execution not completed');
  }
  return { trxID: execData.trxID, customerMsisdn: execData.customerMsisdn };
}

function formatPem(rawKey: string, label: 'PUBLIC KEY' | 'RSA PRIVATE KEY' | 'PRIVATE KEY'): string {
  const normalized = rawKey.replace(/\\n/g, '\n').trim();
  if (normalized.includes('-----BEGIN')) return normalized;
  return `-----BEGIN ${label}-----\n${normalized}\n-----END ${label}-----`;
}

async function createNagadLiveSession(params: {
  dealId: string;
  amount: number;
  callbackUrl: string;
  clientIp: string;
}): Promise<{ paymentRefId: string; redirectUrl: string }> {
  const baseUrl = (
    process.env.NAGAD_BASE_URL ||
    'http://sandbox.mynagad.com:10080/remote-payment-gateway-1.0/api/dfs'
  ).replace(/\/+$/, '');
  const merchantId = process.env.NAGAD_MERCHANT_ID || '';
  const publicKey = formatPem(process.env.NAGAD_PUBLIC_KEY || '', 'PUBLIC KEY');
  const privateKey = formatPem(process.env.NAGAD_PRIVATE_KEY || '', 'PRIVATE KEY');

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateTime = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  const orderId = `DK${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

  const sensitiveData = JSON.stringify({
    merchantId,
    datetime: dateTime,
    orderId,
    challenge: crypto.randomBytes(16).toString('hex'),
  });
  const encryptedSensitive = crypto
    .publicEncrypt(
      { key: publicKey, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(sensitiveData, 'utf8')
    )
    .toString('base64');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(sensitiveData, 'utf8');
  const signature = sign.sign(privateKey, 'base64');

  const initRes = await fetch(
    `${baseUrl}/check-out/initialize/${merchantId}/${orderId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-KM-Api-Version': 'v-0.2.0',
        'X-KM-IP-V4': params.clientIp || '127.0.0.1',
        'X-KM-Client-Type': 'PC_WEB',
      },
      body: JSON.stringify({
        accountNumber: merchantId,
        dateTime,
        sensitiveData: encryptedSensitive,
        signature,
      }),
    }
  );
  const initJson = (await initRes.json()) as {
    sensitiveData?: string;
    message?: string;
  };
  if (!initRes.ok || !initJson.sensitiveData) {
    throw new Error(initJson.message || 'Nagad initialize handshake failed');
  }

  const decryptedInit = crypto
    .privateDecrypt(
      { key: privateKey, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(initJson.sensitiveData, 'base64')
    )
    .toString('utf8');
  const parsedInit = JSON.parse(decryptedInit) as {
    paymentReferenceId: string;
    challenge: string;
  };

  const confirmSensitive = JSON.stringify({
    merchantId,
    orderId,
    currencyCode: '050',
    amount: String(Math.round(params.amount)),
    challenge: parsedInit.challenge,
  });
  const encryptedConfirm = crypto
    .publicEncrypt(
      { key: publicKey, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(confirmSensitive, 'utf8')
    )
    .toString('base64');
  const confirmSign = crypto.createSign('RSA-SHA256');
  confirmSign.update(confirmSensitive, 'utf8');

  const completeRes = await fetch(
    `${baseUrl}/check-out/complete/${parsedInit.paymentReferenceId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-KM-Api-Version': 'v-0.2.0',
        'X-KM-IP-V4': params.clientIp || '127.0.0.1',
        'X-KM-Client-Type': 'PC_WEB',
      },
      body: JSON.stringify({
        sensitiveData: encryptedConfirm,
        signature: confirmSign.sign(privateKey, 'base64'),
        merchantCallbackURL: params.callbackUrl,
        additionalMerchantInfo: { dealId: params.dealId },
      }),
    }
  );
  const completeJson = (await completeRes.json()) as {
    callBackUrl?: string;
    status?: string;
    message?: string;
  };
  if (!completeRes.ok || completeJson.status !== 'Success' || !completeJson.callBackUrl) {
    throw new Error(completeJson.message || 'Nagad checkout complete failed');
  }

  return {
    paymentRefId: parsedInit.paymentReferenceId,
    redirectUrl: completeJson.callBackUrl,
  };
}

async function verifyNagadLivePayment(paymentRefId: string): Promise<{
  trxID: string;
  clientMobileNo?: string;
}> {
  const baseUrl = (
    process.env.NAGAD_BASE_URL ||
    'http://sandbox.mynagad.com:10080/remote-payment-gateway-1.0/api/dfs'
  ).replace(/\/+$/, '');
  const res = await fetch(`${baseUrl}/verify/payment/${paymentRefId}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  const data = (await res.json()) as {
    status?: string;
    issuerPaymentRefNo?: string;
    clientMobileNo?: string;
    message?: string;
  };
  if (!res.ok || data.status !== 'Success' || !data.issuerPaymentRefNo) {
    throw new Error(data.message || 'Nagad payment verification failed');
  }
  return {
    trxID: data.issuerPaymentRefNo,
    clientMobileNo: data.clientMobileNo,
  };
}

async function handlePaymentApi(req: IncomingMessage, res: ServerResponse, urlObj: URL): Promise<boolean> {
  if (!urlObj.pathname.startsWith('/api/payments')) {
    return false;
  }

  if (urlObj.pathname === '/api/payments/config' && req.method === 'GET') {
    const cfg = getGatewayEnvConfig();
    sendJson(res, 200, {
      bkash: { liveConfigured: cfg.bkashLive },
      nagad: { liveConfigured: cfg.nagadLive },
      sandboxAvailable: true,
    });
    return true;
  }

  if (urlObj.pathname === '/api/payments/session/status' && req.method === 'GET') {
    const sessionId = sanitizeIdLocal(urlObj.searchParams.get('sessionId') || '');
    const existing = sessionStore.get(sessionId);
    if (!existing) {
      sendJson(res, 404, { error: 'Payment session not found' });
      return true;
    }
    sendJson(res, 200, { session: existing });
    return true;
  }

  if (urlObj.pathname === '/api/payments/session/create' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const dealId = sanitizeIdLocal(String(body.dealId || ''));
      const buyerId = sanitizeIdLocal(String(body.buyerId || ''));
      const method: PaymentMethod = body.method === 'Nagad' ? 'Nagad' : 'bKash';
      const amount = Number(body.amount || 0);
      const callbackOrigin =
        typeof body.callbackOrigin === 'string' && body.callbackOrigin.startsWith('http')
          ? body.callbackOrigin
          : `http://localhost:${PORT}`;

      if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
        sendJson(res, 400, { error: 'Valid payable amount (1 - 1,000,000 Tk) is required.' });
        return true;
      }

      const envCfg = getGatewayEnvConfig();
      const now = new Date();
      const stamp = now.getTime().toString(36).toUpperCase();
      const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
      const sessionId = sanitizeIdLocal(`ps_${stamp}_${rand}`);
      const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
      const nowIso = now.toISOString();

      if (method === 'bKash' && envCfg.bkashLive) {
        const live = await createBkashLiveSession({
          dealId,
          amount,
          callbackUrl: `${callbackOrigin}/?gateway=bKash&dealId=${encodeURIComponent(dealId)}`,
        });
        const session: PaymentGatewaySession = {
          id: sessionId,
          dealId,
          buyerId,
          method,
          amount: Math.round(amount),
          mode: 'live_api',
          status: 'initiated',
          gatewayPaymentId: live.paymentID,
          redirectUrl: live.bkashURL,
          expiresAt,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        sessionStore.set(session.id, session);
        sendJson(res, 200, { session });
        return true;
      }

      if (method === 'Nagad' && envCfg.nagadLive) {
        const clientIp =
          (typeof req.headers['x-forwarded-for'] === 'string'
            ? req.headers['x-forwarded-for'].split(',')[0].trim()
            : req.socket.remoteAddress) || '127.0.0.1';
        const live = await createNagadLiveSession({
          dealId,
          amount,
          callbackUrl: `${callbackOrigin}/?gateway=Nagad&dealId=${encodeURIComponent(dealId)}`,
          clientIp,
        });
        const session: PaymentGatewaySession = {
          id: sessionId,
          dealId,
          buyerId,
          method,
          amount: Math.round(amount),
          mode: 'live_api',
          status: 'initiated',
          gatewayPaymentId: live.paymentRefId,
          redirectUrl: live.redirectUrl,
          expiresAt,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        sessionStore.set(session.id, session);
        sendJson(res, 200, { session });
        return true;
      }

      const prefix = method === 'bKash' ? 'BKPGW' : 'NGPGW';
      const sandboxSession: PaymentGatewaySession = {
        id: sessionId,
        dealId,
        buyerId,
        method,
        amount: Math.round(amount),
        mode: 'sandbox',
        status: 'initiated',
        gatewayPaymentId: `${prefix}_${stamp}_${rand}`,
        expiresAt,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      sessionStore.set(sandboxSession.id, sandboxSession);
      sendJson(res, 200, { session: sandboxSession });
      return true;
    } catch (err) {
      sendJson(res, 400, {
        error: err instanceof Error ? err.message : 'Could not initiate payment session.',
      });
      return true;
    }
  }

  if (urlObj.pathname === '/api/payments/session/verify' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const sessionId = sanitizeIdLocal(String(body.sessionId || ''));
      const method: PaymentMethod = body.method === 'Nagad' ? 'Nagad' : 'bKash';
      const existing = sessionStore.get(sessionId);
      const envCfg = getGatewayEnvConfig();

      const gatewayPaymentId = String(
        body.gatewayPaymentId || existing?.gatewayPaymentId || ''
      ).trim();

      if (
        (existing?.mode === 'live_api' || (!existing && ((method === 'bKash' && envCfg.bkashLive) || (method === 'Nagad' && envCfg.nagadLive)))) &&
        gatewayPaymentId
      ) {
        const result =
          method === 'bKash'
            ? await executeBkashLivePayment(gatewayPaymentId)
            : await verifyNagadLivePayment(gatewayPaymentId);
        const nowIso = new Date().toISOString();
        const updated: PaymentGatewaySession = {
          id: existing?.id || sessionId,
          dealId: existing?.dealId || sanitizeIdLocal(String(body.dealId || 'deal')),
          buyerId: existing?.buyerId || sanitizeIdLocal(String(body.buyerId || 'buyer')),
          method,
          amount: existing?.amount || Math.max(1, Math.round(Number(body.amount || 0))),
          mode: 'live_api',
          status: 'verified',
          gatewayPaymentId,
          trxId: result.trxID,
          senderMasked:
            result.customerMsisdn ||
            (result as { clientMobileNo?: string }).clientMobileNo ||
            'Verified Wallet',
          expiresAt: existing?.expiresAt || new Date(Date.now() + SESSION_TTL_MS).toISOString(),
          createdAt: existing?.createdAt || nowIso,
          updatedAt: nowIso,
        };
        sessionStore.set(updated.id, updated);
        sendJson(res, 200, { ok: true, session: updated });
        return true;
      }

      const wallet = normalizeBdMobileLocal(String(body.walletNumber || ''));
      if (!/^01[3-9]\d{8}$/.test(wallet)) {
        sendJson(res, 400, {
          ok: false,
          error: 'Enter a valid 11-digit Bangladesh mobile wallet number (01XXXXXXXXX).',
        });
        return true;
      }
      const otp = String(body.otp || '').replace(/[^\d]/g, '');
      if (otp !== '123456') {
        sendJson(res, 400, {
          ok: false,
          error: 'Invalid verification OTP. Enter sandbox OTP 123456.',
        });
        return true;
      }
      const pin = String(body.pin || '1234').replace(/[^\d]/g, '');
      if (pin.length < 4 || pin.length > 5) {
        sendJson(res, 400, {
          ok: false,
          error: 'Enter a 4 or 5-digit wallet PIN to authorize payment.',
        });
        return true;
      }

      const nowIso = new Date().toISOString();
      const prefix = method === 'bKash' ? 'BK' : 'NG';
      const trxId = `${prefix}${Date.now().toString(36).toUpperCase().slice(-6)}${wallet.slice(-2)}`;
      const updated: PaymentGatewaySession = {
        id: existing?.id || sessionId,
        dealId: existing?.dealId || sanitizeIdLocal(String(body.dealId || 'deal')),
        buyerId: existing?.buyerId || sanitizeIdLocal(String(body.buyerId || 'buyer')),
        method,
        amount: existing?.amount || Math.max(1, Math.round(Number(body.amount || 0))),
        mode: 'sandbox',
        status: 'verified',
        gatewayPaymentId: gatewayPaymentId || `${prefix}PGW_${Date.now().toString(36).toUpperCase()}`,
        trxId,
        senderMasked: maskBdPhoneLocal(wallet),
        expiresAt: existing?.expiresAt || new Date(Date.now() + SESSION_TTL_MS).toISOString(),
        createdAt: existing?.createdAt || nowIso,
        updatedAt: nowIso,
      };
      sessionStore.set(updated.id, updated);
      sendJson(res, 200, { ok: true, session: updated });
      return true;
    } catch (err) {
      sendJson(res, 400, {
        ok: false,
        error: err instanceof Error ? err.message : 'Payment verification failed.',
      });
      return true;
    }
  }

  sendJson(res, 404, { error: 'Unknown payment endpoint' });
  return true;
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function serveStaticDist(req: IncomingMessage, res: ServerResponse, urlObj: URL): void {
  const distDir = path.join(__dirname, 'dist');
  const reqPath = decodeURIComponent(urlObj.pathname === '/' ? '/index.html' : urlObj.pathname);
  const safePath = path.normalize(reqPath).replace(/^(\.\.(\/|\\|$))+/, '');
  let filePath = path.join(distDir, safePath);

  if (!filePath.startsWith(distDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Build not found. Run npm run build.');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
}

async function startServer(): Promise<void> {
  let viteMiddleware: ((req: IncomingMessage, res: ServerResponse, next: () => void) => void) | null =
    null;

  if (IS_DEV) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    viteMiddleware = vite.middlewares;
  }

  const server = http.createServer(async (req, res) => {
    try {
      const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const handledApi = await handlePaymentApi(req, res, urlObj);
      if (handledApi) return;

      if (viteMiddleware) {
        viteMiddleware(req, res, () => {
          serveStaticDist(req, res, urlObj);
        });
        return;
      }

      serveStaticDist(req, res, urlObj);
    } catch (err) {
      sendJson(res, 500, {
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(
      `DEALKORO server listening on http://0.0.0.0:${PORT} (${IS_DEV ? 'vite-dev' : 'production-dist'})`
    );
  });
}

void startServer();
