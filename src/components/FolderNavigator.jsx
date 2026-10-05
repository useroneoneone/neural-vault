import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, FolderOpen } from 'lucide-react';

/** A compact, complete folder index when the canvas needs several groups. */
export default function FolderNavigator({ categories, selectedCat, onSelect, page, pageCount, onPageChange, mode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event) => { if (!ref.current?.contains(event.target)) setOpen(false); };
    const escape = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  if (categories.length <= 6) return null;
  const selected = categories.find((c) => c.id === selectedCat);
  return (
    <div ref={ref} className="fixed left-5 top-[72px] z-30 w-[224px]">
      <div className="glass flex items-center rounded-xl p-1.5">
        <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="folder-index"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-zinc-400 hover:bg-white/5 hover:text-zinc-100">
          <FolderOpen size={13} className="shrink-0" />
          <span className="truncate">{mode === 'branch' && selected ? selected.name : `根目录 · ${categories.length}`}</span>
          <ChevronDown size={12} className="ml-auto shrink-0" />
        </button>
      </div>
      {mode === 'galaxy' && pageCount > 1 && (
        <div className="mt-2 flex items-center justify-between px-2 text-[10px] text-zinc-500">
          <button type="button" aria-label="上一组水母" disabled={page === 0} onClick={() => onPageChange(page - 1)} className="rounded p-1 hover:bg-white/5 disabled:opacity-25"><ChevronLeft size={13} /></button>
          <span>水母 {page + 1} / {pageCount} 组</span>
          <button type="button" aria-label="下一组水母" disabled={page + 1 >= pageCount} onClick={() => onPageChange(page + 1)} className="rounded p-1 hover:bg-white/5 disabled:opacity-25"><ChevronRight size={13} /></button>
        </div>
      )}
      {open && (
        <div id="folder-index" className="glass thin-scroll mt-2 max-h-[min(420px,calc(100vh-210px))] overflow-y-auto rounded-xl p-1.5">
          {categories.map((c) => (
            <button key={c.id} type="button" title={c.name} onClick={() => { onSelect(c.id); setOpen(false); }}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] hover:bg-white/5 ${c.id === selectedCat && mode === 'branch' ? 'bg-white/5 text-zinc-100' : 'text-zinc-400'}`}>
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c.color }} />
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              <span className="font-mono text-[10px] text-zinc-500">{c.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
