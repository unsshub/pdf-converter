'use client';

import { useState, useEffect } from 'react';
import {
  openGoogleDrivePicker,
  openDropboxOAuth,
  preloadGoogleSDK,
  getCloudConfig,
} from '@/lib/cloud-storage';

interface CloudStorageButtonsProps {
  onFilesReady: (files: Array<{ filePath: string; fileName: string; fileSize: number }>) => void;
  multiSelect?: boolean;
  size?: 'sm' | 'md';
}

export default function CloudStorageButtons({
  onFilesReady,
  multiSelect = false,
  size = 'md',
}: CloudStorageButtonsProps) {
  const [loading, setLoading] = useState<'drive' | 'dropbox' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const config = getCloudConfig();

  useEffect(() => {
    if (config.googleDriveEnabled) {
      preloadGoogleSDK().catch(() => {});
    }
  }, []);

  const handleGoogleDrive = async () => {
    if (!config.googleDriveEnabled) {
      setError('Google Drive not configured');
      return;
    }

    setLoading('drive');
    setError(null);

    try {
      const driveFiles = await openGoogleDrivePicker(config.googleClientId, config.googleApiKey, multiSelect);

      if (driveFiles.length === 0) { setLoading(null); return; }

      const downloadedFiles = [];
      for (const driveFile of driveFiles) {
        const { downloadFromDrive } = await import('@/lib/cloud-storage');
        const result = await downloadFromDrive(driveFile.accessToken, driveFile.fileId, driveFile.fileName);
        downloadedFiles.push(result);
      }

      onFilesReady(downloadedFiles);
    } catch (err: any) {
      console.error('Google Drive error:', err);
      setError(err.message || 'Failed to select file from Google Drive');
    } finally {
      setLoading(null);
    }
  };

  const handleDropbox = async () => {
    setLoading('dropbox');
    setError(null);

    try {
      const dropboxFiles = await openDropboxOAuth(multiSelect);

      if (dropboxFiles.length === 0) { setLoading(null); return; }

      const downloadedFiles = [];
      for (const dbFile of dropboxFiles) {
        const { downloadFromDropbox } = await import('@/lib/cloud-storage');
        const result = await downloadFromDropbox(dbFile.accessToken, dbFile.path, dbFile.fileName);
        downloadedFiles.push(result);
      }

      onFilesReady(downloadedFiles);
    } catch (err: any) {
      console.error('Dropbox error:', err);
      setError(err.message || 'Failed to select file from Dropbox');
    } finally {
      setLoading(null);
    }
  };

  const isSmall = size === 'sm';

  return (
    <div>
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={handleGoogleDrive}
          disabled={!!loading}
          className={`flex items-center gap-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${isSmall ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'}`}
          title={config.googleDriveEnabled ? 'Select from Google Drive' : 'Google Drive not configured'}
        >
          {loading === 'drive' ? (
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
              <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5l5.4 9.35z" fill="#0066DA"/>
              <path d="M43.65 25.15L29.9 1.35C28.55 2.15 27.4 3.25 26.6 4.65L1.2 48.2c-.8 1.4-1.2 2.95-1.2 4.5h27.5l16.15-27.55z" fill="#00AC47"/>
              <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.85l5.85 10.75 7.85 13.05z" fill="#EA4335"/>
              <path d="M43.65 25.15L57.4 1.35C56.05.55 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.35l13.75 23.8z" fill="#00832D"/>
              <path d="M59.85 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h22.9c1.6 0 3.15-.45 4.5-1.2L59.85 53z" fill="#2684FC"/>
              <path d="M73.4 26.5l-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25.15 59.85 53h27.45c0-1.55-.4-3.1-1.2-4.5L73.4 26.5z" fill="#FFBA00"/>
            </svg>
          )}
          <span className="font-medium text-slate-600">{loading === 'drive' ? 'Connecting...' : 'Google Drive'}</span>
          {!config.googleDriveEnabled && <span className="text-red-400 text-xs ml-1">⚠</span>}
        </button>

        <span className="text-slate-300 text-xs">or</span>

        <button
          onClick={handleDropbox}
          disabled={!!loading}
          className={`flex items-center gap-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${isSmall ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'}`}
          title="Select from Dropbox"
        >
          {loading === 'dropbox' ? (
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#0061FF">
              <path d="M7.2 4.2L0 9l5.1 4.2L12 8.4l5.1 4.8L24 9l-7.2-4.8L12 8.4 7.2 4.2zM0 14.4l7.2 4.8L12 15.6l-5.1-4.2L0 14.4zM12 15.6l4.8 3.6 7.2-4.8-5.1-3.6L12 15.6zM12 24l-4.8-3.6L12 16.8l4.8 3.6L12 24z"/>
            </svg>
          )}
          <span className="font-medium text-slate-600">{loading === 'dropbox' ? 'Connecting...' : 'Dropbox'}</span>
        </button>
      </div>

      {error && (
        <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs text-center animate-fade-in-up">
          {error}
        </div>
      )}
    </div>
  );
}
