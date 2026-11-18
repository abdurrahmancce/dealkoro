import React from 'react';
import { Check, ChevronRight, MessageSquare, ShieldCheck } from 'lucide-react';
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
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-lg font-bold text-slate-900 dark:text-white">
        {t(language, 'inboxTitle')}
      </h1>

      {/* Admin Deal Group Chats */}
      <section className="space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>{t(language, 'activeDeals')} ({deals.length})</span>
        </div>

        {deals.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 text-xs text-slate-500 dark:text-slate-400">
            {t(language, 'noActiveDeals')}
          </div>
        ) : (
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
                  className="w-full text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 rounded-2xl p-4 flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-full bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-bold text-sm flex items-center justify-center shrink-0 tabular-nums">
                      {deal.agreedAmount}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {deal.title}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {statusLine}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isDone ? (
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                        {t(language, 'done')}
                      </span>
                    ) : deal.buyerInitialDone ? (
                      <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Direct Buyer-Seller & Support Conversations */}
      <section className="space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <MessageSquare className="w-4 h-4 text-slate-400" />
          <span>Direct Chats ({conversations.length})</span>
        </div>

        {conversations.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center text-xs text-slate-500 dark:text-slate-400">
            No conversations yet. Message a seller from any listing to start!
          </div>
        ) : (
          <div className="space-y-2.5">
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
                  className="w-full text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-2xl p-4 flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-full bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-bold text-sm flex items-center justify-center shrink-0">
                      {peerName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {peerName}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {conv.lastMessage || conv.listingTitle}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {conv.unreadCount > 0 ? (
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 tabular-nums">
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
        )}
      </section>
    </div>
  );
}
