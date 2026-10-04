import { useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ExternalLink, X } from 'lucide-react';
import { ICONS, SIDEBAR_W } from '../constants';
import ReadingHeatmap from './ReadingHeatmap';
import NoteContent from './NoteContent';
import { createMarkdownContent } from '../data/markdownContent.js';
import { noteUrl, openNoteInHost } from '../data/vaultRuntime.js';

/**
 * Right sidebar. Shows details of the active note.
 */
export default function Sidebar({ cat, notes, activeNote, totalWords, onClose, engineRef }) {
  const Icon = ICONS[cat.icon];
  const reducedMotion = useReducedMotion();
  const content = useMemo(() => createMarkdownContent(activeNote?.markdown ?? ''), [activeNote?.markdown]);
  const revealCount = content.revealCount;
  // Match the note list's short sideways fade, ordered from top to bottom.
  // The final content row finishes at two seconds, regardless of note length.
  const reveal = useCallback((index) => ({
    initial: { opacity: reducedMotion ? 1 : 0, x: reducedMotion ? 0 : 14 },
    animate: { opacity: 1, x: 0 },
    transition: reducedMotion
      ? { duration: 0 }
      : { delay: 0.12 + index * (1.53 / (revealCount - 1)), duration: 0.35 },
  }), [reducedMotion, revealCount]);

  return (
    <motion.aside
      initial={{ x: reducedMotion ? 0 : SIDEBAR_W + 40, opacity: reducedMotion ? 1 : 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: reducedMotion ? 0 : SIDEBAR_W + 40, opacity: 0 }}
      transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 170, damping: 26 }}
      className="glass fixed bottom-3 right-3 top-[66px] z-20 flex flex-col overflow-clip rounded-2xl"
      style={{ width: SIDEBAR_W - 12 }}
    >
      <div className="absolute inset-y-0 left-0 w-px" style={{ background: `linear-gradient(180deg, transparent, ${cat.color}66, transparent)` }} />

      <div className="flex min-h-0 flex-1 flex-col">
        {/* header */}
        <motion.div {...reveal(0)} className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-white/[0.04]" style={{ color: cat.color }}>
            <Icon size={15} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 truncate">
              <span className="text-[14px] font-medium text-zinc-100">{cat.name}</span>
              <span className="text-[11px] text-zinc-600">{cat.en}</span>
            </div>
          </div>
          {activeNote && (
            <a
              href={noteUrl(activeNote)}
              onClick={(event) => { if (openNoteInHost(activeNote)) event.preventDefault(); }}
              title="在 Obsidian 中打开原文"
              aria-label="在 Obsidian 中打开原文"
              className="rounded-md p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
            >
              <ExternalLink size={15} />
            </a>
          )}
          <button type="button" onClick={onClose} aria-label="关闭卡片" className="rounded-md p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-200">
            <X size={15} />
          </button>
        </motion.div>

        {/* analytics (bottom half) */}
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-5 py-2.5">
          <AnimatePresence mode="wait">
            {activeNote && <Analytics key={activeNote.id} note={activeNote} content={content} totalWords={totalWords} color={cat.color} reveal={reveal} reducedMotion={reducedMotion} />}
          </AnimatePresence>
        </div>
      </div>
    </motion.aside>
  );
}

function Analytics({ note, content, totalWords, color, reveal, reducedMotion }) {
  const share = (totalWords > 0 ? (note.words / totalWords) * 100 : 0).toFixed(1);
  return (
    <motion.div exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.18 }}>
      <motion.div {...reveal(1)} className="text-[10.5px] uppercase tracking-[0.18em] text-zinc-600">Analysis · 分析</motion.div>
      <motion.h4 {...reveal(2)} className="mt-1 text-[15px] font-medium leading-snug text-zinc-50">{note.title}</motion.h4>
      <motion.div {...reveal(3)} className="mt-1.5 flex items-center gap-2 text-[11px] text-zinc-500">
        <span className="grid h-4 w-4 place-items-center rounded-full bg-gradient-to-br from-amber-200 to-violet-400 text-[9px] font-semibold text-black">N</span>
        <span className="text-zinc-300">本地笔记</span>
        <span className="text-zinc-700">·</span>
        <span>{note.updated}</span>
        <span className="text-zinc-700">·</span>
        <span>{Math.max(1, Math.round(note.words / 450))} min read</span>
      </motion.div>

      <motion.div {...reveal(4)} className="mt-2.5 grid grid-cols-3 gap-2">
        {[
          [`${share}%`, '库占比', 'Share'],
          [note.words.toLocaleString(), '字数', 'Words'],
          [note.backlinks + note.out.length, '双链', 'Links'],
        ].map(([v, l, en]) => (
          <div key={en} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
            <div className="font-mono text-[20px] font-medium leading-none text-white">{v}</div>
            <div className="mt-1 text-[10.5px] text-zinc-500">
              {l} <span className="text-zinc-700">{en}</span>
            </div>
          </div>
        ))}
      </motion.div>

      {/* activity heatmap */}
      <motion.div {...reveal(5)} className="mt-3">
        <div className="mb-1.5 flex items-center justify-between text-[10.5px] uppercase tracking-[0.18em] text-zinc-600">
          <span>Footprints · 阅读足迹</span>
          <span className="normal-case tracking-normal">最近半年</span>
        </div>
        <ReadingHeatmap activity={note.activity} color={color} />
      </motion.div>

      <motion.div {...reveal(6)} className="mb-2.5 mt-4 flex items-center justify-between text-[10.5px] uppercase tracking-[0.18em] text-zinc-600">
        <span>Content · 笔记内容</span>
      </motion.div>
      <NoteContent model={content} color={color} reveal={reveal} />
    </motion.div>
  );
}
