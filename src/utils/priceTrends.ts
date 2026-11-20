import type { Listing, ListingCategory } from '../types/dealkoro';

export interface PriceTrendPoint {
  dateKey: string;
  label: string;
  avgPrice: number | null;
  dayAvgPrice: number | null;
  listingCount: number;
}

export interface PriceTrendSummary {
  points: PriceTrendPoint[];
  currentAvg: number;
  startAvg: number;
  changePct: number;
  minPrice: number;
  maxPrice: number;
  sampleCount: number;
}

function toUtcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatShortDay(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Computes a 30-day real market price trend strictly from live observed listings
 * in the selected category (zero synthetic waves or random jitter). Each UTC day
 * reports the cumulative observed market mean up to that date (`avgPrice`) along with
 * that day's exact average (`dayAvgPrice`) and listing count. Days prior to the first
 * observed listing carry `null` so the chart never fabricates pre-launch price history.
 */
export function build30DayPriceTrend(
  listings: Listing[],
  category: 'All' | ListingCategory = 'All',
  referenceDate: Date = new Date()
): PriceTrendSummary {
  const validListings = listings.filter(
    (item) =>
      Number.isFinite(item.price) &&
      item.price > 0 &&
      (category === 'All' || item.category === category)
  );

  if (validListings.length === 0) {
    return {
      points: [],
      currentAvg: 0,
      startAvg: 0,
      changePct: 0,
      minPrice: 0,
      maxPrice: 0,
      sampleCount: 0,
    };
  }

  const refDayKey = toUtcDayKey(referenceDate);
  const datedListings = validListings.map((item) => {
    const parsed = new Date(item.createdAt);
    const dayKey = Number.isNaN(parsed.getTime()) ? refDayKey : toUtcDayKey(parsed);
    return {
      price: Math.round(item.price),
      dayKey,
    };
  });

  const prices = datedListings.map((d) => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const overallAvg = Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length);

  const dayMap = new Map<string, number[]>();
  for (const item of datedListings) {
    const existing = dayMap.get(item.dayKey) ?? [];
    existing.push(item.price);
    dayMap.set(item.dayKey, existing);
  }

  const refUtc = new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate()
    )
  );

  const points: PriceTrendPoint[] = [];
  for (let offset = 29; offset >= 0; offset--) {
    const d = new Date(refUtc.getTime() - offset * 86_400_000);
    const dateKey = toUtcDayKey(d);
    const dayPrices = dayMap.get(dateKey) ?? [];

    const upToDate = datedListings.filter((item) => item.dayKey <= dateKey);
    const avgPrice =
      upToDate.length > 0
        ? Math.round(upToDate.reduce((sum, item) => sum + item.price, 0) / upToDate.length)
        : null;

    const dayAvgPrice =
      dayPrices.length > 0
        ? Math.round(dayPrices.reduce((sum, p) => sum + p, 0) / dayPrices.length)
        : null;

    points.push({
      dateKey,
      label: formatShortDay(d),
      avgPrice,
      dayAvgPrice,
      listingCount: dayPrices.length,
    });
  }

  const nonNullPoints = points.filter((p) => p.avgPrice !== null);
  const startAvg = nonNullPoints[0]?.avgPrice ?? overallAvg;
  const currentAvg = nonNullPoints[nonNullPoints.length - 1]?.avgPrice ?? overallAvg;
  const changePct =
    startAvg > 0
      ? Math.round(((currentAvg - startAvg) / startAvg) * 1000) / 10
      : 0;

  return {
    points,
    currentAvg,
    startAvg,
    changePct,
    minPrice,
    maxPrice,
    sampleCount: validListings.length,
  };
}
