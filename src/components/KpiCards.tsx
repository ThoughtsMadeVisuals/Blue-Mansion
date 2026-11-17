import React from 'react';
import { DollarSign, Receipt, Users, ShoppingBag, TrendingUp } from 'lucide-react';
import type { AggregatedReport } from '../utils/aggregator';
import type { DatasetCapabilities } from '../types/pos';
import { formatInt, formatRM } from '../utils/formatters';

interface KpiCardsProps {
  report: AggregatedReport;
  capabilities: DatasetCapabilities;
  outletLabel: string;
}

export const KpiCards: React.FC<KpiCardsProps> = ({
  report,
  capabilities,
  outletLabel,
}) => {
  const { total } = report.kpis;

  const cards = [
    {
      title: 'Total Sales',
      icon: DollarSign,
      value: formatRM(total.sales),
      subtext: `${outletLabel} revenue`,
      available: true,
    },
    {
      title: 'Transactions',
      icon: Receipt,
      value: formatInt(total.transactions),
      subtext: capabilities.hasOrderLevelTransactions
        ? 'Distinct POS orders'
        : 'Combined PDF total',
      available:
        capabilities.hasOrderLevelTransactions ||
        Boolean(capabilities.totalPdfTransactions),
    },
    {
      title: 'Amount of Guests',
      icon: Users,
      value: capabilities.hasGuests ? formatInt(total.guests) : 'CSV/XLSX Needed',
      subtext:
        capabilities.hasGuests && total.transactions > 0
          ? `${(total.guests / total.transactions).toFixed(1)} avg guests / order`
          : 'Total covers served',
      available: capabilities.hasGuests,
    },
    {
      title: 'Items Sold (Qty)',
      icon: ShoppingBag,
      value: formatInt(total.qty),
      subtext: `${report.salesByItem.length} unique menu items`,
      available: true,
    },
    {
      title: 'Avg Ticket / Guest Spend',
      icon: TrendingUp,
      value: capabilities.hasOrderLevelTransactions ? formatRM(total.avgTicket) : '—',
      subtext:
        capabilities.hasGuests && total.guests > 0
          ? `${formatRM(total.avgSpendPerGuest)} per guest`
          : 'Average per transaction',
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
              className={`mt-2 text-2xl font-bold tracking-tight ${
                card.available ? 'text-slate-900' : 'text-amber-600 text-sm'
              }`}
            >
              {card.value}
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">{card.subtext}</p>
          </div>
        );
      })}
    </div>
  );
};
