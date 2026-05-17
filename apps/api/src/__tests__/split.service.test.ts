import fs from 'fs';
import path from 'path';
import os from 'os';
import { PDFDocument } from 'pdf-lib';

// Mock PrismaClient at the import path the source code actually uses
const mockPrisma = {
  splitJob: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

let splitService: any;

beforeAll(() => {
  splitService = require('../services/split.service').splitService;
});

describe('SplitService - splitBySize', () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'split-size-test-'));
  });

  afterAll(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  async function createTestPdf(pageCount: number): Promise<{ pdfPath: string; singlePageSize: number }> {
    const pdf = await PDFDocument.create();
    for (let i = 0; i < pageCount; i++) {
      const page = pdf.addPage([595, 842]);
      page.drawText(`Page ${i + 1}`, { x: 50, y: 750, size: 24 });
    }
    const pdfBytes = await pdf.save();
    const pdfPath = path.join(tempDir, `test-${pageCount}page-${Date.now()}.pdf`);
    fs.writeFileSync(pdfPath, pdfBytes);

    const sourcePdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const singlePdf = await PDFDocument.create();
    const [copiedPage] = await singlePdf.copyPages(sourcePdf, [0]);
    singlePdf.addPage(copiedPage);
    const singleBytes = await singlePdf.save();
    const singlePageSize = singleBytes.byteLength;

    return { pdfPath, singlePageSize };
  }

  // SLICE 1: Trivial case — sizeLimit large enough for all pages → single group
  it('should return a single group containing all pages when sizeLimit exceeds total file size', async () => {
    const { pdfPath } = await createTestPdf(3);
    const fileStats = fs.statSync(pdfPath);
    const largeLimit = fileStats.size * 10;

    const result = await splitService.splitBySize(pdfPath, largeLimit);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ from: 1, to: 3 });
  });

  // SLICE 2: Limit fits ~2 pages per group → splits correctly
  it('should split into multiple groups when sizeLimit forces a boundary', async () => {
    const { pdfPath, singlePageSize } = await createTestPdf(5);
    const twoPageLimit = singlePageSize * 2 + 1;

    const result = await splitService.splitBySize(pdfPath, twoPageLimit);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ from: 1, to: 2 });
    expect(result[1]).toEqual({ from: 3, to: 4 });
    expect(result[2]).toEqual({ from: 5, to: 5 });
  });

  // SLICE 3: Single page exceeds sizeLimit → own group, no error (ADR-007)
  it('should place an oversized page in its own group instead of throwing an error', async () => {
    const { pdfPath, singlePageSize } = await createTestPdf(3);

    // Set limit to half a single page — every page individually exceeds it
    const tinyLimit = Math.floor(singlePageSize / 2);

    const result = await splitService.splitBySize(pdfPath, tinyLimit);

    // Each page becomes its own group despite exceeding the limit
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ from: 1, to: 1 });
    expect(result[1]).toEqual({ from: 2, to: 2 });
    expect(result[2]).toEqual({ from: 3, to: 3 });
  });
});
