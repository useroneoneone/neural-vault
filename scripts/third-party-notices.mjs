import { mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

// Lucide 0.460.0's ISC license also identifies Feather-derived MIT portions.
// Keep its installed license verbatim and include the complete inherited terms.
// Pinned upstream source: https://github.com/feathericons/feather/blob/v4.29.2/LICENSE
const featherMit = `The MIT License (MIT)

Copyright (c) 2013-2023 Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

const textExtensions = new Set(['', '.txt', '.md', '.markdown', '.rst', '.adoc', '.html', '.htm', '.in']);
const noticeName = /^(?:licen[cs]e|copying|notices?|copyright)(?:[._-].*)?$/i;
const licenseDirectory = /^(?:licen[cs]es?|notices?)$/i;
const ignoredDirectories = new Set(['node_modules', '.git', '.hg', '.svn']);
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

function packageDirectory(moduleId, projectDirectory) {
  if (typeof moduleId !== 'string') return null;
  let modulePath = moduleId.replaceAll('\0', '').split(/[?#]/, 1)[0];
  if (modulePath.startsWith('file:')) {
    try { modulePath = fileURLToPath(modulePath); } catch { return null; }
  }
  modulePath = modulePath.replaceAll('\\', '/').replace(/^\/@fs\//, '');
  if (!path.isAbsolute(modulePath)) modulePath = path.resolve(projectDirectory, modulePath).replaceAll('\\', '/');
  const marker = '/node_modules/';
  const start = modulePath.toLowerCase().lastIndexOf(marker);
  if (start < 0) return null;
  const segments = modulePath.slice(start + marker.length).split('/');
  const packageName = segments[0]?.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0];
  if (!packageName || packageName.startsWith('.') || packageName.startsWith('@') && !segments[1]) return null;
  return path.resolve(modulePath.slice(0, start + marker.length) + packageName);
}

async function licenseFiles(packageRoot) {
  const files = [];
  async function visit(directory, insideLicenseDirectory = false) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => compare(a.name, b.name));
    for (const entry of entries) {
      const location = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name.toLowerCase())) {
          await visit(location, insideLicenseDirectory || licenseDirectory.test(entry.name));
        }
      } else if (entry.isFile() && textExtensions.has(path.extname(entry.name).toLowerCase()) && (insideLicenseDirectory || noticeName.test(entry.name))) {
        files.push({ name: path.relative(packageRoot, location).replaceAll('\\', '/'), text: (await readFile(location, 'utf8')).replaceAll('\r\n', '\n') });
      }
    }
  }
  await visit(packageRoot);
  return files.sort((a, b) => compare(a.name, b.name));
}

function licenseLabel(license) {
  if (typeof license === 'string') return license;
  if (license && typeof license.type === 'string') return license.type;
  return 'See license texts below';
}

/**
 * Write complete third-party license/notice texts for packages present in Rollup
 * chunk.modules. Nested node_modules and scoped packages retain their versions;
 * repeated copies with identical metadata/texts share one notice section.
 * No network access or absolute package paths are included in the output.
 * @param {{moduleIds: Iterable<string>, pluginDirectory: string, projectDirectory?: string}} options
 * @returns {Promise<{path: string, packages: Array<{name: string, version: string, license: string, files: string[]}>, warnings: string[]}>}
 */
export async function writeThirdPartyNotices({ moduleIds, pluginDirectory, projectDirectory = process.cwd() }) {
  if (!moduleIds || typeof moduleIds === 'string' || typeof moduleIds[Symbol.iterator] !== 'function') throw new TypeError('moduleIds must be an iterable of Rollup module IDs.');
  if (typeof pluginDirectory !== 'string' || !pluginDirectory) throw new TypeError('pluginDirectory must be a directory path.');
  const roots = new Set();
  const warnings = [];
  const bundles = [];
  const identities = new Set();
  for (const moduleId of moduleIds) {
    const root = packageDirectory(moduleId, projectDirectory);
    if (root) roots.add(root);
  }
  const resolvedRoots = new Set();
  for (const root of [...roots].sort(compare)) {
    // A dependency discovered in chunk.modules must not disappear silently.
    const canonicalRoot = await realpath(root);
    if (resolvedRoots.has(canonicalRoot)) continue;
    resolvedRoots.add(canonicalRoot);
    const metadata = JSON.parse(await readFile(path.join(canonicalRoot, 'package.json'), 'utf8'));
    const name = metadata.name || path.basename(canonicalRoot);
    const version = metadata.version || '(unspecified version)';
    const documents = await licenseFiles(canonicalRoot);
    if (!documents.length) warnings.push(`${name}@${version}: no complete LICENSE/COPYING/NOTICE file found`);
    for (const document of documents) {
      if (!document.text.trim()) warnings.push(`${name}@${version}: ${document.name} is empty`);
    }
    if (/^lucide(?:-|$)/.test(name) && documents.some(({ text }) => /Feather\s*\(MIT\)/i.test(text)) && !documents.some(({ text }) => /Permission is hereby granted, free of charge/.test(text))) {
      documents.push({ name: 'Feather MIT terms (upstream supplement)', source: 'https://github.com/feathericons/feather/blob/v4.29.2/LICENSE', text: featherMit });
    }
    const license = licenseLabel(metadata.license);
    const identity = createHash('sha256').update(JSON.stringify({ name, version, license, documents })).digest('hex');
    if (identities.has(identity)) continue;
    identities.add(identity);
    bundles.push({ name, version, license, documents });
  }
  bundles.sort((a, b) => compare(a.name, b.name) || compare(a.version, b.version));
  const sections = [
    'THIRD-PARTY SOFTWARE AND ARTWORK NOTICES\n\nThe following packages are included in this distribution. Their original\nlicenses and notices are reproduced below and apply to their respective\nthird-party portions. The project license does not replace these terms.\n',
  ];
  for (const bundle of bundles) {
    sections.push(`\n${'='.repeat(78)}\n${bundle.name}@${bundle.version}\nDeclared license: ${bundle.license}\n${'='.repeat(78)}\n`);
    for (const document of bundle.documents) {
      sections.push(`\n--- ${document.name} ---\n${document.source ? `Source: ${document.source}\n\n` : ''}${document.text}${document.text.endsWith('\n') ? '' : '\n'}`);
    }
  }
  await mkdir(pluginDirectory, { recursive: true });
  const outputPath = path.resolve(pluginDirectory, 'THIRD_PARTY_NOTICES.txt');
  await writeFile(outputPath, sections.join(''), 'utf8');
  return {
    path: outputPath,
    packages: bundles.map(({ name, version, license, documents }) => ({ name, version, license, files: documents.map(({ name: fileName }) => fileName) })),
    warnings,
  };
}
