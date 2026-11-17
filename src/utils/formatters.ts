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

function cleanCategoryPart(part: string): string {
  const cleaned = part
    .replace(/\((?:m-alm|m|mangga|tbm|new|day|dinner|indigo|the bar)\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Convert ALL CAPS words (>2 chars) into Title Case for cleaner readability
  if (cleaned === cleaned.toUpperCase() && /[A-Z]{3,}/.test(cleaned)) {
    return cleaned
      .toLowerCase()
      .replace(/\b[a-z]/g, (ch) => ch.toUpperCase());
  }
  return cleaned;
}

/**
 * Shortens hierarchical Odoo POS category breadcrumbs
 * e.g. "Mangga All Day (New) / ALL DAY DINING (M-ALM) / BIG PLATES (M-ALM)"
 *   -> "All Day Dining · Big Plates" or "Big Plates"
 */
export function formatShortCategory(rawCategory: string, maxLen = 28): string {
  if (!rawCategory) return 'Uncategorized';

  const parts = rawCategory
    .split('/')
    .map((p) => cleanCategoryPart(p))
    .filter(Boolean);

  if (parts.length === 0) return rawCategory.trim();

  let display: string;
  if (parts.length === 1) {
    display = parts[0];
  } else {
    const last = parts[parts.length - 1];
    const prev = parts[parts.length - 2]
      .replace(/^mangga\s+/i, '')
      .replace(/^indigo\s+/i, '')
      .trim();

    if (!prev || prev.toLowerCase() === last.toLowerCase()) {
      display = last;
    } else {
      const combined = `${prev} · ${last}`;
      display = combined.length <= maxLen ? combined : last;
    }
  }

  if (display.length > maxLen) {
    return `${display.slice(0, maxLen - 1).trimEnd()}…`;
  }
  return display;
}
