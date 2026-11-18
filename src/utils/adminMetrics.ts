import type {
  AdminDeal,
  AppRoute,
  Listing,
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

export interface PlatformActivityItem {
  id: string;
  kind: 'deal' | 'payout' | 'listing' | 'notification';
  title: string;
  subtitle: string;
  amountLabel?: string;
  timestamp: string;
  targetRoute?: AppRoute;
}

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
