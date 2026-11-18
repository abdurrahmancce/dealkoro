import React, { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  Lock,
  Send,
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

  // Screen 16: Admin-deal confirmation
  if (deal.status === 'confirming') {
    return (
      <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-5">
        <div>
          <h1 className="text-lg font-bold text-slate-900">
            {t(language, 'adminDealTitle')}
          </h1>
          <p className="text-sm font-semibold text-slate-700 mt-1 tabular-nums">
            {t(language, 'timeStartsIn')} {countdown} sec...
          </p>
        </div>

        <div className="text-3xl font-extrabold text-blue-600 tabular-nums">
          {formatTk(deal.agreedAmount)}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
            <div className="text-xs font-bold text-emerald-700">Seller ✓</div>
            <div className="text-xs text-slate-700 mt-1 truncate">
              {deal.sellerName.split(' ')[0]}
            </div>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
            <div className="text-xs font-bold text-emerald-700">Buyer ✓</div>
            <div className="text-xs text-slate-700 mt-1 truncate">
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

  // Screen 17: Finding Admin
  if (deal.status === 'finding_admin') {
    return (
      <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-5">
        <div className="flex justify-center gap-1.5 py-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
          <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-blue-200" />
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-900 tracking-wide">
            {t(language, 'findingAdmin')}
          </h1>
          <div className="text-2xl font-extrabold text-blue-600 tabular-nums mt-2">
            Deal: {formatTk(deal.agreedAmount)}
          </div>
        </div>
        <div className="text-sm text-slate-700 space-y-1">
          <div>Seller: {deal.sellerName.split(' ')[0]}</div>
          <div>Buyer: {deal.buyerName.split(' ')[0]}</div>
        </div>
        <p className="text-xs text-slate-500">{t(language, 'pleaseWait')}</p>
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
      <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-4">
        <h1 className="text-lg font-bold text-slate-900">Deal Cancelled</h1>
        <p className="text-sm text-slate-600">
          This admin deal was cancelled before escrow payment.
        </p>
        <button
          type="button"
          onClick={onBackToInbox}
          className="min-h-[44px] px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl"
        >
          Back to Inbox
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Screen 18 Automated Group Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <h1 className="text-base sm:text-lg font-bold text-slate-900">
              {deal.title}
            </h1>
          </div>
          <span className="text-xs font-bold text-blue-600 tabular-nums">
            {deal.adminName} ✓
          </span>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
          This is the automated group chat for <span className="font-semibold">{deal.adminName}</span>,{' '}
          <span className="font-semibold">{deal.sellerName.split(' ')[0]}</span> and{' '}
          <span className="font-semibold">{deal.buyerName.split(' ')[0]}</span>.
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
            <div className="text-sm font-bold text-slate-900 truncate">
              {deal.listingTitle} · {formatTk(deal.agreedAmount)}
            </div>
            <div className="text-xs text-slate-500">
              Verified Escrow Room · Total:{' '}
              <span className="font-bold text-slate-900 tabular-nums">
                {formatTk(breakdown.totalPayable)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Screen 19: Select Deal Service */}
      {deal.status === 'service_select' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="text-xs font-bold text-blue-600">{deal.adminName} ✓</div>
          <p className="text-sm font-semibold text-slate-900">
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
                className="w-full min-h-[54px] p-4 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl text-left transition-colors"
              >
                <div className="text-sm font-bold text-slate-900">{opt.label}</div>
                <div className="text-xs text-slate-500 mt-0.5">{opt.sub}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Screen 20: Select Payment Methods (bKash / Nagad) */}
      {deal.status === 'payment_method' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="text-xs font-bold text-blue-600">{deal.adminName} ✓</div>
          <p className="text-sm font-semibold text-slate-900">
            {t(language, 'selectPaymentPrompt')}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-600">
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
                      : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-600">
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
                      : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {deal.sellerMethod !== 'pending' && deal.buyerMethod !== 'pending' && (
            <div className="pt-2 space-y-3">
              <div className="text-xs font-semibold text-emerald-700">
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

      {/* Screen 21: Cross-deal option */}
      {deal.status === 'cross_deal' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="text-xs font-bold text-blue-600">{deal.adminName} ✓</div>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <p className="text-sm text-slate-800">{t(language, 'crossDealNotice')}</p>
            <div className="p-3 bg-white border border-slate-200 rounded-xl text-center text-sm font-bold text-slate-900">
              {t(language, 'crossDealBtn')}
            </div>
          </div>

          <p className="text-sm font-semibold text-slate-900">
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

      {/* Screen 22: Verification Check Options */}
      {deal.status === 'verification_checks' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="text-xs font-bold text-blue-600">{deal.adminName} ✓</div>
          <p className="text-sm font-semibold text-slate-900">
            {t(language, 'verificationPrompt')}
          </p>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => applyConfigUpdate({ iosCheck: !deal.iosCheck })}
              className={`w-full min-h-[48px] px-4 py-3 rounded-xl border text-sm font-bold flex items-center justify-between transition-colors ${
                deal.iosCheck
                  ? 'bg-blue-50 border-blue-600 text-blue-800'
                  : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
              }`}
            >
              <span>{t(language, 'iosCheck')}</span>
              {deal.iosCheck && <Check className="w-4 h-4 text-blue-600" />}
            </button>

            <button
              type="button"
              onClick={() =>
                applyConfigUpdate({ googleBindCheck: !deal.googleBindCheck })
              }
              className={`w-full min-h-[48px] px-4 py-3 rounded-xl border text-sm font-bold flex items-center justify-between transition-colors ${
                deal.googleBindCheck
                  ? 'bg-blue-50 border-blue-600 text-blue-800'
                  : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
              }`}
            >
              <span>{t(language, 'googleBindCheck')}</span>
              {deal.googleBindCheck && <Check className="w-4 h-4 text-blue-600" />}
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

      {/* Screen 23: Deal Cost Summary */}
      {deal.status === 'cost_summary' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="text-xs font-bold text-blue-600">{deal.adminName} ✓</div>
          <h2 className="text-base font-bold text-slate-900">
            {t(language, 'dealCostSummary')}
          </h2>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">{t(language, 'dealAmount')}</span>
              <span className="font-bold text-slate-900 tabular-nums">
                {formatTk(breakdown.agreedAmount)}
              </span>
            </div>
            {breakdown.serviceFee > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-600">
                  {deal.serviceType === 'ultimate_safe'
                    ? 'Ultimate Safe Deal'
                    : 'Normal Deal'}
                </span>
                <span className="font-bold text-slate-900 tabular-nums">
                  {formatTk(breakdown.serviceFee)}
                </span>
              </div>
            )}
            {breakdown.crossDealFee > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-600">Cross Deal</span>
                <span className="font-bold text-slate-900 tabular-nums">
                  {formatTk(breakdown.crossDealFee)}
                </span>
              </div>
            )}
            {breakdown.iosCheckFee > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-600">iOS Check</span>
                <span className="font-bold text-slate-900 tabular-nums">
                  {formatTk(breakdown.iosCheckFee)}
                </span>
              </div>
            )}
            {breakdown.googleBindCheckFee > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-600">Google Bind Check</span>
                <span className="font-bold text-slate-900 tabular-nums">
                  {formatTk(breakdown.googleBindCheckFee)}
                </span>
              </div>
            )}
            <div className="pt-2.5 border-t border-slate-200 flex justify-between text-base">
              <span className="font-bold text-slate-900">{t(language, 'total')}</span>
              <span className="font-extrabold text-emerald-700 tabular-nums">
                {formatTk(breakdown.totalPayable)}
              </span>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
            <div className="text-xs font-semibold text-blue-700">
              Payment contact: {livePaymentContact}
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(livePaymentContact);
                setCopiedContact(true);
              }}
              className="min-h-[36px] px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 inline-flex items-center gap-1"
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

      {/* Screen 24: Payment Instruction & Proof (Admin-locked verification!) */}
      {deal.status === 'payment_instruction' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-600">{deal.adminName} ✓</span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg">
              <Lock className="w-3.5 h-3.5" />
              <span>Admin Verification Required</span>
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-sm text-slate-800">
            <div>
              {t(language, 'paymentInstruction')}{' '}
              <span className="font-bold tabular-nums">{formatTk(breakdown.totalPayable)}</span> →{' '}
              <span className="font-mono font-semibold">{livePaymentContact}</span>
            </div>
            {platformConfig?.announcement && (
              <div className="text-xs text-slate-500">{platformConfig.announcement}</div>
            )}
          </div>

          {(isBuyer || isAdmin) && (
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="payment-proof-input"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Payment Proof (Transaction ID / Reference)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="payment-proof-input"
                    type="text"
                    value={proofNote}
                    onChange={(e) => setProofNote(e.target.value)}
                    placeholder="e.g. TrxID 8N4K2P19"
                    className="flex-1 min-h-[44px] px-3.5 py-2 text-sm border border-slate-300 rounded-xl"
                  />
                  <label className="min-h-[44px] px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer">
                    {uploadingProof ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    <span>{uploadingProof ? 'Uploading...' : 'Photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingProof}
                      className="sr-only"
                      onChange={(e) => void handleProofUpload(e)}
                    />
                  </label>
                </div>
              </div>

              {proofUrl.startsWith('data:') ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-16 h-12 rounded-lg overflow-hidden border border-emerald-200 bg-slate-900 shrink-0">
                      <ResilientImage
                        src={proofUrl}
                        alt="Attached payment proof"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="text-xs font-semibold text-emerald-800">
                      Payment screenshot attached &amp; ready
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProofUrl('')}
                    className="px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  <label
                    htmlFor="payment-proof-url"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Optional Proof Screenshot HTTPS Link
                  </label>
                  <input
                    id="payment-proof-url"
                    type="url"
                    value={proofUrl}
                    onChange={(e) => setProofUrl(e.target.value)}
                    maxLength={BLUEPRINT_LIMITS.URL_MAX}
                    placeholder="https://..."
                    className="w-full min-h-[40px] px-3.5 py-1.5 text-xs border border-slate-300 rounded-xl"
                  />
                </div>
              )}

              {proofError && (
                <div
                  role="alert"
                  className="p-2.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl"
                >
                  {proofError}
                </div>
              )}

              <button
                type="button"
                disabled={uploadingProof}
                onClick={() => {
                  const trimmedUrl = proofUrl.trim();
                  setProofError(null);
                  const cleanUrl = trimmedUrl
                    ? sanitizeImageUrl(trimmedUrl, '')
                    : '';
                  if (trimmedUrl && !cleanUrl) {
                    setProofError('Use the Photo button to upload a screenshot or paste a valid HTTPS link.');
                    return;
                  }
                  applyDirectPatch({
                    paymentProofNote:
                      proofNote.trim() || 'Buyer payment proof submitted (pending admin check)',
                    paymentProofUrl: cleanUrl,
                  });
                }}
                className="w-full min-h-[46px] bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl disabled:opacity-60"
              >
                {t(language, 'submitPaymentProof')}
              </button>
            </div>
          )}

          {deal.paymentProofNote && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-amber-900 inline-flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>Submitted Proof (Awaiting Admin Verification)</span>
                </span>
              </div>
              <div className="text-slate-800 font-mono">{deal.paymentProofNote}</div>
              {deal.paymentProofUrl && (
                <div className="w-40 h-24 rounded-lg overflow-hidden border border-amber-200 bg-slate-900">
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
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 text-center">
              Only a verified Admin can confirm payment receipt and unlock account handover.
            </div>
          )}
        </div>
      )}

      {/* Screen 25: Payment Received Confirmation (Admin unlocks ID exchange) */}
      {deal.status === 'payment_received' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="text-xs font-bold text-blue-600">{deal.adminName} ✓</div>
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-4">
            <div>
              <div className="text-base font-extrabold text-emerald-700">
                {t(language, 'paymentReceived')}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
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

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
            <span className="font-bold text-slate-900">
              Payment receipt ({deal.paymentProofNote || 'Verified'})
            </span>
            <span className="font-bold text-emerald-700">Status: verified</span>
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
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 text-center">
              Awaiting Admin to unlock ID Exchange.
            </div>
          )}
        </div>
      )}

      {/* Screen 28: Payment Status & ID Exchange */}
      {deal.status === 'id_exchange' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="text-xs font-bold text-blue-600">{deal.adminName} ✓</div>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-3">
            <div className="text-sm font-extrabold text-emerald-700">
              {t(language, 'paymentReceived')}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="py-2 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg">
                Buyer: VERIFIED
              </div>
              <div className="py-2 bg-amber-100 text-amber-800 text-xs font-bold rounded-lg">
                Seller: HANDOVER
              </div>
            </div>
            <div className="text-xs font-extrabold text-blue-600">
              {t(language, 'idExchange')}
            </div>
          </div>

          {isSeller || isAdmin ? (
            <>
              <div>
                <label
                  htmlFor="account-exchange-input"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  {deal.sellerName.split(' ')[0]}, enter your account transfer / recovery confirmation
                </label>
                <textarea
                  id="account-exchange-input"
                  rows={2}
                  value={accountDetails}
                  onChange={(e) => setAccountDetails(e.target.value)}
                  placeholder="e.g. Konami ID verified with buyer email & recovery OTP confirmed"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl"
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
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 text-center">
              Waiting for seller ({deal.sellerName.split(' ')[0]}) to complete account handover.
            </div>
          )}
        </div>
      )}

      {/* Screens 29 & 30: Review Feedback + Admin-Only Payout Release */}
      {(deal.status === 'review_prompt' || deal.status === 'done') && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-bold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>
              {deal.status === 'done'
                ? t(language, 'dealDoneReview')
                : 'Account handover complete! Submit your rating while Admin verifies & releases payout.'}
            </span>
          </div>

          {deal.accountDetailsNote && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
              <span className="font-bold text-slate-900">Handover Note: </span>
              <span>{deal.accountDetailsNote}</span>
            </div>
          )}

          {deal.status === 'done' ? (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900">
                  {t(language, 'dealCompleted')}
                </span>
                <span className="text-xs font-bold text-blue-600">
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
                        : 'text-slate-300'
                    }`}
                  />
                ))}
              </div>
              {deal.reviewComment && (
                <p className="text-xs text-slate-600">{deal.reviewComment}</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {(isBuyer || isSeller) && (
                <>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      {t(language, 'feedbackTitle')}
                    </h2>
                    <label
                      htmlFor="deal-review-text"
                      className="block text-xs font-semibold text-slate-600 mt-1 mb-1.5"
                    >
                      {t(language, 'writeFeedback')}
                    </label>
                    <textarea
                      id="deal-review-text"
                      rows={3}
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder={t(language, 'yourExperience')}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl"
                    />
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-slate-600 mb-1.5">
                      Rating
                    </div>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setReviewRating(star)}
                          aria-label={`Rate ${star} stars`}
                          className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg hover:bg-slate-100"
                        >
                          <Star
                            className={`w-6 h-6 ${
                              star <= reviewRating
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-slate-300'
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
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
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
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-medium text-amber-800 text-center">
                  Awaiting Admin ({deal.adminName}) to release seller payout and finalize ledger statements.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Group Chat Log & Message Input */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="text-xs font-bold text-slate-500">Group Chat Log</div>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {deal.messages.map((m) => (
            <div
              key={m.id}
              className={`p-2.5 rounded-xl text-xs ${
                m.senderId === user.uid
                  ? 'bg-blue-50 text-blue-950 ml-8'
                  : 'bg-slate-50 text-slate-800 mr-8'
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
          className="flex items-center gap-2 pt-2 border-t border-slate-100"
        >
          <input
            type="text"
            value={groupMsg}
            onChange={(e) => setGroupMsg(e.target.value)}
            placeholder="Message buyer, seller & admin..."
            className="flex-1 min-h-[42px] px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
          />
          <button
            type="submit"
            aria-label="Send group message"
            className="min-h-[42px] px-3.5 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{t(language, 'send')}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
