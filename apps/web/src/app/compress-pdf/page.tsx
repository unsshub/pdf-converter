'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import FileUploader from '@/components/FileUploader';
import { apiClient } from '@/lib/api';

const ACCENT_COLOR = '#E67E22';

const QUALITY_LABELS: Record<string, string> = {
  low: 'Low — smallest file size',
  medium: 'Medium — good balance',
  high: 'High — recompresses streams, no image loss',
};

export default function CompressPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);
  const [quality, setQuality] = useState<string>('medium');
  const [status, setStatus] = useState<string>('IDLE');
  const [progress, setProgress] = useState<number>(0);
  const [compressId, setCompressId] = useState<string | null>(null);
  const [originalSize, setOriginalSize] = useState<number>(0);
  const [compressedSize, setCompressedSize] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const clearPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearPolling();
  }, [clearPolling]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const startPolling = useCallback((id: string) => {
    setCompressId(id);
    pollingRef.current = setInterval(async () => {
      try {
        const result = await apiClient.getCompressStatus(id);
        setStatus(result.status);
        setProgress(result.progress);

        if (result.status === 'COMPLETED') {
          clearPolling();
          setOriginalSize(result.originalSize || 0);
          setCompressedSize(result.compressedSize || 0);
        }
        if (result.status === 'FAILED') {
          clearPolling();
          if (result.errorMessage) setError(result.errorMessage);
        }
      } catch (err: any) {
        clearPolling();
        setError(err.message || 'Failed to check compression status');
      }
    }, 1000);
  }, [clearPolling]);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setFileName(selectedFile.name);
    setFileSize(selectedFile.size);
    setError(null);
    setStatus('UPLOADING');
    setProgress(0);

    try {
      const result = await apiClient.uploadCompressFile(selectedFile, quality);
      setStatus('UPLOADED');
      setProgress(5);

      // Start compression
      setStatus('PROCESSING');
      setProgress(10);
      await apiClient.startCompress(result.id, quality);
      startPolling(result.id);
    } catch (err: any) {
      setError(err.message || 'An error occurred during upload');
      setStatus('FAILED');
    }
  }, [quality, startPolling]);

  const handleCloudFileReady = useCallback(async (cloudFile: { filePath: string; fileName: string; fileSize: number }) => {
    setFile(null);
    setFileName(cloudFile.fileName);
    setFileSize(cloudFile.fileSize);
    setError(null);
    setStatus('PROCESSING');
    setProgress(5);

    try {
      const conversion = await apiClient.createConversionFromPath({
        filePath: cloudFile.filePath,
        fileName: cloudFile.fileName,
        fileSize: cloudFile.fileSize,
        outputFormat: 'compress',
      });
      setProgress(10);
      await apiClient.startCompress(conversion.id, quality);
      startPolling(conversion.id);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setStatus('FAILED');
    }
  }, [quality, startPolling]);

  const reset = useCallback(() => {
    clearPolling();
    setFile(null);
    setFileName('');
    setFileSize(0);
    setStatus('IDLE');
    setProgress(0);
    setCompressId(null);
    setOriginalSize(0);
    setCompressedSize(0);
    setError(null);
  }, [clearPolling]);

  const handleDownload = () => {
    if (!compressId) return;
    const url = apiClient.getCompressDownloadUrl(compressId);
    window.location.href = url;
  };

  const showUpload = status === 'IDLE';

  return (
    <>
      <Header />
      <main className="flex-1 py-6 md:py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {showUpload && (
            <>
              <div className="text-center mb-8 pt-4">
                <div className="inline-flex items-center gap-3 mb-3">
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${ACCENT_COLOR}15` }}>
                    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke={ACCENT_COLOR} strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.38 8.53l-7.62-4.5a1.5 1.5 0 00-1.52 0l-7.62 4.5A1.5 1.5 0 003 9.75v4.5a1.5 1.5 0 00.76 1.22l7.62 4.5a1.5 1.5 0 001.52 0l7.62-4.5A1.5 1.5 0 0021 14.25v-4.5a1.5 1.5 0 00-.62-.72z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12L3.5 7.5M12 12l8.5-4.5M12 12v9" />
                    </svg>
                  </div>
                </div>
                <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Compress PDF</h1>
                <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto text-sm">Reduce PDF file size while preserving quality. Choose your compression level below.</p>
              </div>

              <div className="w-full max-w-2xl mx-auto mb-6">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 block">Compression Level</label>
                <div className="grid grid-cols-3 gap-3">
                  {['low', 'medium', 'high'].map((level) => (
                    <button
                      key={level}
                      onClick={() => setQuality(level)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${quality === level ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20' : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-500'}`}
                    >
                      <span className={`block text-sm font-bold mb-1 capitalize ${quality === level ? 'text-orange-600 dark:text-orange-400' : 'text-slate-700 dark:text-slate-300'}`}>{level}</span>
                      <span className="block text-[11px] text-slate-400 dark:text-slate-500">{QUALITY_LABELS[level].split(' — ')[1]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <FileUploader onFileSelect={handleFileSelect} onCloudFileReady={handleCloudFileReady} isProcessing={false} accentColor={ACCENT_COLOR} />
            </>
          )}

          {status === 'COMPLETED' && compressId && (
            <div className="w-full max-w-2xl mx-auto animate-fade-in-up">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                  <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Compression Complete!</h3>
                {originalSize > 0 && compressedSize > 0 && (
                  <div className="flex items-center justify-center gap-4 mb-6">
                    <div className="text-center">
                      <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Original</p>
                      <p className="text-lg font-bold text-slate-700 dark:text-slate-300">{formatFileSize(originalSize)}</p>
                    </div>
                    <div className="flex flex-col items-center">
                      <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      {originalSize > compressedSize && (
                        <span className="text-xs font-bold text-emerald-500">{Math.round((1 - compressedSize / originalSize) * 100)}% smaller</span>
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">Compressed</p>
                      <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatFileSize(compressedSize)}</p>
                    </div>
                  </div>
                )}
                <button onClick={handleDownload} className="px-8 py-3.5 text-white font-semibold rounded-xl text-base shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 mb-4" style={{ backgroundColor: ACCENT_COLOR }}>
                  <span className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Compressed PDF
                  </span>
                </button>
                <button onClick={reset} className="block mx-auto text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 text-sm font-medium transition-colors">Compress another PDF</button>
              </div>
            </div>
          )}

          {status === 'FAILED' && (
            <div className="w-full max-w-2xl mx-auto animate-fade-in-up">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-red-200 dark:border-red-800 p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Compression Failed</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-6">{error || 'An unexpected error occurred. Please try again.'}</p>
                <button onClick={reset} className="px-6 py-2.5 text-white font-semibold rounded-xl text-sm shadow-lg hover:shadow-xl transition-all" style={{ backgroundColor: ACCENT_COLOR }}>Try Again</button>
              </div>
            </div>
          )}

          {(status === 'UPLOADING' || status === 'UPLOADED' || status === 'PROCESSING') && (
            <div className="w-full max-w-2xl mx-auto animate-fade-in-up">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${ACCENT_COLOR}15` }}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={ACCENT_COLOR} strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{fileName}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{formatFileSize(fileSize)}</p>
                  </div>
                  <svg className="w-6 h-6 animate-spin" style={{ color: ACCENT_COLOR }} fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">Compressing PDF...</span>
                    <span className="text-slate-500 dark:text-slate-400">{progress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${progress}%`, backgroundColor: ACCENT_COLOR }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && status !== 'FAILED' && (
            <div className="mt-4 max-w-xl mx-auto p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm text-center animate-fade-in-up">
              <span className="font-medium">Error:</span> {error}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
