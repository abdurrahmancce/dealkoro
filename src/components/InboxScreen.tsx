import React from 'react';
import { Check, ChevronRight } from 'lucide-react';
import type { AdminDeal, Conversation, Language, UserProfile } from '../types/dealkoro';
import { t } from '../i18n/translations';

interface InboxScreenProps {
  user: UserProfile;
  language: Language;
  conversations: Conversation[];
  deals: AdminDeal[];
  onOpenConversation: (conversationId: string) => void;
  onOpenDeal: (dealId: string) => void;
}

export function InboxScreen({
  user,
  language,
  conversations,
  deals,
  onOpenConversation,
  onOpenDeal,
}: InboxScreenProps) {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-lg font-bold text-slate-900">{t(language, 'inboxTitle')}</h1>

      {/* Admin Deal Group Chats (Screens 12, 26, 31) */}
      <div className="space-y-2.5">
        {deals.map((deal) => {
          const isDone = deal.status === 'done';
          const statusLine = isDone
            ? t(language, 'dealCompleted')
            : deal.buyerInitialDone
            ? `${deal.adminName.split(' ')[0]}: Payment received`
            : `Admin deal · ${deal.listingTitle}`;

          return (
            <button
              key={deal.id}
              type="button"
              onClick={() => onOpenDeal(deal.id)}
              className="w-full text-left bg-white border border-slate-200 hover:border-blue-300 rounded-2xl p-4 flex items-center justify-between gap-3 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full bg-blue-50 text-blue-700 font-bold text-sm flex items-center justify-center shrink-0">
                  {deal.agreedAmount}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 truncate">
                    {deal.title}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{statusLine}</div>
                </div>
              </div>

              <div className="shrink-0">
                {isDone ? (
                  <span className="text-xs font-bold text-blue-600">
                    {t(language, 'done')}
                  </span>
                ) : deal.buyerInitialDone ? (
                  <Check className="w-4 h-4 text-blue-600" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </div>
            </button>
          );
        })}

        {/* Direct Buyer-Seller & Support Conversations */}
        {conversations.map((conv) => {
          const peerName = conv.isSupport
            ? 'Support'
            : conv.buyerId === user.uid
            ? conv.sellerName
            : conv.buyerName;

          return (
            <button
              key={conv.id}
              type="button"
              onClick={() => onOpenConversation(conv.id)}
              className="w-full text-left bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-4 flex items-center justify-between gap-3 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full bg-blue-50 text-blue-700 font-bold text-sm flex items-center justify-center shrink-0">
                  {peerName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 truncate">
                    {peerName}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {conv.lastMessage || conv.listingTitle}
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                {conv.unreadCount > 0 ? (
                  <span className="text-xs font-bold text-blue-600 tabular-nums">
                    {conv.unreadCount}
                  </span>
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
