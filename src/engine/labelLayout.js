export function approximateLabelWidth(text) {
  let width = 0;
  for (const char of text) width += /[\u0000-\u007f]/u.test(char) ? 5.8 : 11;
  return width;
}

export function wrapLabel(text, measure = approximateLabelWidth, maximumWidth = 142) {
  const lines = [];
  let line = '';
  for (const char of String(text || '')) {
    if (line && measure(line + char) > maximumWidth) { lines.push(line); line = char; }
    else line += char;
  }
  if (line) lines.push(line);
  return { lines, width: lines.length ? Math.max(...lines.map((value) => measure(value))) : 0 };
}
