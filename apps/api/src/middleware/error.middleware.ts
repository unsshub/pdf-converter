import { Request, Response, NextFunction } from 'express';
import { ApiError } from '@pdf-converter/shared';

export class AppError extends Error {
  public statusCode: number;
  public details?: string;

  constructor(message: string, statusCode: number, details?: string) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error('Error:', err);

  if (err instanceof AppError) {
    const response: ApiError = {
      message: err.message,
      statusCode: err.statusCode,
      details: err.details,
    };
    return res.status(err.statusCode).json(response);
  }

  // Multer file size error
  if (err.message?.includes('File too large')) {
    const response: ApiError = {
      message: 'File size exceeds the maximum allowed size (50MB)',
      statusCode: 413,
    };
    return res.status(413).json(response);
  }

  // Multer file type error
  if (err.message?.includes('Only PDF files are allowed')) {
    const response: ApiError = {
      message: err.message,
      statusCode: 400,
    };
    return res.status(400).json(response);
  }

  // Default server error
  const response: ApiError = {
    message: 'Internal server error',
    statusCode: 500,
  };
  return res.status(500).json(response);
}
