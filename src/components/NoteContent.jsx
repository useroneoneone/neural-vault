import { useMemo } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeBlock from './CodeBlock';
import InlineTechnical from './InlineTechnical';

export default function NoteContent({ model, color, reveal }) {
  const components = useMemo(() => {
    function block(tag, className) {
      const Motion = motion[tag];
      return function MarkdownBlock({ node, children, ...props }) {
        const index = model.revealIndexByOffset.get(node?.position?.start.offset);
        return <Motion {...props} {...(index === undefined ? {} : reveal(index))} className={className}>{children}</Motion>;
      };
    }
    const renderer = {
      p: block('p'), li: block('li'), blockquote: block('blockquote'), hr: block('hr'), table: block('table'),
      pre({ node, children }) {
        const offset = node?.position?.start.offset;
        const code = model.codeByOffset.get(offset);
        const index = model.revealIndexByOffset.get(offset);
        return <motion.div {...(index === undefined ? {} : reveal(index))} className="note-code-container">
          {code ? <CodeBlock text={code.text} language={code.language} /> : <pre>{children}</pre>}
        </motion.div>;
      },
      code({ children }) { return <InlineTechnical text={String(children)} />; },
      a({ node, children, ...props }) { return <a {...props} target="_blank" rel="noreferrer">{children}</a>; },
      img({ alt }) { return <span className="note-image-reference">图片：{alt || '附件'}</span>; },
    };
    for (let level = 1; level <= 6; level++) renderer[`h${level}`] = block(`h${level}`);
    // A table scrolls inside the card, while its reveal applies to the table itself.
    const Table = renderer.table;
    renderer.table = (props) => <div className="note-table-wrap thin-scroll"><Table {...props} /></div>;
    return renderer;
  }, [model, reveal]);
  return <div className="note-markdown min-w-0 pb-6" style={{ '--note-accent': color }}>
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{model.markdown}</ReactMarkdown>
  </div>;
}
