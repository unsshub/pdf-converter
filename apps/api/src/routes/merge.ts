import { Router, Request, Response } from 'express';
import { mergeService } from '../services/merge.service';
import { uploadMiddleware } from '../middleware/upload.middleware';
import { AppError } from '../middleware/error.middleware';
import fs from 'fs';
import path from 'path';

export const mergeRouter = Router();

// POST /api/merge/upload - Upload PDF files (even just 1 — cloud files don't need upload)
mergeRouter.post('/upload', (req: Request, res: Response, next: Function) => {
  uploadMiddleware.array('files', 20)(req, res, (err) => {
    if (err) return next(err);
    next();
  });
}, async (req: Request, res: Response, next: Function) => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      throw new AppError('No files provided', 400);
    }

    const uploadedFiles = files.map((file, index) => ({
      id: `file-${Date.now()}-${index}`,
      filePath: path.resolve(file.path),
      fileName: file.originalname,
      fileSize: file.size,
      order: index,
    }));

    res.status(200).json({
      files: uploadedFiles,
      message: `${files.length} file${files.length !== 1 ? 's' : ''} uploaded successfully`,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/merge - Start a merge job
mergeRouter.post('/', async (req: Request, res: Response, next: Function) => {
  try {
    const { files } = req.body;

    if (!files || !Array.isArray(files) || files.length < 2) {
      throw new AppError('At least 2 files are required to merge', 400);
    }

    // Verify all files exist on the server
    for (const file of files) {
      const absolutePath = path.resolve(file.filePath);
      if (!fs.existsSync(absolutePath)) {
        throw new AppError(`File not found on server: ${file.fileName}`, 400);
      }
    }

    const mergeJob = await mergeService.createMergeJob({
      files: files.map((f: any, index: number) => ({
        filePath: f.filePath,
        fileName: f.fileName,
        fileSize: f.fileSize,
        order: index,
      })),
    });

    // Start processing in background
    mergeService.processMerge(mergeJob.id).catch((err) => {
      console.error('Merge processing error:', err.message);
    });

    res.status(200).json({
      id: mergeJob.id,
      status: 'PROCESSING',
      progress: 0,
      fileCount: mergeJob.fileCount,
      message: 'Merge job started',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/merge/status/:id - Check merge job status
mergeRouter.get('/status/:id', async (req: Request, res: Response, next: Function) => {
  try {
    const { id } = req.params;
    const mergeJob = await mergeService.getMergeJob(id);

    if (!mergeJob) {
      throw new AppError('Merge job not found', 404);
    }

    const response: Record<string, unknown> = {
      id: mergeJob.id,
      status: mergeJob.status,
      progress: mergeJob.progress,
      fileCount: mergeJob.fileCount,
    };

    if (mergeJob.status === 'COMPLETED' && mergeJob.outputPath) {
      response.downloadUrl = `/api/merge/download/${mergeJob.id}`;
    }

    if (mergeJob.status === 'FAILED' && mergeJob.errorMessage) {
      response.errorMessage = mergeJob.errorMessage;
    }

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// GET /api/merge/download/:id - Download merged PDF
mergeRouter.get('/download/:id', async (req: Request, res: Response, next: Function) => {
  try {
    const { id } = req.params;
    const mergeJob = await mergeService.getMergeJob(id);

    if (!mergeJob) {
      throw new AppError('Merge job not found', 404);
    }

    if (mergeJob.status !== 'COMPLETED') {
      throw new AppError('Merge not completed yet', 400);
    }

    if (!mergeJob.outputPath) {
      throw new AppError('Output file not available', 404);
    }

    const absolutePath = path.resolve(mergeJob.outputPath);

    if (!fs.existsSync(absolutePath)) {
      throw new AppError('Output file no longer exists', 404);
    }

    const downloadName = `merged-${mergeJob.fileCount}-files.pdf`;

    res.download(absolutePath, downloadName, (err) => {
      if (err) {
        console.error('Download error:', err);
        if (!res.headersSent) {
          next(new AppError('Download failed', 500));
        }
      }
    });
  } catch (error) {
    next(error);
  }
});
