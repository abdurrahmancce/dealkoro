import type { PaymentGatewaySession, PaymentMethod } from '../types/dealkoro';
import { BLUEPRINT_LIMITS, clampPrice, clampText, maskBdPhone, sanitizeId } from './payloadSanitizer';

export type WalletAccountType = 'Personal' | 'Merchant' | 'Agent';

export function normalizeBdWalletNumber(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.startsWith('8801') && digits.length === 13) {
    return digits.slice(2);
  }
  return digits;
}

export function validateBdWalletNumber(raw: string): {
  valid: boolean;
  normalized: string;
} {
  const normalized = normalizeBdWalletNumber(raw);
  const valid = /^01[3-9]\d{8}$/.test(normalized);
  return { valid, normalized };
}

export function validateTrxId(raw: string): {
  valid: boolean;
  normalized: string;
} {
  const normalized = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const valid = /^[A-Z0-9]{6,20}$/.test(normalized);
  return { valid, normalized };
}

export function sanitizeMerchantPaymentLink(raw?: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (!trimmed.startsWith('https://')) return '';
  return trimmed.slice(0, 240);
}

export function normalizeAccountType(raw?: string): WalletAccountType {
  if (raw === 'Merchant' || raw === 'Agent') return raw;
  return 'Personal';
}

export function buildOnlinePaymentProofNote(params: {
  method: PaymentMethod;
  senderNumber: string;
  trxId: string;
  amount: number;
  dealId: string;
  mode: 'online_checkout' | 'merchant_link' | 'live_api' | 'sandbox';
}): string {
  const wallet = validateBdWalletNumber(params.senderNumber);
  const trx = validateTrxId(params.trxId);
  const tag =
    params.mode === 'live_api'
      ? `${params.method} Live Gateway`
      : params.mode === 'sandbox'
      ? `${params.method} Sandbox Gateway`
      : params.mode === 'merchant_link'
      ? `${params.method} Online Gateway`
      : `${params.method} Real-Time Checkout`;
  const parts = [
    `[${tag}]`,
    trx.valid ? `TrxID: ${trx.normalized}` : `Ref: ${params.trxId.trim() || 'PENDING'}`,
    wallet.valid ? `From: ${wallet.normalized}` : '',
    `Paid: Tk ${Math.round(params.amount).toLocaleString('en-US')}`,
    `Deal: ${params.dealId.slice(-10)}`,
  ].filter(Boolean);
  return clampText(parts.join(' · '), BLUEPRINT_LIMITS.PROOF_NOTE_MAX);
}

export function createSandboxSessionPayload(params: {
  dealId: string;
  buyerId: string;
  method: PaymentMethod;
  amount: number;
  now?: Date;
}): PaymentGatewaySession {
  const now = params.now ?? new Date();
  const stamp = now.getTime().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  const id = sanitizeId(`ps_${stamp}_${rand}`);
  const prefix = params.method === 'bKash' ? 'BKPGW' : 'NGPGW';
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
  const nowIso = now.toISOString();

  return {
    id,
    dealId: sanitizeId(params.dealId),
    buyerId: sanitizeId(params.buyerId),
    method: params.method === 'Nagad' ? 'Nagad' : 'bKash',
    amount: clampPrice(params.amount),
    mode: 'sandbox',
    status: 'initiated',
    gatewayPaymentId: `${prefix}_${stamp}_${rand}`,
    expiresAt,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export function verifySandboxPaymentPayload(params: {
  session: PaymentGatewaySession;
  walletNumber: string;
  otp: string;
  pin?: string;
}): {
  ok: boolean;
  session?: PaymentGatewaySession;
  trxId?: string;
  error?: string;
} {
  const wallet = validateBdWalletNumber(params.walletNumber);
  if (!wallet.valid) {
    return {
      ok: false,
      error: 'Enter a valid 11-digit Bangladesh bKash/Nagad wallet number (01XXXXXXXXX).',
    };
  }
  const cleanOtp = params.otp.replace(/[^\d]/g, '');
  if (cleanOtp !== '123456') {
    return {
      ok: false,
      error: 'Invalid verification OTP. Enter sandbox OTP 123456.',
    };
  }
  const cleanPin = (params.pin ?? '1234').replace(/[^\d]/g, '');
  if (cleanPin.length < 4 || cleanPin.length > 5) {
    return {
      ok: false,
      error: 'Enter a 4 or 5-digit wallet PIN to authorize sandbox payment.',
    };
  }

  const nowIso = new Date().toISOString();
  const prefix = params.session.method === 'bKash' ? 'BK' : 'NG';
  const trxId = `${prefix}${Date.now().toString(36).toUpperCase().slice(-6)}${wallet.normalized.slice(-2)}`;
  const senderMasked = maskBdPhone(wallet.normalized);

  return {
    ok: true,
    trxId,
    session: {
      ...params.session,
      status: 'verified',
      trxId,
      senderMasked,
      updatedAt: nowIso,
    },
  };
}

export function formatGatewaySessionSummary(session: PaymentGatewaySession): string {
  const modeLabel = session.mode === 'live_api' ? 'Live Merchant API' : 'Sandbox Gateway';
  const trxPart = session.trxId ? ` · TrxID ${session.trxId}` : '';
  return `${session.method} ${modeLabel} (${session.status})${trxPart}`;
}

export function parseGatewayCallbackParams(search: string): {
  paymentID?: string;
  status?: string;
  paymentRefId?: string;
  sessionId?: string;
  dealId?: string;
  method?: PaymentMethod;
} | null {
  if (!search) return null;
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  const paymentID = params.get('paymentID') || params.get('payment_id') || undefined;
  const paymentRefId = params.get('payment_ref_id') || params.get('paymentRefId') || undefined;
  const sessionId = params.get('sessionId') || params.get('session_id') || undefined;
  const dealId = params.get('dealId') || undefined;
  const status = params.get('status') || undefined;
  const gwMethod = params.get('gateway');
  if (!paymentID && !paymentRefId && !(gwMethod && status)) return null;
  const method: PaymentMethod | undefined =
    gwMethod === 'Nagad' || paymentRefId
      ? 'Nagad'
      : gwMethod === 'bKash' || paymentID
      ? 'bKash'
      : undefined;
  return { paymentID, paymentRefId, sessionId, dealId, status, method };
}

/**
 * Builds a deterministic 21x21 QR-style matrix with 3 standard finder patterns
 * for local SVG rendering without external network calls.
 */
export function buildQrMatrix(payload: string, gridSize = 21): boolean[][] {
  const matrix: boolean[][] = Array.from({ length: gridSize }, () =>
    Array<boolean>(gridSize).fill(false)
  );

  const stampFinder = (rowOffset: number, colOffset: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        matrix[rowOffset + r][colOffset + c] = isBorder || isCenter;
      }
    }
  };

  stampFinder(0, 0);
  stampFinder(0, gridSize - 7);
  stampFinder(gridSize - 7, 0);

  let hash = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const inTopLeft = r < 8 && c < 8;
      const inTopRight = r < 8 && c >= gridSize - 8;
      const inBottomLeft = r >= gridSize - 8 && c < 8;
      if (inTopLeft || inTopRight || inBottomLeft) continue;

      if (r === 6 || c === 6) {
        matrix[r][c] = (r + c) % 2 === 0;
        continue;
      }

      hash ^= (r * 31 + c * 17) & 0xff;
      hash = Math.imul(hash, 16777619);
      matrix[r][c] = (hash >>> 28) % 2 === 0;
    }
  }

  return matrix;
}
