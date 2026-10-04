import { motion } from 'framer-motion';
import { Eye, Bookmark, ArrowLeftRight } from 'lucide-react';

/**
 * Middle column: notes of the selected root folder.
 * Every row's dot is registered in anchorRegistry — the engine's overlay canvas
 * draws one fiber from the folder card to each dot (Y read live from the DOM).
 */
export default function NoteList({ cat, notes, activeId, onSelect, anchorRegistry, engineRef, right, width, viewport }) {
  const reg = anchorRegistry.current;
  const top = 70, bottom = 28;
  const avail = viewport.h - top - bottom;
  const rowH = Math.max(38, Math.min(54, avail / Math.max(1, notes.length)));
  const listH = Math.min(avail, rowH * notes.length + 8);
  const y = top + (avail - listH) / 2;

  return (
    <motion.div
      key={cat.id}
      ref={(el) => {
        if (el) reg.container = el;
        else if (reg.container && !reg.container.isConnected) reg.container = null;
      }}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24, transition: { duration: 0.2 } }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="thin-scroll fixed z-20 overflow-y-auto py-1 pr-2"
      style={{ right, top: y, width, height: listH }}
    >
      <ul>
        {notes.map((n, i) => {
          const active = n.id === activeId;
          const col = active ? '#f4c069' : cat.color;
          return (
            <motion.li
              key={n.id}
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 + i * 0.025, duration: 0.35 }}
              style={{ height: rowH }}
              className="flex items-center"
            >
              <button
                title={n.path}
                onClick={() => onSelect(n)}
                onMouseEnter={() => engineRef.current?.setHoverAnchor(n.id)}
                onMouseLeave={() => engineRef.current?.setHoverAnchor(null)}
                className={`group relative flex w-full items-center rounded-lg border py-1 pl-6 pr-2.5 text-left transition-colors ${
                  active ? 'border-white/20 bg-white/[0.07] shadow-[0_0_24px_-8px_rgba(244,192,105,.5)]' : 'border-transparent hover:border-white/10 hover:bg-white/[0.035]'
                }`}
              >
                {/* fiber anchor */}
                <span
                  ref={(el) => (el ? reg.items.set(n.id, { el, color: cat.color }) : reg.items.delete(n.id))}
                  className="absolute left-1.5 top-1/2 h-[7px] w-[7px] -translate-y-1/2 rounded-full transition-transform group-hover:scale-125"
                  style={{ background: col, boxShadow: `0 0 10px ${col}` }}
                />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[12.5px] leading-tight ${active ? 'text-white' : 'text-zinc-300 group-hover:text-zinc-100'}`}>{n.title}</span>
                  {rowH >= 42 && (
                    <span className="mt-0.5 flex items-center gap-2.5 font-mono text-[9.5px] text-zinc-600">
                      <span className="flex items-center gap-1"><Eye size={9} />{n.views}</span>
                      <span className="flex items-center gap-1"><Bookmark size={9} />{n.saves}</span>
                      <span className="flex items-center gap-1"><ArrowLeftRight size={9} />{n.backlinks + n.out.length}</span>
                      <span className="text-zinc-700">{n.updated.slice(5)}</span>
                    </span>
                  )}
                </span>
              </button>
            </motion.li>
          );
        })}
      </ul>
    </motion.div>
  );
}
