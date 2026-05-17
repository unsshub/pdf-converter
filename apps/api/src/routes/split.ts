import { Router, Request, Response } from 'express';
import { splitService } from '../services/split.service';
import { uploadMiddleware } from '../middleware/upload.middleware';
import { AppError } from '../middleware/error.middleware';
import { fileService } from '../services/file.service';
import fs from 'fs';
import path from 'path';

export const splitRouter = Router();

// POST /api/split/upload - Upload a PDF for splitting
splitRouter.post('/upload', (req: Request, res: Response, next: Function) => {
  uploadMiddleware.single('file')(req, res, (err) => {
    if (err) return next(err);
    next();
  });
}, async (req: Request, res: Response, next: Function) => {
  try {
    if (!req.file) throw new AppError('No file provided', 400);

    const filePath = path.resolve(req.file.path);
    const { PDFDocument } = require('pdf-lib');
    const fileBytes = fs.readFileSync(filePath);
    const pdf = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
    const totalPages = pdf.getPageCount();

    res.status(200).json({
      filePath,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      totalPages,
    });
  } catch (error) { next(error); }
});

// POST /api/split/analyze - Get page count for a file already on server (cloud files)
splitRouter.post('/analyze', async (req: Request, res: Response, next: Function) => {
  try {
    const { filePath } = req.body;
    if (!filePath) throw new AppError('filePath is required', 400);

    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) throw new AppError('File not found on server', 404);

    const { PDFDocument } = require('pdf-lib');
    const fileBytes = fs.readFileSync(absolutePath);
    const pdf = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
    const totalPages = pdf.getPageCount();
    const fileSize = fs.statSync(absolutePath).size;

    res.status(200).json({ totalPages, fileSize, filePath: absolutePath });
  } catch (error) { next(error); }
});

// POST /api/split - Start a split job
splitRouter.post('/', async (req: Request, res: Response, next: Function) => {
  try {
    const { originalPath, originalName, fileSize, splitMode, ranges, fixedSize, pagesPerFile, sizeLimit, selectedPages } = req.body;
    if (!originalPath || !originalName) throw new AppError('originalPath and originalName are required', 400);
    if (!fs.existsSync(path.resolve(originalPath))) throw new AppError('File not found on server', 400);

    const splitJob = await splitService.createSplitJob({
      originalPath, originalName, fileSize,
      splitMode: splitMode || 'range',
      ranges, fixedSize, pagesPerFile, sizeLimit, selectedPages,
    });

    splitService.processSplit(splitJob.id).catch((err) => {
      console.error('Split processing error:', err.message);
    });

    res.status(200).json({
      id: splitJob.id, status: 'PROCESSING', progress: 0,
      totalPages: splitJob.totalPages, splitMode: splitJob.splitMode,
      message: 'Split job started',
    });
  } catch (error) { next(error); }
});

// GET /api/split/status/:id
splitRouter.get('/status/:id', async (req: Request, res: Response, next: Function) => {
  try {
    const { id } = req.params;
    const splitJob = await splitService.getSplitJob(id);
    if (!splitJob) throw new AppError('Split job not found', 404);

    const response: Record<string, unknown> = {
      id: splitJob.id, status: splitJob.status, progress: splitJob.progress,
      totalPages: splitJob.totalPages, splitMode: splitJob.splitMode,
    };

    if (splitJob.status === 'COMPLETED') {
      const outputFiles = await splitService.getSplitOutputFiles(id);
      response.outputFiles = outputFiles;
      response.fileCount = outputFiles.length;
    }
    if (splitJob.status === 'FAILED' && splitJob.errorMessage) response.errorMessage = splitJob.errorMessage;

    res.status(200).json(response);
  } catch (error) { next(error); }
});

// GET /api/split/download/:jobId/:fileIndex
splitRouter.get('/download/:jobId/:fileIndex', async (req: Request, res: Response, next: Function) => {
  try {
    const { jobId, fileIndex } = req.params;
    const outputFiles = await splitService.getSplitOutputFiles(jobId);
    const index = parseInt(fileIndex, 10);
    if (index < 0 || index >= outputFiles.length) throw new AppError('File not found', 404);

    const file = outputFiles[index];
    const absolutePath = path.resolve(file.filePath);
    if (!fs.existsSync(absolutePath)) throw new AppError('File no longer exists', 404);

    res.download(absolutePath, file.fileName, (err) => {
      if (err && !res.headersSent) next(new AppError('Download failed', 500));
    });
  } catch (error) { next(error); }
});

// GET /api/split/download-all/:jobId - Download all as ZIP
splitRouter.get('/download-all/:jobId', async (req: Request, res: Response, next: Function) => {
  try {
    const { jobId } = req.params;
    const outputFiles = await splitService.getSplitOutputFiles(jobId);
    if (outputFiles.length === 0) throw new AppError('No output files found', 404);

    if (outputFiles.length === 1) {
      const file = outputFiles[0];
      const absolutePath = path.resolve(file.filePath);
      if (fs.existsSync(absolutePath)) return res.download(absolutePath, file.fileName);
    }

    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    const outputDir = fileService.getAbsoluteOutputDir();
    const zipPath = path.join(outputDir, `split-${jobId}.zip`);
    const filePaths = outputFiles.map((f: any) => `"${path.resolve(f.filePath)}"`).join(' ');

    try {
      await execAsync(`zip -j "${zipPath}" ${filePaths}`, { timeout: 60000 });
    } catch {
      try {
        const filesJson = JSON.stringify(outputFiles.map((f: any) => path.resolve(f.filePath)));
        const pythonScript = `
import zipfile, os, json
files = json.loads('${filesJson.replace(/'/g, "\\'")}')
with zipfile.ZipFile("${zipPath}", 'w', zipfile.ZIP_DEFLATED) as zf:
    for fp in files:
        zf.write(fp, os.path.basename(fp))
`;
        await execAsync(`python3 -c '${pythonScript}'`, { timeout: 60000 });
      } catch { throw new AppError('Failed to create ZIP archive', 500); }
    }

    res.download(zipPath, `split-${outputFiles.length}-files.zip`, (err) => {
      setTimeout(() => { try { if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); } catch {} }, 5000);
      if (err && !res.headersSent) next(new AppError('Download failed', 500));
    });
  } catch (error) { next(error); }
});

// POST /api/split/render-page - Render a PDF page as PNG
splitRouter.post('/render-page', async (req: Request, res: Response, next: Function) => {
  try {
    const { filePath, pageNum } = req.body;
    if (!filePath || !pageNum) throw new AppError('filePath and pageNum are required', 400);

    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) throw new AppError('File not found', 404);

    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    const outputDir = fileService.getAbsoluteOutputDir();
    const outputPrefix = path.join(outputDir, `preview-${Date.now()}`);
    const imagePath = `${outputPrefix}-${pageNum}.png`;
    let success = false;

    try {
      await execAsync(`pdftoppm -png -f ${pageNum} -l ${pageNum} -r 72 -singlefile "${absolutePath}" "${outputPrefix}"`, { timeout: 30000 });
      if (fs.existsSync(imagePath)) success = true;
    } catch {}

    if (!success) {
      try {
        await execAsync(`gs -dNOPAUSE -dBATCH -sDEVICE=png16m -r72 -dFirstPage=${pageNum} -dLastPage=${pageNum} -sOutputFile="${imagePath}" "${absolutePath}"`, { timeout: 30000 });
        if (fs.existsSync(imagePath)) success = true;
      } catch {}
    }

    if (success && fs.existsSync(imagePath)) {
      const imageBuffer = fs.readFileSync(imagePath);
      try { fs.unlinkSync(imagePath); } catch {}
      res.type('image/png').send(imageBuffer);
    } else {
      throw new AppError('Failed to render page', 500);
    }
  } catch (error) { next(error); }
});
