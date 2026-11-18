import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Download, X } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ItemRow, ItemTrend } from '../lib/aggregate';
import { MONTHS, downloadCsv, hourLabel, int, num, rm, rmCompact, shortCategory, yearColor } from '../lib/format';
import type { ViewContext } from '../lib/metrics';
import { Badge, Card, ChartTooltip, Delta, Empty, Segmented, SmallButton, Table, Td, Th } from './ui';
import { pctChange } from '../lib/format';

type SortKey = 'product' | 'category' | 'qty' | 'sales' | 'avg' | 'ly' | 'yoy';

export const ItemsView: React.FC<{
  ctx: ViewContext;
  selected: string | null;
  onSelect: (p: string | null) => void;
  trend: ItemTrend | null;
}> = ({ ctx, selected, onSelect, trend }) => {
  const { report, prev, prevComplete, colorOf } = ctx;
  const [rankBy, setRankBy] = useState<'qty' | 'sales'>('qty');
  const [topN, setTopN] = useState<'10' | '20'>('10');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'sales', dir: -1 });
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | 'Food' | 'Beverage' | 'Other'>('All');
  const [limit, setLimit] = useState(50);
  const [paidOnly, setPaidOnly] = useState(true);

  const prevMap = useMemo(() => {
    const m = new Map<string, number>();
    if (prev && prevComplete) for (const it of prev.items) m.set(it.product, it.sales);
    return m;
  }, [prev, prevComplete]);
  const showLy = prevMap.size > 0;

  const top = (fb: 'Food' | 'Beverage') =>
    report.items
      .filter((i) => i.foodBev === fb && (!paidOnly || i.sales > 0.005))
      .sort((a, b) => b[rankBy] - a[rankBy])
      .slice(0, +topN)
      .map((i) => {
        const row: Record<string, string | number> = { product: i.product, total: i[rankBy] };
        for (const s of report.series) row[s] = i.s[s]?.[rankBy] ?? 0;
        return row;
      });

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const list = report.items.filter(
      (i) =>
        (typeFilter === 'All' || i.foodBev === typeFilter) &&
        (!ql || i.product.toLowerCase().includes(ql) || i.category.toLowerCase().includes(ql)),
    );
    const val = (i: ItemRow): number | string => {
      switch (sort.key) {
        case 'product':
          return i.product.toLowerCase();
        case 'category':
          return i.category.toLowerCase();
        case 'qty':
          return i.qty;
        case 'sales':
          return i.sales;
        case 'avg':
          return i.qty ? i.sales / i.qty : 0;
        case 'ly':
          return prevMap.get(i.product) ?? 0;
        case 'yoy':
          return pctChange(i.sales, prevMap.get(i.product) ?? 0) ?? -Infinity;
      }
    };
    return list.sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
    });
  }, [report, q, typeFilter, sort, prevMap]);

  const total = report.kpi.total.sales;
  const multi = report.series.length > 1;

  const SortTh: React.FC<{ k: SortKey; children: React.ReactNode; right?: boolean }> = ({ k, children, right }) => (
    <Th right={right}>
      <button
        type="button"
        className="inline-flex cursor-pointer items-center gap-1 hover:text-slate-900"
        onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? (s.dir === 1 ? -1 : 1) : k === 'product' || k === 'category' ? 1 : -1 }))}
      >
        {children}
        {sort.key === k && (sort.dir === -1 ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
      </button>
    </Th>
  );

  const exportCsv = () => {
    const header = ['Item', 'Category', 'Type', 'Qty', 'Sales', 'Avg price', ...(showLy ? ['Sales last year'] : []), ...report.series.flatMap((s) => [`${s} qty`, `${s} sales`])];
    downloadCsv('sales-by-item.csv', [
      header,
      ...rows.map((i) => [i.product, i.category, i.foodBev, i.qty, i.sales, i.qty ? i.sales / i.qty : 0, ...(showLy ? [prevMap.get(i.product) ?? 0] : []), ...report.series.flatMap((s) => [i.s[s]?.qty ?? 0, i.s[s]?.sales ?? 0])]),
    ]);
  };

  if (!report.items.length) return <Empty>No items for the current filters.</Empty>;

  return (
    <div className="space-y-5">
      <Card
        title="Most sold items: food and beverage"
        subtitle={`Top ${topN} by ${rankBy === 'qty' ? 'quantity sold' : 'sales value'} · coloured by outlet · click a bar for the item's trend`}
        actions={
          <>
            <Segmented value={rankBy} onChange={setRankBy} options={[{ value: 'qty', label: 'By quantity' }, { value: 'sales', label: 'By sales' }]} />
            <Segmented value={topN} onChange={setTopN} options={[{ value: '10', label: 'Top 10' }, { value: '20', label: 'Top 20' }]} />
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
              <input type="checkbox" checked={!paidOnly} onChange={(e) => setPaidOnly(!e.target.checked)} />
              Include free (RM 0) items
            </label>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {(['Food', 'Beverage'] as const).map((fb) => {
            const data = top(fb);
            return (
              <div key={fb}>
                <div className="mb-2 text-xs font-semibold text-slate-700">{fb === 'Food' ? '🍽 Food' : '🍹 Beverage'}</div>
                {data.length ? (
                  <div style={{ height: data.length * 30 + 40 }}>
                    <ResponsiveContainer>
                      <BarChart
                        data={data}
                        layout="vertical"
                        margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                        onClick={(st) => st?.activeLabel && onSelect(String(st.activeLabel))}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                        <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => (rankBy === 'qty' ? int(v) : rmCompact(v))} />
                        <YAxis type="category" dataKey="product" width={190} tick={{ fontSize: 10 }} interval={0} tickFormatter={(v: string) => (v.length > 30 ? v.slice(0, 29) + '…' : v)} />
                        <Tooltip
                          cursor={{ fill: '#f1f5f9' }}
                          content={(p) => (
                            <ChartTooltip
                              {...(p as object)}
                              valueFormatter={(v) => (rankBy === 'qty' ? int(v) : rm(v, 0))}
                              footer={(l) => {
                                const r = data.find((d) => d.product === l);
                                return r ? <span>Total: <b>{rankBy === 'qty' ? int(+r.total) : rm(+r.total, 0)}</b></span> : null;
                              }}
                            />
                          )}
                        />
                        {multi ? (
                          report.series.map((s) => <Bar key={s} dataKey={s} name={s} stackId="t" fill={colorOf(s)} className="cursor-pointer" />)
                        ) : (
                          <Bar dataKey="total" name={rankBy === 'qty' ? 'Qty' : 'Sales'} fill={fb === 'Food' ? '#059669' : '#4f46e5'} radius={[0, 3, 3, 0]} className="cursor-pointer" />
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <Empty>No {fb.toLowerCase()} items.</Empty>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {selected && trend && <ItemDetail product={selected} trend={trend} ctx={ctx} onClose={() => onSelect(null)} />}

      <Card
        title="Sales by item"
        subtitle={`${int(rows.length)} items · click a row to see its monthly and hourly trend`}
        actions={
          <>
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setLimit(50);
              }}
              placeholder="Find item…"
              className="w-44 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
            />
            <Segmented size="xs" value={typeFilter} onChange={setTypeFilter} options={(['All', 'Food', 'Beverage', 'Other'] as const).map((v) => ({ value: v, label: v }))} />
            <SmallButton onClick={exportCsv}><Download className="h-3.5 w-3.5" /> CSV</SmallButton>
          </>
        }
      >
        <div className="max-h-[640px] overflow-auto">
          <Table>
            <thead>
              <tr>
                <Th>#</Th>
                <SortTh k="product">Item</SortTh>
                <SortTh k="category">Category</SortTh>
                <SortTh k="qty" right>Qty</SortTh>
                <SortTh k="sales" right>Sales</SortTh>
                <Th right>Share</Th>
                <SortTh k="avg" right>Avg price</SortTh>
                {showLy && <SortTh k="ly" right>Sales LY</SortTh>}
                {showLy && <SortTh k="yoy" right>vs LY</SortTh>}
                {multi && report.series.map((s) => <Th key={s} right>{s}</Th>)}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((i, idx) => (
                <tr
                  key={i.product}
                  onClick={() => onSelect(i.product === selected ? null : i.product)}
                  className={`cursor-pointer ${i.product === selected ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                >
                  <Td className="text-slate-400">{idx + 1}</Td>
                  <Td className="max-w-72 truncate font-medium text-slate-800" title={i.product}>{i.product}</Td>
                  <Td className="max-w-56 truncate text-slate-500" title={i.category}>
                    <Badge tone={i.foodBev === 'Food' ? 'up' : i.foodBev === 'Beverage' ? 'neutral' : 'warn'}>{i.foodBev}</Badge>{' '}
                    {shortCategory(i.category, 26)}
                  </Td>
                  <Td right>{Number.isInteger(i.qty) ? int(i.qty) : num(i.qty, 1)}</Td>
                  <Td right className="font-semibold">{rm(i.sales, 0)}</Td>
                  <Td right>{total ? ((i.sales / total) * 100).toFixed(2) : 0}%</Td>
                  <Td right>{i.qty ? rm(i.sales / i.qty) : '—'}</Td>
                  {showLy && <Td right>{prevMap.has(i.product) ? rm(prevMap.get(i.product)!, 0) : '—'}</Td>}
                  {showLy && <Td right><Delta value={pctChange(i.sales, prevMap.get(i.product) ?? 0)} /></Td>}
                  {multi && report.series.map((s) => (
                    <Td key={s} right className="text-slate-600">{i.s[s] ? `${int(i.s[s].qty)} · ${rmCompact(i.s[s].sales)}` : '—'}</Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        {rows.length > limit && (
          <div className="mt-3 text-center">
            <SmallButton onClick={() => setLimit((l) => l + 100)}>Show more ({int(rows.length - limit)} left)</SmallButton>
          </div>
        )}
      </Card>
    </div>
  );
};

const ItemDetail: React.FC<{ product: string; trend: ItemTrend; ctx: ViewContext; onClose: () => void }> = ({
  product,
  trend,
  ctx,
  onClose,
}) => {
  const [metric, setMetric] = useState<'qty' | 'sales'>('qty');
  const months = Array.from(trend.monthly.keys()).sort();
  const years = Array.from(new Set(months.map((m) => m.slice(0, 4))));
  const monthData = MONTHS.map((label, i) => {
    const row: Record<string, string | number | null> = { label };
    for (const y of years) row[y] = trend.monthly.get(`${y}-${String(i + 1).padStart(2, '0')}`)?.[metric] ?? null;
    return row;
  });
  const hours = trend.hourly.map((h, i) => ({ hour: hourLabel(i), v: h[metric] })).filter((_, i) => trend.hourly[i].qty !== 0);
  const fmt = (v: number) => (metric === 'qty' ? int(v) : rm(v, 0));
  const series = Object.entries(trend.bySeries).sort((a, b) => b[1].sales - a[1].sales);

  return (
    <Card
      className="border-indigo-200 ring-1 ring-indigo-100"
      title={<span className="text-indigo-700">{product}</span>}
      subtitle={series.map(([s, v]) => `${s}: ${int(v.qty)} sold, ${rm(v.sales, 0)}`).join(' · ')}
      actions={
        <>
          <Segmented value={metric} onChange={setMetric} options={[{ value: 'qty', label: 'Quantity' }, { value: 'sales', label: 'Sales' }]} />
          <SmallButton onClick={onClose}><X className="h-3.5 w-3.5" /> Close</SmallButton>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-1 text-xs font-medium text-slate-600">By month, year against year</div>
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={monthData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => (metric === 'qty' ? int(v) : rmCompact(v))} width={60} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} content={(p) => <ChartTooltip {...(p as object)} valueFormatter={fmt} />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {years.map((y, i) => <Bar key={y} dataKey={y} name={y} fill={yearColor(i, years.length)} radius={[3, 3, 0, 0]} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs font-medium text-slate-600">By hour of day</div>
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={hours}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => (metric === 'qty' ? int(v) : rmCompact(v))} width={60} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} content={(p) => <ChartTooltip {...(p as object)} valueFormatter={fmt} />} />
                <Bar dataKey="v" name={metric === 'qty' ? 'Quantity' : 'Sales'} fill={ctx.colorOf(series[0]?.[0] ?? '')} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </Card>
  );
};
