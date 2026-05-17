import fs from 'fs';
import path from 'path';
import { config } from '../config';

class FileService {
  private uploadDir: string;
  private outputDir: string;

  constructor() {
    this.uploadDir = path.resolve(config.uploadDir);
    this.outputDir = path.resolve(config.outputDir);
    this.ensureDirectories();
  }

  private ensureDirectories() {
    const dirs = [this.uploadDir, this.outputDir];
    dirs.forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error(`Failed to delete file: ${filePath}`, error);
    }
  }

  async fileExists(filePath: string): Promise<boolean> {
    return fs.existsSync(filePath);
  }

  getFileExtension(filename: string): string {
    return path.extname(filename).toLowerCase();
  }

  generateOutputPath(originalPath: string, outputFormat: string = 'docx'): string {
    const basename = path.basename(originalPath, path.extname(originalPath));
    return path.join(this.outputDir, `${basename}.${outputFormat}`);
  }

  generateUniqueFilename(originalName: string): string {
    const ext = path.extname(originalName);
    const name = path.basename(originalName, ext);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${name}-${timestamp}-${random}${ext}`;
  }

  getAbsoluteUploadDir(): string {
    return this.uploadDir;
  }

  getAbsoluteOutputDir(): string {
    return this.outputDir;
  }

  resolveUploadPath(filename: string): string {
    return path.resolve(this.uploadDir, filename);
  }

  resolveOutputPath(filename: string): string {
    return path.resolve(this.outputDir, filename);
  }
}

export const fileService = new FileService();
