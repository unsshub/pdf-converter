import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileService } from './file.service';

const prisma = new PrismaClient();
const execAsync = promisify(exec);

interface CreateMergeJobInput {
  files: Array<{
    filePath: string;
    fileName: string;
    fileSize: number;
    order: number;
  }>;
}

class MergeService {
  async createMergeJob(input: CreateMergeJobInput) {
    const mergeJob = await prisma.mergeJob.create({
      data: {
        status: 'PENDING',
        progress: 0,
        fileCount: input.files.length,
        files: {
          create: input.files.map((f) => ({
            filePath: f.filePath,
            fileName: f.fileName,
            fileSize: f.fileSize,
            order: f.order,
          })),
        },
      },
      include: { files: true },
    });

    return mergeJob;
  }

  async getMergeJob(id: string) {
    return prisma.mergeJob.findUnique({
      where: { id },
      include: { files: { orderBy: { order: 'asc' } } },
    });
  }

  async updateMergeJob(
    id: string,
    data: {
      status?: string;
      progress?: number;
      outputPath?: string;
      errorMessage?: string;
    }
  ) {
    const updateData: Record<string, unknown> = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.progress !== undefined) updateData.progress = data.progress;
    if (data.outputPath !== undefined) updateData.outputPath = data.outputPath;
    if (data.errorMessage !== undefined) updateData.errorMessage = data.errorMessage;

    return prisma.mergeJob.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteMergeJob(id: string) {
    return prisma.mergeJob.delete({
      where: { id },
    });
  }

  // Check if a tool is available on the system
  private async hasTool(toolName: string): Promise<boolean> {
    try {
      await execAsync(`which ${toolName}`);
      return true;
    } catch {
      return false;
    }
  }

  async processMerge(mergeJobId: string) {
    const mergeJob = await this.getMergeJob(mergeJobId);
    if (!mergeJob) {
      throw new Error('Merge job not found');
    }

    const outputDir = fileService.getAbsoluteOutputDir();
    const outputPath = path.join(outputDir, `merged-${Date.now()}.pdf`);

    try {
      await this.updateMergeJob(mergeJobId, {
        status: 'PROCESSING',
        progress: 10,
      });

      // Verify all input files exist and are valid PDFs
      const validFiles: string[] = [];
      for (let i = 0; i < mergeJob.files.length; i++) {
        const file = mergeJob.files[i];
        const absolutePath = path.resolve(file.filePath);

        if (!fs.existsSync(absolutePath)) {
          throw new Error(`File not found: ${file.fileName}`);
        }

        // Validate PDF header
        const header = Buffer.alloc(5);
        const fd = fs.openSync(absolutePath, 'r');
        fs.readSync(fd, header, 0, 5, 0);
        fs.closeSync(fd);

        if (header.toString('ascii') !== '%PDF-') {
          throw new Error(`Invalid PDF file: ${file.fileName}`);
        }

        validFiles.push(absolutePath);
      }

      await this.updateMergeJob(mergeJobId, { progress: 20 });

      // Try merging methods in order of reliability

      // METHOD 1: pdftk (most reliable for complex PDFs)
      let mergeSucceeded = false;

      if (!mergeSucceeded) {
        const hasPdftk = await this.hasTool('pdftk');
        if (hasPdftk) {
          console.log('   Trying pdftk merge...');
          try {
            const inputArgs = validFiles.map((f) => `"${f}"`).join(' ');
            const command = `pdftk ${inputArgs} cat output "${outputPath}"`;
            console.log(`   Command: ${command}`);
            await execAsync(command, { timeout: 120000 });

            if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
              mergeSucceeded = true;
              console.log('   ✅ pdftk merge succeeded');
            }
          } catch (err: any) {
            console.warn(`   ⚠️ pdftk failed: ${err.message}`);
            // Clean up partial output
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
          }
        }
      }

      // METHOD 2: Ghostscript (very reliable, preserves formatting)
      if (!mergeSucceeded) {
        const hasGs = await this.hasTool('gs');
        if (hasGs) {
          console.log('   Trying Ghostscript merge...');
          try {
            const inputArgs = validFiles.map((f) => `"${f}"`).join(' ');
            const command = `gs -dNOPAUSE -dBATCH -sDEVICE=pdfwrite -sOutputFile="${outputPath}" ${inputArgs}`;
            console.log(`   Command: ${command}`);
            await execAsync(command, { timeout: 120000 });

            if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
              mergeSucceeded = true;
              console.log('   ✅ Ghostscript merge succeeded');
            }
          } catch (err: any) {
            console.warn(`   ⚠️ Ghostscript failed: ${err.message}`);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
          }
        }
      }

      // METHOD 3: pdf-lib (JavaScript fallback — may produce empty pages for some PDFs)
      if (!mergeSucceeded) {
        console.log('   Trying pdf-lib merge...');
        try {
          const mergedPdf = await PDFDocument.create();
          const totalFiles = validFiles.length;

          for (let i = 0; i < totalFiles; i++) {
            const filePath = validFiles[i];
            const fileBytes = fs.readFileSync(filePath);

            let donorPdf: PDFDocument;
            try {
              donorPdf = await PDFDocument.load(fileBytes, {
                ignoreEncryption: true,
                updateMetadata: false,
              });
            } catch (loadErr: any) {
              throw new Error(`Failed to load PDF "${path.basename(filePath)}": ${loadErr.message}`);
            }

            const pageCount = donorPdf.getPageCount();
            console.log(`   File ${i + 1}: ${path.basename(filePath)} — ${pageCount} pages`);

            const pages = await mergedPdf.copyPages(
              donorPdf,
              donorPdf.getPageIndices()
            );
            pages.forEach((page) => mergedPdf.addPage(page));

            const prog = 20 + Math.round(((i + 1) / totalFiles) * 60);
            await this.updateMergeJob(mergeJobId, { progress: prog });
          }

          const mergedBytes = await mergedPdf.save();
          fs.writeFileSync(outputPath, mergedBytes);

          if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
            mergeSucceeded = true;
            console.log('   ✅ pdf-lib merge succeeded');
          }
        } catch (err: any) {
          console.warn(`   ⚠️ pdf-lib failed: ${err.message}`);
          if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        }
      }

      // METHOD 4: Python PyPDF2/pypdf fallback
      if (!mergeSucceeded) {
        console.log('   Trying Python pypdf merge...');
        try {
          const projectRoot = path.resolve(process.cwd(), '..', '..');
          const venvPython = path.join(projectRoot, '.venv', 'bin', 'python3');
          const pythonCmd = fs.existsSync(venvPython) ? venvPython : 'python3';

          // Install pypdf if needed
          try {
            await execAsync(`${pythonCmd} -c "import pypdf"`, { timeout: 30000 });
          } catch {
            console.log('   Installing pypdf...');
            await execAsync(`${pythonCmd} -m pip install pypdf -q`, { timeout: 60000 });
          }

          const inputArgs = validFiles.map((f) => `"${f}"`).join(',');
          const script = `
import sys
from pypdf import PdfWriter, PdfReader

writer = PdfWriter()
files = [${inputArgs}]
total = len(files)
for i, f in enumerate(files):
    reader = PdfReader(f)
    for page in reader.pages:
        writer.add_page(page)
    print(f"  File {i+1}/{total}: {len(reader.pages)} pages")

with open("${outputPath}", "wb") as out:
    writer.write(out)
print("SUCCESS")
`;
          const { stdout, stderr } = await execAsync(`${pythonCmd} -c '${script.replace(/'/g, "'\\''")}'`, { timeout: 180000 });
          console.log(`   Python stdout: ${stdout.trim()}`);
          if (stderr) console.log(`   Python stderr: ${stderr.trim()}`);

          if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
            mergeSucceeded = true;
            console.log('   ✅ Python pypdf merge succeeded');
          }
        } catch (err: any) {
          console.warn(`   ⚠️ Python pypdf failed: ${err.message}`);
          if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        }
      }

      if (!mergeSucceeded) {
        throw new Error('All merge methods failed. Please install pdftk or ghostscript for reliable PDF merging.');
      }

      const fileStats = fs.statSync(outputPath);
      console.log(`   ✅ Final output: ${outputPath} (${(fileStats.size / 1024).toFixed(1)} KB)`);

      await this.updateMergeJob(mergeJobId, {
        status: 'COMPLETED',
        progress: 100,
        outputPath,
      });

      return { success: true, outputPath };
    } catch (error: any) {
      console.error(`   ❌ Merge failed: ${error.message}`);
      await this.updateMergeJob(mergeJobId, {
        status: 'FAILED',
        errorMessage: error.message || 'Merge failed',
        progress: 0,
      });
      throw error;
    }
  }
}

export const mergeService = new MergeService();
