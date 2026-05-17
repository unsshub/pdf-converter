import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { fileService } from './file.service';
import { exec } from 'child_process';
import { promisify } from 'util';

const prisma = new PrismaClient();
const execAsync = promisify(exec);

interface SplitRange {
  from: number;
  to: number;
}

interface CreateSplitJobInput {
  originalPath: string;
  originalName: string;
  fileSize: number;
  splitMode: 'range' | 'pages' | 'size';
  ranges?: SplitRange[];
  fixedSize?: number;
  sizeLimit?: number;
  pagesPerFile?: number;
  selectedPages?: number[];
}

class SplitService {
  async createSplitJob(input: CreateSplitJobInput) {
    // Get total page count
    const absolutePath = path.resolve(input.originalPath);
    const fileBytes = fs.readFileSync(absolutePath);
    const pdf = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
    const totalPages = pdf.getPageCount();

    const splitJob = await prisma.splitJob.create({
      data: {
        originalPath: input.originalPath,
        originalName: input.originalName,
        fileSize: input.fileSize,
        totalPages,
        splitMode: input.splitMode,
        ranges: input.ranges ? JSON.stringify(input.ranges) : null,
        fixedSize: input.fixedSize || null,
        sizeLimit: input.sizeLimit || null,
        pagesPerFile: input.pagesPerFile || null,
        selectedPages: input.selectedPages ? JSON.stringify(input.selectedPages) : null,
        status: 'PENDING',
        progress: 0,
      },
    });

    return splitJob;
  }

  async getSplitJob(id: string) {
    return prisma.splitJob.findUnique({ where: { id } });
  }

  async updateSplitJob(
    id: string,
    data: {
      status?: string;
      progress?: number;
      outputFiles?: string;
      errorMessage?: string;
    }
  ) {
    const updateData: Record<string, unknown> = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.progress !== undefined) updateData.progress = data.progress;
    if (data.outputFiles !== undefined) updateData.outputFiles = data.outputFiles;
    if (data.errorMessage !== undefined) updateData.errorMessage = data.errorMessage;

    return prisma.splitJob.update({ where: { id }, data: updateData });
  }

  /**
   * Split by size: groups pages such that each output file is <= sizeLimitBytes.
   * Single pages exceeding sizeLimit are placed in their own group (ADR-007).
   * Uses two-pass approach: measure individual page sizes, then greedy bin-pack (ADR-008).
   * Returns SplitRange[] with 1-indexed page numbers.
   */
  async splitBySize(pdfPath: string, sizeLimitBytes: number): Promise<SplitRange[]> {
    const absolutePath = path.resolve(pdfPath);
    const fileBytes = fs.readFileSync(absolutePath);
    const sourcePdf = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
    const totalPages = sourcePdf.getPageCount();

    // Pass 1: Measure each page by extracting it as a standalone PDF
    const pageSizes: number[] = [];
    for (let i = 0; i < totalPages; i++) {
      const singlePagePdf = await PDFDocument.create();
      const [copiedPage] = await singlePagePdf.copyPages(sourcePdf, [i]);
      singlePagePdf.addPage(copiedPage);
      const singlePageBytes = await singlePagePdf.save();
      pageSizes.push(singlePageBytes.byteLength);
    }

    // Pass 2: Greedy bin-packing — accumulate pages until next would exceed limit
    const groups: number[][] = [];
    let currentGroup: number[] = [];
    let currentEstimate = 0;

    for (let i = 0; i < totalPages; i++) {
      if (currentEstimate + pageSizes[i] <= sizeLimitBytes || currentGroup.length === 0) {
        currentGroup.push(i);
        currentEstimate += pageSizes[i];
      } else {
        groups.push(currentGroup);
        currentGroup = [i];
        currentEstimate = pageSizes[i];
      }
    }
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    // Convert 0-indexed groups to 1-indexed SplitRange[]
    return groups.map((group) => ({
      from: group[0] + 1,
      to: group[group.length - 1] + 1,
    }));
  }

  async processSplit(splitJobId: string) {
    const splitJob = await this.getSplitJob(splitJobId);
    if (!splitJob) throw new Error('Split job not found');

    const outputDir = fileService.getAbsoluteOutputDir();
    const absolutePath = path.resolve(splitJob.originalPath);

    try {
      await this.updateSplitJob(splitJobId, { status: 'PROCESSING', progress: 5 });

      if (!fs.existsSync(absolutePath)) {
        throw new Error(`File not found: ${splitJob.originalName}`);
      }

      const fileBytes = fs.readFileSync(absolutePath);
      const sourcePdf = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
      const totalPages = sourcePdf.getPageCount();
      const baseName = path.basename(splitJob.originalName, path.extname(splitJob.originalName));

      let splitRanges: SplitRange[] = [];

      if (splitJob.splitMode === 'range') {
        // Custom ranges or fixed size
        if (splitJob.ranges) {
          splitRanges = JSON.parse(splitJob.ranges as string);
        } else if (splitJob.fixedSize) {
          // Generate fixed-size ranges
          const size = splitJob.fixedSize;
          for (let i = 1; i <= totalPages; i += size) {
            splitRanges.push({
              from: i,
              to: Math.min(i + size - 1, totalPages),
            });
          }
        }
      } else if (splitJob.splitMode === 'pages') {
        if (splitJob.selectedPages) {
          // Select pages mode — extract only specified page numbers
          const selectedPages: number[] = JSON.parse(splitJob.selectedPages as string);
          const validPages = selectedPages.filter((p: number) => p >= 1 && p <= totalPages);
          if (validPages.length === 0) throw new Error('No valid pages selected');
          for (const pageNum of validPages) {
            splitRanges.push({ from: pageNum, to: pageNum });
          }
        } else {
          // Extract every N pages (or each page individually)
          const pagesPerFile = splitJob.pagesPerFile || 1;
          for (let i = 1; i <= totalPages; i += pagesPerFile) {
            splitRanges.push({
              from: i,
              to: Math.min(i + pagesPerFile - 1, totalPages),
            });
          }
        }
      } else if (splitJob.splitMode === 'size') {
        // Split by file size — sizeLimit is stored in MB, convert to bytes
        const sizeLimitMB = splitJob.sizeLimit || 10;
        const sizeLimitBytes = sizeLimitMB * 1024 * 1024;
        splitRanges = await this.splitBySize(absolutePath, sizeLimitBytes);
      }

      if (splitRanges.length === 0) {
        throw new Error('No split ranges specified');
      }

      console.log(`✂️  Splitting "${splitJob.originalName}" (${totalPages} pages) into ${splitRanges.length} files [mode: ${splitJob.splitMode}]`);

      const outputFiles: Array<{ fileName: string; filePath: string; pageCount: number; size: number }> = [];

      for (let i = 0; i < splitRanges.length; i++) {
        const range = splitRanges[i];
        const fromIndex = Math.max(0, range.from - 1);
        const toIndex = Math.min(totalPages - 1, range.to - 1);

        const newPdf = await PDFDocument.create();
        
        // Copy pages from source to new PDF
        const pageIndices = [];
        for (let p = fromIndex; p <= toIndex; p++) {
          pageIndices.push(p);
        }

        if (pageIndices.length > 0) {
          const copiedPages = await newPdf.copyPages(sourcePdf, pageIndices);
          copiedPages.forEach((page) => newPdf.addPage(page));
        }

        const pdfBytes = await newPdf.save();

        let fileName: string;
        if (range.from === range.to) {
          fileName = `${baseName}_page_${range.from}.pdf`;
        } else {
          fileName = `${baseName}_pages_${range.from}-${range.to}.pdf`;
        }

        const outputPath = path.join(outputDir, `split-${Date.now()}-${i + 1}-${fileName}`);
        fs.writeFileSync(outputPath, pdfBytes);

        const fileStats = fs.statSync(outputPath);
        outputFiles.push({
          fileName,
          filePath: outputPath,
          pageCount: pageIndices.length,
          size: fileStats.size,
        });

        const progress = 10 + Math.round(((i + 1) / splitRanges.length) * 80);
        await this.updateSplitJob(splitJobId, { progress });

        console.log(`   ✅ ${fileName} (${pageIndices.length} pages, ${(fileStats.size / 1024).toFixed(1)} KB)`);
      }

      await this.updateSplitJob(splitJobId, {
        status: 'COMPLETED',
        progress: 100,
        outputFiles: JSON.stringify(outputFiles),
      });

      console.log(`   ✅ Split complete: ${outputFiles.length} files created`);
      return { success: true, outputFiles };
    } catch (error: any) {
      console.error(`   ❌ Split failed: ${error.message}`);
      await this.updateSplitJob(splitJobId, {
        status: 'FAILED',
        errorMessage: error.message || 'Split failed',
        progress: 0,
      });
      throw error;
    }
  }

  async getSplitOutputFiles(id: string) {
    const splitJob = await this.getSplitJob(id);
    if (!splitJob || !splitJob.outputFiles) return [];

    try {
      return JSON.parse(splitJob.outputFiles as string);
    } catch {
      return [];
    }
  }
}

export const splitService = new SplitService();
