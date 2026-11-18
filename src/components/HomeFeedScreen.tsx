import React, { useState } from 'react';
import {
  ArrowUpDown,
  Bookmark,
  ChevronRight,
  MessageCircle,
  ShieldCheck,
  Star,
} from 'lucide-react';
import type { Language, Listing, ListingCategory } from '../types/dealkoro';
import { t } from '../i18n/translations';
import { ASSETS } from '../data/seedData';
import { formatTk, sortListings, type ListingSortOption } from '../utils/dealMath';
import { ResilientImage } from './ResilientImage';

interface HomeFeedScreenProps {
  language: Language;
  listings: Listing[];
  bookmarks: string[];
  onToggleBookmark: (listingId: string) => void;
  onOpenListing: (listingId: string) => void;
  onMessageSeller: (listing: Listing) => void;
  onOpenCreatePost: () => void;
}

const CATEGORIES: ('All' | ListingCategory)[] = [
  'All',
  'eFootball',
  'PUBG Mobile',
  'Free Fire',
  'Mobile Legends',
];

export function HomeFeedScreen({
  language,
  listings,
  bookmarks,
  onToggleBookmark,
  onOpenListing,
  onMessageSeller,
  onOpenCreatePost,
}: HomeFeedScreenProps) {
  const [selectedCategory, setSelectedCategory] = useState<'All' | ListingCategory>('All');
  const [sortBy, setSortBy] = useState<ListingSortOption>('newest');
  const [showAll, setShowAll] = useState(false);

  const activeListings = listings.filter((item) => item.status !== 'sold');
  const filteredListings =
    selectedCategory === 'All'
      ? activeListings
      : activeListings.filter((item) => item.category === selectedCategory);

  const sortedListings = sortListings(filteredListings, sortBy);
  const visibleListings = showAll ? sortedListings : sortedListings.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Hero Promo Banner */}
      <section className="relative rounded-2xl overflow-hidden bg-slate-900 text-white border border-slate-800 min-h-[208px] sm:min-h-[236px] flex items-center shadow-sm">
        <ResilientImage
          src={ASSETS.promoBanner}
          alt="DEALKORO Verified Gaming Account Escrow Banner"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/92 via-slate-900/78 to-slate-900/25" />
        <div className="relative z-10 p-5 sm:p-8 flex flex-col justify-center max-w-xl">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-300 mb-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>DEALKORO Escrow Protection</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-snug">
            {language === 'bn'
              ? 'আপনার পছন্দের গেম অ্যাকাউন্ট নিরাপদে কেনাবেচা করুন'
              : 'Buy & Sell Gaming Accounts Safely with Admin Escrow'}
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-slate-200 leading-relaxed">
            {language === 'bn'
              ? 'বিকাশ ও নগদ সাপোর্ট · ভেরিফাইড অ্যাডমিন · লাইভ প্রাইস নেগোসিয়েশন'
              : 'Normal Deal 20/- · Ultimate Safe 60/- · bKash & Nagad Verified'}
          </p>
          <div className="mt-4">
            <button
              type="button"
              onClick={onOpenCreatePost}
              className="min-h-[42px] px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors whitespace-nowrap shadow-xs"
            >
              {language === 'bn' ? 'অ্যাকাউন্ট বিক্রি করুন' : 'Post Account for Sale'}
            </button>
          </div>
        </div>
      </section>

      {/* Interactive Category Segmented Filter + Sort */}
      <section aria-label="Game categories">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            {selectedCategory === 'All' ? 'eFootball & Featured Squads' : selectedCategory}
          </h2>

          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                aria-label="Sort listings"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as ListingSortOption)}
                className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="newest" className="dark:bg-slate-900">
                  {t(language, 'sortNewest')}
                </option>
                <option value="price_asc" className="dark:bg-slate-900">
                  {t(language, 'sortLowHigh')}
                </option>
                <option value="price_desc" className="dark:bg-slate-900">
                  {t(language, 'sortHighLow')}
                </option>
              </select>
            </label>

            {sortedListings.length > 6 && (
              <button
                type="button"
                onClick={() => setShowAll((prev) => !prev)}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 inline-flex items-center gap-1 whitespace-nowrap py-1"
              >
                <span>{showAll ? t(language, 'showLess') : t(language, 'seeMore')}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 mb-4">
          {CATEGORIES.map((category) => {
            const active = selectedCategory === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-slate-900 dark:bg-blue-600 text-white'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>

        {/* Product Card Grid */}
        {visibleListings.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {language === 'bn'
                ? 'এই ক্যাটাগরিতে এখনো কোনো পোস্ট নেই।'
                : 'No active listings in this category yet.'}
            </p>
            <button
              type="button"
              onClick={onOpenCreatePost}
              className="mt-3 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700"
            >
              {t(language, 'createPostTitle')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleListings.map((item) => {
              const isBookmarked = bookmarks.includes(item.id);
              return (
                <article
                  key={item.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className="relative aspect-[4/3] bg-slate-900 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => onOpenListing(item.id)}
                      className="w-full h-full block text-left"
                      aria-label={`View ${item.title}`}
                    >
                      <ResilientImage
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleBookmark(item.id)}
                      aria-label={
                        isBookmarked
                          ? `Remove ${item.title} from bookmarks`
                          : `Bookmark ${item.title}`
                      }
                      className={`absolute top-2.5 right-2.5 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md transition-colors ${
                        isBookmarked
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-900/60 text-white hover:bg-slate-900/80'
                      }`}
                    >
                      <Bookmark className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {item.category} · {item.linkType} · {item.server}
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenListing(item.id)}
                        className="mt-1 text-left text-base font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors line-clamp-1"
                      >
                        {item.title}
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => onMessageSeller(item)}
                        className="min-h-[40px] px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>{t(language, 'message')}</span>
                      </button>

                      <div className="text-right">
                        <div className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                          {t(language, 'price')}: {formatTk(item.price)}
                        </div>
                        <div
                          className="inline-flex items-center gap-0.5 text-amber-500 mt-0.5"
                          aria-label={`Rated ${item.rating} out of 5`}
                        >
                          {Array.from({ length: 5 }).map((_, idx) => (
                            <Star
                              key={idx}
                              className={`w-3 h-3 ${
                                idx < Math.round(item.rating)
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-slate-300 dark:text-slate-600'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
