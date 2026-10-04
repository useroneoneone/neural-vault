import { motion } from 'framer-motion';

export default function Legend({ categories }) {
  return (
    <motion.aside
      initial={{ opacity: 0, x: 24, filter: 'blur(6px)' }}
      animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, x: 24, filter: 'blur(6px)' }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="glass fixed right-5 top-[70px] z-20 w-[176px] rounded-2xl p-3.5"
    >
      <div className="mb-2.5 flex items-baseline gap-1.5 text-[11px]">
        <span className="text-zinc-300">图例</span>
        <span className="text-zinc-600">Legend</span>
      </div>
      <ul className="space-y-1.5">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-2 text-[11px]">
            <span className="h-2 w-2 rounded-full" style={{ background: c.color, boxShadow: `0 0 8px ${c.color}` }} />
            <span className="text-zinc-300">{c.type}</span>
            <span className="truncate text-[10px] text-zinc-600">{c.typeEn}</span>
          </li>
        ))}
        <li className="flex items-center gap-2 text-[11px]">
          <span className="h-2 w-2 rounded-full border border-dashed border-zinc-500" />
          <span className="text-zinc-400">未创建</span>
          <span className="text-[10px] text-zinc-600">Unresolved</span>
        </li>
      </ul>
      <div className="my-2.5 h-px bg-white/[0.06]" />
      <div className="flex items-center justify-between text-[11px]">
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
