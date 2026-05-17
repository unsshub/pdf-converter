'use client';

import { useState, useCallback, useRef } from 'react';
import CloudStorageButtons from './CloudStorageButtons';

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  onCloudFileReady?: (file: { filePath: string; fileName: string; fileSize: number }) => void;
  isProcessing: boolean;
  accentColor?: string;
}

export default function FileUploader({ onFileSelect, onCloudFileReady, isProcessing, accentColor = '#2B579A' }: FileUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (file.type !== 'application/pdf') {
      return 'Only PDF files are allowed';
    }
    if (file.size > 50 * 1024 * 1024) {
      return 'File size must be less than 50MB';
    }
    return null;
  };

  const handleFile = useCallback((file: File) => {
    setError(null);
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    onFileSelect(file);
  }, [onFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleClick = () => {
    if (!isProcessing) {
      fileInputRef.current?.click();
    }
  };

  const handleCloudFilesReady = (files: Array<{ filePath: string; fileName: string; fileSize: number }>) => {
    if (files.length > 0 && onCloudFileReady) {
      onCloudFileReady(files[0]);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`
          relative rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer
          transition-all duration-300 ease-in-out
          ${isProcessing ? 'pointer-events-none opacity-60' : ''}
          ${isDragOver 
            ? 'border-blue-400 bg-blue-50 scale-[1.02]' 
            : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'
          }
        `}
        style={isDragOver ? { borderColor: accentColor, backgroundColor: `${accentColor}10` } : {}}
      >
        <div className="flex flex-col items-center gap-4">
          <div 
            className="w-20 h-20 rounded-full flex items-center justify-center transition-transform duration-300"
            style={{ backgroundColor: `${accentColor}15` }}
          >
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke={accentColor} strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>

          <button
            type="button"
            disabled={isProcessing}
            className="px-8 py-3.5 text-white font-semibold rounded-xl text-base shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
            style={{ backgroundColor: accentColor }}
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
          >
            Select PDF file
          </button>

          <p className="text-slate-400 dark:text-slate-500 text-sm">or drop PDF here</p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={handleInputChange}
          disabled={isProcessing}
        />
      </div>

      {/* Cloud storage buttons */}
      <div className="mt-4">
        <CloudStorageButtons
          onFilesReady={handleCloudFilesReady}
          multiSelect={false}
          size="md"
        />
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm text-center animate-fade-in-up">
          <span className="font-medium">Error:</span> {error}
        </div>
      )}
    </div>
  );
}
