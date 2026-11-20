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
import { TrendingUp } from 'lucide-react';
import type { Language, StatementEntry, ThemeMode } from '../types/dealkoro';
import { t } from '../i18n/translations';
import {
  compute30DayRevenueAnalytics,
  type ThirtyDayRevenuePoint,
} from '../utils/adminMetrics';
import { formatTk } from '../utils/dealMath';

interface RevenueAnalyticsSectionProps {
  statements: StatementEntry[];
  language: Language;
  theme: ThemeMode;
}

type RevenueChartView = 'daily' | 'cumulative';

export function RevenueAnalyticsSection({
  statements,
  language,
  theme,
}: RevenueAnalyticsSectionProps) {
  const isBn = language === 'bn';
  const isDark = theme === 'dark';
  const [chartView, setChartView] = useState<RevenueChartView>('daily');
  const gradientId = useId().replace(/:/g, '');

  const { points, summary } = useMemo(
    () => compute30DayRevenueAnalytics(statements),
    [statements]
  );

  const strokeColor = isDark ? '#34D399' : '#059669';
  const gridColor = isDark ? '#1E293B' : '#E2E8F0';
  const axisColor = isDark ? '#94A3B8' : '#64748B';
  const avgLineColor = isDark ? '#64748B' : '#94A3B8';

  const activeDataKey = chartView === 'cumulative' ? 'cumulativeFee' : 'releasedFee';

  return (
    <section
      aria-label="Revenue Analytics"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-5 transition-colors"
    >
      {/* Header & View Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
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
                · {summary.startDate} → {summary.endDate}
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
            {isBn ? 'মোট ক্রমবর্ধমান' : 'Cumulative 30D'}
          </button>
        </div>
      </div>

      {/* 30-Day Summary Strip (Single-Elevation Hairline Grid) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="space-y-0.5">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {isBn ? '৩০ দিনের এস্ক্রো আয়' : '30-Day Escrow Earnings'}
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
            {isBn ? 'দৈনিক গড় আয়' : 'Daily Average (30D)'}
          </div>
          <div className="text-lg font-extrabold text-slate-900 dark:text-white tabular-nums">
            {formatTk(summary.dailyAverage)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {isBn ? 'প্রতিদিনের গড় হার' : 'Per day across 30 days'}
          </div>
        </div>

        <div className="space-y-0.5">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {isBn ? 'সক্রিয় আয়ের দিন' : 'Active Earning Days'}
          </div>
          <div className="text-lg font-extrabold text-slate-900 dark:text-white tabular-nums">
            {summary.activeDays} / {points.length || 30}
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
              ? 'এখনো কোনো আয় নেই'
              : 'No settlements yet'}
          </div>
        </div>
      </div>

      {/* Recharts 30-Day Daily Escrow Fee Visualization */}
      <div className="w-full h-64" data-testid="revenue-analytics-30d-chart">
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
                const pt = payload[0].payload as ThirtyDayRevenuePoint;
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
                        {isBn ? '৩০ দিনের মোট:' : '30D Cumulative:'}
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
              dot={false}
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
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
          {isBn
            ? 'গত ৩০ দিনে এখনো কোনো এস্ক্রো ফি সেটেল হয়নি। ডিল সম্পন্ন হয়ে পেআউট রিলিজ হওয়ার সাথে সাথে দৈনিক আয় এখানে যুক্ত হবে।'
            : 'No escrow fee settlements recorded in the last 30 days yet. Daily fee earnings appear automatically as escrow payouts are released.'}
        </div>
      )}
    </section>
  );
}
