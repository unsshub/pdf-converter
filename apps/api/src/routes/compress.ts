import { Router, Request, Response } from 'express';
import { conversionService } from '../services/conversion.service';
import { AppError } from '../middleware/error.middleware';
import { fileService } from '../services/file.service';
import { uploadMiddleware } from '../middleware/upload.middleware';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

export const compressRouter = Router();

const JPEG_QUALITY: Record<string, number> = {
  low: 20,
  medium: 60,
  high: 85,
};

const COMPRESSION_RESOLUTIONS: Record<string, { dpi: number; monoDpi: number }> = {
  low:    { dpi: 72,  monoDpi: 150 },
  medium: { dpi: 150, monoDpi: 300 },
  high:   { dpi: 300, monoDpi: 600 },
};

function buildGsCommand(
  absoluteInputPath: string,
  absoluteOutputPath: string,
  quality: string,
  res: { dpi: number; monoDpi: number }
): string {
  const jpegQ = JPEG_QUALITY[quality] || 60;

  const args = [
    'gs',
    '-dNOPAUSE', '-dBATCH',
    '-sDEVICE=pdfwrite',
    '-dCompatibilityLevel=1.4',
    '-dEmbedAllFonts=true',
    '-dSubsetFonts=true',
    '-dAutoRotatePages=/None',
    '-dDetectDuplicateImages=true',
    '-dCompressFonts=true',
    '-dOptimize=true',
    '-dFastWebView=true',
    '-dPDFSETTINGS=/ebook',
    '-dDownsampleColorImages=true',
    '-dDownsampleGrayImages=true',
    '-dDownsampleMonoImages=true',
    `-dColorImageResolution=${res.dpi}`,
    `-dGrayImageResolution=${res.dpi}`,
    `-dMonoImageResolution=${res.monoDpi}`,
    '-dColorImageDownsampleThreshold=1.0',
    '-dGrayImageDownsampleThreshold=1.0',
    '-dMonoImageDownsampleThreshold=1.0',
    '-dColorImageDownsampleType=/Bicubic',
    '-dGrayImageDownsampleType=/Bicubic',
    '-dMonoImageDownsampleType=/Bicubic',
    `-dJPEGQ=${jpegQ}`,
    // Force re-encode of all JPEG images at specified quality, even if no downsampling needed
    '-dPassThroughJPEGImages=false',
    `-sOutputFile="${absoluteOutputPath}"`,
    `"${absoluteInputPath}"`,
  ];

  return args.join(' ');
}

async function compressPdf(
  id: string,
  absoluteInputPath: string,
  absoluteOutputDir: string,
  basename: string,
  quality: string
): Promise<string> {
  const absoluteOutputPath = path.join(absoluteOutputDir, `${basename}-compressed.pdf`);
  const inputSize = fs.statSync(absoluteInputPath).size;

  if (inputSize < 20 * 1024) {
    console.log(`   ⏭️ Input only ${(inputSize / 1024).toFixed(1)} KB, returning original`);
    fs.copyFileSync(absoluteInputPath, absoluteOutputPath);
    return absoluteOutputPath;
  }

  const res = COMPRESSION_RESOLUTIONS[quality] || COMPRESSION_RESOLUTIONS.medium;
  let succeeded = false;

  // Method 1: Ghostscript
  console.log(`   Method 1: Ghostscript (quality=${quality}, ${res.dpi} DPI)...`);
  await conversionService.updateConversion(id, { progress: 15 });
  try {
    const command = buildGsCommand(absoluteInputPath, absoluteOutputPath, quality, res);
    const { stdout, stderr } = await execAsync(command, { timeout: 180000 });
    if (stdout) console.log(`   stdout: ${stdout.trim()}`);
    if (stderr) console.log(`   stderr: ${stderr.trim()}`);
    if (fs.existsSync(absoluteOutputPath) && fs.statSync(absoluteOutputPath).size > 0) {
      const outputSize = fs.statSync(absoluteOutputPath).size;
      if (outputSize < inputSize) {
        succeeded = true;
        console.log(`   ✅ Ghostscript: ${(inputSize / 1024).toFixed(1)} KB → ${(outputSize / 1024).toFixed(1)} KB (${((1 - outputSize / inputSize) * 100).toFixed(1)}% reduction)`);
      } else {
        console.log(`   ⚠️ Ghostscript output larger (${(outputSize / 1024).toFixed(1)} KB vs ${(inputSize / 1024).toFixed(1)} KB), trying other methods`);
      }
    }
  } catch (err: any) {
    console.warn(`   ⚠️ Ghostscript failed: ${err.message}`);
  }

  // Method 2: pdf-lib — remove metadata & unused objects, recompress streams
  if (!succeeded) {
    console.log(`   Method 2: pdf-lib recompress...`);
    await conversionService.updateConversion(id, { progress: 50 });
    try {
      const { PDFDocument } = require('pdf-lib');
      const fileBytes = fs.readFileSync(absoluteInputPath);
      const pdf = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
      const compressedBytes = await pdf.save({ useObjectStreams: true });
      fs.writeFileSync(absoluteOutputPath, compressedBytes);
      const outputSize = fs.statSync(absoluteOutputPath).size;
      if (outputSize < inputSize) {
        succeeded = true;
        console.log(`   ✅ pdf-lib: ${(inputSize / 1024).toFixed(1)} KB → ${(outputSize / 1024).toFixed(1)} KB`);
      } else {
        console.log(`   ⚠️ pdf-lib output larger (${(outputSize / 1024).toFixed(1)} KB), keeping original`);
      }
    } catch (err: any) {
      console.warn(`   ⚠️ pdf-lib failed: ${err.message}`);
    }
  }

  await conversionService.updateConversion(id, { progress: 80 });

  if (!succeeded) {
    console.log(`   ℹ️ No method reduced file size, returning original`);
    fs.copyFileSync(absoluteInputPath, absoluteOutputPath);
  }

  return absoluteOutputPath;
}

// POST /api/compress/upload — Upload PDF for compression
compressRouter.post('/upload', (req: Request, res: Response, next: Function) => {
  uploadMiddleware.single('file')(req, res, (err) => {
    if (err) return next(err);
    next();
  });
}, async (req: Request, res: Response, next: Function) => {
  try {
    if (!req.file) throw new AppError('No file provided', 400);

    const quality = req.body.quality || 'medium';
    const conversion = await conversionService.createConversion({
      originalName: req.file.originalname,
      originalSize: req.file.size,
      originalPath: req.file.path,
      outputFormat: 'compress',
    });

    res.status(200).json({
      id: conversion.id,
      originalName: conversion.originalName,
      originalSize: conversion.originalSize,
      status: conversion.status,
      quality,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/compress/:id — Start compression
compressRouter.post('/:id', async (req: Request, res: Response, next: Function) => {
  try {
    const { id } = req.params;
    const quality = req.body.quality || 'medium';
    const conversion = await conversionService.getConversion(id);

    if (!conversion) throw new AppError('Compression job not found', 404);
    if (conversion.status === 'PROCESSING') throw new AppError('Already processing', 409);
    if (conversion.status === 'COMPLETED') throw new AppError('Already completed', 409);

    const absoluteInputPath = path.resolve(conversion.originalPath);
    const outputDir = fileService.getAbsoluteOutputDir();
    const basename = path.basename(absoluteInputPath, path.extname(absoluteInputPath));

    console.log(`🔄 Starting compression: ${conversion.originalName} (quality: ${quality})`);

    await conversionService.updateConversion(id, { status: 'PROCESSING', progress: 10 });

    compressPdf(id, absoluteInputPath, outputDir, basename, quality)
      .then(async (outputPath) => {
        const fileStats = fs.statSync(outputPath);
        console.log(`   ✅ Compressed: ${outputPath} (${(fileStats.size / 1024).toFixed(1)} KB)`);
        await conversionService.updateConversion(id, {
          status: 'COMPLETED',
          progress: 100,
          outputPath,
        });
      })
      .catch(async (err) => {
        console.error(`   ❌ Compression failed: ${err.message}`);
        await conversionService.updateConversion(id, {
          status: 'FAILED',
          errorMessage: err.message,
          progress: 0,
        });
      });

    res.status(200).json({
      id,
      status: 'PROCESSING',
      progress: 10,
      message: 'Compression started',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/compress/status/:id — Check compression status
compressRouter.get('/status/:id', async (req: Request, res: Response, next: Function) => {
  try {
    const { id } = req.params;
    const conversion = await conversionService.getConversion(id);
    if (!conversion) throw new AppError('Compression job not found', 404);

    const response: Record<string, unknown> = {
      id: conversion.id,
      status: conversion.status,
      progress: conversion.progress,
    };

    if (conversion.status === 'COMPLETED') {
      response.downloadUrl = `/api/compress/download/${conversion.id}`;
      if (conversion.originalSize) {
        response.originalSize = conversion.originalSize;
      }
      if (conversion.outputPath && fs.existsSync(conversion.outputPath)) {
        response.compressedSize = fs.statSync(conversion.outputPath).size;
      }
    }

    if (conversion.status === 'FAILED' && conversion.errorMessage) {
      response.errorMessage = conversion.errorMessage;
    }

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// GET /api/compress/download/:id — Download compressed PDF
compressRouter.get('/download/:id', async (req: Request, res: Response, next: Function) => {
  try {
    const { id } = req.params;
    const conversion = await conversionService.getConversion(id);

    if (!conversion) throw new AppError('Compression job not found', 404);
    if (conversion.status !== 'COMPLETED') throw new AppError('Compression not completed yet', 400);
    if (!conversion.outputPath) throw new AppError('Output file not available', 404);

    const absolutePath = path.resolve(conversion.outputPath);
    if (!fs.existsSync(absolutePath)) throw new AppError('File no longer exists', 404);

    const originalName = path.basename(conversion.originalName, path.extname(conversion.originalName));
    const downloadName = `${originalName}-compressed.pdf`;
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
    res.setHeader('Content-Length', fs.statSync(absolutePath).size);
    const stream = fs.createReadStream(absolutePath);
    stream.pipe(res);
    stream.on('error', () => {
      if (!res.headersSent) next(new AppError('Download failed', 500));
    });
  } catch (error) {
    next(error);
  }
});
