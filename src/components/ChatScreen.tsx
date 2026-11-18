import React, { useState } from 'react';
import { Check, Send, ShieldCheck, X } from 'lucide-react';
import type { Conversation, Language, UserProfile } from '../types/dealkoro';
import { t } from '../i18n/translations';
import { formatTk } from '../utils/dealMath';
import { ResilientImage } from './ResilientImage';

interface ChatScreenProps {
  user: UserProfile;
  language: Language;
  conversation: Conversation;
  onSendMessage: (text: string) => void;
  onProposeOffer: (amount: number) => void;
  onRespondOffer: (accept: boolean) => void;
  onRequestAdminDeal: () => void;
  onDeclineAdminDeal: () => void;
  onOpenExistingDeal: (dealId: string) => void;
}

const QUICK_REPLIES = [
  'ID DETAILS',
  'YES, SURE',
  'Can you reduce the price?',
  'LET ME THINK',
];

export function ChatScreen({
  user,
  language,
  conversation,
  onSendMessage,
  onProposeOffer,
  onRespondOffer,
  onRequestAdminDeal,
  onDeclineAdminDeal,
  onOpenExistingDeal,
}: ChatScreenProps) {
  const [text, setText] = useState('');
  const [offerInput, setOfferInput] = useState(
    String(conversation.negotiatedPrice || Math.max(100, conversation.listingPrice - 100))
  );

  const peerName = conversation.isSupport
    ? 'Support'
    : conversation.buyerId === user.uid
    ? conversation.sellerName
    : `${conversation.buyerName} · Buyer`;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSendMessage(text.trim());
    setText('');
  };

  const handleOffer = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(offerInput.replace(/[^0-9]/g, ''));
    if (!Number.isFinite(num) || num <= 0) return;
    onProposeOffer(num);
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden min-h-[70vh]">
      {/* Header Summary with Listing Card (Screen 13) */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/70 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-bold text-slate-900">{peerName}</div>
          {conversation.dealId && (
            <button
              type="button"
              onClick={() => onOpenExistingDeal(conversation.dealId!)}
              className="min-h-[36px] px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700"
            >
              Open Admin Deal
            </button>
          )}
        </div>

        {!conversation.isSupport && (
          <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-2.5">
            <div className="w-16 h-12 rounded-lg overflow-hidden bg-slate-900 shrink-0">
              <ResilientImage
                src={conversation.listingImage}
                alt={conversation.listingTitle}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-slate-900 truncate">
                {conversation.listingTitle}
              </div>
              <div className="text-xs font-semibold text-blue-600 tabular-nums">
                {formatTk(conversation.listingPrice)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Messages Timeline (Screens 13, 14, 15, 27) */}
      <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[48vh]">
        {conversation.messages.map((msg) => {
          const isMine = msg.senderId === user.uid;
          if (msg.type === 'system') {
            return (
              <div key={msg.id} className="text-center py-1">
                <span className="text-xs font-bold text-emerald-700">{msg.text}</span>
              </div>
            );
          }
          return (
            <div
              key={msg.id}
              className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm ${
                  isMine
                    ? 'bg-blue-50 text-blue-950 border border-blue-100'
                    : 'bg-slate-100 text-slate-900'
                }`}
              >
                <div className="text-[11px] font-semibold text-slate-500 mb-0.5">
                  {msg.senderName}
                </div>
                <div className="font-medium break-words">{msg.text}</div>
              </div>
            </div>
          );
        })}

        {/* Screen 14: Pending Offer Accept / Decline Controls */}
        {!conversation.isSupport && conversation.offerStatus === 'offered' && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="text-xs font-semibold text-slate-700">
              Proposed offer: <span className="text-blue-600 font-bold tabular-nums">{formatTk(conversation.negotiatedPrice)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onRespondOffer(true)}
                className="flex-1 min-h-[40px] px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl inline-flex items-center justify-center gap-1"
              >
                <Check className="w-4 h-4" />
                <span>{t(language, 'acceptOffer')}</span>
              </button>
              <button
                type="button"
                onClick={() => onRespondOffer(false)}
                className="flex-1 min-h-[40px] px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl inline-flex items-center justify-center gap-1"
              >
                <X className="w-4 h-4" />
                <span>{t(language, 'declineOffer')}</span>
              </button>
            </div>
          </div>
        )}

        {/* Screen 15: Request ADMIN DEAL? */}
        {!conversation.isSupport &&
          conversation.offerStatus === 'accepted' &&
          !conversation.dealId && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
              <div className="p-3 bg-slate-50 rounded-xl text-sm font-bold text-slate-900 tabular-nums">
                Final price: {formatTk(conversation.negotiatedPrice)}
              </div>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>{t(language, 'requestAdminDeal')}</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={onRequestAdminDeal}
                  className="min-h-[44px] px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Check className="w-4 h-4" />
                  <span>{t(language, 'accept')}</span>
                </button>
                <button
                  type="button"
                  onClick={onDeclineAdminDeal}
                  className="min-h-[44px] px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-xl inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <X className="w-4 h-4" />
                  <span>{t(language, 'decline')}</span>
                </button>
              </div>
            </div>
          )}
      </div>

      {/* Bottom Negotiation & Message Composer */}
      <div className="p-4 border-t border-slate-200 bg-white space-y-3">
        {/* Quick message chips & Price offer bar */}
        {!conversation.isSupport && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {QUICK_REPLIES.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => onSendMessage(chip)}
                  className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg whitespace-nowrap shrink-0 transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>

            <form onSubmit={handleOffer} className="flex items-center gap-2">
              <input
                type="text"
                value={offerInput}
                onChange={(e) => setOfferInput(e.target.value)}
                aria-label={t(language, 'proposeOffer')}
                placeholder={t(language, 'proposeOffer')}
                className="w-36 min-h-[40px] px-3 py-1.5 text-xs font-semibold tabular-nums bg-slate-50 border border-slate-200 rounded-xl"
              />
              <button
                type="submit"
                className="min-h-[40px] px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl whitespace-nowrap"
              >
                {t(language, 'sendOffer')}
              </button>
            </form>
          </div>
        )}

        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label={t(language, 'message')}
            placeholder={t(language, 'typeMessage')}
            className="flex-1 min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:bg-white"
          />
          <button
            type="submit"
            aria-label={t(language, 'send')}
            className="min-h-[44px] px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors"
          >
            <Send className="w-4 h-4" />
            <span>{t(language, 'send')}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
