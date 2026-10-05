import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Eye, Bookmark, ArrowLeftRight } from 'lucide-react';
import { getNoteListWindow, getNoteScrollTop, NOTE_LIST_PADDING, NOTE_ROW_HEIGHT } from './noteListWindow.mjs';

/**
 * Middle column: a scrollable window over all notes in the selected folder.
 * Only mounted rows register anchors; the canvas reads their live positions.
 */
export default function NoteList({ cat, notes, activeId, onSelect, anchorRegistry, engineRef, right, width, viewport }) {
  const reg = anchorRegistry.current;
  const reducedMotion = useReducedMotion();
  const listRef = useRef(null);
  const openingWindow = useRef(null);
  const [screenHeight, setScreenHeight] = useState(viewport.h);
  const [scrollTop, setScrollTop] = useState(0);
  const [hasScrolled, setHasScrolled] = useState(false);
  const top = 70, bottom = 108;
  const availableHeight = Math.max(0, screenHeight - top - bottom);
  const listHeight = Math.min(availableHeight, notes.length ? notes.length * NOTE_ROW_HEIGHT + NOTE_LIST_PADDING * 2 : 112);
  const [clientHeight, setClientHeight] = useState(listHeight);
  const y = top + (availableHeight - listHeight) / 2;
  const listWindow = getNoteListWindow({ count: notes.length, scrollTop, viewportHeight: Math.min(clientHeight, listHeight) });
  const visibleNotes = notes.slice(listWindow.start, listWindow.end);
  const activeIndex = useMemo(() => notes.findIndex((note) => note.id === activeId), [notes, activeId]);

  if (!openingWindow.current && listWindow.visibleEnd > listWindow.visibleStart) {
    openingWindow.current = { start: listWindow.visibleStart, end: listWindow.visibleEnd };
  }

  useEffect(() => {
    const resize = () => setScreenHeight(globalThis.innerHeight);
    globalThis.addEventListener('resize', resize);
    return () => globalThis.removeEventListener('resize', resize);
  }, []);

  useLayoutEffect(() => setScreenHeight(viewport.h), [viewport.h]);

  const registerContainer = useCallback((el) => {
    const previous = listRef.current;
    listRef.current = el;
    if (el) {
      reg.container = el;
      // Exiting folders may still be mounted while the new list enters.
      for (const [id, anchor] of reg.items) {
        if (!el.contains(anchor.el)) reg.items.delete(id);
      }
    } else if (reg.container === previous) {
      reg.container = null;
    }
  }, [reg]);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const measure = () => setClientHeight(el.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [listHeight]);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const next = getNoteScrollTop({ index: activeIndex, count: notes.length, scrollTop: el.scrollTop, viewportHeight: el.clientHeight });
    if (next !== el.scrollTop) {
      el.scrollTop = next;
      setScrollTop(el.scrollTop);
      setHasScrolled(true);
    }
  }, [activeIndex, notes.length, listHeight]);

  return (
    <motion.div
      key={cat.id}
      ref={registerContainer}
      data-note-list={cat.id}
      data-note-count={notes.length}
      initial={{ opacity: reducedMotion ? 1 : 0, x: reducedMotion ? 0 : 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: reducedMotion ? 0 : 24, transition: { duration: reducedMotion ? 0 : 0.2 } }}
      transition={{ duration: reducedMotion ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
      onScroll={(event) => {
        setScrollTop(event.currentTarget.scrollTop);
        setHasScrolled(true);
      }}
      className="thin-scroll fixed z-20 overflow-x-hidden overflow-y-auto py-1 pr-2"
      style={{ right, top: y, width, height: listHeight }}
    >
      {notes.length ? (
        <ul aria-label={`${cat.name} · ${notes.length} 篇笔记`} className="relative" style={{ height: notes.length * NOTE_ROW_HEIGHT }}>
          {visibleNotes.map((n, ordinal) => {
            const index = listWindow.start + ordinal;
            const active = n.id === activeId;
            const col = active ? '#f4c069' : cat.color;
            const opening = openingWindow.current;
            const firstEntry = !hasScrolled && opening && index >= opening.start && index < opening.end;
            const entranceDelay = firstEntry
              ? 0.18 + (index - opening.start) * (1.47 / Math.max(1, opening.end - opening.start - 1))
              : 0;
            let registeredEl = null;

            return (
              <motion.li
                key={n.id}
                aria-posinset={index + 1}
                aria-setsize={notes.length}
                initial={{ opacity: reducedMotion ? 1 : 0, x: reducedMotion ? 0 : 14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: reducedMotion ? 0 : entranceDelay, duration: reducedMotion ? 0 : firstEntry ? 0.35 : 0.12 }}
                style={{ position: 'absolute', top: index * NOTE_ROW_HEIGHT, height: NOTE_ROW_HEIGHT, width: '100%' }}
                className="flex items-center"
              >
                <button
                  title={n.path || n.title}
                  onClick={() => onSelect(n)}
                  onMouseEnter={() => engineRef.current?.setHoverAnchor(n.id)}
                  onMouseLeave={() => engineRef.current?.setHoverAnchor(null)}
                  className={`group relative flex w-full items-center rounded-lg border py-1 pl-6 pr-2.5 text-left transition-colors ${
                    active ? 'border-white/20 bg-white/[0.07] shadow-[0_0_24px_-8px_rgba(244,192,105,.5)]' : 'border-transparent hover:border-white/10 hover:bg-white/[0.035]'
                  }`}
                >
                  {/* fiber anchor */}
                  <span
                    ref={(el) => {
                      if (el) {
                        registeredEl = el;
                        reg.items.set(n.id, {
                          el, color: cat.color, order: index,
                          visibleOrder: index - listWindow.visibleStart,
                          isVisible: index >= listWindow.visibleStart && index < listWindow.visibleEnd,
                          container: el.closest('[data-note-list]'),
                        });
                      } else if (reg.items.get(n.id)?.el === registeredEl) {
                        reg.items.delete(n.id);
                      }
                    }}
                    className="absolute left-1.5 top-1/2 h-[7px] w-[7px] -translate-y-1/2 rounded-full transition-transform group-hover:scale-125"
                    style={{ background: col, boxShadow: `0 0 10px ${col}` }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[12.5px] leading-tight ${active ? 'text-white' : 'text-zinc-300 group-hover:text-zinc-100'}`}>{n.title}</span>
                    <span className="mt-0.5 flex items-center gap-2.5 font-mono text-[9.5px] text-zinc-600">
                      <span className="flex items-center gap-1"><Eye size={9} />{n.views}</span>
                      <span className="flex items-center gap-1"><Bookmark size={9} />{n.saves}</span>
                      <span className="flex items-center gap-1"><ArrowLeftRight size={9} />{n.backlinks + n.out.length}</span>
                      <span className="text-zinc-700">{n.updated.slice(5)}</span>
                    </span>
                  </span>
                </button>
              </motion.li>
            );
          })}
        </ul>
      ) : (
        <div className="flex h-full flex-col justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 text-[12px] text-zinc-400">
          <span>暂无笔记</span>
          <span className="mt-1 text-[10px] text-zinc-600">这个目录中还没有 Markdown 笔记</span>
        </div>
      )}
    </motion.div>
  );
}
