'use client';

import { useState, useEffect } from 'react';

interface PageRange {
  id: string;
  from: number;
  to: number;
}

interface PdfPagePreviewProps {
  totalPages: number;
  ranges: PageRange[];
  rangeMode: 'custom' | 'fixed';
  fixedSize: number;
  splitMode: 'range' | 'pages' | 'size';
  pagesPerFile: number;
  accentColor: string;
  filePath: string;
  onRangeUpdate: (ranges: PageRange[]) => void;
}

const RANGE_COLORS = [
  '#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6',
  '#1ABC9C', '#E67E22', '#34495E', '#16A085', '#C0392B',
  '#2980B9', '#27AE60', '#D35400', '#8E44AD', '#F1C40F',
];

export default function PdfPagePreview({
  totalPages,
  ranges,
  rangeMode,
  fixedSize,
  splitMode,
  pagesPerFile,
  accentColor,
  filePath,
  onRangeUpdate,
}: PdfPagePreviewProps) {
  const [pageImages, setPageImages] = useState<Record<number, string>>({});
  const [loadingPages, setLoadingPages] = useState<Set<number>>(new Set());

  // Fetch page images from the server
  useEffect(() => {
    if (!filePath || totalPages === 0) return;

    const fetchPageImages = async () => {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const newImages: Record<number, string> = {};
      const newLoading = new Set<number>();

      // Only load first 50 pages for performance
      const pagesToLoad = Math.min(totalPages, 50);

      for (let p = 1; p <= pagesToLoad; p++) {
        if (pageImages[p]) {
          newImages[p] = pageImages[p];
          continue;
        }

        newLoading.add(p);
      }

      setLoadingPages(newLoading);

      // Fetch pages in batches of 5
      for (let batch = 0; batch < pagesToLoad; batch += 5) {
        const promises = [];
        for (let p = batch + 1; p <= Math.min(batch + 5, pagesToLoad); p++) {
          if (pageImages[p]) continue;

          promises.push(
            fetch(`${API_BASE}/split/render-page`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filePath, pageNum: p }),
            })
              .then(async (res) => {
                if (res.ok) {
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  newImages[p] = url;
                }
              })
              .catch(() => {
                // Ignore errors for individual pages
              })
          );
        }
        await Promise.all(promises);
        setPageImages((prev) => ({ ...prev, ...newImages }));
      }

      setLoadingPages(new Set());
    };

    fetchPageImages();

    // Cleanup URLs on unmount
    return () => {
      Object.values(pageImages).forEach((url) => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [filePath, totalPages]);

  const getPageRangeIndex = (pageNum: number): number => {
    if (splitMode !== 'range') return -1;

    if (rangeMode === 'custom') {
      for (let i = 0; i < ranges.length; i++) {
        if (pageNum >= ranges[i].from && pageNum <= ranges[i].to) return i;
      }
      return -1;
    } else {
      if (fixedSize <= 0) return -1;
      return Math.floor((pageNum - 1) / fixedSize);
    }
  };

  const getComputedRanges = (): PageRange[] => {
    if (splitMode === 'range' && rangeMode === 'custom') return ranges;

    if (splitMode === 'range' && rangeMode === 'fixed') {
      const computed: PageRange[] = [];
      if (fixedSize > 0) {
        for (let i = 0; i < totalPages; i += fixedSize) {
          computed.push({ id: `fixed-${i}`, from: i + 1, to: Math.min(i + fixedSize, totalPages) });
        }
      }
      return computed;
    }

    if (splitMode === 'pages') {
      const computed: PageRange[] = [];
      if (pagesPerFile > 0) {
        for (let i = 0; i < totalPages; i += pagesPerFile) {
          computed.push({ id: `pages-${i}`, from: i + 1, to: Math.min(i + pagesPerFile, totalPages) });
        }
      }
      return computed;
    }

    return [];
  };

  const computedRanges = getComputedRanges();

  // Group pages by range
  const groupedPages: Record<number, number[]> = {};
  const unassignedPages: number[] = [];

  for (let p = 1; p <= totalPages; p++) {
    const rangeIdx = getPageRangeIndex(p);
    if (rangeIdx >= 0) {
      if (!groupedPages[rangeIdx]) groupedPages[rangeIdx] = [];
      groupedPages[rangeIdx].push(p);
    } else if (splitMode === 'range' && rangeMode === 'custom') {
      unassignedPages.push(p);
    } else {
      // For fixed/pages mode, all pages belong to a range
      if (!groupedPages[0]) groupedPages[0] = [];
      groupedPages[0].push(p);
    }
  }

  const renderRangeGroup = (rangeIdx: number, pages: number[]) => {
    const color = RANGE_COLORS[rangeIdx % RANGE_COLORS.length];
    const range = computedRanges[rangeIdx];
    if (!range || pages.length === 0) return null;

    return (
      <div key={`range-${rangeIdx}`} className="mb-5">
        {/* Range header */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <span className="text-xs font-semibold" style={{ color }}>
            Range {rangeIdx + 1}
          </span>
          <span className="text-[10px] text-slate-400">
            pages {range.from}–{range.to} ({pages.length} page{pages.length !== 1 ? 's' : ''})
          </span>
        </div>

        {/* Page thumbnails */}
        <div className="flex flex-wrap gap-2 pl-5">
          {pages.map((pageNum) => (
            <div key={pageNum} className="group relative">
              <div
                className="w-[72px] rounded-lg border-2 overflow-hidden transition-all hover:scale-105 hover:shadow-lg cursor-default"
                style={{ borderColor: color }}
              >
                {/* Page image or placeholder */}
                <div className="h-[96px] bg-white flex items-center justify-center overflow-hidden">
                  {pageImages[pageNum] ? (
                    <img
                      src={pageImages[pageNum]}
                      alt={`Page ${pageNum}`}
                      className="w-full h-full object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center w-full h-full" style={{ backgroundColor: `${color}08` }}>
                      {loadingPages.has(pageNum) ? (
                        <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: color, borderTopColor: 'transparent' }} />
                      ) : (
                        <span className="text-lg font-bold" style={{ color: `${color}60` }}>{pageNum}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Page number label */}
                <div className="py-1 text-center" style={{ backgroundColor: `${color}10` }}>
                  <span className="text-[10px] font-medium" style={{ color }}>{pageNum}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderUnassignedPages = (pages: number[]) => {
    if (pages.length === 0) return null;

    return (
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 rounded-full bg-slate-300 flex-shrink-0" />
          <span className="text-xs font-semibold text-slate-400">Unassigned</span>
          <span className="text-[10px] text-slate-300">{pages.length} pages</span>
        </div>
        <div className="flex flex-wrap gap-2 pl-5">
          {pages.map((pageNum) => (
            <div key={`unassigned-${pageNum}`}>
              <div className="w-[72px] rounded-lg border-2 border-dashed border-slate-300 overflow-hidden">
                <div className="h-[96px] bg-slate-50 flex items-center justify-center">
                  {pageImages[pageNum] ? (
                    <img src={pageImages[pageNum]} alt={`Page ${pageNum}`} className="w-full h-full object-contain opacity-50" loading="lazy" />
                  ) : (
                    <span className="text-lg font-bold text-slate-300">{pageNum}</span>
                  )}
                </div>
                <div className="py-1 text-center bg-slate-50">
                  <span className="text-[10px] text-slate-400">{pageNum}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="overflow-y-auto max-h-[65vh] pr-1">
      {Object.keys(groupedPages)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .map((rangeIdx) => renderRangeGroup(parseInt(rangeIdx), groupedPages[parseInt(rangeIdx)]))}
      {renderUnassignedPages(unassignedPages)}

      {totalPages === 0 && (
        <div className="text-center py-12 text-slate-400 text-sm">
          Upload a PDF to preview pages
        </div>
      )}

      {totalPages > 50 && (
        <p className="text-[10px] text-slate-400 text-center py-2">
          Showing first 50 pages of {totalPages}
        </p>
      )}
    </div>
  );
}
