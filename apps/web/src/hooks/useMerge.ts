'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { apiClient } from '@/lib/api';

export interface MergeFile {
  id: string;
  file: File | null;       // null for cloud files
  filePath: string;         // server path for cloud files, empty for local
  fileName: string;
  fileSize: number;
  order: number;
  isCloud: boolean;         // true = file already on server
}

interface UseMergeReturn {
  files: MergeFile[];
  status: string;
  progress: number;
  mergeJobId: string | null;
  error: string | null;
  isProcessing: boolean;
  addFiles: (newFiles: File[]) => void;
  addCloudFiles: (cloudFiles: Array<{ filePath: string; fileName: string; fileSize: number }>) => void;
  removeFile: (id: string) => void;
  reorderFiles: (fromIndex: number, toIndex: number) => void;
  startMerge: () => Promise<void>;
  reset: () => void;
}

export function useMerge(): UseMergeReturn {
  const [files, setFiles] = useState<MergeFile[]>([]);
  const [status, setStatus] = useState<string>('IDLE');
  const [progress, setProgress] = useState<number>(0);
  const [mergeJobId, setMergeJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const clearPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Add local files (from file picker / drag & drop)
  const addFiles = useCallback((newFiles: File[]) => {
    setFiles((prev) => {
      const updated = [...prev];
      let nextOrder = prev.length;

      newFiles.forEach((file) => {
        if (file.type !== 'application/pdf') return;
        if (file.size > 50 * 1024 * 1024) return;

        updated.push({
          id: `local-${file.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          filePath: '',
          fileName: file.name,
          fileSize: file.size,
          order: nextOrder++,
          isCloud: false,
        });
      });

      return updated;
    });
  }, []);

  // Add cloud files (already on server — no re-upload needed)
  const addCloudFiles = useCallback((cloudFiles: Array<{ filePath: string; fileName: string; fileSize: number }>) => {
    setFiles((prev) => {
      const updated = [...prev];
      let nextOrder = prev.length;

      cloudFiles.forEach((cf) => {
        updated.push({
          id: `cloud-${cf.fileName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file: null,
          filePath: cf.filePath,
          fileName: cf.fileName,
          fileSize: cf.fileSize,
          order: nextOrder++,
          isCloud: true,
        });
      });

      return updated;
    });
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const filtered = prev.filter((f) => f.id !== id);
      return filtered.map((f, i) => ({ ...f, order: i }));
    });
  }, []);

  const reorderFiles = useCallback((fromIndex: number, toIndex: number) => {
    setFiles((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated.map((f, i) => ({ ...f, order: i }));
    });
  }, []);

  const startMerge = useCallback(async () => {
    if (files.length < 2) {
      setError('At least 2 files are required to merge');
      return;
    }

    setIsProcessing(true);
    setStatus('UPLOADING');
    setProgress(0);
    setError(null);

    try {
      // Separate local files (need upload) from cloud files (already on server)
      const localFiles = files.filter((f) => !f.isCloud && f.file);
      const cloudFiles = files.filter((f) => f.isCloud && f.filePath);

      let uploadedFiles: Array<{ filePath: string; fileName: string; fileSize: number }> = [];

      // Upload local files if any
      if (localFiles.length > 0) {
        const uploadResult = await apiClient.uploadMergeFiles(
          localFiles.map((f) => f.file!)
        );

        // Map uploaded files — use server paths
        uploadedFiles = localFiles.map((f, index) => ({
          filePath: uploadResult.files[index]?.filePath || '',
          fileName: f.fileName,
          fileSize: f.fileSize,
        }));
      }

      // Combine uploaded local files + cloud files (already have server paths)
      const allFiles = [...uploadedFiles, ...cloudFiles.map((f) => ({
        filePath: f.filePath,
        fileName: f.fileName,
        fileSize: f.fileSize,
      }))];

      setStatus('MERGING');
      setProgress(20);

      // Start merge
      const mergeResult = await apiClient.startMerge(allFiles);

      setMergeJobId(mergeResult.id);
      setStatus('PROCESSING');
      setProgress(30);

      // Start polling
      clearPolling();
      pollingRef.current = setInterval(async () => {
        try {
          const result = await apiClient.getMergeStatus(mergeResult.id);
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
          clearPolling();
          setIsProcessing(false);
          setError(err.message);
        }
      }, 2000);
    } catch (err: any) {
      console.error('Merge error:', err);
      setError(err.message || 'An error occurred during merge');
      setStatus('FAILED');
      setIsProcessing(false);
    }
  }, [files, clearPolling]);

  const reset = useCallback(() => {
    clearPolling();
    setFiles([]);
    setStatus('IDLE');
    setProgress(0);
    setMergeJobId(null);
    setError(null);
    setIsProcessing(false);
  }, [clearPolling]);

  useEffect(() => {
    return () => {
      clearPolling();
    };
  }, [clearPolling]);

  return {
    files,
    status,
    progress,
    mergeJobId,
    error,
    isProcessing,
    addFiles,
    addCloudFiles,
    removeFile,
    reorderFiles,
    startMerge,
    reset,
  };
}
