import { ConversionStatus } from '@pdf-converter/shared';

// Mock the prisma client
const mockPrisma = {
  conversion: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

jest.mock('../../node_modules/.prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

// Import after mocking
let conversionService: typeof import('../services/conversion.service')['conversionService'];

beforeAll(() => {
  conversionService = require('../services/conversion.service').conversionService;
});

describe('ConversionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createConversion', () => {
    it('should create a new conversion record with PENDING status', async () => {
      const input = {
        originalName: 'test.pdf',
        originalSize: 1024,
        originalPath: '/uploads/test-123.pdf',
      };

      const expected = {
        id: 'clx123',
        ...input,
        userId: null,
        outputPath: null,
        status: 'PENDING',
        progress: 0,
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.conversion.create.mockResolvedValue(expected);

      const result = await conversionService.createConversion(input);

      expect(mockPrisma.conversion.create).toHaveBeenCalledWith({
        data: {
          ...input,
          status: 'PENDING',
          progress: 0,
        },
      });
      expect(result.status).toBe('PENDING');
      expect(result.originalName).toBe('test.pdf');
    });
  });

  describe('getConversion', () => {
    it('should return conversion by id', async () => {
      const expected = {
        id: 'clx123',
        originalName: 'test.pdf',
        originalSize: 1024,
        originalPath: '/uploads/test-123.pdf',
        outputPath: null,
        status: 'COMPLETED',
        progress: 100,
        errorMessage: null,
        userId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.conversion.findUnique.mockResolvedValue(expected);

      const result = await conversionService.getConversion('clx123');

      expect(mockPrisma.conversion.findUnique).toHaveBeenCalledWith({
        where: { id: 'clx123' },
      });
      expect(result?.status).toBe('COMPLETED');
    });

    it('should return null for non-existent id', async () => {
      mockPrisma.conversion.findUnique.mockResolvedValue(null);

      const result = await conversionService.getConversion('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateConversion', () => {
    it('should update conversion status and progress', async () => {
      const expected = {
        id: 'clx123',
        originalName: 'test.pdf',
        originalSize: 1024,
        originalPath: '/uploads/test-123.pdf',
        outputPath: null,
        status: 'PROCESSING',
        progress: 50,
        errorMessage: null,
        userId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.conversion.update.mockResolvedValue(expected);

      const result = await conversionService.updateConversion('clx123', {
        status: 'PROCESSING',
        progress: 50,
      });

      expect(mockPrisma.conversion.update).toHaveBeenCalledWith({
        where: { id: 'clx123' },
        data: { status: 'PROCESSING', progress: 50 },
      });
      expect(result.progress).toBe(50);
    });

    it('should update to COMPLETED with outputPath', async () => {
      const expected = {
        id: 'clx123',
        originalName: 'test.pdf',
        originalSize: 1024,
        originalPath: '/uploads/test-123.pdf',
        outputPath: '/outputs/test-123.docx',
        status: 'COMPLETED',
        progress: 100,
        errorMessage: null,
        userId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.conversion.update.mockResolvedValue(expected);

      const result = await conversionService.updateConversion('clx123', {
        status: 'COMPLETED',
        progress: 100,
        outputPath: '/outputs/test-123.docx',
      });

      expect(result.status).toBe('COMPLETED');
      expect(result.outputPath).toBe('/outputs/test-123.docx');
    });

    it('should update to FAILED with errorMessage', async () => {
      const expected = {
        id: 'clx123',
        originalName: 'test.pdf',
        originalSize: 1024,
        originalPath: '/uploads/test-123.pdf',
        outputPath: null,
        status: 'FAILED',
        progress: 0,
        errorMessage: 'Conversion engine error',
        userId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.conversion.update.mockResolvedValue(expected);

      const result = await conversionService.updateConversion('clx123', {
        status: 'FAILED',
        errorMessage: 'Conversion engine error',
      });

      expect(result.status).toBe('FAILED');
      expect(result.errorMessage).toBe('Conversion engine error');
    });
  });

  describe('deleteConversion', () => {
    it('should delete a conversion record', async () => {
      const expected = {
        id: 'clx123',
        originalName: 'test.pdf',
        originalSize: 1024,
        originalPath: '/uploads/test-123.pdf',
        outputPath: null,
        status: 'PENDING',
        progress: 0,
        errorMessage: null,
        userId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.conversion.delete.mockResolvedValue(expected);

      await conversionService.deleteConversion('clx123');

      expect(mockPrisma.conversion.delete).toHaveBeenCalledWith({
        where: { id: 'clx123' },
      });
    });
  });
});
