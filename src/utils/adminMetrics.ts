import type {
  AdminDeal,
  AppRoute,
  Listing,
  ListingCategory,
  NotificationItem,
  StatementEntry,
} from '../types/dealkoro';
import { calculateDealBreakdown, formatTk } from './dealMath';

export interface AdminDashboardMetrics {
  activeDealsCount: number;
  activeEscrowVolume: number;
  pendingPayoutsCount: number;
  pendingPayoutAmount: number;
  completedDealsCount: number;
  releasedFeeIncome: number;
  projectedActiveFees: number;
  activeListingsCount: number;
}

export interface CategoryFeeBreakdownItem {
  category: ListingCategory;
  releasedFee: number;
  pendingFee: number;
  totalFee: number;
  dealCount: number;
  sharePct: number;
}

export interface DailyRevenuePoint {
  dateKey: string;
  label: string;
  releasedFee: number;
  dealVolume: number;
  entryCount: number;
}

export interface PlatformActivityItem {
  id: string;
  kind: 'deal' | 'payout' | 'listing' | 'notification';
  title: string;
  subtitle: string;
  amountLabel?: string;
  timestamp: string;
  targetRoute?: AppRoute;
}

const ALL_CATEGORIES: ListingCategory[] = [
  'eFootball',
  'PUBG Mobile',
  'Free Fire',
  'Mobile Legends',
  'Other',
];

const PAYOUT_PENDING_STATUSES = new Set<AdminDeal['status']>([
  'payment_instruction',
  'payment_received',
  'id_exchange',
  'review_prompt',
]);

export function isActiveDeal(deal: AdminDeal): boolean {
  return deal.status !== 'done' && deal.status !== 'cancelled';
}

export function isPendingPayoutDeal(deal: AdminDeal): boolean {
  if (deal.status === 'done' || deal.status === 'cancelled') {
    return false;
  }
  return PAYOUT_PENDING_STATUSES.has(deal.status) || deal.buyerInitialDone;
}

export function inferListingCategoryFromText(text: string): ListingCategory {
  const normalized = text.toLowerCase();
  if (
    normalized.includes('efootball') ||
    normalized.includes('konami') ||
    normalized.includes('rummi') ||
    normalized.includes('ronaldo') ||
    normalized.includes('romario') ||
    normalized.includes('neymar') ||
    normalized.includes('eto') ||
    normalized.includes('pes')
  ) {
    return 'eFootball';
  }
  if (
    normalized.includes('pubg') ||
    normalized.includes('glacier') ||
    normalized.includes('bgmi') ||
    normalized.includes('conqueror')
  ) {
    return 'PUBG Mobile';
  }
  if (
    normalized.includes('free fire') ||
    normalized.includes('booyah') ||
    normalized.includes('alok') ||
    normalized.includes('ff ')
  ) {
    return 'Free Fire';
  }
  if (normalized.includes('mobile legends') || normalized.includes('mlbb')) {
    return 'Mobile Legends';
  }
  return 'Other';
}

function toUtcDateKey(input: string | Date): string | null {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function parseUtcDateKey(dateKey: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const parsed = new Date(`${dateKey}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.toISOString().slice(0, 10) !== dateKey) return null;
  return parsed;
}

export function validateDateRange(
  startDate: string,
  endDate: string
): { valid: boolean; error?: string; startDate: string; endDate: string } {
  const start = parseUtcDateKey(startDate);
  const end = parseUtcDateKey(endDate);
  if (!start || !end) {
    return {
      valid: false,
      error: 'Select valid Start and End dates.',
      startDate,
      endDate,
    };
  }
  if (start.getTime() > end.getTime()) {
    return {
      valid: false,
      error: 'Start date must be on or before End date.',
      startDate,
      endDate,
    };
  }
  return { valid: true, startDate, endDate };
}

export function isIsoWithinDateRange(
  iso: string | undefined,
  startDate?: string,
  endDate?: string
): boolean {
  if (!startDate && !endDate) return true;
  if (!iso) return false;
  const key = toUtcDateKey(iso);
  if (!key) return false;
  if (startDate && key < startDate) return false;
  if (endDate && key > endDate) return false;
  return true;
}

export function createDateRangePreset(
  preset: '7d' | '30d' | '90d' | 'all' | 'custom',
  statements: StatementEntry[],
  deals: AdminDeal[],
  referenceDate: Date = new Date()
): { preset: '7d' | '30d' | '90d' | 'all' | 'custom'; startDate: string; endDate: string } {
  const refUtc = new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate()
    )
  );
  const endDate = refUtc.toISOString().slice(0, 10);

  if (preset === 'all') {
    let earliest = endDate;
    for (const s of statements) {
      const k = toUtcDateKey(s.createdAt);
      if (k && k < earliest) earliest = k;
    }
    for (const d of deals) {
      const k = toUtcDateKey(d.updatedAt || d.createdAt);
      if (k && k < earliest) earliest = k;
    }
    const thirtyAgo = new Date(refUtc.getTime() - 29 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    return {
      preset: 'all',
      startDate: earliest < thirtyAgo ? earliest : thirtyAgo,
      endDate,
    };
  }

  const days = preset === '7d' ? 7 : preset === '90d' ? 90 : 30;
  const startUtc = new Date(refUtc.getTime() - (days - 1) * 86_400_000);
  return {
    preset,
    startDate: startUtc.toISOString().slice(0, 10),
    endDate,
  };
}

export function computeCategoryFeeBreakdown(params: {
  deals: AdminDeal[];
  listings: Listing[];
  statements: StatementEntry[];
  startDate?: string;
  endDate?: string;
}): CategoryFeeBreakdownItem[] {
  const listingCategoryMap = new Map<string, ListingCategory>();
  for (const listing of params.listings) {
    listingCategoryMap.set(listing.id, listing.category);
  }

  const dealMap = new Map<string, AdminDeal>();
  for (const deal of params.deals) {
    dealMap.set(deal.id, deal);
  }

  const resolveCategory = (deal?: AdminDeal, fallbackTitle?: string): ListingCategory => {
    if (deal) {
      const fromListing = listingCategoryMap.get(deal.listingId);
      if (fromListing) return fromListing;
      return inferListingCategoryFromText(`${deal.listingTitle} ${fallbackTitle ?? ''}`);
    }
    if (fallbackTitle) {
      return inferListingCategoryFromText(fallbackTitle);
    }
    return 'Other';
  };

  const buckets = new Map<
    ListingCategory,
    {
      releasedFee: number;
      pendingFee: number;
      dealIds: Set<string>;
    }
  >();

  for (const category of ALL_CATEGORIES) {
    buckets.set(category, {
      releasedFee: 0,
      pendingFee: 0,
      dealIds: new Set<string>(),
    });
  }

  for (const stmt of params.statements) {
    if (stmt.type !== 'admin_fee_income') continue;
    if (!isIsoWithinDateRange(stmt.createdAt, params.startDate, params.endDate)) {
      continue;
    }
    const linkedDeal = dealMap.get(stmt.dealId);
    const category = resolveCategory(linkedDeal, stmt.title);
    const bucket = buckets.get(category)!;
    bucket.releasedFee += Math.max(0, Math.round(stmt.netAmount));
    if (stmt.dealId) {
      bucket.dealIds.add(stmt.dealId);
    }
  }

  for (const deal of params.deals) {
    if (deal.status === 'cancelled') continue;
    if (
      !isIsoWithinDateRange(
        deal.updatedAt || deal.createdAt,
        params.startDate,
        params.endDate
      )
    ) {
      continue;
    }
    const category = resolveCategory(deal, deal.listingTitle);
    const bucket = buckets.get(category)!;
    bucket.dealIds.add(deal.id);

    if (isActiveDeal(deal)) {
      const breakdown = calculateDealBreakdown({
        agreedAmount: deal.agreedAmount,
        serviceType: deal.serviceType,
        buyerMethod: deal.buyerMethod,
        sellerMethod: deal.sellerMethod,
        crossDealAccepted: deal.crossDealAccepted,
        iosCheck: deal.iosCheck,
        googleBindCheck: deal.googleBindCheck,
      });
      bucket.pendingFee += breakdown.platformTotalFee;
    }
  }

  const rows: CategoryFeeBreakdownItem[] = ALL_CATEGORIES.map((category) => {
    const b = buckets.get(category)!;
    const totalFee = b.releasedFee + b.pendingFee;
    return {
      category,
      releasedFee: b.releasedFee,
      pendingFee: b.pendingFee,
      totalFee,
      dealCount: b.dealIds.size,
      sharePct: 0,
    };
  });

  const grandTotalFee = rows.reduce((sum, r) => sum + r.totalFee, 0);
  for (const row of rows) {
    row.sharePct =
      grandTotalFee > 0 ? Math.round((row.totalFee / grandTotalFee) * 1000) / 10 : 0;
  }

  rows.sort((a, b) => {
    if (b.totalFee !== a.totalFee) return b.totalFee - a.totalFee;
    if (b.dealCount !== a.dealCount) return b.dealCount - a.dealCount;
    return ALL_CATEGORIES.indexOf(a.category) - ALL_CATEGORIES.indexOf(b.category);
  });

  return rows;
}

export function computeDailyAdminFeeTrend(
  statements: StatementEntry[],
  range?: { startDate?: string; endDate?: string },
  referenceDate: Date = new Date()
): DailyRevenuePoint[] {
  const refUtc = new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate()
    )
  );
  const parsedEnd = range?.endDate ? parseUtcDateKey(range.endDate) : null;
  const endUtc = parsedEnd ?? refUtc;
  const parsedStart = range?.startDate ? parseUtcDateKey(range.startDate) : null;
  const defaultStart = new Date(endUtc.getTime() - 29 * 86_400_000);
  let startUtc = parsedStart ?? defaultStart;

  if (startUtc.getTime() > endUtc.getTime()) {
    startUtc = new Date(endUtc.getTime());
  }

  const maxSpanMs = 365 * 86_400_000;
  if (endUtc.getTime() - startUtc.getTime() > maxSpanMs) {
    startUtc = new Date(endUtc.getTime() - maxSpanMs);
  }

  const startKey = startUtc.toISOString().slice(0, 10);
  const endKey = endUtc.toISOString().slice(0, 10);

  const dayTotals = new Map<
    string,
    { releasedFee: number; dealVolume: number; entryCount: number }
  >();

  for (const stmt of statements) {
    const dateKey = toUtcDateKey(stmt.createdAt);
    if (!dateKey || dateKey < startKey || dateKey > endKey) continue;
    const existing = dayTotals.get(dateKey) ?? {
      releasedFee: 0,
      dealVolume: 0,
      entryCount: 0,
    };
    if (stmt.type === 'admin_fee_income') {
      existing.releasedFee += Math.max(0, Math.round(stmt.netAmount));
      existing.entryCount += 1;
    } else if (stmt.type === 'sell_income') {
      existing.dealVolume += Math.max(0, Math.round(stmt.netAmount));
    }
    dayTotals.set(dateKey, existing);
  }

  const points: DailyRevenuePoint[] = [];
  for (let ts = startUtc.getTime(); ts <= endUtc.getTime(); ts += 86_400_000) {
    const d = new Date(ts);
    const dateKey = d.toISOString().slice(0, 10);
    const agg = dayTotals.get(dateKey);
    points.push({
      dateKey,
      label: d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      }),
      releasedFee: agg?.releasedFee ?? 0,
      dealVolume: agg?.dealVolume ?? 0,
      entryCount: agg?.entryCount ?? 0,
    });
  }
  return points;
}

export interface ThirtyDayRevenuePoint extends DailyRevenuePoint {
  cumulativeFee: number;
}

export interface ThirtyDayRevenueSummary {
  startDate: string;
  endDate: string;
  totalFeeIncome: number;
  totalDealVolume: number;
  totalSettlements: number;
  activeDays: number;
  dailyAverage: number;
  peakDay: {
    dateKey: string;
    label: string;
    releasedFee: number;
    entryCount: number;
  } | null;
}

export function compute30DayAdminFeeTrend(
  statements: StatementEntry[],
  referenceDate: Date = new Date()
): DailyRevenuePoint[] {
  return computeDailyAdminFeeTrend(statements, undefined, referenceDate);
}

export function compute30DayRevenueAnalytics(
  statements: StatementEntry[],
  referenceDate: Date = new Date()
): {
  points: ThirtyDayRevenuePoint[];
  summary: ThirtyDayRevenueSummary;
} {
  const basePoints = compute30DayAdminFeeTrend(statements, referenceDate);
  let runningFee = 0;
  let totalDealVolume = 0;
  let totalSettlements = 0;
  let activeDays = 0;
  let peakDay: ThirtyDayRevenueSummary['peakDay'] = null;

  const points: ThirtyDayRevenuePoint[] = basePoints.map((pt) => {
    runningFee += pt.releasedFee;
    totalDealVolume += pt.dealVolume;
    totalSettlements += pt.entryCount;
    if (pt.releasedFee > 0) {
      activeDays += 1;
    }
    if (pt.releasedFee > 0 && (!peakDay || pt.releasedFee > peakDay.releasedFee)) {
      peakDay = {
        dateKey: pt.dateKey,
        label: pt.label,
        releasedFee: pt.releasedFee,
        entryCount: pt.entryCount,
      };
    }
    return {
      ...pt,
      cumulativeFee: runningFee,
    };
  });

  const dayCount = points.length || 30;
  return {
    points,
    summary: {
      startDate: points[0]?.dateKey ?? '',
      endDate: points[points.length - 1]?.dateKey ?? '',
      totalFeeIncome: runningFee,
      totalDealVolume,
      totalSettlements,
      activeDays,
      dailyAverage: Math.round(runningFee / dayCount),
      peakDay,
    },
  };
}

export function computeAdminDashboardMetrics(params: {
  deals: AdminDeal[];
  statements: StatementEntry[];
  listings: Listing[];
}): AdminDashboardMetrics {
  const activeDeals = params.deals.filter(isActiveDeal);
  const pendingPayoutDeals = params.deals.filter(isPendingPayoutDeal);
  const completedDeals = params.deals.filter((d) => d.status === 'done');

  const activeEscrowVolume = activeDeals.reduce((sum, d) => {
    const breakdown = calculateDealBreakdown({
      agreedAmount: d.agreedAmount,
      serviceType: d.serviceType,
      buyerMethod: d.buyerMethod,
      sellerMethod: d.sellerMethod,
      crossDealAccepted: d.crossDealAccepted,
      iosCheck: d.iosCheck,
      googleBindCheck: d.googleBindCheck,
    });
    return sum + breakdown.totalPayable;
  }, 0);

  const pendingPayoutAmount = pendingPayoutDeals.reduce(
    (sum, d) => sum + Math.max(0, Math.round(d.agreedAmount)),
    0
  );

  const projectedActiveFees = activeDeals.reduce((sum, d) => {
    const breakdown = calculateDealBreakdown({
      agreedAmount: d.agreedAmount,
      serviceType: d.serviceType,
      buyerMethod: d.buyerMethod,
      sellerMethod: d.sellerMethod,
      crossDealAccepted: d.crossDealAccepted,
      iosCheck: d.iosCheck,
      googleBindCheck: d.googleBindCheck,
    });
    return sum + breakdown.platformTotalFee;
  }, 0);

  const releasedFeeIncome = params.statements
    .filter((s) => s.type === 'admin_fee_income')
    .reduce((sum, s) => sum + s.netAmount, 0);

  const activeListingsCount = params.listings.filter(
    (l) => l.status === 'active'
  ).length;

  return {
    activeDealsCount: activeDeals.length,
    activeEscrowVolume,
    pendingPayoutsCount: pendingPayoutDeals.length,
    pendingPayoutAmount,
    completedDealsCount: completedDeals.length,
    releasedFeeIncome,
    projectedActiveFees,
    activeListingsCount,
  };
}

export function buildRecentPlatformActivity(params: {
  deals: AdminDeal[];
  listings: Listing[];
  statements: StatementEntry[];
  notifications: NotificationItem[];
  limit?: number;
}): PlatformActivityItem[] {
  const items: PlatformActivityItem[] = [];

  for (const deal of params.deals) {
    items.push({
      id: `act_deal_${deal.id}`,
      kind: 'deal',
      title: `${deal.title} · ${deal.listingTitle}`,
      subtitle: `${deal.buyerName.split(' ')[0]} → ${deal.sellerName.split(' ')[0]} · Admin: ${deal.adminName} (${deal.status.replace(/_/g, ' ')})`,
      amountLabel: formatTk(deal.totalAmount),
      timestamp: deal.updatedAt || deal.createdAt,
      targetRoute: { screen: 'deal', dealId: deal.id },
    });
  }

  for (const stmt of params.statements) {
    items.push({
      id: `act_stmt_${stmt.id}`,
      kind: 'payout',
      title: stmt.title,
      subtitle: `${stmt.method} · ${stmt.type.replace(/_/g, ' ')}`,
      amountLabel: formatTk(stmt.netAmount),
      timestamp: stmt.createdAt,
      targetRoute: { screen: 'deal', dealId: stmt.dealId },
    });
  }

  for (const listing of params.listings) {
    items.push({
      id: `act_list_${listing.id}`,
      kind: 'listing',
      title: `Listing (${listing.category}): ${listing.title}`,
      subtitle: `Seller: ${listing.sellerName} · ${listing.linkType} · ${listing.status}`,
      amountLabel: formatTk(listing.price),
      timestamp: listing.createdAt,
      targetRoute: { screen: 'post_detail', listingId: listing.id },
    });
  }

  for (const notif of params.notifications) {
    let targetRoute: AppRoute | undefined;
    if (notif.targetType === 'listing') {
      targetRoute = { screen: 'post_detail', listingId: notif.targetId };
    } else if (notif.targetType === 'conversation') {
      targetRoute = { screen: 'chat', conversationId: notif.targetId };
    } else if (notif.targetType === 'deal') {
      targetRoute = { screen: 'deal', dealId: notif.targetId };
    }
    items.push({
      id: `act_notif_${notif.id}`,
      kind: 'notification',
      title: `${notif.actorName}: ${notif.message}`,
      subtitle: notif.isRead ? 'Read notification' : 'Unread alert',
      timestamp: notif.createdAt,
      targetRoute,
    });
  }

  items.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  return items.slice(0, params.limit ?? 20);
}
