import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BLUEPRINT_LIMITS,
  buildSearchTermDocId,
  clampPrice,
  clampText,
  formatEscrowPaymentContact,
  normalizeSearchTerm,
  sanitizeId,
  sanitizeImageUrl,
  sanitizePlatformConfig,
} from './payloadSanitizer.ts';
import { ASSETS } from '../data/seedData.ts';

test('sanitizeId strips traversal and invalid characters within 128 chars', () => {
  assert.equal(sanitizeId('../../etc/passwd'), '______etc_passwd');
  const huge = 'a'.repeat(300);
  assert.equal(sanitizeId(huge).length, BLUEPRINT_LIMITS.ID_MAX);
  assert.match(sanitizeId('deal:123/abc'), /^[a-zA-Z0-9_\-]+$/);
});

test('sanitizeImageUrl allows bounded compressed raster data URLs and rejects oversized or SVG data URLs', () => {
  const boundedDataUrl = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=';
  assert.equal(sanitizeImageUrl(boundedDataUrl), boundedDataUrl);
  assert.equal(
    sanitizeImageUrl('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='),
    ASSETS.efootballSquad
  );
  assert.equal(
    sanitizeImageUrl(`data:image/jpeg;base64,${'A'.repeat(BLUEPRINT_LIMITS.IMAGE_DATA_URL_MAX + 50)}`),
    ASSETS.efootballSquad
  );
  assert.equal(
    sanitizeImageUrl('https://firebasestorage.googleapis.com/v0/b/test/o/a.jpg'),
    'https://firebasestorage.googleapis.com/v0/b/test/o/a.jpg'
  );
  assert.equal(
    sanitizeImageUrl(`https://example.com/${'x'.repeat(600)}`),
    ASSETS.efootballSquad
  );
});

test('clampText and clampPrice enforce blueprint limits', () => {
  assert.equal(clampText('x'.repeat(500), 120).length, 120);
  assert.equal(clampPrice(-50), 0);
  assert.equal(clampPrice(9_999_999), 1_000_000);
});

test('sanitizePlatformConfig and formatEscrowPaymentContact respect length limits', () => {
  const cfg = sanitizePlatformConfig({
    bkashNumber: '  01711-000111  ',
    nagadNumber: '01822-333444',
    escrowLabel: 'DEALKORO Personal',
  });
  assert.equal(cfg.bkashNumber, '01711-000111');
  assert.equal(
    formatEscrowPaymentContact(cfg, 'Nagad'),
    'Nagad: 01822-333444 (DEALKORO Personal)'
  );
  assert.ok(formatEscrowPaymentContact(cfg).length <= BLUEPRINT_LIMITS.TITLE_MAX);
});

test('normalizeSearchTerm and buildSearchTermDocId produce deterministic valid Firestore IDs', () => {
  assert.equal(normalizeSearchTerm('  Ronaldo   3250 '), 'ronaldo 3250');
  const idA = buildSearchTermDocId('  Ronaldo   3250 ');
  const idB = buildSearchTermDocId('ronaldo 3250');
  assert.equal(idA, idB);
  assert.match(idA, /^[a-zA-Z0-9_\-]+$/);
  assert.ok(idA.length <= BLUEPRINT_LIMITS.ID_MAX);
  const unicodeId = buildSearchTermDocId('রোনালদো অ্যাকাউন্ট');
  assert.match(unicodeId, /^[a-zA-Z0-9_\-]+$/);
});
