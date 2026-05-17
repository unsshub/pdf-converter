'use client';

import { apiClient } from '@/lib/api';

interface DownloadButtonProps {
  conversionId: string;
  fileName: string;
  accentColor?: string;
  onReset?: () => void;
}

export default function DownloadButton({ conversionId, fileName, accentColor = '#2B579A', onReset }: DownloadButtonProps) {
  const handleDownload = () => {
    const url = apiClient.getDownloadUrl(conversionId);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName.replace('.pdf', '.docx');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full max-w-2xl mx-auto animate-fade-in-up">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
          <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Conversion Complete!</h3>
        <p className="text-slate-500 dark:text-slate-400 mb-6">Your Word document is ready to download.</p>

        <button
          onClick={handleDownload}
          className="px-8 py-3.5 text-white font-semibold rounded-xl text-base shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 mb-4"
          style={{ backgroundColor: accentColor }}
        >
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Word Document
          </span>
        </button>

        {onReset && (
          <button
            onClick={onReset}
            className="block mx-auto text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 text-sm font-medium transition-colors"
          >
            Convert another PDF
          </button>
        )}
      </div>
    </div>
  );
}
