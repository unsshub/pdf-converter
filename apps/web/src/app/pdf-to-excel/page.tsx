'use client';

import FileUploader from '@/components/FileUploader';
import ConversionProgress from '@/components/ConversionProgress';
import DownloadButton from '@/components/DownloadButton';
import { useConversion } from '@/hooks/useConversion';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const ACCENT_COLOR = '#217346';

export default function PdfToExcelPage() {
  const { file, status, progress, conversionId, error, isProcessing, fileName, fileSize, handleFileSelect, handleCloudFileReady, reset } = useConversion({ outputFormat: 'xlsx' });
  const displayName = fileName || file?.name || '';
  const displaySize = fileSize || file?.size || 0;

  const showUpload = !file && !fileName;

  return (
    <>
      <Header />
      <main className="flex-1 py-6 md:py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {showUpload && (
            <div className="text-center mb-8 pt-4">
              <div className="inline-flex items-center gap-3 mb-3">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${ACCENT_COLOR}15` }}>
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke={ACCENT_COLOR} strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 11l2 2 4-4" />
                  </svg>
                </div>
              </div>
              <h1 className="text-3xl font-bold text-slate-800 mb-2">PDF to Excel</h1>
              <p className="text-slate-500 max-w-md mx-auto text-sm">Pull data straight from PDFs into Excel spreadsheets. The converted XLSX file preserves table data with incredible accuracy.</p>
            </div>
          )}

          {status === 'COMPLETED' && conversionId && (
            <DownloadButton conversionId={conversionId} fileName={displayName} accentColor={ACCENT_COLOR} onReset={reset} />
          )}

          {status === 'FAILED' && (
            <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-8 text-center animate-fade-in-up">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Conversion Failed</h3>
              <p className="text-slate-500 mb-6">{error || 'An unexpected error occurred. Please try again.'}</p>
              <button onClick={reset} className="px-6 py-2.5 text-white font-semibold rounded-xl text-sm shadow-lg hover:shadow-xl transition-all" style={{ backgroundColor: ACCENT_COLOR }}>Try Again</button>
            </div>
          )}

          {(showUpload || status === 'PROCESSING' || status === 'UPLOADING' || status === 'UPLOADED') && status !== 'FAILED' && status !== 'COMPLETED' && (
            showUpload ? (
              <FileUploader onFileSelect={handleFileSelect} onCloudFileReady={handleCloudFileReady} isProcessing={false} accentColor={ACCENT_COLOR} />
            ) : (
              <ConversionProgress progress={progress} status={status} fileName={displayName} fileSize={displaySize} accentColor={ACCENT_COLOR} />
            )
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
