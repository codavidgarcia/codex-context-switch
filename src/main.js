import {
  app,
  BrowserWindow,
  ipcMain,
  net,
  protocol,
  screen,
  session,
} from 'electron';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  applySettings,
  getStatus,
  resolveConfigPath,
  revertSettings,
} from './config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const APP_ORIGIN = 'app://bundle';
const APP_ID = 'com.codavidgarcia.codex-context-switch';
const COLLAPSED_HEIGHT = 520;
const EXPANDED_HEIGHT = 570;
const CONFIG_PATH = resolveConfigPath();
const ASSET_ALLOWLIST = new Set([
  '/index.html',
  '/styles.css',
  '/app.js',
]);

function serialiseError(error) {
  return {
    code: typeof error?.code === 'string' ? error.code : 'UNEXPECTED_ERROR',
  };
}

async function safely(operation) {
  try {
    return { ok: true, value: await operation() };
  } catch (error) {
    return { ok: false, error: serialiseError(error) };
  }
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
    },
  },
]);

let mainWindow = null;

function assertTrustedSender(event) {
  const senderUrl = event.senderFrame?.url;
  if (!senderUrl) throw new Error('Missing IPC sender.');
  const parsed = new URL(senderUrl);
  if (parsed.protocol !== 'app:' || parsed.host !== 'bundle') {
    throw new Error('Untrusted IPC sender.');
  }
}

function registerIpc() {
  ipcMain.handle('context-switch:status', async (event) => {
    assertTrustedSender(event);
    return safely(async () => ({
      ...(await getStatus(CONFIG_PATH)),
      locale: app.getLocale(),
      platform: process.platform,
    }));
  });

  ipcMain.handle('context-switch:apply', async (event, settings) => {
    assertTrustedSender(event);
    return safely(() => applySettings(
      CONFIG_PATH,
      settings?.contextWindow,
      settings?.compactLimit,
    ));
  });

  ipcMain.handle('context-switch:revert', async (event) => {
    assertTrustedSender(event);
    return safely(() => revertSettings(CONFIG_PATH));
  });

  ipcMain.on('context-switch:advanced', (event, open) => {
    assertTrustedSender(event);
    if (!mainWindow || typeof open !== 'boolean') return;
    const bounds = mainWindow.getBounds();
    const height = open ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT;
    const workArea = screen.getDisplayMatching(bounds).workArea;
    const y = Math.max(workArea.y, Math.min(bounds.y, workArea.y + workArea.height - height));
    mainWindow.setBounds({ ...bounds, y, height });
  });
}

function registerAppProtocol() {
  protocol.handle('app', (request) => {
    const requestUrl = new URL(request.url);
    const pathname = decodeURIComponent(requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname);
    if (requestUrl.host !== 'bundle' || !ASSET_ALLOWLIST.has(pathname)) {
      return new Response('Not found', { status: 404 });
    }
    return net.fetch(pathToFileURL(path.join(PUBLIC, pathname.slice(1))).toString());
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 560,
    height: COLLAPSED_HEIGHT,
    resizable: false,
    maximizable: false,
    show: true,
    backgroundColor: '#f4f5f3',
    autoHideMenuBar: true,
    title: 'Context Switch',
    webPreferences: {
      preload: path.join(ROOT, 'src', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(APP_ORIGIN)) event.preventDefault();
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.loadURL(`${APP_ORIGIN}/index.html`);
}

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.quit();
} else {
  app.setAppUserModelId(APP_ID);
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    registerAppProtocol();
    registerIpc();
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
