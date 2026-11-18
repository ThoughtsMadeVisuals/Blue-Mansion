import React from 'react';

export const Card: React.FC<{
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, actions, className = '', children }) => (
  <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
    {(title || actions) && (
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {title && <h3 className="text-sm font-semibold text-slate-900">{title}</h3>}
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    )}
    {children}
  </section>
);

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'sm',
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  size?: 'sm' | 'xs';
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`cursor-pointer rounded-md font-medium transition ${
            size === 'xs' ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs'
          } ${value === o.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const Badge: React.FC<{ tone?: 'up' | 'down' | 'neutral' | 'warn'; children: React.ReactNode }> = ({
  tone = 'neutral',
  children,
}) => {
  const cls =
    tone === 'up'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : tone === 'down'
        ? 'bg-rose-50 text-rose-700 border-rose-200'
        : tone === 'warn'
          ? 'bg-amber-50 text-amber-800 border-amber-200'
          : 'bg-slate-50 text-slate-600 border-slate-200';
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {children}
    </span>
  );
};

export const Delta: React.FC<{ value: number | null; label?: string }> = ({ value, label }) => {
  if (value === null || !Number.isFinite(value)) return null;
  const tone = value > 0.05 ? 'up' : value < -0.05 ? 'down' : 'neutral';
  return (
    <Badge tone={tone}>
      {value > 0 ? '▲' : value < 0 ? '▼' : ''} {Math.abs(value).toFixed(1)}%{label ? ` ${label}` : ''}
    </Badge>
  );
};

export const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
    {children}
  </div>
);

export const SmallButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', ...p }) => (
  <button
    type="button"
    {...p}
    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 ${className}`}
  />
);

/** Recharts tooltip with series sorted by value. */
export const ChartTooltip: React.FC<{
  active?: boolean;
  payload?: { name: string; value: number; color: string; dataKey: string }[];
  label?: string | number;
  labelFormatter?: (l: string | number) => string;
  valueFormatter: (v: number) => string;
  footer?: (label: string | number) => React.ReactNode;
}> = ({ active, payload, label, labelFormatter, valueFormatter, footer }) => {
  if (!active || !payload?.length || label === undefined) return null;
  const items = payload.filter((p) => p.value !== null && p.value !== undefined);
  return (
    <div className="max-w-xs rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold text-slate-800">{labelFormatter ? labelFormatter(label) : label}</div>
      {items.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-medium tabular-nums text-slate-900">{valueFormatter(p.value)}</span>
        </div>
      ))}
      {footer && <div className="mt-1 border-t border-slate-100 pt-1">{footer(label)}</div>}
    </div>
  );
};

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-max text-left text-xs">{children}</table>
    </div>
  );
}

export const Th: React.FC<React.ThHTMLAttributes<HTMLTableCellElement> & { right?: boolean }> = ({
  right,
  className = '',
  ...p
}) => (
  <th
    {...p}
    className={`sticky top-0 bg-slate-50 px-3 py-2 font-semibold text-slate-600 ${right ? 'text-right' : ''} ${className}`}
  />
);

export const Td: React.FC<React.TdHTMLAttributes<HTMLTableCellElement> & { right?: boolean }> = ({
  right,
  className = '',
  ...p
}) => <td {...p} className={`border-t border-slate-100 px-3 py-1.5 ${right ? 'text-right tabular-nums' : ''} ${className}`} />;
