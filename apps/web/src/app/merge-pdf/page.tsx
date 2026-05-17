'use client';

import { useState, useCallback, useRef } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CloudStorageButtons from '@/components/CloudStorageButtons';
import { useMerge, MergeFile } from '@/hooks/useMerge';
import { apiClient } from '@/lib/api';

const ACCENT_COLOR = '#E67E22';

export default function MergePdfPage() {
  const { files, status, progress, mergeJobId, error, isProcessing, addFiles, addCloudFiles, removeFile, reorderFiles, startMerge, reset } = useMerge();

  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [localDragOver, setLocalDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragItemRef = useRef<number | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setLocalDragOver(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setLocalDragOver(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setLocalDragOver(false); const dropped = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf'); if (dropped.length > 0) addFiles(dropped); }, [addFiles]);
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { const selected = Array.from(e.target.files || []); if (selected.length > 0) addFiles(selected); e.target.value = ''; }, [addFiles]);

  const handleItemDragStart = (index: number) => { dragItemRef.current = index; };
  const handleItemDragOver = (e: React.DragEvent, index: number) => { e.preventDefault(); setDragOverIndex(index); };
  const handleItemDrop = (e: React.DragEvent, toIndex: number) => { e.preventDefault(); setDragOverIndex(null); const fromIndex = dragItemRef.current; if (fromIndex !== null && fromIndex !== toIndex) reorderFiles(fromIndex, toIndex); dragItemRef.current = null; };
  const handleItemDragEnd = () => { setDragOverIndex(null); dragItemRef.current = null; };

  const formatFileSize = (bytes: number): string => { if (bytes === 0) return '0 B'; const k = 1024; const sizes = ['B', 'KB', 'MB', 'GB']; const i = Math.floor(Math.log(bytes) / Math.log(k)); return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]; };

  const handleDownload = () => {
    if (mergeJobId) {
      const url = apiClient.getMergeDownloadUrl(mergeJobId);
      const link = document.createElement('a');
      link.href = url; link.download = `merged-${files.length}-files.pdf`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
    }
  };

  const handleCloudFilesReady = useCallback((cloudFiles: Array<{ filePath: string; fileName: string; fileSize: number }>) => { addCloudFiles(cloudFiles); }, [addCloudFiles]);

  const showUpload = files.length === 0 && !isProcessing && status !== 'COMPLETED' && status !== 'FAILED';

  return (
    <>
      <Header />
      <main className="flex-1 py-6 md:py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {showUpload && (
            <div className="text-center mb-8 pt-4">
              <div className="inline-flex items-center gap-3 mb-3">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${ACCENT_COLOR}15` }}>
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke={ACCENT_COLOR} strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 4H5a2 2 0 00-2 2v3m18 0V6a2 2 0 00-2-2h-3m0 14h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6M12 9v6" />
                  </svg>
                </div>
              </div>
              <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Merge PDF</h1>
              <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto text-sm">Combine PDFs in the order you want with the easiest PDF merger available.</p>
            </div>
          )}

          {/* Processing */}
          {isProcessing && (
            <div className="max-w-xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: `${ACCENT_COLOR}15` }}>
                <svg className="w-8 h-8 animate-spin" style={{ color: ACCENT_COLOR }} fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{status === 'UPLOADING' ? 'Uploading files...' : 'Merging PDFs...'}</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-4">Merging {files.length} PDF files</p>
              <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: ACCENT_COLOR }} />
              </div>
            </div>
          )}

          {/* Completed */}
          {status === 'COMPLETED' && (
            <div className="max-w-xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Merge Complete!</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6">{files.length} PDFs merged.</p>
              <button onClick={handleDownload} className="px-8 py-3.5 text-white font-semibold rounded-xl text-base shadow-lg hover:shadow-xl transition-all" style={{ backgroundColor: ACCENT_COLOR }}>
                <span className="flex items-center gap-2 justify-center">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Download Merged PDF
                </span>
              </button>
              <button onClick={reset} className="block mx-auto text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 text-sm font-medium mt-3">Merge more files</button>
            </div>
          )}

          {/* Failed */}
          {status === 'FAILED' && (
            <div className="max-w-xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-red-200 dark:border-red-800 p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Merge Failed</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6">{error || 'An unexpected error occurred.'}</p>
              <button onClick={reset} className="px-6 py-2.5 text-white font-semibold rounded-xl text-sm shadow-lg transition-all" style={{ backgroundColor: ACCENT_COLOR }}>Try Again</button>
            </div>
          )}

          {/* File grid */}
          {files.length > 0 && !isProcessing && status !== 'COMPLETED' && status !== 'FAILED' && (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">{files.length} file{files.length !== 1 ? 's' : ''} selected</h3>
                <span className="text-xs text-slate-400 dark:text-slate-500">Drag to reorder</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {files.map((file, index) => (
                  <div key={file.id} draggable onDragStart={() => handleItemDragStart(index)} onDragOver={(e) => handleItemDragOver(e, index)} onDrop={(e) => handleItemDrop(e, index)} onDragEnd={handleItemDragEnd}
                    className={`relative bg-white dark:bg-slate-800 rounded-xl border-2 p-3 cursor-grab active:cursor-grabbing transition-all group ${dragOverIndex === index ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20 shadow-lg scale-105' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md'}`}>
                    <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm z-10" style={{ backgroundColor: ACCENT_COLOR }}>{index + 1}</div>
                    <button onClick={() => removeFile(file.id)} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-10 shadow-sm">✕</button>
                    <div className="w-full aspect-[3/4] rounded-lg flex flex-col items-center justify-center mb-2" style={{ backgroundColor: `${ACCENT_COLOR}08` }}>
                      <svg className="w-10 h-10 mb-1" viewBox="0 0 24 24" fill="none" stroke={ACCENT_COLOR} strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                      <span className="text-xs font-bold" style={{ color: ACCENT_COLOR }}>PDF</span>
                      {file.isCloud && <span className="text-[10px] text-blue-500 mt-0.5">☁️</span>}
                    </div>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{file.fileName}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{formatFileSize(file.fileSize)}</p>
                  </div>
                ))}
                <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all min-h-[160px]">
                  <svg className="w-8 h-8 text-slate-400 dark:text-slate-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Add more</span>
                </div>
              </div>

              <div className="mt-4 flex justify-center">
                <CloudStorageButtons onFilesReady={handleCloudFilesReady} multiSelect={true} size="sm" />
              </div>

              {files.length >= 2 && (
                <div className="mt-6 text-center">
                  <button onClick={startMerge} className="px-12 py-4 text-white font-bold rounded-xl text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all" style={{ backgroundColor: ACCENT_COLOR }}>
                    <span className="flex items-center gap-2 justify-center">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 4H5a2 2 0 00-2 2v3m18 0V6a2 2 0 00-2-2h-3m0 14h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" /></svg>
                      Merge PDF
                    </span>
                  </button>
                  <p className="text-slate-400 dark:text-slate-500 text-xs mt-2">{files.length} files • {formatFileSize(files.reduce((sum, f) => sum + f.fileSize, 0))} total</p>
                </div>
              )}
            </>
          )}

          {/* Drop zone when no files */}
          {showUpload && (
            <>
              <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}
                className={`rounded-2xl border-2 border-dashed p-14 text-center cursor-pointer transition-all ${localDragOver ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20 scale-[1.02]' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: `${ACCENT_COLOR}15` }}>
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke={ACCENT_COLOR} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <button type="button" className="px-8 py-3 text-white font-semibold rounded-xl text-base shadow-lg hover:shadow-xl transition-all" style={{ backgroundColor: ACCENT_COLOR }}>Select PDF files</button>
                  <p className="text-slate-400 text-sm">or drop PDFs here</p>
                </div>
              </div>
              <div className="mt-4 flex justify-center">
                <CloudStorageButtons onFilesReady={handleCloudFilesReady} multiSelect={true} size="md" />
              </div>
            </>
          )}

          <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" multiple className="hidden" onChange={handleFileInput} />
        </div>
      </main>
      <Footer />
    </>
  );
}
