import React, { useState } from 'react';
import { Search as SearchIcon } from 'lucide-react';
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
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
        <label
          htmlFor="dealkoro-search-input"
          className="block text-sm font-bold text-slate-900 mb-2"
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
            className="w-full min-h-[46px] pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:bg-white"
          />
        </div>
      </div>

      {/* Screen 04: Direct matching listing results without filter clutter */}
      <div className="space-y-2.5">
        {results.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
            {language === 'bn'
              ? `"${queryText}" এর সাথে মিলে এমন কোনো অ্যাকাউন্ট পাওয়া যায়নি।`
              : `No listings matched "${queryText}".`}
          </div>
        ) : (
          results.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-700 font-bold text-sm flex items-center justify-center shrink-0">
                  {item.sellerName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 truncate">
                    {item.title}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {item.category} listing · {item.sellerName}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-bold text-blue-600 tabular-nums whitespace-nowrap">
                  {formatTk(item.price)}
                </span>
                <button
                  type="button"
                  onClick={() => onOpenListing(item.id)}
                  className="min-h-[40px] px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors whitespace-nowrap"
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
