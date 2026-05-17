'use client';

import { useState, useCallback, useRef } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CloudStorageButtons from '@/components/CloudStorageButtons';
import PdfPagePreview from '@/components/PdfPagePreview';
import { apiClient } from '@/lib/api';

const ACCENT_COLOR = '#9B59B6';

interface PageRange { id: string; from: number; to: number }
interface SplitOutputFile { fileName: string; filePath: string; pageCount: number; size: number }

export default function SplitPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [filePath, setFilePath] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(0);

  const [splitMode, setSplitMode] = useState<'range' | 'pages' | 'size'>('range');
  const [rangeMode, setRangeMode] = useState<'custom' | 'fixed'>('fixed');
  const [ranges, setRanges] = useState<PageRange[]>([{ id: '1', from: 1, to: 1 }]);
  const [fixedSize, setFixedSize] = useState<number>(1);
  const [pagesPerFile, setPagesPerFile] = useState<number>(1);
  const [sizeLimit, setSizeLimit] = useState<number>(10);

  const [status, setStatus] = useState<string>('IDLE');
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [splitJobId, setSplitJobId] = useState<string | null>(null);
  const [outputFiles, setOutputFiles] = useState<SplitOutputFile[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localDragOver, setLocalDragOver] = useState(false);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    if (selectedFile.type !== 'application/pdf') { setError('Only PDF files are allowed'); return; }
    setFile(selectedFile);
    setFileName(selectedFile.name);
    setFileSize(selectedFile.size);
    setError(null);
    setStatus('UPLOADING');

    try {
      const result = await apiClient.uploadSplitFile(selectedFile);
      setFilePath(result.filePath);
      setTotalPages(result.totalPages);
      setRanges([{ id: '1', from: 1, to: result.totalPages }]);
      setFixedSize(Math.max(1, Math.ceil(result.totalPages / 3)));
      setPagesPerFile(1);
      setStatus('READY');
    } catch (err: any) {
      setError(err.message || 'Failed to upload file');
      setStatus('IDLE');
    }
  }, []);

  const handleCloudFileReady = useCallback(async (cloudFile: { filePath: string; fileName: string; fileSize: number }) => {
    setFile(null);
    setFileName(cloudFile.fileName);
    setFileSize(cloudFile.fileSize);
    setFilePath(cloudFile.filePath);
    setError(null);
    setStatus('ANALYZING');

    try {
      const result = await apiClient.analyzeSplitFile(cloudFile.filePath);
      setTotalPages(result.totalPages);
      setFileSize(result.fileSize || cloudFile.fileSize);
      setRanges([{ id: '1', from: 1, to: result.totalPages }]);
      setFixedSize(Math.max(1, Math.ceil(result.totalPages / 3)));
      setPagesPerFile(1);
      setStatus('READY');
    } catch (err: any) {
      setError(err.message || 'Failed to analyze PDF');
      setStatus('IDLE');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setLocalDragOver(false);
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
    if (dropped.length > 0) handleFileSelect(dropped[0]);
  }, [handleFileSelect]);

  const addRange = () => {
    const newId = String(Date.now());
    const lastRange = ranges[ranges.length - 1];
    const from = lastRange ? Math.min(lastRange.to + 1, totalPages || 1) : 1;
    setRanges([...ranges, { id: newId, from, to: Math.min(from, totalPages || 1) }]);
  };

  const removeRange = (id: string) => {
    if (ranges.length <= 1) return;
    setRanges(ranges.filter(r => r.id !== id));
  };

  const updateRange = (id: string, field: 'from' | 'to', value: number) => {
    setRanges(ranges.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const getFixedSplitCount = (): number => {
    if (!fixedSize || fixedSize <= 0 || totalPages <= 0) return 0;
    return Math.ceil(totalPages / fixedSize);
  };

  const getSizeSplitEstimate = (): number => {
    if (!sizeLimit || sizeLimit <= 0 || fileSize <= 0) return 0;
    return Math.ceil(fileSize / (sizeLimit * 1024 * 1024));
  };

  const startSplit = async () => {
    if (!filePath) { setError('Please select a PDF file first'); return; }
    setError(null);
    setStatus('PROCESSING');
    setProgress(0);
    setOutputFiles([]);

    try {
      let splitData: any = { originalPath: filePath, originalName: fileName, fileSize, splitMode };

      if (splitMode === 'range') {
        if (rangeMode === 'custom') {
          const validRanges = ranges.filter(r => r.from > 0 && r.to >= r.from);
          if (validRanges.length === 0) throw new Error('Please specify at least one valid page range');
          splitData.ranges = validRanges;
        } else {
          if (!fixedSize || fixedSize <= 0) throw new Error('Please enter a valid page count per file');
          splitData.fixedSize = fixedSize;
        }
      } else if (splitMode === 'pages') {
        if (!pagesPerFile || pagesPerFile <= 0) throw new Error('Please enter a valid number');
        splitData.pagesPerFile = pagesPerFile;
      } else if (splitMode === 'size') {
        if (!sizeLimit || sizeLimit <= 0) throw new Error('Please enter a valid size limit');
        splitData.sizeLimit = sizeLimit;
      }

      const result = await apiClient.startSplit(splitData);
      setSplitJobId(result.id);
      if (result.totalPages) setTotalPages(result.totalPages);

      const pollInterval = setInterval(async () => {
        try {
          const statusResult = await apiClient.getSplitStatus(result.id);
          setStatus(statusResult.status);
          setProgress(statusResult.progress);
          if (statusResult.status === 'COMPLETED') {
            clearInterval(pollInterval);
            setOutputFiles(statusResult.outputFiles || []);
          }
          if (statusResult.status === 'FAILED') {
            clearInterval(pollInterval);
            setError(statusResult.errorMessage || 'Split failed');
          }
        } catch (err: any) {
          clearInterval(pollInterval);
          setError(err.message);
        }
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to start split');
      setStatus('READY');
    }
  };

  const reset = () => {
    setFile(null); setFilePath(''); setFileName(''); setFileSize(0); setTotalPages(0);
    setStatus('IDLE'); setProgress(0); setError(null); setSplitJobId(null); setOutputFiles([]);
    setRanges([{ id: '1', from: 1, to: 1 }]); setFixedSize(1); setPagesPerFile(1); setSizeLimit(10);
  };

  const hasFile = status !== 'IDLE';

  return (
    <>
      <Header />
      <main className="flex-1 py-6 md:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {!hasFile && (
            <div className="max-w-xl mx-auto pt-8">
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-3 mb-3">
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${ACCENT_COLOR}15` }}>
                    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke={ACCENT_COLOR} strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
                <h1 className="text-3xl font-bold text-slate-800 mb-2">Split PDF</h1>
                <p className="text-slate-500 max-w-md mx-auto text-sm">Separate one page or a whole set for easy conversion into independent PDF files.</p>
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setLocalDragOver(true); }}
                onDragLeave={(e) => { e.preventDefault(); setLocalDragOver(false); }}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`rounded-2xl border-2 border-dashed p-14 text-center cursor-pointer transition-all duration-300 ${localDragOver ? 'border-purple-400 bg-purple-50 scale-[1.02]' : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50'}`}
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: `${ACCENT_COLOR}15` }}>
                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke={ACCENT_COLOR} strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <button type="button" className="px-8 py-3.5 text-white font-semibold rounded-xl text-base shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all" style={{ backgroundColor: ACCENT_COLOR }}>Select PDF file</button>
                  <p className="text-slate-400 text-sm">or drop PDF here</p>
                </div>
              </div>
              <div className="mt-4">
                <CloudStorageButtons onFilesReady={(files) => { if (files.length > 0) handleCloudFileReady(files[0]); }} multiSelect={false} size="md" />
              </div>
              <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }} />
            </div>
          )}

          {hasFile && (
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-5">

              {/* LEFT: Page Preview */}
              <div className="lg:col-span-3">
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  {/* File bar */}
                  <div className="px-4 py-2.5 border-b border-slate-200 flex items-center gap-3" style={{ backgroundColor: `${ACCENT_COLOR}05` }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${ACCENT_COLOR}15` }}>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke={ACCENT_COLOR} strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{fileName}</p>
                      <p className="text-[11px] text-slate-400">{formatFileSize(fileSize)}{totalPages > 0 ? ` • ${totalPages} pages` : ''}</p>
                    </div>
                    <button onClick={reset} className="text-[11px] text-slate-400 hover:text-red-500 transition-colors font-medium px-2 py-1 rounded hover:bg-red-50">Change file</button>
                  </div>

                  {status === 'PROCESSING' && (
                    <div className="p-8 text-center">
                      <svg className="w-10 h-10 animate-spin mx-auto mb-4" style={{ color: ACCENT_COLOR }} fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <h3 className="text-lg font-bold text-slate-800 mb-2">Splitting PDF...</h3>
                      <div className="w-full max-w-xs mx-auto bg-slate-100 rounded-full h-2.5 overflow-hidden mt-4">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: ACCENT_COLOR }} />
                      </div>
                    </div>
                  )}

                  {status === 'COMPLETED' && (
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-slate-800">✅ {outputFiles.length} file{outputFiles.length !== 1 ? 's' : ''} created</h3>
                        {splitJobId && outputFiles.length > 1 && (
                          <a href={apiClient.getSplitDownloadAllUrl(splitJobId)} className="text-xs font-medium px-3 py-1.5 rounded-lg text-white hover:opacity-90" style={{ backgroundColor: ACCENT_COLOR }}>Download All (ZIP)</a>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {outputFiles.map((f, i) => (
                          <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
                            <div className="w-full aspect-[3/4] rounded-lg mb-2 flex flex-col items-center justify-center" style={{ backgroundColor: `${ACCENT_COLOR}08` }}>
                              <svg className="w-8 h-8 mb-1" fill="none" viewBox="0 0 24 24" stroke={ACCENT_COLOR} strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                              <span className="text-xs font-bold" style={{ color: ACCENT_COLOR }}>{f.pageCount}p</span>
                            </div>
                            <p className="text-xs font-medium text-slate-700 truncate">{f.fileName}</p>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[10px] text-slate-400">{formatFileSize(f.size)}</span>
                              {splitJobId && <a href={apiClient.getSplitDownloadUrl(splitJobId, i)} className="text-[10px] font-medium hover:underline" style={{ color: ACCENT_COLOR }}>Download</a>}
                            </div>
                          </div>
                        ))}
                      </div>
                      <button onClick={reset} className="block mx-auto text-slate-500 hover:text-slate-700 text-sm font-medium mt-5">Split another PDF</button>
                    </div>
                  )}

                  {status === 'READY' && (
                    <div className="p-4">
                      <PdfPagePreview totalPages={totalPages} ranges={ranges} rangeMode={rangeMode} fixedSize={fixedSize} splitMode={splitMode} pagesPerFile={pagesPerFile} accentColor={ACCENT_COLOR} filePath={filePath} onRangeUpdate={setRanges} />
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT: Split Options */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden sticky top-20">
                  <div className="flex border-b border-slate-200">
                    {(['range', 'pages', 'size'] as const).map((mode) => (
                      <button key={mode} onClick={() => setSplitMode(mode)} className={`flex-1 py-3 text-xs font-medium transition-colors relative ${splitMode === mode ? 'text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}>
                        {mode === 'range' ? 'By Range' : mode === 'pages' ? 'By Pages' : 'By Size'}
                        {splitMode === mode && <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: ACCENT_COLOR }} />}
                      </button>
                    ))}
                  </div>

                  <div className="p-5">
                    {splitMode === 'range' && (
                      <div>
                        <div className="flex bg-slate-100 rounded-lg p-1 mb-5">
                          <button onClick={() => setRangeMode('custom')} className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${rangeMode === 'custom' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>Custom Ranges</button>
                          <button onClick={() => setRangeMode('fixed')} className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${rangeMode === 'fixed' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>Fixed Size</button>
                        </div>

                        {rangeMode === 'custom' && (
                          <div>
                            <div className="space-y-3">
                              {ranges.map((range, index) => (
                                <div key={range.id} className="flex items-center gap-2">
                                  <span className="text-xs text-slate-400 w-5 text-right">{index + 1}.</span>
                                  <div className="flex items-center gap-2 flex-1">
                                    <div className="flex-1">
                                      <label className="text-[10px] text-slate-400 mb-0.5 block">From page</label>
                                      <input type="number" min={1} max={totalPages || 1} value={range.from} onChange={(e) => updateRange(range.id, 'from', parseInt(e.target.value) || 1)} className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
                                    </div>
                                    <div className="flex-1">
                                      <label className="text-[10px] text-slate-400 mb-0.5 block">To page</label>
                                      <input type="number" min={1} max={totalPages || 1} value={range.to} onChange={(e) => updateRange(range.id, 'to', parseInt(e.target.value) || 1)} className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
                                    </div>
                                  </div>
                                  {ranges.length > 1 && (
                                    <button onClick={() => removeRange(range.id)} className="p-1.5 text-slate-400 hover:text-red-500 mt-4">
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                            <button onClick={addRange} className="mt-3 w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-xs font-medium text-slate-500 hover:border-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                              Add Range
                            </button>
                            {totalPages > 0 && (
                              <div className="mt-4 p-2.5 rounded-lg text-xs" style={{ backgroundColor: `${ACCENT_COLOR}08` }}>
                                <p style={{ color: ACCENT_COLOR }}>{ranges.length} PDF{ranges.length !== 1 ? 's' : ''} will be created</p>
                              </div>
                            )}
                          </div>
                        )}

                        {rangeMode === 'fixed' && (
                          <div>
                            <label className="text-sm text-slate-600 font-medium mb-2 block">Split into page ranges of:</label>
                            <input type="number" min={1} max={totalPages || 1} value={fixedSize} onChange={(e) => setFixedSize(parseInt(e.target.value) || 1)} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
                            {totalPages > 0 && fixedSize > 0 && (
                              <div className="mt-4 p-2.5 rounded-lg text-xs" style={{ backgroundColor: `${ACCENT_COLOR}08` }}>
                                <p style={{ color: ACCENT_COLOR }}>
                                  This PDF will be split into files of <strong>{fixedSize} page{fixedSize !== 1 ? 's' : ''}</strong>.{' '}
                                  <strong>{getFixedSplitCount()} PDF{getFixedSplitCount() !== 1 ? 's' : ''}</strong> will be created.
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {splitMode === 'pages' && (
                      <div>
                        <label className="text-sm text-slate-600 font-medium mb-2 block">Extract every N pages:</label>
                        <input type="number" min={1} max={totalPages || 1} value={pagesPerFile} onChange={(e) => setPagesPerFile(parseInt(e.target.value) || 1)} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
                        {totalPages > 0 && pagesPerFile > 0 && (
                          <div className="mt-4 p-2.5 rounded-lg text-xs" style={{ backgroundColor: `${ACCENT_COLOR}08` }}>
                            <p style={{ color: ACCENT_COLOR }}>
                              Every <strong>{pagesPerFile} page{pagesPerFile !== 1 ? 's' : ''}</strong> → separate file.{' '}
                              <strong>{Math.ceil(totalPages / pagesPerFile)} PDF{Math.ceil(totalPages / pagesPerFile) !== 1 ? 's' : ''}</strong> will be created.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {splitMode === 'size' && (
                      <div>
                        <label className="text-sm text-slate-600 font-medium mb-2 block">Max file size (MB):</label>
                        <input
                          type="number"
                          min={0.1}
                          step={0.1}
                          value={sizeLimit}
                          onChange={(e) => setSizeLimit(parseFloat(e.target.value) || 0.1)}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                        />
                        <p className="text-[11px] text-slate-400 mt-1.5">Each output file will be at or below this size. If a single page exceeds the limit, it will be included as its own file.</p>
                        {fileSize > 0 && sizeLimit > 0 && (
                          <div className="mt-4 p-2.5 rounded-lg text-xs" style={{ backgroundColor: `${ACCENT_COLOR}08` }}>
                            <p style={{ color: ACCENT_COLOR }}>
                              This {formatFileSize(fileSize)} PDF will be split into files of <strong>≤ {sizeLimit} MB</strong>.{' '}
                              Approximately <strong>{getSizeSplitEstimate()} PDF{getSizeSplitEstimate() !== 1 ? 's' : ''}</strong> will be created.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <button onClick={startSplit} disabled={status === 'PROCESSING'} className="w-full mt-5 py-3.5 text-white font-bold rounded-xl text-base shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none" style={{ backgroundColor: ACCENT_COLOR }}>
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        Split PDF
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && status !== 'FAILED' && (
            <div className="mt-4 max-w-xl mx-auto p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm text-center animate-fade-in-up">
              <span className="font-medium">Error:</span> {error}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
