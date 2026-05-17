const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

class ApiClient {
  private baseUrl: string;
  constructor(baseUrl: string) { this.baseUrl = baseUrl; }

  async uploadFile(file: File, outputFormat: string = 'docx'): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('outputFormat', outputFormat);
    const response = await fetch(`${this.baseUrl}/upload`, { method: 'POST', body: formData });
    if (!response.ok) { const error = await response.json().catch(() => ({ message: 'Upload failed' })); throw new Error(error.message); }
    return response.json();
  }

  async startConversion(id: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/convert/${id}`, { method: 'POST' });
    if (!response.ok) { const error = await response.json().catch(() => ({ message: 'Conversion failed' })); throw new Error(error.message); }
    return response.json();
  }

  async getConversionStatus(id: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/convert/status/${id}`);
    if (!response.ok) { const error = await response.json().catch(() => ({ message: 'Status check failed' })); throw new Error(error.message); }
    return response.json();
  }

  getDownloadUrl(id: string): string { return `${this.baseUrl}/download/${id}`; }

  async uploadMergeFiles(files: File[]): Promise<any> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    const response = await fetch(`${this.baseUrl}/merge/upload`, { method: 'POST', body: formData });
    if (!response.ok) { const error = await response.json().catch(() => ({ message: 'Upload failed' })); throw new Error(error.message); }
    return response.json();
  }

  async startMerge(files: Array<{ filePath: string; fileName: string; fileSize: number }>): Promise<any> {
    const response = await fetch(`${this.baseUrl}/merge`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files }) });
    if (!response.ok) { const error = await response.json().catch(() => ({ message: 'Merge failed' })); throw new Error(error.message); }
    return response.json();
  }

  async getMergeStatus(id: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/merge/status/${id}`);
    if (!response.ok) { const error = await response.json().catch(() => ({ message: 'Status check failed' })); throw new Error(error.message); }
    return response.json();
  }

  getMergeDownloadUrl(id: string): string { return `${this.baseUrl}/merge/download/${id}`; }

  async createConversionFromPath(data: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}/upload/convert-from-path`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (!response.ok) { const error = await response.json().catch(() => ({ message: 'Failed' })); throw new Error(error.message); }
    return response.json();
  }

  // ===== Split PDF =====

  async uploadSplitFile(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${this.baseUrl}/split/upload`, { method: 'POST', body: formData });
    if (!response.ok) { const error = await response.json().catch(() => ({ message: 'Upload failed' })); throw new Error(error.message); }
    return response.json();
  }

  async analyzeSplitFile(filePath: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/split/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filePath }) });
    if (!response.ok) { const error = await response.json().catch(() => ({ message: 'Analyze failed' })); throw new Error(error.message); }
    return response.json();
  }

  async startSplit(data: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}/split`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (!response.ok) { const error = await response.json().catch(() => ({ message: 'Split failed' })); throw new Error(error.message); }
    return response.json();
  }

  async getSplitStatus(id: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/split/status/${id}`);
    if (!response.ok) { const error = await response.json().catch(() => ({ message: 'Status check failed' })); throw new Error(error.message); }
    return response.json();
  }

  getSplitDownloadUrl(jobId: string, fileIndex: number): string { return `${this.baseUrl}/split/download/${jobId}/${fileIndex}`; }

  getSplitDownloadAllUrl(jobId: string): string { return `${this.baseUrl}/split/download-all/${jobId}`; }
}

export const apiClient = new ApiClient(API_BASE);
