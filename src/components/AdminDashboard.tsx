import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Banknote,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Lock,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import type {
  AdminAgent,
  AdminDeal,
  AppRoute,
  Language,
  Listing,
  NotificationItem,
  PlatformEscrowConfig,
  StatementEntry,
  ThemeMode,
  UserProfile,
} from '../types/dealkoro';
import { t } from '../i18n/translations';
import {
  buildRecentPlatformActivity,
  computeAdminDashboardMetrics,
  isActiveDeal,
  isPendingPayoutDeal,
} from '../utils/adminMetrics';
import { calculateDealBreakdown, formatTk } from '../utils/dealMath';
import { DEFAULT_PLATFORM_CONFIG, sanitizePlatformConfig } from '../utils/payloadSanitizer';
import { CategoryRevenueChart } from './CategoryRevenueChart';
import { ResilientImage } from './ResilientImage';

type DashboardTab = 'overview' | 'deals' | 'payouts' | 'activity' | 'settings';

interface AdminDashboardProps {
  user: UserProfile;
  language: Language;
  theme?: ThemeMode;
  admins: AdminAgent[];
  deals: AdminDeal[];
  listings: Listing[];
  statements: StatementEntry[];
  notifications: NotificationItem[];
  platformConfig?: PlatformEscrowConfig;
  onNavigate: (route: AppRoute) => void;
  onReassignAdmin: (dealId: string, adminId: string) => void;
  onVerifyPayment?: (dealId: string) => void;
  onReleasePayout: (dealId: string) => void;
  onSavePlatformConfig?: (config: PlatformEscrowConfig) => void;
  onAddVerifiedAdmin?: (agent: AdminAgent) => void;
  onRemoveVerifiedAdmin?: (adminUid: string) => void;
}

function formatShortTime(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  return new Date(ms).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AdminDashboard({
  user,
  language,
  theme = 'light',
  admins,
  deals,
  listings,
  statements,
  notifications,
  platformConfig = DEFAULT_PLATFORM_CONFIG,
  onNavigate,
  onReassignAdmin,
  onVerifyPayment,
  onReleasePayout,
  onSavePlatformConfig,
  onAddVerifiedAdmin,
  onRemoveVerifiedAdmin,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [bkashInput, setBkashInput] = useState(platformConfig.bkashNumber);
  const [nagadInput, setNagadInput] = useState(platformConfig.nagadNumber);
  const [bkashTypeInput, setBkashTypeInput] = useState<'Personal' | 'Merchant' | 'Agent'>(
    platformConfig.bkashAccountType ?? 'Personal'
  );
  const [nagadTypeInput, setNagadTypeInput] = useState<'Personal' | 'Merchant' | 'Agent'>(
    platformConfig.nagadAccountType ?? 'Personal'
  );
  const [bkashLinkInput, setBkashLinkInput] = useState(platformConfig.bkashPaymentLink ?? '');
  const [nagadLinkInput, setNagadLinkInput] = useState(platformConfig.nagadPaymentLink ?? '');
  const [labelInput, setLabelInput] = useState(platformConfig.escrowLabel);
  const [noticeInput, setNoticeInput] = useState(platformConfig.announcement);
  const [configSaved, setConfigSaved] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [newAdminUid, setNewAdminUid] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminSpecialty, setNewAdminSpecialty] = useState('eFootball & Cross-Method Escrow');
  const [adminAddedMsg, setAdminAddedMsg] = useState<string | null>(null);
  const [copiedUid, setCopiedUid] = useState<string | null>(null);

  useEffect(() => {
    setBkashInput(platformConfig.bkashNumber);
    setNagadInput(platformConfig.nagadNumber);
    setBkashTypeInput(platformConfig.bkashAccountType ?? 'Personal');
    setNagadTypeInput(platformConfig.nagadAccountType ?? 'Personal');
    setBkashLinkInput(platformConfig.bkashPaymentLink ?? '');
    setNagadLinkInput(platformConfig.nagadPaymentLink ?? '');
    setLabelInput(platformConfig.escrowLabel);
    setNoticeInput(platformConfig.announcement);
  }, [
    platformConfig.bkashNumber,
    platformConfig.nagadNumber,
    platformConfig.bkashAccountType,
    platformConfig.nagadAccountType,
    platformConfig.bkashPaymentLink,
    platformConfig.nagadPaymentLink,
    platformConfig.escrowLabel,
    platformConfig.announcement,
  ]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const metrics = useMemo(
    () =>
      computeAdminDashboardMetrics({
        deals,
        statements,
        listings,
      }),
    [deals, statements, listings]
  );

  const activeDeals = useMemo(() => {
    const filtered = deals.filter(isActiveDeal);
    if (!normalizedQuery) return filtered;
    return filtered.filter((d) =>
      [d.title, d.listingTitle, d.buyerName, d.sellerName, d.adminName, d.status]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [deals, normalizedQuery]);

  const pendingPayoutDeals = useMemo(() => {
    const filtered = deals.filter(isPendingPayoutDeal);
    if (!normalizedQuery) return filtered;
    return filtered.filter((d) =>
      [
        d.title,
        d.listingTitle,
        d.sellerName,
        d.buyerName,
        d.sellerMethod,
        d.paymentProofNote,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [deals, normalizedQuery]);

  const settledPayouts = useMemo(
    () =>
      statements.filter(
        (s) => s.type === 'sell_income' || s.type === 'admin_fee_income'
      ),
    [statements]
  );

  const recentActivity = useMemo(() => {
    const items = buildRecentPlatformActivity({
      deals,
      listings,
      statements,
      notifications,
      limit: 24,
    });
    if (!normalizedQuery) return items;
    return items.filter((item) =>
      [item.title, item.subtitle, item.kind]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [deals, listings, statements, notifications, normalizedQuery]);

  // Strict role guard
  if (user.role !== 'admin') {
    return (
      <div
        className="max-w-lg mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-4"
        role="alert"
      >
        <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          {t(language, 'accessRestricted')}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {t(language, 'adminOnlyNotice')}
        </p>
        <button
          type="button"
          onClick={() => onNavigate({ screen: 'home' })}
          className="min-h-[44px] px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {t(language, 'backToHome')}
        </button>
      </div>
    );
  }

  const showDeals = activeTab === 'overview' || activeTab === 'deals';
  const showPayouts = activeTab === 'overview' || activeTab === 'payouts';
  const showActivity = activeTab === 'overview' || activeTab === 'activity';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-400">
            <ShieldCheck className="w-4 h-4" />
            <span>{user.displayName} · Admin</span>
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {t(language, 'adminDashboard')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {t(language, 'adminDashboardSubtitle')}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate({ screen: 'admin_queue' })}
          className="min-h-[42px] px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors"
        >
          <Users className="w-4 h-4" />
          <span>{t(language, 'verifiedAgents')}</span>
        </button>
      </div>

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>{t(language, 'activeDeals')}</span>
            <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
            {metrics.activeDealsCount}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            Escrow: {formatTk(metrics.activeEscrowVolume)}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>{t(language, 'pendingPayouts')}</span>
            <Wallet className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
            {metrics.pendingPayoutsCount}
          </div>
          <div className="text-xs text-amber-700 dark:text-amber-400 font-semibold tabular-nums">
            Due: {formatTk(metrics.pendingPayoutAmount)}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>{t(language, 'feeIncomeEarned')}</span>
            <Banknote className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {formatTk(metrics.releasedFeeIncome)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            Pending fees: +{formatTk(metrics.projectedActiveFees)}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>{t(language, 'activeListingsLabel')}</span>
            <ShoppingBag className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
            {metrics.activeListingsCount}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {metrics.completedDealsCount} completed deals
          </div>
        </div>
      </div>

      {/* Controls: View Tabs + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div
          className="inline-flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 overflow-x-auto no-scrollbar"
          role="tablist"
        >
          {(
            [
              { id: 'overview', label: t(language, 'allOverview') },
              {
                id: 'deals',
                label: `${t(language, 'activeDeals')} (${activeDeals.length})`,
              },
              {
                id: 'payouts',
                label: `${t(language, 'pendingPayouts')} (${pendingPayoutDeals.length})`,
              },
              { id: 'activity', label: t(language, 'platformActivity') },
              { id: 'settings', label: t(language, 'escrowSettings') },
            ] as { id: DashboardTab; label: string }[]
          ).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter deals, users, TrxID..."
            aria-label="Filter dashboard"
            className="w-full min-h-[40px] pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
          />
        </div>
      </div>

      {/* Category Escrow Fee Income Breakdown */}
      {activeTab === 'overview' && (
        <CategoryRevenueChart
          deals={deals}
          listings={listings}
          statements={statements}
          language={language}
          theme={theme}
        />
      )}

      {/* Section 1: Active Deals */}
      {showDeals && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>{t(language, 'activeDeals')}</span>
            </h2>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
              {activeDeals.length} active
            </span>
          </div>

          {activeDeals.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center text-sm text-slate-500 dark:text-slate-400">
              {t(language, 'noActiveDeals')}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {activeDeals.map((deal) => {
                const breakdown = calculateDealBreakdown({
                  agreedAmount: deal.agreedAmount,
                  serviceType: deal.serviceType,
                  buyerMethod: deal.buyerMethod,
                  sellerMethod: deal.sellerMethod,
                  crossDealAccepted: deal.crossDealAccepted,
                  iosCheck: deal.iosCheck,
                  googleBindCheck: deal.googleBindCheck,
                });

                return (
                  <div
                    key={deal.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-14 h-11 rounded-xl overflow-hidden bg-slate-900 shrink-0">
                          <ResilientImage
                            src={deal.listingImage}
                            alt={deal.listingTitle}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {deal.title} · {deal.listingTitle}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            Buyer: {deal.buyerName.split(' ')[0]} · Seller:{' '}
                            {deal.sellerName.split(' ')[0]}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-sm font-extrabold text-blue-600 dark:text-blue-400 tabular-nums">
                          {formatTk(breakdown.totalPayable)}
                        </div>
                        <div className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 uppercase">
                          {deal.status.replace(/_/g, ' ')}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-800/70 rounded-xl p-3">
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">Flow:</span>{' '}
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {deal.buyerMethod} → {deal.sellerMethod}
                        </span>
                      </div>
                      <div className="text-right tabular-nums">
                        <span className="text-slate-500 dark:text-slate-400">Fee:</span>{' '}
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                          {formatTk(breakdown.platformTotalFee)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                      <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <span className="font-semibold whitespace-nowrap">
                          {t(language, 'assignAdmin')}:
                        </span>
                        <select
                          aria-label={`Assign admin for ${deal.title}`}
                          value={deal.adminId}
                          onChange={(e) => onReassignAdmin(deal.id, e.target.value)}
                          className="min-h-[36px] px-2.5 py-1 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                        >
                          {admins.map((a) => (
                            <option key={a.uid} value={a.uid}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <button
                        type="button"
                        onClick={() => onNavigate({ screen: 'deal', dealId: deal.id })}
                        className="min-h-[38px] px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors"
                      >
                        <span>{t(language, 'openDealRoom')}</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Section 2: Pending Payouts */}
      {showPayouts && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Wallet className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>{t(language, 'pendingPayouts')}</span>
            </h2>
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 tabular-nums">
              {pendingPayoutDeals.length} awaiting release
            </span>
          </div>

          {pendingPayoutDeals.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center text-sm text-slate-500 dark:text-slate-400">
              {t(language, 'noPendingPayouts')}
            </div>
          ) : (
            <div className="space-y-2.5">
              {pendingPayoutDeals.map((deal) => {
                const breakdown = calculateDealBreakdown({
                  agreedAmount: deal.agreedAmount,
                  serviceType: deal.serviceType,
                  buyerMethod: deal.buyerMethod,
                  sellerMethod: deal.sellerMethod,
                  crossDealAccepted: deal.crossDealAccepted,
                  iosCheck: deal.iosCheck,
                  googleBindCheck: deal.googleBindCheck,
                });
                const sellerPayoutMethod =
                  deal.sellerMethod === 'pending' ? 'bKash' : deal.sellerMethod;

                return (
                  <div
                    key={`payout_${deal.id}`}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {deal.sellerName}
                        </span>
                        <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md">
                          {sellerPayoutMethod}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-300 truncate">
                        {deal.title} · {deal.listingTitle}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {deal.paymentProofNote
                          ? `Proof: ${deal.paymentProofNote}`
                          : 'Awaiting final account verification'}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      <div className="text-left sm:text-right">
                        <div className="text-base font-extrabold text-slate-900 dark:text-white tabular-nums">
                          {formatTk(breakdown.sellerNetPayout)}
                        </div>
                        <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 tabular-nums">
                          +{formatTk(breakdown.platformTotalFee)} admin fee
                        </div>
                      </div>

                      {deal.status === 'payment_instruction' && onVerifyPayment ? (
                        <button
                          type="button"
                          onClick={() => onVerifyPayment(deal.id)}
                          className="min-h-[42px] px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>Verify Payment</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onReleasePayout(deal.id)}
                          className="min-h-[42px] px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{t(language, 'releasePayout')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {settledPayouts.length > 0 && activeTab === 'payouts' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2.5">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Recent Settled Ledger
              </div>
              {settledPayouts.slice(0, 6).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-b-0"
                >
                  <div className="min-w-0 pr-3">
                    <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {entry.title}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400">
                      {entry.method} · {formatShortTime(entry.createdAt)}
                    </div>
                  </div>
                  <div className="font-bold text-emerald-700 dark:text-emerald-400 tabular-nums shrink-0">
                    {formatTk(entry.netAmount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Section 3: Recent Platform Activity */}
      {showActivity && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              <span>{t(language, 'platformActivity')}</span>
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {recentActivity.length} events
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
            {recentActivity.map((item) => {
              const badgeClass =
                item.kind === 'deal'
                  ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300'
                  : item.kind === 'payout'
                  ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300'
                  : item.kind === 'listing'
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  : 'bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300';

              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!item.targetRoute}
                  onClick={() => item.targetRoute && onNavigate(item.targetRoute)}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:hover:bg-white dark:disabled:hover:bg-slate-900 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${badgeClass}`}
                      >
                        {item.kind}
                      </span>
                      <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {item.title}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {item.subtitle}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {item.amountLabel && (
                      <div className="text-xs font-bold text-slate-900 dark:text-white tabular-nums">
                        {item.amountLabel}
                      </div>
                    )}
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                      {formatShortTime(item.timestamp)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Section 4: Live Escrow Payment Settings & Admin Team */}
      {activeTab === 'settings' && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Official Escrow Payment Numbers
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Buyers see these verified bKash &amp; Nagad numbers inside every deal room. Changes sync across all devices immediately.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setConfigError(null);
                setConfigSaved(false);
                if (bkashInput.trim().length < 6 || nagadInput.trim().length < 6) {
                  setConfigError('Please enter valid bKash and Nagad numbers (at least 6 digits).');
                  return;
                }
                const nextCfg = sanitizePlatformConfig({
                  bkashNumber: bkashInput,
                  nagadNumber: nagadInput,
                  bkashAccountType: bkashTypeInput,
                  nagadAccountType: nagadTypeInput,
                  bkashPaymentLink: bkashLinkInput,
                  nagadPaymentLink: nagadLinkInput,
                  escrowLabel: labelInput,
                  announcement: noticeInput,
                });
                onSavePlatformConfig?.(nextCfg);
                setConfigSaved(true);
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-2.5">
                <div>
                  <label
                    htmlFor="cfg-bkash"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    bKash Number
                  </label>
                  <input
                    id="cfg-bkash"
                    type="text"
                    value={bkashInput}
                    onChange={(e) => setBkashInput(e.target.value)}
                    placeholder="e.g. 01755-842190"
                    className="w-full min-h-[42px] px-3.5 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
                  />
                </div>
                <div>
                  <label
                    htmlFor="cfg-bkash-type"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    bKash Type
                  </label>
                  <select
                    id="cfg-bkash-type"
                    value={bkashTypeInput}
                    onChange={(e) =>
                      setBkashTypeInput(e.target.value as 'Personal' | 'Merchant' | 'Agent')
                    }
                    className="w-full min-h-[42px] px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
                  >
                    <option value="Personal">Personal</option>
                    <option value="Merchant">Merchant</option>
                    <option value="Agent">Agent</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="cfg-bkash-link"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  bKash Online Payment Link (Optional HTTPS)
                </label>
                <input
                  id="cfg-bkash-link"
                  type="url"
                  value={bkashLinkInput}
                  onChange={(e) => setBkashLinkInput(e.target.value)}
                  placeholder="https://shop.bkash.com/..."
                  className="w-full min-h-[40px] px-3.5 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-2.5">
                <div>
                  <label
                    htmlFor="cfg-nagad"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Nagad Number
                  </label>
                  <input
                    id="cfg-nagad"
                    type="text"
                    value={nagadInput}
                    onChange={(e) => setNagadInput(e.target.value)}
                    placeholder="e.g. 01819-000000"
                    className="w-full min-h-[42px] px-3.5 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
                  />
                </div>
                <div>
                  <label
                    htmlFor="cfg-nagad-type"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Nagad Type
                  </label>
                  <select
                    id="cfg-nagad-type"
                    value={nagadTypeInput}
                    onChange={(e) =>
                      setNagadTypeInput(e.target.value as 'Personal' | 'Merchant' | 'Agent')
                    }
                    className="w-full min-h-[42px] px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
                  >
                    <option value="Personal">Personal</option>
                    <option value="Merchant">Merchant</option>
                    <option value="Agent">Agent</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="cfg-nagad-link"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Nagad Online Payment Link (Optional HTTPS)
                </label>
                <input
                  id="cfg-nagad-link"
                  type="url"
                  value={nagadLinkInput}
                  onChange={(e) => setNagadLinkInput(e.target.value)}
                  placeholder="https://..."
                  className="w-full min-h-[40px] px-3.5 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
                />
              </div>

              <div>
                <label
                  htmlFor="cfg-label"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Account Label (Personal / Merchant / Agent)
                </label>
                <input
                  id="cfg-label"
                  type="text"
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  placeholder="DEALKORO Official Escrow (Personal)"
                  className="w-full min-h-[42px] px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
                />
              </div>

              <div>
                <label
                  htmlFor="cfg-notice"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Deal Room Payment Notice
                </label>
                <textarea
                  id="cfg-notice"
                  rows={2}
                  value={noticeInput}
                  onChange={(e) => setNoticeInput(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
                />
              </div>

              {configError && (
                <div
                  role="alert"
                  className="p-2.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl"
                >
                  {configError}
                </div>
              )}

              {configSaved && (
                <div className="p-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 rounded-xl">
                  Official escrow payment numbers saved and synced live!
                </div>
              )}

              <button
                type="submit"
                className="w-full min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors"
              >
                Save Escrow Numbers
              </button>
            </form>
          </div>

          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Add Verified Admin Moderator
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Only existing verified Admins can add moderators (locked in Firestore security rules).
              </p>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1 text-xs text-slate-700 dark:text-slate-300">
                <div className="font-bold text-slate-900 dark:text-white">
                  How to add a moderator:
                </div>
                <div>1. Moderator signs in once with Google.</div>
                <div>
                  2. They open <span className="font-semibold">Profile</span> and tap{' '}
                  <span className="font-semibold">Copy UID</span>.
                </div>
                <div>
                  3. Paste their UID below &amp; click{' '}
                  <span className="font-semibold">Add Verified Admin</span>.
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setAdminAddedMsg(null);
                  if (!newAdminUid.trim() || !newAdminName.trim()) return;
                  onAddVerifiedAdmin?.({
                    uid: newAdminUid.trim(),
                    name: newAdminName.trim(),
                    verified: true,
                    specialty: newAdminSpecialty.trim() || 'Verified Escrow Mediator',
                    reviewNotes: 'Added as verified DEALKORO escrow mediator.',
                    completedDeals: 0,
                    rating: 5.0,
                  });
                  setAdminAddedMsg(`Added ${newAdminName.trim()} to verified admins.`);
                  setNewAdminUid('');
                  setNewAdminName('');
                }}
                className="space-y-3"
              >
                <div>
                  <label
                    htmlFor="adm-uid"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Firebase User UID
                  </label>
                  <input
                    id="adm-uid"
                    type="text"
                    value={newAdminUid}
                    onChange={(e) => setNewAdminUid(e.target.value)}
                    placeholder="e.g. 9fK2mP..."
                    className="w-full min-h-[42px] px-3.5 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
                  />
                </div>
                <div>
                  <label
                    htmlFor="adm-name"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Admin Display Name
                  </label>
                  <input
                    id="adm-name"
                    type="text"
                    value={newAdminName}
                    onChange={(e) => setNewAdminName(e.target.value)}
                    placeholder="Moderator Name"
                    className="w-full min-h-[42px] px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
                  />
                </div>
                <div>
                  <label
                    htmlFor="adm-spec"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Specialty
                  </label>
                  <input
                    id="adm-spec"
                    type="text"
                    value={newAdminSpecialty}
                    onChange={(e) => setNewAdminSpecialty(e.target.value)}
                    className="w-full min-h-[42px] px-3.5 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
                  />
                </div>

                {adminAddedMsg && (
                  <div className="p-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 rounded-xl">
                    {adminAddedMsg}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full min-h-[42px] bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors"
                >
                  Add Verified Admin
                </button>
              </form>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Verified Escrow Team ({admins.length})
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {admins.map((a) => {
                    const isProtected = a.uid === user.uid || a.uid === 'admin_abdur';
                    return (
                      <div
                        key={a.uid}
                        className="p-2.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 dark:text-white truncate">
                            {a.name} ✓
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                            UID: {a.uid}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(a.uid);
                              setCopiedUid(a.uid);
                              window.setTimeout(() => setCopiedUid(null), 1600);
                            }}
                            aria-label={`Copy UID for ${a.name}`}
                            className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:text-blue-600"
                          >
                            {copiedUid === a.uid ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {!isProtected && onRemoveVerifiedAdmin ? (
                            <button
                              type="button"
                              onClick={() => onRemoveVerifiedAdmin(a.uid)}
                              aria-label={`Remove ${a.name}`}
                              className="p-1.5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-100"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                              Verified
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="bg-slate-900 dark:bg-slate-900/95 border border-slate-800 text-white rounded-2xl p-5 space-y-2.5 text-xs">
              <div className="font-bold text-sm text-blue-400">
                Production Launch &amp; Security Status
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-800">
                <span className="text-slate-300">Firebase Hosting Config</span>
                <span className="font-semibold text-emerald-400">firebase.json Ready</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-800">
                <span className="text-slate-300">Payment Contact Lock</span>
                <span className="font-semibold text-emerald-400">Anti-Spoof Enforced</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-800">
                <span className="text-slate-300">Photo Upload Mode</span>
                <span className="font-semibold text-emerald-400">Starter Tier Sync Ready</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-300">Escrow Fee Engine</span>
                <span className="font-semibold text-white">20 / 60 / +30 / +20 Tk</span>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
