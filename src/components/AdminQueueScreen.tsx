import React from 'react';
import { CheckCircle2, MessageCircle, ShieldCheck } from 'lucide-react';
import type { AdminAgent, AdminDeal, Language } from '../types/dealkoro';
import { t } from '../i18n/translations';
import { formatTk } from '../utils/dealMath';

interface AdminQueueScreenProps {
  language: Language;
  admins: AdminAgent[];
  deals: AdminDeal[];
  selectedAdminId?: string;
  isAdmin?: boolean;
  onOpenDashboard?: () => void;
  onSelectAdmin: (adminId: string) => void;
  onMessageAdmin: (admin: AdminAgent) => void;
  onOpenDeal: (dealId: string) => void;
}

export function AdminQueueScreen({
  language,
  admins,
  deals,
  selectedAdminId,
  isAdmin,
  onOpenDashboard,
  onSelectAdmin,
  onMessageAdmin,
  onOpenDeal,
}: AdminQueueScreenProps) {
  const selectedAdmin = admins.find((a) => a.uid === selectedAdminId);

  // Screen 11: Admin Review Detail
  if (selectedAdmin) {
    return (
      <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-full bg-blue-50 text-blue-700 font-bold flex items-center justify-center shrink-0">
              {selectedAdmin.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-base font-bold text-slate-900 truncate">
                {selectedAdmin.name}
              </div>
              <div className="text-xs text-slate-500 truncate">
                {selectedAdmin.specialty}
              </div>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold shrink-0">
            <span>{t(language, 'verifiedBadge')}</span>
            <CheckCircle2 className="w-3.5 h-3.5" />
          </span>
        </div>

        <div className="flex items-center justify-between py-3 border-y border-slate-100">
          <div>
            <div className="text-sm font-bold text-slate-900">Admin</div>
            <div className="text-xs text-slate-500 tabular-nums">
              {selectedAdmin.completedDeals} deals · {selectedAdmin.rating.toFixed(1)} ★
            </div>
          </div>
          <button
            type="button"
            onClick={() => onMessageAdmin(selectedAdmin)}
            className="min-h-[42px] px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            <span>MESSAGE</span>
          </button>
        </div>

        <div>
          <h2 className="text-sm font-bold text-slate-900 mb-2">
            {t(language, 'reviewBtn')}
          </h2>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 leading-relaxed min-h-[120px]">
            {selectedAdmin.reviewNotes}
          </div>
        </div>
      </div>
    );
  }

  // Screen 10: Admin Queue
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <h1 className="text-lg font-bold text-slate-900">
              {t(language, 'adminQueueTitle')}
            </h1>
          </div>
          {isAdmin && onOpenDashboard && (
            <button
              type="button"
              onClick={onOpenDashboard}
              className="min-h-[38px] px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl whitespace-nowrap transition-colors"
            >
              {t(language, 'adminDashboard')}
            </button>
          )}
        </div>

        <div className="space-y-2.5">
          {admins.map((admin) => (
            <div
              key={admin.uid}
              className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-700 font-bold text-sm flex items-center justify-center shrink-0">
                  {admin.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 truncate">
                    {admin.name}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {admin.completedDeals} deals · {admin.specialty}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onSelectAdmin(admin.uid)}
                className="min-h-[40px] px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors"
              >
                <span>✓ {t(language, 'reviewBtn')}</span>
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Active & Completed Admin Deals Queue */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-slate-900">Escrow Deal Queue</h2>
        <div className="space-y-2.5">
          {deals.map((deal) => (
            <button
              key={deal.id}
              type="button"
              onClick={() => onOpenDeal(deal.id)}
              className="w-full text-left bg-white border border-slate-200 hover:border-blue-300 rounded-2xl p-4 flex items-center justify-between gap-3 transition-colors"
            >
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900 truncate">
                  {deal.title} · {deal.listingTitle}
                </div>
                <div className="text-xs text-slate-500 truncate">
                  Seller: {deal.sellerName.split(' ')[0]} · Buyer: {deal.buyerName.split(' ')[0]} · Admin: {deal.adminName}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-bold text-blue-600 tabular-nums">
                  {formatTk(deal.totalAmount)}
                </div>
                <div className="text-xs font-semibold text-emerald-700">
                  {deal.status === 'done' ? 'DONE' : deal.status.replace(/_/g, ' ')}
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
