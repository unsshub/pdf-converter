import { Router, Request, Response } from 'express';
import { conversionService } from '../services/conversion.service';
import { AppError } from '../middleware/error.middleware';
import { config } from '../config';
import { fileService } from '../services/file.service';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

export const convertRouter = Router();

let conversionQueue: any = null;
let conversionWorker: any = null;
let redisAvailable = false;

async function getQueue() {
  if (!conversionQueue && redisAvailable) {
    try {
      const { Queue } = await import('bullmq');
      conversionQueue = new Queue('pdf-conversion', {
        connection: config.redisConnection,
      });
    } catch (err) {
      redisAvailable = false;
      throw new AppError('Conversion service unavailable', 503);
    }
  }
  return conversionQueue;
}

async function initializeWorker() {
  try {
    const { Worker } = await import('bullmq');
    conversionWorker = new Worker(
      'pdf-conversion',
      async (job: any) => {
        const { conversionId, originalPath, originalName, outputFormat } = job.data;
        return await processConversion(conversionId, originalPath, originalName, outputFormat);
      },
      {
        connection: config.redisConnection,
        concurrency: 2,
      }
    );
    conversionWorker.on('failed', (job: any, err: Error) => {
      console.error(`❌ Job ${job?.id} failed:`, err.message);
    });
    conversionWorker.on('completed', (job: any) => {
      console.log(`✅ Job ${job?.id} completed successfully`);
    });
    redisAvailable = true;
    console.log('✅ BullMQ Worker connected to Redis');
  } catch (err) {
    console.warn('⚠️  Redis unavailable — using direct conversion mode');
    redisAvailable = false;
  }
}

initializeWorker();

function findOutputFile(outputPath: string): string | null {
  if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
    return outputPath;
  }
  return null;
}

function getPythonCommand(): string {
  const projectRoot = path.resolve(process.cwd(), '..', '..');
  const venvPath = path.join(projectRoot, '.venv', 'bin', 'python3');
  if (fs.existsSync(venvPath)) return venvPath;
  const cwdVenv = path.resolve(process.cwd(), '.venv', 'bin', 'python3');
  if (fs.existsSync(cwdVenv)) return cwdVenv;
  return 'python3';
}

function getScriptPath(scriptName: string): string {
  const projectRoot = path.resolve(process.cwd(), '..', '..');
  const scriptPath = path.join(projectRoot, scriptName);
  if (fs.existsSync(scriptPath)) return scriptPath;
  const cwdScript = path.resolve(process.cwd(), scriptName);
  if (fs.existsSync(cwdScript)) return cwdScript;
  return path.resolve(process.cwd(), '..', '..', scriptName);
}

// ===== PDF to Word (docx) conversion =====
async function convertToDocx(
  conversionId: string,
  absoluteInputPath: string,
  absoluteOutputDir: string,
  basename: string
): Promise<string> {
  const absoluteOutputPath = path.join(absoluteOutputDir, `${basename}.docx`);
  let conversionSucceeded = false;

  // Method 1: Python pdf2docx
  console.log(`   Method 1: Python pdf2docx...`);
  const pythonCmd = getPythonCommand();
  const scriptPath = getScriptPath('convert.py');

  if (fs.existsSync(scriptPath)) {
    try {
      await conversionService.updateConversion(conversionId, { progress: 20 });
      const pyCommand = `${pythonCmd} "${scriptPath}" "${absoluteInputPath}" "${absoluteOutputPath}"`;
      console.log(`   Command: ${pyCommand}`);
      const { stdout, stderr } = await execAsync(pyCommand, { timeout: 180000 });
      if (stdout) console.log(`   stdout: ${stdout.trim()}`);
      if (stderr) console.log(`   stderr: ${stderr.trim()}`);
      const found = findOutputFile(absoluteOutputPath);
      if (found) { conversionSucceeded = true; console.log(`   ✅ pdf2docx succeeded`); }
    } catch (err: any) { console.warn(`   ⚠️ pdf2docx failed: ${err.message}`); }
  }

  // Method 2: LibreOffice with explicit filter
  if (!conversionSucceeded) {
    console.log(`   Method 2: LibreOffice explicit filter...`);
    try {
      await conversionService.updateConversion(conversionId, { progress: 30 });
      const command = `libreoffice --headless --infilter="writer_pdf_import" --convert-to "docx:MS Word 2007 XML" --outdir "${absoluteOutputDir}" "${absoluteInputPath}"`;
      const { stdout, stderr } = await execAsync(command, { timeout: 120000 });
      const found = findOutputFile(absoluteOutputPath);
      if (found) { conversionSucceeded = true; console.log(`   ✅ LibreOffice explicit filter succeeded`); }
    } catch (err: any) { console.warn(`   ⚠️ LibreOffice explicit failed: ${err.message}`); }
  }

  // Method 3: LibreOffice basic
  if (!conversionSucceeded) {
    console.log(`   Method 3: LibreOffice basic...`);
    try {
      await conversionService.updateConversion(conversionId, { progress: 40 });
      const command = `libreoffice --headless --convert-to docx --outdir "${absoluteOutputDir}" "${absoluteInputPath}"`;
      await execAsync(command, { timeout: 120000 });
      const found = findOutputFile(absoluteOutputPath);
      if (found) { conversionSucceeded = true; console.log(`   ✅ LibreOffice basic succeeded`); }
    } catch (err: any) { console.warn(`   ⚠️ LibreOffice basic failed: ${err.message}`); }
  }

  // Method 4: soffice fallback
  if (!conversionSucceeded) {
    console.log(`   Method 4: soffice...`);
    try {
      const command = `soffice --headless --infilter="writer_pdf_import" --convert-to "docx:MS Word 2007 XML" --outdir "${absoluteOutputDir}" "${absoluteInputPath}"`;
      await execAsync(command, { timeout: 120000 });
      const found = findOutputFile(absoluteOutputPath);
      if (found) { conversionSucceeded = true; console.log(`   ✅ soffice succeeded`); }
    } catch (err: any) { console.warn(`   ⚠️ soffice failed: ${err.message}`); }
  }

  if (!conversionSucceeded) throw new Error('All DOCX conversion methods failed');
  return absoluteOutputPath;
}

// ===== PDF to Excel (xlsx) conversion =====
async function convertToXlsx(
  conversionId: string,
  absoluteInputPath: string,
  absoluteOutputDir: string,
  basename: string
): Promise<string> {
  const absoluteOutputPath = path.join(absoluteOutputDir, `${basename}.xlsx`);
  let conversionSucceeded = false;

  // Method 1: Python pdfplumber + openpyxl
  console.log(`   Method 1: Python pdfplumber + openpyxl...`);
  const pythonCmd = getPythonCommand();
  const scriptPath = getScriptPath('convert_to_excel.py');

  if (fs.existsSync(scriptPath)) {
    try {
      await conversionService.updateConversion(conversionId, { progress: 20 });
      const pyCommand = `${pythonCmd} "${scriptPath}" "${absoluteInputPath}" "${absoluteOutputPath}"`;
      console.log(`   Command: ${pyCommand}`);
      const { stdout, stderr } = await execAsync(pyCommand, { timeout: 180000 });
      if (stdout) console.log(`   stdout: ${stdout.trim()}`);
      if (stderr) console.log(`   stderr: ${stderr.trim()}`);
      const found = findOutputFile(absoluteOutputPath);
      if (found) { conversionSucceeded = true; console.log(`   ✅ pdfplumber succeeded`); }
    } catch (err: any) { console.warn(`   ⚠️ pdfplumber failed: ${err.message}`); }
  }

  // Method 2: LibreOffice with Excel filter
  if (!conversionSucceeded) {
    console.log(`   Method 2: LibreOffice Excel filter...`);
    try {
      await conversionService.updateConversion(conversionId, { progress: 30 });
      const command = `libreoffice --headless --infilter="writer_pdf_import" --convert-to "xlsx:Calc MS Excel 2007 XML" --outdir "${absoluteOutputDir}" "${absoluteInputPath}"`;
      console.log(`   Command: ${command}`);
      const { stdout, stderr } = await execAsync(command, { timeout: 120000 });
      if (stdout) console.log(`   stdout: ${stdout.trim()}`);
      if (stderr) console.log(`   stderr: ${stderr.trim()}`);
      const found = findOutputFile(absoluteOutputPath);
      if (found) { conversionSucceeded = true; console.log(`   ✅ LibreOffice Excel filter succeeded`); }
    } catch (err: any) { console.warn(`   ⚠️ LibreOffice Excel filter failed: ${err.message}`); }
  }

  // Method 3: LibreOffice with generic calc filter
  if (!conversionSucceeded) {
    console.log(`   Method 3: LibreOffice calc filter...`);
    try {
      await conversionService.updateConversion(conversionId, { progress: 40 });
      const command = `libreoffice --headless --convert-to xlsx --outdir "${absoluteOutputDir}" "${absoluteInputPath}"`;
      console.log(`   Command: ${command}`);
      const { stdout, stderr } = await execAsync(command, { timeout: 120000 });
      if (stdout) console.log(`   stdout: ${stdout.trim()}`);
      if (stderr) console.log(`   stderr: ${stderr.trim()}`);
      const found = findOutputFile(absoluteOutputPath);
      if (found) { conversionSucceeded = true; console.log(`   ✅ LibreOffice calc filter succeeded`); }
    } catch (err: any) { console.warn(`   ⚠️ LibreOffice calc filter failed: ${err.message}`); }
  }

  // Method 4: soffice fallback
  if (!conversionSucceeded) {
    console.log(`   Method 4: soffice fallback...`);
    try {
      const command = `soffice --headless --convert-to xlsx --outdir "${absoluteOutputDir}" "${absoluteInputPath}"`;
      await execAsync(command, { timeout: 120000 });
      const found = findOutputFile(absoluteOutputPath);
      if (found) { conversionSucceeded = true; console.log(`   ✅ soffice xlsx succeeded`); }
    } catch (err: any) { console.warn(`   ⚠️ soffice failed: ${err.message}`); }
  }

  if (!conversionSucceeded) throw new Error('All XLSX conversion methods failed');
  return absoluteOutputPath;
}

// ===== Main processConversion function =====
async function processConversion(
  conversionId: string,
  originalPath: string,
  originalName: string,
  outputFormat: string = 'docx'
) {
  const absoluteInputPath = path.resolve(originalPath);
  const absoluteOutputDir = fileService.getAbsoluteOutputDir();
  const basename = path.basename(absoluteInputPath, path.extname(absoluteInputPath));

  console.log(`🔄 Starting conversion: ${originalName} → ${outputFormat.toUpperCase()}`);
  console.log(`   Input: ${absoluteInputPath}`);

  try {
    if (!fs.existsSync(absoluteInputPath)) {
      throw new Error(`Input file not found: ${absoluteInputPath}`);
    }

    await conversionService.updateConversion(conversionId, {
      status: 'PROCESSING',
      progress: 10,
    });

    let absoluteOutputPath: string;

    if (outputFormat === 'xlsx') {
      absoluteOutputPath = await convertToXlsx(conversionId, absoluteInputPath, absoluteOutputDir, basename);
    } else {
      absoluteOutputPath = await convertToDocx(conversionId, absoluteInputPath, absoluteOutputDir, basename);
    }

    await conversionService.updateConversion(conversionId, { progress: 90 });

    const fileStats = fs.statSync(absoluteOutputPath);
    console.log(`   ✅ Output: ${absoluteOutputPath} (${(fileStats.size / 1024).toFixed(1)} KB)`);

    await conversionService.updateConversion(conversionId, {
      status: 'COMPLETED',
      progress: 100,
      outputPath: absoluteOutputPath,
    });

    return { success: true, outputPath: absoluteOutputPath };
  } catch (error: any) {
    console.error(`   ❌ Conversion failed: ${error.message}`);
    await conversionService.updateConversion(conversionId, {
      status: 'FAILED',
      errorMessage: error.message || 'Conversion failed',
      progress: 0,
    });
    throw error;
  }
}

// POST /api/convert/:id - Trigger conversion
convertRouter.post('/:id', async (req: Request, res: Response, next: Function) => {
  try {
    const { id } = req.params;
    const conversion = await conversionService.getConversion(id);

    if (!conversion) throw new AppError('Conversion not found', 404);
    if (conversion.status === 'PROCESSING') throw new AppError('Conversion is already in progress', 409);
    if (conversion.status === 'COMPLETED') throw new AppError('Conversion already completed', 409);

    const outputFormat = conversion.outputFormat || 'docx';

    if (redisAvailable) {
      try {
        const queue = await getQueue();
        if (queue) {
          await queue.add('convert-pdf', {
            conversionId: id,
            originalPath: conversion.originalPath,
            originalName: conversion.originalName,
            outputFormat,
          }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
        }
      } catch (queueErr) {
        processConversion(id, conversion.originalPath, conversion.originalName, outputFormat).catch((err) => {
          console.error('Direct conversion error:', err.message);
        });
      }
    } else {
      processConversion(id, conversion.originalPath, conversion.originalName, outputFormat).catch((err) => {
        console.error('Direct conversion error:', err.message);
      });
    }

    await conversionService.updateConversion(id, { status: 'PROCESSING', progress: 0 });

    res.status(200).json({ id, status: 'PROCESSING', progress: 0, outputFormat, message: 'Conversion started' });
  } catch (error) {
    next(error);
  }
});

// GET /api/convert/status/:id - Check conversion status
convertRouter.get('/status/:id', async (req: Request, res: Response, next: Function) => {
  try {
    const { id } = req.params;
    const conversion = await conversionService.getConversion(id);

    if (!conversion) throw new AppError('Conversion not found', 404);

    const response: Record<string, unknown> = {
      id: conversion.id,
      status: conversion.status,
      progress: conversion.progress,
      outputFormat: conversion.outputFormat,
    };

    if (conversion.status === 'COMPLETED' && conversion.outputPath) {
      response.downloadUrl = `/api/download/${conversion.id}`;
    }

    if (conversion.status === 'FAILED' && conversion.errorMessage) {
      response.errorMessage = conversion.errorMessage;
    }

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});
