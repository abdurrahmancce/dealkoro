import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDealBreakdown,
  computeStatementSummary,
  filterListingsByQuery,
  formatTk,
  validatePostInput,
} from './dealMath';
import type { Listing, StatementEntry } from '../types/dealkoro';

test('wireframe Screen 23 exact arithmetic: 1400 + 30 Cross Deal + 20 iOS + 20 Google Bind = 1470', () => {
  const result = calculateDealBreakdown({
    agreedAmount: 1400,
    serviceType: 'normal',
    buyerMethod: 'Nagad',
    sellerMethod: 'bKash',
    crossDealAccepted: true,
    iosCheck: true,
    googleBindCheck: true,
  });

  assert.equal(result.crossDealRequired, true);
  assert.equal(result.crossDealFee, 30);
  assert.equal(result.serviceFee, 0);
  assert.equal(result.iosCheckFee, 20);
  assert.equal(result.googleBindCheckFee, 20);
  assert.equal(result.platformTotalFee, 70);
  assert.equal(result.totalPayable, 1470);
  assert.equal(result.sellerNetPayout, 1400);
});

test('same payment method uses Normal Deal 20/- without Cross Deal fee', () => {
  const result = calculateDealBreakdown({
    agreedAmount: 2000,
    serviceType: 'normal',
    buyerMethod: 'bKash',
    sellerMethod: 'bKash',
    crossDealAccepted: false,
    iosCheck: false,
    googleBindCheck: false,
  });

  assert.equal(result.crossDealRequired, false);
  assert.equal(result.serviceFee, 20);
  assert.equal(result.totalPayable, 2020);
});

test('Ultimate Safe Deal adds 60/- plus optional Cross Deal 30/-', () => {
  const result = calculateDealBreakdown({
    agreedAmount: 2500,
    serviceType: 'ultimate_safe',
    buyerMethod: 'bKash',
    sellerMethod: 'Nagad',
    crossDealAccepted: true,
    iosCheck: true,
    googleBindCheck: false,
  });

  assert.equal(result.serviceFee, 60);
  assert.equal(result.crossDealFee, 30);
  assert.equal(result.verificationFee, 20);
  assert.equal(result.totalPayable, 2610);
});

test('formatTk formats currency cleanly', () => {
  assert.equal(formatTk(1470), 'Tk 1,470');
  assert.equal(formatTk(2000), 'Tk 2,000');
});

test('filterListingsByQuery matches title, category, and seller case-insensitively', () => {
  const sample: Listing[] = [
    {
      id: 'l1',
      sellerId: 'u1',
      sellerName: 'Abdullah',
      category: 'eFootball',
      title: 'Rummi Neymar',
      description: '3250 squad',
      imageUrl: '',
      paidCount: '4',
      linkType: 'Only Konami',
      server: 'Bangladesh',
      limitInfo: '7',
      price: 1500,
      rating: 4.5,
      status: 'active',
      createdAt: '2026-11-01T00:00:00Z',
    },
    {
      id: 'l2',
      sellerId: 'u2',
      sellerName: 'Salim',
      category: 'PUBG Mobile',
      title: 'Glacier M416 Max',
      description: 'RP maxed',
      imageUrl: '',
      paidCount: '12',
      linkType: 'Konami + Glink',
      server: 'Asia',
      limitInfo: '3',
      price: 3200,
      rating: 5,
      status: 'active',
      createdAt: '2026-11-02T00:00:00Z',
    },
  ];

  assert.equal(filterListingsByQuery(sample, 'rummi').length, 1);
  assert.equal(filterListingsByQuery(sample, 'glacier').length, 1);
  assert.equal(filterListingsByQuery(sample, '').length, 2);
});

test('computeStatementSummary aggregates sell income, admin fees, and buy payments', () => {
  const entries: StatementEntry[] = [
    {
      id: 's1',
      userId: 'u1',
      dealId: 'd1',
      title: 'Rummi Neymar Sold',
      type: 'sell_income',
      amount: 1400,
      feeAmount: 0,
      netAmount: 1400,
      method: 'bKash',
      createdAt: '2026-11-10T00:00:00Z',
    },
    {
      id: 's2',
      userId: 'u1',
      dealId: 'd2',
      title: 'Admin Escrow Fee',
      type: 'admin_fee_income',
      amount: 70,
      feeAmount: 0,
      netAmount: 70,
      method: 'Nagad',
      createdAt: '2026-11-11T00:00:00Z',
    },
    {
      id: 's3',
      userId: 'u1',
      dealId: 'd3',
      title: 'Purchased Squad',
      type: 'buy_payment',
      amount: 1000,
      feeAmount: 20,
      netAmount: 1020,
      method: 'bKash',
      createdAt: '2026-11-12T00:00:00Z',
    },
  ];

  const summary = computeStatementSummary(entries);
  assert.equal(summary.totalSellIncome, 1400);
  assert.equal(summary.totalAdminIncome, 70);
  assert.equal(summary.totalBuySpend, 1000);
  assert.equal(summary.netBalance, 470);
});

test('validatePostInput rejects invalid titles and prices', () => {
  assert.equal(validatePostInput({ title: 'A', priceText: '1500' }).valid, false);
  assert.equal(validatePostInput({ title: 'Rummi Neymar', priceText: '0' }).valid, false);
  assert.deepEqual(validatePostInput({ title: 'Rummi Neymar', priceText: '1500/-' }), {
    valid: true,
    price: 1500,
  });
});
