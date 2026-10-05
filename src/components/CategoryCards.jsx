import { ICONS } from '../constants';

/**
 * Glass label cards attached to each category jellyfish.
 * Position/opacity are written directly by the engine (style.transform) every frame.
 */
export default function CategoryCards({ categories, labelRegistry, engineRef, selectedCat, onSelect }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-10">
      {categories.map((c) => {
        const Icon = ICONS[c.icon] || ICONS.FileText;
        const active = selectedCat === c.id;
        return (
          <button
            key={c.id}
            ref={(el) => (el ? labelRegistry.current.set(c.id, el) : labelRegistry.current.delete(c.id))}
            onClick={() => onSelect(c.id)}
            title={`${c.name} · ${c.count} 篇笔记`}
            aria-label={`展开 ${c.name}，${c.count} 篇笔记`}
            onMouseEnter={() => engineRef.current?.setHoverCat(c.id)}
            onMouseLeave={() => engineRef.current?.setHoverCat(null)}
            className="glass group absolute left-0 top-0 min-w-[132px] max-w-[176px] origin-top cursor-pointer rounded-xl px-3 py-2.5 text-left opacity-0 transition-[border-color,box-shadow] duration-300 will-change-transform hover:border-white/20"
            style={active ? { borderColor: `${c.color}66`, boxShadow: `0 0 28px -6px ${c.color}88, inset 0 1px 0 rgba(255,255,255,.08)` } : undefined}
          >
            <div className="flex items-center gap-2.5">
              <span
                className="grid h-6 w-6 place-items-center rounded-md border border-white/10 bg-white/5"
                style={{ color: c.color }}
              >
                <Icon size={13} strokeWidth={1.8} />
              </span>
              <span className="font-mono text-[22px] font-medium leading-none text-white text-glow">{c.count}</span>
            </div>
            <div className="mt-2 flex min-w-0 items-baseline gap-1.5 whitespace-nowrap">
              <span className="truncate text-[13px] font-medium text-zinc-100">{c.name}</span>
              {c.en && <span className="shrink-0 text-[10px] text-zinc-500">{c.en}</span>}
            </div>
            <div className="mt-0.5 whitespace-nowrap text-[10.5px] text-zinc-500">
              {c.metric[0]} <span className="text-zinc-600">{c.metric[1]}</span>
            </div>
            <span
              className="absolute -top-px left-4 right-4 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{ background: `linear-gradient(90deg, transparent, ${c.color}, transparent)` }}
            />
          </button>
        );
      })}
    </div>
  );
}
