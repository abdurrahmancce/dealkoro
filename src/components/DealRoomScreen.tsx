import React, { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  Lock,
  Send,
  ShieldAlert,
  ShieldCheck,
  Star,
  Upload,
} from 'lucide-react';
import type {
  AdminDeal,
  DealServiceType,
  Language,
  PaymentMethod,
  PlatformEscrowConfig,
  UserProfile,
} from '../types/dealkoro';
import { t } from '../i18n/translations';
import { calculateDealBreakdown, formatTk } from '../utils/dealMath';
import { uploadImageFile } from '../services/dealkoroService';
import {
  BLUEPRINT_LIMITS,
  formatEscrowPaymentContact,
  sanitizeImageUrl,
} from '../utils/payloadSanitizer';
import { ResilientImage } from './ResilientImage';
import { OnlineWalletCheckout } from './OnlineWalletCheckout';

interface DealRoomScreenProps {
  user: UserProfile;
  language: Language;
  deal: AdminDeal;
  platformConfig?: PlatformEscrowConfig;
  onUpdateDeal: (updated: AdminDeal, firestorePatch?: Partial<AdminDeal>) => void;
  onVerifyPayment?: (dealId: string) => void;
  onReleasePayout?: (dealId: string) => void;
  onSendGroupMessage: (text: string) => void;
  onCompleteReview: (dealId: string, rating: number, comment: string) => void;
  onBackToInbox: () => void;
}

function getEscrowStepIndex(status: AdminDeal['status']): number {
  switch (status) {
    case 'confirming':
    case 'finding_admin':
    case 'service_select':
    case 'payment_method':
    case 'cross_deal':
    case 'verification_checks':
    case 'cost_summary':
      return 1;
    case 'payment_instruction':
      return 2;
    case 'payment_received':
      return 3;
    case 'id_exchange':
      return 4;
    case 'review_prompt':
    case 'done':
      return 5;
    default:
      return 1;
  }
}

export function DealRoomScreen({
  user,
  language,
  deal,
  platformConfig,
  onUpdateDeal,
  onVerifyPayment,
  onReleasePayout,
  onSendGroupMessage,
  onCompleteReview,
  onBackToInbox,
}: DealRoomScreenProps) {
  const [countdown, setCountdown] = useState(60);
  const [copiedContact, setCopiedContact] = useState(false);
  const [copiedDealId, setCopiedDealId] = useState(false);
  const [proofNote, setProofNote] = useState(deal.paymentProofNote || '');
  const [proofUrl, setProofUrl] = useState(deal.paymentProofUrl || '');
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);
  const [accountDetails, setAccountDetails] = useState(deal.accountDetailsNote || '');
  const [groupMsg, setGroupMsg] = useState('');
  const [reviewRating, setReviewRating] = useState(deal.reviewRating || 5);
  const [reviewComment, setReviewComment] = useState(deal.reviewComment || '');

  const isAdmin = user.role === 'admin';
  const isBuyer = user.uid === deal.buyerId;
  const isSeller = user.uid === deal.sellerId;
  const livePaymentContact = platformConfig
    ? formatEscrowPaymentContact(platformConfig, deal.buyerMethod)
    : deal.paymentContact;

  useEffect(() => {
    setProofNote(deal.paymentProofNote || '');
    setProofUrl(deal.paymentProofUrl || '');
    setAccountDetails(deal.accountDetailsNote || '');
    if (deal.reviewRating) setReviewRating(deal.reviewRating);
    if (deal.reviewComment) setReviewComment(deal.reviewComment);
  }, [
    deal.id,
    deal.paymentProofNote,
    deal.paymentProofUrl,
    deal.accountDetailsNote,
    deal.reviewRating,
    deal.reviewComment,
  ]);

  useEffect(() => {
    if (deal.status !== 'confirming') return;
    const timer = window.setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [deal.status]);

  const breakdown = calculateDealBreakdown({
    agreedAmount: deal.agreedAmount,
    serviceType: deal.serviceType,
    buyerMethod: deal.buyerMethod,
    sellerMethod: deal.sellerMethod,
    crossDealAccepted: deal.crossDealAccepted,
    iosCheck: deal.iosCheck,
    googleBindCheck: deal.googleBindCheck,
  });

  const applyConfigUpdate = (patch: Partial<AdminDeal>) => {
    const merged: AdminDeal = {
      ...deal,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    const nextBreakdown = calculateDealBreakdown({
      agreedAmount: merged.agreedAmount,
      serviceType: merged.serviceType,
      buyerMethod: merged.buyerMethod,
      sellerMethod: merged.sellerMethod,
      crossDealAccepted: merged.crossDealAccepted,
      iosCheck: merged.iosCheck,
      googleBindCheck: merged.googleBindCheck,
    });
    const firestorePatch: Partial<AdminDeal> = {
      ...patch,
      serviceFee: nextBreakdown.serviceFee,
      crossDealRequired: nextBreakdown.crossDealRequired,
      crossDealFee: nextBreakdown.crossDealFee,
      verificationFee: nextBreakdown.verificationFee,
      totalAmount: nextBreakdown.totalPayable,
    };
    onUpdateDeal(
      {
        ...merged,
        ...firestorePatch,
      },
      firestorePatch
    );
  };

  const applyDirectPatch = (patch: Partial<AdminDeal>) => {
    onUpdateDeal(
      {
        ...deal,
        ...patch,
        updatedAt: new Date().toISOString(),
      },
      patch
    );
  };

  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofError(null);
    setUploadingProof(true);
    const res = await uploadImageFile('proofs', user.uid, file);
    setUploadingProof(false);
    if (res.url) {
      setProofUrl(res.url);
      if (!proofNote.trim()) {
        setProofNote(`Screenshot uploaded (${file.name})`);
      }
    } else if (res.error) {
      setProofError(res.error);
    }
  };

  const currentStep = getEscrowStepIndex(deal.status);
  const steps =
    language === 'bn'
      ? ['সেটআপ', 'পেমেন্ট', 'অ্যাডমিন চেক', 'হস্তান্তর', 'সম্পন্ন']
      : ['Setup', 'Payment', 'Verify', 'Handover', 'Payout'];

  const getTurnNotice = (): { text: string; actionRequired: boolean } => {
    if (deal.status === 'payment_instruction') {
      if (deal.paymentProofNote) {
        return isAdmin
          ? { text: 'Your Turn: Verify payment proof & unlock ID exchange.', actionRequired: true }
          : { text: 'Waiting for Admin to verify payment proof.', actionRequired: false };
      }
      return isBuyer
        ? { text: 'Your Turn: Send money & submit TrxID or screenshot.', actionRequired: true }
        : { text: 'Waiting for Buyer to submit escrow payment proof.', actionRequired: false };
    }
    if (deal.status === 'payment_received') {
      return isAdmin
        ? { text: 'Your Turn: Unlock ID Exchange step.', actionRequired: true }
        : { text: 'Waiting for Admin to unlock ID Exchange.', actionRequired: false };
    }
    if (deal.status === 'id_exchange') {
      return isSeller || isAdmin
        ? { text: 'Your Turn: Complete account handover confirmation.', actionRequired: true }
        : { text: 'Waiting for Seller to transfer account details.', actionRequired: false };
    }
    if (deal.status === 'review_prompt') {
      return isAdmin
        ? { text: 'Your Turn: Release seller payout to finalize deal.', actionRequired: true }
        : { text: 'Leave your review while Admin releases seller payout.', actionRequired: isBuyer || isSeller };
    }
    if (deal.status === 'done') {
      return { text: 'Escrow Deal completed & ledger statements recorded.', actionRequired: false };
    }
    return { text: 'Configure service, payment methods, and checks.', actionRequired: true };
  };

  const turnNotice = getTurnNotice();

  // Admin-deal confirmation
  if (deal.status === 'confirming') {
    return (
      <div className="max-w-md mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center space-y-5">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">
            {t(language, 'adminDealTitle')}
          </h1>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1 tabular-nums">
            {t(language, 'timeStartsIn')} {countdown} sec...
          </p>
        </div>

        <div className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 tabular-nums">
          {formatTk(deal.agreedAmount)}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 rounded-xl p-3">
            <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
              Seller ✓
            </div>
            <div className="text-xs text-slate-700 dark:text-slate-300 mt-1 truncate">
              {deal.sellerName.split(' ')[0]}
            </div>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 rounded-xl p-3">
            <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
              Buyer ✓
            </div>
            <div className="text-xs text-slate-700 dark:text-slate-300 mt-1 truncate">
              {deal.buyerName.split(' ')[0]}
            </div>
          </div>
        </div>

        <div className="space-y-2.5 pt-2">
          <button
            type="button"
            onClick={() => applyConfigUpdate({ status: 'finding_admin' })}
            className="w-full min-h-[46px] bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors"
          >
            Continue to Find Admin
          </button>
          <button
            type="button"
            onClick={() => applyConfigUpdate({ status: 'cancelled' })}
            className="w-full min-h-[44px] bg-slate-600 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors"
          >
            CANCEL
          </button>
        </div>
      </div>
    );
  }

  // Finding Admin
  if (deal.status === 'finding_admin') {
    return (
      <div className="max-w-md mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center space-y-5">
        <div className="flex justify-center gap-1.5 py-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
          <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-blue-200 dark:bg-blue-800" />
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-wide">
            {t(language, 'findingAdmin')}
          </h1>
          <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 tabular-nums mt-2">
            Deal: {formatTk(deal.agreedAmount)}
          </div>
        </div>
        <div className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
          <div>Seller: {deal.sellerName.split(' ')[0]}</div>
          <div>Buyer: {deal.buyerName.split(' ')[0]}</div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{t(language, 'pleaseWait')}</p>
        <button
          type="button"
          onClick={() => applyConfigUpdate({ status: 'service_select' })}
          className="w-full min-h-[46px] bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors"
        >
          Join Group Chat with {deal.adminName}
        </button>
      </div>
    );
  }

  if (deal.status === 'cancelled') {
    return (
      <div className="max-w-md mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center space-y-4">
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">Deal Cancelled</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          This admin deal was cancelled before escrow payment.
        </p>
        <button
          type="button"
          onClick={onBackToInbox}
          className="min-h-[44px] px-5 py-2.5 bg-slate-900 dark:bg-blue-600 text-white text-sm font-semibold rounded-xl"
        >
          Back to Inbox
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Automated Group Header + 5-Step Progress Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
              {deal.title}
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(deal.id);
                setCopiedDealId(true);
                window.setTimeout(() => setCopiedDealId(false), 1800);
              }}
              className="px-2 py-1 text-[11px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg inline-flex items-center gap-1 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              {copiedDealId ? (
                <Check className="w-3 h-3 text-emerald-600" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              <span>{copiedDealId ? 'Copied ID' : 'Deal ID'}</span>
            </button>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 tabular-nums">
              {deal.adminName} ✓
            </span>
          </div>
        </div>

        {/* 5-Step Escrow Progress Bar */}
        <div className="space-y-2">
          <div className="grid grid-cols-5 gap-1.5">
            {steps.map((label, idx) => {
              const stepNum = idx + 1;
              const completed = stepNum < currentStep || deal.status === 'done';
              const active = stepNum === currentStep && deal.status !== 'done';
              return (
                <div key={label} className="space-y-1">
                  <div
                    className={`h-1.5 rounded-full transition-colors ${
                      completed
                        ? 'bg-emerald-600 dark:bg-emerald-500'
                        : active
                        ? 'bg-blue-600 dark:bg-blue-400'
                        : 'bg-slate-200 dark:bg-slate-800'
                    }`}
                  />
                  <div
                    className={`text-[10px] sm:text-[11px] font-semibold truncate text-center ${
                      completed
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : active
                        ? 'text-blue-700 dark:text-blue-300'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {stepNum}. {label}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              turnNotice.actionRequired
                ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-200'
                : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>{turnNotice.text}</span>
          </div>
        </div>

        <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/70 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <span>
            {language === 'bn'
              ? 'নিরাপত্তা সতর্কতা: অফিসিয়াল অ্যাডমিন ডিলের বাইরে কোনো ব্যক্তিগত নম্বরে টাকা বা লগইন তথ্য দেবেন না।'
              : 'Safety Notice: Only send escrow funds to the verified Admin contact below, and never share account passwords until payment is Admin-verified.'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-20 h-14 rounded-xl overflow-hidden bg-slate-900 shrink-0">
            <ResilientImage
              src={deal.listingImage}
              alt={deal.listingTitle}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {deal.listingTitle} · {formatTk(deal.agreedAmount)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Verified Escrow Room · Total:{' '}
              <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                {formatTk(breakdown.totalPayable)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Select Deal Service */}
      {deal.status === 'service_select' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="text-xs font-bold text-blue-600 dark:text-blue-400">
            {deal.adminName} ✓
          </div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {t(language, 'selectServicePrompt')} @{deal.sellerName.split(' ')[0]}
          </p>
          <div className="space-y-2.5">
            {(
              [
                {
                  type: 'normal' as DealServiceType,
                  label: t(language, 'normalDeal'),
                  sub: 'Standard admin escrow mediation & transfer verification',
                },
                {
                  type: 'ultimate_safe' as DealServiceType,
                  label: t(language, 'ultimateSafeDeal'),
                  sub: 'Extended recovery protection + priority verification',
                },
              ]
            ).map((opt) => (
              <button
                key={opt.type}
                type="button"
                onClick={() =>
                  applyConfigUpdate({
                    serviceType: opt.type,
                    status: 'payment_method',
                  })
                }
                className="w-full min-h-[54px] p-4 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 rounded-xl text-left transition-colors"
              >
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {opt.label}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {opt.sub}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Select Payment Methods (bKash / Nagad) */}
      {deal.status === 'payment_method' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="text-xs font-bold text-blue-600 dark:text-blue-400">
            {deal.adminName} ✓
          </div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {t(language, 'selectPaymentPrompt')}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Seller ({deal.sellerName.split(' ')[0]}) Payout Method
              </div>
              {(['bKash', 'Nagad'] as PaymentMethod[]).map((method) => (
                <button
                  key={`seller-${method}`}
                  type="button"
                  onClick={() => applyConfigUpdate({ sellerMethod: method })}
                  className={`w-full min-h-[44px] rounded-xl text-sm font-bold border transition-colors ${
                    deal.sellerMethod === method
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Buyer ({deal.buyerName.split(' ')[0]}) Payment Method
              </div>
              {(['bKash', 'Nagad'] as PaymentMethod[]).map((method) => (
                <button
                  key={`buyer-${method}`}
                  type="button"
                  onClick={() => applyConfigUpdate({ buyerMethod: method })}
                  className={`w-full min-h-[44px] rounded-xl text-sm font-bold border transition-colors ${
                    deal.buyerMethod === method
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {deal.sellerMethod !== 'pending' && deal.buyerMethod !== 'pending' && (
            <div className="pt-2 space-y-3">
              <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                {deal.sellerName.split(' ')[0]} selects {deal.sellerMethod}.{' '}
                {deal.buyerName.split(' ')[0]} selects {deal.buyerMethod}.
              </div>
              <button
                type="button"
                onClick={() =>
                  applyConfigUpdate({
                    status:
                      deal.sellerMethod !== deal.buyerMethod
                        ? 'cross_deal'
                        : 'verification_checks',
                  })
                }
                className="w-full min-h-[46px] bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl"
              >
                Continue
              </button>
            </div>
          )}
        </div>
      )}

      {/* Cross-deal option */}
      {deal.status === 'cross_deal' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="text-xs font-bold text-blue-600 dark:text-blue-400">
            {deal.adminName} ✓
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
            <p className="text-sm text-slate-800 dark:text-slate-200">
              {t(language, 'crossDealNotice')}
            </p>
            <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-center text-sm font-bold text-slate-900 dark:text-white">
              {t(language, 'crossDealBtn')}
            </div>
          </div>

          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {t(language, 'continuePrompt')}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() =>
                applyConfigUpdate({
                  crossDealAccepted: true,
                  status: 'verification_checks',
                })
              }
              className="min-h-[46px] bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl"
            >
              {t(language, 'yes')}
            </button>
            <button
              type="button"
              onClick={() => applyConfigUpdate({ status: 'payment_method' })}
              className="min-h-[46px] bg-slate-600 hover:bg-slate-700 text-white text-sm font-bold rounded-xl"
            >
              {t(language, 'no')}
            </button>
          </div>
        </div>
      )}

      {/* Verification Check Options */}
      {deal.status === 'verification_checks' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="text-xs font-bold text-blue-600 dark:text-blue-400">
            {deal.adminName} ✓
          </div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {t(language, 'verificationPrompt')}
          </p>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => applyConfigUpdate({ iosCheck: !deal.iosCheck })}
              className={`w-full min-h-[48px] px-4 py-3 rounded-xl border text-sm font-bold flex items-center justify-between transition-colors ${
                deal.iosCheck
                  ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-600 text-blue-800 dark:text-blue-200'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <span>{t(language, 'iosCheck')}</span>
              {deal.iosCheck && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
            </button>

            <button
              type="button"
              onClick={() =>
                applyConfigUpdate({ googleBindCheck: !deal.googleBindCheck })
              }
              className={`w-full min-h-[48px] px-4 py-3 rounded-xl border text-sm font-bold flex items-center justify-between transition-colors ${
                deal.googleBindCheck
                  ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-600 text-blue-800 dark:text-blue-200'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <span>{t(language, 'googleBindCheck')}</span>
              {deal.googleBindCheck && (
                <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => applyConfigUpdate({ status: 'cost_summary' })}
            className="w-full min-h-[46px] bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl"
          >
            Confirm Verification Options
          </button>
        </div>
      )}

      {/* Deal Cost Summary */}
      {deal.status === 'cost_summary' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="text-xs font-bold text-blue-600 dark:text-blue-400">
            {deal.adminName} ✓
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {t(language, 'dealCostSummary')}
          </h2>

          <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-300">{t(language, 'dealAmount')}</span>
              <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                {formatTk(breakdown.agreedAmount)}
              </span>
            </div>
            {breakdown.serviceFee > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-300">
                  {deal.serviceType === 'ultimate_safe' ? 'Ultimate Safe Deal' : 'Normal Deal'}
                </span>
                <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                  {formatTk(breakdown.serviceFee)}
                </span>
              </div>
            )}
            {breakdown.crossDealFee > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-300">Cross Deal</span>
                <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                  {formatTk(breakdown.crossDealFee)}
                </span>
              </div>
            )}
            {breakdown.iosCheckFee > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-300">iOS Check</span>
                <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                  {formatTk(breakdown.iosCheckFee)}
                </span>
              </div>
            )}
            {breakdown.googleBindCheckFee > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-300">Google Bind Check</span>
                <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                  {formatTk(breakdown.googleBindCheckFee)}
                </span>
              </div>
            )}
            <div className="pt-2.5 border-t border-slate-200 dark:border-slate-700 flex justify-between text-base">
              <span className="font-bold text-slate-900 dark:text-white">
                {t(language, 'total')}
              </span>
              <span className="font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {formatTk(breakdown.totalPayable)}
              </span>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-3">
            <div className="text-xs font-semibold text-blue-700 dark:text-blue-300">
              Payment contact: {livePaymentContact}
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(livePaymentContact);
                setCopiedContact(true);
              }}
              className="min-h-[36px] px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copiedContact ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => applyConfigUpdate({ status: 'payment_instruction' })}
            className="w-full min-h-[46px] bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl"
          >
            Proceed to Payment Proof
          </button>
        </div>
      )}

      {/* Payment Instruction & Proof */}
      {deal.status === 'payment_instruction' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
              {deal.adminName} ✓
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 rounded-lg">
              <Lock className="w-3.5 h-3.5" />
              <span>Admin Verification Required</span>
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2 text-sm text-slate-800 dark:text-slate-200">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                {t(language, 'paymentInstruction')}{' '}
                <span className="font-bold tabular-nums">{formatTk(breakdown.totalPayable)}</span> →{' '}
                <span className="font-mono font-semibold">{livePaymentContact}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(livePaymentContact);
                  setCopiedContact(true);
                }}
                className="min-h-[32px] px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1"
              >
                <Copy className="w-3 h-3" />
                <span>{copiedContact ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            {platformConfig?.announcement && (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {platformConfig.announcement}
              </div>
            )}
          </div>

          {(isBuyer || isAdmin) && (
            <OnlineWalletCheckout
              language={language}
              userId={user.uid}
              deal={deal}
              totalPayable={breakdown.totalPayable}
              platformConfig={platformConfig}
              initialProofNote={deal.paymentProofNote}
              initialProofUrl={deal.paymentProofUrl}
              onSubmitProof={({ method, proofNote: note, proofUrl: url }) => {
                applyDirectPatch({
                  paymentProofNote: note,
                  paymentProofUrl: url,
                });
                onSendGroupMessage(
                  `${method} Online Payment submitted: ${note}`
                );
              }}
            />
          )}

          {deal.paymentProofNote && (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-amber-900 dark:text-amber-200 inline-flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>Submitted Proof (Awaiting Admin Verification)</span>
                </span>
              </div>
              <div className="text-slate-800 dark:text-slate-200 font-mono">
                {deal.paymentProofNote}
              </div>
              {deal.paymentProofUrl && (
                <div className="w-40 h-24 rounded-lg overflow-hidden border border-amber-200 dark:border-amber-800 bg-slate-900">
                  <ResilientImage
                    src={deal.paymentProofUrl}
                    alt="Payment proof"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>
          )}

          {isAdmin ? (
            <button
              type="button"
              onClick={() => {
                if (onVerifyPayment) {
                  onVerifyPayment(deal.id);
                } else {
                  applyDirectPatch({
                    buyerInitialDone: true,
                    status: 'id_exchange',
                  });
                }
              }}
              className="w-full min-h-[46px] bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl inline-flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Verify Payment &amp; Unlock ID Exchange</span>
            </button>
          ) : (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-600 dark:text-slate-300 text-center">
              Only a verified Admin can confirm payment receipt and unlock account handover.
            </div>
          )}
        </div>
      )}

      {/* Payment Received Confirmation */}
      {deal.status === 'payment_received' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="text-xs font-bold text-blue-600 dark:text-blue-400">
            {deal.adminName} ✓
          </div>
          <div className="p-5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl text-center space-y-4">
            <div>
              <div className="text-base font-extrabold text-emerald-700 dark:text-emerald-400">
                {t(language, 'paymentReceived')}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Admin verified escrow deposit
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3 bg-emerald-600 text-white text-xs font-bold rounded-xl">
                {t(language, 'buyerInitialDone')}
              </div>
              <div className="p-3 bg-emerald-600 text-white text-xs font-bold rounded-xl">
                {t(language, 'sellerExchangeNow')}
              </div>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between text-xs">
            <span className="font-bold text-slate-900 dark:text-white">
              Payment receipt ({deal.paymentProofNote || 'Verified'})
            </span>
            <span className="font-bold text-emerald-700 dark:text-emerald-400">
              Status: verified
            </span>
          </div>

          {isAdmin ? (
            <button
              type="button"
              onClick={() =>
                onVerifyPayment
                  ? onVerifyPayment(deal.id)
                  : applyDirectPatch({ buyerInitialDone: true, status: 'id_exchange' })
              }
              className="w-full min-h-[46px] bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl"
            >
              Proceed to ID Exchange
            </button>
          ) : (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-600 dark:text-slate-300 text-center">
              Awaiting Admin to unlock ID Exchange.
            </div>
          )}
        </div>
      )}

      {/* Payment Status & ID Exchange */}
      {deal.status === 'id_exchange' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="text-xs font-bold text-blue-600 dark:text-blue-400">
            {deal.adminName} ✓
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-center space-y-3">
            <div className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400">
              {t(language, 'paymentReceived')}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="py-2 bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-xs font-bold rounded-lg">
                Buyer: VERIFIED
              </div>
              <div className="py-2 bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-xs font-bold rounded-lg">
                Seller: HANDOVER
              </div>
            </div>
            <div className="text-xs font-extrabold text-blue-600 dark:text-blue-400">
              {t(language, 'idExchange')}
            </div>
          </div>

          {isSeller || isAdmin ? (
            <>
              <div>
                <label
                  htmlFor="account-exchange-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  {deal.sellerName.split(' ')[0]}, enter your account transfer / recovery confirmation
                </label>
                <textarea
                  id="account-exchange-input"
                  rows={2}
                  value={accountDetails}
                  onChange={(e) => setAccountDetails(e.target.value)}
                  placeholder="e.g. Konami ID verified with buyer email & recovery OTP confirmed"
                  className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
                />
              </div>

              <button
                type="button"
                onClick={() =>
                  applyDirectPatch({
                    sellerExchanged: true,
                    accountDetailsNote:
                      accountDetails.trim() || 'Account details shared & verified',
                    status: 'review_prompt',
                  })
                }
                className="w-full min-h-[46px] bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl"
              >
                {t(language, 'shareAccountDetails')}
              </button>
            </>
          ) : (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-600 dark:text-slate-300 text-center">
              Waiting for seller ({deal.sellerName.split(' ')[0]}) to complete account handover.
            </div>
          )}
        </div>
      )}

      {/* Review Feedback + Admin-Only Payout Release */}
      {(deal.status === 'review_prompt' || deal.status === 'done') && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 rounded-xl text-sm font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>
              {deal.status === 'done'
                ? t(language, 'dealDoneReview')
                : 'Account handover complete! Submit your rating while Admin verifies & releases payout.'}
            </span>
          </div>

          {deal.accountDetailsNote && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-300">
              <span className="font-bold text-slate-900 dark:text-white">Handover Note: </span>
              <span>{deal.accountDetailsNote}</span>
            </div>
          )}

          {deal.status === 'done' ? (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {t(language, 'dealCompleted')}
                </span>
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                  {t(language, 'done')}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${
                      i < (deal.reviewRating || 5)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-300 dark:text-slate-600'
                    }`}
                  />
                ))}
              </div>
              {deal.reviewComment && (
                <p className="text-xs text-slate-600 dark:text-slate-300">{deal.reviewComment}</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {(isBuyer || isSeller) && (
                <>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      {t(language, 'feedbackTitle')}
                    </h2>
                    <label
                      htmlFor="deal-review-text"
                      className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mt-1 mb-1.5"
                    >
                      {t(language, 'writeFeedback')}
                    </label>
                    <textarea
                      id="deal-review-text"
                      rows={3}
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder={t(language, 'yourExperience')}
                      className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
                    />
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                      Rating
                    </div>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setReviewRating(star)}
                          aria-label={`Rate ${star} stars`}
                          className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Star
                            className={`w-6 h-6 ${
                              star <= reviewRating
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-slate-300 dark:text-slate-600'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onCompleteReview(
                        deal.id,
                        reviewRating,
                        reviewComment.trim() || 'Smooth and safe admin deal!'
                      )
                    }
                    className="w-full min-h-[46px] bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl"
                  >
                    {t(language, 'submitFeedback')}
                  </button>
                </>
              )}

              {deal.reviewComment && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 rounded-xl text-xs text-blue-900 dark:text-blue-200">
                  Saved review ({deal.reviewRating ?? 5}★): &ldquo;{deal.reviewComment}&rdquo;
                </div>
              )}

              {isAdmin ? (
                <button
                  type="button"
                  onClick={() =>
                    onReleasePayout
                      ? onReleasePayout(deal.id)
                      : onCompleteReview(
                          deal.id,
                          reviewRating,
                          reviewComment.trim() || 'Escrow verified and payout released by admin.'
                        )
                  }
                  className="w-full min-h-[46px] bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl inline-flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Release Payout &amp; Complete Deal</span>
                </button>
              ) : (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl text-xs font-medium text-amber-800 dark:text-amber-300 text-center">
                  Awaiting Admin ({deal.adminName}) to release seller payout and finalize ledger statements.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Group Chat Log & Message Input */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="text-xs font-bold text-slate-500 dark:text-slate-400">Group Chat Log</div>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {deal.messages.map((m) => (
            <div
              key={m.id}
              className={`p-2.5 rounded-xl text-xs ${
                m.senderId === user.uid
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-950 dark:text-blue-100 ml-8'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 mr-8'
              }`}
            >
              <span className="font-bold">{m.senderName}: </span>
              <span>{m.text}</span>
            </div>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!groupMsg.trim()) return;
            onSendGroupMessage(groupMsg.trim());
            setGroupMsg('');
          }}
          className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800"
        >
          <input
            type="text"
            value={groupMsg}
            onChange={(e) => setGroupMsg(e.target.value)}
            placeholder="Message buyer, seller & admin..."
            className="flex-1 min-h-[42px] px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 rounded-xl"
          />
          <button
            type="submit"
            aria-label="Send group message"
            className="min-h-[42px] px-3.5 py-2 bg-slate-900 dark:bg-blue-600 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{t(language, 'send')}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
