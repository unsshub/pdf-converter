import express from 'express';
import cors from 'cors';
import { config } from './config';
import { uploadRouter } from './routes/upload';
import { convertRouter } from './routes/convert';
import { downloadRouter } from './routes/download';
import { mergeRouter } from './routes/merge';
import { splitRouter } from './routes/split';
import { cloudRouter } from './routes/cloud';
import { dropboxAuthRouter } from './routes/dropbox-auth';
import { errorHandler } from './middleware/error.middleware';

const app = express();

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/upload', uploadRouter);
app.use('/api/convert', convertRouter);
app.use('/api/download', downloadRouter);
app.use('/api/merge', mergeRouter);
app.use('/api/split', splitRouter);
app.use('/api/cloud', cloudRouter);
app.use('/api/dropbox-auth', dropboxAuthRouter);

app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log(`🚀 API Server running on port ${config.port}`);
  console.log(`📍 Environment: ${config.nodeEnv}`);
  console.log(`🔗 Health check: http://localhost:${config.port}/api/health`);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close();
  const { PrismaClient } = require('@prisma/client');
  await new PrismaClient().$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close();
  const { PrismaClient } = require('@prisma/client');
  await new PrismaClient().$disconnect();
  process.exit(0);
});

export default app;
