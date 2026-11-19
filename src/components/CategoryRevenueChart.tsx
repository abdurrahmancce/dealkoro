import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, TrendingUp } from 'lucide-react';
import type {
  AdminDeal,
  Language,
  Listing,
  StatementEntry,
  ThemeMode,
} from '../types/dealkoro';
import {
  compute30DayAdminFeeTrend,
  computeCategoryFeeBreakdown,
  type CategoryFeeBreakdownItem,
} from '../utils/adminMetrics';
import { formatTk } from '../utils/dealMath';

interface CategoryRevenueChartProps {
  deals: AdminDeal[];
  listings: Listing[];
  statements: StatementEntry[];
  language: Language;
  theme: ThemeMode;
}

type ChartViewMode = 'category' | 'daily';

export function CategoryRevenueChart({
  deals,
  listings,
  statements,
  language,
  theme,
}: CategoryRevenueChartProps) {
  const [viewMode, setViewMode] = useState<ChartViewMode>('category');
  const isBn = language === 'bn';
  const isDark = theme === 'dark';

  const breakdown = useMemo(
    () =>
      computeCategoryFeeBreakdown({
        deals,
        listings,
        statements,
      }),
    [deals, listings, statements]
  );

  const dailyTrend = useMemo(
    () => compute30DayAdminFeeTrend(statements),
    [statements]
  );

  const totalReleased = breakdown.reduce((sum, item) => sum + item.releasedFee, 0);
  const totalPending = breakdown.reduce((sum, item) => sum + item.pendingFee, 0);
  const totalPipeline = totalReleased + totalPending;
  const topCategory = breakdown[0]?.totalFee ? breakdown[0] : null;
  const hasAnyRevenue = totalPipeline > 0 || breakdown.some((b) => b.dealCount > 0);

  const releasedColor = isDark ? '#34D399' : '#059669';
  const pendingColor = isDark ? '#60A5FA' : '#2563EB';
  const gridColor = isDark ? '#1E293B' : '#E2E8F0';
  const axisColor = isDark ? '#94A3B8' : '#64748B';

  return (
    <section
      aria-label="Escrow fee income breakdown by gaming category"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-5 transition-colors"
    >
      {/* Header row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {viewMode === 'category' ? (
              <BarChart3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            )}
            <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
              {isBn
                ? 'ক্যাটাগরি অনুযায়ী এস্ক্রো ফি আয়'
                : 'Escrow Fee Income by Category'}
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {viewMode === 'category'
              ? isBn
                ? 'প্রতিটি গেম ক্যাটাগরির অর্জিত ও চলমান এস্ক্রো ফি আয়ের তুলনা'
                : 'Released admin fee income and active escrow fee pipeline per game category'
              : isBn
              ? 'স্টেটমেন্ট ডাটা অনুযায়ী গত ৩০ দিনের দৈনিক এস্ক্রো ফি আয়'
              : 'Daily released escrow fee revenue from platform statements over the last 30 days'}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-4 sm:gap-6">
          <div className="flex items-center gap-5">
            <div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {isBn ? 'মোট ফি পাইপলাইন' : 'Total Fee Pipeline'}
              </div>
              <div className="text-base font-extrabold text-slate-900 dark:text-white tabular-nums">
                {formatTk(totalPipeline)}
              </div>
            </div>

            {topCategory && (
              <div>
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {isBn ? 'শীর্ষ ক্যাটাগরি' : 'Top Category'}
                </div>
                <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {topCategory.category} · {topCategory.sharePct.toFixed(0)}%
                </div>
              </div>
            )}
          </div>

          <div
            className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl"
            role="tablist"
            aria-label="Revenue chart mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'category'}
              onClick={() => setViewMode('category')}
              className={`min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors ${
                viewMode === 'category'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {isBn ? 'ক্যাটাগরি বিভাজন' : 'By Category'}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'daily'}
              onClick={() => setViewMode('daily')}
              className={`min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors ${
                viewMode === 'daily'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {isBn ? '৩০ দিনের ট্রেন্ড' : '30D Daily Trend'}
            </button>
          </div>
        </div>
      </div>

      {!hasAnyRevenue && viewMode === 'category' ? (
        <div className="h-48 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 px-4 text-center">
          {isBn
            ? 'এখনো কোনো এস্ক্রো ডিল বা ফি আয় রেকর্ড হয়নি। ডিল শুরু হলে ক্যাটাগরি অনুযায়ী আয় দেখা যাবে।'
            : 'No escrow deals or fee income recorded yet. Category fee trends appear automatically as deals run.'}
        </div>
      ) : viewMode === 'category' ? (
        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-5 items-start">
          {/* Bar Chart */}
          <div className="w-full h-64" data-testid="category-revenue-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={breakdown}
                margin={{ top: 10, right: 12, left: 0, bottom: 4 }}
                barCategoryGap="24%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="category"
                  tick={{ fill: axisColor, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  tickFormatter={(val: string) =>
                    val === 'Mobile Legends'
                      ? 'MLBB'
                      : val === 'PUBG Mobile'
                      ? 'PUBG'
                      : val
                  }
                />
                <YAxis
                  tick={{ fill: axisColor, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={50}
                  tickFormatter={(val: number) => `৳${val.toLocaleString('en-US')}`}
                />
                <Tooltip
                  cursor={{ fill: isDark ? 'rgba(30,41,59,0.55)' : 'rgba(241,245,249,0.75)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const item = payload[0].payload as CategoryFeeBreakdownItem;
                    return (
                      <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 shadow-lg text-xs space-y-1">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {item.category}
                        </div>
                        <div className="flex items-center justify-between gap-4 tabular-nums">
                          <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                            {isBn ? 'রিলিজড ফি:' : 'Released Fees:'}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {formatTk(item.releasedFee)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4 tabular-nums">
                          <span className="text-blue-700 dark:text-blue-400 font-medium">
                            {isBn ? 'চলমান ফি:' : 'Pending Escrow:'}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {formatTk(item.pendingFee)}
                          </span>
                        </div>
                        <div className="pt-1 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between gap-4 tabular-nums">
                          <span className="text-slate-500 dark:text-slate-400">
                            {item.dealCount} {isBn ? 'টি ডিল' : 'deal(s)'} · {item.sharePct.toFixed(1)}%
                          </span>
                          <span className="font-extrabold text-slate-900 dark:text-white">
                            {formatTk(item.totalFee)}
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend
                  verticalAlign="top"
                  height={28}
                  iconType="square"
                  wrapperStyle={{ fontSize: '12px', color: axisColor }}
                />
                <Bar
                  dataKey="releasedFee"
                  name={isBn ? 'রিলিজড ফি আয়' : 'Released Fee Income'}
                  stackId="fees"
                  fill={releasedColor}
                  radius={[0, 0, 4, 4]}
                />
                <Bar
                  dataKey="pendingFee"
                  name={isBn ? 'চলমান এস্ক্রো ফি' : 'Pending Escrow Fees'}
                  stackId="fees"
                  fill={pendingColor}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* High-density tabular breakdown */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-2 pr-3 font-semibold">
                    {isBn ? 'ক্যাটাগরি' : 'Category'}
                  </th>
                  <th className="py-2 px-2 font-semibold text-right">
                    {isBn ? 'ডিল' : 'Deals'}
                  </th>
                  <th className="py-2 px-2 font-semibold text-right">
                    {isBn ? 'রিলিজড' : 'Released'}
                  </th>
                  <th className="py-2 px-2 font-semibold text-right">
                    {isBn ? 'চলমান' : 'Pending'}
                  </th>
                  <th className="py-2 pl-2 font-semibold text-right">
                    {isBn ? 'মোট ও অংশ' : 'Total / Share'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {breakdown.map((row) => (
                  <tr
                    key={row.category}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-2.5 pr-3">
                      <div className="font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {row.category}
                      </div>
                      <div className="mt-1 w-24 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full"
                          style={{ width: `${Math.min(100, Math.max(row.totalFee > 0 ? 6 : 0, row.sharePct))}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {row.dealCount}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                      {formatTk(row.releasedFee)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums font-semibold text-blue-700 dark:text-blue-400">
                      {formatTk(row.pendingFee)}
                    </td>
                    <td className="py-2.5 pl-2 text-right font-mono tabular-nums">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {formatTk(row.totalFee)}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {row.sharePct.toFixed(1)}%
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="w-full h-64" data-testid="daily-revenue-trend-chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={dailyTrend}
              margin={{ top: 10, right: 12, left: 0, bottom: 4 }}
            >
              <defs>
                <linearGradient id="adminDailyFeeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={releasedColor} stopOpacity={isDark ? 0.3 : 0.22} />
                  <stop offset="95%" stopColor={releasedColor} stopOpacity={0} />
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
                width={50}
                tickFormatter={(val: number) => `৳${val.toLocaleString('en-US')}`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const pt = payload[0].payload as {
                    label: string;
                    releasedFee: number;
                    dealVolume: number;
                    entryCount: number;
                  };
                  return (
                    <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 shadow-lg text-xs">
                      <div className="font-semibold text-slate-500 dark:text-slate-400">
                        {pt.label}
                      </div>
                      <div className="font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5">
                        {isBn ? 'দৈনিক ফি আয়:' : 'Fee Income:'} {formatTk(pt.releasedFee)}
                      </div>
                      {pt.entryCount > 0 && (
                        <div className="text-[11px] text-slate-600 dark:text-slate-300 tabular-nums mt-0.5">
                          {pt.entryCount} {isBn ? 'টি সেটেলমেন্ট' : 'settlement(s)'} ·{' '}
                          {isBn ? 'ভলিউম' : 'Vol'} {formatTk(pt.dealVolume)}
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="releasedFee"
                stroke={releasedColor}
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#adminDailyFeeGradient)"
                activeDot={{ r: 5, fill: releasedColor, stroke: '#ffffff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
