import { Router, Request, Response } from 'express';
import { conversionService } from '../services/conversion.service';
import { fileService } from '../services/file.service';
import { AppError } from '../middleware/error.middleware';
import path from 'path';
import fs from 'fs';

export const cloudRouter = Router();

// POST /api/cloud/download/drive - Download file from Google Drive
cloudRouter.post('/download/drive', async (req: Request, res: Response, next: Function) => {
  try {
    const { accessToken, fileId, fileName } = req.body;

    if (!accessToken || !fileId || !fileName) {
      throw new AppError('accessToken, fileId, and fileName are required', 400);
    }

    console.log(`☁️  Downloading from Google Drive: ${fileName} (${fileId})`);

    // Use the Drive API v3 with alt=media to get the actual file content
    const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;
    const response = await fetch(driveUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Google Drive download failed: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorMessage;

        // Handle specific error codes
        if (response.status === 403) {
          errorMessage = 'Google Drive access denied. The file may be shared differently or the token has expired. Please try selecting the file again.';
        } else if (response.status === 404) {
          errorMessage = 'File not found on Google Drive. It may have been moved or deleted.';
        }
      } catch {}
      console.error(`   ❌ Google Drive error: ${errorMessage}`);
      throw new AppError(errorMessage, 502);
    }

    // Validate PDF header
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const header = buffer.slice(0, 5).toString('ascii');

    if (header !== '%PDF-') {
      console.error(`   ❌ Invalid PDF from Google Drive: header="${header}"`);
      throw new AppError('Downloaded file is not a valid PDF.', 502);
    }

    const uniqueName = fileService.generateUniqueFilename(fileName);
    const uploadDir = fileService.getAbsoluteUploadDir();
    const filePath = path.join(uploadDir, uniqueName);

    fs.writeFileSync(filePath, buffer);
    console.log(`   ✅ Saved: ${filePath} (${(buffer.length / 1024).toFixed(1)} KB)`);

    res.status(200).json({
      filePath,
      fileName,
      fileSize: buffer.length,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/cloud/download/dropbox - Download file from Dropbox (legacy Chooser)
cloudRouter.post('/download/dropbox', async (req: Request, res: Response, next: Function) => {
  try {
    const { link, fileName } = req.body;

    if (!link || !fileName) {
      throw new AppError('link and fileName are required', 400);
    }

    console.log(`☁️  Downloading from Dropbox: ${fileName}`);

    const downloadUrl = link.replace(/\?dl=\d/, '?dl=1');
    const response = await fetch(downloadUrl);

    if (!response.ok) {
      throw new AppError(`Dropbox download failed: ${response.status}`, 502);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const header = buffer.slice(0, 5).toString('ascii');

    if (header !== '%PDF-') {
      throw new AppError('Downloaded file is not a valid PDF.', 502);
    }

    const uniqueName = fileService.generateUniqueFilename(fileName);
    const uploadDir = fileService.getAbsoluteUploadDir();
    const filePath = path.join(uploadDir, uniqueName);

    fs.writeFileSync(filePath, buffer);
    console.log(`   ✅ Saved: ${filePath} (${(buffer.length / 1024).toFixed(1)} KB)`);

    res.status(200).json({
      filePath,
      fileName,
      fileSize: buffer.length,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/cloud/convert/drive - Download from Google Drive + start conversion
cloudRouter.post('/convert/drive', async (req: Request, res: Response, next: Function) => {
  try {
    const { accessToken, fileId, fileName } = req.body;

    if (!accessToken || !fileId || !fileName) {
      throw new AppError('accessToken, fileId, and fileName are required', 400);
    }

    console.log(`☁️  Google Drive → Convert: ${fileName}`);

    const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;
    const driveResponse = await fetch(driveUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!driveResponse.ok) {
      const errorText = await driveResponse.text();
      let errorMessage = `Google Drive download failed: ${driveResponse.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorMessage;
        if (driveResponse.status === 403) {
          errorMessage = 'Google Drive access denied. Please try selecting the file again.';
        }
      } catch {}
      throw new AppError(errorMessage, 502);
    }

    const arrayBuffer = await driveResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const header = buffer.slice(0, 5).toString('ascii');

    if (header !== '%PDF-') {
      throw new AppError('Downloaded file is not a valid PDF.', 502);
    }

    const uniqueName = fileService.generateUniqueFilename(fileName);
    const uploadDir = fileService.getAbsoluteUploadDir();
    const filePath = path.join(uploadDir, uniqueName);

    fs.writeFileSync(filePath, buffer);

    const fileSize = buffer.length;

    const conversion = await conversionService.createConversion({
      originalName: fileName,
      originalSize: fileSize,
      originalPath: filePath,
    });

    res.status(200).json({
      id: conversion.id,
      originalName: conversion.originalName,
      originalSize: conversion.originalSize,
      status: conversion.status,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/cloud/convert/dropbox - Download from Dropbox + start conversion
cloudRouter.post('/convert/dropbox', async (req: Request, res: Response, next: Function) => {
  try {
    const { link, fileName } = req.body;

    if (!link || !fileName) {
      throw new AppError('link and fileName are required', 400);
    }

    console.log(`☁️  Dropbox → Convert: ${fileName}`);

    const downloadUrl = link.replace(/\?dl=\d/, '?dl=1');
    const dropboxResponse = await fetch(downloadUrl);

    if (!dropboxResponse.ok) {
      throw new AppError(`Dropbox download failed: ${dropboxResponse.status}`, 502);
    }

    const arrayBuffer = await dropboxResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const header = buffer.slice(0, 5).toString('ascii');

    if (header !== '%PDF-') {
      throw new AppError('Downloaded file is not a valid PDF.', 502);
    }

    const uniqueName = fileService.generateUniqueFilename(fileName);
    const uploadDir = fileService.getAbsoluteUploadDir();
    const filePath = path.join(uploadDir, uniqueName);

    fs.writeFileSync(filePath, buffer);

    const fileSize = buffer.length;

    const conversion = await conversionService.createConversion({
      originalName: fileName,
      originalSize: fileSize,
      originalPath: filePath,
    });

    res.status(200).json({
      id: conversion.id,
      originalName: conversion.originalName,
      originalSize: conversion.originalSize,
      status: conversion.status,
    });
  } catch (error) {
    next(error);
  }
});
