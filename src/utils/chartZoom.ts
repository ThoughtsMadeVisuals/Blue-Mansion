export interface ZoomRange {
  start: number;
  end: number;
}

const MIN_VISIBLE_ITEMS = 3;

export function getFullRange(totalLength: number): ZoomRange {
  if (totalLength <= 0) return { start: 0, end: 0 };
  return { start: 0, end: totalLength - 1 };
}

export function clampRange(range: ZoomRange, totalLength: number): ZoomRange {
  if (totalLength <= 0) return { start: 0, end: 0 };
  const maxIndex = totalLength - 1;
  const start = Math.max(0, Math.min(range.start, maxIndex));
  const end = Math.max(start, Math.min(range.end, maxIndex));
  return { start, end };
}

export function computeZoomedRange(
  current: ZoomRange,
  totalLength: number,
  direction: 'in' | 'out',
  anchorRatio = 0.5
): ZoomRange {
  if (totalLength <= MIN_VISIBLE_ITEMS) {
    return getFullRange(totalLength);
  }

  const clamped = clampRange(current, totalLength);
  const currentCount = clamped.end - clamped.start + 1;
  const factor = 0.7;

  const nextCount =
    direction === 'in'
      ? Math.max(MIN_VISIBLE_ITEMS, Math.floor(currentCount * factor))
      : Math.min(totalLength, Math.ceil(currentCount / factor));

  if (nextCount === currentCount) {
    if (direction === 'in' && currentCount > MIN_VISIBLE_ITEMS) {
      return computeWindowAroundAnchor(clamped, totalLength, currentCount - 1, anchorRatio);
    }
    if (direction === 'out' && currentCount < totalLength) {
      return computeWindowAroundAnchor(clamped, totalLength, currentCount + 1, anchorRatio);
    }
    return clamped;
  }

  return computeWindowAroundAnchor(clamped, totalLength, nextCount, anchorRatio);
}

function computeWindowAroundAnchor(
  clamped: ZoomRange,
  totalLength: number,
  nextCount: number,
  anchorRatio: number
): ZoomRange {
  const ratio = Math.max(0, Math.min(1, anchorRatio));
  const currentCount = clamped.end - clamped.start + 1;
  const anchorIndex = clamped.start + ratio * (currentCount - 1);

  let start = Math.round(anchorIndex - ratio * (nextCount - 1));
  let end = start + nextCount - 1;

  if (start < 0) {
    start = 0;
    end = Math.min(totalLength - 1, nextCount - 1);
  }
  if (end >= totalLength) {
    end = totalLength - 1;
    start = Math.max(0, end - nextCount + 1);
  }

  return { start, end };
}

export function computePannedRange(
  current: ZoomRange,
  totalLength: number,
  deltaItems: number
): ZoomRange {
  if (totalLength <= 0) return { start: 0, end: 0 };
  const clamped = clampRange(current, totalLength);
  const windowSize = clamped.end - clamped.start + 1;
  if (windowSize >= totalLength) return getFullRange(totalLength);

  let start = clamped.start + deltaItems;
  if (start < 0) start = 0;
  if (start + windowSize > totalLength) {
    start = totalLength - windowSize;
  }

  return { start, end: start + windowSize - 1 };
}
