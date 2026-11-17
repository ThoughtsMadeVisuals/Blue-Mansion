import * as pdfjsLib from 'pdfjs-dist';
import type {
  MappingRules,
  ParsedDataset,
  PdfDailySessionRow,
  PdfPaymentSummary,
  PosOrderLine,
} from '../types/pos';
import { inferFoodBev, inferOutletFromHeuristics } from '../utils/defaultMappings';

// Configure worker for browser Vite bundle
if (typeof window !== 'undefined' && 'Worker' in window) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
}

function parseRm(str: string): number {
  const cleaned = str.replace(/rm/gi, '').replace(/,/g, '').trim();
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

export function parseSalesDetailsTextLines(
  textLines: string[],
  fileName: string,
  rules: MappingRules
): ParsedDataset {
  const lines: PosOrderLine[] = [];
  const pdfPayments: PdfPaymentSummary[] = [];
  const pdfDailySessions: PdfDailySessionRow[] = [];
  const warnings: string[] = [];

  let section: 'header' | 'sales' | 'taxes' | 'payments' | 'sessions' = 'header';
  let currentCategory = 'Uncategorized';
  let totalPdfTransactions: number | undefined;
  let dateRangeLabel: string | undefined;

  const paymentTotalsMap = new Map<string, number>();

  for (let i = 0; i < textLines.length; i++) {
    const line = textLines[i].trim();
    if (!line) continue;

    // Detect date range in header
    if (!dateRangeLabel) {
      const rangeMatch = line.match(
        /(\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM)?\s*-\s*\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM)?)/i
      );
      if (rangeMatch) {
        dateRangeLabel = rangeMatch[1];
      }
    }

    // Section transitions
    if (/^Sales$/i.test(line)) {
      section = 'sales';
      continue;
    }
    if (/^Taxes on sales$/i.test(line)) {
      section = 'taxes';
      continue;
    }
    if (/^Payments$/i.test(line)) {
      section = 'payments';
      continue;
    }
    if (/^Session Control$/i.test(line)) {
      section = 'sessions';
      continue;
    }

    const txMatch = line.match(/Number of transactions:\s*(\d+)/i);
    if (txMatch) {
      totalPdfTransactions = Number(txMatch[1]);
      continue;
    }

    if (section === 'sales') {
      // Skip table headers & total lines
      if (
        /^(Product|Quantity|Price|Total|Sales|Page \d+|Config names|As of )/i.test(line)
      ) {
        continue;
      }

      // Match item line: "<Product Name> [Disc: X%] <Qty> RM<Amount>" or "<Product> <Qty> RM<Amount>"
      const itemMatch = line.match(
        /^(.+?)\s+(\d+(?:\.\d+)?)\s+(?:-?RM\s*[\d,]+\.\d{2}|\(?RM\s*[\d,]+\.\d{2}\)?)(?:\s+.*)?$/i
      );
      const rmMatch = line.match(/(RM\s*-?[\d,]+\.\d{2})/i);

      if (itemMatch && rmMatch) {
        let product = itemMatch[1].trim();
        let discountPct: number | undefined;
        const discMatch = product.match(/Disc:\s*(\d+(?:\.\d+)?)%/i);
        if (discMatch) {
          discountPct = Number(discMatch[1]);
          product = product.replace(/Disc:\s*\d+(?:\.\d+)?%/i, '').trim();
        }
        const qty = Number(itemMatch[2]);
        const subtotal = parseRm(rmMatch[1]);

        if (
          product.toLowerCase() === 'total' ||
          product.toLowerCase().startsWith('total ')
        ) {
          continue;
        }

        const outlet = inferOutletFromHeuristics(currentCategory, product, rules);
        const foodBev = inferFoodBev(currentCategory, product, rules);

        lines.push({
          id: `${fileName}-pdf-${i}`,
          orderRef: `PDF-SUMMARY-${i}`,
          orderDate: null,
          dateKey: null,
          hour: null,
          rawConfig: 'PDF Summary',
          subOutlet: 'Unknown',
          outlet,
          guests: null,
          product,
          category: currentCategory,
          foodBev,
          qty: Number.isFinite(qty) ? qty : 0,
          subtotal,
          discountPct,
          sourceType: 'pdf_summary',
        });
      } else if (!rmMatch && !/^\d+(\.\d+)?$/.test(line) && line.length < 80) {
        // Likely a category header line
        currentCategory = line;
      }
    } else if (section === 'payments' || section === 'sessions') {
      // Session row: "<Method> POS/YYYYMM/DD/NNNNN RM<Expected> RM<Counted> RM<Diff>"
      const sessionMatch = line.match(
        /^(.+?)\s+(POS\/(\d{4})(\d{2})\/(\d{2})\/\d+)\s+(RM\s*-?[\d,]+\.\d{2})\s+(RM\s*-?[\d,]+\.\d{2})\s+(RM\s*-?[\d,]+\.\d{2})$/i
      );
      if (sessionMatch) {
        const method = sessionMatch[1].trim();
        const sessionRef = sessionMatch[2];
        const dateKey = `${sessionMatch[3]}-${sessionMatch[4]}-${sessionMatch[5]}`;
        const expected = parseRm(sessionMatch[6]);
        const counted = parseRm(sessionMatch[7]);
        const difference = parseRm(sessionMatch[8]);

        pdfDailySessions.push({
          dateKey,
          paymentMethod: method,
          sessionRef,
          expected,
          counted,
          difference,
        });

        if (section === 'payments') {
          paymentTotalsMap.set(method, (paymentTotalsMap.get(method) ?? 0) + expected);
        }
      } else if (section === 'payments') {
        // Summary payment row like "Credit Card RM932,057.70"
        const paySummary = line.match(/^([A-Za-z0-9\s().-]+?)\s+(RM\s*-?[\d,]+\.\d{2})$/i);
        if (paySummary && !/total|discount|invoice/i.test(paySummary[1])) {
          const method = paySummary[1].trim();
          const amount = parseRm(paySummary[2]);
          if (!paymentTotalsMap.has(method)) {
            paymentTotalsMap.set(method, amount);
          }
        }
      }
    }
  }

  for (const [method, amount] of paymentTotalsMap.entries()) {
    pdfPayments.push({ method, amount });
  }

  warnings.push(
    'PDF Summary Mode: Odoo "Sales Details" PDFs do not include hourly timestamps or guest counts, and combine outlets into one report. Upload an Odoo POS Orders/Order Lines CSV or Excel export for exact hourly, daily item, guest, and per-outlet data.'
  );

  return {
    lines,
    pdfPayments,
    pdfDailySessions,
    capabilities: {
      hasHourly: false,
      hasDailyItems: false,
      hasDailyPayments: pdfDailySessions.length > 0,
      hasGuests: false,
      hasOrderLevelTransactions: false,
      totalPdfTransactions,
      dateRangeLabel,
      sourceFiles: [fileName],
    },
    fileSummaries: [
      {
        fileName,
        lineCount: lines.length,
        outlets: ['PDF Summary'],
        dateFrom: null,
        dateTo: null,
        hasHourly: false,
        hasGuests: false,
      },
    ],
    warnings,
  };
}

export async function parseSalesDetailsPdfFile(
  file: File,
  rules: MappingRules
): Promise<ParsedDataset> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const allLines: string[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    // Group text items by Y coordinate (rounded to 2pt) to reconstruct visual lines
    const rowsByY = new Map<number, { x: number; str: string }[]>();

    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const y = Math.round(item.transform[5] / 2) * 2;
      const x = item.transform[4];
      const bucket = rowsByY.get(y) ?? [];
      bucket.push({ x, str: item.str });
      rowsByY.set(y, bucket);
    }

    const sortedYs = Array.from(rowsByY.keys()).sort((a, b) => b - a);
    for (const y of sortedYs) {
      const tokens = rowsByY.get(y)!.sort((a, b) => a.x - b.x);
      const lineText = tokens.map((t) => t.str).join(' ').replace(/\s+/g, ' ').trim();
      if (lineText) allLines.push(lineText);
    }
  }

  return parseSalesDetailsTextLines(allLines, file.name, rules);
}
