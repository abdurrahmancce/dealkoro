import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, Calendar, RotateCcw, TrendingUp } from 'lucide-react';
import type {
  AdminDeal,
  DateRangePreset,
  Language,
  Listing,
  StatementEntry,
  ThemeMode,
} from '../types/dealkoro';
import {
  computeCategoryFeeBreakdown,
  computeDailyAdminFeeTrend,
  createDateRangePreset,
  validateDateRange,
  type CategoryFeeBreakdownItem,
  type DailyRevenuePoint,
} from '../utils/adminMetrics';
import { formatTk } from '../utils/dealMath';

interface CategoryRevenueChartProps {
  deals: AdminDeal[];
  listings: Listing[];
  statements: StatementEntry[];
  language: Language;
  theme: ThemeMode;
}

const PRESETS: { id: Exclude<DateRangePreset, 'custom'>; labelEn: string; labelBn: string }[] = [
  { id: '7d', labelEn: '7D', labelBn: '৭ দিন' },
  { id: '30d', labelEn: '30D', labelBn: '৩০ দিন' },
  { id: '90d', labelEn: '90D', labelBn: '৯০ দিন' },
  { id: 'all', labelEn: 'All', labelBn: 'সর্বমোট' },
];

export function CategoryRevenueChart({
  deals,
  listings,
  statements,
  language,
  theme,
}: CategoryRevenueChartProps) {
  const isBn = language === 'bn';
  const isDark = theme === 'dark';

  const initial30d = useMemo(
    () => createDateRangePreset('30d', statements, deals),
    // Initialize once using default window; preset clicks recalculate cleanly
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [preset, setPreset] = useState<DateRangePreset>('30d');
  const [startDate, setStartDate] = useState<string>(initial30d.startDate);
  const [endDate, setEndDate] = useState<string>(initial30d.endDate);

  const rangeCheck = useMemo(
    () => validateDateRange(startDate, endDate),
    [startDate, endDate]
  );

  const activeStart = rangeCheck.valid ? rangeCheck.startDate : initial30d.startDate;
  const activeEnd = rangeCheck.valid ? rangeCheck.endDate : initial30d.endDate;

  const handleSelectPreset = (nextPreset: Exclude<DateRangePreset, 'custom'>) => {
    const computed = createDateRangePreset(nextPreset, statements, deals);
    setPreset(nextPreset);
    setStartDate(computed.startDate);
    setEndDate(computed.endDate);
  };

  const breakdown = useMemo(
    () =>
      computeCategoryFeeBreakdown({
        deals,
        listings,
        statements,
        startDate: activeStart,
        endDate: activeEnd,
      }),
    [deals, listings, statements, activeStart, activeEnd]
  );

  const dailyTrend = useMemo(
    () =>
      computeDailyAdminFeeTrend(statements, {
        startDate: activeStart,
        endDate: activeEnd,
      }),
    [statements, activeStart, activeEnd]
  );

  const totalReleased = breakdown.reduce((sum, item) => sum + item.releasedFee, 0);
  const totalPending = breakdown.reduce((sum, item) => sum + item.pendingFee, 0);
  const totalPipeline = totalReleased + totalPending;
  const topCategory = breakdown[0]?.totalFee ? breakdown[0] : null;
  const dailyTotal = dailyTrend.reduce((sum, pt) => sum + pt.releasedFee, 0);
  const activeDayCount = dailyTrend.filter((pt) => pt.entryCount > 0).length;
  const hasAnyInRange =
    totalPipeline > 0 ||
    dailyTotal > 0 ||
    breakdown.some((b) => b.dealCount > 0);

  const releasedColor = isDark ? '#34D399' : '#059669';
  const pendingColor = isDark ? '#60A5FA' : '#2563EB';
  const gridColor = isDark ? '#1E293B' : '#E2E8F0';
  const axisColor = isDark ? '#94A3B8' : '#64748B';

  return (
    <section
      aria-label="Escrow revenue analytics and category fee breakdown"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-5 transition-colors"
    >
      {/* Header & Unified Date Range Picker */}
      <div className="flex flex-col gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                {isBn
                  ? 'এস্ক্রো ফি আয় বিশ্লেষণ ও দৈনিক ট্রেন্ড'
                  : 'Escrow Fee Income & Revenue Analytics'}
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isBn
                ? 'নির্বাচিত সময়সীমার মধ্যে দৈনিক স্টেটমেন্ট আয় এবং গেম ক্যাটাগরি অনুযায়ী ফি বিভাজন'
                : 'Unified date filter driving both the daily statement revenue line chart and category fee breakdown'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {isBn ? 'ফি পাইপলাইন (রেঞ্জ)' : 'Fee Pipeline (Range)'}
              </div>
              <div className="text-base font-extrabold text-slate-900 dark:text-white tabular-nums">
                {formatTk(totalPipeline)}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {isBn ? 'রিলিজড আয়' : 'Released Income'}
              </div>
              <div className="text-base font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {formatTk(dailyTotal)}
              </div>
            </div>

            {topCategory && (
              <div>
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {isBn ? 'শীর্ষ ক্যাটাগরি' : 'Top Category'}
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                  {topCategory.category} · {topCategory.sharePct.toFixed(0)}%
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Unified Date Range Picker Toolbar */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl"
              role="group"
              aria-label="Date range presets"
            >
              {PRESETS.map((p) => {
                const active = preset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPreset(p.id)}
                    aria-pressed={active}
                    className={`min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors ${
                      active
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {isBn ? p.labelBn : p.labelEn}
                  </button>
                );
              })}
            </div>

            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
              {activeStart} → {activeEnd} ({dailyTrend.length}d)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="font-semibold">{isBn ? 'শুরু:' : 'From'}</span>
              <input
                type="date"
                aria-label="Analytics start date"
                value={startDate}
                onChange={(e) => {
                  setPreset('custom');
                  setStartDate(e.target.value);
                }}
                className="min-h-[38px] px-2.5 py-1 text-xs font-mono tabular-nums bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
              />
            </label>

            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
              <span className="font-semibold">{isBn ? 'শেষ:' : 'To'}</span>
              <input
                type="date"
                aria-label="Analytics end date"
                value={endDate}
                onChange={(e) => {
                  setPreset('custom');
                  setEndDate(e.target.value);
                }}
                className="min-h-[38px] px-2.5 py-1 text-xs font-mono tabular-nums bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
              />
            </label>

            {preset !== '30d' && (
              <button
                type="button"
                onClick={() => handleSelectPreset('30d')}
                className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isBn ? 'রিসেট (৩০ দিন)' : 'Reset 30D'}</span>
              </button>
            )}
          </div>
        </div>

        {!rangeCheck.valid && rangeCheck.error && (
          <div
            role="alert"
            className="px-3 py-2 text-xs font-medium text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl"
          >
            {rangeCheck.error} Showing last valid 30D window until corrected.
          </div>
        )}
      </div>

      {!hasAnyInRange ? (
        <div className="h-52 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-3 text-xs text-slate-500 dark:text-slate-400 px-4 text-center">
          <span>
            {isBn
              ? `নির্বাচিত তারিখ (${activeStart} থেকে ${activeEnd}) এর মধ্যে কোনো এস্ক্রো ডিল বা ফি আয় পাওয়া যায়নি।`
              : `No escrow deals or fee income recorded between ${activeStart} and ${activeEnd}.`}
          </span>
          <button
            type="button"
            onClick={() => handleSelectPreset('all')}
            className="min-h-[38px] px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors"
          >
            {isBn ? 'সর্বমোট ডাটা দেখুন' : 'View All Time Data'}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Two Synchronized Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Panel 1: Daily Revenue Line Chart */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    {isBn ? 'দৈনিক এস্ক্রো ফি ট্রেন্ড' : 'Daily Revenue Trend'}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                  {activeDayCount} {isBn ? 'টি সক্রিয় দিন' : 'active day(s)'} · {formatTk(dailyTotal)}
                </span>
              </div>

              <div className="w-full h-60" data-testid="daily-revenue-trend-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={dailyTrend}
                    margin={{ top: 10, right: 12, left: 0, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: axisColor, fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={24}
                    />
                    <YAxis
                      tick={{ fill: axisColor, fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={52}
                      tickFormatter={(val: number) => `৳${val.toLocaleString('en-US')}`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || payload.length === 0) return null;
                        const pt = payload[0].payload as DailyRevenuePoint;
                        return (
                          <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 shadow-lg text-xs">
                            <div className="font-semibold text-slate-500 dark:text-slate-400">
                              {pt.label} · {pt.dateKey}
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
                    <Line
                      type="monotone"
                      dataKey="releasedFee"
                      name={isBn ? 'দৈনিক ফি আয়' : 'Daily Fee Income'}
                      stroke={releasedColor}
                      strokeWidth={2.5}
                      dot={dailyTrend.length <= 14 ? { r: 3, fill: releasedColor } : false}
                      activeDot={{ r: 5, fill: releasedColor, stroke: '#ffffff', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Panel 2: Category Escrow Fee Breakdown Bar Chart */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <BarChart3 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>
                    {isBn ? 'ক্যাটাগরি অনুযায়ী এস্ক্রো ফি' : 'Escrow Fee Income by Category'}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                  {isBn ? 'চলমান:' : 'Pending:'} {formatTk(totalPending)}
                </span>
              </div>

              <div className="w-full h-60" data-testid="category-revenue-chart">
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
                      width={52}
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
                      height={26}
                      iconType="square"
                      wrapperStyle={{ fontSize: '11px', color: axisColor }}
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
            </div>
          </div>

          {/* High-density tabular breakdown */}
          <div className="overflow-x-auto border-t border-slate-100 dark:border-slate-800 pt-3">
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
                          style={{
                            width: `${Math.min(100, Math.max(row.totalFee > 0 ? 6 : 0, row.sharePct))}%`,
                          }}
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
      )}
    </section>
  );
}
