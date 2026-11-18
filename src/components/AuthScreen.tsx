import React, { useState } from 'react';
import { ShieldCheck, Lock, Mail, User, ArrowRight } from 'lucide-react';
import type { AuthTab, Language, UserProfile } from '../types/dealkoro';
import { t } from '../i18n/translations';
import { DEMO_USERS } from '../data/seedData';
import { createDemoAccount } from '../services/dealkoroService';

interface AuthScreenProps {
  language: Language;
  onToggleLanguage: (lang: Language) => void;
  onAuthSuccess: (user: UserProfile) => void;
  onGoogleSignIn: () => Promise<void>;
  googleLoading: boolean;
  authError: string | null;
}

export function AuthScreen({
  language,
  onToggleLanguage,
  onAuthSuccess,
  onGoogleSignIn,
  googleLoading,
  authError,
}: AuthScreenProps) {
  const [activeTab, setActiveTab] = useState<AuthTab>('login');
  const [fullName, setFullName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setForgotSent(false);

    if (!identifier.trim()) {
      setFormError(
        language === 'bn'
          ? 'অনুগ্রহ করে ইমেইল বা ফোন নম্বর দিন।'
          : 'Please enter your email or phone number.'
      );
      return;
    }
    if (password.trim().length < 4) {
      setFormError(
        language === 'bn'
          ? 'পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে।'
          : 'Password must be at least 4 characters.'
      );
      return;
    }
    if (activeTab === 'signup' && fullName.trim().length < 2) {
      setFormError(
        language === 'bn' ? 'আপনার পূর্ণ নাম লিখুন।' : 'Please enter your full name.'
      );
      return;
    }

    const lower = identifier.trim().toLowerCase();
    if (activeTab === 'admin') {
      if (lower.includes('abdur') || lower.includes('admin')) {
        onAuthSuccess(DEMO_USERS.admin);
        return;
      }
      onAuthSuccess(
        createDemoAccount({
          name: fullName || 'Escrow Admin',
          identifier,
          role: 'admin',
        })
      );
      return;
    }

    if (activeTab === 'login') {
      if (lower.includes('salim')) {
        onAuthSuccess(DEMO_USERS.buyer);
        return;
      }
      if (lower.includes('junaied') || lower.includes('abdullah')) {
        onAuthSuccess(DEMO_USERS.seller);
        return;
      }
    }

    onAuthSuccess(
      createDemoAccount({
        name: fullName || identifier.split('@')[0] || 'DEALKORO Member',
        identifier,
        role: 'user',
      })
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Left Brand Showcase on Desktop */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 text-white p-12 flex-col justify-between">
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

      {/* Auth Form Card (Screen 01 Wireframe Layout) */}
      <div className="flex-1 flex flex-col justify-center items-center p-4 sm:p-8">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          {/* Top Language Switch */}
          <div className="flex items-center justify-between mb-6">
            <span className="text-xs font-medium text-slate-500 lg:hidden">
              Escrow Marketplace
            </span>
            <div
              className="ml-auto inline-flex items-center bg-slate-100 rounded-full p-1"
              role="group"
              aria-label="Language switch"
            >
              <button
                type="button"
                onClick={() => onToggleLanguage('bn')}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors whitespace-nowrap ${
                  language === 'bn'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                BN
              </button>
              <button
                type="button"
                onClick={() => onToggleLanguage('en')}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors whitespace-nowrap ${
                  language === 'en'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                EN
              </button>
            </div>
          </div>

          <div className="text-center mb-6">
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
              {t(language, 'brand')}
            </h2>
            <p className="text-xs text-slate-500 mt-1.5">{t(language, 'tagline')}</p>
          </div>

          {/* Segmented Tabs: LOGIN | SIGN UP | ADMIN */}
          <div
            className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl mb-6"
            role="tablist"
          >
            {(['login', 'signup', 'admin'] as AuthTab[]).map((tab) => {
              const labelKey =
                tab === 'login' ? 'loginTab' : tab === 'signup' ? 'signupTab' : 'adminTab';
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setActiveTab(tab);
                    setFormError(null);
                  }}
                  className={`min-h-[40px] px-2 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t(language, labelKey)}
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {activeTab === 'signup' && (
              <div>
                <label
                  htmlFor="auth-fullname"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  {t(language, 'fullName')}
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-fullname"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={t(language, 'enterFullName')}
                    className="w-full min-h-[44px] pl-10 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  />
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="auth-identifier"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                {t(language, 'emailOrPhone')}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={t(language, 'enterEmailOrPhone')}
                  className="w-full min-h-[44px] pl-10 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                {t(language, 'password')}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full min-h-[44px] pl-10 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
            </div>

            {(formError || authError) && (
              <div
                role="alert"
                className="p-3 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl"
              >
                {formError || authError}
              </div>
            )}

            {forgotSent && (
              <div className="p-3 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl">
                {language === 'bn'
                  ? 'পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে (যদি অ্যাকাউন্ট থাকে)।'
                  : 'Password recovery instructions prepared for your contact.'}
              </div>
            )}

            <button
              type="submit"
              className="w-full min-h-[46px] py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <span>
                {activeTab === 'login'
                  ? t(language, 'loginBtn')
                  : activeTab === 'signup'
                  ? t(language, 'signupBtn')
                  : t(language, 'adminLoginBtn')}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setForgotSent(true)}
                className="text-xs font-medium text-blue-600 hover:underline py-1"
              >
                {t(language, 'forgotPassword')}
              </button>
            </div>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-400">or</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <button
            type="button"
            disabled={googleLoading}
            onClick={() => void onGoogleSignIn()}
            className="w-full min-h-[44px] py-2.5 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2.5 disabled:opacity-60"
          >
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
            <span>
              {googleLoading ? 'Connecting...' : t(language, 'continueGoogle')}
            </span>
          </button>

          {/* Quick Role Access for testing Seller, Buyer, Admin journeys */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-500 mb-2.5 text-center">
              {t(language, 'quickDemoTitle')}
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onAuthSuccess(DEMO_USERS.seller)}
                className="min-h-[46px] px-2 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex flex-col items-center justify-center leading-tight"
              >
                <span className="font-bold text-slate-900">Seller</span>
                <span className="text-[11px] text-slate-500">Abdullah</span>
              </button>
              <button
                type="button"
                onClick={() => onAuthSuccess(DEMO_USERS.buyer)}
                className="min-h-[46px] px-2 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex flex-col items-center justify-center leading-tight"
              >
                <span className="font-bold text-slate-900">Buyer</span>
                <span className="text-[11px] text-slate-500">Salim Khan</span>
              </button>
              <button
                type="button"
                onClick={() => onAuthSuccess(DEMO_USERS.admin)}
                className="min-h-[46px] px-2 py-2 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors flex flex-col items-center justify-center leading-tight"
              >
                <span className="font-bold text-blue-800">Admin</span>
                <span className="text-[11px] text-blue-600">Abdur</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
