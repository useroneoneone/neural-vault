import { classifyTechnicalContent, tokenizeInlineTechnical } from '../data/technicalContent.js';
import CopyButton from './CopyButton';

export default function InlineTechnical({ text }) {
  const type = classifyTechnicalContent(text);
  const label = type.kind === 'text' ? '代码' : type.label;
  return <span className="note-inline-code" data-content-kind={type.kind}>
    <code>{text}</code><CopyButton text={text} label={label} inline />
  </span>;
}

export function TechnicalText({ text }) {
  return tokenizeInlineTechnical(text).map((token, index) => token.kind === 'text' ? token.text : <InlineTechnical key={index} text={token.text} />);
}
