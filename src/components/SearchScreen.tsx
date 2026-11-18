import React, { useState } from 'react';
import { Search as SearchIcon, X } from 'lucide-react';
import type { Language, Listing } from '../types/dealkoro';
import { t } from '../i18n/translations';
import { filterListingsByQuery, formatTk } from '../utils/dealMath';

interface SearchScreenProps {
  language: Language;
  listings: Listing[];
  onOpenListing: (listingId: string) => void;
}

export function SearchScreen({
  language,
  listings,
  onOpenListing,
}: SearchScreenProps) {
  const [queryText, setQueryText] = useState('');
  const results = filterListingsByQuery(listings, queryText);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
        <label
          htmlFor="dealkoro-search-input"
          className="block text-sm font-bold text-slate-900 dark:text-white mb-2"
        >
          {t(language, 'search')}
        </label>
        <div className="relative">
          <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="dealkoro-search-input"
            type="search"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder={t(language, 'searchPlaceholder')}
            autoFocus
            className="w-full min-h-[46px] pl-10 pr-10 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:bg-white dark:focus:bg-slate-800"
          />
          {queryText && (
            <button
              type="button"
              onClick={() => setQueryText('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700 flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2.5">
        {results.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            {language === 'bn'
              ? `"${queryText}" এর সাথে মিলে এমন কোনো অ্যাকাউন্ট পাওয়া যায়নি।`
              : `No listings matched "${queryText}".`}
          </div>
        ) : (
          results.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-bold text-sm flex items-center justify-center shrink-0">
                  {item.sellerName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {item.title}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {item.category} listing · {item.sellerName}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400 tabular-nums whitespace-nowrap">
                  {formatTk(item.price)}
                </span>
                <button
                  type="button"
                  onClick={() => onOpenListing(item.id)}
                  className="min-h-[40px] px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors whitespace-nowrap"
                >
                  View
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
