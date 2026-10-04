import { motion, AnimatePresence } from 'framer-motion';
import { CornerDownLeft, Search } from 'lucide-react';

export default function SearchBar({ stats, catById, query, setQuery, results, onPick, shiftX, inputRef }) {
  const showResults = query.trim().length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0, x: shiftX }}
      transition={{ type: 'spring', stiffness: 160, damping: 24 }}
      className="fixed bottom-6 left-1/2 z-30 w-[min(540px,calc(100vw-32px))] -translate-x-1/2"
    >
      <AnimatePresence>
        {showResults && (
          <motion.ul
            initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
            className="glass thin-scroll mb-2 max-h-[220px] overflow-y-auto rounded-2xl p-1.5"
          >
            {results.length === 0 && <li className="px-3 py-2 text-[12px] text-zinc-500">没有匹配的节点</li>}
            {results.slice(0, 8).map((n, i) => {
              const c = catById[n.cat];
              return (
                <li key={n.id}>
                  <button title={n.path} onClick={() => onPick(n)} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[12.5px] text-zinc-300 hover:bg-white/[0.06]">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c.color, boxShadow: `0 0 8px ${c.color}` }} />
                    <span className="flex-1 truncate">{n.title}</span>
                    <span className="text-[10px] text-zinc-600 shrink-0">{c.name}</span>
                    {i === 0 && <CornerDownLeft size={12} className="text-zinc-600 shrink-0" />}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>

      <div className="glass flex items-center justify-between gap-4 rounded-full p-2">
        <div className="hidden items-center gap-4 pl-3 sm:flex">
          <div className="flex gap-1.5 text-[10.5px] font-medium tracking-wide">
            <span className="text-zinc-500">N</span>
            <span className="text-zinc-300">{stats.notes}</span>
          </div>
          <div className="flex gap-1.5 text-[10.5px] font-medium tracking-wide">
            <span className="text-zinc-500">L</span>
            <span className="text-zinc-300">{stats.links}</span>
          </div>
        </div>

        <div className="flex flex-1 items-center gap-2.5 rounded-full bg-white/[0.03] px-3 py-1.5">
          <Search size={14} className="text-zinc-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索关键词以定位笔记..."
            className="flex-1 bg-transparent text-[13px] text-zinc-200 placeholder-zinc-500 outline-none"
          />
          <kbd className="hidden rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-medium text-zinc-500 sm:block">
            Ctrl K
          </kbd>
        </div>
      </div>
    </motion.div>
  );
}
