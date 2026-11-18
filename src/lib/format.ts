export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const DOWS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DOWS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function rm(v: number, decimals = 2): string {
  return `RM ${v.toLocaleString('en-MY', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function rmCompact(v: number): string {
  const a = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (a >= 1_000_000) return `${sign}RM ${(a / 1_000_000).toFixed(2)}M`;
  if (a >= 10_000) return `${sign}RM ${(a / 1_000).toFixed(0)}k`;
  if (a >= 1_000) return `${sign}RM ${(a / 1_000).toFixed(1)}k`;
  return `${sign}RM ${a.toFixed(0)}`;
}

export function int(v: number): string {
  return Math.round(v).toLocaleString('en-MY');
}

export function num(v: number, d = 1): string {
  return v.toLocaleString('en-MY', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function pctChange(cur: number, prev: number): number | null {
  if (!prev) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

export function pct(v: number | null, d = 1): string {
  if (v === null || !Number.isFinite(v)) return '—';
  return `${v > 0 ? '+' : ''}${v.toFixed(d)}%`;
}

export function shortDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${String(y).slice(2)}`;
}

export function longDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DOWS[dow]}, ${d} ${MONTHS[m - 1]} ${y}`;
}

export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function hourLabel(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

export function hourRange(h: number): string {
  const f = (x: number) => {
    const hh = x % 24;
    const ap = hh < 12 ? 'am' : 'pm';
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    return `${h12}${ap}`;
  };
  return `${f(h)}–${f(h + 1)}`;
}

function cleanPart(part: string): string {
  const c = part
    .replace(/\((?:m-alm|m|mangga|tbm|new|day|dinner|indigo|the bar)\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (c === c.toUpperCase() && /[A-Z]{3,}/.test(c)) {
    return c.toLowerCase().replace(/\b[a-z]/g, (ch) => ch.toUpperCase());
  }
  return c;
}

/** "Mangga All Day (New) / ALL DAY DINING (M-ALM) / BIG PLATES (M-ALM)" -> "All Day Dining · Big Plates" */
export function shortCategory(raw: string, maxLen = 34): string {
  if (!raw) return 'Uncategorized';
  const parts = raw.split('/').map(cleanPart).filter(Boolean);
  if (!parts.length) return raw.trim();
  let out = parts[parts.length - 1];
  if (parts.length > 1) {
    const prev = parts[parts.length - 2].replace(/^(mangga|indigo)\s+/i, '').trim();
    if (prev && prev.toLowerCase() !== out.toLowerCase()) {
      const combined = `${prev} · ${out}`;
      if (combined.length <= maxLen) out = combined;
    }
  }
  return out.length > maxLen ? `${out.slice(0, maxLen - 1).trimEnd()}…` : out;
}

const OUTLET_COLORS: Record<string, string> = {
  Mangga: '#059669',
  'Mangga (Day)': '#059669',
  'Mangga (Dinner)': '#65a30d',
  'The Bar': '#4f46e5',
  'Indigo Restaurant': '#0284c7',
  'Indigo at The Blue Mansion (Lunch)': '#0284c7',
  'Indigo at The Blue Mansion (Dinner)': '#1e40af',
  'Gift Shop': '#d97706',
  TCM: '#dc2626',
  QING: '#9333ea',
};
const FALLBACK = ['#0d9488', '#db2777', '#7c3aed', '#ca8a04', '#475569', '#ea580c'];

export function colorFor(name: string, index = 0): string {
  return OUTLET_COLORS[name] ?? FALLBACK[index % FALLBACK.length];
}

/** Newest year first. */
const YEAR_BY_AGE = ['#4f46e5', '#94a3b8', '#d97706', '#059669'];
export function yearColor(index: number, count: number): string {
  return YEAR_BY_AGE[(count - 1 - index) % YEAR_BY_AGE.length];
}
export const TOTAL_COLOR = '#0f172a';

export function downloadCsv(fileName: string, rows: (string | number)[][]): void {
  const csv = rows
    .map((r) => r.map((v) => (typeof v === 'number' ? String(Math.round(v * 100) / 100) : `"${String(v).replace(/"/g, '""')}"`)).join(','))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
