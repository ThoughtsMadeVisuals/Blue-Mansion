import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { dowOf } from '../lib/aggregate';
import { DOWS, hourLabel, hourRange, rm } from '../lib/format';
import {
  METRIC_LABEL,
  METRIC_OPTIONS,
  fmtMetric,
  isAdditive,
  metricValue,
  type MetricKey,
  type ViewContext,
} from '../lib/metrics';
import { Card, ChartTooltip, Empty, Segmented } from './ui';

const KEYS: MetricKey[] = ['sales', 'tx', 'guests', 'avgTicket'];

export const HoursView: React.FC<{ ctx: ViewContext }> = ({ ctx }) => {
  const { report, colorOf } = ctx;
  const [metric, setMetric] = useState<MetricKey>('sales');
  const [per, setPer] = useState<'day' | 'total'>('day');
  const [heatMetric, setHeatMetric] = useState<'sales' | 'tx'>('sales');

  const days = report.daily.size;
  const dowDays = useMemo(() => {
    const c = Array(7).fill(0);
    for (const d of report.daily.keys()) c[dowOf(d)]++;
    return c;
  }, [report]);

  const divisor = per === 'day' && isAdditive(metric) && days ? days : 1;
  const active = report.hourly
    .map((b, h) => ({ b, h }))
    .filter(({ b }) => b.total.sales !== 0 || b.total.tx !== 0);
  const first = active.length ? active[0].h : 0;
  const last = active.length ? active[active.length - 1].h : 23;

  const data = useMemo(() => {
    const rows = [];
    for (let h = first; h <= last; h++) {
      const b = report.hourly[h];
      const row: Record<string, number | string> = { hour: hourLabel(h), Total: metricValue(b.total, metric) / divisor };
      for (const s of report.series) row[s] = metricValue(b.s[s], metric) / divisor;
      rows.push(row);
    }
    return rows;
  }, [report, metric, divisor, first, last]);

  const best = useMemo(() => {
    const out: { name: string; color: string; hour: number; sales: number; share: number; top3: number[] }[] = [];
    const keys = report.series.length > 1 ? ['__total', ...report.series] : ['__total'];
    for (const s of keys) {
      const vals = report.hourly.map((b) => (s === '__total' ? b.total.sales : (b.s[s]?.sales ?? 0)));
      const total = vals.reduce((a, b) => a + b, 0);
      if (!total) continue;
      const order = vals.map((v, h) => ({ v, h })).sort((a, b) => b.v - a.v);
      out.push({
        name: s === '__total' ? 'All selected' : s,
        color: s === '__total' ? '#0f172a' : colorOf(s),
        hour: order[0].h,
        sales: order[0].v,
        share: (order[0].v / total) * 100,
        top3: order.slice(0, 3).map((x) => x.h),
      });
    }
    return out;
  }, [report, colorOf]);

  const heat = useMemo(() => {
    let max = 0;
    const grid = report.dowHour.map((row, dow) =>
      row.map((c) => {
        const v = dowDays[dow] ? (heatMetric === 'sales' ? c.sales : c.tx) / dowDays[dow] : 0;
        if (v > max) max = v;
        return v;
      }),
    );
    return { grid, max };
  }, [report, dowDays, heatMetric]);

  if (!active.length) return <Empty>No data for the current filters.</Empty>;

  const fmt = (v: number) => fmtMetric(metric, v);
  const fmtC = (v: number) => fmtMetric(metric, v, true);
  const dowOrder = [1, 2, 3, 4, 5, 6, 0];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {best.map((b) => (
          <div key={b.name} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.color }} /> Best hour · {b.name}
            </div>
            <div className="mt-1.5 text-lg font-bold text-slate-900">{hourRange(b.hour)}</div>
            <div className="text-xs text-slate-500">
              {rm(b.sales / (days || 1), 0)} per day on average · {b.share.toFixed(1)}% of sales
            </div>
            <div className="mt-1 text-[11px] text-slate-400">Top 3: {b.top3.map(hourRange).join(', ')}</div>
          </div>
        ))}
      </div>

      <Card
        title={`${METRIC_LABEL[metric]} by hour${divisor > 1 ? ' (average per trading day)' : ''}`}
        subtitle={`Based on the time each receipt was opened · ${days} trading days`}
        actions={
          <>
            <Segmented value={metric} onChange={setMetric} options={METRIC_OPTIONS(KEYS)} />
            {isAdditive(metric) && (
              <Segmented
                value={per}
                onChange={setPer}
                options={[
                  { value: 'day', label: 'Avg per day' },
                  { value: 'total', label: 'Total' },
                ]}
              />
            )}
          </>
        }
      >
        <div className="h-80">
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={fmtC} tick={{ fontSize: 11 }} width={70} />
              <Tooltip cursor={{ fill: '#f1f5f9' }} content={(p) => <ChartTooltip {...(p as object)} valueFormatter={fmt} labelFormatter={(l) => hourRange(parseInt(String(l), 10))} />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {report.series.length > 1 && isAdditive(metric)
                ? report.series.map((s) => <Bar key={s} dataKey={s} name={s} stackId="h" fill={colorOf(s)} />)
                : report.series.length > 1
                  ? report.series.map((s) => <Bar key={s} dataKey={s} name={s} fill={colorOf(s)} radius={[3, 3, 0, 0]} />)
                  : <Bar dataKey="Total" name={report.series[0] ?? 'Total'} fill={colorOf(report.series[0] ?? '')} radius={[3, 3, 0, 0]} />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card
        title="Busiest times: day of week × hour"
        subtitle={`Average ${heatMetric === 'sales' ? 'sales' : 'transactions'} for each weekday and hour (darker = busier)`}
        actions={
          <Segmented
            value={heatMetric}
            onChange={setHeatMetric}
            options={[
              { value: 'sales', label: 'Sales' },
              { value: 'tx', label: 'Transactions' },
            ]}
          />
        }
      >
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-0.5 text-[10px]">
            <thead>
              <tr>
                <th />
                {Array.from({ length: last - first + 1 }, (_, i) => (
                  <th key={i} className="px-0.5 font-medium text-slate-500">{String(first + i).padStart(2, '0')}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dowOrder.map((dow) => (
                <tr key={dow}>
                  <td className="pr-2 font-medium text-slate-600">{DOWS[dow]}</td>
                  {Array.from({ length: last - first + 1 }, (_, i) => {
                    const h = first + i;
                    const v = heat.grid[dow][h];
                    const t = heat.max ? Math.max(0, v) / heat.max : 0;
                    return (
                      <td
                        key={h}
                        title={`${DOWS[dow]} ${hourRange(h)}: ${heatMetric === 'sales' ? rm(v, 0) : v.toFixed(1) + ' tickets'} on average`}
                        className="h-8 min-w-9 rounded text-center tabular-nums"
                        style={{
                          background: t ? `rgba(79, 70, 229, ${0.08 + t * 0.85})` : '#f8fafc',
                          color: t > 0.55 ? 'white' : '#334155',
                        }}
                      >
                        {v ? (heatMetric === 'sales' ? (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)) : v.toFixed(1)) : ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
