'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import DropboxFilePicker from '@/components/DropboxFilePicker';

function DropboxCallbackContent() {
  const searchParams = useSearchParams();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'single' | 'multi'>('single');

  useEffect(() => {
    const token = searchParams.get('access_token');
    const err = searchParams.get('error');
    const m = searchParams.get('mode') || 'single';

    if (err) {
      setError(err);
    } else if (token) {
      setAccessToken(token);
      setMode(m as 'single' | 'multi');
    } else {
      setError('No access token received');
    }
  }, [searchParams]);

  const handleFileSelect = (file: any) => {
    if (window.opener) {
      window.opener.postMessage(
        {
          type: 'dropbox-file-selected',
          files: [{ ...file, accessToken }],
          mode: 'single',
        },
        '*'
      );
      window.close();
    }
  };

  const handleFilesSelect = (files: any[]) => {
    if (window.opener) {
      window.opener.postMessage(
        {
          type: 'dropbox-file-selected',
          files: files.map((f) => ({ ...f, accessToken })),
          mode: 'multi',
        },
        '*'
      );
      window.close();
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white rounded-xl p-8 shadow-sm border border-red-200 text-center max-w-sm">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">Dropbox Error</h2>
          <p className="text-slate-500 text-sm">{error}</p>
          <button onClick={() => window.close()} className="mt-4 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800">Close</button>
        </div>
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <DropboxFilePicker
        accessToken={accessToken}
        onFileSelect={handleFileSelect}
        onFilesSelect={mode === 'multi' ? handleFilesSelect : undefined}
        multiSelect={mode === 'multi'}
        accentColor="#0061FF"
      />
    </div>
  );
}

export default function DropboxCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full" />
      </div>
    }>
      <DropboxCallbackContent />
    </Suspense>
  );
}
