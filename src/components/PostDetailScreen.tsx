import React, { useState } from 'react';
import { Bookmark, MessageCircle, Send, Star } from 'lucide-react';
import type { Language, Listing, ListingComment } from '../types/dealkoro';
import { t } from '../i18n/translations';
import { formatTk } from '../utils/dealMath';
import { ResilientImage } from './ResilientImage';

interface PostDetailScreenProps {
  language: Language;
  listing: Listing;
  comments: ListingComment[];
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  onMessageSeller: () => void;
  onAddComment: (text: string) => void;
}

export function PostDetailScreen({
  language,
  listing,
  comments,
  isBookmarked,
  onToggleBookmark,
  onMessageSeller,
  onAddComment,
}: PostDetailScreenProps) {
  const [commentText, setCommentText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    onAddComment(commentText.trim());
    setCommentText('');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="aspect-[16/10] bg-slate-900">
          <ResilientImage
            src={listing.imageUrl}
            alt={listing.title}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs text-slate-500">
                {listing.category} · {listing.sellerName}
              </div>
              <h1 className="text-xl font-bold text-slate-900 mt-1">
                {listing.title}
              </h1>
            </div>
            <div className="text-xl font-extrabold text-blue-600 tabular-nums shrink-0">
              {formatTk(listing.price)}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <span>Rated:</span>
            <span className="inline-flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`w-3.5 h-3.5 ${
                    i < Math.round(listing.rating)
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-slate-300'
                  }`}
                />
              ))}
            </span>
            <span className="tabular-nums">({listing.rating.toFixed(1)})</span>
          </div>

          <p className="text-sm text-slate-700 leading-relaxed">
            {listing.description}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
            <div>
              <div className="text-slate-400">{t(language, 'linkLabel')}</div>
              <div className="font-semibold text-slate-900 mt-0.5">{listing.linkType}</div>
            </div>
            <div>
              <div className="text-slate-400">{t(language, 'serverLabel')}</div>
              <div className="font-semibold text-slate-900 mt-0.5">{listing.server}</div>
            </div>
            <div>
              <div className="text-slate-400">{t(language, 'paidLabel')}</div>
              <div className="font-semibold text-slate-900 mt-0.5 tabular-nums">
                {listing.paidCount}
              </div>
            </div>
            <div>
              <div className="text-slate-400">{t(language, 'limitLabel')}</div>
              <div className="font-semibold text-slate-900 mt-0.5 tabular-nums">
                {listing.limitInfo}
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onMessageSeller}
              className="flex-1 min-h-[46px] px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              <span>{t(language, 'messageSeller')}</span>
            </button>
            <button
              type="button"
              onClick={onToggleBookmark}
              aria-label="Toggle bookmark"
              className={`min-h-[46px] px-4 py-2.5 border rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors ${
                isBookmarked
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Bookmark className="w-4 h-4" />
              <span>{isBookmarked ? 'Saved' : 'Save'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Screen 09 Comments Thread */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900">
          {t(language, 'comments')} ({comments.length})
        </h2>

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={t(language, 'addComment')}
            aria-label={t(language, 'addComment')}
            className="flex-1 min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:bg-white"
          />
          <button
            type="submit"
            className="min-h-[44px] px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{t(language, 'send')}</span>
          </button>
        </form>

        <div className="space-y-3">
          {comments.length === 0 ? (
            <p className="text-xs text-slate-500">No comments yet. Ask the seller a question!</p>
          ) : (
            comments.map((cmt) => (
              <div key={cmt.id} className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                  {cmt.authorName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 bg-slate-100 rounded-xl p-3">
                  <div className="text-xs font-bold text-slate-900">{cmt.authorName}</div>
                  <div className="text-sm text-slate-700 mt-0.5">{cmt.text}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
