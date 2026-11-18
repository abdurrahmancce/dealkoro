import React from 'react';
import { CheckCircle2, Lock, Moon, ShieldCheck, Sun, Wallet } from 'lucide-react';
import type { Language, ThemeMode } from '../types/dealkoro';
import { t } from '../i18n/translations';
import { BOOTSTRAP_ADMIN_EMAIL } from '../services/dealkoroService';
import { OfflineIndicator, PWAInstallButton } from './PWAInstallButton';

interface AuthScreenProps {
  language: Language;
  theme: ThemeMode;
  onToggleLanguage: (lang: Language) => void;
  onToggleTheme: (next?: ThemeMode) => void;
  onGoogleSignIn: () => Promise<void>;
  googleLoading: boolean;
  authError: string | null;
}

export function AuthScreen({
  language,
  theme,
  onToggleLanguage,
  onToggleTheme,
  onGoogleSignIn,
  googleLoading,
  authError,
}: AuthScreenProps) {
  const isBn = language === 'bn';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col lg:flex-row transition-colors">
      {/* Left Brand Showcase on Desktop */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 dark:bg-slate-900/95 text-white p-12 flex-col justify-between border-r border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2.5 text-blue-400 font-semibold text-sm">
            <ShieldCheck className="w-5 h-5" />
            <span>Verified Escrow Mediation</span>
          </div>
          <h1 className="mt-8 text-4xl font-bold tracking-tight text-white max-w-md leading-tight">
            {t(language, 'brand')}
          </h1>
          <p className="mt-4 text-slate-300 text-base max-w-md leading-relaxed">
            {t(language, 'tagline')}
          </p>

          <ul className="mt-8 space-y-3 text-sm text-slate-300">
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <span>
                Firebase Google Authentication with server-verified user &amp; admin roles
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              <span>
                Admin-locked escrow payment verification, anti-tamper deal fields &amp; payout release
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Wallet className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <span>
                Live multi-device Firestore sync for deals, chat, and statements
              </span>
            </li>
          </ul>
        </div>

        <div className="grid grid-cols-3 gap-6 border-t border-slate-800 pt-8">
          <div>
            <div className="text-2xl font-bold tabular-nums text-white">Tk 20/-</div>
            <div className="text-xs text-slate-400 mt-1">Normal Deal Escrow</div>
          </div>
          <div>
            <div className="text-2xl font-bold tabular-nums text-white">Tk 60/-</div>
            <div className="text-xs text-slate-400 mt-1">Ultimate Safe Deal</div>
          </div>
          <div>
            <div className="text-2xl font-bold tabular-nums text-white">bKash / Nagad</div>
            <div className="text-xs text-slate-400 mt-1">Cross Deal Ready</div>
          </div>
        </div>
      </div>

      {/* Real Firebase Google Sign-In Card */}
      <main className="flex-1 flex flex-col justify-center items-center p-4 sm:p-8">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 inline-flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>{isBn ? 'নিরাপদ এস্ক্রো লগইন' : 'Verified Escrow Auth'}</span>
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onToggleTheme()}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                className="min-w-[36px] min-h-[34px] px-2.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 inline-flex items-center justify-center gap-1 text-xs font-semibold transition-colors"
              >
                {theme === 'dark' ? (
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Moon className="w-3.5 h-3.5 text-slate-700" />
                )}
              </button>

              <div
                className="inline-flex items-center bg-slate-100 dark:bg-slate-800 rounded-full p-1"
                role="group"
                aria-label="Language switch"
              >
                <button
                  type="button"
                  onClick={() => onToggleLanguage('bn')}
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors whitespace-nowrap ${
                    isBn
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  BN
                </button>
                <button
                  type="button"
                  onClick={() => onToggleLanguage('en')}
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors whitespace-nowrap ${
                    !isBn
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  EN
                </button>
              </div>
            </div>
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {t(language, 'brand')}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {t(language, 'tagline')}
            </p>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2 text-xs text-slate-700 dark:text-slate-300">
            <div className="font-bold text-slate-900 dark:text-white">
              {isBn
                ? 'রিয়েল-ওয়ার্ল্ড সিকিউরিটি চালু আছে'
                : 'Real-World Security Active'}
            </div>
            <p className="leading-relaxed">
              {isBn
                ? 'অ্যাকাউন্ট কেনা, বেচা এবং এস্ক্রো ডিলে অংশ নিতে ভেরিফাইড Google অ্যাকাউন্ট দিয়ে সাইন ইন করুন। অ্যাডমিন অ্যাক্সেস Firestore Security Rules দ্বারা যাচাই করা হয়।'
                : 'Sign in with a verified Google account to post listings, chat, and trade through admin escrow. Admin privileges and payment contacts are protected by Firestore rules.'}
            </p>
          </div>

          {authError && (
            <div
              role="alert"
              className="p-3 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl"
            >
              {authError}
            </div>
          )}

          <button
            type="button"
            disabled={googleLoading}
            onClick={() => void onGoogleSignIn()}
            className="w-full min-h-[48px] py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-3 disabled:opacity-60 shadow-xs cursor-pointer"
          >
            <span className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                />
              </svg>
            </span>
            <span>
              {googleLoading
                ? isBn
                  ? 'সংযোগ হচ্ছে...'
                  : 'Connecting to Google...'
                : t(language, 'continueGoogle')}
            </span>
          </button>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center justify-between gap-2">
              <span>{isBn ? 'অ্যাডমিন ইমেইল' : 'Bootstrap Admin'}</span>
              <span className="font-mono text-slate-700 dark:text-slate-300 truncate">
                {BOOTSTRAP_ADMIN_EMAIL}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>{isBn ? 'এস্ক্রো মাধ্যম' : 'Escrow Rails'}</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                bKash · Nagad · Cross Deal
              </span>
            </div>
            <div className="pt-2">
              <PWAInstallButton language={language} showGuideFallback />
            </div>
          </div>
        </div>
      </main>
      <OfflineIndicator language={language} />
    </div>
  );
}
