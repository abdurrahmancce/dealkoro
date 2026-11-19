import React, { useState } from 'react';
import { CheckCircle2, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import type { Language, TeamVerificationInvite } from '../types/dealkoro';
import { formatStaffRoleLabel } from '../utils/payloadSanitizer';

interface TeamVerificationBannerProps {
  language: Language;
  pendingInvites: TeamVerificationInvite[];
  onClaimInvite: (
    invite: TeamVerificationInvite,
    verification: {
      phone: string;
      idLast4: string;
      code: string;
    }
  ) => Promise<{ ok: boolean; error?: string }>;
}

export function TeamVerificationBanner({
  language,
  pendingInvites,
  onClaimInvite,
}: TeamVerificationBannerProps) {
  const isBn = language === 'bn';
  const [phoneInput, setPhoneInput] = useState('');
  const [idLast4Input, setIdLast4Input] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activatedMsg, setActivatedMsg] = useState<string | null>(null);

  if (pendingInvites.length === 0 && !activatedMsg) {
    return null;
  }

  if (activatedMsg) {
    return (
      <div
        role="status"
        className="mb-4 p-4 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 rounded-2xl flex items-center gap-3 text-sm font-semibold text-emerald-800 dark:text-emerald-200"
      >
        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span>{activatedMsg}</span>
      </div>
    );
  }

  const invite = pendingInvites[0];
  const roleLabel = formatStaffRoleLabel(invite.staffRole);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    const res = await onClaimInvite(invite, {
      phone: phoneInput,
      idLast4: idLast4Input,
      code: codeInput,
    });
    setSubmitting(false);
    if (!res.ok) {
      setErrorMsg(res.error || 'Smart verification failed. Check your mobile, ID, and code.');
      return;
    }
    setActivatedMsg(
      isBn
        ? `অভিনন্দন! আপনার ${roleLabel} অ্যাকাউন্ট স্মার্ট ভেরিফিকেশনের মাধ্যমে সক্রিয় হয়েছে।`
        : `Smart verification complete! You are now active as ${roleLabel} for DEALKORO Escrow.`
    );
  };

  return (
    <section
      aria-label="Staff appointment smart verification"
      className="mb-5 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-2xl p-5 space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-blue-700 dark:text-blue-400">
              {isBn ? 'অ্যাডমিন টিম নিয়োগ আমন্ত্রণ' : 'Team Appointment Verification'} · {roleLabel}
            </div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              {invite.candidateName},{' '}
              {isBn
                ? 'আপনার স্মার্ট ভেরিফিকেশন সম্পন্ন করুন'
                : 'confirm your identity to activate access'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Email: {invite.candidateEmail} · {invite.idType} ending **
              <span className="font-mono font-semibold">{invite.idLast4}</span> · Specialty:{' '}
              {invite.specialty}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
        <div>
          <label
            htmlFor="claim-phone"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
          >
            {isBn ? 'নিবন্ধিত মোবাইল' : 'Registered BD Mobile'}
          </label>
          <input
            id="claim-phone"
            type="tel"
            inputMode="tel"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            placeholder="01XXXXXXXXX"
            required
            className="w-full min-h-[42px] px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
          />
        </div>

        <div>
          <label
            htmlFor="claim-id-last4"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
          >
            {invite.idType} Last 4 Digits
          </label>
          <input
            id="claim-id-last4"
            type="text"
            maxLength={8}
            value={idLast4Input}
            onChange={(e) => setIdLast4Input(e.target.value.toUpperCase())}
            placeholder="e.g. 4210"
            required
            className="w-full min-h-[42px] px-3 py-2 text-xs font-mono uppercase bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
          />
        </div>

        <div>
          <label
            htmlFor="claim-code"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
          >
            {isBn ? '৬-ডিজিট কোড' : '6-Digit Verification Code'}
          </label>
          <input
            id="claim-code"
            type="text"
            inputMode="numeric"
            maxLength={12}
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="6-digit code"
            required
            className="w-full min-h-[42px] px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="min-h-[42px] px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <KeyRound className="w-4 h-4" />
          )}
          <span>{isBn ? 'ভেরিফাই ও সক্রিয় করুন' : `Activate ${roleLabel}`}</span>
        </button>
      </form>

      {errorMsg && (
        <div
          role="alert"
          className="p-2.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl"
        >
          {errorMsg}
        </div>
      )}
    </section>
  );
}
