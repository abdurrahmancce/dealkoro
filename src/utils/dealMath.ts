import type {
  DealServiceType,
  Listing,
  PaymentMethod,
  StatementEntry,
} from '../types/dealkoro';

export const DEAL_FEES = {
  NORMAL_DEAL: 20,
  ULTIMATE_SAFE_DEAL: 60,
  CROSS_DEAL: 30,
  IOS_CHECK: 20,
  GOOGLE_BIND_CHECK: 20,
} as const;

export interface DealFeeInput {
  agreedAmount: number;
  serviceType: DealServiceType | 'pending';
  buyerMethod: PaymentMethod | 'pending';
  sellerMethod: PaymentMethod | 'pending';
  crossDealAccepted: boolean;
  iosCheck: boolean;
  googleBindCheck: boolean;
}

export interface DealCostBreakdown {
  agreedAmount: number;
  serviceFee: number;
  crossDealRequired: boolean;
  crossDealFee: number;
  iosCheckFee: number;
  googleBindCheckFee: number;
  verificationFee: number;
  platformTotalFee: number;
  totalPayable: number;
  sellerNetPayout: number;
}

export function calculateDealBreakdown(input: DealFeeInput): DealCostBreakdown {
  const safeAmount = Math.max(0, Math.round(input.agreedAmount));

  const crossDealRequired =
    input.buyerMethod !== 'pending' &&
    input.sellerMethod !== 'pending' &&
    input.buyerMethod !== input.sellerMethod;

  const crossDealFee =
    crossDealRequired && input.crossDealAccepted ? DEAL_FEES.CROSS_DEAL : 0;

  // Per wireframe Screen 21 & 23: when Normal Deal becomes Cross Deal, Cross Deal replaces Normal Deal 20/- with 30/-;
  // Ultimate Safe Deal remains 60/- even if cross-method applies.
  let serviceFee = 0;
  if (input.serviceType === 'ultimate_safe') {
    serviceFee = DEAL_FEES.ULTIMATE_SAFE_DEAL;
  } else if (input.serviceType === 'normal' && !crossDealFee) {
    serviceFee = DEAL_FEES.NORMAL_DEAL;
  }

  const iosCheckFee = input.iosCheck ? DEAL_FEES.IOS_CHECK : 0;
  const googleBindCheckFee = input.googleBindCheck ? DEAL_FEES.GOOGLE_BIND_CHECK : 0;
  const verificationFee = iosCheckFee + googleBindCheckFee;

  const platformTotalFee = serviceFee + crossDealFee + verificationFee;
  const totalPayable = safeAmount + platformTotalFee;
  const sellerNetPayout = safeAmount;

  return {
    agreedAmount: safeAmount,
    serviceFee,
    crossDealRequired,
    crossDealFee,
    iosCheckFee,
    googleBindCheckFee,
    verificationFee,
    platformTotalFee,
    totalPayable,
    sellerNetPayout,
  };
}

export function formatTk(amount: number): string {
  const rounded = Math.round(amount);
  return `Tk ${rounded.toLocaleString('en-US')}`;
}

export function filterListingsByQuery(listings: Listing[], rawQuery: string): Listing[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) {
    return listings;
  }
  return listings.filter((item) => {
    const haystack = [
      item.title,
      item.category,
      item.sellerName,
      item.server,
      item.linkType,
      item.description,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

export type ListingSortOption = 'newest' | 'price_asc' | 'price_desc';

export function sortListings(listings: Listing[], sortBy: ListingSortOption): Listing[] {
  const copy = [...listings];
  if (sortBy === 'price_asc') {
    return copy.sort((a, b) => a.price - b.price);
  }
  if (sortBy === 'price_desc') {
    return copy.sort((a, b) => b.price - a.price);
  }
  return copy.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export interface StatementSummary {
  totalSellIncome: number;
  totalAdminIncome: number;
  totalBuySpend: number;
  netBalance: number;
  transactionCount: number;
}

export function computeStatementSummary(entries: StatementEntry[]): StatementSummary {
  let totalSellIncome = 0;
  let totalAdminIncome = 0;
  let totalBuySpend = 0;

  for (const entry of entries) {
    if (entry.type === 'sell_income') {
      totalSellIncome += entry.netAmount;
    } else if (entry.type === 'admin_fee_income') {
      totalAdminIncome += entry.netAmount;
    } else if (entry.type === 'buy_payment') {
      totalBuySpend += entry.amount;
    }
  }

  return {
    totalSellIncome,
    totalAdminIncome,
    totalBuySpend,
    netBalance: totalSellIncome + totalAdminIncome - totalBuySpend,
    transactionCount: entries.length,
  };
}

export function validatePostInput(input: {
  title: string;
  priceText: string;
}): { valid: boolean; price: number; errorKey?: 'title_required' | 'price_invalid' } {
  if (input.title.trim().length < 2) {
    return { valid: false, price: 0, errorKey: 'title_required' };
  }
  const parsed = Number(input.priceText.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1_000_000) {
    return { valid: false, price: 0, errorKey: 'price_invalid' };
  }
  return { valid: true, price: Math.round(parsed) };
}
