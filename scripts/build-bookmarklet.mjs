import fs from 'node:fs';
import path from 'node:path';
import { minify } from 'terser';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const PAGES_DIR = path.join(DIST_DIR, 'pages');

const LOADER_BUNDLE_URL = 'https://ckob.github.io/ado-syntax-highlighter/bundle.js';
const DEFAULT_THEMES = ['prism-one-light', 'prism-tomorrow-night'];

function buildScopedThemeCss(themeNames) {
  return themeNames
    .map((name) => {
      const cssPath = path.join(ROOT_DIR, 'prism', 'themes', `${name}.css`);
      const rawCss = fs.readFileSync(cssPath, 'utf8');
      return `.${name} {\n${rawCss}\n}`;
    })
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'manifest.chrome.json'), 'utf8'));
  const prismSource = fs.readFileSync(path.join(ROOT_DIR, 'prism', 'prism.js'), 'utf8');
  const contentScriptSource = fs.readFileSync(path.join(ROOT_DIR, 'content_script.js'), 'utf8');
  const scopedCss = buildScopedThemeCss(DEFAULT_THEMES);

  const bundleSource = `
(function() {
  if (window.__adoSyntaxHighlighterRun) {
    window.__adoSyntaxHighlighterRun();
    return;
  }
  if (!document.getElementById('ado-syntax-highlighter-styles')) {
    var style = document.createElement('style');
    style.id = 'ado-syntax-highlighter-styles';
    style.textContent = ${JSON.stringify(scopedCss)};
    document.head.appendChild(style);
  }
  ${prismSource}
  ${contentScriptSource}
})();
`;

  const loaderSource = `
(function() {
  if (window.__adoSyntaxHighlighterRun) {
    window.__adoSyntaxHighlighterRun();
    return;
  }
  var script = document.createElement('script');
  script.src = ${JSON.stringify(LOADER_BUNDLE_URL)};
  document.head.appendChild(script);
})();
`;

  const [bundleResult, loaderResult] = await Promise.all([
    minify(bundleSource, { compress: true, mangle: true, format: { comments: false } }),
    minify(loaderSource, { compress: true, mangle: true, format: { comments: false } }),
  ]);

  if (!bundleResult.code || !loaderResult.code) {
    throw new Error('Terser failed to produce minified output.');
  }

  const bundledBookmarklet = 'javascript:' + encodeURIComponent(bundleResult.code);
  const loaderBookmarklet = 'javascript:' + encodeURIComponent(loaderResult.code);

  fs.mkdirSync(PAGES_DIR, { recursive: true });

  fs.writeFileSync(path.join(DIST_DIR, 'bookmarklet-bundled.txt'), bundledBookmarklet, 'utf8');
  fs.writeFileSync(path.join(DIST_DIR, 'bookmarklet-loader.txt'), loaderBookmarklet, 'utf8');
  fs.writeFileSync(path.join(PAGES_DIR, 'bundle.js'), bundleResult.code, 'utf8');

  const template = fs.readFileSync(path.join(ROOT_DIR, 'scripts', 'bookmarklet-page.html'), 'utf8');
  const html = template
    .replaceAll('{{VERSION}}', manifest.version)
    .replaceAll('{{BUNDLED_URL_JSON}}', JSON.stringify(bundledBookmarklet))
    .replaceAll('{{LOADER_URL_JSON}}', JSON.stringify(loaderBookmarklet))
    .replaceAll('{{BUNDLED_SIZE_KB}}', (Buffer.byteLength(bundledBookmarklet, 'utf8') / 1024).toFixed(1))
    .replaceAll('{{LOADER_SIZE_BYTES}}', String(Buffer.byteLength(loaderBookmarklet, 'utf8')));

  fs.writeFileSync(path.join(PAGES_DIR, 'index.html'), html, 'utf8');

  console.log(`Built bookmarklets (v${manifest.version}):`);
  console.log(`  - dist/bookmarklet-bundled.txt (${(Buffer.byteLength(bundledBookmarklet, 'utf8') / 1024).toFixed(1)} KB)`);
  console.log(`  - dist/bookmarklet-loader.txt (${Buffer.byteLength(loaderBookmarklet, 'utf8')} bytes)`);
  console.log(`  - dist/pages/index.html & dist/pages/bundle.js`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
