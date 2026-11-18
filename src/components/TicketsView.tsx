import React, { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Brush, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { addDays, avgTicket, dowOf, emptyMetrics, spendPerGuest, type Bucket, type Metrics } from '../lib/aggregate';
import { downloadCsv, int, longDate, monthLabel, rm, shortDate } from '../lib/format';
import {
  METRIC_LABEL,
  METRIC_OPTIONS,
  fmtMetric,
  metricValue,
  type MetricKey,
  type ViewContext,
} from '../lib/metrics';
import type { Holiday } from '../types';
import { GuestWarning } from './GuestWarning';
import { Badge, Card, ChartTooltip, Empty, Segmented, SmallButton, Table, Td, Th } from './ui';

const KEYS: MetricKey[] = ['tx', 'avgTicket', 'guests', 'spg', 'sales'];
type Grain = 'day' | 'week' | 'month';

function addInto(a: Metrics, b: Metrics | undefined) {
  if (!b) return;
  a.sales += b.sales;
  a.qty += b.qty;
  a.tx += b.tx;
  a.guests += b.guests;
  a.guestSales += b.guestSales;
}

export const TicketsView: React.FC<{ ctx: ViewContext; holidays: Holiday[]; onPickDate: (d: string) => void }> = ({
  ctx,
  holidays,
  onPickDate,
}) => {
  const { report, colorOf } = ctx;
  const [metric, setMetric] = useState<MetricKey>('tx');
  const [grain, setGrain] = useState<Grain>('day');
  const holidayMap = useMemo(() => new Map(holidays.map((h) => [h.date, h.name])), [holidays]);

  const periods = useMemo(() => {
    const keyOf = (d: string) =>
      grain === 'day' ? d : grain === 'month' ? d.slice(0, 7) : addDays(d, -((dowOf(d) + 6) % 7));
    const map = new Map<string, Bucket & { days: number }>();
    for (const [d, b] of report.daily) {
      const k = keyOf(d);
      let p = map.get(k);
      if (!p) {
        p = { total: emptyMetrics(), s: {}, days: 0 };
        map.set(k, p);
      }
      p.days++;
      addInto(p.total, b.total);
      for (const s of report.series) if (b.s[s]) addInto((p.s[s] ??= emptyMetrics()), b.s[s]);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [report, grain]);

  const label = (k: string) => (grain === 'month' ? monthLabel(k) : grain === 'week' ? `Week of ${shortDate(k)}` : longDate(k));
  const data = periods.map(([k, p]) => {
    const r: Record<string, string | number | null> = { k, Total: metricValue(p.total, metric) };
    for (const s of report.series) r[s] = p.s[s] ? metricValue(p.s[s], metric) : null;
    return r;
  });


  if (!periods.length) return <Empty>No data for the current filters.</Empty>;

  const fmt = (v: number) => fmtMetric(metric, v);
  const fmtC = (v: number) => fmtMetric(metric, v, true);

  const exportCsv = () =>
    downloadCsv(`tickets-${grain}.csv`, [
      ['Period', ...report.series.flatMap((s) => [`${s} tickets`, `${s} avg ticket`, `${s} guests`, `${s} sales`]), 'Total tickets', 'Total avg ticket', 'Total guests', 'Total sales'],
      ...periods.map(([k, p]) => [
        k,
        ...report.series.flatMap((s) => [p.s[s]?.tx ?? 0, p.s[s] ? avgTicket(p.s[s]) : 0, p.s[s]?.guests ?? 0, p.s[s]?.sales ?? 0]),
        p.total.tx,
        avgTicket(p.total),
        p.total.guests,
        p.total.sales,
      ]),
    ]);

  const cardSeries = report.series.length > 1 ? [...report.series, '__all'] : ['__all'];

  return (
    <div className="space-y-5">
      <GuestWarning ctx={ctx} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cardSeries.map((s) => {
          const m = s === '__all' ? report.kpi.total : report.kpi.s[s];
          // Average over the days this outlet actually traded
          const days = Math.max(1, s === '__all' ? report.days.total : (report.days.s[s] ?? 0));
          return (
            <div key={s} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: s === '__all' ? '#0f172a' : colorOf(s) }} />
                {s === '__all' ? 'All selected' : s}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-y-1.5 text-xs">
                <span className="text-slate-500">Tickets / day</span>
                <span className="text-right font-semibold tabular-nums">{(m.tx / days).toFixed(1)}</span>
                <span className="text-slate-500">Avg ticket</span>
                <span className="text-right font-semibold tabular-nums">{rm(avgTicket(m))}</span>
                <span className="text-slate-500">Guests / day</span>
                <span className="text-right font-semibold tabular-nums">{(m.guests / days).toFixed(1)}</span>
                <span className="text-slate-500">Spend / guest</span>
                <span className="text-right font-semibold tabular-nums">{m.guests ? rm(spendPerGuest(m)) : '—'}</span>
                <span className="text-slate-500">Trading days</span>
                <span className="text-right tabular-nums">{int(days)}</span>
                <span className="text-slate-500">Total tickets</span>
                <span className="text-right tabular-nums">{int(m.tx)}</span>
                <span className="text-slate-500">Total guests</span>
                <span className="text-right tabular-nums">{int(m.guests)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <Card
        title={`${METRIC_LABEL[metric]} per ${grain}: all outlets compared`}
        subtitle="Tickets = receipts (refunds excluded). Avg ticket = sales ÷ tickets. Spend per guest uses orders where guests were recorded."
        actions={
          <>
            <Segmented value={metric} onChange={setMetric} options={METRIC_OPTIONS(KEYS)} />
            <Segmented value={grain} onChange={setGrain} options={[{ value: 'day', label: 'Daily' }, { value: 'week', label: 'Weekly' }, { value: 'month', label: 'Monthly' }]} />
            <SmallButton onClick={exportCsv}><Download className="h-3.5 w-3.5" /> CSV</SmallButton>
          </>
        }
      >
        <div className="h-96">
          <ResponsiveContainer>
            <LineChart
              data={data}
              margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
              onClick={(st) => grain === 'day' && st?.activeLabel && onPickDate(String(st.activeLabel))}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="k" tickFormatter={(k: string) => (grain === 'month' ? monthLabel(k) : shortDate(k))} tick={{ fontSize: 10 }} minTickGap={24} />
              <YAxis tickFormatter={fmtC} tick={{ fontSize: 11 }} width={70} />
              <Tooltip
                content={(p) => (
                  <ChartTooltip
                    {...(p as object)}
                    labelFormatter={(l) => label(String(l)) + (holidayMap.has(String(l)) ? ` · ${holidayMap.get(String(l))}` : '')}
                    valueFormatter={fmt}
                  />
                )}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {report.series.map((s) => (
                <Line key={s} dataKey={s} name={s} stroke={colorOf(s)} strokeWidth={1.75} dot={grain === 'month'} isAnimationActive={false} />
              ))}
              {report.series.length > 1 && (
                <Line dataKey="Total" name="All selected" stroke="#0f172a" strokeDasharray="4 3" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              )}
              {grain !== 'month' && data.length > 40 && (
                <Brush dataKey="k" height={22} tickFormatter={shortDate} travellerWidth={8} stroke="#94a3b8" />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title={`${grain === 'day' ? 'Daily' : grain === 'week' ? 'Weekly' : 'Monthly'} tickets and sales by outlet`} subtitle="Most recent first">
        <div className="max-h-[600px] overflow-auto">
          <Table>
            <thead>
              <tr>
                <Th rowSpan={2}>{grain === 'day' ? 'Date' : grain === 'week' ? 'Week' : 'Month'}</Th>
                {[...report.series, 'All selected'].map((s) => (
                  <Th key={s} colSpan={4} className="border-l border-slate-200 text-center">{s}</Th>
                ))}
              </tr>
              <tr>
                {[...report.series, '__all'].map((s) => (
                  <React.Fragment key={s}>
                    <Th right className="border-l border-slate-200">Tickets</Th>
                    <Th right>Avg ticket</Th>
                    <Th right>Guests</Th>
                    <Th right>Sales</Th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods
                .slice()
                .reverse()
                .slice(0, 400)
                .map(([k, p]) => (
                  <tr
                    key={k}
                    className={`hover:bg-slate-50 ${grain === 'day' ? 'cursor-pointer' : ''}`}
                    onClick={() => grain === 'day' && onPickDate(k)}
                  >
                    <Td className="whitespace-nowrap font-medium">
                      {label(k)} {grain === 'day' && holidayMap.has(k) && <Badge tone="warn">{holidayMap.get(k)}</Badge>}
                    </Td>
                    {[...report.series, '__all'].map((s) => {
                      const m = s === '__all' ? p.total : p.s[s];
                      return (
                        <React.Fragment key={s}>
                          <Td right className={`border-l border-slate-100 ${s === '__all' ? 'font-semibold' : ''}`}>{m ? int(m.tx) : '—'}</Td>
                          <Td right>{m && m.tx ? rm(avgTicket(m)) : '—'}</Td>
                          <Td right>{m ? int(m.guests) : '—'}</Td>
                          <Td right className={s === '__all' ? 'font-semibold' : ''}>{m ? rm(m.sales, 0) : '—'}</Td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                ))}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
};
