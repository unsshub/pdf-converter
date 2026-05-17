import { Router, Request, Response } from 'express';
import { uploadMiddleware } from '../middleware/upload.middleware';
import { conversionService } from '../services/conversion.service';
import { AppError } from '../middleware/error.middleware';
import fs from 'fs';
import path from 'path';

export const uploadRouter = Router();

// POST /api/upload - Upload a file
uploadRouter.post('/', (req: Request, res: Response, next: Function) => {
  uploadMiddleware.single('file')(req, res, (err) => {
    if (err) {
      return next(err);
    }
    next();
  });
}, async (req: Request, res: Response, next: Function) => {
  try {
    if (!req.file) {
      throw new AppError('No file provided', 400);
    }

    const outputFormat = req.body.outputFormat || 'docx';

    const conversion = await conversionService.createConversion({
      originalName: req.file.originalname,
      originalSize: req.file.size,
      originalPath: req.file.path,
      outputFormat,
    });

    res.status(200).json({
      id: conversion.id,
      originalName: conversion.originalName,
      originalSize: conversion.originalSize,
      status: conversion.status,
      outputFormat: conversion.outputFormat,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/upload/convert-from-path - Create conversion from file already on server
uploadRouter.post('/convert-from-path', async (req: Request, res: Response, next: Function) => {
  try {
    const { filePath, fileName, fileSize, outputFormat } = req.body;

    if (!filePath || !fileName) {
      throw new AppError('filePath and fileName are required', 400);
    }

    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
      throw new AppError('File not found on server', 404);
    }

    const actualSize = fileSize || fs.statSync(absolutePath).size;

    const conversion = await conversionService.createConversion({
      originalName: fileName,
      originalSize: actualSize,
      originalPath: absolutePath,
      outputFormat: outputFormat || 'docx',
    });

    res.status(200).json({
      id: conversion.id,
      originalName: conversion.originalName,
      originalSize: conversion.originalSize,
      status: conversion.status,
      outputFormat: conversion.outputFormat,
    });
  } catch (error) {
    next(error);
  }
});
