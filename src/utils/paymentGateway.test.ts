import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOnlinePaymentProofNote,
  buildQrMatrix,
  createSandboxSessionPayload,
  formatGatewaySessionSummary,
  parseGatewayCallbackParams,
  sanitizeMerchantPaymentLink,
  validateBdWalletNumber,
  validateTrxId,
  verifySandboxPaymentPayload,
} from './paymentGateway.ts';

test('validateBdWalletNumber normalizes +880 and validates Bangladesh mobile numbers', () => {
  assert.deepEqual(validateBdWalletNumber('+880 1755-842190'), {
    valid: true,
    normalized: '01755842190',
  });
  assert.deepEqual(validateBdWalletNumber('01819445566'), {
    valid: true,
    normalized: '01819445566',
  });
  assert.equal(validateBdWalletNumber('01112345678').valid, false);
  assert.equal(validateBdWalletNumber('12345').valid, false);
});

test('validateTrxId accepts valid bKash and Nagad transaction IDs', () => {
  assert.deepEqual(validateTrxId('bl8a4k92p1'), {
    valid: true,
    normalized: 'BL8A4K92P1',
  });
  assert.equal(validateTrxId('73918264').valid, true);
  assert.equal(validateTrxId('123').valid, false);
});

test('buildOnlinePaymentProofNote formats structured proof within blueprint limits', () => {
  const note = buildOnlinePaymentProofNote({
    method: 'bKash',
    senderNumber: '01711-223344',
    trxId: 'bl8a4k92p1',
    amount: 1470,
    dealId: 'deal_1234567890',
    mode: 'online_checkout',
  });
  assert.ok(note.includes('[bKash Real-Time Checkout]'));
  assert.ok(note.includes('TrxID: BL8A4K92P1'));
  assert.ok(note.includes('From: 01711223344'));
  assert.ok(note.includes('Tk 1,470'));
});

test('sanitizeMerchantPaymentLink only permits https links', () => {
  assert.equal(
    sanitizeMerchantPaymentLink('https://shop.bkash.com/dealkoro01755842190/paymentlink'),
    'https://shop.bkash.com/dealkoro01755842190/paymentlink'
  );
  assert.equal(sanitizeMerchantPaymentLink('javascript:alert(1)'), '');
  assert.equal(sanitizeMerchantPaymentLink('http://insecure.example.com'), '');
});

test('buildQrMatrix generates a deterministic 21x21 boolean grid', () => {
  const m1 = buildQrMatrix('bkash://pay?to=01755842190&amount=1470');
  const m2 = buildQrMatrix('bkash://pay?to=01755842190&amount=1470');
  assert.equal(m1.length, 21);
  assert.equal(m1[0].length, 21);
  assert.deepEqual(m1, m2);
  // Finder top-left corner should be filled
  assert.equal(m1[0][0], true);
  assert.equal(m1[3][3], true);
});

test('createSandboxSessionPayload & verifySandboxPaymentPayload handle real-time OTP/PIN verification', () => {
  const session = createSandboxSessionPayload({
    dealId: 'deal_2000_active',
    buyerId: 'user_salim',
    method: 'Nagad',
    amount: 2110,
  });
  assert.equal(session.method, 'Nagad');
  assert.equal(session.mode, 'sandbox');
  assert.equal(session.status, 'initiated');
  assert.ok(session.gatewayPaymentId.startsWith('NGPGW_'));

  const badOtp = verifySandboxPaymentPayload({
    session,
    walletNumber: '01819445566',
    otp: '000000',
    pin: '1234',
  });
  assert.equal(badOtp.ok, false);

  const okRes = verifySandboxPaymentPayload({
    session,
    walletNumber: '+8801819445566',
    otp: '123456',
    pin: '4321',
  });
  assert.equal(okRes.ok, true);
  assert.equal(okRes.session?.status, 'verified');
  assert.ok(okRes.trxId?.startsWith('NG'));
  assert.equal(okRes.session?.senderMasked, '018****5566');
  assert.ok(formatGatewaySessionSummary(okRes.session!).includes('Nagad Sandbox Gateway'));
});

test('parseGatewayCallbackParams extracts bKash and Nagad callback tokens', () => {
  const bkashCb = parseGatewayCallbackParams('?paymentID=TR00112233&status=success&gateway=bKash');
  assert.deepEqual(bkashCb, {
    paymentID: 'TR00112233',
    paymentRefId: undefined,
    status: 'success',
    method: 'bKash',
  });
  assert.equal(parseGatewayCallbackParams('?foo=bar'), null);
});
