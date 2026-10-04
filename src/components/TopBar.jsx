import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Pause, Play, RotateCcw, Orbit, GitBranch, Sparkles } from 'lucide-react';

export default function TopBar({ mode, selectedCat, paused, onTogglePause, onReset, onBack, onModeTab }) {
  const tabs = [
    { id: 'galaxy', label: '星图', en: 'Galaxy', icon: Orbit },
    { id: 'branch', label: '分支', en: 'Branch', icon: GitBranch },
    { id: 'insight', label: '洞察', en: 'Insight', icon: Sparkles },
  ];
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-start justify-between px-5 pt-4">
      {/* left: brand / breadcrumb */}
      <div className="pointer-events-auto flex items-center gap-3">
        <div className="relative grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.03]">
          <div className="orb-ring absolute inset-0 rounded-xl" style={{ background: 'conic-gradient(from 0deg, transparent, rgba(244,192,105,.35), transparent 40%)' }} />
          <div className="absolute inset-[1px] rounded-[11px] bg-[#0a0a0b]" />
          <div className="breathe relative h-2.5 w-2.5 rounded-full bg-amber-200 shadow-[0_0_14px_3px_rgba(244,192,105,.6)]" />
        </div>
        <div className="leading-tight">
          <div className="text-[13px] font-semibold tracking-[0.28em] text-zinc-100">NEURAL·VAULT</div>
          <AnimatePresence mode="wait">
            {mode === 'branch' && selectedCat ? (
              <motion.button
                key="crumb"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                onClick={onBack}
                className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-200"
              >
                <ChevronLeft size={12} /> 星图 <span className="text-zinc-700">/</span>
                <span style={{ color: selectedCat.color }}>{selectedCat.name}</span>
              </motion.button>
            ) : (
              <motion.div key="sub" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="text-[11px] text-zinc-500">
                Obsidian · 神经元知识图谱
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* center: mode tabs */}
      <nav className="glass pointer-events-auto absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-1 rounded-full p-1">
        {tabs.map((t) => {
          const active = t.id === mode;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => onModeTab(t.id)}
              className={`relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] transition-colors ${active ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              {active && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-full border border-white/10 bg-white/[0.07]" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
              <Icon size={13} className="relative" />
              <span className="relative">{t.label}</span>
              <span className="relative text-[10px] text-zinc-600">{t.en}</span>
            </button>
          );
        })}
      </nav>

      {/* right: controls */}
      <div className="glass pointer-events-auto flex items-center gap-0.5 rounded-full p-1">
        <IconBtn onClick={onTogglePause} label={paused ? '播放' : '暂停'}>
          {paused ? <Play size={14} /> : <Pause size={14} />}
        </IconBtn>
        <IconBtn onClick={onReset} label="重置">
          <RotateCcw size={14} />
        </IconBtn>
      </div>
    </header>
  );
}

function IconBtn({ children, label, onClick }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white">
      {children}
      <span>{label}</span>
    </button>
  );
}
