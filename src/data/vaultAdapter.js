import { CATEGORIES, categoryForPath, normalizeVaultPath } from './categories.js';
import { buildReadingHistory } from './readingHistory.js';

const MD_EXTENSION = /\.md$/i;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const EXTERNAL = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

function scalar(value) {
  const text = value.trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1).replaceAll(text[0] + text[0], text[0]);
  }
  if (text.startsWith('[') && text.endsWith(']')) {
    return (text.slice(1, -1).match(/"[^"]*"|'[^']*'|[^,]+/g) ?? []).map((entry) => scalar(entry));
  }
  if (/^(true|false)$/i.test(text)) return text.toLowerCase() === 'true';
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return Number(text);
  return text.replace(/\s+#.*$/, '');
}

/** The plugin can supply metadataCache.frontmatter for full YAML support. */
export function parseMarkdown(content = '', cachedFrontmatter) {
  const source = String(content).replace(/^\uFEFF/, '');
  const match = source.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/);
  const frontmatter = {};
  if (match) {
    let listKey = null;
    for (const line of match[1].split(/\r?\n/)) {
      const keyValue = line.match(/^([\w-]+):[ \t]*(.*)$/);
      if (keyValue) {
        const [, key, value] = keyValue;
        frontmatter[key] = scalar(value);
        listKey = value.trim() ? null : key;
      } else if (listKey) {
        const item = line.match(/^\s+-\s+(.*)$/);
        if (item) {
          if (!Array.isArray(frontmatter[listKey])) frontmatter[listKey] = [];
          frontmatter[listKey].push(scalar(item[1]));
        }
      }
    }
  }
  return { frontmatter: { ...frontmatter, ...cachedFrontmatter }, body: match ? source.slice(match[0].length) : source };
}

export function plainText(markdown = '') {
  return String(markdown)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/!?\[\[([^\]]+)\]\]/g, (_, target) => {
      const [path, alias] = target.split('|');
      return alias || path.split('#')[0].split('/').at(-1);
    })
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
    .replace(/^[ \t]*\[[^\]]+\]:.*$/gm, '')
    .replace(/https?:\/\/[^\s<>]+/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/^[ \t]*(?:#{1,6}\s+|[-*+]\s+|\d+[.)]\s+|>\s*)/gm, '')
    .replace(/^\s*```[^\n]*$/gm, '')
    .replace(/^\s*~~~[^\n]*$/gm, '')
    .replace(/\[[ xX]\]\s*/g, '')
    .replace(/[*_`~]/g, '')
    .trim();
}

/** Chinese characters count individually; words in alphabetic languages count once. */
export function countWords(body) {
  const text = plainText(body);
  const ideographs = text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu) ?? [];
  const words = text.replace(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu, ' ').match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? [];
  return ideographs.length + words.length;
}

export function buildOutline(body, title) {
  const sections = [];
  let current = null;
  let paragraph = [];
  let fence = null;
  let code = [];
  const ensureSection = () => {
    if (!current) {
      current = { text: title, done: false, children: [] };
      sections.push(current);
    }
  };
  const flush = () => {
    const text = plainText(paragraph.join(' ')).replace(/\s+/g, ' ').trim();
    paragraph = [];
    if (!text) return;
    ensureSection();
    current.children.push({ text, done: false });
  };
  const flushCode = () => {
    ensureSection();
    current.children.push({ kind: 'code', text: code.join(''), language: fence.language, done: false });
    code = [];
    fence = null;
  };
  // Keep each original line ending so copying code does not alter its contents.
  for (const rawLine of body.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
    const line = rawLine.replace(/\r?\n$/, '');
    if (fence) {
      const closing = line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/);
      if (closing && closing[1][0] === fence.marker && closing[1].length >= fence.length) flushCode();
      else code.push(rawLine);
      continue;
    }
    const opening = line.match(/^ {0,3}(`{3,}|~{3,})([^\n]*)$/);
    if (opening && !(opening[1][0] === '`' && opening[2].includes('`'))) {
      flush();
      fence = { marker: opening[1][0], length: opening[1].length, language: opening[2].trim() };
      continue;
    }
    const heading = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*$/);
    if (heading) {
      flush();
      current = { text: plainText(heading[1]), done: false, children: [] };
      sections.push(current);
    } else if (!line.trim()) flush();
    else if (/^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(line)) {
      flush();
      paragraph.push(line);
      flush();
    } else paragraph.push(line);
  }
  if (fence) flushCode();
  flush();
  return sections.length ? sections : [{ text: title, done: false, children: [] }];
}

function tagsFor(body, frontmatter) {
  const metadataTags = Array.isArray(frontmatter.tags) ? frontmatter.tags : String(frontmatter.tags ?? '').split(/[,\s]+/);
  const inlineTags = [...body.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, '').matchAll(/(?:^|[\s(])#([\p{L}\p{N}_/-]+)/gu)].map((match) => match[1]);
  return [...new Set([...metadataTags, ...inlineTags].filter((tag) => typeof tag === 'string' && tag.trim()).map((tag) => tag.trim().replace(/^#/, '')))];
}

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function dateLabel(timestamp, fallback) {
  if (typeof fallback === 'string' && DATE_ONLY.test(fallback)) return fallback;
  const date = new Date(Number(timestamp));
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function activityFor(history, now) {
  if (Array.isArray(history)) return history.map((value) => value === true ? 1 : Math.min(1, numeric(value)));
  if (!history || typeof history !== 'object') return [];
  return buildReadingHistory([], now).days.map(({ date }) => history[date] ? 1 : 0);
}

function extractTargets(content) {
  const clean = content.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~|<!--[\s\S]*?-->/g, '');
  const targets = [...clean.matchAll(/!?\[\[([^\]\n]+)\]\]/g)].map((match) => match[1].split('|')[0]);
  for (const match of clean.matchAll(/!?\[[^\]\n]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+["'][^"']*["'])?\s*\)/g)) targets.push(match[1] || match[2]);
  const references = new Map([...clean.matchAll(/^\s*\[([^\]]+)\]:\s*(?:<([^>]+)>|(\S+))/gm)].map((match) => [match[1].toLowerCase(), match[2] || match[3]]));
  for (const match of clean.matchAll(/\[([^\]\n]+)\]\[([^\]\n]*)\]/g)) {
    const target = references.get((match[2] || match[1]).toLowerCase());
    if (target) targets.push(target);
  }
  return targets;
}

function noteTarget(raw) {
  let value = raw.trim();
  if (EXTERNAL.test(value)) return null;
  try { value = decodeURIComponent(value); } catch { /* Keep malformed percent signs literal. */ }
  value = value.split('#')[0].split('?')[0].trim();
  if (!value) return null;
  const file = value.split('/').at(-1);
  if (/\.[^./]+$/.test(file) && !MD_EXTENSION.test(file)) return null;
  return value;
}

function pathKey(path) {
  return normalizeVaultPath(path).replace(MD_EXTENSION, '').toLowerCase();
}

function makeResolver(records) {
  const byPath = new Map(records.map((record) => [pathKey(record.path), record.path]));
  const byName = new Map();
  for (const record of records) {
    const name = pathKey(record.path).split('/').at(-1);
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(record.path);
  }
  return (raw, sourcePath) => {
    const target = noteTarget(raw);
    if (!target) return { ignored: true };
    const sourceDir = sourcePath.slice(0, sourcePath.lastIndexOf('/') + 1);
    const local = byPath.get(pathKey(sourceDir + target));
    const absolute = byPath.get(pathKey(target));
    if (target.startsWith('./') || target.startsWith('../')) return { path: local, target };
    if (absolute) return { path: absolute, target };
    if (local) return { path: local, target };
    const key = pathKey(target);
    const candidates = target.includes('/')
      ? records.filter((record) => pathKey(record.path).endsWith('/' + key)).map((record) => record.path)
      : byName.get(key) ?? [];
    if (candidates.length === 1) return { path: candidates[0], target };
    const root = sourcePath.split('/')[0];
    const sameRoot = candidates.filter((path) => path.split('/')[0] === root);
    return { path: sameRoot.length === 1 ? sameRoot[0] : undefined, target };
  };
}

/**
 * Pure shared adapter for the browser snapshot and the Obsidian plugin.
 * records: [{ path, content, stat: {mtime, ctime}, frontmatter? }].
 * options.resolvedLinks: Obsidian metadataCache.resolvedLinks (authoritative).
 * options.readingHistory: { [path]: { 'YYYY-MM-DD': true | number } | number[] }.
 * Missing history, view counts and saves stay empty/zero; no events are invented.
 */
export function buildVault(records = [], { resolvedLinks, readingHistory = {}, now } = {}) {
  const seenPaths = new Set();
  const normalized = records.filter((record) => record && MD_EXTENSION.test(record.path ?? '')).map((record) => ({ ...record, path: normalizeVaultPath(record.path) })).filter((record) => {
    if (seenPaths.has(record.path)) return false;
    seenPaths.add(record.path);
    return true;
  }).sort((a, b) => a.path.localeCompare(b.path, 'zh-CN', { numeric: true }));
  const notes = [];
  for (const record of normalized) {
    const category = categoryForPath(record.path);
    if (!category) continue;
    const { body, frontmatter } = parseMarkdown(record.content, record.frontmatter);
    const filename = record.path.split('/').at(-1).replace(MD_EXTENSION, '');
    const firstHeading = body.match(/^\s{0,3}#\s+(.+?)\s*#*$/m)?.[1];
    const title = String(frontmatter.title || firstHeading || filename).trim();
    notes.push({
      id: record.path,
      path: record.path,
      title,
      cat: category.id,
      folder: record.path.split('/')[0],
      words: countWords(body),
      views: numeric(frontmatter.views),
      saves: numeric(frontmatter.saves),
      status: ['unread', 'reading', 'read'].includes(frontmatter.reading_status ?? frontmatter.status) ? (frontmatter.reading_status ?? frontmatter.status) : 'unread',
      updated: dateLabel(record.stat?.mtime ?? record.mtime, frontmatter.updated),
      mtime: numeric(record.stat?.mtime ?? record.mtime),
      tags: tagsFor(body, frontmatter),
      markdown: body,
      outline: buildOutline(body, title),
      activity: activityFor(readingHistory[record.path], now),
      stream: [],
      out: [],
      backlinks: 0,
      mutual: 0,
    });
  }
  const byId = new Map(notes.map((note) => [note.id, note]));
  const resolve = makeResolver(normalized);
  const unresolved = new Set();
  const directed = new Map(notes.map((note) => [note.id, new Set()]));
  for (const record of normalized) {
    if (!byId.has(record.path)) continue;
    const cachedTargets = Object.entries(resolvedLinks?.[record.path] ?? {}).filter(([, count]) => numeric(count) > 0).map(([path]) => normalizeVaultPath(path));
    const rawTargets = extractTargets(record.content ?? '');
    for (const rawTarget of rawTargets) {
      const target = resolve(rawTarget, record.path);
      if (target.ignored) continue;
      // Obsidian can resolve an ambiguous short filename more precisely than
      // the offline adapter. A cached destination must not appear as missing.
      const cachedMatch = cachedTargets.some((path) => pathKey(path) === pathKey(target.target) || pathKey(path).endsWith('/' + pathKey(target.target)));
      if (!target.path && !cachedMatch) unresolved.add(target.target);
      else if (resolvedLinks === undefined && byId.has(target.path) && target.path !== record.path) directed.get(record.path).add(target.path);
    }
    if (resolvedLinks !== undefined) {
      for (const targetPath of cachedTargets) {
        if (byId.has(targetPath) && targetPath !== record.path) directed.get(record.path).add(targetPath);
      }
    }
  }
  for (const [source, targets] of directed) {
    byId.get(source).out = [...targets];
    for (const target of targets) byId.get(target).backlinks++;
  }
  const edges = [];
  const edgeKeys = new Set();
  let mutualPairs = 0;
  for (const [source, targets] of directed) {
    for (const target of targets) {
      const key = JSON.stringify([source, target].sort());
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key);
      const mutual = directed.get(target).has(source);
      if (mutual) {
        mutualPairs++;
        byId.get(source).mutual++;
        byId.get(target).mutual++;
      }
      edges.push({ source, target, mutual });
    }
  }
  const totalWords = notes.reduce((sum, note) => sum + note.words, 0);
  const categories = CATEGORIES.map((category) => {
    const list = notes.filter((note) => note.cat === category.id);
    const words = list.reduce((sum, note) => sum + note.words, 0);
    const links = list.reduce((sum, note) => sum + note.out.length, 0);
    const metric = ['support', 'skills'].includes(category.id) ? [`${links} 双链`, 'links'] : [`${words.toLocaleString()} 字`, 'words'];
    return { ...category, count: list.length, metric };
  });
  return {
    categories,
    notes,
    edges,
    unresolved: [...unresolved].sort(),
    totalWords,
    stats: { notes: notes.length, links: [...directed.values()].reduce((sum, targets) => sum + targets.size, 0), mutual: mutualPairs, unresolved: unresolved.size },
  };
}
