import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CreateConversionInput {
  originalName: string;
  originalSize: number;
  originalPath: string;
  userId?: string;
  outputFormat?: string;
}

interface UpdateConversionInput {
  status?: string;
  progress?: number;
  outputPath?: string;
  errorMessage?: string;
}

class ConversionService {
  async createConversion(input: CreateConversionInput) {
    return prisma.conversion.create({
      data: {
        originalName: input.originalName,
        originalSize: input.originalSize,
        originalPath: input.originalPath,
        userId: input.userId || null,
        outputFormat: input.outputFormat || 'docx',
        status: 'PENDING',
        progress: 0,
      },
    });
  }

  async getConversion(id: string) {
    return prisma.conversion.findUnique({
      where: { id },
    });
  }

  async updateConversion(id: string, input: UpdateConversionInput) {
    const data: Record<string, unknown> = {};
    
    if (input.status !== undefined) data.status = input.status;
    if (input.progress !== undefined) data.progress = input.progress;
    if (input.outputPath !== undefined) data.outputPath = input.outputPath;
    if (input.errorMessage !== undefined) data.errorMessage = input.errorMessage;

    return prisma.conversion.update({
      where: { id },
      data,
    });
  }

  async deleteConversion(id: string) {
    return prisma.conversion.delete({
      where: { id },
    });
  }
}

export const conversionService = new ConversionService();
