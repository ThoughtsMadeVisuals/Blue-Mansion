import type { ParsedDataset, UploadedFileSummary } from '../types/pos';

/** Combine per-file datasets into the single dataset the report reads. */
export function combineFiles(files: ParsedDataset[]): ParsedDataset | null {
  if (files.length === 0) return null;
  const caps = files.map((f) => f.capabilities);
  const pdfTx = caps.reduce((acc, c) => acc + (c.totalPdfTransactions ?? 0), 0);
  return {
    lines: files.flatMap((f) => f.lines),
    pdfPayments: files.flatMap((f) => f.pdfPayments),
    pdfDailySessions: files.flatMap((f) => f.pdfDailySessions),
    capabilities: {
      hasHourly: caps.some((c) => c.hasHourly),
      hasDailyItems: caps.some((c) => c.hasDailyItems),
      hasDailyPayments: caps.some((c) => c.hasDailyPayments),
      hasGuests: caps.some((c) => c.hasGuests),
      hasOrderLevelTransactions: caps.some((c) => c.hasOrderLevelTransactions),
      totalPdfTransactions: pdfTx || undefined,
      dateRangeLabel: caps.find((c) => c.dateRangeLabel)?.dateRangeLabel,
      sourceFiles: caps.flatMap((c) => c.sourceFiles),
    },
    fileSummaries: files.flatMap((f) => f.fileSummaries ?? []),
    warnings: Array.from(new Set(files.flatMap((f) => f.warnings))),
  };
}

export function fileSummaryOf(file: ParsedDataset): UploadedFileSummary | undefined {
  return file.fileSummaries?.[0];
}

export async function hashFile(file: File): Promise<string | undefined> {
  try {
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return undefined;
  }
}

/** Fraction of a new file's orders that must already be loaded to call it the same file. */
export const SAME_FILE_THRESHOLD = 0.9;

export type DuplicateCheck =
  | { kind: 'new'; dataset: ParsedDataset }
  | { kind: 'same'; duplicateOf: string[]; overlap: number; total: number; reason: 'identical' | 'orders' | 'summary' }
  | { kind: 'partial'; dataset: ParsedDataset; duplicateOf: string[]; overlap: number; total: number };

function pdfSignature(ds: ParsedDataset): string | null {
  if (!ds.lines.every((l) => l.sourceType === 'pdf_summary') || ds.lines.length === 0) return null;
  const total = ds.lines.reduce((acc, l) => acc + l.subtotal, 0);
  return `${ds.lines.length}|${total.toFixed(2)}|${ds.capabilities.dateRangeLabel ?? ''}`;
}

/**
 * Compare a newly parsed file with the files already loaded.
 * - identical bytes, identical PDF summary, or >= 90% of its orders already
 *   loaded -> 'same' (the file should not be added)
 * - some orders already loaded -> 'partial' (those orders are removed)
 * - otherwise -> 'new'
 */
export function checkDuplicate(incoming: ParsedDataset, existing: ParsedDataset[]): DuplicateCheck {
  const incomingSummary = fileSummaryOf(incoming);

  if (incomingSummary?.contentHash) {
    const twin = existing.find((f) => fileSummaryOf(f)?.contentHash === incomingSummary.contentHash);
    if (twin) {
      return {
        kind: 'same',
        duplicateOf: [fileSummaryOf(twin)?.fileName ?? 'a loaded file'],
        overlap: incoming.lines.length,
        total: incoming.lines.length,
        reason: 'identical',
      };
    }
  }

  const sig = pdfSignature(incoming);
  if (sig) {
    const twin = existing.find((f) => pdfSignature(f) === sig);
    if (twin) {
      return {
        kind: 'same',
        duplicateOf: [fileSummaryOf(twin)?.fileName ?? 'a loaded file'],
        overlap: incoming.lines.length,
        total: incoming.lines.length,
        reason: 'summary',
      };
    }
    return { kind: 'new', dataset: incoming };
  }

  // Order-level comparison (CSV / Excel)
  const owner = new Map<string, string>();
  for (const f of existing) {
    const name = fileSummaryOf(f)?.fileName ?? 'a loaded file';
    for (const l of f.lines) {
      if (l.sourceType === 'csv_xlsx' && !owner.has(l.orderKey)) owner.set(l.orderKey, name);
    }
  }

  const incomingKeys = new Set(
    incoming.lines.filter((l) => l.sourceType === 'csv_xlsx').map((l) => l.orderKey)
  );
  if (incomingKeys.size === 0 || owner.size === 0) return { kind: 'new', dataset: incoming };

  const overlapKeys = new Set<string>();
  const duplicateOf = new Set<string>();
  for (const k of incomingKeys) {
    const name = owner.get(k);
    if (name) {
      overlapKeys.add(k);
      duplicateOf.add(name);
    }
  }

  if (overlapKeys.size === 0) return { kind: 'new', dataset: incoming };

  const total = incomingKeys.size;
  if (overlapKeys.size / total >= SAME_FILE_THRESHOLD) {
    return { kind: 'same', duplicateOf: [...duplicateOf], overlap: overlapKeys.size, total, reason: 'orders' };
  }

  const keptLines = incoming.lines.filter((l) => !overlapKeys.has(l.orderKey));
  const summaries = (incoming.fileSummaries ?? []).map((s) => ({
    ...s,
    lineCount: keptLines.length,
    duplicateOrdersSkipped: overlapKeys.size,
    duplicateOf: [...duplicateOf],
  }));
  return {
    kind: 'partial',
    dataset: { ...incoming, lines: keptLines, fileSummaries: summaries },
    duplicateOf: [...duplicateOf],
    overlap: overlapKeys.size,
    total,
  };
}
