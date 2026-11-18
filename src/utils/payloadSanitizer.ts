import { ASSETS } from '../data/seedData';
import type {
  ListingCategory,
  LinkType,
  PaymentMethod,
} from '../types/dealkoro';

export const BLUEPRINT_LIMITS = {
  ID_MAX: 128,
  NAME_MAX: 80,
  URL_MAX: 512,
  IMAGE_DATA_URL_MAX: 120_000,
  TITLE_MAX: 120,
  DESC_MAX: 1000,
  MESSAGE_MAX: 800,
  COMMENT_MAX: 500,
  PROOF_NOTE_MAX: 300,
  LAST_MESSAGE_MAX: 300,
  NOTIF_MESSAGE_MAX: 240,
  ACCOUNT_DETAILS_MAX: 500,
  REVIEW_COMMENT_MAX: 500,
  MAX_PRICE: 1_000_000,
} as const;

const VALID_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;
const SAFE_RASTER_DATA_URL_REGEX = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export function sanitizeId(raw: string, fallbackPrefix = 'id'): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, BLUEPRINT_LIMITS.ID_MAX);
  if (cleaned.length >= 1 && VALID_ID_REGEX.test(cleaned)) {
    return cleaned;
  }
  return `${fallbackPrefix}_${Date.now().toString(36)}`;
}

export function clampText(raw: string, maxLength: number, fallback = ''): string {
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

export function sanitizeImageUrl(raw: string | undefined, fallback: string = ASSETS.efootballSquad): string {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  if (
    SAFE_RASTER_DATA_URL_REGEX.test(trimmed) &&
    trimmed.length <= BLUEPRINT_LIMITS.IMAGE_DATA_URL_MAX
  ) {
    return trimmed;
  }
  if (trimmed.startsWith('data:')) {
    return fallback;
  }
  if (trimmed.length > BLUEPRINT_LIMITS.URL_MAX) {
    return fallback;
  }
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://') || trimmed.startsWith('/src/assets/')) {
    return trimmed;
  }
  return fallback;
}

export function clampPrice(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  return Math.max(0, Math.min(BLUEPRINT_LIMITS.MAX_PRICE, Math.round(raw)));
}

export function normalizeCategory(val: string): ListingCategory {
  const allowed: ListingCategory[] = ['eFootball', 'PUBG Mobile', 'Free Fire', 'Mobile Legends', 'Other'];
  return allowed.includes(val as ListingCategory) ? (val as ListingCategory) : 'eFootball';
}

export function normalizeLinkType(val: string): LinkType {
  const allowed: LinkType[] = ['Only Konami', 'Konami + Glink', 'Konami + iOSlink', 'Gg Lost'];
  return allowed.includes(val as LinkType) ? (val as LinkType) : 'Only Konami';
}

export function normalizePaymentMethod(val: string): PaymentMethod {
  return val === 'Nagad' ? 'Nagad' : 'bKash';
}

export const DEFAULT_PLATFORM_CONFIG = {
  bkashNumber: '01755-842190',
  nagadNumber: '01755-842190',
  escrowLabel: 'DEALKORO Official Escrow',
  announcement:
    'Send escrow funds only to the verified bKash or Nagad number shown inside your active deal room.',
  updatedAt: '2026-11-18T00:00:00Z',
};

export function sanitizePlatformConfig(input: {
  bkashNumber?: string;
  nagadNumber?: string;
  escrowLabel?: string;
  announcement?: string;
  updatedAt?: string;
}) {
  return {
    bkashNumber: clampText(
      input.bkashNumber ?? DEFAULT_PLATFORM_CONFIG.bkashNumber,
      32,
      DEFAULT_PLATFORM_CONFIG.bkashNumber
    ),
    nagadNumber: clampText(
      input.nagadNumber ?? DEFAULT_PLATFORM_CONFIG.nagadNumber,
      32,
      DEFAULT_PLATFORM_CONFIG.nagadNumber
    ),
    escrowLabel: clampText(
      input.escrowLabel ?? DEFAULT_PLATFORM_CONFIG.escrowLabel,
      BLUEPRINT_LIMITS.NAME_MAX,
      DEFAULT_PLATFORM_CONFIG.escrowLabel
    ),
    announcement: clampText(
      input.announcement ?? DEFAULT_PLATFORM_CONFIG.announcement,
      BLUEPRINT_LIMITS.NOTIF_MESSAGE_MAX,
      ''
    ),
    updatedAt: input.updatedAt || new Date().toISOString(),
  };
}

export function formatEscrowPaymentContact(
  config: { bkashNumber: string; nagadNumber: string; escrowLabel: string },
  method?: PaymentMethod | 'pending'
): string {
  const safe = sanitizePlatformConfig(config);
  let raw: string;
  if (method === 'bKash') {
    raw = `bKash: ${safe.bkashNumber} (${safe.escrowLabel})`;
  } else if (method === 'Nagad') {
    raw = `Nagad: ${safe.nagadNumber} (${safe.escrowLabel})`;
  } else {
    raw = `bKash: ${safe.bkashNumber} · Nagad: ${safe.nagadNumber} (${safe.escrowLabel})`;
  }
  return clampText(raw, BLUEPRINT_LIMITS.TITLE_MAX);
}
