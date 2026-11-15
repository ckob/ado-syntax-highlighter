import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function checkJsSyntax(relPath) {
  const fullPath = path.join(ROOT_DIR, relPath);
  execFileSync(process.execPath, ['--check', fullPath], { stdio: 'pipe' });
}

function readJson(relPath) {
  const fullPath = path.join(ROOT_DIR, relPath);
  const raw = fs.readFileSync(fullPath, 'utf8');
  return JSON.parse(raw);
}

function checkNonEmptyFile(relPath) {
  const fullPath = path.join(ROOT_DIR, relPath);
  assert(fs.existsSync(fullPath), `Missing expected build output: ${relPath}`);
  const stat = fs.statSync(fullPath);
  assert(stat.isFile() && stat.size > 0, `Expected non-empty file: ${relPath}`);
  return fullPath;
}

function main() {
  const jsFiles = [
    'background.js',
    'content_script.js',
    'options.js',
    'scripts/build-bookmarklet.mjs',
    'dist/pages/bundle.js',
  ];
  for (const file of jsFiles) {
    checkJsSyntax(file);
  }
  console.log(`JS syntax OK (${jsFiles.length} files).`);

  const chromeManifest = readJson('manifest.chrome.json');
  const firefoxManifest = readJson('manifest.firefox.json');
  readJson('dist/chrome_build/manifest.json');
  readJson('dist/firefox_build/manifest.json');

  assert(
    typeof chromeManifest.version === 'string' && chromeManifest.version.length > 0,
    'manifest.chrome.json is missing a valid version string'
  );
  assert(
    chromeManifest.version === firefoxManifest.version,
    `Manifest version mismatch: chrome=${chromeManifest.version}, firefox=${firefoxManifest.version}`
  );
  console.log(`Manifests valid and versions match (${chromeManifest.version}).`);

  const expectedOutputs = [
    'dist/chrome-extension.zip',
    'dist/firefox-extension.zip',
    'dist/bookmarklet-bundled.txt',
    'dist/bookmarklet-loader.txt',
    'dist/pages/index.html',
    'dist/pages/bundle.js',
  ];
  for (const output of expectedOutputs) {
    checkNonEmptyFile(output);
  }

  for (const bmFile of ['dist/bookmarklet-bundled.txt', 'dist/bookmarklet-loader.txt']) {
    const content = fs.readFileSync(path.join(ROOT_DIR, bmFile), 'utf8');
    assert(content.startsWith('javascript:'), `${bmFile} must start with "javascript:"`);
  }
  console.log(`Build artifacts OK (${expectedOutputs.length} files).`);
}

main();
