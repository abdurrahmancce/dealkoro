import type { PaymentMethod } from '../types/dealkoro';
import { BLUEPRINT_LIMITS, clampText } from './payloadSanitizer';

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
  mode: 'online_checkout' | 'merchant_link';
}): string {
  const wallet = validateBdWalletNumber(params.senderNumber);
  const trx = validateTrxId(params.trxId);
  const tag =
    params.mode === 'merchant_link'
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
