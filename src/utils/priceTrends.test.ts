import test from 'node:test';
import assert from 'node:assert/strict';
import { build30DayPriceTrend } from './priceTrends';
import type { Listing } from '../types/dealkoro';

const SAMPLE_LISTINGS: Listing[] = [
  {
    id: 'l1',
    sellerId: 'u1',
    sellerName: 'Seller A',
    category: 'eFootball',
    title: 'Squad 1',
    description: 'Desc',
    imageUrl: '',
    paidCount: '4',
    linkType: 'Only Konami',
    server: 'Bangladesh',
    limitInfo: '7',
    price: 1500,
    rating: 4.5,
    status: 'active',
    createdAt: '2026-11-10T10:00:00Z',
  },
  {
    id: 'l2',
    sellerId: 'u2',
    sellerName: 'Seller B',
    category: 'eFootball',
    title: 'Squad 2',
    description: 'Desc',
    imageUrl: '',
    paidCount: '6',
    linkType: 'Konami + Glink',
    server: 'Bangladesh',
    limitInfo: '5',
    price: 2500,
    rating: 5,
    status: 'active',
    createdAt: '2026-11-17T10:00:00Z',
  },
  {
    id: 'l3',
    sellerId: 'u3',
    sellerName: 'Seller C',
    category: 'PUBG Mobile',
    title: 'Glacier M416',
    description: 'Desc',
    imageUrl: '',
    paidCount: '8',
    linkType: 'Konami + Glink',
    server: 'Asia',
    limitInfo: '4',
    price: 3200,
    rating: 4.9,
    status: 'active',
    createdAt: '2026-11-12T10:00:00Z',
  },
];

test('build30DayPriceTrend produces 30 daily points and accurate category average', () => {
  const ref = new Date('2026-11-18T12:00:00Z');
  const trend = build30DayPriceTrend(SAMPLE_LISTINGS, 'eFootball', ref);

  assert.equal(trend.points.length, 30);
  assert.equal(trend.sampleCount, 2);
  assert.equal(trend.minPrice, 1500);
  assert.equal(trend.maxPrice, 2500);
  assert.equal(trend.currentAvg, 2000);
  assert.equal(trend.points[29].dateKey, '2026-11-18');
});

test('build30DayPriceTrend returns empty trend when category has no listings', () => {
  const ref = new Date('2026-11-18T12:00:00Z');
  const trend = build30DayPriceTrend(SAMPLE_LISTINGS, 'Free Fire', ref);

  assert.equal(trend.points.length, 0);
  assert.equal(trend.sampleCount, 0);
  assert.equal(trend.currentAvg, 0);
});

test('build30DayPriceTrend aggregates across All categories', () => {
  const ref = new Date('2026-11-18T12:00:00Z');
  const trend = build30DayPriceTrend(SAMPLE_LISTINGS, 'All', ref);

  assert.equal(trend.sampleCount, 3);
  assert.equal(trend.minPrice, 1500);
  assert.equal(trend.maxPrice, 3200);
  assert.equal(trend.currentAvg, 2400);
});
