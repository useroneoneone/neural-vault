import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import GraphCanvas from './components/GraphCanvas';
import CategoryCards from './components/CategoryCards';
import TopBar from './components/TopBar';
import Legend from './components/Legend';
import SearchBar from './components/SearchBar';
import NodePopup from './components/NodePopup';
import Sidebar from './components/Sidebar';
import NoteList from './components/NoteList';
import FolderNavigator from './components/FolderNavigator';
import PreviewControls from './components/PreviewControls';
import InsightControls from './components/InsightControls';
import { getVaultSnapshot, subscribeVault } from './data/vaultRuntime';
import { SIDEBAR_W } from './constants';
import { branchLayoutMetrics, categoryLayoutCapacity } from './engine/categoryLayout.js';

export default function App() {
  const VAULT = useSyncExternalStore(subscribeVault, getVaultSnapshot);
  const catById = useMemo(() => Object.fromEntries(VAULT.categories.map((c) => [c.id, c])), [VAULT]);
  const noteById = useMemo(() => Object.fromEntries(VAULT.notes.map((n) => [n.id, n])), [VAULT]);
  const engineRef = useRef(null);
  const labelRegistry = useRef(new Map());
  const anchorRegistry = useRef({ container: null, items: new Map() });
  const fpsRef = useRef(null);
  const inputRef = useRef(null);

  const urlBranch = new URLSearchParams(location.search).get('branch');
  const initCat = catById[urlBranch] ? urlBranch : null;
  const [mode, setMode] = useState(initCat ? 'branch' : 'galaxy');
  // Preset IDs may transfer to a newly created alias directory. Track the
  // actual root so refreshing cannot silently open a different directory.
  const [selectedRoot, setSelectedRoot] = useState(initCat ? catById[initCat].root : null);
  const selectedCategory = selectedRoot === null ? null : VAULT.categories.find((c) => c.root === selectedRoot);
  const selectedCat = selectedCategory?.id ?? null;
  const [popup, setPopup] = useState(null);
  const [activeId, setActiveId] = useState(initCat ? VAULT.notes.find((n) => n.cat === initCat)?.id ?? null : null);
  const [query, setQuery] = useState(new URLSearchParams(location.search).get('q') || '');
  const [paused, setPaused] = useState(false);
  const [insightFilter, setInsightFilter] = useState('all');
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [categoryPage, setCategoryPage] = useState(0);
  const [categoryPageCount, setCategoryPageCount] = useState(1);

  const branch = mode === 'branch' && !!catById[selectedCat];
  const catNotes = useMemo(() => (selectedCat ? VAULT.notes.filter((n) => n.cat === selectedCat) : []), [selectedCat, VAULT]);

  const openBranch = useCallback((catId) => {
    if (!catById[catId]) return;
    setSelectedRoot(catById[catId].root);
    setMode('branch');
    setPopup(null);
    setActiveId(VAULT.notes.find((n) => n.cat === catId)?.id ?? null);
  }, [VAULT, catById]);

  const closeBranch = useCallback(() => {
    setMode('galaxy');
    setPopup(null);
    setActiveId(null);
  }, []);

  const openNote = useCallback((note, pos) => {
    setPopup({ note, x: pos.x, y: pos.y });
    setActiveId(note.id);
  }, []);

  // ---- push state into the engine (no per-frame React work)
  useEffect(() => {
    engineRef.current?.setMode(mode, branch ? selectedCat : null, branch ? SIDEBAR_W : 0);
  }, [mode, selectedCat, branch]);
  useEffect(() => engineRef.current?.setQuery(query), [query]);
  useEffect(() => engineRef.current?.setActive(activeId), [activeId]);
  useEffect(() => engineRef.current?.setPaused(paused), [paused]);
  useEffect(() => engineRef.current?.setInsightFilter(insightFilter), [insightFilter]);
  useEffect(() => {
    const resize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => {
    const engine = engineRef.current;
    engine?.setCategoryPage?.(categoryPage);
    setCategoryPageCount(engine?.categoryPageCount ?? 1);
    if (engine && engine.categoryPage !== undefined && engine.categoryPage !== categoryPage) setCategoryPage(engine.categoryPage);
  }, [categoryPage, viewport, VAULT]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return VAULT.notes.filter((n) => n.title.toLowerCase().includes(q) || n.tags.some((t) => t.toLowerCase().includes(q)) || catById[n.cat]?.name.toLowerCase().includes(q));
  }, [query, VAULT, catById]);

  useEffect(() => {
    if (activeId && !noteById[activeId]) setActiveId(null);
    if (popup && !noteById[popup.note.id]) setPopup(null);
    else if (popup && popup.note !== noteById[popup.note.id]) setPopup({ ...popup, note: noteById[popup.note.id] });
  }, [noteById, activeId, popup]);
  useEffect(() => {
    if (selectedRoot !== null && !selectedCategory) {
      const replacement = VAULT.categories[0] ?? null;
      setSelectedRoot(replacement?.root ?? null);
      setActiveId(replacement && mode === 'branch' ? VAULT.notes.find((n) => n.cat === replacement.id)?.id ?? null : null);
      setPopup(null);
      if (!replacement) setMode('galaxy');
    }
  }, [VAULT, selectedRoot, selectedCategory, mode]);

  const pickResult = useCallback(
    (note) => {
      if (branch) {
        if (note.cat !== selectedCat) openBranch(note.cat);
        setActiveId(note.id);
        return;
      }
      let changingPage = false;
      if (mode === 'galaxy') {
        const engine = engineRef.current;
        const index = VAULT.categories.findIndex((c) => c.id === note.cat);
        const page = VAULT.categories.length <= 6 ? 0 : Math.floor(index / categoryLayoutCapacity(viewport.w, viewport.h));
        if (page !== categoryPage) { setCategoryPage(page); engine?.setCategoryPage?.(page); changingPage = true; }
      }
      // wait a beat so the leaf can settle back into galaxy layout
      setTimeout(() => {
        const p = engineRef.current?.getLeafScreen(note.id);
        if (p) openNote(note, p);
      }, changingPage ? 600 : 0);
    },
    [branch, selectedCat, mode, VAULT, categoryPage, viewport, openBranch, openNote],
  );

  // ---- keyboard
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === 'Escape') {
        if (document.activeElement === inputRef.current && query) setQuery('');
        else if (popup) setPopup(null);
        else if (mode === 'branch') closeBranch();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [popup, mode, query, closeBranch]);

  const callbacks = {
    onLeafClick: (note, pos) => {
      if (mode === 'branch') { if (note.cat !== selectedCat) openBranch(note.cat); setActiveId(note.id); }
      else openNote(note, pos);
    },
    onCatClick: (id) => openBranch(id),
    onBackgroundClick: () => {
      setPopup(null);
      if (mode === 'branch') setActiveId(null);
    },
  };

  const activeNote = activeId && (!branch || noteById[activeId]?.cat === selectedCat) ? noteById[activeId] : null;

  return (
    <div className="bg-void relative h-screen w-screen overflow-hidden">
      <div className="bg-grid pointer-events-none fixed inset-0" />
      <div className="bg-noise pointer-events-none fixed inset-0" />

      <GraphCanvas
        data={VAULT}
        engineRef={engineRef}
        labelRegistry={labelRegistry}
        anchorRegistry={anchorRegistry}
        fpsRef={fpsRef}
        callbacks={callbacks}
        viewState={{ mode, catId: branch ? selectedCat : null, sidebarW: branch ? SIDEBAR_W : 0, query, activeId, paused, insightFilter, categoryPage }}
      />

      <AnimatePresence>
        {mode === 'insight' && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className={`fixed left-6 ${VAULT.categories.length > 6 ? 'top-[138px]' : 'top-24'} z-20 flex flex-col gap-2`}
          >
            {[{ id: 'all', label: '全部' }, { id: 'unread', label: '未读' }, { id: 'reading', label: '在读' }, { id: 'read', label: '已读' }].map(f => (
              <button
                key={f.id}
                onClick={() => setInsightFilter(f.id)}
                className={`rounded-full border px-4 py-1.5 text-[12.5px] font-medium transition-colors ${insightFilter === f.id ? 'border-amber-200/50 bg-amber-200/10 text-amber-200' : 'border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200'}`}
              >
                {f.label}
              </button>
            ))}
            <p className="mt-3 max-w-[100px] text-[10px] leading-relaxed text-zinc-600">拖动节点，探索关联<br />滚轮缩放，拖动空白平移</p>
          </motion.div>
        )}
      </AnimatePresence>

      <CategoryCards
        categories={VAULT.categories}
        labelRegistry={labelRegistry}
        engineRef={engineRef}
        selectedCat={branch ? selectedCat : null}
        onSelect={openBranch}
      />
      <FolderNavigator categories={VAULT.categories} selectedCat={selectedCat} onSelect={openBranch}
        page={categoryPage} pageCount={categoryPageCount} onPageChange={setCategoryPage} mode={mode} />
      {VAULT.categories.length === 0 && (
        <div className="glass pointer-events-none fixed left-1/2 top-[68%] z-20 -translate-x-1/2 rounded-2xl px-6 py-4 text-center">
          <p className="text-[13px] text-zinc-300">知识库还没有笔记或根目录</p>
          <p className="mt-1 text-[11px] text-zinc-500">添加 Markdown 笔记后，星图会自动更新。</p>
        </div>
      )}

      <TopBar
        mode={mode}
        selectedCat={selectedCat ? catById[selectedCat] : null}
        paused={paused}
        onTogglePause={() => setPaused((p) => !p)}
        onReset={() => {
          closeBranch();
          setQuery('');
        }}
        onBack={closeBranch}
        onModeTab={(id) => {
          if (id === 'galaxy') closeBranch();
          else if (id === 'branch') openBranch(selectedCat || VAULT.categories[0]?.id);
          else if (id === 'insight') {
            setMode('insight');
            setPopup(null);
            setActiveId(null);
          }
        }}
      />

      <AnimatePresence>{!branch && <Legend key="legend" categories={VAULT.categories} />}</AnimatePresence>

      <AnimatePresence>
        {branch && (
          <NoteList
            key={`list-${selectedCat}`}
            cat={catById[selectedCat]}
            notes={catNotes}
            activeId={activeId}
            onSelect={(note) => setActiveId(note.id)}
            anchorRegistry={anchorRegistry}
            engineRef={engineRef}
            right={activeNote ? SIDEBAR_W + 12 : 24}
            width={branchLayoutMetrics(viewport.w, viewport.h).listWidth}
            viewport={viewport}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {branch && activeNote && (
          <Sidebar
            key={`sidebar-${activeNote.id}`}
            cat={catById[selectedCat]}
            notes={catNotes}
            activeNote={activeNote}
            totalWords={VAULT.totalWords}
            onClose={() => setActiveId(null)}
            engineRef={engineRef}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {popup && catById[popup.note.cat] && (
          <NodePopup
            key={popup.note.id}
            popup={popup}
            cat={catById[popup.note.cat]}
            limitRight={branch ? viewport.w - SIDEBAR_W : viewport.w}
            onClose={() => setPopup(null)}
            onOpenBranch={openBranch}
          />
        )}
      </AnimatePresence>

      <SearchBar
        stats={VAULT.stats}
        catById={catById}
        query={query}
        setQuery={setQuery}
        results={results}
        onPick={pickResult}
        shiftX={branch ? -SIDEBAR_W / 2 : 0}
        inputRef={inputRef}
      />
      {mode === 'insight' && <InsightControls engineRef={engineRef} />}
      {import.meta.env.DEV && import.meta.env.VITE_STRESS_PREVIEW === 'true' && <PreviewControls vault={VAULT} />}

      {/* watermark + perf */}
      <div className="pointer-events-none fixed bottom-5 left-5 z-10 select-none">
        <div className="text-[11px] font-semibold tracking-[0.5em] text-zinc-400">NEURAL</div>
        <div className="text-[9px] tracking-[0.62em] text-zinc-600">VAULT · OS</div>
        <div className="mt-2 flex items-center gap-2 font-mono text-[10px] text-zinc-600">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80 shadow-[0_0_6px_#34d399]" />
          <span ref={fpsRef}>-- FPS</span>
          <span>· Canvas2D · {VAULT.notes.length} nodes · {VAULT.edges.length} edges</span>
        </div>
      </div>
    </div>
  );
}
