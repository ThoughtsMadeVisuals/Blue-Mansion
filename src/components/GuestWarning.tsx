import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { monthLabel } from '../lib/format';
import type { ViewContext } from '../lib/metrics';

/** Collapse ["2025-01","2025-02","2025-04"] into "Jan 2025 – Feb 2025, Apr 2025". */
function ranges(months: string[]): string {
  const out: string[] = [];
  let start = months[0];
  let prev = months[0];
  const next = (m: string) => {
    const [y, mo] = m.split('-').map(Number);
    return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
  };
  for (let i = 1; i <= months.length; i++) {
    const m = months[i];
    if (m && m === next(prev)) {
      prev = m;
      continue;
    }
    out.push(start === prev ? monthLabel(start) : `${monthLabel(start)} – ${monthLabel(prev)}`);
    start = m;
    prev = m;
  }
  return out.join(', ');
}

/** Warns when guest numbers in the current view are a default of 1 per receipt rather than real covers. */
export const GuestWarning: React.FC<{ ctx: ViewContext }> = ({ ctx }) => {
  const months = Array.from(ctx.report.monthly.keys());
  const items = Object.entries(ctx.guestIssues)
    .filter(([pos]) => !ctx.selectedPos.length || ctx.selectedPos.includes(pos))
    .map(([pos, ms]) => [pos, ms.filter((m) => months.includes(m))] as const)
    .filter(([, ms]) => ms.length > 0);
  if (!items.length) return null;
  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <b>Guest numbers may not be real covers.</b> In these months almost every receipt has exactly 1 guest, which
        usually means staff did not enter the number of guests:
        <ul className="mt-1 list-disc pl-5">
          {items.map(([pos, ms]) => (
            <li key={pos}>
              <b>{pos}</b>: {ranges(ms)}
            </li>
          ))}
        </ul>
        Guest totals and spend per guest for those months understate covers and overstate spend per guest.
      </div>
    </div>
  );
};
