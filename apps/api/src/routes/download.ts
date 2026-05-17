import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { conversionService } from '../services/conversion.service';
import { AppError } from '../middleware/error.middleware';

export const downloadRouter = Router();

downloadRouter.get('/:id', async (req: Request, res: Response, next: Function) => {
  try {
    const { id } = req.params;
    const conversion = await conversionService.getConversion(id);

    if (!conversion) {
      throw new AppError('Conversion not found', 404);
    }

    if (conversion.status !== 'COMPLETED') {
      throw new AppError('Conversion not completed yet', 400);
    }

    if (!conversion.outputPath) {
      throw new AppError('Output file not available', 404);
    }

    const absolutePath = path.resolve(conversion.outputPath);
    
    if (!fs.existsSync(absolutePath)) {
      throw new AppError('Output file no longer exists', 404);
    }

    const originalName = path.basename(
      conversion.originalName,
      path.extname(conversion.originalName)
    );
    const outputFormat = conversion.outputFormat || 'docx';
    const downloadName = `${originalName}.${outputFormat}`;

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
