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
