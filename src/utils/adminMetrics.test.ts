import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRecentPlatformActivity,
  computeAdminDashboardMetrics,
  isActiveDeal,
  isPendingPayoutDeal,
} from './adminMetrics.ts';
import { SEED_DEALS, SEED_LISTINGS, SEED_NOTIFICATIONS, SEED_STATEMENTS } from '../data/seedData.ts';
import type { AdminDeal } from '../types/dealkoro.ts';

function makeDeal(overrides: Partial<AdminDeal>): AdminDeal {
  return {
    ...SEED_DEALS[0],
    id: 'deal_test',
    status: 'payment_received',
    agreedAmount: 2000,
    serviceType: 'ultimate_safe',
    serviceFee: 60,
    buyerMethod: 'Nagad',
    sellerMethod: 'bKash',
    crossDealRequired: true,
    crossDealAccepted: true,
    crossDealFee: 30,
    iosCheck: true,
    googleBindCheck: false,
    verificationFee: 20,
    totalAmount: 2110,
    buyerInitialDone: true,
    sellerExchanged: false,
    ...overrides,
  };
}

test('isActiveDeal excludes done and cancelled deals', () => {
  assert.equal(isActiveDeal(makeDeal({ status: 'payment_received' })), true);
  assert.equal(isActiveDeal(makeDeal({ status: 'confirming' })), true);
  assert.equal(isActiveDeal(makeDeal({ status: 'done' })), false);
  assert.equal(isActiveDeal(makeDeal({ status: 'cancelled' })), false);
});

test('isPendingPayoutDeal identifies deals awaiting seller release', () => {
  assert.equal(isPendingPayoutDeal(makeDeal({ status: 'payment_received' })), true);
  assert.equal(isPendingPayoutDeal(makeDeal({ status: 'id_exchange' })), true);
  assert.equal(isPendingPayoutDeal(makeDeal({ status: 'confirming', buyerInitialDone: false })), false);
  assert.equal(isPendingPayoutDeal(makeDeal({ status: 'done', buyerInitialDone: true })), false);
});

test('computeAdminDashboardMetrics aggregates active deals, pending payouts, and fee income', () => {
  const activeDeal = makeDeal({ id: 'deal_active_1', status: 'id_exchange', agreedAmount: 2000 });
  const doneDeal = makeDeal({ id: 'deal_done_1', status: 'done', agreedAmount: 1400 });

  const metrics = computeAdminDashboardMetrics({
    deals: [activeDeal, doneDeal],
    statements: SEED_STATEMENTS,
    listings: SEED_LISTINGS,
  });

  assert.equal(metrics.activeDealsCount, 1);
  assert.equal(metrics.activeEscrowVolume, 2110);
  assert.equal(metrics.pendingPayoutsCount, 1);
  assert.equal(metrics.pendingPayoutAmount, 2000);
  assert.equal(metrics.completedDealsCount, 1);
  assert.equal(metrics.releasedFeeIncome, 70);
  assert.equal(metrics.projectedActiveFees, 110);
  assert.equal(metrics.activeListingsCount, SEED_LISTINGS.length);
});

test('buildRecentPlatformActivity sorts mixed events descending by timestamp', () => {
  const activity = buildRecentPlatformActivity({
    deals: SEED_DEALS,
    listings: SEED_LISTINGS,
    statements: SEED_STATEMENTS,
    notifications: SEED_NOTIFICATIONS,
    limit: 5,
  });

  assert.equal(activity.length, 5);
  assert.ok(Date.parse(activity[0].timestamp) >= Date.parse(activity[1].timestamp));
});
