import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PaymentGatewaySession, PaymentMethod } from './src/types/dealkoro.ts';
import {
  getPublicGatewayConfigPayload,
  normalizeIpv4,
  resolveMerchantGatewayConfig,
} from './src/utils/merchantGatewayConfig.ts';
import {
  createBkashLiveSession,
  createNagadLiveSession,
  executeBkashLivePayment,
  verifyNagadLivePayment,
} from './src/server/bkashNagadGateway.ts';

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

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

function pruneExpiredSessions(): void {
  const nowMs = Date.now();
  for (const [id, s] of sessionStore.entries()) {
    const expMs = Date.parse(s.expiresAt);
    if (!Number.isNaN(expMs) && nowMs - expMs > SESSION_TTL_MS * 4) {
      sessionStore.delete(id);
    }
  }
}

function resolveSafeCallbackOrigin(raw: unknown): string {
  const fallback = `http://localhost:${PORT}`;
  if (typeof raw !== 'string' || !raw.trim()) return fallback;
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return fallback;
    }
    return parsed.origin;
  } catch {
    return fallback;
  }
}

function extractClientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  const raw =
    typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim()
      : Array.isArray(forwarded)
      ? forwarded[0]
      : req.socket.remoteAddress;
  return normalizeIpv4(raw);
}

function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    ...SECURITY_HEADERS,
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

async function handlePaymentApi(req: IncomingMessage, res: ServerResponse, urlObj: URL): Promise<boolean> {
  if (!urlObj.pathname.startsWith('/api/payments')) {
    return false;
  }

  if (urlObj.pathname === '/api/payments/config' && req.method === 'GET') {
    const resolved = resolveMerchantGatewayConfig(process.env);
    sendJson(res, 200, getPublicGatewayConfigPayload(resolved));
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
      pruneExpiredSessions();
      const body = await readJsonBody(req);
      const dealId = sanitizeIdLocal(String(body.dealId || ''));
      const buyerId = sanitizeIdLocal(String(body.buyerId || ''));
      const method: PaymentMethod = body.method === 'Nagad' ? 'Nagad' : 'bKash';
      const amount = Number(body.amount || 0);
      const callbackOrigin = resolveSafeCallbackOrigin(body.callbackOrigin);

      if (!dealId || !buyerId) {
        sendJson(res, 400, { error: 'Valid dealId and buyerId are required.' });
        return true;
      }

      if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
        sendJson(res, 400, { error: 'Valid payable amount (1 - 1,000,000 Tk) is required.' });
        return true;
      }

      const gatewayConfig = resolveMerchantGatewayConfig(process.env);
      const now = new Date();
      const stamp = now.getTime().toString(36).toUpperCase();
      const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
      const sessionId = sanitizeIdLocal(`ps_${stamp}_${rand}`);
      const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
      const nowIso = now.toISOString();
      const callbackUrl = `${callbackOrigin}/?gateway=${encodeURIComponent(method)}&dealId=${encodeURIComponent(dealId)}&sessionId=${encodeURIComponent(sessionId)}`;

      if (method === 'bKash' && gatewayConfig.bkash.mode === 'live_api') {
        const live = await createBkashLiveSession(gatewayConfig.bkash, {
          dealId,
          sessionId,
          amount,
          callbackUrl,
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
        sendJson(res, 200, {
          session,
          environment: gatewayConfig.bkash.environment,
          tier: gatewayConfig.bkash.tier,
        });
        return true;
      }

      if (method === 'Nagad' && gatewayConfig.nagad.mode === 'live_api') {
        const clientIp = extractClientIp(req);
        const live = await createNagadLiveSession(gatewayConfig.nagad, {
          dealId,
          sessionId,
          amount,
          callbackUrl,
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
        sendJson(res, 200, {
          session,
          environment: gatewayConfig.nagad.environment,
          tier: gatewayConfig.nagad.tier,
        });
        return true;
      }

      const activeRail = method === 'Nagad' ? gatewayConfig.nagad : gatewayConfig.bkash;
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
      sendJson(res, 200, {
        session: sandboxSession,
        environment: activeRail.environment,
        tier: activeRail.tier,
        fallbackReason: activeRail.fallbackReason,
      });
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
      pruneExpiredSessions();
      const body = await readJsonBody(req);
      const sessionId = sanitizeIdLocal(String(body.sessionId || ''));
      const requestedBuyerId = body.buyerId ? sanitizeIdLocal(String(body.buyerId)) : '';
      const method: PaymentMethod = body.method === 'Nagad' ? 'Nagad' : 'bKash';
      const existing = sessionStore.get(sessionId);
      const gatewayConfig = resolveMerchantGatewayConfig(process.env);

      if (existing) {
        if (requestedBuyerId && existing.buyerId !== requestedBuyerId) {
          sendJson(res, 403, { ok: false, error: 'Payment session belongs to another user.' });
          return true;
        }
        if (existing.status === 'verified') {
          sendJson(res, 200, { ok: true, session: existing });
          return true;
        }
        const expiresMs = Date.parse(existing.expiresAt);
        if (!Number.isNaN(expiresMs) && Date.now() > expiresMs) {
          const expiredSession: PaymentGatewaySession = {
            ...existing,
            status: 'expired',
            updatedAt: new Date().toISOString(),
          };
          sessionStore.set(existing.id, expiredSession);
          sendJson(res, 410, {
            ok: false,
            error: 'Payment session expired. Start a new payment session.',
          });
          return true;
        }
      }

      const gatewayPaymentId = String(
        body.gatewayPaymentId || existing?.gatewayPaymentId || ''
      ).trim();

      const expectedAmount = existing?.amount || Math.max(0, Math.round(Number(body.amount || 0)));
      const shouldVerifyLive =
        Boolean(gatewayPaymentId) &&
        (existing?.mode === 'live_api' ||
          (!existing &&
            ((method === 'bKash' && gatewayConfig.bkash.mode === 'live_api') ||
              (method === 'Nagad' && gatewayConfig.nagad.mode === 'live_api'))));

      if (shouldVerifyLive) {
        const result =
          method === 'bKash'
            ? await executeBkashLivePayment(gatewayConfig.bkash, {
                paymentID: gatewayPaymentId,
                expectedAmount: expectedAmount > 0 ? expectedAmount : undefined,
              })
            : await verifyNagadLivePayment(gatewayConfig.nagad, {
                paymentRefId: gatewayPaymentId,
                expectedAmount: expectedAmount > 0 ? expectedAmount : undefined,
                clientIp: extractClientIp(req),
              });
        const nowIso = new Date().toISOString();
        const updated: PaymentGatewaySession = {
          id: existing?.id || sessionId,
          dealId: existing?.dealId || sanitizeIdLocal(String(body.dealId || 'deal')),
          buyerId: existing?.buyerId || sanitizeIdLocal(String(body.buyerId || 'buyer')),
          method,
          amount: existing?.amount || Math.max(1, expectedAmount),
          mode: 'live_api',
          status: 'verified',
          gatewayPaymentId,
          trxId: result.trxID,
          senderMasked:
            ('customerMsisdn' in result
              ? result.customerMsisdn
              : 'clientMobileNo' in result
              ? result.clientMobileNo
              : undefined) || 'Verified Wallet',
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
        amount: existing?.amount || Math.max(1, expectedAmount),
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
  res.writeHead(200, {
    ...SECURITY_HEADERS,
    'Content-Type': contentType,
  });
  fs.createReadStream(filePath).pipe(res);
}

async function startServer(): Promise<void> {
  let viteMiddleware: ((req: IncomingMessage, res: ServerResponse, next: () => void) => void) | null =
    null;

  if (IS_DEV) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
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
