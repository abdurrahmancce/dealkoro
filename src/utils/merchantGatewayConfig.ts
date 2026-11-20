import type { PaymentMethod } from '../types/dealkoro.ts';

export const BKASH_OFFICIAL_ENDPOINTS = {
  production: 'https://tokenized.pay.bka.sh/v1.2.0-beta',
  sandbox: 'https://tokenized.sandbox.bka.sh/v1.2.0-beta',
} as const;

export const NAGAD_OFFICIAL_ENDPOINTS = {
  production: 'https://api.mynagad.com/api/dfs',
  sandbox: 'http://sandbox.mynagad.com:10080/remote-payment-gateway-1.0/api/dfs',
} as const;

export const BKASH_REQUIRED_CREDENTIAL_KEYS = [
  'BKASH_APP_KEY',
  'BKASH_APP_SECRET',
  'BKASH_USERNAME',
  'BKASH_PASSWORD',
] as const;

export const NAGAD_REQUIRED_CREDENTIAL_KEYS = [
  'NAGAD_MERCHANT_ID',
  'NAGAD_PUBLIC_KEY',
  'NAGAD_PRIVATE_KEY',
] as const;

export type GatewayEnvironmentMode = 'production' | 'sandbox';
export type GatewayRoutingTier = 'production' | 'vendor_sandbox' | 'sandbox_fallback';

export interface BkashResolvedConfig {
  method: 'bKash';
  environment: GatewayEnvironmentMode;
  tier: GatewayRoutingTier;
  mode: 'live_api' | 'sandbox';
  liveConfigured: boolean;
  productionCredentialsFound: boolean;
  missingCredentials: string[];
  baseUrl: string;
  endpointHost: string;
  appKey: string;
  appSecret: string;
  username: string;
  password: string;
  fallbackReason?: string;
}

export interface NagadResolvedConfig {
  method: 'Nagad';
  environment: GatewayEnvironmentMode;
  tier: GatewayRoutingTier;
  mode: 'live_api' | 'sandbox';
  liveConfigured: boolean;
  productionCredentialsFound: boolean;
  missingCredentials: string[];
  baseUrl: string;
  endpointHost: string;
  merchantId: string;
  merchantNumber: string;
  publicKey: string;
  privateKey: string;
  keyValidationError?: string;
  fallbackReason?: string;
}

export interface MerchantGatewayConfig {
  bkash: BkashResolvedConfig;
  nagad: NagadResolvedConfig;
}

export interface PublicRailStatus {
  liveConfigured: boolean;
  productionCredentialsFound: boolean;
  environment: GatewayEnvironmentMode;
  tier: GatewayRoutingTier;
  mode: 'live_api' | 'sandbox';
  endpointHost: string;
  missingCredentialKeys: string[];
  fallbackReason?: string;
}

export interface PublicGatewayConfigPayload {
  bkash: PublicRailStatus;
  nagad: PublicRailStatus;
  sandboxAvailable: true;
}

function readEnvStr(env: Record<string, string | undefined>, key: string): string {
  const val = env[key];
  return typeof val === 'string' ? val.trim() : '';
}

function parseOptionalEnvMode(raw: string): GatewayEnvironmentMode | undefined {
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'production' || normalized === 'prod' || normalized === 'live') {
    return 'production';
  }
  if (normalized === 'sandbox' || normalized === 'test' || normalized === 'dev') {
    return 'sandbox';
  }
  return undefined;
}

function resolveValidEndpointUrl(rawUrl: string, fallbackUrl: string): string {
  if (!rawUrl) return fallbackUrl;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return fallbackUrl;
    }
    return rawUrl.replace(/\/+$/, '');
  } catch {
    return fallbackUrl;
  }
}

function extractHost(urlStr: string): string {
  try {
    return new URL(urlStr).host;
  } catch {
    return '';
  }
}

export function formatPemKey(
  rawKey: string,
  label: 'PUBLIC KEY' | 'RSA PRIVATE KEY' | 'PRIVATE KEY'
): string {
  const normalized = rawKey.replace(/\\n/g, '\n').trim();
  if (!normalized) return '';
  if (normalized.includes('-----BEGIN')) return normalized;
  const wrapped = normalized.replace(/\s+/g, '').match(/.{1,64}/g)?.join('\n') || normalized;
  return `-----BEGIN ${label}-----\n${wrapped}\n-----END ${label}-----`;
}

export function isLikelyValidRsaKeyBody(rawKey: string): boolean {
  const stripped = rawKey
    .replace(/\\n/g, '')
    .replace(/-----BEGIN [A-Z ]+-----/g, '')
    .replace(/-----END [A-Z ]+-----/g, '')
    .replace(/\s+/g, '');
  if (stripped.length < 32) return false;
  return /^[A-Za-z0-9+/=]+$/.test(stripped);
}

export function normalizeIpv4(rawIp?: string): string {
  if (!rawIp) return '127.0.0.1';
  let candidate = rawIp.split(',')[0]?.trim() || '';
  if (candidate.startsWith('::ffff:')) {
    candidate = candidate.slice(7);
  }
  if (candidate === '::1' || candidate === 'localhost') {
    return '127.0.0.1';
  }
  const parts = candidate.split('.');
  if (
    parts.length === 4 &&
    parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) >= 0 && Number(p) <= 255)
  ) {
    return candidate;
  }
  return '127.0.0.1';
}

export function isValidBkashStatusCode(statusCode?: string): boolean {
  if (statusCode === undefined || statusCode === '') return true;
  return statusCode === '0000';
}

export function resolveBkashGatewayConfig(
  env: Record<string, string | undefined>
): BkashResolvedConfig {
  const appKey = readEnvStr(env, 'BKASH_APP_KEY');
  const appSecret = readEnvStr(env, 'BKASH_APP_SECRET');
  const username = readEnvStr(env, 'BKASH_USERNAME');
  const password = readEnvStr(env, 'BKASH_PASSWORD');

  const keyMap: Record<(typeof BKASH_REQUIRED_CREDENTIAL_KEYS)[number], string> = {
    BKASH_APP_KEY: appKey,
    BKASH_APP_SECRET: appSecret,
    BKASH_USERNAME: username,
    BKASH_PASSWORD: password,
  };

  const missingCredentials = BKASH_REQUIRED_CREDENTIAL_KEYS.filter((k) => !keyMap[k]);
  const explicitEnv = parseOptionalEnvMode(readEnvStr(env, 'BKASH_ENV'));
  const customBaseUrl = readEnvStr(env, 'BKASH_BASE_URL');

  if (missingCredentials.length > 0) {
    const baseUrl = resolveValidEndpointUrl(customBaseUrl, BKASH_OFFICIAL_ENDPOINTS.sandbox);
    return {
      method: 'bKash',
      environment: 'sandbox',
      tier: 'sandbox_fallback',
      mode: 'sandbox',
      liveConfigured: false,
      productionCredentialsFound: false,
      missingCredentials,
      baseUrl,
      endpointHost: extractHost(baseUrl),
      appKey: '',
      appSecret: '',
      username: '',
      password: '',
      fallbackReason: `Production credentials not found (${missingCredentials.join(', ')}). Using Sandbox fallback.`,
    };
  }

  if (explicitEnv === 'sandbox') {
    const baseUrl = resolveValidEndpointUrl(customBaseUrl, BKASH_OFFICIAL_ENDPOINTS.sandbox);
    return {
      method: 'bKash',
      environment: 'sandbox',
      tier: 'vendor_sandbox',
      mode: 'live_api',
      liveConfigured: true,
      productionCredentialsFound: false,
      missingCredentials: [],
      baseUrl,
      endpointHost: extractHost(baseUrl),
      appKey,
      appSecret,
      username,
      password,
      fallbackReason: 'BKASH_ENV=sandbox active with official bKash sandbox credentials.',
    };
  }

  const baseUrl = resolveValidEndpointUrl(customBaseUrl, BKASH_OFFICIAL_ENDPOINTS.production);
  const resolvedAsSandboxUrl = baseUrl.includes('sandbox');

  return {
    method: 'bKash',
    environment: resolvedAsSandboxUrl ? 'sandbox' : 'production',
    tier: resolvedAsSandboxUrl ? 'vendor_sandbox' : 'production',
    mode: 'live_api',
    liveConfigured: true,
    productionCredentialsFound: !resolvedAsSandboxUrl,
    missingCredentials: [],
    baseUrl,
    endpointHost: extractHost(baseUrl),
    appKey,
    appSecret,
    username,
    password,
    ...(resolvedAsSandboxUrl
      ? { fallbackReason: 'Custom BKASH_BASE_URL points to bKash Sandbox API.' }
      : {}),
  };
}

export function resolveNagadGatewayConfig(
  env: Record<string, string | undefined>
): NagadResolvedConfig {
  const merchantId = readEnvStr(env, 'NAGAD_MERCHANT_ID');
  const merchantNumber = readEnvStr(env, 'NAGAD_MERCHANT_NUMBER') || merchantId;
  const rawPublicKey = readEnvStr(env, 'NAGAD_PUBLIC_KEY');
  const rawPrivateKey = readEnvStr(env, 'NAGAD_PRIVATE_KEY');

  const keyMap: Record<(typeof NAGAD_REQUIRED_CREDENTIAL_KEYS)[number], string> = {
    NAGAD_MERCHANT_ID: merchantId,
    NAGAD_PUBLIC_KEY: rawPublicKey,
    NAGAD_PRIVATE_KEY: rawPrivateKey,
  };

  const missingCredentials = NAGAD_REQUIRED_CREDENTIAL_KEYS.filter((k) => !keyMap[k]);
  const explicitEnv = parseOptionalEnvMode(readEnvStr(env, 'NAGAD_ENV'));
  const customBaseUrl = readEnvStr(env, 'NAGAD_BASE_URL');

  if (missingCredentials.length > 0) {
    const baseUrl = resolveValidEndpointUrl(customBaseUrl, NAGAD_OFFICIAL_ENDPOINTS.sandbox);
    return {
      method: 'Nagad',
      environment: 'sandbox',
      tier: 'sandbox_fallback',
      mode: 'sandbox',
      liveConfigured: false,
      productionCredentialsFound: false,
      missingCredentials,
      baseUrl,
      endpointHost: extractHost(baseUrl),
      merchantId: '',
      merchantNumber: '',
      publicKey: '',
      privateKey: '',
      fallbackReason: `Production credentials not found (${missingCredentials.join(', ')}). Using Sandbox fallback.`,
    };
  }

  const publicKeyValid = isLikelyValidRsaKeyBody(rawPublicKey);
  const privateKeyValid = isLikelyValidRsaKeyBody(rawPrivateKey);
  if (!publicKeyValid || !privateKeyValid) {
    const baseUrl = resolveValidEndpointUrl(customBaseUrl, NAGAD_OFFICIAL_ENDPOINTS.sandbox);
    const keyValidationError = !publicKeyValid
      ? 'NAGAD_PUBLIC_KEY is malformed or incomplete'
      : 'NAGAD_PRIVATE_KEY is malformed or incomplete';
    return {
      method: 'Nagad',
      environment: 'sandbox',
      tier: 'sandbox_fallback',
      mode: 'sandbox',
      liveConfigured: false,
      productionCredentialsFound: false,
      missingCredentials: [],
      baseUrl,
      endpointHost: extractHost(baseUrl),
      merchantId: '',
      merchantNumber: '',
      publicKey: '',
      privateKey: '',
      keyValidationError,
      fallbackReason: `${keyValidationError}. Falling back to Sandbox.`,
    };
  }

  const publicKey = formatPemKey(rawPublicKey, 'PUBLIC KEY');
  const privateKey = formatPemKey(rawPrivateKey, 'PRIVATE KEY');

  if (explicitEnv === 'sandbox') {
    const baseUrl = resolveValidEndpointUrl(customBaseUrl, NAGAD_OFFICIAL_ENDPOINTS.sandbox);
    return {
      method: 'Nagad',
      environment: 'sandbox',
      tier: 'vendor_sandbox',
      mode: 'live_api',
      liveConfigured: true,
      productionCredentialsFound: false,
      missingCredentials: [],
      baseUrl,
      endpointHost: extractHost(baseUrl),
      merchantId,
      merchantNumber,
      publicKey,
      privateKey,
      fallbackReason: 'NAGAD_ENV=sandbox active with official Nagad sandbox credentials.',
    };
  }

  const baseUrl = resolveValidEndpointUrl(customBaseUrl, NAGAD_OFFICIAL_ENDPOINTS.production);
  const resolvedAsSandboxUrl = baseUrl.includes('sandbox');

  return {
    method: 'Nagad',
    environment: resolvedAsSandboxUrl ? 'sandbox' : 'production',
    tier: resolvedAsSandboxUrl ? 'vendor_sandbox' : 'production',
    mode: 'live_api',
    liveConfigured: true,
    productionCredentialsFound: !resolvedAsSandboxUrl,
    missingCredentials: [],
    baseUrl,
    endpointHost: extractHost(baseUrl),
    merchantId,
    merchantNumber,
    publicKey,
    privateKey,
    ...(resolvedAsSandboxUrl
      ? { fallbackReason: 'Custom NAGAD_BASE_URL points to Nagad Sandbox API.' }
      : {}),
  };
}

export function resolveMerchantGatewayConfig(
  env: Record<string, string | undefined>
): MerchantGatewayConfig {
  return {
    bkash: resolveBkashGatewayConfig(env),
    nagad: resolveNagadGatewayConfig(env),
  };
}

export function getRailConfigForMethod(
  config: MerchantGatewayConfig,
  method: PaymentMethod
): BkashResolvedConfig | NagadResolvedConfig {
  return method === 'Nagad' ? config.nagad : config.bkash;
}

export function getPublicGatewayConfigPayload(
  config: MerchantGatewayConfig
): PublicGatewayConfigPayload {
  return {
    bkash: {
      liveConfigured: config.bkash.liveConfigured,
      productionCredentialsFound: config.bkash.productionCredentialsFound,
      environment: config.bkash.environment,
      tier: config.bkash.tier,
      mode: config.bkash.mode,
      endpointHost: config.bkash.endpointHost,
      missingCredentialKeys: config.bkash.missingCredentials,
      ...(config.bkash.fallbackReason ? { fallbackReason: config.bkash.fallbackReason } : {}),
    },
    nagad: {
      liveConfigured: config.nagad.liveConfigured,
      productionCredentialsFound: config.nagad.productionCredentialsFound,
      environment: config.nagad.environment,
      tier: config.nagad.tier,
      mode: config.nagad.mode,
      endpointHost: config.nagad.endpointHost,
      missingCredentialKeys: config.nagad.missingCredentials,
      ...(config.nagad.fallbackReason ? { fallbackReason: config.nagad.fallbackReason } : {}),
    },
    sandboxAvailable: true,
  };
}
