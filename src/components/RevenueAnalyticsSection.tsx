import React, { useId, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Calendar, RotateCcw, TrendingUp } from 'lucide-react';
import type {
  AdminDeal,
  DateRangePreset,
  Language,
  StatementEntry,
  ThemeMode,
} from '../types/dealkoro';
import { t } from '../i18n/translations';
import {
  computeRevenueAnalytics,
  createDateRangePreset,
  validateDateRange,
  type RevenueAnalyticsPoint,
} from '../utils/adminMetrics';
import { formatTk } from '../utils/dealMath';

interface RevenueAnalyticsSectionProps {
  statements: StatementEntry[];
  deals?: AdminDeal[];
  language: Language;
  theme: ThemeMode;
}

type RevenueChartView = 'daily' | 'cumulative';

const RANGE_PRESETS: {
  id: Exclude<DateRangePreset, 'custom'>;
  labelEn: string;
  labelBn: string;
}[] = [
  { id: '7d', labelEn: '7D', labelBn: '৭ দিন' },
  { id: '30d', labelEn: '30D', labelBn: '৩০ দিন' },
  { id: '90d', labelEn: '90D', labelBn: '৯০ দিন' },
  { id: 'all', labelEn: 'All', labelBn: 'সর্বমোট' },
];

export function RevenueAnalyticsSection({
  statements,
  deals = [],
  language,
  theme,
}: RevenueAnalyticsSectionProps) {
  const isBn = language === 'bn';
  const isDark = theme === 'dark';
  const [chartView, setChartView] = useState<RevenueChartView>('daily');
  const gradientId = useId().replace(/:/g, '');

  const initial30d = useMemo(
    () => createDateRangePreset('30d', statements, deals),
    // Initialize default 30-day UTC window once; preset buttons recalculate on demand
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

  const { points, summary } = useMemo(
    () =>
      computeRevenueAnalytics(statements, {
        startDate: activeStart,
        endDate: activeEnd,
      }),
    [statements, activeStart, activeEnd]
  );

  const strokeColor = isDark ? '#34D399' : '#059669';
  const gridColor = isDark ? '#1E293B' : '#E2E8F0';
  const axisColor = isDark ? '#94A3B8' : '#64748B';
  const avgLineColor = isDark ? '#64748B' : '#94A3B8';

  const activeDataKey = chartView === 'cumulative' ? 'cumulativeFee' : 'releasedFee';
  const periodDays = summary.dayCount;

  return (
    <section
      aria-label="Revenue Analytics"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-5 transition-colors"
    >
      {/* Header, Chart View Switcher & Date-Range Picker */}
      <div className="flex flex-col gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                {t(language, 'revenueAnalytics')}
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t(language, 'revenueAnalyticsSubtitle')}
              {summary.startDate && summary.endDate ? (
                <span className="font-mono tabular-nums">
                  {' '}
                  · {summary.startDate} → {summary.endDate} ({periodDays}d)
                </span>
              ) : null}
            </p>
          </div>

          <div
            className="inline-flex items-center self-start md:self-auto p-1 bg-slate-100 dark:bg-slate-800 rounded-xl"
            role="group"
            aria-label="Revenue chart display mode"
          >
            <button
              type="button"
              onClick={() => setChartView('daily')}
              aria-pressed={chartView === 'daily'}
              className={`min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors ${
                chartView === 'daily'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {isBn ? 'দৈনিক আয়' : 'Daily Earnings'}
            </button>
            <button
              type="button"
              onClick={() => setChartView('cumulative')}
              aria-pressed={chartView === 'cumulative'}
              className={`min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors ${
                chartView === 'cumulative'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {isBn ? `ক্রমবর্ধমান (${periodDays} দিন)` : `Cumulative ${periodDays}D`}
            </button>
          </div>
        </div>

        {/* Flexible Date-Range Picker Toolbar */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl"
              role="group"
              aria-label="Revenue analytics date range presets"
            >
              {RANGE_PRESETS.map((p) => {
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
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="font-semibold">{isBn ? 'শুরু:' : 'From'}</span>
              <input
                type="date"
                aria-label="Revenue analytics start date"
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
                aria-label="Revenue analytics end date"
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
            {rangeCheck.error} Showing default 30D window until corrected.
          </div>
        )}
      </div>

      {/* Period Summary Strip (Single-Elevation Hairline Grid) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="space-y-0.5">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {isBn ? `${periodDays} দিনের এস্ক্রো আয়` : `${periodDays}-Day Escrow Earnings`}
          </div>
          <div className="text-lg font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {formatTk(summary.totalFeeIncome)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {summary.totalSettlements}{' '}
            {isBn ? 'টি সেটেলড ডিল' : 'settled deal(s)'}
          </div>
        </div>

        <div className="space-y-0.5">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {isBn ? `দৈনিক গড় আয় (${periodDays} দিন)` : `Daily Average (${periodDays}D)`}
          </div>
          <div className="text-lg font-extrabold text-slate-900 dark:text-white tabular-nums">
            {formatTk(summary.dailyAverage)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {isBn
              ? `${periodDays} দিনের গড় হার`
              : `Per day across ${periodDays} day${periodDays === 1 ? '' : 's'}`}
          </div>
        </div>

        <div className="space-y-0.5">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {isBn ? 'সক্রিয় আয়ের দিন' : 'Active Earning Days'}
          </div>
          <div className="text-lg font-extrabold text-slate-900 dark:text-white tabular-nums">
            {summary.activeDays} / {periodDays}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {isBn ? 'ফি সংগ্রহ হয়েছে' : 'Days with fee income'}
          </div>
        </div>

        <div className="space-y-0.5">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {isBn ? 'সর্বোচ্চ আয়ের দিন' : 'Peak Earning Day'}
          </div>
          <div className="text-lg font-extrabold text-slate-900 dark:text-white tabular-nums">
            {summary.peakDay ? formatTk(summary.peakDay.releasedFee) : 'Tk 0'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {summary.peakDay
              ? `${summary.peakDay.label} · ${summary.peakDay.entryCount} ${
                  isBn ? 'ডিল' : 'deal(s)'
                }`
              : isBn
              ? 'এই সময়সীমায় আয় নেই'
              : 'No settlements in range'}
          </div>
        </div>
      </div>

      {/* Recharts Daily / Cumulative Escrow Fee Visualization */}
      <div className="w-full h-64" data-testid="revenue-analytics-chart">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={points}
            margin={{ top: 12, right: 12, left: 0, bottom: 4 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={strokeColor} stopOpacity={0.28} />
                <stop offset="95%" stopColor={strokeColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: axisColor, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              minTickGap={22}
            />
            <YAxis
              tick={{ fill: axisColor, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={56}
              allowDecimals={false}
              tickFormatter={(val: number) => `৳${val.toLocaleString('en-US')}`}
            />
            {chartView === 'daily' && summary.dailyAverage > 0 && (
              <ReferenceLine
                y={summary.dailyAverage}
                stroke={avgLineColor}
                strokeDasharray="4 4"
                label={{
                  value: isBn
                    ? `গড় ${formatTk(summary.dailyAverage)}`
                    : `Avg ${formatTk(summary.dailyAverage)}`,
                  position: 'insideTopRight',
                  fill: axisColor,
                  fontSize: 11,
                }}
              />
            )}
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const pt = payload[0].payload as RevenueAnalyticsPoint;
                return (
                  <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 shadow-lg text-xs space-y-1">
                    <div className="font-semibold text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      {pt.label} · {pt.dateKey}
                    </div>
                    <div className="flex items-center justify-between gap-4 tabular-nums">
                      <span className="text-slate-600 dark:text-slate-300">
                        {isBn ? 'দৈনিক এস্ক্রো ফি:' : 'Daily Escrow Fee:'}
                      </span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">
                        {formatTk(pt.releasedFee)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4 tabular-nums">
                      <span className="text-slate-600 dark:text-slate-300">
                        {isBn
                          ? `${periodDays} দিনের মোট:`
                          : `${periodDays}D Cumulative:`}
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {formatTk(pt.cumulativeFee)}
                      </span>
                    </div>
                    {pt.entryCount > 0 && (
                      <div className="pt-1 border-t border-slate-100 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                        {pt.entryCount}{' '}
                        {isBn ? 'টি সেটেলমেন্ট' : 'settlement(s)'} ·{' '}
                        {isBn ? 'ডিল ভলিউম' : 'Deal Vol'}{' '}
                        {formatTk(pt.dealVolume)}
                      </div>
                    )}
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey={activeDataKey}
              name={
                chartView === 'cumulative'
                  ? isBn
                    ? 'মোট ক্রমবর্ধমান ফি'
                    : 'Cumulative Escrow Fees'
                  : isBn
                  ? 'দৈনিক এস্ক্রো ফি'
                  : 'Daily Escrow Fees'
              }
              stroke={strokeColor}
              strokeWidth={2.5}
              fill={`url(#${gradientId})`}
              dot={points.length <= 14 ? { r: 3, fill: strokeColor } : false}
              activeDot={{
                r: 5,
                fill: strokeColor,
                stroke: isDark ? '#0F172A' : '#FFFFFF',
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {summary.totalFeeIncome === 0 && (
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>
            {isBn
              ? `${activeStart} থেকে ${activeEnd} সময়সীমায় কোনো এস্ক্রো ফি সেটেলমেন্ট পাওয়া যায়নি।`
              : `No escrow fee settlements recorded between ${activeStart} and ${activeEnd}.`}
          </span>
          {preset !== 'all' && (
            <button
              type="button"
              onClick={() => handleSelectPreset('all')}
              className="self-start sm:self-auto px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold rounded-lg whitespace-nowrap transition-colors"
            >
              {isBn ? 'সর্বমোট ডাটা দেখুন' : 'View All Time'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
