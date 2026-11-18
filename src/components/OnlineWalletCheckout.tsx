import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  PhoneCall,
  QrCode,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import type {
  AdminDeal,
  Language,
  PaymentMethod,
  PlatformEscrowConfig,
} from '../types/dealkoro';
import { formatTk } from '../utils/dealMath';
import {
  buildOnlinePaymentProofNote,
  buildQrMatrix,
  normalizeAccountType,
  sanitizeMerchantPaymentLink,
  validateBdWalletNumber,
  validateTrxId,
} from '../utils/paymentGateway';
import { BLUEPRINT_LIMITS, sanitizeImageUrl } from '../utils/payloadSanitizer';
import { uploadImageFile } from '../services/dealkoroService';
import { ResilientImage } from './ResilientImage';

interface OnlineWalletCheckoutProps {
  language: Language;
  userId: string;
  deal: AdminDeal;
  totalPayable: number;
  platformConfig?: PlatformEscrowConfig;
  initialProofNote?: string;
  initialProofUrl?: string;
  onSubmitProof: (params: {
    method: PaymentMethod;
    proofNote: string;
    proofUrl: string;
    senderNumber: string;
    trxId: string;
  }) => void;
}

export function OnlineWalletCheckout({
  language,
  userId,
  deal,
  totalPayable,
  platformConfig,
  initialProofNote = '',
  initialProofUrl = '',
  onSubmitProof,
}: OnlineWalletCheckoutProps) {
  const isBn = language === 'bn';
  const defaultMethod: PaymentMethod =
    deal.buyerMethod === 'Nagad' ? 'Nagad' : 'bKash';

  const [selectedRail, setSelectedRail] = useState<PaymentMethod>(defaultMethod);
  const [senderNumber, setSenderNumber] = useState('');
  const [trxId, setTrxId] = useState('');
  const [proofUrl, setProofUrl] = useState(initialProofUrl);
  const [uploading, setUploading] = useState(false);
  const [copiedNumber, setCopiedNumber] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  const isBkash = selectedRail === 'bKash';
  const targetNumber = isBkash
    ? platformConfig?.bkashNumber || '01755-842190'
    : platformConfig?.nagadNumber || '01755-842190';
  const accountType = normalizeAccountType(
    isBkash ? platformConfig?.bkashAccountType : platformConfig?.nagadAccountType
  );
  const merchantLink = sanitizeMerchantPaymentLink(
    isBkash ? platformConfig?.bkashPaymentLink : platformConfig?.nagadPaymentLink
  );
  const escrowLabel = platformConfig?.escrowLabel || 'DEALKORO Official Escrow';

  const qrPayload = useMemo(
    () =>
      `${selectedRail.toLowerCase()}://pay?to=${targetNumber.replace(/[^\d]/g, '')}&amount=${Math.round(totalPayable)}&ref=${deal.id}`,
    [selectedRail, targetNumber, totalPayable, deal.id]
  );
  const qrMatrix = useMemo(() => buildQrMatrix(qrPayload, 21), [qrPayload]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setUploading(true);
    const res = await uploadImageFile('proofs', userId, file);
    setUploading(false);
    if (res.url) {
      setProofUrl(res.url);
    } else if (res.error) {
      setErrorMsg(res.error);
    }
  };

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmittedSuccess(false);

    const walletCheck = validateBdWalletNumber(senderNumber);
    if (!walletCheck.valid) {
      setErrorMsg(
        isBn
          ? 'সঠিক ১১ ডিজিটের বাংলাদেশি বিকাশ/নগদ নম্বর দিন (যেমন: 017XXXXXXXX)।'
          : 'Enter a valid 11-digit Bangladesh mobile number (e.g. 017XXXXXXXX).'
      );
      return;
    }

    const trxCheck = validateTrxId(trxId);
    if (!trxCheck.valid) {
      setErrorMsg(
        isBn
          ? 'সঠিক Transaction ID (TrxID) লিখুন (কমপক্ষে ৬ অক্ষর/সংখ্যা)।'
          : 'Enter a valid Transaction ID / TrxID (6-20 alphanumeric characters).'
      );
      return;
    }

    const trimmedUrl = proofUrl.trim();
    const cleanUrl = trimmedUrl ? sanitizeImageUrl(trimmedUrl, '') : '';
    if (trimmedUrl && !cleanUrl) {
      setErrorMsg(
        isBn
          ? 'সঠিক HTTPS লিংক দিন অথবা Photo বাটন দিয়ে স্ক্রিনশট আপলোড করুন।'
          : 'Use the Photo button to upload a screenshot or paste a valid HTTPS URL.'
      );
      return;
    }

    const formattedNote = buildOnlinePaymentProofNote({
      method: selectedRail,
      senderNumber: walletCheck.normalized,
      trxId: trxCheck.normalized,
      amount: totalPayable,
      dealId: deal.id,
      mode: merchantLink ? 'merchant_link' : 'online_checkout',
    });

    onSubmitProof({
      method: selectedRail,
      proofNote: formattedNote,
      proofUrl: cleanUrl,
      senderNumber: walletCheck.normalized,
      trxId: trxCheck.normalized,
    });
    setSubmittedSuccess(true);
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
      {/* Branded Gateway Header */}
      <div
        className={`px-4 py-3.5 text-white flex flex-wrap items-center justify-between gap-3 transition-colors ${
          isBkash ? 'bg-[#E2136E]' : 'bg-[#EA580C]'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 shrink-0" />
          <div>
            <div className="text-sm font-extrabold tracking-tight">
              {selectedRail} {isBn ? 'রিয়েল-টাইম অনলাইন পেমেন্ট' : 'Real-Time Online Checkout'}
            </div>
            <div className="text-[11px] text-white/90">
              {escrowLabel} · {accountType}
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[11px] text-white/85">
            {isBn ? 'মোট পরিশোধযোগ্য' : 'Payable Total'}
          </div>
          <div className="text-base font-extrabold tabular-nums">
            {formatTk(totalPayable)}
          </div>
        </div>
      </div>

      {/* Wallet Method Tabs */}
      <div className="p-4 space-y-4">
        <div
          className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl"
          role="tablist"
          aria-label="Select mobile banking gateway"
        >
          {(['bKash', 'Nagad'] as PaymentMethod[]).map((method) => {
            const active = selectedRail === method;
            return (
              <button
                key={method}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedRail(method)}
                className={`min-h-[40px] rounded-lg text-xs font-bold transition-colors ${
                  active
                    ? method === 'bKash'
                      ? 'bg-[#E2136E] text-white shadow-xs'
                      : 'bg-[#EA580C] text-white shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700'
                }`}
              >
                {method} Online
              </button>
            );
          })}
        </div>

        {/* Live QR + Number + Merchant Link / USSD */}
        <div className="grid grid-cols-1 sm:grid-cols-[132px_1fr] gap-4 items-center p-3.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl">
          <div className="mx-auto sm:mx-0 flex flex-col items-center gap-1.5">
            <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <svg
                width="104"
                height="104"
                viewBox="0 0 21 21"
                role="img"
                aria-label={`${selectedRail} payment QR for ${targetNumber}`}
                className="block"
              >
                <rect width="21" height="21" fill="#ffffff" />
                {qrMatrix.map((row, r) =>
                  row.map((filled, c) =>
                    filled ? (
                      <rect
                        key={`${r}-${c}`}
                        x={c}
                        y={r}
                        width="1"
                        height="1"
                        fill={isBkash ? '#880E4F' : '#9A3412'}
                      />
                    ) : null
                  )
                )}
              </svg>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
              <QrCode className="w-3 h-3" />
              <span>{isBn ? 'অ্যাডমিন পেমেন্ট QR' : 'Escrow Ref QR'}</span>
            </span>
          </div>

          <div className="space-y-2.5 min-w-0">
            <div>
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {selectedRail} {accountType} ({accountType === 'Merchant' ? 'Make Payment' : accountType === 'Agent' ? 'Cash Out' : 'Send Money'})
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-base font-extrabold font-mono text-slate-900 dark:text-white tracking-tight">
                  {targetNumber}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(targetNumber);
                    setCopiedNumber(true);
                    window.setTimeout(() => setCopiedNumber(false), 1800);
                  }}
                  className="min-h-[32px] px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {copiedNumber ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedNumber ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {merchantLink && (
                <a
                  href={merchantLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold text-white inline-flex items-center gap-1.5 transition-colors ${
                    isBkash
                      ? 'bg-[#E2136E] hover:bg-[#c80f60]'
                      : 'bg-[#EA580C] hover:bg-[#d14c08]'
                  }`}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>
                    {isBn
                      ? `${selectedRail} পেমেন্ট লিংক খুলুন`
                      : `Pay via ${selectedRail} Link`}
                  </span>
                </a>
              )}

              <a
                href={isBkash ? 'tel:*247%23' : 'tel:*167%23'}
                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Dial {isBkash ? '*247#' : '*167#'}</span>
              </a>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              {isBn
                ? `টাকা পাঠানোর পর নিচে আপনার ${selectedRail} নম্বর ও TrxID দিলে রিয়েল-টাইমে অ্যাডমিন ও সেলার দেখতে পারবেন।`
                : `After sending ${formatTk(totalPayable)}, submit your sender ${selectedRail} number & TrxID below for live Admin verification.`}
            </p>
          </div>
        </div>

        {/* Real-Time TrxID Verification Submission Form */}
        <form onSubmit={handleCheckoutSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="wallet-sender-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                {isBn
                  ? `আপনার ${selectedRail} নম্বর`
                  : `Your ${selectedRail} Sender Number`}
              </label>
              <input
                id="wallet-sender-input"
                type="tel"
                inputMode="tel"
                value={senderNumber}
                onChange={(e) => setSenderNumber(e.target.value)}
                placeholder="017XXXXXXXX"
                className="w-full min-h-[42px] px-3.5 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
              />
            </div>

            <div>
              <label
                htmlFor="wallet-trx-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                {selectedRail} Transaction ID (TrxID)
              </label>
              <input
                id="wallet-trx-input"
                type="text"
                value={trxId}
                onChange={(e) => setTrxId(e.target.value.toUpperCase())}
                placeholder="e.g. BL8A4K92P1"
                className="w-full min-h-[42px] px-3.5 py-2 text-sm font-mono uppercase bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="min-h-[40px] px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer">
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              <span>
                {uploading
                  ? 'Uploading...'
                  : isBn
                  ? 'স্ক্রিনশট আপলোড (ঐচ্ছিক)'
                  : 'Upload Receipt Photo (Optional)'}
              </span>
              <input
                type="file"
                accept="image/*"
                disabled={uploading}
                className="sr-only"
                onChange={(e) => void handlePhotoUpload(e)}
              />
            </label>

            <input
              type="url"
              aria-label="Optional proof screenshot HTTPS link"
              value={proofUrl.startsWith('data:') ? '' : proofUrl}
              onChange={(e) => setProofUrl(e.target.value)}
              maxLength={BLUEPRINT_LIMITS.URL_MAX}
              placeholder={isBn ? 'অথবা HTTPS স্ক্রিনশট লিংক দিন' : 'Or paste HTTPS screenshot link'}
              className="flex-1 min-w-[180px] min-h-[40px] px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
            />
          </div>

          {proofUrl.startsWith('data:') && (
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-12 h-9 rounded-lg overflow-hidden bg-slate-900 shrink-0">
                  <ResilientImage
                    src={proofUrl}
                    alt="Uploaded payment receipt"
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  Receipt screenshot ready
                </span>
              </div>
              <button
                type="button"
                onClick={() => setProofUrl('')}
                className="text-xs font-semibold text-red-600 dark:text-red-400 px-2 py-1"
              >
                Remove
              </button>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="p-2.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl"
            >
              {errorMsg}
            </div>
          )}

          {(submittedSuccess || initialProofNote) && (
            <div className="p-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                {isBn
                  ? 'পেমেন্ট তথ্য লাইভ পাঠানো হয়েছে — অ্যাডমিন যাচাই করছেন।'
                  : 'Payment submitted in real time — awaiting Admin verification.'}
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={uploading}
            className={`w-full min-h-[46px] text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-60 ${
              isBkash
                ? 'bg-[#E2136E] hover:bg-[#c80f60]'
                : 'bg-[#EA580C] hover:bg-[#d14c08]'
            }`}
          >
            {isBn
              ? `${selectedRail} পেমেন্ট কনফার্ম ও জমা দিন`
              : `Confirm & Submit ${selectedRail} Payment`}
          </button>
        </form>
      </div>
    </div>
  );
}
