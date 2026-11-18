import React, { useState } from 'react';
import { Bookmark, MessageCircle, Send, Star, Trash2 } from 'lucide-react';
import type { Language, Listing, ListingComment } from '../types/dealkoro';
import { t } from '../i18n/translations';
import { formatTk } from '../utils/dealMath';
import { ResilientImage } from './ResilientImage';

interface PostDetailScreenProps {
  language: Language;
  listing: Listing;
  comments: ListingComment[];
  isBookmarked: boolean;
  canDelete?: boolean;
  onToggleBookmark: () => void;
  onMessageSeller: () => void;
  onAddComment: (text: string) => void;
  onDeleteListing?: () => void;
}

export function PostDetailScreen({
  language,
  listing,
  comments,
  isBookmarked,
  canDelete = false,
  onToggleBookmark,
  onMessageSeller,
  onAddComment,
  onDeleteListing,
}: PostDetailScreenProps) {
  const [commentText, setCommentText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    onAddComment(commentText.trim());
    setCommentText('');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
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
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {listing.category} · {listing.sellerName}
              </div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                {listing.title}
              </h1>
            </div>
            <div className="text-xl font-extrabold text-blue-600 dark:text-blue-400 tabular-nums shrink-0">
              {formatTk(listing.price)}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
            <span>Rated:</span>
            <span className="inline-flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`w-3.5 h-3.5 ${
                    i < Math.round(listing.rating)
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-slate-300 dark:text-slate-600'
                  }`}
                />
              ))}
            </span>
            <span className="tabular-nums">({listing.rating.toFixed(1)})</span>
          </div>

          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            {listing.description}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div>
              <div className="text-slate-400 dark:text-slate-500">{t(language, 'linkLabel')}</div>
              <div className="font-semibold text-slate-900 dark:text-white mt-0.5">
                {listing.linkType}
              </div>
            </div>
            <div>
              <div className="text-slate-400 dark:text-slate-500">{t(language, 'serverLabel')}</div>
              <div className="font-semibold text-slate-900 dark:text-white mt-0.5">
                {listing.server}
              </div>
            </div>
            <div>
              <div className="text-slate-400 dark:text-slate-500">{t(language, 'paidLabel')}</div>
              <div className="font-semibold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                {listing.paidCount}
              </div>
            </div>
            <div>
              <div className="text-slate-400 dark:text-slate-500">{t(language, 'limitLabel')}</div>
              <div className="font-semibold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                {listing.limitInfo}
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3">
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
                  ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                  : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <Bookmark className="w-4 h-4" />
              <span>{isBookmarked ? 'Saved' : 'Save'}</span>
            </button>

            {canDelete && onDeleteListing && (
              confirmDelete ? (
                <div className="w-full sm:w-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onDeleteListing}
                    className="min-h-[46px] px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors"
                  >
                    Confirm Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="min-h-[46px] px-3 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="min-h-[46px] px-4 py-2.5 border border-red-200 dark:border-red-900/70 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-950/70 text-red-700 dark:text-red-300 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{t(language, 'deleteListing')}</span>
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Comments Thread */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          {t(language, 'comments')} ({comments.length})
        </h2>

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={t(language, 'addComment')}
            aria-label={t(language, 'addComment')}
            className="flex-1 min-h-[44px] px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:bg-white dark:focus:bg-slate-800"
          />
          <button
            type="submit"
            className="min-h-[44px] px-4 py-2 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{t(language, 'send')}</span>
          </button>
        </form>

        <div className="space-y-3">
          {comments.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No comments yet. Ask the seller a question!
            </p>
          ) : (
            comments.map((cmt) => (
              <div key={cmt.id} className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center justify-center shrink-0">
                  {cmt.authorName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-3">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {cmt.authorName}
                  </div>
                  <div className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">
                    {cmt.text}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
