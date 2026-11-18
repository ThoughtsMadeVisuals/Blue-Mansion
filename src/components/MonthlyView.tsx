import React, { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
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
import { emptyMetrics, type Metrics } from '../lib/aggregate';
import { MONTHS, yearColor, downloadCsv, monthLabel, pct, pctChange } from '../lib/format';
import {
  METRIC_LABEL,
  METRIC_OPTIONS,
  fmtMetric,
  isAdditive,
  metricValue,
  type MetricKey,
  type ViewContext,
} from '../lib/metrics';
import { Card, ChartTooltip, Delta, Empty, Segmented, SmallButton, Table, Td, Th } from './ui';

const KEYS: MetricKey[] = ['sales', 'tx', 'guests', 'avgTicket', 'spg'];

function sumMetrics(a: Metrics, b: Metrics | undefined): Metrics {
  if (!b) return a;
  return {
    sales: a.sales + b.sales,
    qty: a.qty + b.qty,
    tx: a.tx + b.tx,
    guests: a.guests + b.guests,
    guestSales: a.guestSales + b.guestSales,
  };
}

export const MonthlyView: React.FC<{ ctx: ViewContext }> = ({ ctx }) => {
  const { report, colorOf } = ctx;
  const [metric, setMetric] = useState<MetricKey>('sales');
  const [tableSeries, setTableSeries] = useState<string>('__all');

  const months = useMemo(() => Array.from(report.monthly.keys()).sort(), [report]);
  const years = useMemo(() => Array.from(new Set(months.map((m) => m.slice(0, 4)))).sort(), [months]);

  const pick = (m: string, series: string): Metrics | undefined => {
    const b = report.monthly.get(m);
    if (!b) return undefined;
    return series === '__all' ? b.total : b.s[series];
  };

  const yoyData = useMemo(
    () =>
      MONTHS.map((label, i) => {
        const row: Record<string, string | number | null> = { label };
        for (const y of years) {
          const m = pick(`${y}-${String(i + 1).padStart(2, '0')}`, '__all');
          row[y] = m ? metricValue(m, metric) : null;
        }
        return row;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [report, years, metric],
  );

  const trendData = useMemo(
    () =>
      months.map((m) => {
        const row: Record<string, string | number> = { month: m, Total: metricValue(pick(m, '__all'), metric) };
        for (const s of report.series) row[s] = metricValue(pick(m, s), metric);
        return row;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [report, months, metric],
  );

  if (!months.length) return <Empty>No data for the current filters.</Empty>;

  // Warn when the years being compared don't contain the same points of sale
  const allPos = Array.from(new Set(Object.values(ctx.posByYear).flat()));
  const inScope = (p: string) => !ctx.selectedPos.length || ctx.selectedPos.includes(p);
  const yearSets = years.map((y) => (ctx.posByYear[y] ?? []).filter(inScope));
  const common = allPos.filter((p) => inScope(p) && yearSets.every((ys) => ys.includes(p)));
  const mismatch = years.length > 1 && yearSets.some((ys) => ys.length !== common.length);

  const fmt = (v: number) => fmtMetric(metric, v);
  const fmtC = (v: number) => fmtMetric(metric, v, true);
  const additive = isAdditive(metric);
  const lastTwo = years.slice(-2);

  // Table: month x year
  const tableRows = MONTHS.map((label, i) => {
    const cells = years.map((y) => pick(`${y}-${String(i + 1).padStart(2, '0')}`, tableSeries));
    return { label, cells };
  });
  const yearTotals = years.map((_, yi) =>
    tableRows.reduce((acc, r) => sumMetrics(acc, r.cells[yi]), emptyMetrics()),
  );
  // Like-for-like: only months present in both of the last two years
  const lfl = lastTwo.length === 2
    ? tableRows.reduce(
        (acc, r) => {
          const a = r.cells[years.indexOf(lastTwo[0])];
          const b = r.cells[years.indexOf(lastTwo[1])];
          if (a && b) return { a: sumMetrics(acc.a, a), b: sumMetrics(acc.b, b), n: acc.n + 1 };
          return acc;
        },
        { a: emptyMetrics(), b: emptyMetrics(), n: 0 },
      )
    : null;

  const exportCsv = () => {
    const header = ['Month', ...report.series.flatMap((s) => [`${s} sales`, `${s} transactions`, `${s} guests`]), 'Total sales', 'Total transactions', 'Total guests', 'Avg ticket'];
    const rows = months.map((m) => {
      const b = report.monthly.get(m)!;
      return [
        monthLabel(m),
        ...report.series.flatMap((s) => [b.s[s]?.sales ?? 0, b.s[s]?.tx ?? 0, b.s[s]?.guests ?? 0]),
        b.total.sales,
        b.total.tx,
        b.total.guests,
        b.total.tx ? b.total.sales / b.total.tx : 0,
      ];
    });
    downloadCsv('monthly-sales.csv', [header, ...rows]);
  };

  return (
    <div className="space-y-5">
      <Card
        title={`Monthly ${METRIC_LABEL[metric].toLowerCase()}: year against year`}
        subtitle={
          years.length > 1
            ? `Each month of ${years.join(' vs ')} side by side for the selected outlets`
            : 'Only one year is in the selected dates. Choose "All dates" to compare years.'
        }
        actions={<Segmented value={metric} onChange={setMetric} options={METRIC_OPTIONS(KEYS)} />}
      >
        {mismatch && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <span>
              The years don't contain the same outlets:{' '}
              {years.map((y, i) => `${y} has ${yearSets[i].length} point${yearSets[i].length === 1 ? '' : 's'} of sale`).join(', ')}.
              {common.length > 0 && <> For a fair comparison, compare only {common.join(', ')}.</>}
            </span>
            {common.length > 0 && (
              <button
                type="button"
                onClick={() => ctx.setPos(common)}
                className="cursor-pointer rounded-lg bg-amber-600 px-3 py-1.5 font-medium text-white hover:bg-amber-700"
              >
                Compare like-for-like outlets
              </button>
            )}
          </div>
        )}
        <div className="h-80">
          <ResponsiveContainer>
            <BarChart data={yoyData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={fmtC} tick={{ fontSize: 11 }} width={70} />
              <Tooltip
                cursor={{ fill: '#f1f5f9' }}
                content={(p) => (
                  <ChartTooltip
                    {...(p as object)}
                    valueFormatter={fmt}
                    footer={() => {
                      if (lastTwo.length < 2) return null;
                      const pl = p.payload as { dataKey: string; value: number }[] | undefined;
                      const a = pl?.find((x) => x.dataKey === lastTwo[0])?.value;
                      const b = pl?.find((x) => x.dataKey === lastTwo[1])?.value;
                      if (!a || !b) return null;
                      return <span className="text-slate-600">{lastTwo[1]} vs {lastTwo[0]}: <b>{pct(pctChange(b, a))}</b></span>;
                    }}
                  />
                )}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {years.map((y, i) => (
                <Bar key={y} dataKey={y} name={y} fill={yearColor(i, years.length)} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card
        title={`Monthly ${METRIC_LABEL[metric].toLowerCase()} by outlet (${months.length} months)`}
        subtitle={additive ? 'Stacked: each colour is one outlet, the full bar is the total' : 'One line per outlet'}
        actions={<SmallButton onClick={exportCsv}><Download className="h-3.5 w-3.5" /> Export CSV</SmallButton>}
      >
        <div className="h-80">
          <ResponsiveContainer>
            {additive ? (
              <BarChart data={trendData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tickFormatter={fmtC} tick={{ fontSize: 11 }} width={70} />
                <Tooltip
                  cursor={{ fill: '#f1f5f9' }}
                  content={(p) => (
                    <ChartTooltip
                      {...(p as object)}
                      labelFormatter={(l) => monthLabel(String(l))}
                      valueFormatter={fmt}
                      footer={(l) => <span>Total: <b>{fmt(Number(trendData.find((r) => r.month === l)?.Total ?? 0))}</b></span>}
                    />
                  )}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {report.series.map((s) => (
                  <Bar key={s} dataKey={s} name={s} stackId="a" fill={colorOf(s)} />
                ))}
              </BarChart>
            ) : (
              <LineChart data={trendData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={fmtC} tick={{ fontSize: 11 }} width={70} />
                <Tooltip content={(p) => <ChartTooltip {...(p as object)} labelFormatter={(l) => monthLabel(String(l))} valueFormatter={fmt} />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {report.series.map((s) => (
                  <Line key={s} dataKey={s} name={s} stroke={colorOf(s)} strokeWidth={2} dot={false} />
                ))}
                <Line dataKey="Total" name="All selected" stroke="#0f172a" strokeDasharray="4 3" strokeWidth={2} dot={false} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </Card>

      <Card
        title="Monthly sales figures"
        subtitle="Sales, transactions and guests for every month, with the change against the same month last year"
        actions={
          <select
            value={tableSeries}
            onChange={(e) => setTableSeries(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
            aria-label="Outlet for table"
          >
            <option value="__all">All selected outlets</option>
            {report.series.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        }
      >
        <Table>
          <thead>
            <tr>
              <Th rowSpan={2}>Month</Th>
              {years.map((y) => (
                <Th key={y} colSpan={4} className="border-l border-slate-200 text-center">{y}</Th>
              ))}
              {lastTwo.length === 2 && <Th rowSpan={2} right className="border-l border-slate-200">Sales {lastTwo[1]} vs {lastTwo[0]}</Th>}
            </tr>
            <tr>
              {years.map((y) => (
                <React.Fragment key={y}>
                  <Th right className="border-l border-slate-200">Sales</Th>
                  <Th right>Transactions</Th>
                  <Th right>Guests</Th>
                  <Th right>Avg ticket</Th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((r) => {
              const a = r.cells[years.indexOf(lastTwo[0])];
              const b = r.cells[years.indexOf(lastTwo[1])];
              return (
                <tr key={r.label} className="hover:bg-slate-50">
                  <Td className="font-medium">{r.label}</Td>
                  {r.cells.map((c, i) => (
                    <React.Fragment key={i}>
                      <Td right className="border-l border-slate-100 font-semibold">{c ? fmtMetric('sales', c.sales) : '—'}</Td>
                      <Td right>{c ? fmtMetric('tx', c.tx) : '—'}</Td>
                      <Td right>{c ? fmtMetric('guests', c.guests) : '—'}</Td>
                      <Td right>{c && c.tx ? fmtMetric('avgTicket', c.sales / c.tx) : '—'}</Td>
                    </React.Fragment>
                  ))}
                  {lastTwo.length === 2 && (
                    <Td right className="border-l border-slate-100">
                      <Delta value={a && b ? pctChange(b.sales, a.sales) : null} />
                    </Td>
                  )}
                </tr>
              );
            })}
            <tr className="bg-slate-50 font-semibold">
              <Td>Total</Td>
              {yearTotals.map((t, i) => (
                <React.Fragment key={i}>
                  <Td right className="border-l border-slate-100">{fmtMetric('sales', t.sales)}</Td>
                  <Td right>{fmtMetric('tx', t.tx)}</Td>
                  <Td right>{fmtMetric('guests', t.guests)}</Td>
                  <Td right>{t.tx ? fmtMetric('avgTicket', t.sales / t.tx) : '—'}</Td>
                </React.Fragment>
              ))}
              {lastTwo.length === 2 && <Td right className="border-l border-slate-100" />}
            </tr>
          </tbody>
        </Table>
        {lfl && lfl.n > 0 && lfl.n < 12 && (
          <p className="mt-3 text-xs text-slate-600">
            Like-for-like ({lfl.n} months present in both years): {lastTwo[1]} {fmtMetric('sales', lfl.b.sales)} vs{' '}
            {lastTwo[0]} {fmtMetric('sales', lfl.a.sales)} → <b>{pct(pctChange(lfl.b.sales, lfl.a.sales))}</b>. Partial
            months (e.g. the latest month) are compared as they stand.
          </p>
        )}
      </Card>
    </div>
  );
};
