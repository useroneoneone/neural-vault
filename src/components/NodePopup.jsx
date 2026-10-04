import { motion } from 'framer-motion';
import { Check, ExternalLink, X, Link2, Clock, Type, GitBranch } from 'lucide-react';
import { noteUrl, openNoteInHost } from '../data/vaultRuntime';
import { tagIcon } from '../constants';
import CodeBlock from './CodeBlock';
import { TechnicalText } from './InlineTechnical';

const PW = 360;

/** Glass detail panel that unfolds next to the clicked node, with a pin line back to it. */
export default function NodePopup({ popup, cat: c, limitRight, onClose, onOpenBranch }) {
  const { note, x, y } = popup;
  const H = 430;
  let left = x + 34;
  const flip = left + PW > limitRight - 16;
  if (flip) left = x - 34 - PW;
  left = Math.max(16, left);
  const top = Math.min(Math.max(y - 70, 72), window.innerHeight - H - 24);
  const ex = flip ? left + PW : left, ey = top + 30;
  const done = note.outline.flatMap((o) => [o, ...(o.children || [])]);
  const progress = done.length ? Math.round((done.filter((d) => d.done).length / done.length) * 100) : 0;

  return (
    <>
      {/* pin line */}
      <motion.svg initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none fixed inset-0 z-40 h-full w-full">
        <defs>
          <linearGradient id="pin" x1={x} y1={y} x2={ex} y2={ey} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={c.color} stopOpacity="0.9" />
            <stop offset="1" stopColor={c.color} stopOpacity="0.15" />
          </linearGradient>
        </defs>
        <motion.path
          d={`M${x},${y} C${(x + ex) / 2},${y} ${(x + ex) / 2},${ey} ${ex},${ey}`}
          stroke="url(#pin)"
          strokeWidth="1"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        />
        <circle cx={x} cy={y} r="9" fill="none" stroke={c.color} strokeOpacity="0.6" />
        <circle cx={x} cy={y} r="2.5" fill={c.color} />
      </motion.svg>

      <motion.div
        initial={{ opacity: 0, scale: 0.94, filter: 'blur(8px)', x: flip ? 12 : -12 }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', x: 0 }}
        exit={{ opacity: 0, scale: 0.96, filter: 'blur(6px)' }}
        transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
        style={{ left, top, width: PW, transformOrigin: flip ? 'right top' : 'left top' }}
        className="glass fixed z-40 overflow-hidden rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${c.color}, transparent)` }} />
        {/* title bar */}
        <div className="flex items-start gap-3 border-b border-white/[0.06] px-4 pb-3 pt-3.5">
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: c.color, boxShadow: `0 0 10px ${c.color}` }} />
          <div className="min-w-0 flex-1">
            <div className="text-[10.5px] text-zinc-500">
              {c.name} <span className="text-zinc-700">/</span> {note.folder}
            </div>
            <h3 className="mt-0.5 text-[15px] font-medium leading-snug text-zinc-50">{note.title}</h3>
          </div>
          <a href={noteUrl(note)} onClick={(event) => { if (openNoteInHost(note)) event.preventDefault(); }} title="在 Obsidian 中打开" className="rounded-md p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-200">
            <ExternalLink size={14} />
          </a>
          <button onClick={onClose} className="rounded-md p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-200">
            <X size={14} />
          </button>
        </div>

        {/* meta strip */}
        <div className="grid grid-cols-3 gap-px bg-white/[0.04] text-[10.5px]">
          {[
            [Type, `${note.words.toLocaleString()} 字`],
            [Link2, `${note.backlinks} 反链`],
            [Clock, note.updated],
          ].map(([I, v], i) => (
            <div key={i} className="flex items-center justify-center gap-1.5 bg-[#0c0c0e]/60 py-2 text-zinc-400">
              <I size={11} className="text-zinc-600" /> {v}
            </div>
          ))}
        </div>

        {/* outline tree */}
        <div className="thin-scroll max-h-[220px] overflow-y-auto px-4 py-3">
          <div className="mb-2 flex items-center justify-between text-[10.5px]">
            <span className="text-zinc-500">核心要点 · Outline</span>
            <span className="font-mono text-zinc-400">{progress}%</span>
          </div>
          <div className="mb-3 h-[3px] overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.8, delay: 0.15 }} className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${c.color}55, ${c.color})` }} />
          </div>
          <ul className="space-y-1.5">
            {note.outline.map((o, i) => (
              <motion.li key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06 }}>
                <Row item={o} color={c.color} strong />
                {o.children && (
                  <ul className="ml-[7px] mt-1 space-y-1 border-l border-white/[0.08] pl-3.5">
                    {o.children.map((ch, j) => (
                      <li key={j} className="relative">
                        <span className="absolute -left-3.5 top-[9px] h-px w-2.5 bg-white/[0.08]" />
                        <Row item={ch} color={c.color} />
                      </li>
                    ))}
                  </ul>
                )}
              </motion.li>
            ))}
          </ul>
        </div>

        {/* tags */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-white/[0.06] px-4 py-3">
          {note.tags.map((t) => {
            const I = tagIcon(t);
            return (
              <span key={t} className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-zinc-300">
                <I size={11} style={{ color: c.color }} /> {t}
              </span>
            );
          })}
          <button onClick={() => onOpenBranch(note.cat)} className="ml-auto flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-200">
            <GitBranch size={11} /> 展开分支
          </button>
        </div>
      </motion.div>
    </>
  );
}

function Row({ item, color, strong }) {
  if (item.kind === 'code') return <CodeBlock text={item.text} language={item.language} compact />;
  return (
    <div className="flex items-center gap-2">
      <span
        className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[4px] border"
        style={item.done ? { background: `${color}22`, borderColor: `${color}88`, color } : { borderColor: 'rgba(255,255,255,.15)' }}
      >
        {item.done && <Check size={9} strokeWidth={3} />}
      </span>
      <span className={`min-w-0 text-[12.5px] ${strong ? 'text-zinc-200' : 'text-zinc-400'} ${item.done && !strong ? 'line-through decoration-zinc-600' : ''}`}><TechnicalText text={item.text} /></span>
    </div>
  );
}
