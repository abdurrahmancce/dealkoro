import crypto from 'node:crypto';
import {
  formatPemKey,
  isValidBkashStatusCode,
  normalizeIpv4,
  type BkashResolvedConfig,
  type NagadResolvedConfig,
} from '../utils/merchantGatewayConfig.ts';

export type FetchLike = typeof fetch;

interface CachedBkashToken {
  idToken: string;
  refreshToken?: string;
  expiresAtMs: number;
}

const bkashTokenCache = new Map<string, CachedBkashToken>();

export function clearBkashTokenCache(): void {
  bkashTokenCache.clear();
}

export function formatNagadDhakaDateTime(date = new Date()): string {
  // Nagad gateway expects YYYYMMDDHHmmss in Asia/Dhaka (UTC+6)
  const dhakaMs = date.getTime() + 6 * 60 * 60 * 1000;
  const d = new Date(dhakaMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`
  );
}

interface BkashGrantResponse {
  id_token?: string;
  refresh_token?: string;
  expires_in?: number;
  statusCode?: string;
  statusMessage?: string;
  msg?: string;
}

async function fetchJsonSafe<T>(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit
): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetchImpl(url, init);
  const rawText = await res.text();
  let parsed: unknown = {};
  if (rawText.trim()) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = { message: rawText.slice(0, 200) };
    }
  }
  return { ok: res.ok, status: res.status, data: parsed as T };
}

export async function getBkashAuthToken(
  cfg: BkashResolvedConfig,
  fetchImpl: FetchLike = fetch
): Promise<string> {
  if (!cfg.liveConfigured) {
    throw new Error(cfg.fallbackReason || 'bKash live merchant credentials are not configured.');
  }

  const cacheKey = `${cfg.baseUrl}|${cfg.appKey}|${cfg.username}`;
  const cached = bkashTokenCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAtMs - 60_000 > now) {
    return cached.idToken;
  }

  // Try refresh token first if available
  if (cached?.refreshToken) {
    try {
      const refreshRes = await fetchJsonSafe<BkashGrantResponse>(
        fetchImpl,
        `${cfg.baseUrl}/tokenized/checkout/token/refresh`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            username: cfg.username,
            password: cfg.password,
          },
          body: JSON.stringify({
            app_key: cfg.appKey,
            app_secret: cfg.appSecret,
            refresh_token: cached.refreshToken,
          }),
        }
      );

      if (
        refreshRes.ok &&
        refreshRes.data.id_token &&
        isValidBkashStatusCode(refreshRes.data.statusCode)
      ) {
        const ttlSec = Math.max(300, Number(refreshRes.data.expires_in) || 3600);
        bkashTokenCache.set(cacheKey, {
          idToken: refreshRes.data.id_token,
          refreshToken: refreshRes.data.refresh_token || cached.refreshToken,
          expiresAtMs: now + ttlSec * 1000,
        });
        return refreshRes.data.id_token;
      }
    } catch {
      // Fall through to full token grant
    }
  }

  const grantRes = await fetchJsonSafe<BkashGrantResponse>(
    fetchImpl,
    `${cfg.baseUrl}/tokenized/checkout/token/grant`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        username: cfg.username,
        password: cfg.password,
      },
      body: JSON.stringify({
        app_key: cfg.appKey,
        app_secret: cfg.appSecret,
      }),
    }
  );

  if (
    !grantRes.ok ||
    !grantRes.data.id_token ||
    !isValidBkashStatusCode(grantRes.data.statusCode)
  ) {
    throw new Error(
      grantRes.data.statusMessage || grantRes.data.msg || 'bKash token grant failed'
    );
  }

  const ttlSec = Math.max(300, Number(grantRes.data.expires_in) || 3600);
  bkashTokenCache.set(cacheKey, {
    idToken: grantRes.data.id_token,
    refreshToken: grantRes.data.refresh_token,
    expiresAtMs: now + ttlSec * 1000,
  });

  return grantRes.data.id_token;
}

export async function createBkashLiveSession(
  cfg: BkashResolvedConfig,
  params: {
    dealId: string;
    sessionId?: string;
    amount: number;
    callbackUrl: string;
  },
  fetchImpl: FetchLike = fetch
): Promise<{ paymentID: string; bkashURL: string; merchantInvoiceNumber: string }> {
  const idToken = await getBkashAuthToken(cfg, fetchImpl);
  const merchantInvoiceNumber = `DK-${params.dealId.slice(-10)}-${Date.now().toString(36).toUpperCase()}`;

  const createRes = await fetchJsonSafe<{
    paymentID?: string;
    bkashURL?: string;
    statusCode?: string;
    statusMessage?: string;
  }>(fetchImpl, `${cfg.baseUrl}/tokenized/checkout/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: idToken,
      'X-App-Key': cfg.appKey,
    },
    body: JSON.stringify({
      mode: '0011',
      payerReference: params.dealId,
      callbackURL: params.callbackUrl,
      amount: String(Math.round(params.amount)),
      currency: 'BDT',
      intent: 'sale',
      merchantInvoiceNumber,
    }),
  });

  if (
    !createRes.ok ||
    !isValidBkashStatusCode(createRes.data.statusCode) ||
    !createRes.data.paymentID ||
    !createRes.data.bkashURL
  ) {
    throw new Error(createRes.data.statusMessage || 'bKash checkout create failed');
  }

  return {
    paymentID: createRes.data.paymentID,
    bkashURL: createRes.data.bkashURL,
    merchantInvoiceNumber,
  };
}

interface BkashPaymentResultResponse {
  trxID?: string;
  transactionStatus?: string;
  amount?: string;
  currency?: string;
  customerMsisdn?: string;
  payerReference?: string;
  statusCode?: string;
  statusMessage?: string;
}

export async function queryBkashLivePayment(
  cfg: BkashResolvedConfig,
  paymentID: string,
  fetchImpl: FetchLike = fetch
): Promise<BkashPaymentResultResponse> {
  const idToken = await getBkashAuthToken(cfg, fetchImpl);
  const queryRes = await fetchJsonSafe<BkashPaymentResultResponse>(
    fetchImpl,
    `${cfg.baseUrl}/tokenized/checkout/payment/status`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: idToken,
        'X-App-Key': cfg.appKey,
      },
      body: JSON.stringify({ paymentID }),
    }
  );
  if (!queryRes.ok) {
    throw new Error(queryRes.data.statusMessage || 'bKash payment status query failed');
  }
  return queryRes.data;
}

export async function executeBkashLivePayment(
  cfg: BkashResolvedConfig,
  params: {
    paymentID: string;
    expectedAmount?: number;
  },
  fetchImpl: FetchLike = fetch
): Promise<{
  trxID: string;
  customerMsisdn?: string;
  amount?: number;
}> {
  const idToken = await getBkashAuthToken(cfg, fetchImpl);

  let execData: BkashPaymentResultResponse = {};
  let execHttpOk = false;

  try {
    const execRes = await fetchJsonSafe<BkashPaymentResultResponse>(
      fetchImpl,
      `${cfg.baseUrl}/tokenized/checkout/execute`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: idToken,
          'X-App-Key': cfg.appKey,
        },
        body: JSON.stringify({ paymentID: params.paymentID }),
      }
    );
    execHttpOk = execRes.ok;
    execData = execRes.data;
  } catch {
    // Network timeout/error during execute — query status as recommended by bKash docs
    execData = await queryBkashLivePayment(cfg, params.paymentID, fetchImpl);
    execHttpOk = true;
  }

  // Status 2062 indicates payment was already completed; query status endpoint to retrieve trxID
  if (
    !execHttpOk ||
    execData.statusCode === '2062' ||
    (execData.transactionStatus !== 'Completed' && !execData.trxID)
  ) {
    if (
      execData.statusCode === '2062' ||
      execData.transactionStatus === 'Authorized' ||
      !execHttpOk
    ) {
      const queried = await queryBkashLivePayment(cfg, params.paymentID, fetchImpl);
      if (queried.transactionStatus === 'Completed' && queried.trxID) {
        execData = queried;
        execHttpOk = true;
      }
    }
  }

  if (
    !execHttpOk ||
    !isValidBkashStatusCode(execData.statusCode) ||
    execData.transactionStatus !== 'Completed' ||
    !execData.trxID
  ) {
    throw new Error(execData.statusMessage || 'bKash payment execution not completed');
  }

  if (execData.currency && execData.currency.toUpperCase() !== 'BDT') {
    throw new Error(`Unexpected bKash payment currency: ${execData.currency}`);
  }

  const paidAmount = execData.amount !== undefined ? Number(execData.amount) : undefined;
  if (
    params.expectedAmount &&
    paidAmount !== undefined &&
    Number.isFinite(paidAmount) &&
    paidAmount < Math.round(params.expectedAmount)
  ) {
    throw new Error(
      `bKash paid amount (${paidAmount}) is below expected deal total (${Math.round(params.expectedAmount)})`
    );
  }

  return {
    trxID: execData.trxID,
    customerMsisdn: execData.customerMsisdn,
    amount: paidAmount,
  };
}

function decryptWithPrivateKey(rawPrivateKey: string, encryptedBase64: string): string {
  const candidates = [
    rawPrivateKey,
    formatPemKey(rawPrivateKey, 'PRIVATE KEY'),
    formatPemKey(rawPrivateKey, 'RSA PRIVATE KEY'),
  ];
  let lastError: unknown;
  for (const keyPem of candidates) {
    if (!keyPem) continue;
    try {
      return crypto
        .privateDecrypt(
          { key: keyPem, padding: crypto.constants.RSA_PKCS1_PADDING },
          Buffer.from(encryptedBase64, 'base64')
        )
        .toString('utf8');
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Failed to decrypt Nagad response');
}

function signWithPrivateKey(rawPrivateKey: string, payloadUtf8: string): string {
  const candidates = [
    rawPrivateKey,
    formatPemKey(rawPrivateKey, 'PRIVATE KEY'),
    formatPemKey(rawPrivateKey, 'RSA PRIVATE KEY'),
  ];
  let lastError: unknown;
  for (const keyPem of candidates) {
    if (!keyPem) continue;
    try {
      const signer = crypto.createSign('RSA-SHA256');
      signer.update(payloadUtf8, 'utf8');
      return signer.sign(keyPem, 'base64');
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Failed to sign Nagad payload');
}

export async function createNagadLiveSession(
  cfg: NagadResolvedConfig,
  params: {
    dealId: string;
    sessionId?: string;
    amount: number;
    callbackUrl: string;
    clientIp: string;
  },
  fetchImpl: FetchLike = fetch
): Promise<{ paymentRefId: string; redirectUrl: string; orderId: string }> {
  if (!cfg.liveConfigured) {
    throw new Error(cfg.fallbackReason || 'Nagad live merchant credentials are not configured.');
  }

  const ipv4 = normalizeIpv4(params.clientIp);
  const dateTime = formatNagadDhakaDateTime();
  const orderId = `DK${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

  const sensitiveData = JSON.stringify({
    merchantId: cfg.merchantId,
    datetime: dateTime,
    orderId,
    challenge: crypto.randomBytes(16).toString('hex'),
  });

  const encryptedSensitive = crypto
    .publicEncrypt(
      { key: cfg.publicKey, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(sensitiveData, 'utf8')
    )
    .toString('base64');
  const signature = signWithPrivateKey(cfg.privateKey, sensitiveData);

  const initRes = await fetchJsonSafe<{
    sensitiveData?: string;
    signature?: string;
    message?: string;
    reason?: string;
  }>(fetchImpl, `${cfg.baseUrl}/check-out/initialize/${encodeURIComponent(cfg.merchantId)}/${encodeURIComponent(orderId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-KM-Api-Version': 'v-0.2.0',
      'X-KM-IP-V4': ipv4,
      'X-KM-Client-Type': 'PC_WEB',
    },
    body: JSON.stringify({
      accountNumber: cfg.merchantNumber || cfg.merchantId,
      dateTime,
      sensitiveData: encryptedSensitive,
      signature,
    }),
  });

  if (!initRes.ok || !initRes.data.sensitiveData) {
    throw new Error(
      initRes.data.message || initRes.data.reason || 'Nagad initialize handshake failed'
    );
  }

  const decryptedInit = decryptWithPrivateKey(cfg.privateKey, initRes.data.sensitiveData);
  const parsedInit = JSON.parse(decryptedInit) as {
    paymentReferenceId?: string;
    challenge?: string;
  };
  if (!parsedInit.paymentReferenceId || !parsedInit.challenge) {
    throw new Error('Nagad initialize response missing paymentReferenceId or challenge');
  }

  const confirmSensitive = JSON.stringify({
    merchantId: cfg.merchantId,
    orderId,
    currencyCode: '050',
    amount: String(Math.round(params.amount)),
    challenge: parsedInit.challenge,
  });

  const encryptedConfirm = crypto
    .publicEncrypt(
      { key: cfg.publicKey, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(confirmSensitive, 'utf8')
    )
    .toString('base64');
  const confirmSignature = signWithPrivateKey(cfg.privateKey, confirmSensitive);

  const completeRes = await fetchJsonSafe<{
    callBackUrl?: string;
    status?: string;
    message?: string;
    reason?: string;
  }>(
    fetchImpl,
    `${cfg.baseUrl}/check-out/complete/${encodeURIComponent(parsedInit.paymentReferenceId)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-KM-Api-Version': 'v-0.2.0',
        'X-KM-IP-V4': ipv4,
        'X-KM-Client-Type': 'PC_WEB',
      },
      body: JSON.stringify({
        sensitiveData: encryptedConfirm,
        signature: confirmSignature,
        merchantCallbackURL: params.callbackUrl,
        additionalMerchantInfo: {
          dealId: params.dealId,
          ...(params.sessionId ? { sessionId: params.sessionId } : {}),
        },
      }),
    }
  );

  if (
    !completeRes.ok ||
    completeRes.data.status !== 'Success' ||
    !completeRes.data.callBackUrl
  ) {
    throw new Error(
      completeRes.data.message || completeRes.data.reason || 'Nagad checkout complete failed'
    );
  }

  return {
    paymentRefId: parsedInit.paymentReferenceId,
    redirectUrl: completeRes.data.callBackUrl,
    orderId,
  };
}

export async function verifyNagadLivePayment(
  cfg: NagadResolvedConfig,
  params: {
    paymentRefId: string;
    expectedAmount?: number;
    clientIp?: string;
  },
  fetchImpl: FetchLike = fetch
): Promise<{
  trxID: string;
  clientMobileNo?: string;
  amount?: number;
}> {
  if (!cfg.liveConfigured) {
    throw new Error(cfg.fallbackReason || 'Nagad live merchant credentials are not configured.');
  }

  const res = await fetchJsonSafe<{
    status?: string;
    issuerPaymentRefNo?: string;
    clientMobileNo?: string;
    amount?: string;
    message?: string;
    reason?: string;
  }>(
    fetchImpl,
    `${cfg.baseUrl}/verify/payment/${encodeURIComponent(params.paymentRefId)}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-KM-Api-Version': 'v-0.2.0',
        'X-KM-IP-V4': normalizeIpv4(params.clientIp),
        'X-KM-Client-Type': 'PC_WEB',
      },
    }
  );

  if (!res.ok || res.data.status !== 'Success' || !res.data.issuerPaymentRefNo) {
    throw new Error(
      res.data.message || res.data.reason || 'Nagad payment verification failed'
    );
  }

  const paidAmount = res.data.amount !== undefined ? Number(res.data.amount) : undefined;
  if (
    params.expectedAmount &&
    paidAmount !== undefined &&
    Number.isFinite(paidAmount) &&
    paidAmount < Math.round(params.expectedAmount)
  ) {
    throw new Error(
      `Nagad paid amount (${paidAmount}) is below expected deal total (${Math.round(params.expectedAmount)})`
    );
  }

  return {
    trxID: res.data.issuerPaymentRefNo,
    clientMobileNo: res.data.clientMobileNo,
    amount: paidAmount,
  };
}
