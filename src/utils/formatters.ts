export function formatRM(value: number): string {
  return `RM ${value.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatCompactRM(value: number): string {
  if (value >= 1_000_000) return `RM ${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `RM ${(value / 1_000).toFixed(1)}k`;
  return `RM ${value.toFixed(0)}`;
}

export function formatInt(value: number): string {
  return Math.round(value).toLocaleString('en-MY');
}

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function formatShortDate(dateKey: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return dateKey;
  const monthIdx = Number(match[2]) - 1;
  const day = Number(match[3]);
  const month = SHORT_MONTHS[monthIdx];
  return month ? `${day} ${month}` : dateKey;
}
