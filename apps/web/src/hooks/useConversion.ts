'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { apiClient } from '@/lib/api';

interface UseConversionOptions {
  outputFormat?: string;
}

interface UseConversionReturn {
  file: File | null;
  status: string;
  progress: number;
  conversionId: string | null;
  error: string | null;
  isProcessing: boolean;
  fileName: string;
  fileSize: number;
  handleFileSelect: (file: File) => void;
  handleCloudFileReady: (file: { filePath: string; fileName: string; fileSize: number }) => void;
  reset: () => void;
}

export function useConversion(options: UseConversionOptions = {}): UseConversionReturn {
  const outputFormat = options.outputFormat || 'docx';

  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);
  const [status, setStatus] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [conversionId, setConversionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const clearPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const startPollingAndConvert = useCallback((id: string) => {
    setConversionId(id);
    setStatus('PROCESSING');
    setProgress(10);

    // Start the conversion
    apiClient.startConversion(id).catch((err) => {
      console.error('Start conversion error:', err);
    });

    // Poll for status
    clearPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const result = await apiClient.getConversionStatus(id);
        setStatus(result.status);
        setProgress(result.progress);

        if (result.status === 'COMPLETED' || result.status === 'FAILED') {
          clearPolling();
          setIsProcessing(false);
          if (result.status === 'FAILED' && result.errorMessage) {
            setError(result.errorMessage);
          }
        }
      } catch (err: any) {
        console.error('Polling error:', err);
        setError(err.message || 'Failed to check conversion status');
        clearPolling();
        setIsProcessing(false);
      }
    }, 2000);
  }, [clearPolling]);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setFileName(selectedFile.name);
    setFileSize(selectedFile.size);
    setError(null);
    setStatus('UPLOADING');
    setProgress(0);
    setIsProcessing(true);

    try {
      const uploadResult = await apiClient.uploadFile(selectedFile, outputFormat);
      setStatus('UPLOADED');
      setProgress(5);
      startPollingAndConvert(uploadResult.id);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'An error occurred during upload');
      setStatus('FAILED');
      setIsProcessing(false);
    }
  }, [outputFormat, startPollingAndConvert]);

  const handleCloudFileReady = useCallback(async (cloudFile: { filePath: string; fileName: string; fileSize: number }) => {
    setFile(null);
    setFileName(cloudFile.fileName);
    setFileSize(cloudFile.fileSize);
    setError(null);
    setStatus('PROCESSING');
    setProgress(5);
    setIsProcessing(true);

    try {
      // Create conversion record from server path
      const result = await apiClient.createConversionFromPath({
        filePath: cloudFile.filePath,
        fileName: cloudFile.fileName,
        fileSize: cloudFile.fileSize,
        outputFormat,
      });

      startPollingAndConvert(result.id);
    } catch (err: any) {
      console.error('Cloud conversion error:', err);
      setError(err.message || 'An error occurred during conversion');
      setStatus('FAILED');
      setIsProcessing(false);
    }
  }, [outputFormat, startPollingAndConvert]);

  const reset = useCallback(() => {
    clearPolling();
    setFile(null);
    setFileName('');
    setFileSize(0);
    setStatus('');
    setProgress(0);
    setConversionId(null);
    setError(null);
    setIsProcessing(false);
  }, [clearPolling]);

  useEffect(() => {
    return () => { clearPolling(); };
  }, [clearPolling]);

  return {
    file,
    status,
    progress,
    conversionId,
    error,
    isProcessing,
    fileName,
    fileSize,
    handleFileSelect,
    handleCloudFileReady,
    reset,
  };
}
