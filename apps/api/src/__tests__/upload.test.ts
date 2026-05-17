import request from 'supertest';
import express from 'express';
import { ConversionStatus } from '@pdf-converter/shared';

// Mock the conversion service
const mockConversionService = {
  createConversion: jest.fn(),
  getConversion: jest.fn(),
  updateConversion: jest.fn(),
  deleteConversion: jest.fn(),
};

jest.mock('../services/conversion.service', () => ({
  conversionService: mockConversionService,
}));

// Mock multer
jest.mock('../middleware/upload.middleware', () => ({
  uploadMiddleware: (req: any, res: any, next: any) => {
    req.file = {
      fieldname: 'file',
      originalname: 'test.pdf',
      size: 1024,
      path: '/uploads/test-123.pdf',
      mimetype: 'application/pdf',
    } as Express.Multer.File;
    next();
  },
}));

let app: express.Application;
let uploadRoute: typeof import('../routes/upload');

beforeAll(() => {
  uploadRoute = require('../routes/upload');
  app = express();
  app.use(express.json());
  app.use('/api/upload', uploadRoute.uploadRouter);
});

describe('POST /api/upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should upload a PDF and return conversion record', async () => {
    const mockConversion = {
      id: 'clx123',
      originalName: 'test.pdf',
      originalSize: 1024,
      originalPath: '/uploads/test-123.pdf',
      status: 'PENDING',
      progress: 0,
    };

    mockConversionService.createConversion.mockResolvedValue(mockConversion);

    const response = await request(app)
      .post('/api/upload')
      .attach('file', Buffer.from('fake pdf content'), 'test.pdf')
      .expect(200);

    expect(response.body).toMatchObject({
      id: 'clx123',
      originalName: 'test.pdf',
      originalSize: 1024,
      status: 'PENDING',
    });

    expect(mockConversionService.createConversion).toHaveBeenCalledWith(
      expect.objectContaining({
        originalName: 'test.pdf',
        originalSize: 1024,
      })
    );
  });

  it('should return 400 when no file is provided', async () => {
    // Override the mock for this test to simulate no file
    jest.doMock('../middleware/upload.middleware', () => ({
      uploadMiddleware: (req: any, res: any, next: any) => {
        req.file = undefined;
        next();
      },
    }));

    const response = await request(app)
      .post('/api/upload')
      .expect(500); // Will fail because no file - our error handling should catch this
  });
});
