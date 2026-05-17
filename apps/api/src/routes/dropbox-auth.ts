import { Router, Request, Response } from 'express';
import { AppError } from '../middleware/error.middleware';
import path from 'path';
import fs from 'fs';

export const dropboxAuthRouter = Router();

const DROPBOX_CLIENT_ID = process.env.DROPBOX_CLIENT_ID || '';
const DROPBOX_CLIENT_SECRET = process.env.DROPBOX_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.DROPBOX_REDIRECT_URI || 'http://localhost:3001/api/dropbox-auth/callback';

// GET /api/dropbox-auth/url - Get the Dropbox authorization URL
dropboxAuthRouter.get('/url', (_req: Request, res: Response, next: Function) => {
  try {
    if (!DROPBOX_CLIENT_ID) {
      throw new AppError('Dropbox not configured on server', 500);
    }

    const state = Math.random().toString(36).substring(2, 15);
    const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${DROPBOX_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${state}&token_access_type=offline`;

    res.json({ authUrl, state });
  } catch (error) {
    next(error);
  }
});

// GET /api/dropbox-auth/callback - OAuth callback
dropboxAuthRouter.get('/callback', async (req: Request, res: Response, next: Function) => {
  try {
    const { code, error: oauthError, error_description } = req.query;

    if (oauthError) {
      return res.redirect(`http://localhost:3000/dropbox-callback?error=${encodeURIComponent(error_description as string || oauthError as string)}`);
    }

    if (!code) {
      return res.redirect(`http://localhost:3000/dropbox-callback?error=No+authorization+code+received`);
    }

    const tokenResponse = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code as string,
        grant_type: 'authorization_code',
        client_id: DROPBOX_CLIENT_ID,
        client_secret: DROPBOX_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errData = await tokenResponse.json().catch(() => ({}));
      console.error('Token exchange failed:', errData);
      return res.redirect(`http://localhost:3000/dropbox-callback?error=${encodeURIComponent('Failed to get access token')}`);
    }

    const tokenData = await tokenResponse.json();
    const redirectUrl = `http://localhost:3000/dropbox-callback?access_token=${encodeURIComponent(tokenData.access_token)}`;

    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Dropbox OAuth callback error:', error);
    res.redirect(`http://localhost:3000/dropbox-callback?error=${encodeURIComponent('OAuth callback failed')}`);
  }
});

// POST /api/dropbox-auth/files - List PDF files
dropboxAuthRouter.post('/files', async (req: Request, res: Response, next: Function) => {
  try {
    const { accessToken, path: filePath = '' } = req.body;

    if (!accessToken) {
      throw new AppError('Access token is required', 400);
    }

    const response = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: filePath || '',
        limit: 100,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new AppError(errData.error_summary || 'Failed to list Dropbox files', 502);
    }

    const data = await response.json();

    const items = data.entries
      .filter((entry: any) => entry['.tag'] === 'folder' || (entry.name && entry.name.toLowerCase().endsWith('.pdf')))
      .map((entry: any) => ({
        id: entry.id,
        name: entry.name,
        type: entry['.tag'],
        path: entry.path_lower,
        size: entry.size || 0,
        modified: entry.server_modified || entry.client_modified,
      }));

    res.json({ items, hasMore: data.has_more, cursor: data.cursor });
  } catch (error) {
    next(error);
  }
});

// POST /api/dropbox-auth/files/continue - Pagination
dropboxAuthRouter.post('/files/continue', async (req: Request, res: Response, next: Function) => {
  try {
    const { accessToken, cursor } = req.body;

    if (!accessToken || !cursor) {
      throw new AppError('accessToken and cursor are required', 400);
    }

    const response = await fetch('https://api.dropboxapi.com/2/files/list_folder/continue', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cursor }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new AppError(errData.error_summary || 'Failed to list more files', 502);
    }

    const data = await response.json();

    const items = data.entries
      .filter((entry: any) => entry['.tag'] === 'folder' || (entry.name && entry.name.toLowerCase().endsWith('.pdf')))
      .map((entry: any) => ({
        id: entry.id,
        name: entry.name,
        type: entry['.tag'],
        path: entry.path_lower,
        size: entry.size || 0,
        modified: entry.server_modified || entry.client_modified,
      }));

    res.json({ items, hasMore: data.has_more, cursor: data.cursor });
  } catch (error) {
    next(error);
  }
});

// POST /api/dropbox-auth/download - Download a file from Dropbox
dropboxAuthRouter.post('/download', async (req: Request, res: Response, next: Function) => {
  try {
    const { accessToken, path: filePath } = req.body;

    if (!accessToken || !filePath) {
      throw new AppError('accessToken and path are required', 400);
    }

    console.log(`☁️  Downloading from Dropbox API: ${filePath}`);

    const response = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Dropbox-API-Arg': JSON.stringify({ path: filePath }),
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = `Dropbox download failed: ${response.status}`;
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson.error_summary || errMsg;
      } catch {}
      console.error(`   ❌ Dropbox download error: ${errMsg}`);
      throw new AppError(errMsg, 502);
    }

    // Validate that the response is actually a PDF
    const contentType = response.headers.get('content-type') || '';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Check PDF header — every valid PDF starts with %PDF
    const header = buffer.slice(0, 5).toString('ascii');
    if (header !== '%PDF-') {
      console.error(`   ❌ Invalid PDF header: "${header}" (expected "%PDF-")`);
      console.error(`   Response content-type: ${contentType}`);
      console.error(`   Response size: ${buffer.length} bytes`);
      console.error(`   First 200 bytes: ${buffer.slice(0, 200).toString('utf-8')}`);
      throw new AppError('Downloaded file is not a valid PDF. The Dropbox download may have returned an error page.', 502);
    }

    // Save to uploads directory
    const { fileService } = require('../services/file.service');
    const fileName = filePath.split('/').pop() || 'file.pdf';
    const uniqueName = fileService.generateUniqueFilename(fileName);
    const uploadDir = fileService.getAbsoluteUploadDir();
    const fullPath = path.join(uploadDir, uniqueName);

    fs.writeFileSync(fullPath, buffer);

    console.log(`   ✅ Saved: ${fullPath} (${(buffer.length / 1024).toFixed(1)} KB)`);

    res.json({
      filePath: fullPath,
      fileName,
      fileSize: buffer.length,
    });
  } catch (error) {
    next(error);
  }
});
