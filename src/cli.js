#!/usr/bin/env node

import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ConfigError,
  applySettings,
  getStatus,
  resolveConfigPath,
  revertSettings,
} from './config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const MAX_BODY_BYTES = 8 * 1024;
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};
const STATIC_ROUTES = new Map([
  ['/', 'index.html'],
  ['/app.js', 'app.js'],
  ['/styles.css', 'styles.css'],
  ['/mark.svg', 'mark.svg'],
  ['/public-sans.woff2', 'public-sans.woff2'],
  ['/site.webmanifest', 'site.webmanifest'],
]);

function parseArguments(argv) {
  const options = { open: true, port: 0, configPath: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--no-open') options.open = false;
    else if (argument === '--port') options.port = Number(argv[++index]);
    else if (argument === '--config') options.configPath = argv[++index];
    else if (argument === '--help' || argument === '-h') options.help = true;
    else throw new ConfigError(`Unknown option: ${argument}`, 'UNKNOWN_OPTION');
  }
  if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65535) {
    throw new ConfigError('Port must be an integer from 0 to 65535.', 'INVALID_PORT');
  }
  return options;
}

function printHelp() {
  console.log(`Codex Context Switch

Usage:
  codex-context-switch [--no-open] [--port <number>]

Options:
  --no-open        Do not open the browser automatically
  --port <number>  Bind a specific localhost port (default: available port)
  --config <path>  Use another config.toml path (testing/advanced)
  -h, --help       Show this help`);
}

function securityHeaders(response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "connect-src 'self'",
    "img-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "font-src 'self'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; '));
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
}

function sendJson(response, status, payload, token) {
  securityHeaders(response);
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (token) response.setHeader('X-Context-Switch-Token', token);
  response.end(`${JSON.stringify(payload)}\n`);
}

async function readJson(request) {
  const contentType = request.headers['content-type'] ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new ConfigError('Requests must use application/json.', 'INVALID_CONTENT_TYPE', 415);
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new ConfigError('Request body is too large.', 'BODY_TOO_LARGE', 413);
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new ConfigError('Request body is not valid JSON.', 'INVALID_JSON');
  }
}

async function serveStatic(response, pathname) {
  const filename = STATIC_ROUTES.get(pathname);
  if (!filename) return false;
  const target = path.join(PUBLIC, filename);
  const metadata = await stat(target);
  securityHeaders(response);
  response.statusCode = 200;
  response.setHeader('Content-Type', MIME_TYPES[path.extname(filename)] ?? 'application/octet-stream');
  response.setHeader('Content-Length', metadata.size);
  createReadStream(target).pipe(response);
  return true;
}

function openBrowser(url) {
  const command = process.platform === 'win32'
    ? ['explorer.exe', [url]]
    : process.platform === 'darwin'
      ? ['open', [url]]
      : ['xdg-open', [url]];
  const child = spawn(command[0], command[1], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.on('error', () => {});
  child.unref();
}

export function createAppServer({ configPath, token = randomBytes(24).toString('base64url') }) {
  let origin = null;
  const server = http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url, origin ?? 'http://127.0.0.1');
      const pathname = requestUrl.pathname;

      if (request.method === 'GET' && pathname === '/api/status') {
        const status = await getStatus(configPath);
        sendJson(response, 200, status, token);
        return;
      }

      if (request.method === 'POST' && (pathname === '/api/apply' || pathname === '/api/revert')) {
        if (request.headers.origin !== origin || request.headers['x-context-switch-token'] !== token) {
          throw new ConfigError('Request verification failed.', 'INVALID_REQUEST_TOKEN', 403);
        }
        const payload = await readJson(request);
        const status = pathname === '/api/apply'
          ? await applySettings(configPath, payload.contextWindow, payload.compactLimit)
          : await revertSettings(configPath);
        sendJson(response, 200, status, token);
        return;
      }

      if (request.method === 'GET' && await serveStatic(response, pathname)) return;
      sendJson(response, 404, { error: 'Not found', code: 'NOT_FOUND' });
    } catch (error) {
      const safeError = error instanceof ConfigError
        ? error
        : new ConfigError('The local operation failed. No settings were intentionally changed.', 'INTERNAL_ERROR', 500);
      if (!(error instanceof ConfigError)) console.error(error);
      if (!response.headersSent) {
        sendJson(response, safeError.status, { error: safeError.message, code: safeError.code });
      } else {
        response.destroy();
      }
    }
  });

  server.setOrigin = (value) => { origin = value; };
  return server;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const configPath = resolveConfigPath(options.configPath);
  const server = createAppServer({ configPath });
  server.listen(options.port, '127.0.0.1', () => {
    const address = server.address();
    const origin = `http://127.0.0.1:${address.port}`;
    server.setOrigin(origin);
    console.log(`\nCodex Context Switch is running locally:\n${origin}\n`);
    console.log(`Config: ${configPath}`);
    console.log('Press Ctrl+C to close.\n');
    if (options.open) openBrowser(origin);
  });

  const close = () => server.close(() => process.exit(0));
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
