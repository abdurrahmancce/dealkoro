import React, { useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import type { Language } from '../types/dealkoro';

interface PWAInstallButtonProps {
  language?: Language;
  compact?: boolean;
  showGuideFallback?: boolean;
}

export function PWAInstallButton({
  language = 'en',
  compact = false,
  showGuideFallback = false,
}: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const isBn = language === 'bn';

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className={
          compact
            ? 'min-h-[40px] px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors'
            : 'w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors'
        }
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>{isBn ? 'অ্যাপ ইনস্টল করুন' : 'Install App'}</span>
      </button>
    );
  }

  if (!isIOS && !showGuideFallback) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        className={
          compact
            ? 'min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors'
            : 'w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors'
        }
      >
        <Smartphone className="w-4 h-4 shrink-0" />
        <span>
          {isIOS
            ? isBn
              ? 'iPhone-এ ইনস্টল করুন'
              : 'Install on iOS'
            : isBn
            ? 'অ্যাপ হিসেবে ইনস্টল'
            : 'Install App'}
        </span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Install DEALKORO app instructions"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isBn ? 'DEALKORO অ্যাপ ইনস্টল গাইড' : 'Install DEALKORO App'}
              </h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Close install instructions"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <ol className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 space-y-2 list-decimal pl-4">
                <li>
                  {isBn
                    ? 'Safari ব্রাউজারের নিচে Share বাটনে ট্যাপ করুন।'
                    : 'Tap the Share icon in your Safari toolbar.'}
                </li>
                <li>
                  {isBn
                    ? 'নিচে স্ক্রল করে "Add to Home Screen" সিলেক্ট করুন।'
                    : 'Scroll down and tap "Add to Home Screen".'}
                </li>
                <li>
                  {isBn
                    ? '"Add" চাপলেই হোম স্ক্রিনে অ্যাপ ইনস্টল হবে।'
                    : 'Tap "Add" to launch DEALKORO like a native app.'}
                </li>
              </ol>
            ) : (
              <ol className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 space-y-2 list-decimal pl-4">
                <li>
                  {isBn
                    ? 'Chrome / Edge ব্রাউজারে শেয়ার করা অ্যাপ লিংকটি সরাসরি নতুন ট্যাবে খুলুন।'
                    : 'Open the shared DEALKORO URL directly in Chrome or Edge.'}
                </li>
                <li>
                  {isBn
                    ? 'অ্যাড্রেস বারের ডানদিকে Install আইকন অথবা ব্রাউজার মেনু → "Install DEALKORO" / "Add to Home screen" ট্যাপ করুন।'
                    : 'Click the Install icon in the address bar or Browser Menu → "Install DEALKORO" / "Add to Home screen".'}
                </li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full min-h-[42px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors"
            >
              {isBn ? 'বুঝেছি' : 'Got it'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function OfflineIndicator({ language = 'en' }: { language?: Language }) {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 lg:bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>
        {language === 'bn'
          ? 'অফলাইন মোড — ক্যাশ করা ডেটা দেখানো হচ্ছে'
          : 'Offline Mode — Showing cached data'}
      </span>
    </div>
  );
}
