import React, { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CategoryRow } from '../lib/aggregate';
import { downloadCsv, int, pctChange, rm, rmCompact, shortCategory } from '../lib/format';
import type { ViewContext } from '../lib/metrics';
import type { FoodBev } from '../types';
import { Badge, Card, ChartTooltip, Delta, Empty, Segmented, SmallButton, Table, Td, Th } from './ui';

const FB_COLORS: Record<FoodBev, string> = { Food: '#059669', Beverage: '#4f46e5', Other: '#f59e0b' };

export const CategoriesView: React.FC<{ ctx: ViewContext; onSearch: (q: string) => void }> = ({ ctx, onSearch }) => {
  const { report, prev, prevComplete, colorOf } = ctx;
  const [group, setGroup] = useState<'pos' | 'product'>('pos');
  const [topN, setTopN] = useState<'15' | '30' | 'all'>('15');

  const rows: CategoryRow[] = group === 'pos' ? report.categories : report.productCategories;
  const prevMap = useMemo(() => {
    const m = new Map<string, number>();
    if (prev && prevComplete) for (const c of group === 'pos' ? prev.categories : prev.productCategories) m.set(c.category, c.sales);
    return m;
  }, [prev, prevComplete, group]);
  const showLy = prevMap.size > 0;
  const total = report.kpi.total.sales;
  const multi = report.series.length > 1;

  const shown = topN === 'all' ? rows : rows.slice(0, +topN);
  const chartData = shown.map((c) => {
    const r: Record<string, string | number> = { name: c.category, label: shortCategory(c.category, 36), total: c.sales };
    for (const s of report.series) r[s] = c.s[s] ?? 0;
    return r;
  });

  const fbTotal = (['Food', 'Beverage', 'Other'] as FoodBev[]).map((t) => ({ name: t, value: report.foodBev[t].sales })).filter((x) => x.value > 0);

  if (!rows.length) return <Empty>No data for the current filters.</Empty>;

  const exportCsv = () =>
    downloadCsv('sales-by-category.csv', [
      ['Category', 'Type', 'Qty', 'Sales', ...(showLy ? ['Sales last year'] : []), ...report.series],
      ...rows.map((c) => [c.category, c.foodBev, c.qty, c.sales, ...(showLy ? [prevMap.get(c.category) ?? 0] : []), ...report.series.map((s) => c.s[s] ?? 0)]),
    ]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card title="Food vs beverage" subtitle="Share of sales">
          <div className="h-56">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={fbTotal} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                  {fbTotal.map((d) => <Cell key={d.name} fill={FB_COLORS[d.name as FoodBev]} />)}
                </Pie>
                <Tooltip content={(p) => <ChartTooltip {...(p as object)} label=" " valueFormatter={(v) => `${rm(v, 0)} (${total ? ((v / total) * 100).toFixed(1) : 0}%)`} />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="xl:col-span-2" title="Food vs beverage by outlet" subtitle="Sales split for each outlet">
          <Table>
            <thead>
              <tr>
                <Th>Outlet</Th>
                <Th right>Food</Th>
                <Th right>Beverage</Th>
                <Th right>Other</Th>
                <Th>Mix</Th>
              </tr>
            </thead>
            <tbody>
              {[...report.series, '__all'].map((s) => {
                const v = (t: FoodBev) => (s === '__all' ? report.foodBev[t].sales : (report.foodBev[t].s[s] ?? 0));
                const sum = v('Food') + v('Beverage') + v('Other');
                const share = (t: FoodBev) => (sum ? (v(t) / sum) * 100 : 0);
                return (
                  <tr key={s} className={s === '__all' ? 'bg-slate-50 font-semibold' : ''}>
                    <Td>
                      <span className="flex items-center gap-2">
                        {s !== '__all' && <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorOf(s) }} />}
                        {s === '__all' ? 'All selected' : s}
                      </span>
                    </Td>
                    {(['Food', 'Beverage', 'Other'] as FoodBev[]).map((t) => (
                      <Td key={t} right>
                        {rmCompact(v(t))} <span className="text-slate-400">({share(t).toFixed(0)}%)</span>
                      </Td>
                    ))}
                    <Td>
                      <div className="flex h-2.5 w-40 overflow-hidden rounded-full bg-slate-100">
                        {(['Food', 'Beverage', 'Other'] as FoodBev[]).map((t) => (
                          <div key={t} style={{ width: `${Math.max(0, share(t))}%`, background: FB_COLORS[t] }} />
                        ))}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          {report.foodBev.Other.sales > total * 0.05 && (
            <p className="mt-2 text-[11px] text-amber-700">
              "Other" covers items that are neither food nor drink (merchandise, tours, venue hire) or items with no
              category in the file. You can set a category's type in Settings.
            </p>
          )}
        </Card>
      </div>

      <Card
        title="Sales by category"
        subtitle={group === 'pos' ? 'Point of Sale categories from Odoo · click a bar to filter the whole report to it' : 'Odoo internal Product Categories'}
        actions={
          <>
            <Segmented value={group} onChange={setGroup} options={[{ value: 'pos', label: 'POS category' }, { value: 'product', label: 'Product category' }]} />
            <Segmented value={topN} onChange={setTopN} options={[{ value: '15', label: 'Top 15' }, { value: '30', label: 'Top 30' }, { value: 'all', label: 'All' }]} />
            <SmallButton onClick={exportCsv}><Download className="h-3.5 w-3.5" /> CSV</SmallButton>
          </>
        }
      >
        <div style={{ height: Math.max(200, chartData.length * 28 + 50) }}>
          <ResponsiveContainer>
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} onClick={(st) => {
              const p = st?.activePayload?.[0]?.payload as { name?: string } | undefined;
              if (p?.name) onSearch(p.name);
            }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
              <XAxis type="number" tickFormatter={rmCompact} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="label" width={220} tick={{ fontSize: 10 }} interval={0} />
              <Tooltip
                cursor={{ fill: '#f1f5f9' }}
                content={(p) => (
                  <ChartTooltip
                    {...(p as object)}
                    valueFormatter={(v) => rm(v, 0)}
                    footer={(l) => {
                      const r = chartData.find((d) => d.label === l);
                      return r ? <span>Total: <b>{rm(+r.total, 0)}</b> ({total ? ((+r.total / total) * 100).toFixed(1) : 0}%)</span> : null;
                    }}
                  />
                )}
              />
              {multi && <Legend wrapperStyle={{ fontSize: 12 }} />}
              {multi
                ? report.series.map((s) => <Bar key={s} dataKey={s} name={s} stackId="c" fill={colorOf(s)} className="cursor-pointer" />)
                : <Bar dataKey="total" name="Sales" fill={colorOf(report.series[0] ?? '')} radius={[0, 3, 3, 0]} className="cursor-pointer" />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Category table" subtitle={`${rows.length} categories`}>
        <div className="max-h-[560px] overflow-auto">
          <Table>
            <thead>
              <tr>
                <Th>Category</Th>
                <Th>Type</Th>
                <Th right>Qty</Th>
                <Th right>Sales</Th>
                <Th right>Share</Th>
                {showLy && <Th right>Sales LY</Th>}
                {showLy && <Th right>vs LY</Th>}
                {multi && report.series.map((s) => <Th key={s} right>{s}</Th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.category} className="hover:bg-slate-50">
                  <Td className="max-w-96 truncate" title={c.category}>{c.category}</Td>
                  <Td><Badge tone={c.foodBev === 'Food' ? 'up' : c.foodBev === 'Beverage' ? 'neutral' : 'warn'}>{c.foodBev}</Badge></Td>
                  <Td right>{int(c.qty)}</Td>
                  <Td right className="font-semibold">{rm(c.sales, 0)}</Td>
                  <Td right>{total ? ((c.sales / total) * 100).toFixed(1) : 0}%</Td>
                  {showLy && <Td right>{prevMap.has(c.category) ? rm(prevMap.get(c.category)!, 0) : '—'}</Td>}
                  {showLy && <Td right><Delta value={pctChange(c.sales, prevMap.get(c.category) ?? 0)} /></Td>}
                  {multi && report.series.map((s) => <Td key={s} right className="text-slate-600">{c.s[s] ? rmCompact(c.s[s]) : '—'}</Td>)}
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
};
