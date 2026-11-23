import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const DEFAULT_ITEM_ID = 'lclohacjbfchomeeopaffkedfnbjicdn';
const DEFAULT_ZIP_PATH = 'dist/chrome-extension.zip';
const DEFAULT_BASE_URL = 'https://chromewebstore.googleapis.com';
const DEFAULT_POLL_INTERVAL_MS = 5000;
const DEFAULT_POLL_MAX_ATTEMPTS = 60;

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

function assertNonEmptyFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Package file does not exist: ${filePath}`);
  }
  const stat = fs.statSync(filePath);
  if (!stat.isFile() || stat.size === 0) {
    throw new Error(`Package file is empty or not a regular file: ${filePath}`);
  }
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

async function uploadPackage({ baseUrl, publisherId, itemId, accessToken, zipPath }) {
  const url = `${baseUrl}/upload/v2/publishers/${encodeURIComponent(publisherId)}/items/${encodeURIComponent(itemId)}:upload`;
  const zipBuffer = fs.readFileSync(zipPath);

  console.log(`Uploading ${zipPath} (${zipBuffer.length} bytes) to Chrome Web Store...`);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/zip',
    },
    body: zipBuffer,
  });

  const data = await parseJsonResponse(res, 'Chrome Web Store upload');
  console.log(`Upload response: itemId=${data.itemId ?? itemId}, crxVersion=${data.crxVersion ?? 'pending'}, uploadState=${data.uploadState}`);
  return data;
}

async function waitForUpload({ baseUrl, publisherId, itemId, accessToken, pollIntervalMs, maxAttempts }) {
  const url = `${baseUrl}/v2/publishers/${encodeURIComponent(publisherId)}/items/${encodeURIComponent(itemId)}:fetchStatus`;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await sleep(pollIntervalMs);
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await parseJsonResponse(res, 'Chrome Web Store fetchStatus');
    const state = data.lastAsyncUploadState;
    console.log(`Poll ${attempt}/${maxAttempts}: lastAsyncUploadState=${state}`);

    if (state === 'SUCCEEDED') {
      return data;
    }
    if (state !== 'IN_PROGRESS') {
      throw new Error(`Chrome Web Store async upload failed: ${JSON.stringify(data, null, 2)}`);
    }
  }

  throw new Error(`Timed out after ${maxAttempts} attempts waiting for Chrome Web Store upload to finish.`);
}

async function publishItem({ baseUrl, publisherId, itemId, accessToken }) {
  const url = `${baseUrl}/v2/publishers/${encodeURIComponent(publisherId)}/items/${encodeURIComponent(itemId)}:publish`;

  console.log(`Publishing item ${itemId} on Chrome Web Store...`);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ publishType: 'DEFAULT_PUBLISH' }),
  });

  const data = await parseJsonResponse(res, 'Chrome Web Store publish');
  console.log(`Published to Chrome Web Store: itemId=${data.itemId ?? itemId}, state=${data.state ?? 'unknown'}`);
  return data;
}

async function main() {
  const accessToken = requireEnv('CWS_ACCESS_TOKEN');
  const publisherId = requireEnv('CWS_PUBLISHER_ID');
  const itemId = process.env.CWS_ITEM_ID?.trim() || DEFAULT_ITEM_ID;
  const zipPath = path.resolve(process.env.CWS_ZIP_PATH?.trim() || DEFAULT_ZIP_PATH);
  const baseUrl = (process.env.CWS_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const pollIntervalMs = parsePositiveInt(process.env.CWS_POLL_INTERVAL_MS?.trim(), DEFAULT_POLL_INTERVAL_MS, 'CWS_POLL_INTERVAL_MS');
  const maxAttempts = parsePositiveInt(process.env.CWS_POLL_MAX_ATTEMPTS?.trim(), DEFAULT_POLL_MAX_ATTEMPTS, 'CWS_POLL_MAX_ATTEMPTS');

  assertNonEmptyFile(zipPath);

  const uploadResult = await uploadPackage({ baseUrl, publisherId, itemId, accessToken, zipPath });

  if (uploadResult.uploadState === 'IN_PROGRESS') {
    await waitForUpload({ baseUrl, publisherId, itemId, accessToken, pollIntervalMs, maxAttempts });
  } else if (uploadResult.uploadState !== 'SUCCEEDED') {
    throw new Error(`Chrome Web Store upload did not succeed: ${JSON.stringify(uploadResult, null, 2)}`);
  }

  await publishItem({ baseUrl, publisherId, itemId, accessToken });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
