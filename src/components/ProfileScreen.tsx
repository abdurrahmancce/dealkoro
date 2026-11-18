import React, { useState } from 'react';
import {
  Bookmark,
  Check,
  ChevronRight,
  Copy,
  FileText,
  HelpCircle,
  Lock,
  LogOut,
  Moon,
  Settings,
  ShieldCheck,
  Star,
  Sun,
  User as UserIcon,
  Wallet,
} from 'lucide-react';
import type {
  AppRoute,
  Language,
  Listing,
  PaymentMethod,
  StatementEntry,
  ThemeMode,
  UserProfile,
} from '../types/dealkoro';
import { t } from '../i18n/translations';
import { computeStatementSummary, formatTk } from '../utils/dealMath';
import { ResilientImage } from './ResilientImage';

interface ProfileScreenProps {
  user: UserProfile;
  language: Language;
  theme: ThemeMode;
  subScreen:
    | 'profile'
    | 'your_posts'
    | 'personal_info'
    | 'settings'
    | 'security'
    | 'statement'
    | 'bookmarks'
    | 'help';
  listings: Listing[];
  bookmarks: string[];
  statements: StatementEntry[];
  onNavigate: (route: AppRoute) => void;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  onToggleLanguage: (lang: Language) => void;
  onToggleTheme: (next?: ThemeMode) => void;
  onLogout: () => void;
  onToggleBookmark: (listingId: string) => void;
}

export function ProfileScreen({
  user,
  language,
  theme,
  subScreen,
  listings,
  bookmarks,
  statements,
  onNavigate,
  onUpdateProfile,
  onToggleLanguage,
  onToggleTheme,
  onLogout,
  onToggleBookmark,
}: ProfileScreenProps) {
  const [editName, setEditName] = useState(user.displayName);
  const [editPhone, setEditPhone] = useState(user.phone);
  const [editPayout, setEditPayout] = useState<PaymentMethod>(user.payoutMethod);
  const [savedNotice, setSavedNotice] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);

  const handleCopyUid = () => {
    navigator.clipboard?.writeText(user.uid);
    setCopiedUid(true);
    window.setTimeout(() => setCopiedUid(false), 2000);
  };

  // Your Posts List
  if (subScreen === 'your_posts') {
    const myPosts = listings.filter((item) => item.sellerId === user.uid);
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">
            {t(language, 'yourPosts')}
          </h1>
          <button
            type="button"
            onClick={() => onNavigate({ screen: 'create_post' })}
            className="min-h-[40px] px-3.5 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700"
          >
            + New Post
          </button>
        </div>

        {myPosts.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              You have not posted any listings yet.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {myPosts.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate({ screen: 'post_detail', listingId: item.id })}
                className="w-full text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div className="p-3.5 flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800">
                  <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center justify-center">
                    {user.displayName.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {item.sellerName}
                  </span>
                </div>
                <div className="aspect-[16/9] bg-slate-900">
                  <ResilientImage
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-base font-bold text-slate-900 dark:text-white">
                      {item.title}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {item.linkType} · {item.server} · {item.status}
                    </div>
                  </div>
                  <div className="text-base font-bold text-blue-600 dark:text-blue-400 tabular-nums shrink-0">
                    {formatTk(item.price)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Personal Info Subscreen
  if (subScreen === 'personal_info') {
    return (
      <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          {t(language, 'personalInfo')}
        </h1>
        <div>
          <label
            htmlFor="pi-name"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
          >
            {t(language, 'fullName')}
          </label>
          <input
            id="pi-name"
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
          />
        </div>
        <div>
          <label
            htmlFor="pi-phone"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
          >
            Phone / Wallet Number
          </label>
          <input
            id="pi-phone"
            type="text"
            value={editPhone}
            onChange={(e) => setEditPhone(e.target.value)}
            className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
          />
        </div>
        <div>
          <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Preferred Payout Method
          </span>
          <div className="grid grid-cols-2 gap-2">
            {(['bKash', 'Nagad'] as PaymentMethod[]).map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => setEditPayout(method)}
                className={`min-h-[44px] rounded-xl text-sm font-semibold border transition-colors ${
                  editPayout === method
                    ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-600 text-blue-700 dark:text-blue-300'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                {method}
              </button>
            ))}
          </div>
        </div>

        {savedNotice && (
          <div className="p-3 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 rounded-xl">
            Profile saved successfully.
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            onUpdateProfile({
              displayName: editName.trim() || user.displayName,
              phone: editPhone.trim() || user.phone,
              payoutMethod: editPayout,
            });
            setSavedNotice(true);
          }}
          className="w-full min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Save Changes
        </button>
      </div>
    );
  }

  // Settings Subscreen (Language + Dark/Light Mode)
  if (subScreen === 'settings') {
    return (
      <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          {t(language, 'settings')}
        </h1>

        <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              {t(language, 'appearance')}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {language === 'bn' ? 'লাইট বা ডার্ক মোড নির্বাচন করুন' : 'Switch Light or Dark mode'}
            </div>
          </div>
          <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => onToggleTheme('light')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 ${
                theme === 'light'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>{t(language, 'lightMode')}</span>
            </button>
            <button
              type="button"
              onClick={() => onToggleTheme('dark')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 ${
                theme === 'dark'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <Moon className="w-3.5 h-3.5 text-blue-400" />
              <span>{t(language, 'darkMode')}</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              Language (BN / EN)
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Switch interface language
            </div>
          </div>
          <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => onToggleLanguage('bn')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                language === 'bn'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              বাংলা
            </button>
            <button
              type="button"
              onClick={() => onToggleLanguage('en')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                language === 'en'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              English
            </button>
          </div>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400">
          Account Role:{' '}
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {user.role.toUpperCase()}
          </span>
        </div>
      </div>
    );
  }

  // Security Subscreen
  if (subScreen === 'security') {
    return (
      <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          {t(language, 'securityLogin')}
        </h1>
        <div className="p-4 bg-slate-50 dark:bg-slate-800/70 rounded-xl space-y-1.5 text-sm">
          <div className="font-semibold text-slate-900 dark:text-white">Primary Contact</div>
          <div className="text-slate-600 dark:text-slate-300">{user.email}</div>
          <div className="text-slate-600 dark:text-slate-300">{user.phone}</div>
          <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Account UID
              </div>
              <div className="text-xs font-mono text-slate-800 dark:text-slate-200 truncate">
                {user.uid}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyUid}
              className="min-h-[34px] px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1 shrink-0"
            >
              {copiedUid ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedUid ? 'Copied' : 'Copy UID'}</span>
            </button>
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2 text-xs text-slate-700 dark:text-slate-300">
          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Active Escrow Protections</span>
          </div>
          <div>• Authoritative Admin Roles enforced in Firestore Rules</div>
          <div>• Official escrow payment contacts locked against buyer/seller tampering</div>
          <div>• Seller payouts &amp; payment verification strictly Admin-only</div>
        </div>

        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 rounded-xl text-xs text-emerald-800 dark:text-emerald-300">
          Escrow Deal Verification is active. Never share Konami or Google credentials outside an official Admin Deal group chat.
        </div>
      </div>
    );
  }

  // Statement (Income, Buy & Sell Ledger)
  if (subScreen === 'statement') {
    const myStatements = statements.filter(
      (s) => s.userId === user.uid || (user.role === 'admin' && s.type === 'admin_fee_income')
    );
    const summary = computeStatementSummary(myStatements);

    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          {t(language, 'statement')}
        </h1>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">Sell Income</div>
            <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-1">
              {formatTk(summary.totalSellIncome)}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">Admin Fee Income</div>
            <div className="text-xl font-bold text-blue-700 dark:text-blue-400 tabular-nums mt-1">
              {formatTk(summary.totalAdminIncome)}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">Total Spent (Buy)</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
              {formatTk(summary.totalBuySpend)}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800">
          {myStatements.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No completed deal statements yet. Complete an Admin Deal to see income &amp; payout history.
            </div>
          ) : (
            myStatements.map((entry) => (
              <div key={entry.id} className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {entry.title}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {entry.method} · {new Date(entry.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div
                  className={`text-sm font-bold tabular-nums shrink-0 ${
                    entry.type === 'buy_payment'
                      ? 'text-slate-900 dark:text-white'
                      : 'text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  {entry.type === 'buy_payment' ? '-' : '+'}
                  {formatTk(entry.netAmount)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // Bookmarks
  if (subScreen === 'bookmarks') {
    const saved = listings.filter((l) => bookmarks.includes(l.id));
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          {t(language, 'bookmark')}
        </h1>
        {saved.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No bookmarked listings yet.
          </div>
        ) : (
          <div className="space-y-3">
            {saved.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3"
              >
                <button
                  type="button"
                  onClick={() => onNavigate({ screen: 'post_detail', listingId: item.id })}
                  className="text-left min-w-0 flex-1"
                >
                  <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {item.title}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {item.category} · {formatTk(item.price)}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleBookmark(item.id)}
                  className="min-h-[40px] px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Help & Feedback
  if (subScreen === 'help') {
    return (
      <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
          <HelpCircle className="w-5 h-5" />
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">
            {t(language, 'helpFeedback')}
          </h1>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          Every DEALKORO deal is protected by a Verified Admin mediator. Normal Deal escrow fee is Tk 20/-, Ultimate Safe Deal is Tk 60/-, Cross Deal (bKash ↔ Nagad) is Tk 30/-, and optional iOS / Google Bind checks are Tk 20/- each.
        </p>
        <button
          type="button"
          onClick={() => onNavigate({ screen: 'inbox' })}
          className="min-h-[44px] px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700"
        >
          Message Support Desk
        </button>
      </div>
    );
  }

  // Primary User Profile
  return (
    <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="text-center">
        <div className="relative inline-block">
          <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-slate-200 dark:border-slate-700 mx-auto bg-slate-100 dark:bg-slate-800">
            <ResilientImage
              src={user.avatarUrl}
              alt={user.displayName}
              className="w-full h-full object-cover"
            />
          </div>
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-emerald-700 text-white text-xs font-bold tabular-nums shadow-xs">
            {user.level}
          </span>
        </div>

        <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
          {user.displayName}
        </h1>
        <div className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          {user.email}
        </div>
        <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">UID:</span>
          <span className="text-[11px] font-mono text-slate-800 dark:text-slate-200 max-w-[170px] truncate">
            {user.uid}
          </span>
          <button
            type="button"
            onClick={handleCopyUid}
            aria-label="Copy Account UID"
            className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 inline-flex items-center gap-1"
          >
            {copiedUid ? (
              <Check className="w-3 h-3 text-emerald-600" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            <span>{copiedUid ? 'Copied' : 'Copy UID'}</span>
          </button>
        </div>

        <div className="mt-2 flex items-center justify-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white tabular-nums">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
            ))}
          </div>
          <span>{user.rating.toFixed(1)}</span>
        </div>
      </div>

      {/* Sell / Buy / Joined Counters */}
      <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800 border-y border-slate-100 dark:border-slate-800 py-4 text-center">
        <div>
          <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {user.sellCount}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t(language, 'sellStat')}
          </div>
        </div>
        <div>
          <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {user.buyCount}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t(language, 'buyStat')}
          </div>
        </div>
        <div>
          <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
            {user.joinedLabel}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t(language, 'joinedStat')}
          </div>
        </div>
      </div>

      {/* Menu Rows */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {[
          {
            label: t(language, 'yourPosts'),
            icon: <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400" />,
            action: () => onNavigate({ screen: 'your_posts' }),
          },
          {
            label: t(language, 'personalInfo'),
            icon: <UserIcon className="w-4 h-4 text-slate-500 dark:text-slate-400" />,
            action: () => onNavigate({ screen: 'personal_info' }),
          },
          {
            label: t(language, 'statement'),
            icon: <Wallet className="w-4 h-4 text-slate-500 dark:text-slate-400" />,
            action: () => onNavigate({ screen: 'statement' }),
          },
          {
            label: t(language, 'bookmark'),
            icon: <Bookmark className="w-4 h-4 text-slate-500 dark:text-slate-400" />,
            action: () => onNavigate({ screen: 'bookmarks' }),
          },
          {
            label: t(language, 'settings'),
            icon: <Settings className="w-4 h-4 text-slate-500 dark:text-slate-400" />,
            action: () => onNavigate({ screen: 'settings' }),
          },
          {
            label: t(language, 'securityLogin'),
            icon: <ShieldCheck className="w-4 h-4 text-slate-500 dark:text-slate-400" />,
            action: () => onNavigate({ screen: 'security' }),
          },
        ].map((row) => (
          <button
            key={row.label}
            type="button"
            onClick={row.action}
            className="w-full min-h-[52px] py-3 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800 px-2 rounded-xl transition-colors"
          >
            <span className="flex items-center gap-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
              {row.icon}
              <span>{row.label}</span>
            </span>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        ))}

        <button
          type="button"
          onClick={onLogout}
          className="w-full min-h-[52px] py-3 flex items-center justify-between text-left hover:bg-red-50 dark:hover:bg-red-950/40 px-2 rounded-xl transition-colors"
        >
          <span className="flex items-center gap-3 text-sm font-semibold text-red-600 dark:text-red-400">
            <LogOut className="w-4 h-4" />
            <span>{t(language, 'logout')}</span>
          </span>
          <ChevronRight className="w-4 h-4 text-red-400" />
        </button>
      </div>
    </div>
  );
}
