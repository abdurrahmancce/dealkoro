import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Lock,
  PhoneCall,
  QrCode,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import type {
  AdminDeal,
  Language,
  PaymentGatewaySession,
  PaymentMethod,
  PlatformEscrowConfig,
} from '../types/dealkoro';
import { formatTk } from '../utils/dealMath';
import {
  buildOnlinePaymentProofNote,
  buildQrMatrix,
  createSandboxSessionPayload,
  formatGatewaySessionSummary,
  normalizeAccountType,
  parseGatewayCallbackParams,
  sanitizeMerchantPaymentLink,
  validateBdWalletNumber,
  validateTrxId,
  verifySandboxPaymentPayload,
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
  activeSessions?: PaymentGatewaySession[];
  onSaveSession?: (session: PaymentGatewaySession) => void;
  onSubmitProof: (params: {
    method: PaymentMethod;
    proofNote: string;
    proofUrl: string;
    senderNumber: string;
    trxId: string;
  }) => void;
}

type CheckoutTabMode = 'gateway' | 'manual';

interface GatewayServerConfig {
  bkash: { liveConfigured: boolean };
  nagad: { liveConfigured: boolean };
  sandboxAvailable: boolean;
}

export function OnlineWalletCheckout({
  language,
  userId,
  deal,
  totalPayable,
  platformConfig,
  initialProofNote = '',
  initialProofUrl = '',
  activeSessions = [],
  onSaveSession,
  onSubmitProof,
}: OnlineWalletCheckoutProps) {
  const isBn = language === 'bn';
  const defaultMethod: PaymentMethod =
    deal.buyerMethod === 'Nagad' ? 'Nagad' : 'bKash';

  const [checkoutTab, setCheckoutTab] = useState<CheckoutTabMode>('gateway');
  const [selectedRail, setSelectedRail] = useState<PaymentMethod>(defaultMethod);
  const [gatewayConfig, setGatewayConfig] = useState<GatewayServerConfig>({
    bkash: { liveConfigured: false },
    nagad: { liveConfigured: false },
    sandboxAvailable: true,
  });

  // Live / Sandbox Gateway session states
  const [initiatingGateway, setInitiatingGateway] = useState(false);
  const [verifyingGateway, setVerifyingGateway] = useState(false);
  const [activeSession, setActiveSession] = useState<PaymentGatewaySession | null>(
    activeSessions[0] ?? null
  );
  const [sandboxModalOpen, setSandboxModalOpen] = useState(false);
  const [sandboxStep, setSandboxStep] = useState<1 | 2>(1);
  const [sandboxWallet, setSandboxWallet] = useState('');
  const [sandboxOtp, setSandboxOtp] = useState('');
  const [sandboxPin, setSandboxPin] = useState('');
  const [gatewayError, setGatewayError] = useState<string | null>(null);

  // Manual TrxID / QR fallback states
  const [senderNumber, setSenderNumber] = useState('');
  const [trxId, setTrxId] = useState('');
  const [proofUrl, setProofUrl] = useState(initialProofUrl);
  const [uploading, setUploading] = useState(false);
  const [copiedNumber, setCopiedNumber] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  const isBkash = selectedRail === 'bKash';
  const isLiveConfigured = isBkash
    ? gatewayConfig.bkash.liveConfigured
    : gatewayConfig.nagad.liveConfigured;

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

  useEffect(() => {
    let mounted = true;
    fetch('/api/payments/config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: GatewayServerConfig | null) => {
        if (mounted && data && typeof data.sandboxAvailable === 'boolean') {
          setGatewayConfig(data);
        }
      })
      .catch(() => {
        // Static builds or offline preview gracefully use client sandbox fallback
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (activeSessions.length > 0 && !activeSession) {
      setActiveSession(activeSessions[0]);
    }
  }, [activeSessions, activeSession]);

  // Handle live merchant redirect callback if present in URL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cb = parseGatewayCallbackParams(window.location.search);
    if (!cb || cb.status === 'cancel' || cb.status === 'failure') return;
    const gatewayPaymentId = cb.paymentID || cb.paymentRefId;
    if (!gatewayPaymentId) return;

    const method: PaymentMethod = cb.method || selectedRail;
    setSelectedRail(method);
    setVerifyingGateway(true);
    fetch('/api/payments/session/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dealId: deal.id,
        buyerId: userId,
        method,
        amount: totalPayable,
        gatewayPaymentId,
      }),
    })
      .then((r) => r.json())
      .then((res: { ok?: boolean; session?: PaymentGatewaySession; error?: string }) => {
        if (res.ok && res.session) {
          setActiveSession(res.session);
          onSaveSession?.(res.session);
          const note = buildOnlinePaymentProofNote({
            method: res.session.method,
            senderNumber: res.session.senderMasked || '01700000000',
            trxId: res.session.trxId || gatewayPaymentId,
            amount: res.session.amount,
            dealId: deal.id,
            mode: res.session.mode,
          });
          onSubmitProof({
            method: res.session.method,
            proofNote: note,
            proofUrl: '',
            senderNumber: res.session.senderMasked || 'Verified Wallet',
            trxId: res.session.trxId || gatewayPaymentId,
          });
          setSubmittedSuccess(true);
        } else if (res.error) {
          setGatewayError(res.error);
        }
      })
      .catch(() => {})
      .finally(() => setVerifyingGateway(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal.id]);

  const qrPayload = useMemo(
    () =>
      `${selectedRail.toLowerCase()}://pay?to=${targetNumber.replace(/[^\d]/g, '')}&amount=${Math.round(totalPayable)}&ref=${deal.id}`,
    [selectedRail, targetNumber, totalPayable, deal.id]
  );
  const qrMatrix = useMemo(() => buildQrMatrix(qrPayload, 21), [qrPayload]);

  const handleStartGatewayPayment = async () => {
    setGatewayError(null);
    setSubmittedSuccess(false);
    setInitiatingGateway(true);

    let createdSession: PaymentGatewaySession | null = null;
    try {
      const res = await fetch('/api/payments/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealId: deal.id,
          buyerId: userId,
          method: selectedRail,
          amount: totalPayable,
          callbackOrigin: typeof window !== 'undefined' ? window.location.origin : '',
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { session?: PaymentGatewaySession };
        if (data.session) {
          createdSession = data.session;
        }
      }
    } catch {
      // Fall back to deterministic sandbox session when backend proxy is unreachable
    }

    if (!createdSession) {
      createdSession = createSandboxSessionPayload({
        dealId: deal.id,
        buyerId: userId,
        method: selectedRail,
        amount: totalPayable,
      });
    }

    setInitiatingGateway(false);
    setActiveSession(createdSession);
    onSaveSession?.(createdSession);

    if (createdSession.mode === 'sandbox') {
      setSandboxStep(1);
      setSandboxOtp('');
      setSandboxPin('');
      setSandboxModalOpen(true);
    }
  };

  const handleVerifyLiveSession = async () => {
    if (!activeSession) return;
    setGatewayError(null);
    setVerifyingGateway(true);
    try {
      const res = await fetch('/api/payments/session/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSession.id,
          dealId: deal.id,
          buyerId: userId,
          method: activeSession.method,
          amount: activeSession.amount,
          gatewayPaymentId: activeSession.gatewayPaymentId,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        session?: PaymentGatewaySession;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.session) {
        setGatewayError(data.error || 'Could not verify gateway authorization yet.');
        return;
      }
      setActiveSession(data.session);
      onSaveSession?.(data.session);
      const note = buildOnlinePaymentProofNote({
        method: data.session.method,
        senderNumber: data.session.senderMasked || '01700000000',
        trxId: data.session.trxId || data.session.gatewayPaymentId,
        amount: data.session.amount,
        dealId: deal.id,
        mode: data.session.mode,
      });
      onSubmitProof({
        method: data.session.method,
        proofNote: note,
        proofUrl: '',
        senderNumber: data.session.senderMasked || 'Verified Wallet',
        trxId: data.session.trxId || data.session.gatewayPaymentId,
      });
      setSubmittedSuccess(true);
    } catch {
      setGatewayError('Network error while checking payment status.');
    } finally {
      setVerifyingGateway(false);
    }
  };

  const handleCompleteSandboxPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;
    setGatewayError(null);
    setVerifyingGateway(true);

    let verifiedSession: PaymentGatewaySession | null = null;
    try {
      const res = await fetch('/api/payments/session/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSession.id,
          dealId: deal.id,
          buyerId: userId,
          method: activeSession.method,
          amount: activeSession.amount,
          gatewayPaymentId: activeSession.gatewayPaymentId,
          walletNumber: sandboxWallet,
          otp: sandboxOtp,
          pin: sandboxPin,
        }),
      });
      if (res.status !== 404) {
        const data = (await res.json()) as {
          ok?: boolean;
          session?: PaymentGatewaySession;
          error?: string;
        };
        if (!res.ok || !data.ok || !data.session) {
          setVerifyingGateway(false);
          setGatewayError(data.error || 'Gateway verification failed.');
          return;
        }
        verifiedSession = data.session;
      }
    } catch {
      // Static build fallback below
    }

    if (!verifiedSession) {
      const localCheck = verifySandboxPaymentPayload({
        session: activeSession,
        walletNumber: sandboxWallet,
        otp: sandboxOtp,
        pin: sandboxPin,
      });
      if (!localCheck.ok || !localCheck.session) {
        setVerifyingGateway(false);
        setGatewayError(localCheck.error || 'Invalid OTP or PIN.');
        return;
      }
      verifiedSession = localCheck.session;
    }

    setVerifyingGateway(false);
    setActiveSession(verifiedSession);
    onSaveSession?.(verifiedSession);
    setSandboxModalOpen(false);

    const normalizedWallet = validateBdWalletNumber(sandboxWallet).normalized;
    const note = buildOnlinePaymentProofNote({
      method: verifiedSession.method,
      senderNumber: normalizedWallet,
      trxId: verifiedSession.trxId || verifiedSession.gatewayPaymentId,
      amount: verifiedSession.amount,
      dealId: deal.id,
      mode: verifiedSession.mode,
    });

    onSubmitProof({
      method: verifiedSession.method,
      proofNote: note,
      proofUrl: '',
      senderNumber: normalizedWallet,
      trxId: verifiedSession.trxId || verifiedSession.gatewayPaymentId,
    });
    setSubmittedSuccess(true);
  };

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

  const handleManualSubmit = (e: React.FormEvent) => {
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
              {selectedRail}{' '}
              {isBn ? 'রিয়েল-টাইম পেমেন্ট গেটওয়ে' : 'Real-Time Payment Gateway'}
            </div>
            <div className="text-[11px] text-white/90">
              {escrowLabel} · {accountType} ·{' '}
              {isLiveConfigured ? 'Live Merchant API' : 'Interactive Sandbox Mode'}
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[11px] text-white/85">
            {isBn ? 'মোট পরিশোধযোগ্য' : 'Payable Total'}
          </div>
          <div className="text-base font-extrabold font-mono tabular-nums">
            {formatTk(totalPayable)}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Wallet Method Selector */}
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
                onClick={() => {
                  setSelectedRail(method);
                  setGatewayError(null);
                }}
                className={`min-h-[40px] rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                  active
                    ? method === 'bKash'
                      ? 'bg-[#E2136E] text-white shadow-xs'
                      : 'bg-[#EA580C] text-white shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700'
                }`}
              >
                {method} Gateway
              </button>
            );
          })}
        </div>

        {/* Mode Switch: Instant Gateway vs Manual TrxID */}
        <div
          className="grid grid-cols-2 gap-2 p-1 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl"
          role="tablist"
          aria-label="Checkout flow type"
        >
          <button
            type="button"
            role="tab"
            aria-selected={checkoutTab === 'gateway'}
            onClick={() => setCheckoutTab('gateway')}
            className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              checkoutTab === 'gateway'
                ? 'bg-slate-900 dark:bg-blue-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {isBn ? 'ইনস্ট্যান্ট গেটওয়ে পে' : 'Instant Gateway Pay'}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={checkoutTab === 'manual'}
            onClick={() => setCheckoutTab('manual')}
            className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              checkoutTab === 'manual'
                ? 'bg-slate-900 dark:bg-blue-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {isBn ? 'ম্যানুয়াল TrxID ও QR' : 'Manual TrxID & QR'}
          </button>
        </div>

        {checkoutTab === 'gateway' ? (
          <div className="space-y-3.5">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-bold text-slate-900 dark:text-white">
                  {isLiveConfigured
                    ? `Official ${selectedRail} Merchant API`
                    : `${selectedRail} Merchant Sandbox Gateway`}
                </span>
                <span className="font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  {isLiveConfigured ? 'Live Connected' : 'Sandbox Active'}
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {isLiveConfigured
                  ? isBn
                    ? `অফিশিয়াল ${selectedRail} চেকআউট সেশন তৈরি করে সরাসরি পেমেন্ট সম্পন্ন করুন।`
                    : `Create a live ${selectedRail} Tokenized Checkout session and verify transaction status automatically.`
                  : isBn
                  ? `লাইভ মার্চেন্ট API কী সেট না থাকায় ইন্টারেক্টিভ ${selectedRail} স্যান্ডবক্স গেটওয়ে চালু আছে — ওয়ালেট নম্বর, OTP (123456) ও পিন দিয়ে রিয়েল-টাইম পেমেন্ট যাচাই করুন।`
                  : `Interactive ${selectedRail} sandbox gateway active (auto-upgrades when merchant API secrets are configured). Authorize with wallet number, OTP (123456), and PIN to attach a verified TrxID.`}
              </p>

              {activeSession && (
                <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {formatGatewaySessionSummary(activeSession)}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      Ref: {activeSession.gatewayPaymentId}
                    </span>
                  </div>
                  {activeSession.mode === 'live_api' &&
                    activeSession.redirectUrl &&
                    activeSession.status !== 'verified' && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <a
                          href={activeSession.redirectUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold text-white inline-flex items-center gap-1.5 ${
                            isBkash ? 'bg-[#E2136E]' : 'bg-[#EA580C]'
                          }`}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Authorize in {activeSession.method}</span>
                        </a>
                        <button
                          type="button"
                          disabled={verifyingGateway}
                          onClick={() => void handleVerifyLiveSession()}
                          className="min-h-[38px] px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5"
                        >
                          {verifyingGateway && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          <span>Verify Payment Status</span>
                        </button>
                      </div>
                    )}
                </div>
              )}
            </div>

            {gatewayError && (
              <div
                role="alert"
                className="p-2.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl"
              >
                {gatewayError}
              </div>
            )}

            {(submittedSuccess || initialProofNote) && (
              <div className="p-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  {isBn
                    ? 'গেটওয়ে পেমেন্ট তথ্য লাইভ পাঠানো হয়েছে — অ্যাডমিন যাচাই করছেন।'
                    : 'Gateway payment verified & submitted — awaiting Admin confirmation.'}
                </span>
              </div>
            )}

            <button
              type="button"
              disabled={initiatingGateway || verifyingGateway}
              onClick={() => void handleStartGatewayPayment()}
              className={`w-full min-h-[46px] text-white text-sm font-bold rounded-xl inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60 ${
                isBkash
                  ? 'bg-[#E2136E] hover:bg-[#c80f60]'
                  : 'bg-[#EA580C] hover:bg-[#d14c08]'
              }`}
            >
              {initiatingGateway ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              <span>
                {initiatingGateway
                  ? 'Connecting Gateway...'
                  : isBn
                  ? `${selectedRail} গেটওয়ে দিয়ে ${formatTk(totalPayable)} পে করুন`
                  : `Pay ${formatTk(totalPayable)} via ${selectedRail} Gateway`}
              </span>
            </button>
          </div>
        ) : (
          <>
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
                    {selectedRail} {accountType} (
                    {accountType === 'Merchant'
                      ? 'Make Payment'
                      : accountType === 'Agent'
                      ? 'Cash Out'
                      : 'Send Money'}
                    )
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

            <form onSubmit={handleManualSubmit} className="space-y-3">
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
          </>
        )}
      </div>

      {/* Interactive bKash / Nagad Sandbox Checkout Modal */}
      {sandboxModalOpen && activeSession && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${activeSession.method} sandbox checkout`}
        >
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-2xl">
            <div
              className={`px-5 py-4 text-white flex items-center justify-between ${
                activeSession.method === 'bKash' ? 'bg-[#E2136E]' : 'bg-[#EA580C]'
              }`}
            >
              <div>
                <div className="text-sm font-extrabold">
                  {activeSession.method} Merchant Checkout
                </div>
                <div className="text-[11px] text-white/90 font-mono">
                  Sandbox · {activeSession.gatewayPaymentId}
                </div>
              </div>
              <button
                type="button"
                aria-label="Close checkout modal"
                onClick={() => setSandboxModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/15"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => void handleCompleteSandboxPayment(e)}
              className="p-5 space-y-4"
            >
              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <div className="text-slate-500 dark:text-slate-400">Merchant</div>
                  <div className="font-bold text-slate-900 dark:text-white">
                    {escrowLabel}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-slate-500 dark:text-slate-400">Amount</div>
                  <div className="text-base font-extrabold font-mono text-slate-900 dark:text-white tabular-nums">
                    {formatTk(activeSession.amount)}
                  </div>
                </div>
              </div>

              {sandboxStep === 1 ? (
                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor="sbx-wallet"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                    >
                      Your {activeSession.method} Account Number
                    </label>
                    <input
                      id="sbx-wallet"
                      type="tel"
                      inputMode="tel"
                      value={sandboxWallet}
                      onChange={(e) => setSandboxWallet(e.target.value)}
                      placeholder="017XXXXXXXX"
                      required
                      className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const check = validateBdWalletNumber(sandboxWallet);
                      if (!check.valid) {
                        setGatewayError(
                          'Enter a valid 11-digit BD mobile wallet number (01XXXXXXXXX).'
                        );
                        return;
                      }
                      setGatewayError(null);
                      setSandboxStep(2);
                    }}
                    className={`w-full min-h-[44px] text-white text-sm font-bold rounded-xl inline-flex items-center justify-center gap-1.5 ${
                      activeSession.method === 'bKash'
                        ? 'bg-[#E2136E] hover:bg-[#c80f60]'
                        : 'bg-[#EA580C] hover:bg-[#d14c08]'
                    }`}
                  >
                    <span>Proceed to OTP &amp; PIN</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    Wallet: <span className="font-mono font-bold">{sandboxWallet}</span>{' '}
                    · <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">Sandbox OTP: 123456</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label
                        htmlFor="sbx-otp"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                      >
                        6-Digit OTP
                      </label>
                      <input
                        id="sbx-otp"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={sandboxOtp}
                        onChange={(e) => setSandboxOtp(e.target.value)}
                        placeholder="123456"
                        required
                        className="w-full min-h-[42px] px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="sbx-pin"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                      >
                        {activeSession.method} PIN
                      </label>
                      <input
                        id="sbx-pin"
                        type="password"
                        inputMode="numeric"
                        maxLength={5}
                        value={sandboxPin}
                        onChange={(e) => setSandboxPin(e.target.value)}
                        placeholder="4-5 digits"
                        required
                        className="w-full min-h-[42px] px-3 py-2 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSandboxStep(1)}
                      className="min-h-[42px] px-3.5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={verifyingGateway}
                      className={`flex-1 min-h-[42px] text-white text-sm font-bold rounded-xl inline-flex items-center justify-center gap-1.5 disabled:opacity-60 ${
                        activeSession.method === 'bKash'
                          ? 'bg-[#E2136E] hover:bg-[#c80f60]'
                          : 'bg-[#EA580C] hover:bg-[#d14c08]'
                      }`}
                    >
                      {verifyingGateway && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>Authorize &amp; Pay</span>
                    </button>
                  </div>
                </div>
              )}

              {gatewayError && (
                <div
                  role="alert"
                  className="p-2.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl"
                >
                  {gatewayError}
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
