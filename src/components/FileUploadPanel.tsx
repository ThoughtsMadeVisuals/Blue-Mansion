import React, { useRef, useState } from 'react';
import {
  FileSpreadsheet,
  Sparkles,
  Upload,
} from 'lucide-react';

interface FileUploadPanelProps {
  onFilesSelected: (files: FileList) => void;
  onLoadSample: () => void;
  isLoading: boolean;
  compact?: boolean;
}

export const FileUploadPanel: React.FC<FileUploadPanelProps> = ({
  onFilesSelected,
  onLoadSample,
  isLoading,
  compact = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(e.dataTransfer.files);
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`rounded-2xl border-2 border-dashed transition-all ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50/70'
            : 'border-slate-300 bg-white hover:border-slate-400'
        } ${compact ? 'p-4' : 'p-8 text-center'}`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".csv,.xlsx,.xls,.pdf"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onFilesSelected(e.target.files);
              e.target.value = '';
            }
          }}
        />

        <div
          className={
            compact
              ? 'flex flex-wrap items-center justify-between gap-4'
              : 'flex flex-col items-center gap-3'
          }
        >
          <div className={compact ? 'flex items-center gap-3' : 'flex flex-col items-center gap-2'}>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Upload className="h-5 w-5" />
            </div>
            <div className={compact ? 'text-left' : 'text-center'}>
              <h3 className="text-base font-semibold text-slate-900">
                {isLoading
                  ? 'Parsing Odoo POS file...'
                  : 'Upload Odoo POS Exports (.xlsx, .csv, or Sales_Details.pdf)'}
              </h3>
              <p className="text-xs text-slate-500">
                100% local in your browser — no data is uploaded to any server.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Choose File(s)
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={onLoadSample}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className="h-4 w-4 text-amber-500" />
              Load Sample Demo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
