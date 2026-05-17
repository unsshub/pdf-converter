'use client';

import { useState, useEffect, useCallback } from 'react';

interface DropboxFile {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  size: number;
  modified: string;
}

interface DropboxFilePickerProps {
  accessToken: string;
  onFileSelect: (file: DropboxFile) => void;
  onFilesSelect?: (files: DropboxFile[]) => void;
  multiSelect?: boolean;
  accentColor?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export default function DropboxFilePicker({
  accessToken,
  onFileSelect,
  onFilesSelect,
  multiSelect = false,
  accentColor = '#0061FF',
}: DropboxFilePickerProps) {
  const [files, setFiles] = useState<DropboxFile[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [pathHistory, setPathHistory] = useState<string[]>(['']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  const fetchFiles = useCallback(async (path: string = '') => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/dropbox-auth/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, path }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: 'Failed to load files' }));
        throw new Error(err.message || 'Failed to load files');
      }

      const data = await response.json();
      // Sort: folders first, then files
      const sorted = data.items.sort((a: DropboxFile, b: DropboxFile) => {
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name);
      });
      setFiles(sorted);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchFiles('');
  }, [fetchFiles]);

  const navigateToFolder = (folderPath: string) => {
    setPathHistory((prev) => [...prev, folderPath]);
    setCurrentPath(folderPath);
    setSelectedFiles(new Set());
    fetchFiles(folderPath);
  };

  const goBack = () => {
    const newHistory = [...pathHistory];
    newHistory.pop();
    const parentPath = newHistory[newHistory.length - 1] || '';
    setPathHistory(newHistory);
    setCurrentPath(parentPath);
    setSelectedFiles(new Set());
    fetchFiles(parentPath);
  };

  const toggleSelect = (file: DropboxFile) => {
    if (file.type === 'folder') {
      navigateToFolder(file.path);
      return;
    }

    const newSelected = new Set(selectedFiles);

    if (multiSelect) {
      if (newSelected.has(file.id)) {
        newSelected.delete(file.id);
      } else {
        newSelected.add(file.id);
      }
      setSelectedFiles(newSelected);
    } else {
      // Single select: select and immediately confirm
      onFileSelect(file);
    }
  };

  const confirmSelection = () => {
    const selected = files.filter((f) => selectedFiles.has(f.id));
    if (onFilesSelect && selected.length > 0) {
      onFilesSelect(selected);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden max-w-md w-full max-h-[70vh] flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-3" style={{ backgroundColor: `${accentColor}08` }}>
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill={accentColor}>
          <path d="M7.2 4.2L0 9l5.1 4.2L12 8.4l5.1 4.8L24 9l-7.2-4.8L12 8.4 7.2 4.2zM0 14.4l7.2 4.8L12 15.6l-5.1-4.2L0 14.4zM12 15.6l4.8 3.6 7.2-4.8-5.1-3.6L12 15.6zM12 24l-4.8-3.6L12 16.8l4.8 3.6L12 24z"/>
        </svg>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-800">Dropbox</h3>
          <p className="text-xs text-slate-400 truncate">
            {currentPath || '/'} 
          </p>
        </div>
        {pathHistory.length > 1 && (
          <button
            onClick={goBack}
            className="text-xs text-slate-500 hover:text-slate-700 font-medium flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        )}
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto min-h-[200px]">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <svg className="w-6 h-6 animate-spin text-slate-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12 text-red-500 text-sm">{error}</div>
        ) : files.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-slate-400 text-sm">No PDF files found</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {files.map((file) => (
              <li
                key={file.id}
                onClick={() => toggleSelect(file)}
                className={`
                  px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors
                  ${file.type === 'folder' ? 'hover:bg-slate-50' : ''}
                  ${selectedFiles.has(file.id) ? 'bg-blue-50' : 'hover:bg-slate-50'}
                `}
              >
                {/* Icon */}
                {file.type === 'folder' ? (
                  <svg className="w-5 h-5 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 flex-shrink-0" style={{ color: accentColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                )}

                {/* Name + size */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
                  {file.type === 'file' && file.size > 0 && (
                    <p className="text-xs text-slate-400">{formatFileSize(file.size)}</p>
                  )}
                </div>

                {/* Checkbox for multi-select */}
                {multiSelect && file.type === 'file' && (
                  <div className={`
                    w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0
                    ${selectedFiles.has(file.id) ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}
                  `}>
                    {selectedFiles.has(file.id) && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                )}

                {/* Arrow for folders */}
                {file.type === 'folder' && (
                  <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer with confirm button */}
      {multiSelect && (
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50">
          <button
            onClick={confirmSelection}
            disabled={selectedFiles.size === 0}
            className="w-full py-2.5 text-white font-semibold rounded-lg text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: accentColor }}
          >
            {selectedFiles.size === 0
              ? 'Select files'
              : `Select ${selectedFiles.size} file${selectedFiles.size > 1 ? 's' : ''}`
            }
          </button>
        </div>
      )}
    </div>
  );
}
