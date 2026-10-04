const HINTS = {
  json: ['json', 'JSON', 'config'], jsonc: ['jsonc', 'JSONC', 'config'],
  yaml: ['yaml', 'YAML', 'config'], yml: ['yaml', 'YAML', 'config'],
  toml: ['toml', 'TOML', 'config'], ini: ['ini', 'INI', 'config'],
  conf: ['ini', '配置', 'config'], config: ['text', '配置', 'config'],
  env: ['dotenv', '环境变量', 'config'], dotenv: ['dotenv', '环境变量', 'config'],
  bash: ['bash', 'Bash', 'command'], sh: ['bash', 'Shell', 'command'], shell: ['bash', 'Shell', 'command'], zsh: ['bash', 'Zsh', 'command'],
  console: ['bash', '终端命令', 'command'], terminal: ['bash', '终端命令', 'command'],
  powershell: ['powershell', 'PowerShell', 'command'], ps1: ['powershell', 'PowerShell', 'command'], pwsh: ['powershell', 'PowerShell', 'command'],
  cmd: ['cmd', 'CMD', 'command'], bat: ['cmd', 'CMD', 'command'], batch: ['cmd', 'CMD', 'command'],
  path: ['text', '文件路径', 'path'], filepath: ['text', '文件路径', 'path'],
  text: ['text', '文本', 'text'], txt: ['text', '文本', 'text'], plaintext: ['text', '文本', 'text'], plain: ['text', '文本', 'text'],
  js: ['javascript', 'JavaScript', 'code'], javascript: ['javascript', 'JavaScript', 'code'],
  ts: ['typescript', 'TypeScript', 'code'], typescript: ['typescript', 'TypeScript', 'code'],
  py: ['python', 'Python', 'code'], python: ['python', 'Python', 'code'],
  html: ['html', 'HTML', 'code'], css: ['css', 'CSS', 'code'], sql: ['sql', 'SQL', 'code'],
  md: ['markdown', 'Markdown', 'code'], markdown: ['markdown', 'Markdown', 'code'],
};

function result(language, label, kind) { return { language, label, kind }; }

function unquote(value) {
  return /^(["'])[\s\S]*\1$/.test(value) ? value.slice(1, -1) : value;
}

function isPath(value) {
  const text = unquote(value);
  const quoted = value !== text;
  if (!text || /[\r\n]/.test(text)) return false;
  if (/^[a-z]:[\\/][^<>"|?*]*$/i.test(text) && (quoted || (!/[，。；：]/.test(text) && !/\.[a-z\d]{1,12}\s+\S/i.test(text)))) return true;
  if (/^\\\\[^\\/\s]+[\\/][^<>"|?*]+$/.test(text)) return true;
  if (/^(?:%[a-z_][\w]*%|\$env:[a-z_][\w]*|\$(?:HOME|USERPROFILE|APPDATA))[\\/][^<>"|?*]+$/i.test(text)) return true;
  if (/^(?:\/(?!\/)|~\/|\.{1,2}\/)[^\s<>"'`，。；：]+$/.test(text)) return true;
  // Relative prose such as "read/write" needs no path styling. A filename
  // extension provides a stronger signal for an unprefixed relative path.
  return /^[\w.@+-]+(?:[\\/][^\s<>"'`，。；：]+)+\.[a-z\d]{1,12}$/i.test(text);
}

const COMMAND_VERBS = {
  git: /^(?:add|branch|checkout|clone|commit|config|diff|fetch|init|log|merge|pull|push|rebase|remote|reset|restore|show|status|switch|tag|worktree)(?:\s|$)/,
  npm: /^(?:install|i|ci|run|test|start|build|exec|config|init|create|update|uninstall|publish|list|ls)(?:\s|$)/,
  pnpm: /^(?:install|i|add|remove|run|dev|test|start|build|exec|dlx|create|update)(?:\s|$)/,
  yarn: /^(?:install|add|remove|run|dev|test|start|build|dlx|create|set|config)(?:\s|$)/,
  docker: /^(?:build|compose|container|cp|exec|images|image|info|inspect|kill|load|login|logs|network|ps|pull|push|rm|rmi|run|save|start|stats|stop|system|version|volume)(?:\s|$)/,
  systemctl: /^(?:daemon-reload|enable|disable|start|stop|restart|reload|status|is-active|list-units)(?:\s|$)/,
  tmux: /^(?:new|new-session|attach|attach-session|has-session|list-sessions|ls|send-keys|capture-pane|kill-session|split-window)(?:\s|$)/,
  kubectl: /^(?:apply|config|create|delete|describe|edit|exec|get|logs|port-forward|rollout|run|scale|version)(?:\s|$)/,
  apt: /^(?:update|upgrade|install|remove|search|list|show|autoremove)(?:\s|$)/,
  'apt-get': /^(?:update|upgrade|install|remove|autoremove)(?:\s|$)/,
};

function baseCommandLanguage(rawLine) {
  const line = rawLine.trim().replace(/^\$\s+/, '');
  if (/^#!.*\/(?:env\s+)?(?:bash|sh|zsh)\b/.test(line)) return 'bash';
  if (/^(?:pwsh|powershell)(?:\.exe)?(?:\s|$)/i.test(line)) return 'powershell';
  if (/^(?:Get|Set|New|Remove|Add|Clear|Copy|Move|Join|Split|Test|Start|Stop|Restart|Select|Where|ForEach|Write|Read|Invoke|Import|Export|ConvertTo|ConvertFrom|Measure|Resolve|Update|Out)-[a-z][\w-]*(?:\s|$)/i.test(line)) return 'powershell';
  if (/^\$(?:env:[a-z_]\w*|[a-z_]\w*)\s*=|^&\s+["'][^"']+["']/i.test(line)) return 'powershell';
  if (/^(?:@?echo\s+off|cmd(?:\.exe)?\s+\/[ck]\b|set\s+[a-z_]\w*=|(?:dir|ver|cls)\s*$|dir\s+(?:\/[a-z]|[a-z]:[\\/]|["'.%\\]))/i.test(line)) return 'cmd';
  if (/^(?:copy|xcopy|robocopy|del|rmdir|type)\s+(?:[a-z]:[\\/]|["']?[.%\\])/.test(line)) return 'cmd';
  const match = line.match(/^([a-z][\w.-]*)(?:\s+([\s\S]+))?$/i);
  if (!match) return null;
  const [, rawExecutable, args = ''] = match;
  const executable = rawExecutable.toLowerCase();
  if (COMMAND_VERBS[executable]) return COMMAND_VERBS[executable].test(args) || /^--?[\w-]+(?:\s|$)/.test(args) ? 'bash' : null;
  if (['ls', 'pwd', 'whoami', 'hostname', 'clear'].includes(executable) && (!args || /^--?[\w-]+(?:\s|$)/.test(args))) return 'bash';
  if (['ssh', 'scp', 'sftp'].includes(executable) && /^[-\w.@:/~'"\\]+(?:\s+[-\w.@:/~'"\\]+)*$/.test(args) && args) return 'bash';
  if (['curl', 'wget'].includes(executable) && /^(?:--?[\w-]+|https?:\/\/)/.test(args)) return 'bash';
  if (['python', 'python3', 'node', 'bash', 'sh', 'zsh'].includes(executable) && /^(?:--?[\w-]+|[.\/]|[\w.-]+\.(?:py|m?js|cjs|sh)(?:\s|$))/.test(args)) return 'bash';
  if (['npx', 'uvx', 'pip', 'pip3', 'uv', 'brew', 'dnf', 'yum', 'cargo', 'go', 'journalctl', 'netcatty-tool-cli', 'codex', 'opencode', 'ffmpeg'].includes(executable) && args && !/[\u4e00-\u9fff]/.test(args)) return 'bash';
  if (['cd', 'mkdir', 'cat', 'rm', 'chmod', 'chown', 'cp', 'mv', 'rg', 'grep', 'find', 'tar', 'unzip'].includes(executable) && args && /^(?:--?[\w-]+|[.\/~]|[a-z]:[\\/]|["']|[\w.-]+\.[\w-]+(?:\s|$))/.test(args)) return 'bash';
  if (executable === 'sudo' && commandLanguage(args)) return 'bash';
  // Unknown CLI tools require a flag; bare words remain ordinary prose.
  if (/^--?[\w-]+(?:\s|=|$)/.test(args)) return 'bash';
  return null;
}

function continuationMarker(line) {
  const value = line.trimEnd();
  const trailing = value.match(/([\\`^])\1*$/)?.[0] ?? '';
  return trailing.length % 2 === 1 ? trailing[0] : null;
}

function commandLanguage(rawLine) {
  const marker = continuationMarker(rawLine);
  const command = marker ? rawLine.trimEnd().slice(0, -1).trimEnd() : rawLine;
  let language = baseCommandLanguage(command);
  if (!language && marker && /^(?:curl|wget|node|python3?|git|docker|npm|pnpm|yarn|ssh|scp|npx|uvx?|pip3?|kubectl|ffmpeg)$/i.test(command.trim())) language = 'bash';
  if (!language) return null;
  return marker === '`' ? 'powershell' : marker === '^' ? 'cmd' : language;
}

function classifyCommands(lines) {
  const kinds = [];
  let continuing = false;
  for (const line of lines) {
    if (/^(?:#(?!\!)|;|\/\/)/.test(line)) continue;
    if (continuing) {
      continuing = Boolean(continuationMarker(line));
      continue;
    }
    const language = commandLanguage(line);
    if (!language) {
      if (kinds.length && /^[|&]/.test(line)) continue;
      return null;
    }
    kinds.push(language);
    continuing = Boolean(continuationMarker(line));
  }
  return kinds.length ? (kinds.includes('powershell') ? 'powershell' : kinds.includes('cmd') ? 'cmd' : 'bash') : null;
}

/** Conservative technical classification. Explicit fence hints take priority. */
export function classifyTechnicalContent(text, languageHint = '') {
  const hint = String(languageHint).trim().split(/\s+/)[0].toLowerCase();
  // A generic text fence often contains a pasted path or terminal command.
  if (hint && !['text', 'txt', 'plaintext', 'plain'].includes(hint)) {
    const known = HINTS[hint];
    if (known) return result(...known);
    if (/^[a-z][a-z\d+._-]*$/.test(hint)) return result(hint, hint.toUpperCase(), 'code');
  }
  const value = String(text ?? '').trim();
  if (!value) return result('text', '文本', 'text');
  if (/^[\[{]/.test(value)) {
    try {
      const parsed = JSON.parse(value);
      if (parsed !== null && typeof parsed === 'object') return result('json', 'JSON', 'config');
    } catch { /* Malformed JSON is not identified as JSON automatically. */ }
  }
  if (isPath(value)) return result('text', '文件路径', 'path');
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length > 1 && lines.every(isPath)) return result('text', '文件路径', 'path');
  const substantive = lines.filter((line) => !/^(?:#(?!\!)|;|\/\/)/.test(line));
  const commandType = classifyCommands(lines);
  if (commandType) {
    const language = commandType;
    return result(language, language === 'powershell' ? 'PowerShell' : language === 'cmd' ? 'CMD' : 'Shell', 'command');
  }
  const assignments = substantive.filter((line) => /^[a-z_][\w.-]*\s*=\s*\S/i.test(line));
  const sections = substantive.filter((line) => /^\[{1,2}[a-z_][\w .-]*\]{1,2}$/i.test(line));
  if (assignments.length && assignments.length + sections.length === substantive.length) {
    if (sections.length) {
      const toml = sections.some((line) => /^\[\[|\./.test(line));
      return result(toml ? 'toml' : 'ini', toml ? 'TOML' : 'INI', 'config');
    }
    if (assignments.length >= 2 || assignments.every((line) => /^[A-Z_][A-Z\d_]*=/.test(line))) return result('dotenv', '环境变量', 'config');
    if (!/\s[^"'\s]*\s/.test(assignments[0])) return result('text', '配置', 'config');
  }
  const mappings = substantive.filter((line) => /^[a-z_][\w.-]*:\s*(?:.*)$/i.test(line));
  const onlyProseValues = mappings.length && mappings.every((line) => /^[a-z_][\w.-]*:\s+[a-z][a-z'’-]*(?:\s+[a-z][a-z'’-]*)+[.!?]?$/i.test(line));
  if (!onlyProseValues && (mappings.length >= 2 || (mappings.length && substantive.some((line) => /^-\s+|^[a-z_][\w.-]*:\s*[>|]$/.test(line))))) {
    if (substantive.every((line) => /^[a-z_][\w.-]*:|^-\s+/i.test(line)) || /\n[ \t]+\S/.test(value)) return result('yaml', 'YAML', 'config');
  }
  return result('text', '文本', 'text');
}

const PATH_CANDIDATES = /(?:["'](?:[a-z]:[\\/]|\\\\|~\/|\/(?!\/))[^"'\r\n]+["']|[a-z]:[\\/](?:[^\\/\r\n<>"'`*，。；：、）)\]】]+[\\/])*[^\\/\r\n<>"'`*，。；：、）)\]】]+?\.[a-z\d]{1,12}(?=$|[\s*，。；：、）)\]】])|[a-z]:[\\/](?:[^\\/\r\n<>"'`*，。；：、）)\]】]+[\\/])*[^\s<>"'`*，。；：、）)\]】]+|\\\\[^\s<>"'`*，。；：、）)\]】]+|(?:%[a-z_]\w*%|\$env:[a-z_]\w*|\$(?:HOME|USERPROFILE|APPDATA))[\\/][^\s<>"'`*，。；：、）)\]】]+|(?:\/(?!\/)|~\/|\.{1,2}\/)[^\s<>"'`*，。；：、）)\]】]+|[\w.@+-]+(?:[\\/][^\s<>"'`*，。；：、）)\]】]+)+\.[a-z\d]{1,12})/gi;

function markdownProtectedSpans(source, includeUrls = true) {
  const patterns = [
    /(`+)[\s\S]*?\1/g,
    /!?\[[^\]\n]*\]\((?:\\.|[^)\n])*\)/g,
    /!?\[\[[^\]\n]+\]\]/g,
    /^[ \t]*\[[^\]]+\]:.*$/gm,
  ];
  if (includeUrls) patterns.push(/https?:\/\/[^\s]+/g);
  return patterns.flatMap((pattern) => [...source.matchAll(pattern)].map((match) => [match.index, match.index + match[0].length]));
}

/** Preserve every input character while identifying unquoted paths and whole commands. */
export function tokenizeInlineTechnical(text) {
  const source = String(text ?? '');
  if (!source) return [];
  const spans = [];
  const protectedSpans = markdownProtectedSpans(source);
  const markupSpans = markdownProtectedSpans(source, false);
  const protectedAt = (start, end) => protectedSpans.some(([left, right]) => start < right && end > left);
  const markupAt = (start, end) => markupSpans.some(([left, right]) => start < right && end > left);
  let offset = 0;
  for (const rawLine of source.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
    const line = rawLine.replace(/\r?\n$/, '');
    const prefix = line.match(/^[ \t]*(?:[-*+]\s+)?(?:(?:命令|运行命令|Command|Shell|PowerShell)[：:]\s*)?/i)?.[0] ?? '';
    const candidate = line.slice(prefix.length);
    const classified = classifyTechnicalContent(candidate);
    if (['command', 'path'].includes(classified.kind) && !markupAt(offset + prefix.length, offset + line.length)) spans.push({ start: offset + prefix.length, end: offset + line.length, kind: classified.kind, language: classified.language, label: classified.label });
    offset += rawLine.length;
  }
  for (const match of source.matchAll(PATH_CANDIDATES)) {
    const start = match.index;
    const end = start + match[0].length;
    if (start && !/[\s*（(\[：:，,]/.test(source[start - 1])) continue;
    if (protectedAt(start, end) || spans.some((span) => start < span.end && end > span.start)) continue;
    if (isPath(match[0])) spans.push({ start, end, kind: 'path', language: 'text', label: '文件路径' });
  }
  spans.sort((a, b) => a.start - b.start);
  const tokens = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start > cursor) tokens.push({ kind: 'text', text: source.slice(cursor, span.start) });
    const { start, end, ...classification } = span;
    tokens.push({ ...classification, text: source.slice(start, end) });
    cursor = end;
  }
  if (cursor < source.length) tokens.push({ kind: 'text', text: source.slice(cursor) });
  return tokens;
}

function inlineCode(text) {
  const runs = text.match(/`+/g) ?? [];
  const marker = '`'.repeat(Math.max(0, ...runs.map((run) => run.length)) + 1);
  const padding = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
  return marker + padding + text + padding + marker;
}

function preparedInline(source) {
  const tokens = tokenizeInlineTechnical(source);
  const result = tokens.map((token) => token.kind === 'text' ? token.text : inlineCode(token.text)).join('');
  const protectedSpans = markdownProtectedSpans(result);
  const spans = [...result.matchAll(/<\/?[a-z][a-z\d-]*(?:\s[^<>\n]*|\s*\/?)>/gi)].filter((match) => !protectedSpans.some(([left, right]) => match.index < right && match.index + match[0].length > left));
  let output = '';
  let cursor = 0;
  for (const match of spans) {
    output += result.slice(cursor, match.index) + inlineCode(match[0]);
    cursor = match.index + match[0].length;
  }
  return output + result.slice(cursor);
}

function wrapTechnicalBlock(raw, language) {
  const runs = raw.match(/`+/g) ?? [];
  const marker = '`'.repeat(Math.max(2, ...runs.map((run) => run.length)) + 1);
  const newline = raw.includes('\r\n') ? '\r\n' : '\n';
  return `${marker}${language}${newline}${raw}${raw.endsWith('\n') ? '' : newline}${marker}${newline}`;
}

function rawLines(source) { return source.match(/[^\n]*\n|[^\n]+$/g) ?? []; }
function lineText(line) { return line.replace(/\r?\n$/, ''); }
function configLine(line) {
  const text = line.trim();
  return /^(?:[a-z_][\w.-]*\s*[=:]|\[{1,2}[a-z_][\w .-]*\]{1,2}|-\s+\S|[#;]|\/\/)/i.test(text) || /^[ \t]+\S/.test(line);
}

function sourceCodeSpans(source, lines) {
  const spans = [];
  const visit = (node) => {
    if (node.type === 'code') spans.push([node.position.start.offset, node.position.end.offset]);
    else if (node.type === 'inlineCode' && node.position.start.line !== node.position.end.line) {
      // PowerShell continuation backticks can resemble a Markdown code span.
      // A recognized command ending at that marker must still be wrapped whole.
      const first = lineText(lines[node.position.start.line - 1] ?? '');
      if (!(continuationMarker(first) === '`' && commandLanguage(first) === 'powershell')) spans.push([node.position.start.offset, node.position.end.offset]);
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(markdownParser.parse(source));
  return spans;
}

/**
 * Render-only adaptation of pasted technical text. The source note is untouched.
 * Existing Markdown code and link destinations are protected from processing.
 */
export function prepareTechnicalMarkdown(markdown) {
  const source = String(markdown ?? '');
  const lines = rawLines(source);
  const codeSpans = sourceCodeSpans(source, lines);
  const offsets = [];
  let offset = 0;
  for (const line of lines) { offsets.push(offset); offset += line.length; }
  const protectedLine = (index) => codeSpans.some(([start, end]) => offsets[index] < end && offsets[index] + lines[index].length > start);
  let output = '';
  for (let index = 0; index < lines.length;) {
    if (protectedLine(index)) { output += lines[index++]; continue; }
    const line = lineText(lines[index]);
    const opening = line.match(/^ {0,3}(`{3,}|~{3,})([^\n]*)$/);
    if (opening && !(opening[1][0] === '`' && opening[2].includes('`'))) {
      output += lines[index++];
      while (index < lines.length) {
        const raw = lines[index++];
        output += raw;
        const closing = lineText(raw).match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/);
        if (closing && closing[1][0] === opening[1][0] && closing[1].length >= opening[1].length) break;
      }
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed) { output += lines[index++]; continue; }
    // Only a successful complete object/array is wrapped as JSON.
    if (/^(?:\{\s*(?:"|}|$)|\[\s*(?:["\[{\d-]|true|false|null|\]|$))/.test(trimmed)) {
      let raw = '';
      let found = false;
      for (let end = index; end < lines.length && end < index + 1000; end++) {
        if (protectedLine(end) || /^ {0,3}(?:`{3,}|~{3,})/.test(lineText(lines[end]))) break;
        raw += lines[end];
        if (classifyTechnicalContent(raw).language === 'json') {
          output += wrapTechnicalBlock(raw, 'json');
          index = end + 1;
          found = true;
          break;
        }
      }
      if (found) continue;
    }
    if (/^(?:<!DOCTYPE\b|<!--|<\/?[a-z][a-z\d-]*(?:\s[^>]*|\/?)>)/i.test(trimmed)) {
      let end = index + 1;
      while (end < lines.length && !protectedLine(end) && lineText(lines[end]).trim() && !/^ {0,3}(?:`{3,}|~{3,})/.test(lineText(lines[end]))) end++;
      output += wrapTechnicalBlock(lines.slice(index, end).join(''), 'html');
      index = end;
      continue;
    }
    if (configLine(line) && !/^\s*[#;]|^\s*\/\//.test(line)) {
      let end = index + 1;
      while (end < lines.length && !protectedLine(end) && lineText(lines[end]).trim() && configLine(lineText(lines[end])) && !/^ {0,3}(?:`{3,}|~{3,})/.test(lineText(lines[end]))) end++;
      const raw = lines.slice(index, end).join('');
      const classified = classifyTechnicalContent(raw);
      if (classified.kind === 'config') {
        output += wrapTechnicalBlock(raw, classified.language);
        index = end;
        continue;
      }
    }
    const classified = classifyTechnicalContent(line);
    if (['path', 'command'].includes(classified.kind) && !markdownProtectedSpans(line, false).length) {
      let end = index + 1;
      if (classified.kind === 'command') {
        while (end < lines.length) {
          if (continuationMarker(lineText(lines[end - 1])) && lineText(lines[end]).trim() && !/^ {0,3}(?:`{3,}|~{3,})/.test(lineText(lines[end]))) { end++; continue; }
          if (protectedLine(end)) break;
          const next = classifyTechnicalContent(lineText(lines[end]));
          if (next.kind !== 'command' || next.language !== classified.language) break;
          end++;
        }
      }
      output += wrapTechnicalBlock(lines.slice(index, end).join(''), classified.kind === 'path' ? 'path' : classified.language);
      index = end;
      continue;
    }
    output += preparedInline(lines[index++]);
  }
  return output;
}
import { unified } from 'unified';
import remarkParse from 'remark-parse';

const markdownParser = unified().use(remarkParse);
