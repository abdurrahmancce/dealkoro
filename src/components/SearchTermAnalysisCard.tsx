import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Search } from 'lucide-react';
import type { Language, Listing, SearchTermStat, ThemeMode } from '../types/dealkoro';
import { t } from '../i18n/translations';
import { filterListingsByQuery } from '../utils/dealMath';

interface SearchTermAnalysisCardProps {
  searchTerms: SearchTermStat[];
  listings: Listing[];
  language: Language;
  theme: ThemeMode;
  filterQuery?: string;
}

function formatShortDate(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '—';
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function SearchTermAnalysisCard({
  searchTerms,
  listings,
  language,
  theme,
  filterQuery = '',
}: SearchTermAnalysisCardProps) {
  const isBn = language === 'bn';
  const isDark = theme === 'dark';

  const normalizedFilter = filterQuery.trim().toLowerCase();
  const filteredTerms = useMemo(() => {
    const base = normalizedFilter
      ? searchTerms.filter(
          (item) =>
            item.term.toLowerCase().includes(normalizedFilter) ||
            (item.lastCategory ?? 'All').toLowerCase().includes(normalizedFilter)
        )
      : searchTerms;
    return [...base].sort((a, b) => b.searchCount - a.searchCount);
  }, [searchTerms, normalizedFilter]);

  const totalSearches = useMemo(
    () => filteredTerms.reduce((sum, item) => sum + item.searchCount, 0),
    [filteredTerms]
  );

  const enrichedTerms = useMemo(
    () =>
      filteredTerms.slice(0, 12).map((item, idx) => {
        const liveMatches = filterListingsByQuery(
          listings.filter((l) => l.status !== 'sold'),
          item.term
        ).length;
        return {
          ...item,
          rank: idx + 1,
          shortLabel:
            item.term.length > 16 ? `${item.term.slice(0, 15)}…` : item.term,
          liveMatches,
        };
      }),
    [filteredTerms, listings]
  );

  const chartData = enrichedTerms.slice(0, 8);
  const barColor = isDark ? '#60A5FA' : '#2563EB';
  const gridColor = isDark ? '#1E293B' : '#E2E8F0';
  const axisColor = isDark ? '#94A3B8' : '#64748B';

  return (
    <section
      aria-label="Search term analysis"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-5 transition-colors"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
              {t(language, 'searchTermAnalysis')}
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t(language, 'topSearchedAccounts')}
          </p>
        </div>

        <div className="flex items-center gap-5 shrink-0">
          <div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {isBn ? 'মোট টার্ম' : 'Tracked Terms'}
            </div>
            <div className="text-base font-extrabold text-slate-900 dark:text-white tabular-nums">
              {filteredTerms.length}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {isBn ? 'মোট সার্চ' : 'Total Searches'}
            </div>
            <div className="text-base font-extrabold text-blue-600 dark:text-blue-400 tabular-nums">
              {totalSearches}
            </div>
          </div>
        </div>
      </div>

      {enrichedTerms.length === 0 ? (
        <div className="h-40 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 px-4 text-center">
          {t(language, 'noSearchTermsYet')}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          <div className="w-full h-60" data-testid="search-term-analysis-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={gridColor}
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fill: axisColor, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="shortLabel"
                  width={112}
                  tick={{ fill: axisColor, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{
                    fill: isDark
                      ? 'rgba(30,41,59,0.55)'
                      : 'rgba(241,245,249,0.75)',
                  }}
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const item = payload[0].payload as SearchTermStat & {
                      liveMatches: number;
                    };
                    return (
                      <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2 shadow-lg text-xs space-y-1">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {item.term}
                        </div>
                        <div className="text-blue-600 dark:text-blue-400 font-semibold tabular-nums">
                          {isBn ? 'সার্চ সংখ্যা:' : 'Searches:'} {item.searchCount}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                          {item.lastCategory ?? 'All'} · {item.liveMatches}{' '}
                          {isBn ? 'টি মিল পাওয়া গেছে' : 'active match(es)'}
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="searchCount"
                  name={isBn ? 'সার্চ সংখ্যা' : 'Search Volume'}
                  fill={barColor}
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-2 pr-2 font-semibold">#</th>
                  <th className="py-2 px-2 font-semibold">
                    {isBn ? 'সার্চ করা টাইটেল' : 'Account Title Query'}
                  </th>
                  <th className="py-2 px-2 font-semibold">
                    {isBn ? 'ক্যাটাগরি' : 'Category'}
                  </th>
                  <th className="py-2 px-2 font-semibold text-right">
                    {isBn ? 'ম্যাচ' : 'Matches'}
                  </th>
                  <th className="py-2 px-2 font-semibold text-right">
                    {isBn ? 'সার্চ' : 'Count'}
                  </th>
                  <th className="py-2 pl-2 font-semibold text-right">
                    {isBn ? 'সর্বশেষ' : 'Last'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {enrichedTerms.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-2 pr-2 font-mono tabular-nums text-slate-400">
                      {item.rank}
                    </td>
                    <td className="py-2 px-2 font-semibold text-slate-900 dark:text-white max-w-[160px] truncate">
                      {item.term}
                    </td>
                    <td className="py-2 px-2 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {item.lastCategory ?? 'All'}
                    </td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {item.liveMatches}
                    </td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums font-bold text-blue-600 dark:text-blue-400">
                      {item.searchCount}
                    </td>
                    <td className="py-2 pl-2 text-right tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatShortDate(item.lastSearchedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
