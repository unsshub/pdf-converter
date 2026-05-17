const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// ========== Script Loader ==========

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

// ========== Google Drive Pre-load ==========

let googleLoaded = false;
let googleLoading: Promise<void> | null = null;

export async function preloadGoogleSDK(): Promise<void> {
  if (googleLoaded) return;
  if (googleLoading) return googleLoading;

  googleLoading = Promise.all([
    loadScript('https://apis.google.com/js/api.js'),
    loadScript('https://accounts.google.com/gsi/client'),
  ]).then(async () => {
    await new Promise<void>((resolve, reject) => {
      window.gapi.load('picker', {
        callback: () => { googleLoaded = true; resolve(); },
        onerror: () => reject(new Error('Failed to load Google Picker API')),
      });
    });
  }).catch((err) => {
    console.warn('Failed to pre-load Google SDK:', err);
    googleLoading = null;
  });

  return googleLoading;
}

// ========== Type Declarations ==========

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

// ========== Google Drive Picker ==========

export async function openGoogleDrivePicker(
  clientId: string,
  apiKey: string,
  multiSelect: boolean = false
): Promise<Array<{ fileId: string; fileName: string; accessToken: string }>> {
  await preloadGoogleSDK();

  const accessToken = await new Promise<string>((resolve, reject) => {
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      callback: (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        resolve(response.access_token);
      },
      error_callback: (error: any) => {
        reject(new Error(error.message || 'Google auth failed'));
      },
    });
    tokenClient.requestAccessToken({ prompt: '' });
  });

  const files = await new Promise<Array<{ fileId: string; fileName: string; accessToken: string }>>((resolve, reject) => {
    const view = new window.google.picker.View(window.google.picker.ViewId.DOCS);
    view.setMimeTypes('application/pdf');

    let builder = new window.google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey)
      .setCallback((data: any) => {
        if (data.action === window.google.picker.Action.PICKED) {
          const selected = data.docs.map((doc: any) => ({
            fileId: doc.id,
            fileName: doc.name,
            accessToken,
          }));
          resolve(selected);
        } else if (data.action === window.google.picker.Action.CANCEL) {
          resolve([]);
        }
      });

    if (multiSelect) {
      builder = builder.enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED);
    }

    builder.build().setVisible(true);
  });

  return files;
}

// ========== Dropbox OAuth Redirect Flow ==========

export function openDropboxOAuth(multiSelect: boolean = false): Promise<Array<{ path: string; fileName: string; accessToken: string }>> {
  return new Promise((resolve, reject) => {
    fetch(`${API_BASE}/dropbox-auth/url`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.authUrl) {
          reject(new Error('Failed to get Dropbox auth URL. Is DROPBOX_CLIENT_ID configured?'));
          return;
        }

        const modeParam = `&mode=${multiSelect ? 'multi' : 'single'}`;
        const authUrl = data.authUrl + modeParam;
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const authWindow = window.open(
          authUrl,
          'dropbox-auth',
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
        );

        if (!authWindow) {
          reject(new Error('Popup blocked. Please allow popups for this site.'));
          return;
        }

        const handleMessage = (event: MessageEvent) => {
          if (event.data?.type === 'dropbox-file-selected') {
            window.removeEventListener('message', handleMessage);
            const files = event.data.files.map((f: any) => ({
              path: f.path,
              fileName: f.name,
              accessToken: f.accessToken,
            }));
            resolve(files);
          }
        };

        window.addEventListener('message', handleMessage);

        setTimeout(() => {
          window.removeEventListener('message', handleMessage);
          reject(new Error('Dropbox selection timed out'));
        }, 300000);
      })
      .catch((err) => reject(err));
  });
}

// ========== Server Proxy Downloads ==========

export async function downloadFromDrive(
  accessToken: string,
  fileId: string,
  fileName: string
): Promise<{ filePath: string; fileName: string; fileSize: number }> {
  const response = await fetch(`${API_BASE}/cloud/download/drive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken, fileId, fileName }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Download failed' }));
    throw new Error(error.message || `Download failed: ${response.status}`);
  }

  return response.json();
}

export async function downloadFromDropbox(
  accessToken: string,
  filePath: string,
  fileName: string
): Promise<{ filePath: string; fileName: string; fileSize: number }> {
  const response = await fetch(`${API_BASE}/dropbox-auth/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken, path: filePath }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Download failed' }));
    throw new Error(error.message || `Download failed: ${response.status}`);
  }

  return response.json();
}

// ========== Configuration Check ==========

export function getCloudConfig() {
  return {
    googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
    googleApiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '',
    dropboxEnabled: true, // Always enabled now — uses OAuth redirect, no SDK needed
    googleDriveEnabled: !!(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && process.env.NEXT_PUBLIC_GOOGLE_API_KEY),
  };
}
