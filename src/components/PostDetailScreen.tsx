import React, { useMemo, useState } from 'react';
import {
  Bookmark,
  CornerDownRight,
  Heart,
  MessageCircle,
  Send,
  Star,
  Trash2,
} from 'lucide-react';
import type { Language, Listing, ListingComment } from '../types/dealkoro';
import { t } from '../i18n/translations';
import { formatTk } from '../utils/dealMath';
import { ResilientImage } from './ResilientImage';

interface PostDetailScreenProps {
  language: Language;
  currentUserId: string;
  listing: Listing;
  comments: ListingComment[];
  isBookmarked: boolean;
  canDelete?: boolean;
  onToggleBookmark: () => void;
  onMessageSeller: () => void;
  onAddComment: (text: string) => void;
  onToggleCommentLike: (commentId: string) => void;
  onReplyComment: (
    parentCommentId: string,
    replyToAuthor: string,
    text: string
  ) => void;
  onDeleteComment?: (commentId: string) => void;
  onDeleteListing?: () => void;
}

function formatCommentTime(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  return new Date(ms).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PostDetailScreen({
  language,
  currentUserId,
  listing,
  comments,
  isBookmarked,
  canDelete = false,
  onToggleBookmark,
  onMessageSeller,
  onAddComment,
  onToggleCommentLike,
  onReplyComment,
  onDeleteComment,
  onDeleteListing,
}: PostDetailScreenProps) {
  const [commentText, setCommentText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{
    parentId: string;
    authorName: string;
  } | null>(null);
  const [replyText, setReplyText] = useState('');

  const { topLevelComments, repliesByParent } = useMemo(() => {
    const idSet = new Set(comments.map((c) => c.id));
    const top: ListingComment[] = [];
    const replyMap = new Map<string, ListingComment[]>();

    for (const cmt of comments) {
      if (cmt.parentCommentId && idSet.has(cmt.parentCommentId)) {
        const list = replyMap.get(cmt.parentCommentId) ?? [];
        list.push(cmt);
        replyMap.set(cmt.parentCommentId, list);
      } else {
        top.push(cmt);
      }
    }

    return { topLevelComments: top, repliesByParent: replyMap };
  }, [comments]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    onAddComment(commentText.trim());
    setCommentText('');
  };

  const handleReplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyingTo || !replyText.trim()) return;
    onReplyComment(replyingTo.parentId, replyingTo.authorName, replyText.trim());
    setReplyText('');
    setReplyingTo(null);
  };

  const renderCommentCard = (
    cmt: ListingComment,
    rootCommentId: string,
    isReply = false
  ) => {
    const likedBy = cmt.likedBy ?? [];
    const hasLiked = likedBy.includes(currentUserId);
    const canRemove = cmt.authorId === currentUserId || canDelete;

    return (
      <div key={cmt.id} className="flex items-start gap-2.5">
        <div
          className={`${
            isReply ? 'w-7 h-7 text-[11px]' : 'w-9 h-9 text-xs'
          } rounded-full bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center shrink-0`}
        >
          {cmt.authorName.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="bg-slate-100 dark:bg-slate-800 rounded-xl px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {cmt.authorName}
              </span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums shrink-0">
                {formatCommentTime(cmt.createdAt)}
              </span>
            </div>
            <div className="text-sm text-slate-700 dark:text-slate-300 mt-0.5 break-words">
              {cmt.replyToAuthor && (
                <span className="text-blue-600 dark:text-blue-400 font-semibold mr-1.5">
                  @{cmt.replyToAuthor}
                </span>
              )}
              {cmt.text}
            </div>
          </div>

          <div className="flex items-center gap-3 px-1 text-xs">
            <button
              type="button"
              onClick={() => onToggleCommentLike(cmt.id)}
              aria-pressed={hasLiked}
              className={`inline-flex items-center gap-1 font-semibold transition-colors py-0.5 ${
                hasLiked
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400'
              }`}
            >
              <Heart
                className={`w-3.5 h-3.5 ${hasLiked ? 'fill-current' : ''}`}
              />
              <span>{hasLiked ? t(language, 'liked') : t(language, 'like')}</span>
              {likedBy.length > 0 && (
                <span className="tabular-nums">({likedBy.length})</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setReplyingTo({
                  parentId: rootCommentId,
                  authorName: cmt.authorName,
                });
                setReplyText('');
              }}
              className="inline-flex items-center gap-1 font-semibold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors py-0.5"
            >
              <CornerDownRight className="w-3.5 h-3.5" />
              <span>{t(language, 'reply')}</span>
            </button>

            {canRemove && onDeleteComment && (
              <button
                type="button"
                onClick={() => onDeleteComment(cmt.id)}
                aria-label={`Delete comment by ${cmt.authorName}`}
                className="inline-flex items-center gap-1 font-semibold text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors py-0.5 ml-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
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

        <div className="space-y-4">
          {comments.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No comments yet. Ask the seller a question!
            </p>
          ) : (
            topLevelComments.map((cmt) => {
              const replies = repliesByParent.get(cmt.id) ?? [];
              const isReplyingHere = replyingTo?.parentId === cmt.id;
              return (
                <div key={cmt.id} className="space-y-2.5">
                  {renderCommentCard(cmt, cmt.id, false)}

                  {replies.length > 0 && (
                    <div className="ml-6 sm:ml-10 pl-3 border-l-2 border-slate-200 dark:border-slate-800 space-y-2.5">
                      {replies.map((rep) => renderCommentCard(rep, cmt.id, true))}
                    </div>
                  )}

                  {isReplyingHere && (
                    <form
                      onSubmit={handleReplySubmit}
                      className="ml-6 sm:ml-10 flex items-center gap-2"
                    >
                      <input
                        type="text"
                        autoFocus
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={`${t(language, 'writeReply')} (@${replyingTo.authorName})`}
                        aria-label={`Reply to ${replyingTo.authorName}`}
                        className="flex-1 min-h-[38px] px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                      />
                      <button
                        type="submit"
                        className="min-h-[38px] px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl whitespace-nowrap"
                      >
                        {t(language, 'reply')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingTo(null);
                          setReplyText('');
                        }}
                        className="min-h-[38px] px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold rounded-xl"
                      >
                        Cancel
                      </button>
                    </form>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

