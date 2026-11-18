import React, { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import {
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { addDays, dowOf, emptyMetrics, type Metrics } from '../lib/aggregate';
import { DOWS, DOWS_LONG, downloadCsv, longDate, pct, pctChange, rm, shortDate } from '../lib/format';
import {
  METRIC_LABEL,
  METRIC_OPTIONS,
  fmtMetric,
  isAdditive,
  metricValue,
  type MetricKey,
  type ViewContext,
} from '../lib/metrics';
import type { Holiday } from '../types';
import { Badge, Card, ChartTooltip, Delta, Empty, Segmented, SmallButton, Table, Td, Th } from './ui';

const KEYS: MetricKey[] = ['sales', 'tx', 'guests', 'avgTicket', 'spg'];

export const DailyView: React.FC<{
  ctx: ViewContext;
  holidays: Holiday[];
  onPickDate: (d: string) => void;
}> = ({ ctx, holidays, onPickDate }) => {
  const { report, prev, colorOf } = ctx;
  const [metric, setMetric] = useState<MetricKey>('sales');
  const [mode, setMode] = useState<'outlets' | 'total'>('outlets');
  const [overlay, setOverlay] = useState<'none' | 'weekday' | 'date'>('none');
  const [rankBy, setRankBy] = useState<'best' | 'worst'>('best');

  const holidayMap = useMemo(() => {
    const m = new Map<string, Holiday>();
    for (const h of holidays) m.set(h.date, h);
    return m;
  }, [holidays]);

  const days = useMemo(() => Array.from(report.daily.keys()).sort(), [report]);
  const fmt = (v: number) => fmtMetric(metric, v);
  const fmtC = (v: number) => fmtMetric(metric, v, true);

  const prevValue = (d: string): number | null => {
    if (!prev || overlay === 'none') return null;
    const key = overlay === 'weekday' ? addDays(d, -364) : `${+d.slice(0, 4) - 1}${d.slice(4)}`;
    const b = prev.daily.get(key);
    return b ? metricValue(b.total, metric) : null;
  };

  const chartData = useMemo(
    () =>
      days.map((d) => {
        const b = report.daily.get(d)!;
        const row: Record<string, number | string | null> = { date: d, Total: metricValue(b.total, metric) };
        if (mode === 'outlets') for (const s of report.series) row[s] = b.s[s] ? metricValue(b.s[s], metric) : null;
        row.LY = prevValue(d);
        return row;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [report, prev, days, metric, mode, overlay],
  );

  const ranked = useMemo(() => {
    const arr = days.map((d) => ({ d, b: report.daily.get(d)! }));
    arr.sort((a, b) => (rankBy === 'best' ? b.b.total.sales - a.b.total.sales : a.b.total.sales - b.b.total.sales));
    return arr.slice(0, 15);
  }, [report, days, rankBy]);

  const dowData = useMemo(() => {
    const acc = Array.from({ length: 7 }, () => ({ n: 0, total: emptyMetrics(), s: {} as Record<string, Metrics> }));
    for (const d of days) {
      const b = report.daily.get(d)!;
      const a = acc[dowOf(d)];
      a.n++;
      add(a.total, b.total);
      for (const s of report.series) if (b.s[s]) add((a.s[s] ??= emptyMetrics()), b.s[s]);
    }
    const order = [1, 2, 3, 4, 5, 6, 0];
    return order.map((w) => {
      const a = acc[w];
      // Each outlet is averaged over the days it traded on that weekday
      const v = (m: Metrics | undefined, n: number) =>
        !m || !n ? 0 : isAdditive(metric) ? metricValue(m, metric) / n : metricValue(m, metric);
      const row: Record<string, number | string> = { dow: DOWS[w], days: a.n, Total: v(a.total, a.n) };
      for (const s of report.series) row[s] = v(a.s[s], report.days.dowS[s]?.[w] ?? 0);
      return row;
    });
  }, [report, days, metric]);

  const holidayRows = useMemo(() => {
    const isHol = (d: string) => holidayMap.has(d);
    return holidays
      .filter((h) => report.daily.has(h.date))
      .map((h) => {
        const b = report.daily.get(h.date)!;
        // Baseline: same weekday within ±4 weeks, skipping other holidays
        const base: number[] = [];
        for (const w of [-4, -3, -2, -1, 1, 2, 3, 4]) {
          const d = addDays(h.date, w * 7);
          const bd = report.daily.get(d);
          if (bd && !isHol(d)) base.push(bd.total.sales);
        }
        const baseline = base.length ? base.reduce((x, y) => x + y, 0) / base.length : 0;
        return { h, b, baseline, uplift: baseline ? pctChange(b.total.sales, baseline) : null };
      });
  }, [holidays, holidayMap, report]);

  if (!days.length) return <Empty>No data for the current filters.</Empty>;

  const avgDay = report.kpi.total.sales / days.length;
  const holidayInView = chartData.filter((r) => holidayMap.has(String(r.date)));

  const exportCsv = () => {
    const header = ['Date', 'Day', 'Holiday', ...report.series.flatMap((s) => [`${s} sales`, `${s} transactions`, `${s} guests`]), 'Total sales', 'Total transactions', 'Total guests', 'Avg ticket'];
    const rows = days.map((d) => {
      const b = report.daily.get(d)!;
      return [d, DOWS[dowOf(d)], holidayMap.get(d)?.name ?? '', ...report.series.flatMap((s) => [b.s[s]?.sales ?? 0, b.s[s]?.tx ?? 0, b.s[s]?.guests ?? 0]), b.total.sales, b.total.tx, b.total.guests, b.total.tx ? b.total.sales / b.total.tx : 0];
    });
    downloadCsv('daily-sales.csv', [header, ...rows]);
  };

  return (
    <div className="space-y-5">
      <Card
        title={`Daily ${METRIC_LABEL[metric].toLowerCase()}`}
        subtitle={`${days.length} trading days · average ${rm(avgDay, 0)} sales per day · amber dots mark holidays and festive days · drag the bar under the chart to zoom`}
        actions={
          <>
            <Segmented value={metric} onChange={setMetric} options={METRIC_OPTIONS(KEYS)} />
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: 'outlets', label: 'By outlet' },
                { value: 'total', label: 'Total' },
              ]}
            />
            <Segmented
              value={overlay}
              onChange={setOverlay}
              options={[
                { value: 'none', label: 'No LY' },
                { value: 'weekday', label: 'LY same weekday' },
                { value: 'date', label: 'LY same date' },
              ]}
            />
            <SmallButton onClick={exportCsv}><Download className="h-3.5 w-3.5" /> CSV</SmallButton>
          </>
        }
      >
        <div className="h-96">
          <ResponsiveContainer>
            <ComposedChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
              onClick={(st) => st?.activeLabel && onPickDate(String(st.activeLabel))}
              style={{ cursor: 'pointer' }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 10 }} minTickGap={24} />
              <YAxis tickFormatter={fmtC} tick={{ fontSize: 11 }} width={70} />
              <Tooltip
                content={(p) => (
                  <ChartTooltip
                    {...(p as object)}
                    labelFormatter={(l) => longDate(String(l))}
                    valueFormatter={fmt}
                    footer={(l) => {
                      const h = holidayMap.get(String(l));
                      return (
                        <span className="text-slate-600">
                          {h && <b className="text-amber-700">{h.name} · </b>}
                          Click to open this day
                        </span>
                      );
                    }}
                  />
                )}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {mode === 'outlets' &&
                report.series.map((s) => (
                  <Line key={s} dataKey={s} name={s} stroke={colorOf(s)} strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} />
                ))}
              {(mode === 'total' || report.series.length > 1) && (
                <Line
                  dataKey="Total"
                  name="All selected"
                  stroke="#0f172a"
                  strokeWidth={mode === 'total' ? 2 : 1.5}
                  strokeOpacity={mode === 'total' ? 1 : 0.55}
                  dot={false}
                  isAnimationActive={false}
                />
              )}
              {overlay !== 'none' && (
                <Line dataKey="LY" name="Last year (total)" stroke="#94a3b8" strokeDasharray="4 3" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              )}
              {holidayInView.map((r) => (
                <ReferenceDot key={String(r.date)} x={String(r.date)} y={Number(r.Total)} r={4} fill="#f59e0b" stroke="white" />
              ))}
              <Brush dataKey="date" height={22} tickFormatter={shortDate} travellerWidth={8} stroke="#94a3b8" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {overlay !== 'none' && !prev && (
          <p className="mt-2 text-xs text-amber-700">No data from last year for these dates, so there is nothing to overlay.</p>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card
          title={`Day of the week: average ${METRIC_LABEL[metric].toLowerCase()}${isAdditive(metric) ? ' per trading day' : ''}`}
          subtitle="Which weekday performs best"
        >
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={dowData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="dow" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={fmtC} tick={{ fontSize: 11 }} width={70} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} content={(p) => <ChartTooltip {...(p as object)} valueFormatter={fmt} />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {report.series.length > 1 &&
                  report.series.map((s) => <Bar key={s} dataKey={s} name={s} fill={colorOf(s)} radius={[3, 3, 0, 0]} />)}
                <Bar dataKey="Total" name="All selected" fill="#0f172a" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card
          title={rankBy === 'best' ? 'Best 15 days' : 'Weakest 15 days'}
          subtitle="Ranked by total sales of the selected outlets · click a day to open it"
          actions={
            <Segmented
              value={rankBy}
              onChange={setRankBy}
              options={[
                { value: 'best', label: 'Best' },
                { value: 'worst', label: 'Weakest' },
              ]}
            />
          }
        >
          <div className="max-h-72 overflow-y-auto">
            <Table>
              <thead>
                <tr>
                  <Th>#</Th>
                  <Th>Date</Th>
                  <Th right>Sales</Th>
                  <Th right>vs avg day</Th>
                  <Th right>Tickets</Th>
                  <Th right>Guests</Th>
                </tr>
              </thead>
              <tbody>
                {ranked.map(({ d, b }, i) => {
                  const h = holidayMap.get(d);
                  return (
                    <tr key={d} onClick={() => onPickDate(d)} className="cursor-pointer hover:bg-indigo-50">
                      <Td className="text-slate-400">{i + 1}</Td>
                      <Td>
                        <div className="font-medium">{longDate(d)}</div>
                        {h && <Badge tone="warn">{h.name}</Badge>}
                      </Td>
                      <Td right className="font-semibold">{rm(b.total.sales, 0)}</Td>
                      <Td right>{pct(pctChange(b.total.sales, avgDay), 0)}</Td>
                      <Td right>{fmtMetric('tx', b.total.tx)}</Td>
                      <Td right>{fmtMetric('guests', b.total.guests)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </Card>
      </div>

      <Card
        title="Holidays and festive days"
        subtitle="Sales on each holiday compared with the average of the same weekday in the 4 weeks before and after (other holidays left out). Edit the holiday list in Settings."
      >
        {holidayRows.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Occasion</Th>
                <Th right>Sales</Th>
                <Th right>Normal same weekday</Th>
                <Th right>Uplift</Th>
                <Th right>Tickets</Th>
                <Th right>Guests</Th>
                {report.series.length > 1 && report.series.map((s) => <Th key={s} right>{s}</Th>)}
              </tr>
            </thead>
            <tbody>
              {holidayRows.map(({ h, b, baseline, uplift }) => (
                <tr key={h.date} onClick={() => onPickDate(h.date)} className="cursor-pointer hover:bg-indigo-50">
                  <Td className="whitespace-nowrap">{DOWS_LONG[dowOf(h.date)].slice(0, 3)}, {shortDate(h.date)}</Td>
                  <Td>
                    {h.name} {h.kind === 'festive' && <span className="text-[10px] text-slate-400">(festive)</span>}
                  </Td>
                  <Td right className="font-semibold">{rm(b.total.sales, 0)}</Td>
                  <Td right>{baseline ? rm(baseline, 0) : '—'}</Td>
                  <Td right><Delta value={uplift} /></Td>
                  <Td right>{fmtMetric('tx', b.total.tx)}</Td>
                  <Td right>{fmtMetric('guests', b.total.guests)}</Td>
                  {report.series.length > 1 && report.series.map((s) => <Td key={s} right>{b.s[s] ? rm(b.s[s].sales, 0) : '—'}</Td>)}
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Empty>No holidays fall within the selected dates.</Empty>
        )}
      </Card>
    </div>
  );
};

function add(a: Metrics, b: Metrics) {
  a.sales += b.sales;
  a.qty += b.qty;
  a.tx += b.tx;
  a.guests += b.guests;
  a.guestSales += b.guestSales;
}
