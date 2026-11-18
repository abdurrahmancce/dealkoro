import React, { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingDown, TrendingUp } from 'lucide-react';
import type { Language, Listing, ListingCategory, ThemeMode } from '../types/dealkoro';
import { build30DayPriceTrend } from '../utils/priceTrends';
import { formatTk } from '../utils/dealMath';

interface MarketPriceTrendChartProps {
  listings: Listing[];
  category: 'All' | ListingCategory;
  language: Language;
  theme: ThemeMode;
}

export function MarketPriceTrendChart({
  listings,
  category,
  language,
  theme,
}: MarketPriceTrendChartProps) {
  const isBn = language === 'bn';
  const isDark = theme === 'dark';

  const summary = useMemo(
    () => build30DayPriceTrend(listings, category),
    [listings, category]
  );

  const isPositive = summary.changePct >= 0;
  const strokeColor = isDark ? '#60A5FA' : '#2563EB';
  const gridColor = isDark ? '#1E293B' : '#E2E8F0';
  const axisColor = isDark ? '#94A3B8' : '#64748B';

  return (
    <section
      aria-label="30-day average gaming account price trend"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 transition-colors"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
            {isBn
              ? 'গত ৩০ দিনের গড় অ্যাকাউন্ট মূল্য ট্রেন্ড'
              : '30-Day Market Price Trend'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {category === 'All'
              ? isBn
                ? 'সব গেমের গড় বাজার দর ও মূল্য পরিবর্তন'
                : 'Average asking value across active gaming accounts'
              : `${category} · ${
                  isBn
                    ? 'ক্যাটাগরি অনুযায়ী ৩০ দিনের গড় মূল্য'
                    : '30-day average category valuation'
                }`}
          </p>
        </div>

        {summary.sampleCount > 0 && (
          <div className="flex flex-wrap items-center gap-5 sm:gap-6">
            <div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {isBn ? 'বর্তমান গড় দাম' : 'Current Avg'}
              </div>
              <div className="text-base font-extrabold text-slate-900 dark:text-white tabular-nums">
                {formatTk(summary.currentAvg)}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {isBn ? '৩০ দিনের পরিবর্তন' : '30D Change'}
              </div>
              <div
                className={`text-sm font-bold tabular-nums inline-flex items-center gap-1 ${
                  isPositive
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {isPositive ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                <span>
                  {isPositive ? '+' : ''}
                  {summary.changePct.toFixed(1)}%
                </span>
              </div>
            </div>

            <div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {isBn ? 'মূল্য সীমা' : 'Market Range'}
              </div>
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums mt-0.5">
                {formatTk(summary.minPrice)} – {formatTk(summary.maxPrice)}
              </div>
            </div>
          </div>
        )}
      </div>

      {summary.points.length === 0 ? (
        <div className="h-44 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 px-4 text-center">
          {isBn
            ? 'এই ক্যাটাগরিতে মূল্য ট্রেন্ড দেখাতে অন্তত একটি লিস্টিং প্রয়োজন।'
            : 'Post a listing in this category to unlock its 30-day average market chart.'}
        </div>
      ) : (
        <div className="w-full h-52" data-testid="market-price-trend-chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={summary.points}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="dealkoroTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={strokeColor} stopOpacity={isDark ? 0.28 : 0.2} />
                  <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: axisColor, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                minTickGap={28}
              />
              <YAxis
                tick={{ fill: axisColor, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={54}
                tickFormatter={(val: number) => `৳${val.toLocaleString('en-US')}`}
                domain={['dataMin - 150', 'dataMax + 150']}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const pt = payload[0].payload as {
                    label: string;
                    avgPrice: number;
                    listingCount: number;
                  };
                  return (
                    <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 shadow-lg text-xs">
                      <div className="font-semibold text-slate-500 dark:text-slate-400">
                        {pt.label}
                      </div>
                      <div className="font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                        {isBn ? 'গড় মূল্য:' : 'Avg Value:'} {formatTk(pt.avgPrice)}
                      </div>
                      {pt.listingCount > 0 && (
                        <div className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5 tabular-nums">
                          {pt.listingCount} {isBn ? 'টি নতুন পোস্ট' : 'listing(s) posted'}
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="avgPrice"
                stroke={strokeColor}
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#dealkoroTrendFill)"
                activeDot={{ r: 5, fill: strokeColor, stroke: '#ffffff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
