import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');
const DEFAULT_ZIP_PATH = 'dist/firefox-extension.zip';
const DEFAULT_SOURCE_PATH = 'dist/firefox-source.zip';
const DEFAULT_BASE_URL = 'https://addons.mozilla.org';
const DEFAULT_POLL_INTERVAL_MS = 5000;
const DEFAULT_POLL_MAX_ATTEMPTS = 60;

const APPROVAL_NOTES = [
  'Automated release build from GitHub Actions.',
  'Build environment: Ubuntu (ubuntu-latest), Node.js 24.',
  'Build steps: run `npm ci && make firefox` from the root of the attached source archive.',
  'Output: `dist/firefox_build/` (packaged as `dist/firefox-extension.zip`).',
  'Only `browser-polyfill.js` and `prism/prism.js` are minified during the build using `terser` (version pinned in `package-lock.json`); `background.js`, `content_script.js`, and `options.js` are unminified.',
].join('\n');

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parsePositiveInt(raw, fallback, name) {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive integer for ${name}: ${raw}`);
  }
  return parsed;
}

function assertNonEmptyFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} file does not exist: ${filePath}`);
  }
  const stat = fs.statSync(filePath);
  if (!stat.isFile() || stat.size === 0) {
    throw new Error(`${label} file is empty or not a regular file: ${filePath}`);
  }
}

function getDefaultAddonId() {
  const manifestPath = path.join(ROOT_DIR, 'manifest.firefox.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const geckoId = manifest.browser_specific_settings?.gecko?.id;
  if (!geckoId) {
    throw new Error('Missing browser_specific_settings.gecko.id in manifest.firefox.json');
  }
  return geckoId;
}

function encodeBase64Url(input) {
  return Buffer.from(input).toString('base64url');
}

function createAmoJwt(issuer, secret) {
  const iat = Math.floor(Date.now() / 1000);
  const header = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = encodeBase64Url(
    JSON.stringify({
      iss: issuer,
      jti: crypto.randomUUID(),
      iat,
      exp: iat + 60,
    })
  );
  const signingInput = `${header}.${payload}`;
  const signature = crypto.createHmac('sha256', secret).update(signingInput).digest('base64url');
  return `${signingInput}.${signature}`;
}

async function parseJsonResponse(res, label) {
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${label} returned non-JSON response (${res.status} ${res.statusText}): ${text}`);
  }
  if (!res.ok) {
    throw new Error(`${label} failed (${res.status} ${res.statusText}): ${JSON.stringify(data, null, 2)}`);
  }
  return data;
}

async function uploadAddon({ baseUrl, apiKey, apiSecret, zipPath }) {
  const url = `${baseUrl}/api/v5/addons/upload/`;
  const zipBuffer = fs.readFileSync(zipPath);
  const form = new FormData();
  form.append('upload', new Blob([zipBuffer], { type: 'application/zip' }), path.basename(zipPath));
  form.append('channel', 'listed');

  console.log(`Uploading ${zipPath} (${zipBuffer.length} bytes) to AMO...`);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `JWT ${createAmoJwt(apiKey, apiSecret)}`,
    },
    body: form,
  });

  const data = await parseJsonResponse(res, 'AMO upload');
  if (!data.uuid) {
    throw new Error(`AMO upload response missing uuid: ${JSON.stringify(data, null, 2)}`);
  }
  console.log(`Upload created: uuid=${data.uuid}, processed=${Boolean(data.processed)}`);
  return data;
}

async function waitForValidation({ baseUrl, apiKey, apiSecret, uuid, pollIntervalMs, maxAttempts }) {
  const url = `${baseUrl}/api/v5/addons/upload/${encodeURIComponent(uuid)}/`;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `JWT ${createAmoJwt(apiKey, apiSecret)}`,
      },
    });

    const data = await parseJsonResponse(res, 'AMO upload status');
    console.log(`Poll ${attempt}/${maxAttempts}: processed=${Boolean(data.processed)}, valid=${Boolean(data.valid)}`);

    if (data.processed === true) {
      if (!data.valid) {
        throw new Error(`AMO upload validation failed:\n${JSON.stringify(data.validation ?? data, null, 2)}`);
      }
      return data;
    }

    if (attempt < maxAttempts) {
      await sleep(pollIntervalMs);
    }
  }

  throw new Error(`Timed out after ${maxAttempts} attempts waiting for AMO upload validation.`);
}

async function createVersion({ baseUrl, apiKey, apiSecret, addonId, uploadUuid, sourcePath }) {
  const url = `${baseUrl}/api/v5/addons/addon/${encodeURIComponent(addonId)}/versions/`;
  const sourceBuffer = fs.readFileSync(sourcePath);
  const form = new FormData();
  form.append('upload', uploadUuid);
  form.append('source', new Blob([sourceBuffer], { type: 'application/zip' }), path.basename(sourcePath));
  form.append('approval_notes', APPROVAL_NOTES);

  console.log(`Creating listed AMO version for ${addonId} with source archive ${sourcePath} (${sourceBuffer.length} bytes)...`);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `JWT ${createAmoJwt(apiKey, apiSecret)}`,
    },
    body: form,
  });

  const data = await parseJsonResponse(res, 'AMO version creation');
  const details = [
    `id=${data.id ?? 'unknown'}`,
    `version=${data.version ?? 'unknown'}`,
    data.edit_url ? `edit_url=${data.edit_url}` : null,
  ]
    .filter(Boolean)
    .join(', ');
  console.log(`Submitted to Firefox Add-ons: ${details}`);
  return data;
}

async function main() {
  const apiKey = requireEnv('AMO_API_KEY');
  const apiSecret = requireEnv('AMO_API_SECRET');
  const addonId = process.env.AMO_ADDON_ID?.trim() || getDefaultAddonId();
  const zipPath = path.resolve(process.env.AMO_ZIP_PATH?.trim() || DEFAULT_ZIP_PATH);
  const sourcePath = path.resolve(process.env.AMO_SOURCE_PATH?.trim() || DEFAULT_SOURCE_PATH);
  const baseUrl = (process.env.AMO_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const pollIntervalMs = parsePositiveInt(process.env.AMO_POLL_INTERVAL_MS?.trim(), DEFAULT_POLL_INTERVAL_MS, 'AMO_POLL_INTERVAL_MS');
  const maxAttempts = parsePositiveInt(process.env.AMO_POLL_MAX_ATTEMPTS?.trim(), DEFAULT_POLL_MAX_ATTEMPTS, 'AMO_POLL_MAX_ATTEMPTS');

  assertNonEmptyFile(zipPath, 'Extension zip');
  assertNonEmptyFile(sourcePath, 'Source archive');

  const upload = await uploadAddon({ baseUrl, apiKey, apiSecret, zipPath });
  if (upload.processed !== true) {
    await waitForValidation({ baseUrl, apiKey, apiSecret, uuid: upload.uuid, pollIntervalMs, maxAttempts });
  } else if (!upload.valid) {
    throw new Error(`AMO upload validation failed:\n${JSON.stringify(upload.validation ?? upload, null, 2)}`);
  }

  await createVersion({ baseUrl, apiKey, apiSecret, addonId, uploadUuid: upload.uuid, sourcePath });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
