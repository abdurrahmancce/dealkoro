import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOnlinePaymentProofNote,
  buildQrMatrix,
  sanitizeMerchantPaymentLink,
  validateBdWalletNumber,
  validateTrxId,
} from './paymentGateway';

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
