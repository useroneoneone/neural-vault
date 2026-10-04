import { useMemo } from 'react';
import { FileCode2, Folder, Terminal } from 'lucide-react';
import { createLowlight } from 'lowlight';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import powershell from 'highlight.js/lib/languages/powershell';
import dos from 'highlight.js/lib/languages/dos';
import yaml from 'highlight.js/lib/languages/yaml';
import ini from 'highlight.js/lib/languages/ini';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import { classifyTechnicalContent } from '../data/technicalContent.js';
import CopyButton from './CopyButton';

const syntax = createLowlight({ json, bash, powershell, dos, yaml, ini, javascript, typescript, python, xml, css });
const grammars = { cmd: 'dos', toml: 'ini', dotenv: 'ini', html: 'xml', jsonc: 'json' };

function syntaxNodes(nodes) {
  return nodes.map((node, index) => node.type === 'text' ? node.value : (
    <span key={index} className={(node.properties?.className ?? []).join(' ')}>{syntaxNodes(node.children ?? [])}</span>
  ));
}

export default function CodeBlock({ text, language = '', compact = false }) {
  const type = useMemo(() => classifyTechnicalContent(text, language), [text, language]);
  const highlighted = useMemo(() => {
    const grammar = grammars[type.language] ?? type.language;
    if (!syntax.registered(grammar)) return text;
    try { return syntaxNodes(syntax.highlight(grammar, text).children); }
    catch { return text; }
  }, [text, type.language]);
  const Icon = type.kind === 'path' ? Folder : type.kind === 'command' ? Terminal : FileCode2;
  return (
    <div className={`note-code ${compact ? 'note-code-compact' : ''}`} data-content-kind={type.kind} data-language={type.language}>
      <div className="note-code-header">
        <span className="note-code-label"><Icon size={12} />{type.label}</span>
        <CopyButton text={text} label={type.label} />
      </div>
      <pre className="thin-scroll"><code>{highlighted}</code></pre>
    </div>
  );
}
