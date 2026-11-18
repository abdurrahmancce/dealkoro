import React, { useState } from 'react';
import {
  Bookmark,
  ChevronRight,
  FileText,
  HelpCircle,
  LogOut,
  Settings,
  ShieldCheck,
  Star,
  User as UserIcon,
  Wallet,
} from 'lucide-react';
import type {
  AppRoute,
  Language,
  Listing,
  PaymentMethod,
  StatementEntry,
  UserProfile,
} from '../types/dealkoro';
import { t } from '../i18n/translations';
import { computeStatementSummary, formatTk } from '../utils/dealMath';
import { ResilientImage } from './ResilientImage';

interface ProfileScreenProps {
  user: UserProfile;
  language: Language;
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
  onLogout: () => void;
  onToggleBookmark: (listingId: string) => void;
}

export function ProfileScreen({
  user,
  language,
  subScreen,
  listings,
  bookmarks,
  statements,
  onNavigate,
  onUpdateProfile,
  onToggleLanguage,
  onLogout,
  onToggleBookmark,
}: ProfileScreenProps) {
  const [editName, setEditName] = useState(user.displayName);
  const [editPhone, setEditPhone] = useState(user.phone);
  const [editPayout, setEditPayout] = useState<PaymentMethod>(user.payoutMethod);
  const [savedNotice, setSavedNotice] = useState(false);

  // Screen 08: Your Posts List
  if (subScreen === 'your_posts') {
    const myPosts = listings.filter((item) => item.sellerId === user.uid);
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-900">
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
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
            <p className="text-sm text-slate-500">You have not posted any listings yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {myPosts.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate({ screen: 'post_detail', listingId: item.id })}
                className="w-full text-left bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-slate-300 transition-colors"
              >
                <div className="p-3.5 flex items-center gap-2.5 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center">
                    {user.displayName.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-semibold text-slate-900 truncate">
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
                    <div className="text-base font-bold text-slate-900">{item.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {item.linkType} · {item.server} · {item.status}
                    </div>
                  </div>
                  <div className="text-base font-bold text-blue-600 tabular-nums shrink-0">
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
      <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
        <h1 className="text-lg font-bold text-slate-900">{t(language, 'personalInfo')}</h1>
        <div>
          <label htmlFor="pi-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
            {t(language, 'fullName')}
          </label>
          <input
            id="pi-name"
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full min-h-[44px] px-3.5 py-2 text-sm border border-slate-300 rounded-xl"
          />
        </div>
        <div>
          <label htmlFor="pi-phone" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Phone / Wallet Number
          </label>
          <input
            id="pi-phone"
            type="text"
            value={editPhone}
            onChange={(e) => setEditPhone(e.target.value)}
            className="w-full min-h-[44px] px-3.5 py-2 text-sm border border-slate-300 rounded-xl"
          />
        </div>
        <div>
          <span className="block text-xs font-semibold text-slate-700 mb-1.5">
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
                    ? 'bg-blue-50 border-blue-600 text-blue-700'
                    : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                {method}
              </button>
            ))}
          </div>
        </div>

        {savedNotice && (
          <div className="p-3 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl">
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

  // Settings Subscreen
  if (subScreen === 'settings') {
    return (
      <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5">
        <h1 className="text-lg font-bold text-slate-900">{t(language, 'settings')}</h1>
        <div className="flex items-center justify-between py-2 border-b border-slate-100">
          <div>
            <div className="text-sm font-semibold text-slate-900">Language (BN / EN)</div>
            <div className="text-xs text-slate-500">Switch interface language</div>
          </div>
          <div className="inline-flex bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => onToggleLanguage('bn')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                language === 'bn' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              বাংলা
            </button>
            <button
              type="button"
              onClick={() => onToggleLanguage('en')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                language === 'en' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              English
            </button>
          </div>
        </div>
        <div className="text-xs text-slate-500">
          Account Role: <span className="font-semibold text-slate-800">{user.role.toUpperCase()}</span>
        </div>
      </div>
    );
  }

  // Security Subscreen
  if (subScreen === 'security') {
    return (
      <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
        <h1 className="text-lg font-bold text-slate-900">{t(language, 'securityLogin')}</h1>
        <div className="p-4 bg-slate-50 rounded-xl space-y-1.5 text-sm">
          <div className="font-semibold text-slate-900">Primary Contact</div>
          <div className="text-slate-600">{user.email}</div>
          <div className="text-slate-600">{user.phone}</div>
        </div>
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
          Escrow Deal Verification is active. Never share Konami or Google credentials outside an official Admin Deal group chat.
        </div>
      </div>
    );
  }

  // Drawer: Statement (Income, Buy & Sell Ledger)
  if (subScreen === 'statement') {
    const myStatements = statements.filter(
      (s) => s.userId === user.uid || (user.role === 'admin' && s.type === 'admin_fee_income')
    );
    const summary = computeStatementSummary(myStatements);

    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-lg font-bold text-slate-900">{t(language, 'statement')}</h1>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="text-xs text-slate-500">Sell Income</div>
            <div className="text-xl font-bold text-emerald-700 tabular-nums mt-1">
              {formatTk(summary.totalSellIncome)}
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="text-xs text-slate-500">Admin Fee Income</div>
            <div className="text-xl font-bold text-blue-700 tabular-nums mt-1">
              {formatTk(summary.totalAdminIncome)}
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="text-xs text-slate-500">Total Spent (Buy)</div>
            <div className="text-xl font-bold text-slate-900 tabular-nums mt-1">
              {formatTk(summary.totalBuySpend)}
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
          {myStatements.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No completed deal statements yet. Complete an Admin Deal to see income & payout history.
            </div>
          ) : (
            myStatements.map((entry) => (
              <div key={entry.id} className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {entry.title}
                    </div>
                    <div className="text-xs text-slate-500">
                      {entry.method} · {new Date(entry.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div
                  className={`text-sm font-bold tabular-nums shrink-0 ${
                    entry.type === 'buy_payment' ? 'text-slate-900' : 'text-emerald-700'
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

  // Drawer: Bookmarks
  if (subScreen === 'bookmarks') {
    const saved = listings.filter((l) => bookmarks.includes(l.id));
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-lg font-bold text-slate-900">{t(language, 'bookmark')}</h1>
        {saved.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
            No bookmarked listings yet.
          </div>
        ) : (
          <div className="space-y-3">
            {saved.map((item) => (
              <div
                key={item.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3"
              >
                <button
                  type="button"
                  onClick={() => onNavigate({ screen: 'post_detail', listingId: item.id })}
                  className="text-left min-w-0 flex-1"
                >
                  <div className="text-sm font-bold text-slate-900 truncate">{item.title}</div>
                  <div className="text-xs text-slate-500">
                    {item.category} · {formatTk(item.price)}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleBookmark(item.id)}
                  className="min-h-[40px] px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-xl"
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

  // Drawer: Help & Feedback
  if (subScreen === 'help') {
    return (
      <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-blue-600">
          <HelpCircle className="w-5 h-5" />
          <h1 className="text-lg font-bold text-slate-900">{t(language, 'helpFeedback')}</h1>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
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

  // Screen 06: Primary User Profile
  return (
    <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
      <div className="text-center">
        <div className="relative inline-block">
          <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-slate-200 mx-auto bg-slate-100">
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

        <h1 className="mt-4 text-xl font-bold text-slate-900">{user.displayName}</h1>
        <div className="mt-1 text-xs font-medium text-slate-500">{user.email}</div>

        <div className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-slate-900 tabular-nums">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
            ))}
          </div>
          <span>{user.rating.toFixed(1)}</span>
        </div>
      </div>

      {/* Sell / Buy / Joined Counters */}
      <div className="grid grid-cols-3 divide-x divide-slate-100 border-y border-slate-100 py-4 text-center">
        <div>
          <div className="text-xl font-bold text-emerald-700 tabular-nums">
            {user.sellCount}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{t(language, 'sellStat')}</div>
        </div>
        <div>
          <div className="text-xl font-bold text-emerald-700 tabular-nums">
            {user.buyCount}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{t(language, 'buyStat')}</div>
        </div>
        <div>
          <div className="text-lg font-bold text-emerald-700 whitespace-nowrap">
            {user.joinedLabel}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{t(language, 'joinedStat')}</div>
        </div>
      </div>

      {/* Menu Rows matching Screen 06 */}
      <div className="divide-y divide-slate-100">
        {[
          {
            label: t(language, 'yourPosts'),
            icon: <FileText className="w-4 h-4 text-slate-500" />,
            action: () => onNavigate({ screen: 'your_posts' }),
          },
          {
            label: t(language, 'personalInfo'),
            icon: <UserIcon className="w-4 h-4 text-slate-500" />,
            action: () => onNavigate({ screen: 'personal_info' }),
          },
          {
            label: t(language, 'statement'),
            icon: <Wallet className="w-4 h-4 text-slate-500" />,
            action: () => onNavigate({ screen: 'statement' }),
          },
          {
            label: t(language, 'bookmark'),
            icon: <Bookmark className="w-4 h-4 text-slate-500" />,
            action: () => onNavigate({ screen: 'bookmarks' }),
          },
          {
            label: t(language, 'settings'),
            icon: <Settings className="w-4 h-4 text-slate-500" />,
            action: () => onNavigate({ screen: 'settings' }),
          },
          {
            label: t(language, 'securityLogin'),
            icon: <ShieldCheck className="w-4 h-4 text-slate-500" />,
            action: () => onNavigate({ screen: 'security' }),
          },
        ].map((row) => (
          <button
            key={row.label}
            type="button"
            onClick={row.action}
            className="w-full min-h-[52px] py-3 flex items-center justify-between text-left hover:bg-slate-50 px-2 rounded-xl transition-colors"
          >
            <span className="flex items-center gap-3 text-sm font-semibold text-slate-800">
              {row.icon}
              <span>{row.label}</span>
            </span>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        ))}

        <button
          type="button"
          onClick={onLogout}
          className="w-full min-h-[52px] py-3 flex items-center justify-between text-left hover:bg-red-50 px-2 rounded-xl transition-colors"
        >
          <span className="flex items-center gap-3 text-sm font-semibold text-red-600">
            <LogOut className="w-4 h-4" />
            <span>{t(language, 'logout')}</span>
          </span>
          <ChevronRight className="w-4 h-4 text-red-400" />
        </button>
      </div>
    </div>
  );
}
