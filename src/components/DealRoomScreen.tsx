import React, { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
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
  UserProfile,
} from '../types/dealkoro';
import { t } from '../i18n/translations';
import { calculateDealBreakdown, formatTk } from '../utils/dealMath';
import { ResilientImage } from './ResilientImage';

interface DealRoomScreenProps {
  user: UserProfile;
  language: Language;
  deal: AdminDeal;
  onUpdateDeal: (updated: AdminDeal) => void;
  onSendGroupMessage: (text: string) => void;
  onCompleteReview: (dealId: string, rating: number, comment: string) => void;
  onBackToInbox: () => void;
}

export function DealRoomScreen({
  user,
  language,
  deal,
  onUpdateDeal,
  onSendGroupMessage,
  onCompleteReview,
  onBackToInbox,
}: DealRoomScreenProps) {
  const [countdown, setCountdown] = useState(60);
  const [copiedContact, setCopiedContact] = useState(false);
  const [proofNote, setProofNote] = useState(deal.paymentProofNote || '');
  const [accountDetails, setAccountDetails] = useState(deal.accountDetailsNote || '');
  const [groupMsg, setGroupMsg] = useState('');
  const [reviewRating, setReviewRating] = useState(deal.reviewRating || 5);
  const [reviewComment, setReviewComment] = useState(deal.reviewComment || '');

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

  const applyUpdate = (patch: Partial<AdminDeal>) => {
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
    onUpdateDeal({
      ...merged,
      serviceFee: nextBreakdown.serviceFee,
      crossDealRequired: nextBreakdown.crossDealRequired,
      crossDealFee: nextBreakdown.crossDealFee,
      verificationFee: nextBreakdown.verificationFee,
      totalAmount: nextBreakdown.totalPayable,
    });
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
            onClick={() => applyUpdate({ status: 'finding_admin' })}
            className="w-full min-h-[46px] bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors"
          >
            Continue to Find Admin
          </button>
          <button
            type="button"
            onClick={() => applyUpdate({ status: 'cancelled' })}
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
          onClick={() => applyUpdate({ status: 'service_select' })}
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
              Verified Escrow Room · Total: <span className="font-bold text-slate-900 tabular-nums">{formatTk(breakdown.totalPayable)}</span>
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
                  applyUpdate({
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
                  onClick={() => applyUpdate({ sellerMethod: method })}
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
                  onClick={() => applyUpdate({ buyerMethod: method })}
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
                  applyUpdate({
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
                applyUpdate({
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
              onClick={() => applyUpdate({ status: 'payment_method' })}
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
              onClick={() => applyUpdate({ iosCheck: !deal.iosCheck })}
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
              onClick={() => applyUpdate({ googleBindCheck: !deal.googleBindCheck })}
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
            onClick={() => applyUpdate({ status: 'cost_summary' })}
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
                  {deal.serviceType === 'ultimate_safe' ? 'Ultimate Safe Deal' : 'Normal Deal'}
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
              Payment contact: {deal.paymentContact}
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(deal.paymentContact);
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
            onClick={() => applyUpdate({ status: 'payment_instruction' })}
            className="w-full min-h-[46px] bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl"
          >
            Proceed to Payment Proof
          </button>
        </div>
      )}

      {/* Screen 24: Payment Instruction & Proof */}
      {deal.status === 'payment_instruction' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="text-xs font-bold text-blue-600">{deal.adminName} ✓</div>
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800">
            {t(language, 'paymentInstruction')}{' '}
            <span className="font-bold tabular-nums">{formatTk(breakdown.totalPayable)}</span> →{' '}
            <span className="font-mono font-semibold">{deal.paymentContact}</span>
          </div>

          <div>
            <label
              htmlFor="payment-proof-input"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Payment Proof (Transaction ID / Screenshot reference)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="payment-proof-input"
                type="text"
                value={proofNote}
                onChange={(e) => setProofNote(e.target.value)}
                placeholder="e.g. TrxID 8N4K2P19 (Photo / screenshot attached)"
                className="flex-1 min-h-[44px] px-3.5 py-2 text-sm border border-slate-300 rounded-xl"
              />
              <label className="min-h-[44px] px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setProofNote(`Screenshot: ${f.name}`);
                  }}
                />
              </label>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              applyUpdate({
                paymentProofNote: proofNote.trim() || 'Payment receipt screenshot verified',
                buyerInitialDone: true,
                status: 'payment_received',
              })
            }
            className="w-full min-h-[46px] bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl"
          >
            {t(language, 'submitPaymentProof')}
          </button>
        </div>
      )}

      {/* Screen 25: Payment Received Confirmation */}
      {deal.status === 'payment_received' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="text-xs font-bold text-blue-600">{deal.adminName} ✓</div>
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-4">
            <div>
              <div className="text-base font-extrabold text-emerald-700">
                {t(language, 'paymentReceived')}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Buyer and seller confirmation
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
            <span className="font-bold text-emerald-700">Status: done</span>
          </div>

          <button
            type="button"
            onClick={() => applyUpdate({ status: 'id_exchange' })}
            className="w-full min-h-[46px] bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl"
          >
            Proceed to ID Exchange
          </button>
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
                Buyer: DONE
              </div>
              <div className="py-2 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg">
                Seller: DONE
              </div>
            </div>
            <div className="text-xs font-extrabold text-blue-600">
              {t(language, 'idExchange')}
            </div>
          </div>

          <div>
            <label
              htmlFor="account-exchange-input"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              {deal.sellerName.split(' ')[0]}, enter your number / account transfer details
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
              applyUpdate({
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
        </div>
      )}

      {/* Screens 29 & 30: Deal Completion Prompt + Feedback & 5-Star Rating */}
      {(deal.status === 'review_prompt' || deal.status === 'done') && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-bold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{t(language, 'dealDoneReview')}</span>
          </div>

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
