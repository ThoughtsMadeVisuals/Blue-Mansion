import React, { useMemo } from 'react';
import { Clock, CalendarDays, DollarSign, Receipt, ShoppingBag, Star, TrendingUp, Users } from 'lucide-react';
import { avgTicket, dowOf, spendPerGuest } from '../lib/aggregate';
import { DOWS_LONG, hourRange, int, longDate, monthLabel, pctChange, rm, shortCategory } from '../lib/format';
import type { ViewContext } from '../lib/metrics';
import type { Holiday } from '../types';
import { Card, Delta, Table, Td, Th } from './ui';

export const Overview: React.FC<{ ctx: ViewContext; holidays: Holiday[]; onGoto: (tab: string) => void }> = ({
  ctx,
  holidays,
  onGoto,
}) => {
  const { report, prev, prevComplete, colorOf } = ctx;
  const k = report.kpi.total;
  const p = prevComplete && prev ? prev.kpi.total : null;
  const lyWarning = useMemo(() => {
    if (!p || !prev) return null;
    const yearsOf = (keys: Iterable<string>) => new Set(Array.from(keys, (d) => d.slice(0, 4)));
    const inScope = (x: string) => !ctx.selectedPos.length || ctx.selectedPos.includes(x);
    const posOf = (ys: Set<string>) => new Set(Array.from(ys).flatMap((y) => ctx.posByYear[y] ?? []).filter(inScope));
    const cur = posOf(yearsOf(report.daily.keys()));
    const old = posOf(yearsOf(prev.daily.keys()));
    const common = Array.from(cur).filter((x) => old.has(x));
    if (common.length === cur.size && common.length === old.size) return null;
    return { common, onlyOld: Array.from(old).filter((x) => !cur.has(x)), onlyCur: Array.from(cur).filter((x) => !old.has(x)) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p, prev, report, ctx.posByYear, ctx.selectedPos]);
  const yoy = (cur: number, pv: number | undefined) => (p && pv !== undefined ? pctChange(cur, pv) : null);

  const cards = [
    { title: 'Total sales', icon: DollarSign, value: rm(k.sales, 0), d: yoy(k.sales, p?.sales), sub: p ? `Last year ${rm(p.sales, 0)}` : '' },
    { title: 'Transactions', icon: Receipt, value: int(k.tx), d: yoy(k.tx, p?.tx), sub: 'Receipts (excl. refunds)' },
    { title: 'Guests', icon: Users, value: int(k.guests), d: yoy(k.guests, p?.guests), sub: k.tx ? `${(k.guests / k.tx).toFixed(2)} guests per receipt` : '' },
    { title: 'Avg ticket', icon: TrendingUp, value: rm(avgTicket(k)), d: p ? pctChange(avgTicket(k), avgTicket(p)) : null, sub: 'Sales ÷ transactions' },
    { title: 'Spend per guest', icon: Users, value: rm(spendPerGuest(k)), d: p ? pctChange(spendPerGuest(k), spendPerGuest(p)) : null, sub: 'Orders with guests recorded' },
    { title: 'Items sold', icon: ShoppingBag, value: int(k.qty), d: yoy(k.qty, p?.qty), sub: `${int(report.items.length)} different items` },
  ];

  const highlights = useMemo(() => {
    const hol = new Map(holidays.map((h) => [h.date, h.name]));
    let bestMonth: [string, number] | null = null;
    for (const [m, b] of report.monthly) if (!bestMonth || b.total.sales > bestMonth[1]) bestMonth = [m, b.total.sales];
    let bestDay: [string, number] | null = null;
    const dowSum = Array(7).fill(0);
    const dowCnt = Array(7).fill(0);
    for (const [d, b] of report.daily) {
      if (!bestDay || b.total.sales > bestDay[1]) bestDay = [d, b.total.sales];
      const w = dowOf(d);
      dowSum[w] += b.total.sales;
      dowCnt[w] += 1;
    }
    const dowAvg = dowSum.map((s, i) => (dowCnt[i] ? s / dowCnt[i] : 0));
    const bestDow = dowAvg.indexOf(Math.max(...dowAvg));
    const days = report.daily.size || 1;
    let bestHour = 0;
    report.hourly.forEach((h, i) => {
      if (h.total.sales > report.hourly[bestHour].total.sales) bestHour = i;
    });
    return { bestMonth, bestDay, bestDayHoliday: bestDay ? hol.get(bestDay[0]) : undefined, bestDow, dowAvg, bestHour, days };
  }, [report, holidays]);

  const topFood = report.items.filter((i) => i.foodBev === 'Food' && i.sales > 0.005).sort((a, b) => b.qty - a.qty).slice(0, 5);
  const topBev = report.items.filter((i) => i.foodBev === 'Beverage' && i.sales > 0.005).sort((a, b) => b.qty - a.qty).slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <div key={c.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500">
              {c.title}
              <c.icon className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-1.5 text-xl font-bold tracking-tight text-slate-900">{c.value}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
              <Delta value={c.d} label="vs LY" />
              <span>{c.sub}</span>
            </div>
          </div>
        ))}
      </div>
      {lyWarning && (
        <div className="-mt-1 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <span>
            "vs LY" is not like-for-like:
            {lyWarning.onlyOld.length > 0 && <> last year also includes {lyWarning.onlyOld.join(', ')}</>}
            {lyWarning.onlyOld.length > 0 && lyWarning.onlyCur.length > 0 && ';'}
            {lyWarning.onlyCur.length > 0 && <> this period also includes {lyWarning.onlyCur.join(', ')}</>}.
          </span>
          {lyWarning.common.length > 0 && (
            <button type="button" onClick={() => ctx.setPos(lyWarning.common)} className="cursor-pointer rounded-lg bg-amber-600 px-3 py-1.5 font-medium text-white hover:bg-amber-700">
              Compare only {lyWarning.common.join(', ')}
            </button>
          )}
        </div>
      )}
      {!prevComplete && (
        <p className="-mt-2 text-[11px] text-slate-500">
          "vs LY" (last year) comparisons appear when the same dates one year earlier are fully covered by the uploaded
          files. Pick a single year (e.g. 2026) or a date range to see them.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Highlight
          icon={CalendarDays}
          title="Best month"
          value={highlights.bestMonth ? monthLabel(highlights.bestMonth[0]) : '—'}
          sub={highlights.bestMonth ? rm(highlights.bestMonth[1], 0) : ''}
          onClick={() => onGoto('monthly')}
        />
        <Highlight
          icon={Star}
          title="Best single day"
          value={highlights.bestDay ? longDate(highlights.bestDay[0]) : '—'}
          sub={
            highlights.bestDay
              ? `${rm(highlights.bestDay[1], 0)}${highlights.bestDayHoliday ? ` · ${highlights.bestDayHoliday}` : ''}`
              : ''
          }
          onClick={() => onGoto('daily')}
        />
        <Highlight
          icon={CalendarDays}
          title="Best day of the week"
          value={DOWS_LONG[highlights.bestDow]}
          sub={`${rm(highlights.dowAvg[highlights.bestDow], 0)} average per day`}
          onClick={() => onGoto('daily')}
        />
        <Highlight
          icon={Clock}
          title="Best hour"
          value={hourRange(highlights.bestHour)}
          sub={`${rm(report.hourly[highlights.bestHour].total.sales / highlights.days, 0)} average per trading day`}
          onClick={() => onGoto('hours')}
        />
      </div>

      <Card
        title="Outlet comparison"
        subtitle={`${ctx.periodLabel}${p ? ' · compared with the same dates last year' : ''}`}
      >
        <Table>
          <thead>
            <tr>
              <Th>Outlet</Th>
              <Th right>Sales</Th>
              <Th right>Share</Th>
              {p && <Th right>Sales LY</Th>}
              {p && <Th right>vs LY</Th>}
              <Th right>Transactions</Th>
              <Th right>Guests</Th>
              <Th right>Avg ticket</Th>
              <Th right>Spend / guest</Th>
              <Th right>Items sold</Th>
            </tr>
          </thead>
          <tbody>
            {report.series.map((s) => {
              const m = report.kpi.s[s];
              const pm = p ? prev!.kpi.s[s] : undefined;
              return (
                <tr key={s} className="hover:bg-slate-50">
                  <Td>
                    <span className="flex items-center gap-2 font-medium text-slate-800">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorOf(s) }} />
                      {s}
                    </span>
                  </Td>
                  <Td right className="font-semibold">{rm(m.sales, 0)}</Td>
                  <Td right>{k.sales ? ((m.sales / k.sales) * 100).toFixed(1) : '0'}%</Td>
                  {p && <Td right>{pm ? rm(pm.sales, 0) : '—'}</Td>}
                  {p && (
                    <Td right>
                      <Delta value={pm ? pctChange(m.sales, pm.sales) : null} />
                    </Td>
                  )}
                  <Td right>{int(m.tx)}</Td>
                  <Td right>{int(m.guests)}</Td>
                  <Td right>{rm(avgTicket(m))}</Td>
                  <Td right>{m.guests ? rm(spendPerGuest(m)) : '—'}</Td>
                  <Td right>{int(m.qty)}</Td>
                </tr>
              );
            })}
            <tr className="bg-slate-50 font-semibold">
              <Td>All selected</Td>
              <Td right>{rm(k.sales, 0)}</Td>
              <Td right>100%</Td>
              {p && <Td right>{rm(p.sales, 0)}</Td>}
              {p && (
                <Td right>
                  <Delta value={pctChange(k.sales, p.sales)} />
                </Td>
              )}
              <Td right>{int(k.tx)}</Td>
              <Td right>{int(k.guests)}</Td>
              <Td right>{rm(avgTicket(k))}</Td>
              <Td right>{rm(spendPerGuest(k))}</Td>
              <Td right>{int(k.qty)}</Td>
            </tr>
          </tbody>
        </Table>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {[
          { title: 'Top 5 food (by quantity, paid items)', rows: topFood, color: '#059669' },
          { title: 'Top 5 beverages (by quantity, paid items)', rows: topBev, color: '#4f46e5' },
        ].map((blk) => (
          <Card
            key={blk.title}
            title={blk.title}
            actions={
              <button type="button" onClick={() => onGoto('items')} className="cursor-pointer text-xs text-indigo-600 hover:underline">
                See all items →
              </button>
            }
          >
            <ol className="space-y-2">
              {blk.rows.map((r, i) => (
                <li key={r.product} className="flex items-center gap-3 text-xs">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                    style={{ background: blk.color }}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-slate-800">{r.product}</div>
                    <div className="truncate text-[11px] text-slate-500">{shortCategory(r.category)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold tabular-nums">{int(r.qty)} sold</div>
                    <div className="text-[11px] tabular-nums text-slate-500">{rm(r.sales, 0)}</div>
                  </div>
                </li>
              ))}
              {!blk.rows.length && <li className="text-xs text-slate-400">No items for this filter.</li>}
            </ol>
          </Card>
        ))}
      </div>
    </div>
  );
};

const Highlight: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
  sub: string;
  onClick: () => void;
}> = ({ icon: Icon, title, value, sub, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="cursor-pointer rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 text-left shadow-sm hover:border-indigo-300"
  >
    <div className="flex items-center gap-2 text-xs text-slate-500">
      <Icon className="h-4 w-4 text-indigo-500" />
      {title}
    </div>
    <div className="mt-1.5 text-base font-bold text-slate-900">{value}</div>
    <div className="mt-0.5 text-xs text-slate-500">{sub}</div>
  </button>
);
