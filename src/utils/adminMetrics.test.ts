import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRecentPlatformActivity,
  compute30DayAdminFeeTrend,
  computeAdminDashboardMetrics,
  computeCategoryFeeBreakdown,
  computeDailyAdminFeeTrend,
  createDateRangePreset,
  isActiveDeal,
  isPendingPayoutDeal,
  validateDateRange,
} from './adminMetrics.ts';
import { SEED_DEALS, SEED_LISTINGS, SEED_NOTIFICATIONS, SEED_STATEMENTS } from '../data/seedData.ts';
import type { AdminDeal, StatementEntry } from '../types/dealkoro.ts';

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

test('computeCategoryFeeBreakdown sums released and pending escrow fees by category consistently with KPI totals', () => {
  const pubgDeal = makeDeal({
    id: 'deal_pubg_active',
    listingId: 'listing_pubg_glacier',
    listingTitle: 'Glacier M416 Lv.5 + Conqueror Frame',
    status: 'id_exchange',
    serviceType: 'normal',
    crossDealAccepted: false,
    iosCheck: false,
    googleBindCheck: true,
  });
  const deletedFfDeal = makeDeal({
    id: 'deal_ff_done',
    listingId: 'deleted_listing_ff',
    listingTitle: 'Free Fire Booyah Max Cobra',
    status: 'done',
  });
  const extraStmt: StatementEntry = {
    id: 'stmt_ff_1',
    userId: 'admin_abdur',
    dealId: 'deal_ff_done',
    title: 'Escrow Fee Income: Free Fire Booyah',
    type: 'admin_fee_income',
    amount: 60,
    feeAmount: 0,
    netAmount: 60,
    method: 'bKash',
    createdAt: '2026-11-18T08:00:00Z',
  };

  const deals = [...SEED_DEALS, pubgDeal, deletedFfDeal];
  const statements = [...SEED_STATEMENTS, extraStmt];
  const metrics = computeAdminDashboardMetrics({
    deals,
    statements,
    listings: SEED_LISTINGS,
  });
  const breakdown = computeCategoryFeeBreakdown({
    deals,
    listings: SEED_LISTINGS,
    statements,
  });

  const totalReleased = breakdown.reduce((s, r) => s + r.releasedFee, 0);
  const totalPending = breakdown.reduce((s, r) => s + r.pendingFee, 0);
  assert.equal(totalReleased, metrics.releasedFeeIncome);
  assert.equal(totalPending, metrics.projectedActiveFees);

  const efootball = breakdown.find((r) => r.category === 'eFootball');
  const pubg = breakdown.find((r) => r.category === 'PUBG Mobile');
  const ff = breakdown.find((r) => r.category === 'Free Fire');

  assert.equal(efootball?.releasedFee, 70);
  assert.equal(efootball?.pendingFee, 110);
  assert.equal(efootball?.dealCount, 2);
  assert.equal(pubg?.pendingFee, 40); // Normal (20) + Google Bind (20)
  assert.equal(ff?.releasedFee, 60);
  assert.ok(breakdown[0].totalFee >= breakdown[1].totalFee);
});

test('compute30DayAdminFeeTrend maps statement revenue into a 30-day UTC series', () => {
  const ref = new Date('2026-11-18T12:00:00Z');
  const trend = compute30DayAdminFeeTrend(SEED_STATEMENTS, ref);

  assert.equal(trend.length, 30);
  const nov16 = trend.find((p) => p.dateKey === '2026-11-16');
  assert.equal(nov16?.releasedFee, 70);
  assert.equal(nov16?.dealVolume, 1400);
  assert.equal(nov16?.entryCount, 1);
});

test('createDateRangePreset and validateDateRange build and validate UTC date windows', () => {
  const ref = new Date('2026-11-18T12:00:00Z');
  const r7 = createDateRangePreset('7d', SEED_STATEMENTS, SEED_DEALS, ref);
  assert.deepEqual(r7, {
    preset: '7d',
    startDate: '2026-11-12',
    endDate: '2026-11-18',
  });

  const invalid = validateDateRange('2026-11-20', '2026-11-10');
  assert.equal(invalid.valid, false);
  assert.ok(invalid.error);

  const valid = validateDateRange('2026-11-10', '2026-11-18');
  assert.equal(valid.valid, true);
});

test('date range filters both computeCategoryFeeBreakdown and computeDailyAdminFeeTrend', () => {
  const oldStmt: StatementEntry = {
    id: 'stmt_old_oct',
    userId: 'admin_abdur',
    dealId: 'deal_old_1',
    title: 'Escrow Fee Income: PUBG Old',
    type: 'admin_fee_income',
    amount: 90,
    feeAmount: 0,
    netAmount: 90,
    method: 'Nagad',
    createdAt: '2026-10-05T10:00:00Z',
  };
  const statements = [...SEED_STATEMENTS, oldStmt];

  const novOnlyBreakdown = computeCategoryFeeBreakdown({
    deals: SEED_DEALS,
    listings: SEED_LISTINGS,
    statements,
    startDate: '2026-11-17',
    endDate: '2026-11-18',
  });
  const totalNovReleased = novOnlyBreakdown.reduce((s, r) => s + r.releasedFee, 0);
  const totalNovPending = novOnlyBreakdown.reduce((s, r) => s + r.pendingFee, 0);
  assert.equal(totalNovReleased, 0); // stmt_3 is Nov 16
  assert.equal(totalNovPending, 110); // deal_2000_active is Nov 18

  const novTrend = computeDailyAdminFeeTrend(statements, {
    startDate: '2026-11-15',
    endDate: '2026-11-18',
  });
  assert.equal(novTrend.length, 4);
  assert.equal(novTrend.find((p) => p.dateKey === '2026-11-16')?.releasedFee, 70);
  assert.equal(novTrend.find((p) => p.dateKey === '2026-10-05'), undefined);

  const futureEmpty = computeCategoryFeeBreakdown({
    deals: SEED_DEALS,
    listings: SEED_LISTINGS,
    statements,
    startDate: '2026-12-01',
    endDate: '2026-12-10',
  });
  assert.equal(futureEmpty.reduce((s, r) => s + r.totalFee, 0), 0);
});
