import React from 'react';
import { DollarSign, Receipt, Users, ShoppingBag, TrendingUp } from 'lucide-react';
import type { AggregatedReport } from '../utils/aggregator';
import type { DatasetCapabilities } from '../types/pos';
import { formatInt, formatRM } from '../utils/formatters';

interface KpiCardsProps {
  report: AggregatedReport;
  capabilities: DatasetCapabilities;
}

export const KpiCards: React.FC<KpiCardsProps> = ({ report, capabilities }) => {
  const { mangga, indigo, total } = report.kpis;

  const cards = [
    {
      title: 'Total Sales',
      icon: DollarSign,
      totalVal: formatRM(total.sales),
      manggaVal: formatRM(mangga.sales),
      indigoVal: formatRM(indigo.sales),
      available: true,
    },
    {
      title: 'Transactions',
      icon: Receipt,
      totalVal: formatInt(total.transactions),
      manggaVal: capabilities.hasOrderLevelTransactions ? formatInt(mangga.transactions) : '—',
      indigoVal: capabilities.hasOrderLevelTransactions ? formatInt(indigo.transactions) : '—',
      available: capabilities.hasOrderLevelTransactions || Boolean(capabilities.totalPdfTransactions),
    },
    {
      title: 'Amount of Guests',
      icon: Users,
      totalVal: capabilities.hasGuests ? formatInt(total.guests) : 'CSV/XLSX Needed',
      manggaVal: capabilities.hasGuests ? formatInt(mangga.guests) : '—',
      indigoVal: capabilities.hasGuests ? formatInt(indigo.guests) : '—',
      available: capabilities.hasGuests,
    },
    {
      title: 'Items Sold (Qty)',
      icon: ShoppingBag,
      totalVal: formatInt(total.qty),
      manggaVal: formatInt(mangga.qty),
      indigoVal: formatInt(indigo.qty),
      available: true,
    },
    {
      title: 'Avg Ticket / Spend per Guest',
      icon: TrendingUp,
      totalVal: capabilities.hasOrderLevelTransactions ? formatRM(total.avgTicket) : '—',
      manggaVal:
        capabilities.hasGuests && mangga.guests > 0
          ? `${formatRM(mangga.avgSpendPerGuest)}/guest`
          : capabilities.hasOrderLevelTransactions
            ? formatRM(mangga.avgTicket)
            : '—',
      indigoVal:
        capabilities.hasGuests && indigo.guests > 0
          ? `${formatRM(indigo.avgSpendPerGuest)}/guest`
          : capabilities.hasOrderLevelTransactions
            ? formatRM(indigo.avgTicket)
            : '—',
      available: capabilities.hasOrderLevelTransactions,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.title}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">{card.title}</span>
              <div className="rounded-lg bg-slate-100 p-1.5 text-slate-600">
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <div
              className={`mt-2 text-xl font-bold ${
                card.available ? 'text-slate-900' : 'text-amber-600 text-sm'
              }`}
            >
              {card.totalVal}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px]">
              <span className="font-medium text-emerald-700">
                Mangga: <span className="font-semibold">{card.manggaVal}</span>
              </span>
              <span className="font-medium text-indigo-700">
                Indigo: <span className="font-semibold">{card.indigoVal}</span>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
