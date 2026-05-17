export enum ConversionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface Conversion {
  id: string;
  userId?: string;
  originalName: string;
  originalSize: number;
  originalPath: string;
  outputPath?: string;
  status: ConversionStatus;
  progress: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UploadResponse {
  id: string;
  originalName: string;
  originalSize: number;
  status: ConversionStatus;
}

export interface ConversionStatusResponse {
  id: string;
  status: ConversionStatus;
  progress: number;
  errorMessage?: string;
  downloadUrl?: string;
}

export interface ApiError {
  message: string;
  statusCode: number;
  details?: string;
}
