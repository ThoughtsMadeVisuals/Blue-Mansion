import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  clampRange,
  computePannedRange,
  computeZoomedRange,
  getFullRange,
  type ZoomRange,
} from '../utils/chartZoom';

interface ZoomableChartSectionProps<T> {
  title: string;
  subtitle: string;
  data: T[];
  getLabel?: (item: T) => string;
  headerExtra?: React.ReactNode;
  heightClass?: string;
  emptyState?: React.ReactNode;
  children: (visibleData: T[], isExpanded: boolean) => React.ReactNode;
}

export function ZoomableChartSection<T>({
  title,
  subtitle,
  data,
  getLabel,
  headerExtra,
  heightClass = 'h-72',
  emptyState,
  children,
}: ZoomableChartSectionProps<T>) {
  const total = data.length;
  const [range, setRange] = useState<ZoomRange>(() => getFullRange(total));
  const [isExpanded, setIsExpanded] = useState(false);

  const inlineChartRef = useRef<HTMLDivElement>(null);
  const modalChartRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{
    startX: number;
    startRange: ZoomRange;
    width: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setRange(getFullRange(total));
  }, [total]);

  const effectiveRange = useMemo(() => clampRange(range, total), [range, total]);
  const visibleData = useMemo(
    () => (total > 0 ? data.slice(effectiveRange.start, effectiveRange.end + 1) : []),
    [data, effectiveRange.end, effectiveRange.start, total]
  );

  const visibleCount = visibleData.length;
  const isZoomed = total > 0 && visibleCount < total;
  const canZoomIn = total > 3 && visibleCount > 3;
  const canZoomOut = isZoomed;
  const zoomPercent = visibleCount > 0 ? Math.round((total / visibleCount) * 100) : 100;

  const handleZoom = useCallback(
    (direction: 'in' | 'out', anchorRatio = 0.5) => {
      setRange((prev) => computeZoomedRange(prev, total, direction, anchorRatio));
    },
    [total]
  );

  const handleReset = useCallback(() => {
    setRange(getFullRange(total));
  }, [total]);

  const handlePan = useCallback(
    (deltaItems: number) => {
      setRange((prev) => computePannedRange(prev, total, deltaItems));
    },
    [total]
  );

  // Close expanded modal on Escape
  useEffect(() => {
    if (!isExpanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsExpanded(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isExpanded]);

  // Attach non-passive wheel listener so pinch-to-zoom (Ctrl+wheel) or modal wheel zooms cleanly
  useEffect(() => {
    const el = isExpanded ? modalChartRef.current : inlineChartRef.current;
    if (!el || total <= 3) return;

    const onWheel = (e: WheelEvent) => {
      const shouldZoom = isExpanded ? Math.abs(e.deltaY) > 0 : e.ctrlKey || e.metaKey;
      if (!shouldZoom) return;

      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const anchorRatio =
        rect.width > 0 ? Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) : 0.5;
      handleZoom(e.deltaY < 0 ? 'in' : 'out', anchorRatio);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [handleZoom, isExpanded, total]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isZoomed || e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    dragStateRef.current = {
      startX: e.clientX,
      startRange: effectiveRange,
      width: rect.width,
    };
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.width <= 0) return;
    const dx = e.clientX - drag.startX;
    const itemsPerPixel = visibleCount / drag.width;
    const deltaItems = Math.round(-dx * itemsPerPixel);
    setRange(computePannedRange(drag.startRange, total, deltaItems));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current) return;
    dragStateRef.current = null;
    setIsDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const renderToolbar = (inModal: boolean) => {
    if (emptyState || total === 0) return null;
    return (
      <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 print:hidden">
        <button
          type="button"
          onClick={() => handleZoom('out')}
          disabled={!canZoomOut}
          title="Zoom out"
          aria-label="Zoom out"
          className="rounded-lg p-1.5 text-slate-600 transition hover:bg-white hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>

        <span
          className="min-w-[3.25rem] text-center text-[11px] font-semibold tabular-nums text-slate-700"
          title={`Showing ${visibleCount} of ${total}`}
        >
          {zoomPercent}%
        </span>

        <button
          type="button"
          onClick={() => handleZoom('in')}
          disabled={!canZoomIn}
          title="Zoom in (or Ctrl/Pinch + Scroll)"
          aria-label="Zoom in"
          className="rounded-lg p-1.5 text-slate-600 transition hover:bg-white hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>

        {isZoomed && (
          <button
            type="button"
            onClick={handleReset}
            title="Reset zoom"
            aria-label="Reset zoom"
            className="rounded-lg p-1.5 text-slate-600 transition hover:bg-white hover:text-slate-900 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}

        <div className="mx-0.5 h-4 w-px bg-slate-200" />

        {inModal ? (
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            title="Close expanded view (Esc)"
            aria-label="Close expanded view"
            className="rounded-lg p-1.5 text-slate-600 transition hover:bg-white hover:text-slate-900 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            title="Expand chart"
            aria-label="Expand chart"
            className="rounded-lg p-1.5 text-slate-600 transition hover:bg-white hover:text-slate-900 cursor-pointer"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  };

  const renderPanBar = () => {
    if (!isZoomed || total === 0) return null;
    const maxStart = Math.max(0, total - visibleCount);
    const startItem = visibleData[0];
    const endItem = visibleData[visibleData.length - 1];
    const rangeLabel =
      getLabel && startItem && endItem
        ? `${getLabel(startItem)} – ${getLabel(endItem)}`
        : `${effectiveRange.start + 1}–${effectiveRange.end + 1} of ${total}`;

    return (
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 print:hidden">
        <button
          type="button"
          onClick={() => handlePan(-Math.max(1, Math.floor(visibleCount / 3)))}
          disabled={effectiveRange.start === 0}
          aria-label="Pan left"
          title="Pan left"
          className="rounded-md p-1 text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-40 cursor-pointer"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        <input
          type="range"
          min={0}
          max={maxStart}
          value={effectiveRange.start}
          onChange={(e) => {
            const nextStart = Number(e.target.value);
            setRange({ start: nextStart, end: nextStart + visibleCount - 1 });
          }}
          aria-label="Pan zoomed chart window"
          className="h-1.5 flex-1 cursor-pointer accent-indigo-600"
        />

        <button
          type="button"
          onClick={() => handlePan(Math.max(1, Math.floor(visibleCount / 3)))}
          disabled={effectiveRange.end >= total - 1}
          aria-label="Pan right"
          title="Pan right"
          className="rounded-md p-1 text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-40 cursor-pointer"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>

        <span className="hidden text-[11px] font-medium text-slate-500 sm:inline">
          {rangeLabel}
        </span>
      </div>
    );
  };

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {headerExtra}
            {renderToolbar(false)}
          </div>
        </div>

        {emptyState ? (
          emptyState
        ) : (
          <>
            <div
              ref={inlineChartRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className={`${heightClass} w-full select-none ${
                isZoomed ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''
              }`}
            >
              {children(visibleData, false)}
            </div>
            {renderPanBar()}
          </>
        )}
      </section>

      {isExpanded && !emptyState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs print:hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsExpanded(false);
          }}
        >
          <div className="flex w-full max-w-6xl flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{title}</h2>
                <p className="text-xs text-slate-500">
                  {subtitle} · Scroll to zoom{isZoomed ? ' · Drag chart to pan' : ''}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {headerExtra}
                {renderToolbar(true)}
              </div>
            </div>

            <div
              ref={modalChartRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className={`h-[65vh] min-h-[360px] w-full select-none ${
                isZoomed ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''
              }`}
            >
              {children(visibleData, true)}
            </div>

            {renderPanBar()}
          </div>
        </div>
      )}
    </>
  );
}
