import crypto from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BKASH_OFFICIAL_ENDPOINTS,
  NAGAD_OFFICIAL_ENDPOINTS,
  getPublicGatewayConfigPayload,
  isValidBkashStatusCode,
  normalizeIpv4,
  resolveMerchantGatewayConfig,
} from './merchantGatewayConfig.ts';
import {
  clearBkashTokenCache,
  createBkashLiveSession,
  createNagadLiveSession,
  executeBkashLivePayment,
  formatNagadDhakaDateTime,
  verifyNagadLivePayment,
} from '../server/bkashNagadGateway.ts';

test('resolveMerchantGatewayConfig falls back to Sandbox when production credentials are missing', () => {
  const cfg = resolveMerchantGatewayConfig({});

  assert.equal(cfg.bkash.liveConfigured, false);
  assert.equal(cfg.bkash.productionCredentialsFound, false);
  assert.equal(cfg.bkash.environment, 'sandbox');
  assert.equal(cfg.bkash.tier, 'sandbox_fallback');
  assert.equal(cfg.bkash.mode, 'sandbox');
  assert.deepEqual(cfg.bkash.missingCredentials, [
    'BKASH_APP_KEY',
    'BKASH_APP_SECRET',
    'BKASH_USERNAME',
    'BKASH_PASSWORD',
  ]);

  assert.equal(cfg.nagad.liveConfigured, false);
  assert.equal(cfg.nagad.productionCredentialsFound, false);
  assert.equal(cfg.nagad.environment, 'sandbox');
  assert.equal(cfg.nagad.tier, 'sandbox_fallback');
  assert.equal(cfg.nagad.mode, 'sandbox');
  assert.deepEqual(cfg.nagad.missingCredentials, [
    'NAGAD_MERCHANT_ID',
    'NAGAD_PUBLIC_KEY',
    'NAGAD_PRIVATE_KEY',
  ]);

  const publicPayload = getPublicGatewayConfigPayload(cfg);
  assert.equal(publicPayload.sandboxAvailable, true);
  assert.equal(publicPayload.bkash.mode, 'sandbox');
  assert.equal(publicPayload.nagad.mode, 'sandbox');
  assert.equal('appSecret' in publicPayload.bkash, false);
  assert.equal('privateKey' in publicPayload.nagad, false);
});

test('resolveMerchantGatewayConfig activates Production API when credentials exist and allows explicit sandbox override', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const prodCfg = resolveMerchantGatewayConfig({
    BKASH_APP_KEY: 'bk_app_key_live',
    BKASH_APP_SECRET: 'bk_app_secret_live',
    BKASH_USERNAME: 'dealkoro_merchant',
    BKASH_PASSWORD: 'strong_password',
    NAGAD_MERCHANT_ID: '683002007104225',
    NAGAD_MERCHANT_NUMBER: '01755842190',
    NAGAD_PUBLIC_KEY: publicKey,
    NAGAD_PRIVATE_KEY: privateKey,
  });

  assert.equal(prodCfg.bkash.liveConfigured, true);
  assert.equal(prodCfg.bkash.productionCredentialsFound, true);
  assert.equal(prodCfg.bkash.environment, 'production');
  assert.equal(prodCfg.bkash.tier, 'production');
  assert.equal(prodCfg.bkash.mode, 'live_api');
  assert.equal(prodCfg.bkash.baseUrl, BKASH_OFFICIAL_ENDPOINTS.production);

  assert.equal(prodCfg.nagad.liveConfigured, true);
  assert.equal(prodCfg.nagad.productionCredentialsFound, true);
  assert.equal(prodCfg.nagad.environment, 'production');
  assert.equal(prodCfg.nagad.tier, 'production');
  assert.equal(prodCfg.nagad.mode, 'live_api');
  assert.equal(prodCfg.nagad.baseUrl, NAGAD_OFFICIAL_ENDPOINTS.production);
  assert.equal(prodCfg.nagad.merchantNumber, '01755842190');

  const vendorSandboxCfg = resolveMerchantGatewayConfig({
    BKASH_ENV: 'sandbox',
    BKASH_APP_KEY: 'bk_sbx_key',
    BKASH_APP_SECRET: 'bk_sbx_secret',
    BKASH_USERNAME: 'sandboxTokenizedUser02',
    BKASH_PASSWORD: 'sandboxTokenizedUser02@12345',
    NAGAD_ENV: 'sandbox',
    NAGAD_MERCHANT_ID: '683002007104225',
    NAGAD_PUBLIC_KEY: publicKey,
    NAGAD_PRIVATE_KEY: privateKey,
  });

  assert.equal(vendorSandboxCfg.bkash.tier, 'vendor_sandbox');
  assert.equal(vendorSandboxCfg.bkash.mode, 'live_api');
  assert.equal(vendorSandboxCfg.bkash.baseUrl, BKASH_OFFICIAL_ENDPOINTS.sandbox);
  assert.equal(vendorSandboxCfg.nagad.tier, 'vendor_sandbox');
  assert.equal(vendorSandboxCfg.nagad.mode, 'live_api');
  assert.equal(vendorSandboxCfg.nagad.baseUrl, NAGAD_OFFICIAL_ENDPOINTS.sandbox);
});

test('resolveMerchantGatewayConfig safely falls back to sandbox on malformed Nagad RSA keys', () => {
  const cfg = resolveMerchantGatewayConfig({
    NAGAD_MERCHANT_ID: '683002007104225',
    NAGAD_PUBLIC_KEY: 'short-invalid-key',
    NAGAD_PRIVATE_KEY: 'also-invalid',
  });
  assert.equal(cfg.nagad.liveConfigured, false);
  assert.equal(cfg.nagad.tier, 'sandbox_fallback');
  assert.equal(cfg.nagad.mode, 'sandbox');
  assert.ok(cfg.nagad.keyValidationError?.includes('malformed'));
});

test('normalizeIpv4 & isValidBkashStatusCode enforce strict protocol formatting', () => {
  assert.equal(normalizeIpv4('::1'), '127.0.0.1');
  assert.equal(normalizeIpv4('::ffff:103.45.12.9'), '103.45.12.9');
  assert.equal(normalizeIpv4('203.76.110.4, 10.0.0.1'), '203.76.110.4');
  assert.equal(normalizeIpv4('999.0.0.1'), '127.0.0.1');
  assert.equal(isValidBkashStatusCode('0000'), true);
  assert.equal(isValidBkashStatusCode('2023'), false);
});

test('official bKash Tokenized Checkout client caches token, handles 2062 query fallback, and verifies amount', async () => {
  clearBkashTokenCache();
  const cfg = resolveMerchantGatewayConfig({
    BKASH_APP_KEY: 'app_key_1',
    BKASH_APP_SECRET: 'app_secret_1',
    BKASH_USERNAME: 'merchant_1',
    BKASH_PASSWORD: 'password_1',
  }).bkash;

  let grantCalls = 0;
  let queryCalls = 0;

  const mockFetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith('/tokenized/checkout/token/grant')) {
      grantCalls += 1;
      return new Response(
        JSON.stringify({
          id_token: 'tok_live_123',
          refresh_token: 'ref_live_456',
          expires_in: 3600,
          statusCode: '0000',
        }),
        { status: 200 }
      );
    }
    if (url.endsWith('/tokenized/checkout/create')) {
      return new Response(
        JSON.stringify({
          paymentID: 'TR0011TEST99',
          bkashURL: 'https://shop.bkash.com/checkout/TR0011TEST99',
          statusCode: '0000',
        }),
        { status: 200 }
      );
    }
    if (url.endsWith('/tokenized/checkout/execute')) {
      // Simulate already-completed status code 2062 triggering status query
      return new Response(
        JSON.stringify({
          statusCode: '2062',
          statusMessage: 'The payment has already been completed',
        }),
        { status: 200 }
      );
    }
    if (url.endsWith('/tokenized/checkout/payment/status')) {
      queryCalls += 1;
      return new Response(
        JSON.stringify({
          statusCode: '0000',
          transactionStatus: 'Completed',
          trxID: 'BK9X887766',
          amount: '1500',
          currency: 'BDT',
          customerMsisdn: '017****9900',
        }),
        { status: 200 }
      );
    }
    throw new Error(`Unexpected URL: ${url}`);
  }) as typeof fetch;

  const session = await createBkashLiveSession(
    cfg,
    {
      dealId: 'deal_bk_1',
      sessionId: 'ps_123',
      amount: 1500,
      callbackUrl: 'https://dealkoro.app/?gateway=bKash&dealId=deal_bk_1&sessionId=ps_123',
    },
    mockFetch
  );
  assert.equal(session.paymentID, 'TR0011TEST99');
  assert.equal(grantCalls, 1);

  const verified = await executeBkashLivePayment(
    cfg,
    { paymentID: 'TR0011TEST99', expectedAmount: 1500 },
    mockFetch
  );
  assert.equal(verified.trxID, 'BK9X887766');
  assert.equal(verified.customerMsisdn, '017****9900');
  assert.equal(grantCalls, 1); // Token served from cache
  assert.equal(queryCalls, 1);

  await assert.rejects(
    executeBkashLivePayment(
      cfg,
      { paymentID: 'TR0011TEST99', expectedAmount: 2500 },
      mockFetch
    ),
    /below expected deal total/
  );
});

test('official Nagad Remote PGW client performs RSA initialize/complete and payment verification', async () => {
  // Merchant RSA pair and Nagad PGW RSA pair
  const merchantKeys = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const pgwKeys = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const cfg = resolveMerchantGatewayConfig({
    NAGAD_MERCHANT_ID: '683002007104225',
    NAGAD_PUBLIC_KEY: pgwKeys.publicKey,
    NAGAD_PRIVATE_KEY: merchantKeys.privateKey,
  }).nagad;

  assert.match(formatNagadDhakaDateTime(), /^\d{14}$/);

  const mockFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const headers = (init?.headers || {}) as Record<string, string>;
    assert.equal(headers['X-KM-Api-Version'], 'v-0.2.0');
    assert.equal(headers['X-KM-IP-V4'], '127.0.0.1');

    if (url.includes('/check-out/initialize/')) {
      const body = JSON.parse(String(init?.body)) as { sensitiveData: string };
      const decryptedReq = JSON.parse(
        crypto
          .privateDecrypt(
            { key: pgwKeys.privateKey, padding: crypto.constants.RSA_PKCS1_PADDING },
            Buffer.from(body.sensitiveData, 'base64')
          )
          .toString('utf8')
      ) as { merchantId: string; orderId: string };
      assert.equal(decryptedReq.merchantId, '683002007104225');

      const respPayload = JSON.stringify({
        paymentReferenceId: 'NGREF_998877',
        challenge: 'chal_abc_123',
      });
      const encryptedResp = crypto
        .publicEncrypt(
          { key: merchantKeys.publicKey, padding: crypto.constants.RSA_PKCS1_PADDING },
          Buffer.from(respPayload, 'utf8')
        )
        .toString('base64');

      return new Response(JSON.stringify({ sensitiveData: encryptedResp }), { status: 200 });
    }

    if (url.includes('/check-out/complete/NGREF_998877')) {
      return new Response(
        JSON.stringify({
          status: 'Success',
          callBackUrl: 'https://api.mynagad.com/checkout/NGREF_998877',
        }),
        { status: 200 }
      );
    }

    if (url.includes('/verify/payment/NGREF_998877')) {
      return new Response(
        JSON.stringify({
          status: 'Success',
          issuerPaymentRefNo: 'NG77665544',
          clientMobileNo: '018****4455',
          amount: '2100',
        }),
        { status: 200 }
      );
    }

    throw new Error(`Unexpected Nagad URL: ${url}`);
  }) as typeof fetch;

  const created = await createNagadLiveSession(
    cfg,
    {
      dealId: 'deal_ng_1',
      sessionId: 'ps_ng_1',
      amount: 2100,
      callbackUrl: 'https://dealkoro.app/?gateway=Nagad&dealId=deal_ng_1&sessionId=ps_ng_1',
      clientIp: '::1',
    },
    mockFetch
  );
  assert.equal(created.paymentRefId, 'NGREF_998877');
  assert.equal(created.redirectUrl, 'https://api.mynagad.com/checkout/NGREF_998877');

  const verified = await verifyNagadLivePayment(
    cfg,
    { paymentRefId: 'NGREF_998877', expectedAmount: 2100, clientIp: '::1' },
    mockFetch
  );
  assert.equal(verified.trxID, 'NG77665544');
  assert.equal(verified.clientMobileNo, '018****4455');

  await assert.rejects(
    verifyNagadLivePayment(
      cfg,
      { paymentRefId: 'NGREF_998877', expectedAmount: 3000, clientIp: '::1' },
      mockFetch
    ),
    /below expected deal total/
  );
});
