import { motion, useReducedMotion } from 'framer-motion';

export default function Legend({ categories }) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.aside
      initial={{ opacity: reducedMotion ? 1 : 0, x: reducedMotion ? 0 : 24, filter: reducedMotion ? 'blur(0px)' : 'blur(6px)' }}
      animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, x: reducedMotion ? 0 : 24, filter: reducedMotion ? 'blur(0px)' : 'blur(6px)' }}
      transition={{ duration: reducedMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="glass fixed right-5 top-[70px] z-20 flex w-[176px] flex-col overflow-hidden rounded-2xl p-3.5"
      style={{ maxHeight: 'calc(100dvh - 94px)' }}
    >
      <div className="mb-2.5 flex shrink-0 items-baseline gap-1.5 text-[11px]">
        <span className="text-zinc-300">图例</span>
        <span className="text-zinc-600">Legend</span>
      </div>
      <ul aria-label="知识库目录图例" className="thin-scroll min-h-0 overflow-y-auto pr-1 space-y-1.5">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-2 text-[11px]">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.color, boxShadow: `0 0 8px ${c.color}` }} />
            <span title={c.path || c.name} className="min-w-0 flex-1 truncate text-zinc-300">{c.name}</span>
            <span title={`${c.count ?? 0} 篇笔记`} className="shrink-0 font-mono text-[10px] tabular-nums text-zinc-600">{c.count ?? 0}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2.5 flex shrink-0 items-center gap-2 text-[11px]">
        <span className="h-2 w-2 shrink-0 rounded-full border border-dashed border-zinc-500" />
        <span className="text-zinc-400">未创建</span>
        <span className="text-[10px] text-zinc-600">Unresolved</span>
      </div>
      <div className="my-2.5 h-px shrink-0 bg-white/[0.06]" />
      <div className="flex shrink-0 items-center justify-between text-[11px]">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_8px_#f4c069]" />
          <span className="text-zinc-300">双向</span>
          <span className="text-[10px] text-zinc-600">Mutual</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
          <span className="text-zinc-400">单向</span>
        </span>
      </div>
    </motion.aside>
  );
}
