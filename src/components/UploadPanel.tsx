import React, { useRef, useState } from 'react';
import { FileSpreadsheet, Loader2, Upload } from 'lucide-react';

export const UploadPanel: React.FC<{
  onFiles: (files: File[]) => void;
  busy: string | null;
  compact: boolean;
}> = ({ onFiles, busy, compact }) => {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        if (e.dataTransfer.files.length) onFiles(Array.from(e.dataTransfer.files));
      }}
      className={`rounded-2xl border-2 border-dashed bg-white transition print:hidden ${
        drag ? 'border-indigo-500 bg-indigo-50/60' : 'border-slate-300'
      } ${compact ? 'px-4 py-3' : 'px-6 py-10 text-center'}`}
    >
      <input
        ref={ref}
        type="file"
        multiple
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(Array.from(e.target.files));
          e.target.value = '';
        }}
      />
      {compact ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <FileSpreadsheet className="h-4 w-4 text-slate-400" />
            Drop more Odoo exports here (another year or month) to add them. Orders already loaded are skipped automatically.
          </div>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => ref.current?.click()}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {busy ?? 'Add files'}
          </button>
        </div>
      ) : (
        <div className="mx-auto max-w-xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
          </div>
          <h2 className="text-base font-semibold text-slate-900">{busy ?? 'Upload your Odoo POS order exports'}</h2>
          <p className="mt-2 text-sm text-slate-500">
            Drag in one or more <b>.xlsx</b> or <b>.csv</b> files (for example 2025 and 2026). Everything is processed
            on this computer and nothing is uploaded to the internet.
          </p>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => ref.current?.click()}
            className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            <Upload className="h-4 w-4" /> Choose files
          </button>
          <div className="mt-6 rounded-xl bg-slate-50 p-4 text-left text-xs text-slate-600">
            <div className="mb-1 font-semibold text-slate-700">Columns to include in the Odoo export</div>
            Order Ref · Date · Point of Sale · Receipt Number · Status · Guests · Total · Order Lines/Product ·
            Order Lines/Quantity · Order Lines/Tax Excl. · Order Lines/Tax Incl. · Order Lines/Product/Point of Sale
            Category · Order Lines/Product/Product Category
          </div>
        </div>
      )}
    </div>
  );
};
